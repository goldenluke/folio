import { isMarkdownPath, type WorkspaceFileId, type WorkspacePath, type WorkspaceStorage } from '@abnt/workspace-core';
import type { WorkspaceIndex, WorkspaceSearchResult } from '@abnt/workspace-index';

import { documentTarget } from './language-service.js';

/**
 * F4: `cites:`/`has:`/`linksto:`/`type:`/`tag:`/propriedades. F71 acrescenta
 * `OR`, `NOT` e `(...)` por cima do mesmo vocabulário de termos — o léxico de
 * predicado não muda, só como eles se combinam.
 */
export type QueryTerm =
  | { readonly kind: 'text'; readonly value: string }
  | { readonly kind: 'cites'; readonly referenceId: string }
  | { readonly kind: 'has'; readonly feature: 'figure' | 'table' | 'citation' }
  | { readonly kind: 'linksto'; readonly target: string }
  | { readonly kind: 'type'; readonly value: string }
  | { readonly kind: 'tag'; readonly value: string }
  | { readonly kind: 'property'; readonly key: 'author' | 'year' | 'profile' | 'lang'; readonly value: string };

/**
 * F71 — Boolean Query AST. `NOT` liga mais forte que `AND` implícito, que liga
 * mais forte que `OR` — mesma precedência convencional de query languages
 * boolean (Lucene e afins), para `(author:"Silva" OR author:"Souza")
 * year:2024` significar o que um pesquisador espera. `AND`/`OR`/`NOT` só são
 * operadores em MAIÚSCULAS; minúsculo cai como texto livre (evita que "e"/"ou"
 * em português vire operador por acidente — a sintaxe de operador é em inglês
 * de propósito, como o resto da sintaxe estruturada).
 */
export type QueryNode =
  | { readonly kind: 'term'; readonly term: QueryTerm }
  | { readonly kind: 'not'; readonly node: QueryNode }
  | { readonly kind: 'and'; readonly nodes: readonly QueryNode[] }
  | { readonly kind: 'or'; readonly nodes: readonly QueryNode[] };

/** `root` ausente = consulta vazia (nenhum predicado, nenhum texto). */
export interface QueryAst {
  readonly root: QueryNode | undefined;
}

const STRUCTURED_PREFIX = /^(cites|has|linksto|type|tag|author|year|profile|lang):(.+)$/u;

/**
 * Prefixo desconhecido (`foo:bar`) cai em termo de texto livre — mesma
 * filosofia defensiva de `WorkspaceIndex.search()`, que já engole sintaxe
 * FTS inválida sem erro em vez de rejeitar a consulta do usuário.
 */
