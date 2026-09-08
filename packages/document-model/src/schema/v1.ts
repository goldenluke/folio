import { z } from 'zod';

/**
 * Especificação de runtime do formato `document-ast` v1.
 *
 * Por que existe, se já há tipos TypeScript: os tipos somem na compilação. Um
 * `.ast.json` gravado por outra versão do programa, por um plugin ou por outra
 * ferramenta chega como `unknown`, e confiar nele por asserção é como não
 * validar. Este schema é também a fonte do JSON Schema publicado, que permite
 * a implementações fora do TypeScript lerem e escreverem o formato.
 *
 * NOTA sobre tipos branded: `NodeId` e afins são `string` em runtime; a marca
 * existe só na compilação e não tem representação em JSON. O schema valida
 * `string`, e não tentamos fazer `z.infer` ser idêntico às interfaces — seria
 * fingir uma equivalência que o JSON não sustenta. A consistência que importa
 * de verdade é "o parser produz algo que este schema aceita", e isso é
 * verificado por teste em `tests/schema.test.ts`.
 */

const id = z.string().min(1);
const namespaced = z.string().regex(/^[^:]+:[^:]*$/, 'esperado namespace no formato `ns:nome`');

const jsonValue: z.ZodType<unknown> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValue), z.record(z.string(), jsonValue)]),
);

const sourcePosition = z.object({
  offset: z.number().int().nonnegative(),
  line: z.number().int().positive().optional(),
  column: z.number().int().positive().optional(),
});

const sourceRange = z.object({
  documentId: id,
  start: sourcePosition,
  end: sourcePosition,
});

const attributeMap = z.object({
  identifier: z.string().optional(),
  classes: z.array(z.string()).optional(),
  properties: z.record(z.string(), jsonValue).optional(),
});

const extensionMap = z.record(namespaced, jsonValue);

/** Campos comuns a todo nó. */
const base = {
  id,
  source: sourceRange.optional(),
  attributes: attributeMap.optional(),
  extensions: extensionMap.optional(),
};

// ---------------------------------------------------------------------------
// Citação
// ---------------------------------------------------------------------------

const locator = z.object({
  type: z.string().min(1),
  value: z.string(),
});

const inline: z.ZodType<unknown> = z.lazy(() => inlineNode);
const block: z.ZodType<unknown> = z.lazy(() => blockNode);

const citationItem = z.object({
  referenceId: id,
  prefix: z.array(inline).optional(),
  suffix: z.array(inline).optional(),
  locator: locator.optional(),
  suppressAuthor: z.boolean().optional(),
});

const citation = z.object({
  ...base,
  type: z.literal('citation'),
  mode: z.string().min(1),
  items: z.array(citationItem),
});

