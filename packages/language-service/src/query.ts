import { isMarkdownPath, type WorkspaceFileId, type WorkspacePath, type WorkspaceStorage } from '@abnt/workspace-core';
import type { WorkspaceIndex, WorkspaceSearchResult } from '@abnt/workspace-index';

import { documentTarget } from './language-service.js';

/**
 * Sintaxe estruturada v1: só conjunção implícita (espaço = AND), sem OR, NOT
 * ou parênteses — o suficiente para `cites:`/`has:`/`linksto:`/`type:`
 * combinados com texto livre. Ver docs/adr/0016 ("Não decidido aqui").
 */
export type QueryTerm =
  | { readonly kind: 'text'; readonly value: string }
  | { readonly kind: 'cites'; readonly referenceId: string }
  | { readonly kind: 'has'; readonly feature: 'figure' | 'table' | 'citation' }
  | { readonly kind: 'linksto'; readonly target: string }
  | { readonly kind: 'type'; readonly value: string }
  | { readonly kind: 'tag'; readonly value: string }
  | { readonly kind: 'property'; readonly key: 'author' | 'year' | 'profile' | 'lang'; readonly value: string };

export interface QueryAst {
  readonly terms: readonly QueryTerm[];
}

const STRUCTURED_PREFIX = /^(cites|has|linksto|type|tag|author|year|profile|lang):(.+)$/u;