const termFromToken = (token: string): QueryTerm => {
  const structured = STRUCTURED_PREFIX.exec(token);
  const prefix = structured?.[1];
  const rawValue = structured?.[2];
  if (prefix !== undefined && rawValue !== undefined) {
    if (prefix === 'cites') return { kind: 'cites', referenceId: rawValue.startsWith('@') ? rawValue.slice(1) : rawValue };
    if (prefix === 'has' && (rawValue === 'figure' || rawValue === 'table' || rawValue === 'citation')) return { kind: 'has', feature: rawValue };
    if (prefix === 'linksto') return { kind: 'linksto', target: rawValue };
    if (prefix === 'type') return { kind: 'type', value: rawValue };
    if (prefix === 'tag') return { kind: 'tag', value: rawValue.replace(/^#/u, '') };
    if (prefix === 'author' || prefix === 'year' || prefix === 'profile' || prefix === 'lang') return { kind: 'property', key: prefix, value: rawValue };
  }
  return { kind: 'text', value: token };
};

type Token =
  | { readonly kind: 'lparen' }
  | { readonly kind: 'rparen' }
  | { readonly kind: 'or' }
  | { readonly kind: 'and' }
  | { readonly kind: 'not' }
  | { readonly kind: 'term'; readonly raw: string };

const QUOTED_PREFIX = /^[a-z]+:"/iu;

/**
 * Lexer escrito à mão, não regex único: `(author:"Silva" OR ...)` precisa
 * separar `(` de um termo colado nele, e uma string entre aspas pode conter
 * qualquer coisa (inclusive `(`/`)`) sem quebrar o parênteses ao redor.
 */
const tokenize = (input: string): readonly Token[] => {
  const tokens: Token[] = [];
  const length = input.length;
  let index = 0;
  while (index < length) {
    const char = input[index] as string;
    if (/\s/u.test(char)) { index += 1; continue; }
    if (char === '(') { tokens.push({ kind: 'lparen' }); index += 1; continue; }
    if (char === ')') { tokens.push({ kind: 'rparen' }); index += 1; continue; }
    const remainder = input.slice(index);
    const prefixMatch = QUOTED_PREFIX.exec(remainder);
    if (prefixMatch !== null) {
      const prefix = prefixMatch[0].slice(0, -1); // sem a aspa: "author:"
      const quoteStart = index + prefixMatch[0].length - 1;
      const quoteEnd = input.indexOf('"', quoteStart + 1);
      const end = quoteEnd === -1 ? length : quoteEnd + 1;
      const inner = input.slice(quoteStart + 1, quoteEnd === -1 ? length : quoteEnd);
      tokens.push({ kind: 'term', raw: `${prefix}${inner}` });
      index = end;
      continue;
    }
    if (char === '"') {
      const quoteEnd = input.indexOf('"', index + 1);
      const end = quoteEnd === -1 ? length : quoteEnd + 1;
      const inner = input.slice(index + 1, quoteEnd === -1 ? length : quoteEnd);
      tokens.push({ kind: 'term', raw: inner });
      index = end;
      continue;
    }
    let cursor = index;
    while (cursor < length && !/[\s()]/u.test(input[cursor] as string)) cursor += 1;
    const word = input.slice(index, cursor);
    index = cursor;
    if (word === '') { index += 1; continue; }
    if (word === 'OR') tokens.push({ kind: 'or' });
    else if (word === 'AND') tokens.push({ kind: 'and' });
    else if (word === 'NOT') tokens.push({ kind: 'not' });
    else tokens.push({ kind: 'term', raw: word });
  }
  return tokens;
};

/**
 * Recursive descent: `orExpr := andExpr (OR andExpr)*`,
 * `andExpr := notExpr (AND? notExpr)*`, `notExpr := NOT notExpr | atom`,
 * `atom := '(' orExpr ')' | TERM`. Token solto sem operando (`OR` no início,
 * `)` sem `(`) é descartado, nunca lançado — consulta de usuário não é
 * programa; a defesa é a mesma filosofia de "prefixo desconhecido vira texto".
 */
class QueryParser {
  readonly #tokens: readonly Token[];
  #position = 0;

  constructor(tokens: readonly Token[]) {
    this.#tokens = tokens;
  }

  parse(): QueryNode | undefined {
    return this.#or();
  }

  #peek(): Token | undefined {
    return this.#tokens[this.#position];
  }

  #or(): QueryNode | undefined {
    const first = this.#and();
    if (first === undefined) return this.#skipStrayThenRetry(() => this.#or());
    const nodes = [first];
    while (this.#peek()?.kind === 'or') {
      this.#position += 1;
      const next = this.#and();
      if (next !== undefined) nodes.push(next);
    }
    return nodes.length === 1 ? nodes[0] : { kind: 'or', nodes };
  }

  #and(): QueryNode | undefined {
    const first = this.#not();
    if (first === undefined) return undefined;
    const nodes = [first];
    for (;;) {
      const peeked = this.#peek();
      if (peeked === undefined || peeked.kind === 'or' || peeked.kind === 'rparen') break;
      if (peeked.kind === 'and') this.#position += 1;
      const next = this.#not();
      if (next === undefined) break;
      nodes.push(next);
    }
    return nodes.length === 1 ? nodes[0] : { kind: 'and', nodes };
  }

  #not(): QueryNode | undefined {
    if (this.#peek()?.kind === 'not') {
      this.#position += 1;
      const inner = this.#not();
      return inner === undefined ? undefined : { kind: 'not', node: inner };
    }
    return this.#atom();
  }

  #atom(): QueryNode | undefined {
    const token = this.#peek();
    if (token === undefined) return undefined;
    if (token.kind === 'lparen') {
      this.#position += 1;
      const inner = this.#or();
      if (this.#peek()?.kind === 'rparen') this.#position += 1;
      return inner;
    }
    if (token.kind === 'term') {
      this.#position += 1;
      return { kind: 'term', term: termFromToken(token.raw) };
    }
    return undefined;
  }

  /** `OR`/`AND`/`)` sem operando à esquerda: descarta o token e tenta de novo. */
  #skipStrayThenRetry(retry: () => QueryNode | undefined): QueryNode | undefined {
    if (this.#peek() === undefined) return undefined;
    this.#position += 1;
    return retry();
  }
}