const crossReference = z.object({
  ...base,
  type: z.literal('cross-reference'),
  target: z.union([
    z.object({ kind: z.literal('node'), nodeId: id }),
    z.object({ kind: z.literal('identifier'), identifier: z.string().min(1) }),
  ]),
  presentation: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Inline
// ---------------------------------------------------------------------------

const comFilhosInline = (tipo: string) =>
  z.object({ ...base, type: z.literal(tipo), children: z.array(inline) });

const text = z.object({ ...base, type: z.literal('text'), value: z.string() });
const emphasis = comFilhosInline('emphasis');
const strong = comFilhosInline('strong');
const strike = comFilhosInline('strike');
const inlineContainer = z.object({
  ...base,
  type: z.literal('inline-container'),
  role: namespaced.optional(),
  children: z.array(inline),
});

const codeInline = z.object({ ...base, type: z.literal('code-inline'), value: z.string() });
const mathInline = z.object({
  ...base,
  type: z.literal('math-inline'),
  language: z.string().min(1),
  value: z.string(),
});
const link = z.object({
  ...base,
  type: z.literal('link'),
  url: z.string(),
  title: z.string().optional(),
  children: z.array(inline),
});
const noteReference = z.object({ ...base, type: z.literal('note-reference'), noteId: id });
const softBreak = z.object({ ...base, type: z.literal('soft-break') });
const hardBreak = z.object({ ...base, type: z.literal('hard-break') });

const inlineNode = z.discriminatedUnion('type', [
  text,
  emphasis,
  strong,
  strike,
  codeInline,
  mathInline,
  link,
  citation,
  crossReference,
  noteReference,
  softBreak,
  hardBreak,
  inlineContainer,
]);

// ---------------------------------------------------------------------------
// Auxiliares de bloco
// ---------------------------------------------------------------------------

const caption = z.object({
  short: z.array(inline).optional(),
  long: z.array(block).optional(),
});

const attribution = z.object({
  citations: z.array(citationItem).optional(),
  content: z.array(inline).optional(),
});

const alignment = z.enum(['left', 'right', 'center', 'justify']);

const tableCell = z.object({
  ...base,
  type: z.literal('table-cell'),
  rowSpan: z.number().int().positive().optional(),
  columnSpan: z.number().int().positive().optional(),
  alignment: alignment.optional(),
  children: z.array(block),
});

const tableRow = z.object({
  ...base,
  type: z.literal('table-row'),
  cells: z.array(tableCell),
});

const figureContent = z.union([
  z.object({ type: z.literal('image'), resourceId: id, alt: z.array(inline).optional() }),
  z.object({ type: z.literal('embedded'), resourceId: id, mediaType: z.string().optional() }),
]);

// ---------------------------------------------------------------------------
// Block
// ---------------------------------------------------------------------------

const paragraph = z.object({ ...base, type: z.literal('paragraph'), children: z.array(inline) });

const section = z.object({
  ...base,
  type: z.literal('section'),
  role: namespaced.optional(),
  title: z.array(inline).optional(),
  depth: z.number().int().positive(),
  children: z.array(block),
});

const heading = z.object({
  ...base,
  type: z.literal('heading'),
  depth: z.number().int().positive(),
  children: z.array(inline),
});

const quote = z.object({
  ...base,
  type: z.literal('quote'),
  children: z.array(block),
  attribution: attribution.optional(),
});

const listItem = z.object({
  ...base,
  type: z.literal('list-item'),
  checked: z.boolean().optional(),
  children: z.array(block),
});

const list = z.object({
  ...base,
  type: z.literal('list'),
  ordered: z.boolean(),
  start: z.number().int().optional(),
  items: z.array(listItem),
});

const figure = z.object({
  ...base,
  type: z.literal('figure'),
  content: z.array(figureContent),
  caption: caption.optional(),
  attribution: attribution.optional(),
});

const table = z.object({
  ...base,
  type: z.literal('table'),
  columns: z.array(z.object({ alignment: alignment.optional(), width: z.string().optional() })),
  head: z.array(tableRow).optional(),
  body: z.array(tableRow),
  foot: z.array(tableRow).optional(),
  caption: caption.optional(),
  attribution: attribution.optional(),
});

const codeBlock = z.object({
  ...base,
  type: z.literal('code-block'),
  language: z.string().optional(),
  value: z.string(),
  caption: caption.optional(),
});

const mathBlock = z.object({
  ...base,
  type: z.literal('math-block'),
  language: z.string().min(1),
  value: z.string(),
  caption: caption.optional(),
});

const thematicBreak = z.object({ ...base, type: z.literal('thematic-break') });

const container = z.object({
  ...base,
  type: z.literal('container'),
  role: namespaced.optional(),
  children: z.array(block),
});

const blockNode = z.discriminatedUnion('type', [
  paragraph,
  section,
  heading,
  quote,
  list,
  listItem,
  figure,
  table,
  codeBlock,
  mathBlock,
  thematicBreak,
  container,
]);

// ---------------------------------------------------------------------------
// Documento
// ---------------------------------------------------------------------------

const partialDate = z.object({
  year: z.number().int().optional(),
  month: z.number().int().min(1).max(12).optional(),
  day: z.number().int().min(1).max(31).optional(),
});

const personName = z.object({
  given: z.array(z.string()).optional(),
  family: z.array(z.string()).optional(),
  prefix: z.array(z.string()).optional(),
  suffix: z.array(z.string()).optional(),
  literal: z.string().optional(),
});

const contributor = z.object({
  role: z.string().min(1),
  name: personName,
  affiliation: z.string().optional(),
  email: z.string().optional(),
});

const metadata = z.object({
  title: z.array(inline).optional(),
  subtitle: z.array(inline).optional(),
  contributors: z.array(contributor).optional(),
  abstract: z.array(block).optional(),
  keywords: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  dates: z
    .array(z.object({ role: z.string().min(1), value: partialDate }))
    .optional(),
  properties: z.record(z.string(), jsonValue).optional(),
});

const documentNode = z.object({
  ...base,
  type: z.literal('document'),
  metadata,
  children: z.array(block),
});

const cslName = z.object({
  family: z.string().optional(),
  given: z.string().optional(),
  literal: z.string().optional(),
  suffix: z.string().optional(),
  'non-dropping-particle': z.string().optional(),
  'dropping-particle': z.string().optional(),
  'comma-suffix': z.boolean().optional(),
  'static-ordering': z.boolean().optional(),
});

const cslDatePart = z.tuple([
  z.number().int(),
  z.number().int().min(1).max(12).optional(),
  z.number().int().min(1).max(31).optional(),
]);

const cslDate = z.object({
  'date-parts': z.array(cslDatePart).optional(),
  raw: z.string().optional(),
  literal: z.string().optional(),
  circa: z.boolean().optional(),
  season: z.union([z.string(), z.number()]).optional(),
});

/** Subschema público do item canônico CSL-JSON armazenado no registry. */
export const cslBibliographicEntityV1 = z.object({
  id,
  type: z.enum([
    'article',
    'article-journal',
    'article-magazine',
    'article-newspaper',
    'bill',
    'book',
    'broadcast',
    'chapter',
    'classic',
    'collection',
    'dataset',
    'document',
    'entry',
    'entry-dictionary',
    'entry-encyclopedia',
    'event',
    'figure',
    'graphic',
    'hearing',
    'interview',
    'legal_case',
    'legislation',
    'manuscript',
    'map',
    'motion_picture',
    'musical_score',
    'pamphlet',
    'paper-conference',
    'patent',
    'performance',
    'periodical',
    'personal_communication',
    'post',
    'post-weblog',
    'regulation',
    'report',
    'review',
    'review-book',
    'software',
    'song',
    'speech',
    'standard',
    'thesis',
    'treaty',
    'webpage',
  ]),
  title: z.string().optional(),
  'title-short': z.string().optional(),
  abstract: z.string().optional(),

  author: z.array(cslName).optional(),
  editor: z.array(cslName).optional(),
  translator: z.array(cslName).optional(),
  'container-author': z.array(cslName).optional(),

  issued: cslDate.optional(),
  accessed: cslDate.optional(),
  submitted: cslDate.optional(),
  'original-date': cslDate.optional(),

  'container-title': z.string().optional(),
  'collection-title': z.string().optional(),
  'collection-number': z.string().optional(),
  'event-title': z.string().optional(),
  'event-place': z.string().optional(),
  publisher: z.string().optional(),
  'publisher-place': z.string().optional(),
  edition: z.union([z.string(), z.number()]).optional(),
  volume: z.union([z.string(), z.number()]).optional(),
  issue: z.union([z.string(), z.number()]).optional(),
  page: z.string().optional(),
  'number-of-pages': z.union([z.string(), z.number()]).optional(),
  genre: z.string().optional(),
  medium: z.string().optional(),
  language: z.string().optional(),

  DOI: z.string().optional(),
  URL: z.string().optional(),
  ISBN: z.string().optional(),
  ISSN: z.string().optional(),
  custom: z.record(z.string(), jsonValue).optional(),
});

const resource = z.object({
  id,
  uri: z.string(),
  mediaType: z.string().optional(),
  integrity: z.object({ algorithm: z.literal('sha256'), value: z.string() }).optional(),
});

const note = z.object({
  id,
  kind: z.string().min(1),
  children: z.array(block),
});

/** Schema raiz do formato `document-ast` v1. */
export const documentAstV1 = z.object({
  schema: z.literal('document-ast'),
  version: z.literal(1),
  documentId: id,
  document: documentNode,
  references: z.record(z.string(), cslBibliographicEntityV1),
  resources: z.record(z.string(), resource),
  notes: z.record(z.string(), note),
});

export const SCHEMA_ID = 'document-ast';
export const SCHEMA_VERSION = 1 as const;