const tokenize = (input: string): readonly string[] => {
  const tokens: string[] = [];
  const pattern = /([a-z]+):"([^"]*)"|"([^"]*)"|(\S+)/giu;
  let match = pattern.exec(input);
  while (match !== null) {
    const token = match[1] === undefined ? match[3] ?? match[4] ?? '' : `${match[1]}:${match[2] ?? ''}`;
    if (token !== '') tokens.push(token);
    match = pattern.exec(input);
  }
  return tokens;
};

/**
 * Prefixo desconhecido (`foo:bar`) cai em termo de texto livre — mesma
 * filosofia defensiva de `WorkspaceIndex.search()`, que já engole sintaxe
 * FTS inválida sem erro em vez de rejeitar a consulta do usuário.
 */
export function parseStructuredQuery(input: string): QueryAst {
  const terms: QueryTerm[] = [];
  for (const token of tokenize(input)) {
    const structured = STRUCTURED_PREFIX.exec(token);
    const prefix = structured?.[1];
    const rawValue = structured?.[2];
    if (prefix !== undefined && rawValue !== undefined) {
      if (prefix === 'cites') {
        terms.push({ kind: 'cites', referenceId: rawValue.startsWith('@') ? rawValue.slice(1) : rawValue });
        continue;
      }
      if (prefix === 'has' && (rawValue === 'figure' || rawValue === 'table' || rawValue === 'citation')) {
        terms.push({ kind: 'has', feature: rawValue });
        continue;
      }
      if (prefix === 'linksto') {
        terms.push({ kind: 'linksto', target: rawValue });
        continue;
      }
      if (prefix === 'type') {
        terms.push({ kind: 'type', value: rawValue });
        continue;
      }
      if (prefix === 'tag') {
        terms.push({ kind: 'tag', value: rawValue.replace(/^#/u, '') });
        continue;
      }
      if (prefix === 'author' || prefix === 'year' || prefix === 'profile' || prefix === 'lang') {
        terms.push({ kind: 'property', key: prefix, value: rawValue });
        continue;
      }
    }
    terms.push({ kind: 'text', value: token });
  }
  return { terms };
}

export interface StructuredQueryBackend {
  readonly index: WorkspaceIndex;
  readonly storage: WorkspaceStorage;
  /** Projeção de metadata fornecida pelo host; language-service não lê YAML. */
  readonly metadata?: () => Promise<readonly { readonly fileId: WorkspaceFileId; readonly tags: readonly string[]; readonly properties: Readonly<Record<string, readonly string[]>> }[]>;
}

const matchesType = (path: WorkspacePath, value: string): boolean => {
  const wanted = value.toLocaleLowerCase();
  if (wanted === 'markdown') return isMarkdownPath(path);
  return String(path).toLocaleLowerCase().endsWith(`.${wanted}`);
};

/**
 * Planner: cada termo estruturado reduz o universo de arquivos a um conjunto
 * candidato (AND entre termos); texto livre acumula e vai para o FTS5
 * (`index.search`), que já faz ranking — reimplementar ranking aqui duplicaria
 * o `bm25()` que o SQLite já calcula. `linksto:` reaproveita `documentTarget`,
 * a MESMA resolução de link relativo que `definition`/`references`/`backlinks`
 * já usam (ver docs/adr/0016) — nunca uma segunda implementação.
 */
export async function executeStructuredQuery(
  ast: QueryAst,
  backend: StructuredQueryBackend,
  limit = 20,
): Promise<readonly WorkspaceSearchResult[]> {
  const files = await backend.storage.list();
  let candidates: Set<WorkspaceFileId> | undefined;
  const textTerms: string[] = [];

  const intersect = (matches: ReadonlySet<WorkspaceFileId>): void => {
    candidates = candidates === undefined ? new Set(matches) : new Set([...candidates].filter((id) => matches.has(id)));
  };

  for (const term of ast.terms) {
    switch (term.kind) {
      case 'text':
        textTerms.push(term.value);
        break;
      case 'cites':
        intersect(new Set(backend.index.citations(undefined, term.referenceId).map((citation) => citation.fileId)));
        break;
      case 'has':
        intersect(
          new Set(
            term.feature === 'citation'
              ? backend.index.citations().map((citation) => citation.fileId)
              : backend.index.blocks(undefined, term.feature).map((block) => block.fileId),
          ),
        );
        break;
      case 'linksto': {
        const needle = term.target.toLocaleLowerCase();
        const targetPaths = new Set<string>();
        for (const file of files) {
          if (String(file.path).toLocaleLowerCase().includes(needle)) targetPaths.add(String(file.path));
        }
        for (const title of backend.index.documentTitles()) {
          if (title.title.toLocaleLowerCase().includes(needle)) targetPaths.add(String(title.path));
        }
        const matches = backend.index.links().flatMap((link) => {
          const resolved = documentTarget(link.path, link.target);
          return resolved !== undefined && targetPaths.has(resolved) ? [link.fileId] : [];
        });
        intersect(new Set(matches));
        break;
      }
      case 'type':
        intersect(new Set(files.filter((file) => matchesType(file.path, term.value)).map((file) => file.id)));
        break;
      case 'tag': {
        const metadata = await backend.metadata?.() ?? [];
        const expected = term.value.toLocaleLowerCase();
        intersect(new Set(metadata.filter((entry) => entry.tags.some((tag) => tag.toLocaleLowerCase() === expected)).map((entry) => entry.fileId)));
        break;
      }
      case 'property': {
        const metadata = await backend.metadata?.() ?? [];
        const expected = term.value.toLocaleLowerCase();
        intersect(new Set(metadata.filter((entry) => (entry.properties[term.key] ?? []).some((value) => value.toLocaleLowerCase().includes(expected))).map((entry) => entry.fileId)));
        break;
      }
    }
  }

  const textQuery = textTerms.join(' ').trim();
  if (textQuery !== '') {
    const results = backend.index.search(textQuery, Math.max(limit, 100));
    const scoped = candidates === undefined ? results : results.filter((result) => candidates?.has(result.fileId) === true);
    return scoped.slice(0, limit);
  }

  if (candidates === undefined) return [];
  const titleByFileId = new Map(backend.index.documentTitles().map((title) => [title.fileId, title.title] as const));
  const byId = new Map(files.map((file) => [file.id, file] as const));
  const results: WorkspaceSearchResult[] = [];
  for (const id of candidates) {
    const file = byId.get(id);
    if (file === undefined) continue;
    results.push({
      fileId: file.id,
      path: file.path,
      title: titleByFileId.get(id) ?? String(file.path),
      snippet: '',
      score: 0,
    });
  }
  return results.sort((a, b) => String(a.path).localeCompare(String(b.path))).slice(0, limit);
}