export function parseStructuredQuery(input: string): QueryAst {
  return { root: new QueryParser(tokenize(input)).parse() };
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

/** Extrai `QueryTerm[]` se `node` é um termo isolado ou um AND raso de termos — a forma que F4 (v1) sempre produzia. */
const flatConjunction = (node: QueryNode): readonly QueryTerm[] | undefined => {
  if (node.kind === 'term') return [node.term];
  if (node.kind === 'and' && node.nodes.every((child): child is Extract<QueryNode, { kind: 'term' }> => child.kind === 'term')) {
    return node.nodes.map((child) => child.term);
  }
  return undefined;
};

/**
 * Caminho rápido idêntico ao planner de F4: reduz cada termo estruturado a um
 * conjunto candidato (AND implícito), texto livre vai para o FTS5 com ranking
 * e snippet reais. Preservado tal e qual para não perder fidelidade de
 * ranking/snippet nas consultas mais comuns (sem `OR`/`NOT`), que são a
 * maioria. `linksto:` reaproveita `documentTarget`, a MESMA resolução de link
 * relativo que `definition`/`references`/`backlinks` já usam.
 */
async function executeConjunction(
  terms: readonly QueryTerm[],
  backend: StructuredQueryBackend,
  limit: number,
): Promise<readonly WorkspaceSearchResult[]> {
  const files = await backend.storage.list();
  let candidates: Set<WorkspaceFileId> | undefined;
  const textTerms: string[] = [];

  const intersect = (matches: ReadonlySet<WorkspaceFileId>): void => {
    candidates = candidates === undefined ? new Set(matches) : new Set([...candidates].filter((id) => matches.has(id)));
  };

  for (const term of terms) {
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
  return projectFileIds(candidates, files, backend, limit);
}

const projectFileIds = (
  ids: ReadonlySet<WorkspaceFileId>,
  files: Awaited<ReturnType<WorkspaceStorage['list']>>,
  backend: StructuredQueryBackend,
  limit: number,
): readonly WorkspaceSearchResult[] => {
  const titleByFileId = new Map(backend.index.documentTitles().map((title) => [title.fileId, title.title] as const));
  const byId = new Map(files.map((file) => [file.id, file] as const));
  const results: WorkspaceSearchResult[] = [];
  for (const id of ids) {
    const file = byId.get(id);
    if (file === undefined) continue;
    results.push({ fileId: file.id, path: file.path, title: titleByFileId.get(id) ?? String(file.path), snippet: '', score: 0 });
  }
  return results.sort((a, b) => String(a.path).localeCompare(String(b.path))).slice(0, limit);
};

/** Primeiro fragmento efetivamente marcado pelo FTS5, sem as elipses de apresentação. */
const markedSnippetText = (snippet: string): string | undefined => {
  const match = /<mark>([\s\S]*?)<\/mark>/u.exec(snippet);
  const value = match?.[1]?.trim();
  return value === undefined || value === '' ? undefined : value;
};

/**
 * F73 — o FTS5 decide quais documentos correspondem; o outline persistido
 * decide a qual seção o hit pertence. O host só localiza o fragmento já
 * destacado pelo índice na autoria para escolher o intervalo de headings;
 * renderer nenhum abre arquivo ou reinterpreta Markdown.
 */
async function enrichWithSections(
  results: readonly WorkspaceSearchResult[],
  backend: StructuredQueryBackend,
): Promise<readonly WorkspaceSearchResult[]> {
  return Promise.all(results.map(async (result) => {
    const needle = markedSnippetText(result.snippet);
    if (needle === undefined) return result;
    try {
      const content = await backend.storage.read(result.fileId);
      const offset = content.content.toLocaleLowerCase().indexOf(needle.toLocaleLowerCase());
      if (offset < 0) return result;
      const heading = backend.index
        .headings(result.fileId)
        .filter((entry) => entry.sourceStart !== undefined && entry.sourceEnd !== undefined && entry.sourceStart <= offset)
        .at(-1);
      if (heading?.sourceStart === undefined || heading.sourceEnd === undefined) return result;
      return {
        ...result,
        section: { title: heading.title, range: { start: heading.sourceStart, end: heading.sourceEnd } },
      };
    } catch {
      // Resultado de busca segue útil mesmo se uma alteração externa removeu
      // o arquivo entre a projeção FTS e esta decoração opcional.
      return result;
    }
  }));
}

/**
 * Avalia um termo isolado para um `Set` de candidatos — usado só pelo caminho
 * geral (com `OR`/`NOT`), onde texto livre perde o ranking bm25 e vira
 * apenas "está no top da busca FTS ou não". É uma perda de fidelidade
 * deliberada: compor ranking com booleano arbitrário não tem uma resposta
 * única, e a alternativa (não suportar texto livre dentro de `OR`/`NOT`)
 * seria pior para quem escreve `has:figure OR metodologia`.
 */
async function evaluateTerm(term: QueryTerm, backend: StructuredQueryBackend, files: Awaited<ReturnType<WorkspaceStorage['list']>>): Promise<Set<WorkspaceFileId>> {
  switch (term.kind) {
    case 'text':
      return new Set(backend.index.search(term.value, 500).map((result) => result.fileId));
    case 'cites':
      return new Set(backend.index.citations(undefined, term.referenceId).map((citation) => citation.fileId));
    case 'has':
      return new Set(
        term.feature === 'citation'
          ? backend.index.citations().map((citation) => citation.fileId)
          : backend.index.blocks(undefined, term.feature).map((block) => block.fileId),
      );
    case 'linksto': {
      const needle = term.target.toLocaleLowerCase();
      const targetPaths = new Set<string>();
      for (const file of files) {
        if (String(file.path).toLocaleLowerCase().includes(needle)) targetPaths.add(String(file.path));
      }
      for (const title of backend.index.documentTitles()) {
        if (title.title.toLocaleLowerCase().includes(needle)) targetPaths.add(String(title.path));
      }
      return new Set(
        backend.index.links().flatMap((link) => {
          const resolved = documentTarget(link.path, link.target);
          return resolved !== undefined && targetPaths.has(resolved) ? [link.fileId] : [];
        }),
      );
    }
    case 'type':
      return new Set(files.filter((file) => matchesType(file.path, term.value)).map((file) => file.id));
    case 'tag': {
      const metadata = await backend.metadata?.() ?? [];
      const expected = term.value.toLocaleLowerCase();
      return new Set(metadata.filter((entry) => entry.tags.some((tag) => tag.toLocaleLowerCase() === expected)).map((entry) => entry.fileId));
    }
    case 'property': {
      const metadata = await backend.metadata?.() ?? [];
      const expected = term.value.toLocaleLowerCase();
      return new Set(metadata.filter((entry) => (entry.properties[term.key] ?? []).some((value) => value.toLocaleLowerCase().includes(expected))).map((entry) => entry.fileId));
    }
  }
}

async function evaluateNode(
  node: QueryNode,
  universe: ReadonlySet<WorkspaceFileId>,
  backend: StructuredQueryBackend,
  files: Awaited<ReturnType<WorkspaceStorage['list']>>,
): Promise<Set<WorkspaceFileId>> {
  switch (node.kind) {
    case 'term':
      return evaluateTerm(node.term, backend, files);
    case 'not': {
      const inner = await evaluateNode(node.node, universe, backend, files);
      return new Set([...universe].filter((id) => !inner.has(id)));
    }
    case 'and': {
      let result: Set<WorkspaceFileId> | undefined;
      for (const child of node.nodes) {
        const evaluated = await evaluateNode(child, universe, backend, files);
        result = result === undefined ? evaluated : new Set([...result].filter((id) => evaluated.has(id)));
        if (result.size === 0) break;
      }
      return result ?? new Set();
    }
    case 'or': {
      const sets = await Promise.all(node.nodes.map((child) => evaluateNode(child, universe, backend, files)));
      const result = new Set<WorkspaceFileId>();
      for (const set of sets) for (const id of set) result.add(id);
      return result;
    }
  }
}

/**
 * F71: se a árvore não usa `OR`/`NOT`, delega ao caminho de F4 (ranking/
 * snippet reais, zero mudança de comportamento). Só desce para avaliação
 * booleana genérica por `Set` quando a consulta realmente pede composição —
 * o preço de precisão de texto livre (ver `evaluateTerm`) só é pago quando
 * o usuário pede algo que a v1 nunca soube fazer.
 */
export async function executeStructuredQuery(
  ast: QueryAst,
  backend: StructuredQueryBackend,
  limit = 20,
): Promise<readonly WorkspaceSearchResult[]> {
  if (ast.root === undefined) return [];

  const flat = flatConjunction(ast.root);
  if (flat !== undefined) return enrichWithSections(await executeConjunction(flat, backend, limit), backend);

  const files = await backend.storage.list();
  const universe = new Set(files.map((file) => file.id));
  const matches = await evaluateNode(ast.root, universe, backend, files);
  return enrichWithSections(projectFileIds(matches, files, backend, limit), backend);
}
