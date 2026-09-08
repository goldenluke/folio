import {
  parseMarkdownComDiagnosticos,
} from '@abnt/markdown';
import {
  percorrer,
  type CitationNode,
  type CrossReferenceNode,
  type DocumentAst,
  type LinkNode,
  type SectionNode,
  type SourceRange,
} from '@abnt/document-model';
import { WorkspaceFileNotFoundError, type WorkspaceFile, type WorkspaceFileId, type WorkspacePath, type WorkspaceStorage } from '@abnt/workspace-core';
import type { IndexedCitation, IndexedLink, WorkspaceIndex } from '@abnt/workspace-index';
import type { DocumentSessions } from '@abnt/workspace-sessions';

import type {
  LanguageBacklink,
  LanguageCompletionItem,
  LanguageCompletionResult,
  LanguageDiagnostic,
  LanguageHover,
  LanguageLocation,
  LanguageOutlineItem,
  LanguagePosition,
  LanguageRange,
  LanguageReference,
  LanguageReferenceCatalog,
  LanguageReferenceCatalogResolver,
  LanguageService,
  LanguageServiceOptions,
  LanguageCrossReferenceTarget,
  LanguageUnlinkedMention,
  LanguageWritingStatistics,
  LanguageWorkspaceEdit,
} from './model.js';

interface ParsedWorkspaceDocument {
  readonly file: WorkspaceFile;
  readonly content: string;
  readonly ast: DocumentAst;
  readonly parserDiagnostics: readonly LanguageDiagnostic[];
  readonly isOpen: boolean;
}

const sourceRange = (source: SourceRange | undefined): LanguageRange | undefined =>
  source === undefined ? undefined : { start: source.start.offset, end: source.end.offset };

const contains = (source: SourceRange | undefined, offset: number): boolean =>
  source !== undefined && source.start.offset <= offset && offset <= source.end.offset;

const textOf = (nodes: readonly import('@abnt/document-model').InlineNode[]): string =>
  nodes
    .map((node) => {
      switch (node.type) {
        case 'text':
        case 'code-inline':
        case 'math-inline':
          return node.value;
        case 'soft-break':
        case 'hard-break':
        case 'citation':
        case 'cross-reference':
        case 'note-reference':
          return '';
        case 'emphasis':
        case 'strong':
        case 'strike':
        case 'link':
        case 'inline-container':
          return textOf(node.children);
      }
    })
    .join('')
    .replace(/\s+/gu, ' ')
    .trim();

const normalizedSegments = (path: string): string[] | undefined => {
  const result: string[] = [];
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      if (result.length === 0) return undefined;
      result.pop();
      continue;
    }
    result.push(part);
  }
  return result;
};

/**
 * Resolve uma URI relativa autoral (link, dependência de bibliografia) contra
 * o caminho do documento que a declarou. Exportado para reuso — o resolvedor
 * de ambiente do desktop (P12) resolve `.bib` exatamente da mesma forma que
 * `definition`/`references` já resolvem um link `[texto](destino.md)`, e as
 * duas coisas não podem divergir silenciosamente.
 */
