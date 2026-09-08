import { asDocumentId, type Diagnostic, type SourceRange } from '@abnt/document-model';
import {
  applyTextPatches,
  CompositeSourceMapBuilder,
  mapProcessedOffsetToOriginal,
  type CompositeSourceMap,
  type TextPatch,
  type TextSpanMapping,
} from '@abnt/source-composition';

/** Leitura injetada pelo host: o parser Markdown nunca acessa o filesystem. */
export interface TransclusionReader {
  read(path: string): Promise<string | undefined>;
}

export interface SourceCompositionRequest {
  /** Caminho relativo do documento-raiz dentro da autoridade do host. */
  readonly sourcePath: string;
  readonly content: string;
  readonly reader: TransclusionReader;
}

export interface SourceCompositionResult {
  readonly content: string;
  readonly diagnostics: readonly Diagnostic[];
  /** Caminhos dos módulos efetivamente lidos, sem incluir a raiz. */
  readonly dependencies: readonly string[];
  /** F66 — mapa de `content` de volta aos arquivos autorais reais. */
  readonly sourceMap: CompositeSourceMap;
}

interface EmbedTarget { readonly path: string; readonly section?: string; }

// F66: o grupo inicial usava `\s*`, que inclui `\n` e engolia a linha em branco
// anterior ao embed no `match[0]` — o texto virtual perdia essa linha e o
// diagnóstico apontava um offset autoral cedo demais. Só espaço/tab horizontal
// é indentação de linha; quebra de linha não é parte do embed.
const EMBED_LINE = /^([ \t]*)!\[\[([^\]#\n]+?)(?:#([^\]\n]+))?\]\][ \t]*$/gmu;
const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/u;
const HEADING = /^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/u;
const MARKDOWN_URI = /(!?\[[^\]\n]*\]\()([^\s)<]+)([^)]*\))/gu;
const EXTERNAL_URI = /^[a-z][a-z0-9+.-]*:/iu;

const normalizeSegments = (value: string): string | undefined => {
  const result: string[] = [];
  for (const part of value.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') { if (result.length === 0) return undefined; result.pop(); continue; }
    result.push(part);
  }
  return result.join('/');
};

/** Não aceita URI externa, âncora isolada ou escape para fora da autoridade. */
export const resolveCompositionPath = (sourcePath: string, target: string): string | undefined => {
  const bare = target.split(/[?#]/u, 1)[0]?.trim() ?? '';
  if (bare === '' || bare.startsWith('#') || EXTERNAL_URI.test(bare) || bare.startsWith('//')) return undefined;
  const base = sourcePath.split('/').slice(0, -1).join('/');
  return normalizeSegments(bare.startsWith('/') ? bare.slice(1) : [base, bare].filter(Boolean).join('/'));
};

const relativePath = (fromPath: string, toPath: string): string => {
  const from = fromPath.split('/').slice(0, -1).filter(Boolean);
  const to = toPath.split('/').filter(Boolean);
  let shared = 0;
  while (from[shared] !== undefined && from[shared] === to[shared]) shared += 1;
  const value = [...from.slice(shared).map(() => '..'), ...to.slice(shared)].join('/');
  return value === '' ? './' : value;
};

const normalizedHeading = (value: string): string => value.normalize('NFKD').replace(/[\u0300-\u036f]/gu, '').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/(^-+|-+$)/gu, '');

/** Devolve offsets em `content`, não o texto: quem chama decide como fatiar. */
const sectionOf = (content: string, requested: string): { start: number; end: number } | undefined => {
  const lines = content.split(/(?<=\n)/u);
  const offsets: number[] = [];
  let acc = 0;
  for (const line of lines) { offsets.push(acc); acc += line.length; }
  const target = normalizedHeading(requested);
  let start = -1;
  let level = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const match = HEADING.exec((lines[index] ?? '').replace(/[\r\n]+$/u, ''));
    if (match === null) continue;
    if (start < 0 && normalizedHeading(match[2] ?? '') === target) { start = index; level = (match[1] ?? '').length; continue; }
    if (start >= 0 && (match[1] ?? '').length <= level) return { start: offsets[start] as number, end: offsets[index] as number };
  }
  return start < 0 ? undefined : { start: offsets[start] as number, end: content.length };
};

/** Mantém URIs de imagens/links relativas à raiz após inserir um módulo. */
const collectUriRebasePatches = (text: string, fromPath: string, rootPath: string): TextPatch[] => {
  const patches: TextPatch[] = [];
  for (const match of text.matchAll(MARKDOWN_URI)) {
    const prefix = match[1] ?? '';
    const uri = match[2] ?? '';
    const resolved = resolveCompositionPath(fromPath, uri);
    if (resolved === undefined) continue;
    const fragment = uri.indexOf('#') >= 0 ? uri.slice(uri.indexOf('#')) : '';
    const start = (match.index ?? 0) + prefix.length;
    patches.push({ originalStart: start, originalEnd: start + uri.length, replacement: `${relativePath(rootPath, resolved)}${fragment}` });
  }
  return patches;
};

const emitLiteralSpan = (
  path: string,
  spans: readonly TextSpanMapping[],
  localStart: number,
  localEnd: number,
  text: string,
  parts: string[],
  builder: CompositeSourceMapBuilder,
): void => {
  let cursor = localStart;
  while (cursor < localEnd) {
    const boundary = spans.find((span) => span.processedStart <= cursor && cursor < span.processedEnd) ?? spans[spans.length - 1];
    const pieceEnd = Math.min(localEnd, (boundary as TextSpanMapping).processedEnd);
    const piece = text.slice(cursor, pieceEnd);
    if (piece.length > 0) {
      const rawStart = mapProcessedOffsetToOriginal(spans, cursor);
      const rawEnd = mapProcessedOffsetToOriginal(spans, pieceEnd);
      parts.push(piece);
      builder.append(path, piece.length, rawStart, rawEnd);
    }
    cursor = pieceEnd > cursor ? pieceEnd : localEnd;
  }
};

