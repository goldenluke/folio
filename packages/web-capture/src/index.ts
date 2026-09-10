import type { BibliographicEntity, CslDate, CslDatePart, CslName } from '@abnt/document-model';
import { detectScholarlyIdentifier } from '@abnt/scholarly-identifiers';
import { identifiersFromPdfText } from '@abnt/pdf-reconciliation';

/**
 * Onda BN (F485–F495). Extractor nunca resolve DOI nem busca rede: só lê o
 * HTML já obtido pelo host (mesma separação de `parseFeed`, Onda BM — quem
 * busca é uma função à parte no host, com fetcher injetável).
 */

export type WebCaptureFields = Partial<Omit<BibliographicEntity, 'id'>>;
type DraftFields = { -readonly [K in keyof WebCaptureFields]: WebCaptureFields[K] };

export type WebCaptureAttachmentRole = 'snapshot' | 'supplementary' | 'dataset';

export interface WebCaptureAttachmentCandidate {
  readonly kind: 'link';
  readonly role: WebCaptureAttachmentRole;
  readonly url: string;
  readonly label?: string;
}

export interface WebCaptureExtraction {
  readonly fields: WebCaptureFields;
  readonly attachments: readonly WebCaptureAttachmentCandidate[];
}

export interface WebCaptureCandidate extends WebCaptureExtraction {
  readonly extractorId: string;
  readonly quality: number;
}

export interface WebCaptureExtractor {
  readonly id: string;
  extract(html: string, pageUrl: string): readonly WebCaptureExtraction[];
}

// --- helpers de leitura de HTML (scanner determinístico, sem DOM) ---------