export const documentTarget = (sourcePath: WorkspacePath, target: string): string | undefined => {
  const bare = target.split(/[?#]/u, 1)[0] ?? '';
  if (bare === '' || /^[a-z][a-z0-9+.-]*:/iu.test(bare) || bare.startsWith('//')) return undefined;
  const base = sourcePath.split('/').slice(0, -1);
  const combined = bare.startsWith('/') ? bare.slice(1) : [...base, bare].join('/');
  return normalizedSegments(combined)?.join('/');
};

const relativePath = (from: WorkspacePath, to: WorkspacePath): string => {
  const fromParts = from.split('/').slice(0, -1).filter(Boolean);
  const toParts = to.split('/').filter(Boolean);
  let shared = 0;
  while (fromParts[shared] !== undefined && fromParts[shared] === toParts[shared]) shared += 1;
  const up = fromParts.slice(shared).map(() => '..');
  const down = toParts.slice(shared);
  const value = [...up, ...down].join('/');
  return value === '' ? './' : value;
};

const citationAt = (ast: DocumentAst, offset: number): CitationNode | undefined => {
  const matches = [...percorrer(ast)].filter(
    (node): node is CitationNode => node.type === 'citation' && contains(node.source, offset),
  );
  return matches.sort((left, right) => {
    const leftWidth = (left.source?.end.offset ?? Infinity) - (left.source?.start.offset ?? 0);
    const rightWidth = (right.source?.end.offset ?? Infinity) - (right.source?.start.offset ?? 0);
    return leftWidth - rightWidth;
  })[0];
};

const linkAt = (ast: DocumentAst, offset: number): LinkNode | undefined => {
  const matches = [...percorrer(ast)].filter(
    (node): node is LinkNode => node.type === 'link' && contains(node.source, offset),
  );
  return matches.sort((left, right) => {
    const leftWidth = (left.source?.end.offset ?? Infinity) - (left.source?.start.offset ?? 0);
    const rightWidth = (right.source?.end.offset ?? Infinity) - (right.source?.start.offset ?? 0);
    return leftWidth - rightWidth;
  })[0];
};

/** F68: mesmo padrão de `citationAt`/`linkAt`, para `[[ref:id]]`. */
const crossReferenceAt = (ast: DocumentAst, offset: number): CrossReferenceNode | undefined => {
  const matches = [...percorrer(ast)].filter(
    (node): node is CrossReferenceNode => node.type === 'cross-reference' && contains(node.source, offset),
  );
  return matches.sort((left, right) => {
    const leftWidth = (left.source?.end.offset ?? Infinity) - (left.source?.start.offset ?? 0);
    const rightWidth = (right.source?.end.offset ?? Infinity) - (right.source?.start.offset ?? 0);
    return leftWidth - rightWidth;
  })[0];
};

/**
 * F68 — resolve `[[ref:id]]` de dentro para fora: primeiro a declaração no
 * próprio documento (cobre o rascunho aberto ainda não indexado), depois o
 * índice vault-wide. É esse segundo passo que faz uma referência atravessar
 * um embed (F60): a declaração pode viver num módulo que só se encontra com
 * quem a referencia através da composição do compiler, nunca no
 * language-service — aqui os dois arquivos são só dois documentos comuns.
 */
const identifierDeclarationIn = (ast: DocumentAst, identifier: string): { readonly source: SourceRange } | undefined =>
  [...percorrer(ast)].find((node) => node.attributes?.identifier === identifier && node.source !== undefined) as
    | { readonly source: SourceRange }
    | undefined;

const locationsFromIndexedCitations = (
  citations: readonly IndexedCitation[],
  referenceId: string,
): readonly LanguageLocation[] =>
  citations
    .filter((citation) => citation.referenceId === referenceId)
    .flatMap((citation) =>
      citation.sourceStart === undefined || citation.sourceEnd === undefined
        ? []
        : [
            {
              fileId: citation.fileId,
              path: citation.path,
              range: { start: citation.sourceStart, end: citation.sourceEnd },
            },
          ],
    );

const locationsFromIndexedLinks = (
  links: readonly IndexedLink[],
  targetPath: string,
): readonly LanguageLocation[] =>
  links.flatMap((link) => {
    if (link.kind !== 'document' || link.sourceStart === undefined || link.sourceEnd === undefined) return [];
    const resolved = documentTarget(link.path, link.target);
    return resolved === targetPath
      ? [{ fileId: link.fileId, path: link.path, range: { start: link.sourceStart, end: link.sourceEnd } }]
      : [];
  });

const backlinksFromIndexedLinks = (links: readonly IndexedLink[], targetPath: string): readonly LanguageBacklink[] =>
  links.flatMap((link) => {
    if (link.kind !== 'document' || link.sourceStart === undefined || link.sourceEnd === undefined) return [];
    if (documentTarget(link.path, link.target) !== targetPath) return [];
    return [{ fileId: link.fileId, path: link.path, label: link.label, range: { start: link.sourceStart, end: link.sourceEnd } }];
  });

const citationsIn = (document: ParsedWorkspaceDocument, referenceId: string): readonly LanguageLocation[] =>
  [...percorrer(document.ast)].flatMap((node) => {
    if (node.type !== 'citation' || !node.items.some((item) => String(item.referenceId) === referenceId)) return [];
    const range = sourceRange(node.source);
    return range === undefined ? [] : [{ fileId: document.file.id, path: document.file.path, range }];
  });

const linksIn = (document: ParsedWorkspaceDocument, targetPath: string): readonly LanguageLocation[] =>
  [...percorrer(document.ast)].flatMap((node) => {
    if (node.type !== 'link' || documentTarget(document.file.path, node.url) !== targetPath) return [];
    const range = sourceRange(node.source);
    return range === undefined ? [] : [{ fileId: document.file.id, path: document.file.path, range }];
  });

const uniqueLocations = (locations: readonly LanguageLocation[]): readonly LanguageLocation[] => {
  const seen = new Set<string>();
  return locations.filter((location) => {
    const key = `${location.fileId}:${location.range.start}:${location.range.end}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const referenceDetail = (reference: LanguageReference): string | undefined => {
  const author = reference.authors?.join(', ');
  const date = reference.issued;
  const metadata = [author, date].filter((value): value is string => value !== undefined).join(', ');
  return [reference.title, metadata].filter((value): value is string => value !== undefined).join(' — ') || undefined;
};

/**
 * Serviço de linguagem puro: lê fonte e projeções, mas não conhece editor,
 * CodeMirror, Electron nem qualquer norma. O editor é apenas mais um cliente.
 */
export class WorkspaceLanguageService implements LanguageService {
  readonly #storage: WorkspaceStorage;
  readonly #index: WorkspaceIndex;
  readonly #sessions: DocumentSessions;
  readonly #references: LanguageReferenceCatalog | undefined;
  readonly #referencesFor: LanguageReferenceCatalogResolver | undefined;

  constructor(options: LanguageServiceOptions) {
    this.#storage = options.storage;
    this.#index = options.index;
    this.#sessions = options.sessions;
    this.#references = options.references;
    this.#referencesFor = options.referencesFor;
  }

  static create(options: LanguageServiceOptions): WorkspaceLanguageService {
    return new WorkspaceLanguageService(options);
  }

  async outline(fileId: WorkspaceFileId): Promise<readonly LanguageOutlineItem[]> {
    const document = await this.#document(fileId);
    return [...percorrer(document.ast)].flatMap((node) => {
      if (node.type !== 'section') return [];
      const range = sourceRange(node.source);
      if (range === undefined) return [];
      return [this.#outlineItem(node, range)];
    });
  }

  async diagnostics(fileId: WorkspaceFileId): Promise<readonly LanguageDiagnostic[]> {
    const document = await this.#document(fileId);
    const sessionDiagnostics = this.#sessions.snapshot(fileId)?.diagnostics ?? [];
    const all = [
      ...document.parserDiagnostics,
      ...sessionDiagnostics.map((diagnostic) => ({
        id: diagnostic.id,
        severity: diagnostic.severity,
        message: diagnostic.message,
        ...(diagnostic.source !== undefined
          ? {
              source: {
                documentId: diagnostic.source.documentId as SourceRange['documentId'],
                start: diagnostic.source.start,
                end: diagnostic.source.end,
              },
            }
          : {}),
      })),
    ];
    const seen = new Set<string>();
    return all.filter((diagnostic) => {
      const key = `${diagnostic.id}:${diagnostic.source?.start.offset ?? -1}:${diagnostic.source?.end.offset ?? -1}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async completions(position: LanguagePosition, limit = 20): Promise<LanguageCompletionResult | undefined> {
    const document = await this.#document(position.fileId);
    if (position.offset < 0 || position.offset > document.content.length) return undefined;
    const before = document.content.slice(0, position.offset);
    const citation = /@([A-Za-z0-9_:.+-]*)$/u.exec(before);
    if (citation !== null) {
      const start = position.offset - citation[0].length;
      const previous = start === 0 ? '' : document.content[start - 1] ?? '';
      if (previous === '' || /[\s[(;,]/u.test(previous)) {
        const query = citation[1] ?? '';
        return {
          range: { start: start + 1, end: position.offset },
          items: await this.#citationCompletions(document, query, limit),
        };
      }
    }

    const math = /\\([A-Za-z]*)$/u.exec(before);
    if (math !== null && before.lastIndexOf('$') > before.lastIndexOf('\n')) {
      const commands = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'theta', 'lambda', 'mu', 'pi', 'sigma', 'omega', 'frac', 'sqrt', 'sum', 'int', 'times', 'cdot', 'leq', 'geq'];
      const query = math[1] ?? '';
      return { range: { start: position.offset - query.length, end: position.offset }, items: commands.filter((command) => command.startsWith(query)).slice(0, limit).map((command) => ({ kind: 'math' as const, label: `\\${command}`, detail: 'TeX', insertText: command })) };
    }

    const marker = before.lastIndexOf('](');
    if (marker >= 0) {
      const start = marker + 2;
      const candidate = before.slice(start);
      if (!candidate.includes(')') && !candidate.includes('\n')) {
        const items = await this.#documentCompletions(document.file, candidate, limit);
        return { range: { start, end: position.offset }, items };
      }
    }
    return undefined;
  }

  async hover(position: LanguagePosition): Promise<LanguageHover | undefined> {
    const document = await this.#document(position.fileId);
    const citation = citationAt(document.ast, position.offset);
    if (citation !== undefined) {
      const range = sourceRange(citation.source);
      if (range === undefined) return undefined;
      const catalog = await this.#catalog(document.file.id);
      const contents = await Promise.all(
        citation.items.map(async (item) => {
          const id = String(item.referenceId);
          const reference = await catalog?.find(id);
          const locator = item.locator === undefined ? '' : `, ${item.locator.type} ${item.locator.value}`;
          return reference === undefined ? `@${id}${locator}` : `@${id}${locator} — ${referenceDetail(reference) ?? id}`;
        }),
      );
      return { range, contents };
    }

    const link = linkAt(document.ast, position.offset);
    if (link !== undefined) {
      const range = sourceRange(link.source);
      if (range === undefined) return undefined;
      const target = documentTarget(document.file.path, link.url);
      if (target === undefined) return { range, contents: [link.url] };
      const file = (await this.#storage.list()).find((entry) => String(entry.path) === target);
      return { range, contents: [file === undefined ? `${target} — não encontrado` : file.path] };
    }

    const xref = crossReferenceAt(document.ast, position.offset);
    if (xref === undefined || xref.target.kind !== 'identifier') return undefined;
    const range = sourceRange(xref.source);
    if (range === undefined) return undefined;
    const local = identifierDeclarationIn(document.ast, xref.target.identifier);
    if (local !== undefined) return { range, contents: [xref.target.identifier] };
    const remote = this.#index.identifiers(xref.target.identifier)[0];
    return { range, contents: [remote === undefined ? `${xref.target.identifier} — não encontrado` : `${remote.label} — ${remote.path}`] };
  }

  async definition(position: LanguagePosition): Promise<readonly LanguageLocation[]> {
    const document = await this.#document(position.fileId);
    const citation = citationAt(document.ast, position.offset);
    if (citation !== undefined) {
      const catalog = await this.#catalog(document.file.id);
      const locations = await Promise.all(
        citation.items.map(async (item) => (await catalog?.find(String(item.referenceId)))?.definition),
      );
      return locations.filter((location): location is LanguageLocation => location !== undefined);
    }

    const link = linkAt(document.ast, position.offset);
    if (link !== undefined) {
      const target = documentTarget(document.file.path, link.url);
      if (target === undefined) return [];
      const file = (await this.#storage.list()).find((entry) => String(entry.path) === target);
      return file === undefined ? [] : [{ fileId: file.id, path: file.path, range: { start: 0, end: 0 } }];
    }

    const xref = crossReferenceAt(document.ast, position.offset);
    if (xref === undefined || xref.target.kind !== 'identifier') return [];
    const id = xref.target.identifier;
    const local = identifierDeclarationIn(document.ast, id);
    if (local !== undefined) {
      const range = sourceRange(local.source);
      return range === undefined ? [] : [{ fileId: document.file.id, path: document.file.path, range }];
    }
    // F68: a declaração não está neste arquivo — só o índice vault-wide sabe
    // em qual módulo ela vive, mesmo que os dois só se encontrem via embed.
    return this.#index
      .identifiers(id)
      .flatMap((entry) =>
        entry.sourceStart === undefined || entry.sourceEnd === undefined
          ? []
          : [{ fileId: entry.fileId, path: entry.path, range: { start: entry.sourceStart, end: entry.sourceEnd } }],
      );
  }

  async references(position: LanguagePosition): Promise<readonly LanguageLocation[]> {
    const document = await this.#document(position.fileId);
    const citation = citationAt(document.ast, position.offset);
    if (citation !== undefined) {
      const current = citation.items.flatMap((item) => citationsIn(document, String(item.referenceId)));
      const ids = new Set(citation.items.map((item) => String(item.referenceId)));
      const indexed = this.#index
        .citations()
        .filter((entry) => !document.isOpen || entry.fileId !== document.file.id)
        .flatMap((entry) => (ids.has(entry.referenceId) ? locationsFromIndexedCitations([entry], entry.referenceId) : []));
      return uniqueLocations([...current, ...indexed]);
    }

    const link = linkAt(document.ast, position.offset);
    if (link !== undefined) {
      const target = documentTarget(document.file.path, link.url);
      if (target === undefined) return [];
      const current = linksIn(document, target);
      const indexed = locationsFromIndexedLinks(
        this.#index.links().filter((entry) => !document.isOpen || entry.fileId !== document.file.id),
        target,
      );
      return uniqueLocations([...current, ...indexed]);
    }

    const xref = crossReferenceAt(document.ast, position.offset);
    if (xref === undefined || xref.target.kind !== 'identifier') return [];
    const id = xref.target.identifier;
    const current = [...percorrer(document.ast)].flatMap((node) => {
      if (node.type !== 'cross-reference' || node.target.kind !== 'identifier' || node.target.identifier !== id) return [];
      const range = sourceRange(node.source);
      return range === undefined ? [] : [{ fileId: document.file.id, path: document.file.path, range }];
    });
    const indexed = this.#index
      .crossReferences(undefined, id)
      .filter((entry) => !document.isOpen || entry.fileId !== document.file.id)
      .flatMap((entry) =>
        entry.sourceStart === undefined || entry.sourceEnd === undefined
          ? []
          : [{ fileId: entry.fileId, path: entry.path, range: { start: entry.sourceStart, end: entry.sourceEnd } }],
      );
    return uniqueLocations([...current, ...indexed]);
  }

  async backlinks(fileId: WorkspaceFileId): Promise<readonly LanguageBacklink[]> {
    const target = (await this.#storage.list()).find((file) => file.id === fileId);
    if (target === undefined) throw new WorkspaceFileNotFoundError(fileId);
    return backlinksFromIndexedLinks(this.#index.links(), String(target.path));
  }

  async crossReferenceTargets(fileId: WorkspaceFileId): Promise<readonly LanguageCrossReferenceTarget[]> {
    const document = await this.#document(fileId);
    return [...percorrer(document.ast)].flatMap<LanguageCrossReferenceTarget>((node) => {
      const identifier = node.attributes?.identifier; const range = sourceRange(node.source);
      if (identifier === undefined || range === undefined) return [];
      switch (node.type) {
        case 'section': return [{ identifier, kind: 'section' as const, label: textOf(node.title ?? []) || identifier, range }];
        case 'figure': return [{ identifier, kind: 'figure' as const, label: textOf(node.caption?.short ?? []) || identifier, range }];
        case 'table': return [{ identifier, kind: 'table' as const, label: identifier, range }];
        case 'math-block': return [{ identifier, kind: 'equation' as const, label: identifier, range }];
        default: return [];
      }
    });
  }

  /**
   * Menções não linkadas (F32/"Backlinks 2.0"): título de outro documento
   * mencionado em prosa, fora de qualquer `link`/`citation` existente. Exclui
   * pelo `source` range desses nós — não precisa rastrear "pai" durante o
   * percurso, já que `link`/`citation` guardam o span inteiro do Markdown
   * autoral (`[texto](destino)`/`[@id]`), então qualquer ocorrência dentro
   * desse span já está "linkada" por definição. Puramente uma sugestão: nunca
   * edita o documento sozinho.
   */
  async unlinkedMentions(fileId: WorkspaceFileId): Promise<readonly LanguageUnlinkedMention[]> {
    const document = await this.#document(fileId);
    const excluded: Array<{ readonly start: number; readonly end: number }> = [];
    for (const node of percorrer(document.ast)) {
      if ((node.type === 'link' || node.type === 'citation') && node.source !== undefined) {
        excluded.push({ start: node.source.start.offset, end: node.source.end.offset });
      }
    }
    const isExcluded = (start: number, end: number): boolean =>
      excluded.some((range) => start < range.end && end > range.start);

    const MIN_TITLE_LENGTH = 4;
    const titles = this.#index
      .documentTitles()
      .filter((entry) => entry.fileId !== fileId && entry.title.trim().length >= MIN_TITLE_LENGTH);
    const content = document.content;
    const lowerContent = content.toLocaleLowerCase();
    const mentions: LanguageUnlinkedMention[] = [];
    for (const title of titles) {
      const needle = title.title.toLocaleLowerCase();
      let start = lowerContent.indexOf(needle);
      while (start !== -1) {
        const end = start + needle.length;
        if (!isExcluded(start, end)) {
          mentions.push({
            range: { start, end },
            targetFileId: title.fileId,
            targetPath: title.path,
            text: content.slice(start, end),
          });
        }
        start = lowerContent.indexOf(needle, start + 1);
      }
    }
    return mentions;
  }

  async writingStatistics(fileId: WorkspaceFileId): Promise<LanguageWritingStatistics> {
    const document = await this.#document(fileId);
    // Contagem de escrita, e não de toda a serialização Markdown. A política
    // padrão deliberadamente exclui frontmatter, bibliografia, tabelas,
    // fórmulas e metadados de figuras; os totais estruturais seguem abaixo.
    const writingText = (source: string): string => source
      .replace(/^---\s*\n[\s\S]*?\n---\s*\n?/u, '')
      .replace(/^#{1,6}\s+(?:refer[eê]ncias|bibliography)\s*$[\s\S]*$/imu, '')
      .replace(/^\s*(?:figura|fonte):.*$/gimu, '')
      .replace(/^\s*!\[[^\]]*\]\([^\n]*\).*$/gimu, '')
      .replace(/^\s*\|.*\|\s*$/gimu, '')
      .replace(/\$\$[\s\S]*?\$\$/gu, '')
      .replace(/\$[^$\n]+\$/gu, '')
      .replace(/\[[^\]]*\]\([^)]*\)/gu, '')
      .replace(/\[@[^\]]+\]/gu, '');
    const countWords = (source: string): number => (writingText(source).match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;
    const text = writingText(document.content);
    let paragraphs = 0; let citations = 0; let figures = 0; let tables = 0; let equations = 0;
    for (const node of percorrer(document.ast)) {
      if (node.type === 'paragraph') paragraphs += 1;
      if (node.type === 'citation') citations += node.items.length;
      if (node.type === 'figure') figures += 1;
      if (node.type === 'table') tables += 1;
      if (node.type === 'math-block') equations += 1;
    }
    const words = (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;
    const body = document.content.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/u, '');
    const headings = [...body.matchAll(/^#{1,6}\s+(.+)$/gmu)];
    const sections = headings.flatMap((heading, index) => {
      const title = heading[1]?.replace(/\s+\{#[^}]+\}\s*$/u, '').trim() ?? '';
      if (title === '' || /^(refer[eê]ncias|bibliography)$/iu.test(title)) return [];
      const start = (heading.index ?? 0) + heading[0].length;
      const end = headings[index + 1]?.index ?? body.length;
      return [{ title, words: countWords(body.slice(start, end)) }];
    });
    return { words, characters: text.trim().length, paragraphs, citations, figures, tables, equations, estimatedReadingMinutes: Math.max(1, Math.ceil(words / 200)), sections };
  }

  async rename(position: LanguagePosition, newName: string): Promise<LanguageWorkspaceEdit | undefined> {
    const next = newName.trim();
    if (next === '' || /[\r\n{}]/u.test(next)) return undefined;
    const active = await this.#document(position.fileId);
    const token = this.#renameTokenAt(active.content, position.offset);
    if (token === undefined || token.name === next) return undefined;
    if (token.kind !== 'heading' && !/^[\p{L}\p{N}_:-]+$/u.test(next)) return undefined;
    const files = token.kind === 'heading' ? [active.file] : (await this.#storage.list()).filter((file) => /\.md$/iu.test(String(file.path)));
    const changes = [] as LanguageWorkspaceEdit['changes'][number][];
    for (const file of files) {
      const document = await this.#document(file.id);
      const edits = this.#renameEdits(document.content, token.kind, token.name, next);
      if (edits.length === 0) continue;
      changes.push({ fileId: file.id, path: file.path, expectedRevision: document.file.revision, edits });
    }
    return changes.length === 0 ? undefined : { label: `Renomear ${token.name} para ${next}`, changes };
  }

  async moveSection(position: LanguagePosition, direction: 'up' | 'down'): Promise<LanguageWorkspaceEdit | undefined> {
    const document = await this.#document(position.fileId);
    const lines: { readonly start: number; readonly end: number; readonly level?: number }[] = [];
    let start = 0;
    for (const line of document.content.split(/(?<=\n)/u)) { const end = start + line.length; const heading = /^(#{1,6})\s+/u.exec(line); lines.push({ start, end, ...(heading === null ? {} : { level: heading[1]!.length }) }); start = end; }
    const currentIndex = lines.findIndex((line) => line.start <= position.offset && position.offset <= line.end && line.level !== undefined);
    if (currentIndex < 0) return undefined;
    const current = lines[currentIndex]!; const level = current.level!;
    const endOf = (index: number): number => {
      for (let cursor = index + 1; cursor < lines.length; cursor += 1) { const line = lines[cursor]!; if (line.level !== undefined && line.level <= level) return line.start; }
      return document.content.length;
    };
    const currentEnd = endOf(currentIndex);
    let otherStart: number | undefined; let otherEnd: number | undefined;
    if (direction === 'up') {
      for (let cursor = currentIndex - 1; cursor >= 0; cursor -= 1) { const line = lines[cursor]!; if (line.level !== undefined && line.level < level) break; if (line.level === level) { otherStart = line.start; otherEnd = current.start; break; } }
      if (otherStart === undefined || otherEnd === undefined) return undefined;
      const previous = document.content.slice(otherStart, otherEnd); const currentText = document.content.slice(current.start, currentEnd);
      return { label: 'Mover seção acima', changes: [{ fileId: document.file.id, path: document.file.path, expectedRevision: document.file.revision, edits: [{ range: { start: otherStart, end: currentEnd }, text: `${currentText}${previous}` }] }] };
    }
    if (currentEnd >= document.content.length || lines.find((line) => line.start === currentEnd)?.level !== level) return undefined;
    otherStart = currentEnd; otherEnd = endOf(lines.findIndex((line) => line.start === currentEnd));
    const currentText = document.content.slice(current.start, currentEnd); const next = document.content.slice(otherStart, otherEnd);
    return { label: 'Mover seção abaixo', changes: [{ fileId: document.file.id, path: document.file.path, expectedRevision: document.file.revision, edits: [{ range: { start: current.start, end: otherEnd }, text: `${next}${currentText}` }] }] };
  }

  #renameTokenAt(content: string, offset: number): { readonly kind: 'citation' | 'identifier' | 'heading'; readonly name: string } | undefined {
    const candidates: { kind: 'citation' | 'identifier' | 'heading'; name: string; start: number; end: number }[] = [];
    for (const match of content.matchAll(/@([\p{L}\p{N}_:-]+)/gu)) candidates.push({ kind: 'citation', name: match[1]!, start: match.index! + 1, end: match.index! + 1 + match[1]!.length });
    for (const match of content.matchAll(/(?:\{#|\[\[ref:)([\p{L}\p{N}_:-]+)(?:\}\]|\})/gu)) candidates.push({ kind: 'identifier', name: match[1]!, start: match.index! + match[0]!.indexOf(match[1]!), end: match.index! + match[0]!.indexOf(match[1]!) + match[1]!.length });
    for (const match of content.matchAll(/^#{1,6}\s+(.+?)(?:\s+\{#[^{}\s]+\})?\s*$/gmu)) candidates.push({ kind: 'heading', name: match[1]!, start: match.index! + match[0]!.indexOf(match[1]!), end: match.index! + match[0]!.indexOf(match[1]!) + match[1]!.length });
    return candidates.find((candidate) => candidate.start <= offset && offset <= candidate.end);
  }

  #renameEdits(content: string, kind: 'citation' | 'identifier' | 'heading', oldName: string, next: string): readonly { readonly range: LanguageRange; readonly text: string }[] {
    if (kind === 'heading') {
      const escapedHeading = oldName.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
      const line = new RegExp(`^#{1,6}\\s+(${escapedHeading})(?=\\s*(?:\\{#|$))`, 'gmu').exec(content);
      if (line === null || line.index === undefined) return [];
      const index = line.index + line[0].indexOf(oldName);
      return [{ range: { start: index, end: index + oldName.length }, text: next }];
    }
    const escaped = oldName.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    const expression = kind === 'citation' ? new RegExp(`@(${escaped})(?![\\p{L}\\p{N}_:-])`, 'gu') : new RegExp(`(?:\\{#|\\[\\[ref:)(${escaped})(?=\\}|\\]\\])`, 'gu');
    return [...content.matchAll(expression)].map((match) => {
      const index = match.index! + match[0]!.indexOf(oldName);
      return { range: { start: index, end: index + oldName.length }, text: next };
    });
  }

  async #document(fileId: WorkspaceFileId): Promise<ParsedWorkspaceDocument> {
    const session = this.#sessions.snapshot(fileId);
    const source = session === undefined ? await this.#storage.read(fileId) : { file: session.file, content: session.content };
    const parsed = parseMarkdownComDiagnosticos(source.content, {
      documentId: String(source.file.documentId ?? source.file.id),
    });
    return {
      file: source.file,
      content: source.content,
      ast: parsed.ast,
      parserDiagnostics: parsed.diagnostics.map((diagnostic) => ({
        id: diagnostic.id,
        severity: diagnostic.severity,
        message: diagnostic.message,
        ...(diagnostic.source !== undefined ? { source: diagnostic.source } : {}),
      })),
      isOpen: session !== undefined,
    };
  }

  #outlineItem(section: SectionNode, range: LanguageRange): LanguageOutlineItem {
    return {
      nodeId: String(section.id),
      title: textOf(section.title ?? []),
      depth: section.depth,
      ...(section.role !== undefined ? { role: section.role } : {}),
      range,
    };
  }

  async #citationCompletions(
    document: ParsedWorkspaceDocument,
    query: string,
    limit: number,
  ): Promise<readonly LanguageCompletionItem[]> {
    const normalized = query.toLocaleLowerCase();
    const catalog = await this.#catalog(document.file.id);
    const catalogEntries = (await catalog?.search(query, limit)) ?? [];
    const fromDocument = Object.keys(document.ast.references).map((id) => ({ id }));
    const fromIndex = this.#index.citations().map((citation) => ({ id: citation.referenceId }));
    const choices = new Map<string, LanguageReference>();
    for (const reference of [...catalogEntries, ...fromDocument, ...fromIndex]) {
      if (!reference.id.toLocaleLowerCase().includes(normalized) || choices.has(reference.id)) continue;
      choices.set(reference.id, reference);
    }
    return [...choices.values()]
      .sort((left, right) => left.id.localeCompare(right.id))
      .slice(0, Math.max(1, limit))
      .map((reference) => {
        const detail = referenceDetail(reference);
        return {
          kind: 'citation' as const,
          label: `@${reference.id}`,
          ...(detail !== undefined ? { detail } : {}),
          insertText: reference.id,
        };
      });
  }

  async #documentCompletions(
    source: WorkspaceFile,
    query: string,
    limit: number,
  ): Promise<readonly LanguageCompletionItem[]> {
    const normalized = query.toLocaleLowerCase();
    return (await this.#storage.list())
      .filter((file) => file.documentId !== undefined && file.id !== source.id)
      .map((file) => ({ file, path: relativePath(source.path, file.path) }))
      .filter(({ path }) => path.toLocaleLowerCase().includes(normalized))
      .sort((left, right) => left.path.localeCompare(right.path))
      .slice(0, Math.max(1, limit))
      .map(({ file, path }) => ({
        kind: 'document' as const,
        label: path,
        detail: file.path,
        insertText: path,
      }));
  }

  async #catalog(fileId: WorkspaceFileId): Promise<LanguageReferenceCatalog | undefined> {
    return (await this.#referencesFor?.(fileId)) ?? this.#references;
  }
}