const diagnostic = (id: string, message: string, source: SourceRange): Diagnostic => ({ id, severity: 'error', message, source });

/**
 * F60–F62: expande apenas embeds em linha própria. `[texto](arquivo.md)`
 * continua sendo link; `![[arquivo.md#Seção]]` incorpora conteúdo. Frontmatter
 * de módulos é descartado, pois a metadata canônica é a da raiz publicada.
 *
 * F66: a mesma varredura que monta o texto virtual também monta o
 * `CompositeSourceMap` — segmento por trecho literal efetivamente copiado
 * para a saída, nunca por um embed ainda não expandido. Isso garante que o
 * mapa final é plano (aponta direto para o arquivo folha) mesmo com embeds
 * aninhados.
 */
export async function expandMarkdownComposition(request: SourceCompositionRequest): Promise<SourceCompositionResult> {
  const diagnostics: Diagnostic[] = [];
  const dependencies = new Set<string>();
  const rootPath = request.sourcePath;
  const parts: string[] = [];
  const builder = new CompositeSourceMapBuilder(rootPath);

  const expand = async (path: string, raw: string, stack: readonly string[], root: boolean, section?: string): Promise<{ ok: true } | { ok: false }> => {
    const frontmatterMatch = root ? null : FRONTMATTER.exec(raw);
    const frontmatterLength = frontmatterMatch === null ? 0 : frontmatterMatch[0].length;
    let windowStart = frontmatterLength;
    let windowEnd = raw.length;
    if (!root && section !== undefined) {
      const found = sectionOf(raw.slice(frontmatterLength), section);
      if (found === undefined) return { ok: false };
      windowStart = frontmatterLength + found.start;
      windowEnd = frontmatterLength + found.end;
    }
    const windowText = raw.slice(windowStart, windowEnd);
    const uriPatches = root
      ? []
      : collectUriRebasePatches(windowText, path, rootPath).map((patch) => ({
          originalStart: patch.originalStart + windowStart,
          originalEnd: patch.originalEnd + windowStart,
          replacement: patch.replacement,
        }));
    const patches: TextPatch[] = [
      ...(windowStart > 0 ? [{ originalStart: 0, originalEnd: windowStart, replacement: '' }] : []),
      ...uriPatches,
      ...(windowEnd < raw.length ? [{ originalStart: windowEnd, originalEnd: raw.length, replacement: '' }] : []),
    ];
    const { text, spans } = applyTextPatches(raw, patches);

    const matches = [...text.matchAll(EMBED_LINE)];
    let cursor = 0;
    for (const match of matches) {
      const start = match.index ?? 0;
      emitLiteralSpan(path, spans, cursor, start, text, parts, builder);
      cursor = start + match[0].length;
      const matchSource: SourceRange = {
        documentId: asDocumentId(path),
        start: { offset: mapProcessedOffsetToOriginal(spans, start) },
        end: { offset: mapProcessedOffsetToOriginal(spans, cursor) },
      };
      const target: EmbedTarget = { path: (match[2] ?? '').trim(), ...(match[3] === undefined ? {} : { section: match[3].trim() }) };
      const resolved = resolveCompositionPath(path, target.path);
      if (resolved === undefined || !resolved.toLocaleLowerCase().endsWith('.md')) {
        diagnostics.push(diagnostic('COMPOSICAO-EMBED-URI-INVALIDO', `Embed inválido em "${path}": "${target.path}" deve apontar para um Markdown interno.`, matchSource));
        emitLiteralSpan(path, spans, start, cursor, text, parts, builder);
        continue;
      }
      if (stack.includes(resolved)) {
        diagnostics.push(diagnostic('COMPOSICAO-EMBED-CICLO', `Ciclo de transclusão detectado: ${[...stack, resolved].join(' → ')}.`, matchSource));
        emitLiteralSpan(path, spans, start, cursor, text, parts, builder);
        continue;
      }
      if (stack.length >= 32) {
        diagnostics.push(diagnostic('COMPOSICAO-EMBED-PROFUNDIDADE', 'A composição excedeu o limite de 32 níveis de inclusão.', matchSource));
        emitLiteralSpan(path, spans, start, cursor, text, parts, builder);
        continue;
      }
      const included = await request.reader.read(resolved);
      if (included === undefined) {
        diagnostics.push(diagnostic('COMPOSICAO-EMBED-NAO-ENCONTRADO', `Não foi possível encontrar o módulo "${resolved}" declarado em "${path}".`, matchSource));
        emitLiteralSpan(path, spans, start, cursor, text, parts, builder);
        continue;
      }
      dependencies.add(resolved);
      const childResult = await expand(resolved, included, [...stack, resolved], false, target.section);
      if (!childResult.ok) {
        diagnostics.push(diagnostic('COMPOSICAO-SECAO-NAO-ENCONTRADA', `A seção "${target.section ?? ''}" não existe em "${resolved}".`, matchSource));
        emitLiteralSpan(path, spans, start, cursor, text, parts, builder);
      }
    }
    emitLiteralSpan(path, spans, cursor, text.length, text, parts, builder);
    return { ok: true };
  };

  await expand(rootPath, request.content, [rootPath], true);
  return { content: parts.join(''), diagnostics, dependencies: [...dependencies], sourceMap: builder.build() };
}