const decodeEntities = (value: string): string => value
  .replace(/&lt;/giu, '<').replace(/&gt;/giu, '>').replace(/&quot;/giu, '"').replace(/&(?:#39|apos);/giu, "'").replace(/&amp;/giu, '&');
const stripTags = (value: string): string => value.replace(/<[^>]+>/gu, ' ').replace(/\s+/gu, ' ').trim();
const stripNoiseElements = (html: string): string => html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/giu, ' ');

function attr(tag: string, name: string): string | undefined {
  const pattern = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"|\\b${name}\\s*=\\s*'([^']*)'`, 'iu');
  const match = pattern.exec(tag);
  if (match === null) return undefined;
  return match[1] ?? match[2];
}

interface HtmlMetaTag { readonly name: string; readonly content: string; }

function scanMetaTags(html: string): readonly HtmlMetaTag[] {
  const tags: HtmlMetaTag[] = [];
  const pattern = /<meta\b[^>]*>/giu;
  let match = pattern.exec(html);
  while (match !== null) {
    const tag = match[0];
    const name = attr(tag, 'name') ?? attr(tag, 'property');
    const content = attr(tag, 'content');
    if (name !== undefined && content !== undefined) tags.push({ name, content: decodeEntities(content) });
    match = pattern.exec(html);
  }
  return tags;
}

/**
 * Varredura plana de `itemprop` (não respeita aninhamento de `itemscope`) —
 * cobre o caso comum de uma página com um único item Schema.org. Páginas com
 * itens aninhados podem misturar propriedades de itens diferentes; fora de
 * propósito, mesma régua de `parseFeed` (Onda BM).
 */
function scanItemProps(html: string): readonly { readonly prop: string; readonly value: string }[] {
  const results: { prop: string; value: string }[] = [];
  const openTagPattern = /<([a-z][a-z0-9]*)\b([^>]*\bitemprop\s*=\s*["'][^"']+["'][^>]*)>/giu;
  let match = openTagPattern.exec(html);
  while (match !== null) {
    const tagName = match[1] ?? '';
    const attrs = match[2] ?? '';
    const prop = attr(attrs, 'itemprop');
    const contentAttr = attr(attrs, 'content');
    let value = contentAttr;
    if (value === undefined) {
      const rest = html.slice(match.index + match[0].length);
      const closeMatch = new RegExp(`</${tagName}\\b`, 'iu').exec(rest);
      if (closeMatch !== null) value = stripTags(rest.slice(0, closeMatch.index));
    }
    if (prop !== undefined && value !== undefined) {
      const decoded = decodeEntities(value).trim();
      if (decoded !== '') results.push({ prop, value: decoded });
    }
    match = openTagPattern.exec(html);
  }
  return results;
}

function scanJsonLdBlocks(html: string): readonly unknown[] {
  const blocks: unknown[] = [];
  const pattern = /<script\b[^>]*\btype\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/giu;
  let match = pattern.exec(html);
  while (match !== null) {
    try { blocks.push(JSON.parse(match[1] ?? '')); } catch { /* bloco malformado: ignora, não derruba os demais */ }
    match = pattern.exec(html);
  }
  return blocks;
}

/** Heurística simples "Sobrenome, Nome" ou "Nome Sobrenome" — mesma régua de `personNameFromRis` em `@abnt/bibliography`. */
function personNameFromText(value: string): CslName {
  const trimmed = value.trim();
  const [family, given] = trimmed.split(',').map((part) => part.trim());
  if (family !== undefined && family !== '' && given !== undefined && given !== '') return { family, given };
  const words = trimmed.split(/\s+/u).filter((word) => word !== '');
  const last = words[words.length - 1];
  if (words.length >= 2 && last !== undefined) return { given: words.slice(0, -1).join(' '), family: last };
  return { literal: trimmed };
}

/**
 * Cobre datas ISO (`-`) e o formato Highwire (`/`, comum em `citation_publication_date`),
 * completas ou parciais (ano, ano-mês, ano-mês-dia); nunca inventa mês/dia ausente.
 */
function parseCslDateFromText(value: string): CslDate | undefined {
  const match = /^(\d{4})(?:[-/](\d{1,2}))?(?:[-/](\d{1,2}))?/u.exec(value.trim());
  if (match === null) return undefined;
  const year = Number(match[1]);
  if (!Number.isInteger(year) || year < 1000 || year > 9999) return undefined;
  const month = match[2] === undefined ? undefined : Number(match[2]);
  const day = match[3] === undefined ? undefined : Number(match[3]);
  const parts: CslDatePart = day !== undefined && month !== undefined ? [year, month, day] : month !== undefined ? [year, month] : [year];
  return { 'date-parts': [parts] };
}

function jsonLdUrlOf(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() === '' ? undefined : value.trim();
  if (typeof value === 'object' && value !== null) {
    const url = (value as { url?: unknown })['url'] ?? (value as { '@id'?: unknown })['@id'];
    if (typeof url === 'string' && url.trim() !== '') return url.trim();
  }
  return undefined;
}

function jsonLdNameOf(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() === '' ? undefined : value.trim();
  if (typeof value === 'object' && value !== null && typeof (value as { name?: unknown }).name === 'string') {
    const name = (value as { name: string }).name.trim();
    return name === '' ? undefined : name;
  }
  return undefined;
}

function jsonLdAuthors(value: unknown): readonly CslName[] {
  const list = Array.isArray(value) ? value : value === undefined ? [] : [value];
  return list.flatMap((entry) => { const name = jsonLdNameOf(entry); return name === undefined ? [] : [personNameFromText(name)]; });
}

// --- pontuação de qualidade -------------------------------------------------

const FIELD_WEIGHTS: ReadonlyMap<string, number> = new Map([
  ['title', 3], ['author', 3], ['issued', 2], ['DOI', 3],
  ['publisher', 1], ['container-title', 1], ['URL', 1], ['abstract', 1], ['language', 1],
]);

function hasValue(value: unknown): boolean {
  if (value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/** Soma ponderada de campos preenchidos sobre o máximo possível — determinístico, sem heurística de conteúdo. */
export function scoreWebCaptureFields(fields: WebCaptureFields): number {
  let score = 0;
  let max = 0;
  for (const [key, weight] of FIELD_WEIGHTS) {
    max += weight;
    if (hasValue((fields as Record<string, unknown>)[key])) score += weight;
  }
  return max === 0 ? 0 : score / max;
}

// --- extractors embutidos ---------------------------------------------------

/** Highwire/Google Scholar (`citation_title`, `citation_author`, ...) — o formato mais previsível de página acadêmica. */
export const citationMetaExtractor: WebCaptureExtractor = {
  id: 'citation-meta',
  extract(html) {
    const tags = scanMetaTags(html).filter((tag) => tag.name.toLocaleLowerCase().startsWith('citation_') && tag.content.trim() !== '');
    if (tags.length === 0) return [];
    const fields: DraftFields = {};
    const authors: CslName[] = [];
    const attachments: WebCaptureAttachmentCandidate[] = [];
    for (const { name, content } of tags) {
      switch (name.toLocaleLowerCase()) {
        case 'citation_title': fields.title = content; break;
        case 'citation_author': authors.push(personNameFromText(content)); break;
        case 'citation_publication_date':
        case 'citation_date': { const date = parseCslDateFromText(content); if (date !== undefined) fields.issued = date; break; }
        case 'citation_journal_title':
        case 'citation_conference_title': fields['container-title'] = content; break;
        case 'citation_publisher': fields.publisher = content; break;
        case 'citation_doi': fields.DOI = content.replace(/^doi:\s*/iu, ''); break;
        case 'citation_abstract': fields.abstract = content; break;
        case 'citation_language': fields.language = content; break;
        case 'citation_pdf_url': attachments.push({ kind: 'link', role: 'supplementary', url: content, label: 'PDF (citation_pdf_url)' }); break;
        default: break;
      }
    }
    if (authors.length > 0) fields.author = authors;
    if (Object.keys(fields).length === 0 && attachments.length === 0) return [];
    return [{ fields, attachments }];
  },
};

/** Dublin Core (`DC.title`, `DC.creator`, `dcterms.*`) — comum em portais institucionais e repositórios. */
export const dublinCoreExtractor: WebCaptureExtractor = {
  id: 'dublin-core',
  extract(html) {
    const tags = scanMetaTags(html).filter((tag) => /^(?:dc|dcterms)\./iu.test(tag.name) && tag.content.trim() !== '');
    if (tags.length === 0) return [];
    const fields: DraftFields = {};
    const authors: CslName[] = [];
    for (const { name, content } of tags) {
      switch (name.toLocaleLowerCase().replace(/^dcterms\./u, 'dc.')) {
        case 'dc.title': fields.title = content; break;
        case 'dc.creator': authors.push(personNameFromText(content)); break;
        case 'dc.publisher': fields.publisher = content; break;
        case 'dc.date':
        case 'dc.issued': { const date = parseCslDateFromText(content); if (date !== undefined) fields.issued = date; break; }
        case 'dc.description': fields.abstract = content; break;
        case 'dc.language': fields.language = content; break;
        case 'dc.identifier': { const identifier = detectScholarlyIdentifier(content); if (identifier?.type === 'doi') fields.DOI = identifier.value; break; }
        default: break;
      }
    }
    if (authors.length > 0) fields.author = authors;
    if (Object.keys(fields).length === 0) return [];
    return [{ fields, attachments: [] }];
  },
};

const SCHOLARLY_MICRODATA_TYPES = /schema\.org\/(?:Article|ScholarlyArticle|NewsArticle|BlogPosting|Report|Book|Thesis|WebPage)\b/iu;

/** Microdados Schema.org (`itemscope`/`itemprop`) — varredura plana, ver aviso de escopo em `scanItemProps`. */
export const schemaOrgMicrodataExtractor: WebCaptureExtractor = {
  id: 'schema-org',
  extract(html) {
    if (!SCHOLARLY_MICRODATA_TYPES.test(html)) return [];
    const props = scanItemProps(html);
    if (props.length === 0) return [];
    const fields: DraftFields = {};
    const authors: CslName[] = [];
    for (const { prop, value } of props) {
      switch (prop.toLocaleLowerCase()) {
        case 'headline': fields.title = value; break;
        case 'name': if (fields.title === undefined) fields.title = value; break;
        case 'author':
        case 'creator': authors.push(personNameFromText(value)); break;
        case 'datepublished': { const date = parseCslDateFromText(value); if (date !== undefined) fields.issued = date; break; }
        case 'publisher': fields.publisher = value; break;
        case 'description': if (fields.abstract === undefined) fields.abstract = value; break;
        case 'inlanguage': fields.language = value; break;
        case 'url': if (fields.URL === undefined) fields.URL = value; break;
        default: break;
      }
    }
    if (authors.length > 0) fields.author = authors;
    if (Object.keys(fields).length === 0) return [];
    return [{ fields, attachments: [] }];
  },
};

const SCHOLARLY_JSONLD_TYPES = new Set(['Article', 'ScholarlyArticle', 'NewsArticle', 'BlogPosting', 'Report', 'Book', 'Thesis', 'WebPage', 'CreativeWork']);

function jsonLdNodes(document: unknown): readonly Record<string, unknown>[] {
  if (typeof document !== 'object' || document === null) return [];
  const graph = (document as { '@graph'?: unknown })['@graph'];
  const roots = Array.isArray(graph) ? graph : [document];
  return roots.filter((node): node is Record<string, unknown> => typeof node === 'object' && node !== null);
}

function jsonLdTypeMatches(node: Record<string, unknown>): boolean {
  const type = node['@type'];
  const types = Array.isArray(type) ? type : type === undefined ? [] : [type];
  return types.some((entry) => typeof entry === 'string' && SCHOLARLY_JSONLD_TYPES.has(entry));
}

/** `<script type="application/ld+json">` — o formato mais confiável (JSON real, não regex sobre atributos soltos). Pode gerar mais de um resultado por página (`@graph`). */
export const jsonLdExtractor: WebCaptureExtractor = {
  id: 'json-ld',
  extract(html) {
    const extractions: WebCaptureExtraction[] = [];
    for (const document of scanJsonLdBlocks(html)) {
      for (const node of jsonLdNodes(document)) {
        if (!jsonLdTypeMatches(node)) continue;
        const fields: DraftFields = {};
        const title = jsonLdNameOf(node['headline']) ?? jsonLdNameOf(node['name']);
        if (title !== undefined) fields.title = title;
        const authors = jsonLdAuthors(node['author']);
        if (authors.length > 0) fields.author = authors;
        if (typeof node['datePublished'] === 'string') { const date = parseCslDateFromText(node['datePublished']); if (date !== undefined) fields.issued = date; }
        const publisherName = jsonLdNameOf(node['publisher']);
        if (publisherName !== undefined) fields.publisher = publisherName;
        const containerName = jsonLdNameOf(node['isPartOf']) ?? jsonLdNameOf(node['periodical']);
        if (containerName !== undefined) fields['container-title'] = containerName;
        if (typeof node['description'] === 'string' && node['description'].trim() !== '') fields.abstract = node['description'].trim();
        if (typeof node['inLanguage'] === 'string' && node['inLanguage'].trim() !== '') fields.language = node['inLanguage'].trim();
        const url = jsonLdUrlOf(node['url']) ?? jsonLdUrlOf(node['mainEntityOfPage']);
        if (url !== undefined) fields.URL = url;
        const attachments: WebCaptureAttachmentCandidate[] = [];
        const imageUrl = jsonLdUrlOf(node['image']);
        if (imageUrl !== undefined) attachments.push({ kind: 'link', role: 'supplementary', url: imageUrl, label: 'Imagem (JSON-LD)' });
        const media = node['associatedMedia'];
        for (const entry of Array.isArray(media) ? media : media === undefined ? [] : [media]) {
          const mediaUrl = jsonLdUrlOf(entry);
          if (mediaUrl !== undefined) attachments.push({ kind: 'link', role: 'supplementary', url: mediaUrl, label: 'Mídia associada (JSON-LD)' });
        }
        if (Object.keys(fields).length === 0 && attachments.length === 0) continue;
        extractions.push({ fields, attachments });
      }
    }
    return extractions;
  },
};

/** DOI citado no texto visível da página — mesmo scanner literal de `identifiersFromPdfText` (Onda BG), nunca resolve rede aqui. */
export const doiExtractor: WebCaptureExtractor = {
  id: 'doi',
  extract(html) {
    const text = stripTags(stripNoiseElements(html));
    return identifiersFromPdfText(text)
      .filter((identifier) => identifier.type === 'doi')
      .map((identifier) => ({ fields: { DOI: identifier.value }, attachments: [] }));
  },
};

export const BUILTIN_WEB_CAPTURE_EXTRACTORS: readonly WebCaptureExtractor[] = [
  jsonLdExtractor, citationMetaExtractor, dublinCoreExtractor, schemaOrgMicrodataExtractor, doiExtractor,
];

/**
 * Registry explícito, nunca lista embutida no pacote — o host decide o que
 * registra (mesma régua de `IdentifierResolverRegistry`/`FullTextDiscoveryRegistry`,
 * Ondas BF/BI). "Extractors específicos vivem em plugin" (roadmap) significa
 * que este `.register()` é o ponto de extensão: hoje o host registra os 5
 * embutidos, amanhã um plugin pode registrar mais sem tocar este pacote.
 */
export class WebCaptureExtractorRegistry {
  #extractors = new Map<string, WebCaptureExtractor>();

  register(extractor: WebCaptureExtractor): void {
    this.#extractors.set(extractor.id, extractor);
  }

  /** Um extractor com bug nunca derruba os outros. */
  extract(html: string, pageUrl: string): readonly WebCaptureCandidate[] {
    const candidates: WebCaptureCandidate[] = [];
    for (const extractor of this.#extractors.values()) {
      let results: readonly WebCaptureExtraction[];
      try { results = extractor.extract(html, pageUrl); } catch { continue; }
      for (const result of results) {
        if (Object.keys(result.fields).length === 0 && result.attachments.length === 0) continue;
        candidates.push({ extractorId: extractor.id, fields: result.fields, attachments: result.attachments, quality: scoreWebCaptureFields(result.fields) });
      }
    }
    return candidates.slice().sort((a, b) => b.quality - a.quality);
  }
}
