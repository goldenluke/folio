import type { DocumentId, NodeId, NoteId, ReferenceId, ResourceId } from './ids.js';
import type {
  Attribution,
  BlockNode,
  Caption,
  InlineNode,
  JsonValue,
  NodeBase,
  TableCell,
  TableRow,
} from './nodes.js';
import { temFilhosInline } from './nodes.js';

/** Registro serializável. Evita `Map` no formato canônico, que complica JSON, IPC e snapshots. */
export type Registry<T> = { readonly [id: string]: T };

/**
 * Data parcial.
 *
 * Não use `Date` do JavaScript para dado bibliográfico: "1998" e "março de
 * 2011" são datas válidas e incompletas numa referência, e `Date` obriga a
 * inventar mês e dia que a fonte não tem.
 */
export interface PartialDate {
  readonly year?: number;
  readonly month?: number;
  readonly day?: number;
}

/**
 * Texto que pode conter marcação — títulos levam itálico com frequência
 * (nomes científicos, obras citadas dentro do título).
 */
export type RichText = readonly InlineNode[];

export interface DocumentDate {
  readonly role:
    | 'created'
    | 'modified'
    | 'published'
    | 'submitted'
    | 'accepted'
    | `custom:${string}`;
  readonly value: PartialDate;
}

export interface PersonName {
  readonly given?: readonly string[];
  readonly family?: readonly string[];
  readonly prefix?: readonly string[];
  readonly suffix?: readonly string[];
  /** Para nomes que não se dividem: "Organização Mundial da Saúde". */
  readonly literal?: string;
}

export type ContributorRole =
  | 'author'
  | 'editor'
  | 'translator'
  | 'advisor'
  | 'coadvisor'
  | 'reviewer'
  | `custom:${string}`;

export interface Contributor {
  readonly role: ContributorRole;
  readonly name: PersonName;
  readonly affiliation?: string;
  readonly email?: string;
}

/**
 * Metadados do documento.
 *
 * Genéricos de propósito: nada de `universidade` ou `orientador` aqui. Esses
 * são conceitos de uma norma/profile específico e entram via `properties` ou
 * via contributor com `role: 'advisor'`.
 */
export interface DocumentMetadata {
  readonly title?: RichText;
  readonly subtitle?: RichText;
  readonly contributors?: readonly Contributor[];
  readonly abstract?: readonly BlockNode[];
  readonly keywords?: readonly string[];
  readonly languages?: readonly string[];
  readonly dates?: readonly DocumentDate[];
  readonly properties?: { readonly [key: string]: JsonValue };
}

export interface DocumentNode extends NodeBase {
  readonly type: 'document';
  readonly metadata: DocumentMetadata;
  readonly children: readonly BlockNode[];
}

/** Nome no formato de dados CSL-JSON. */
export interface CslName {
  readonly family?: string;
  readonly given?: string;
  readonly literal?: string;
  readonly suffix?: string;
  readonly 'non-dropping-particle'?: string;
  readonly 'dropping-particle'?: string;
  readonly 'comma-suffix'?: boolean;
  readonly 'static-ordering'?: boolean;
}

/** Uma parte de data CSL: ano, opcionalmente mês e dia. */
export type CslDatePart = readonly [year: number, month?: number, day?: number];

/**
 * Data no formato CSL-JSON.
 *
 * `date-parts` preserva datas bibliográficas incompletas sem inventar dia ou
 * mês. `raw`/`literal` mantêm entradas que não podem ser normalizadas com
 * segurança pelo importador.
 */
export interface CslDate {
  readonly 'date-parts'?: readonly CslDatePart[];
  readonly raw?: string;
  readonly literal?: string;
  readonly circa?: boolean;
  readonly season?: string | number;
}

/** Tipos centrais do schema CSL; string aberta preserva interoperabilidade futura. */
export type CslItemType =
  | 'article'
  | 'article-journal'
  | 'article-magazine'
  | 'article-newspaper'
  | 'bill'
  | 'book'
  | 'broadcast'
  | 'chapter'
  | 'classic'
  | 'collection'
  | 'dataset'
  | 'document'
  | 'entry'
  | 'entry-dictionary'
  | 'entry-encyclopedia'
  | 'event'
  | 'figure'
  | 'graphic'
  | 'hearing'
  | 'interview'
  | 'legal_case'
  | 'legislation'
  | 'manuscript'
  | 'map'
  | 'motion_picture'
  | 'musical_score'
  | 'pamphlet'
  | 'paper-conference'
  | 'patent'
  | 'performance'
  | 'periodical'
  | 'personal_communication'
  | 'post'
  | 'post-weblog'
  | 'regulation'
  | 'report'
  | 'review'
  | 'review-book'
  | 'software'
  | 'song'
  | 'speech'
  | 'standard'
  | 'thesis'
  | 'treaty'
  | 'webpage';

/**
 * Item bibliográfico canônico, compatível com CSL-JSON.
 *
 * Os nomes das propriedades seguem deliberadamente o schema CSL — inclusive
 * hífens e maiúsculas em DOI/URL/ISBN/ISSN. Isso permite intercâmbio direto
 * com Zotero, Mendeley e Crossref. Quirks de formatos de entrada (BibTeX,
 * RIS) são normalizados antes de chegar aqui.
 *
 * O modelo fica no package folha porque faz parte da forma serializada do
 * Document AST. Importação, ordenação e formatação pertencem a
 * `@abnt/bibliography`; nenhuma decisão editorial vive nesta interface.
 */
export interface BibliographicEntity {
  readonly id: ReferenceId;
  readonly type: CslItemType;

  readonly title?: string;
  readonly 'title-short'?: string;
  readonly abstract?: string;

  readonly author?: readonly CslName[];
  readonly editor?: readonly CslName[];
  readonly translator?: readonly CslName[];
  readonly 'container-author'?: readonly CslName[];

  readonly issued?: CslDate;
  readonly accessed?: CslDate;
  readonly submitted?: CslDate;
  readonly 'original-date'?: CslDate;

  readonly 'container-title'?: string;
  readonly 'collection-title'?: string;
  readonly 'collection-number'?: string;
  readonly 'event-title'?: string;
  readonly 'event-place'?: string;
  readonly publisher?: string;
  readonly 'publisher-place'?: string;
  readonly edition?: string | number;
  readonly volume?: string | number;
  readonly issue?: string | number;
  readonly page?: string;
  readonly 'number-of-pages'?: string | number;
  readonly genre?: string;
  readonly medium?: string;
  readonly language?: string;

  readonly DOI?: string;
  readonly URL?: string;
  readonly ISBN?: string;
  readonly ISSN?: string;

  /** Campos não canônicos preservados, sempre isolados sob namespace próprio. */
  readonly custom?: { readonly [key: string]: JsonValue };
}

export interface ResourceIntegrity {
  readonly algorithm: 'sha256';
  readonly value: string;
}

/**
 * Recurso externo (imagem, arquivo).
 *
 * Nós referenciam recursos por id, nunca por caminho solto. Isso permite que
 * o mesmo arquivo mude de lugar, seja embutido, sincronizado ou endereçado por
 * conteúdo sem que nenhum nó da árvore precise mudar.
 */
export interface Resource {
  readonly id: ResourceId;
  readonly uri: string;
  readonly mediaType?: string;
  readonly integrity?: ResourceIntegrity;
}

export interface Note {
  readonly id: NoteId;
  readonly kind: 'footnote' | 'endnote' | 'margin' | `custom:${string}`;
  readonly children: readonly BlockNode[];
}

/**
 * Raiz do modelo canônico.
 *
 * `schema` e `version` são explícitos porque este formato vai ser persistido e
 * lido por outras versões do programa. Migração é função explícita
 * (`migrar`), não um acúmulo de campos opcionais.
 *
 * Referências, recursos e notas ficam em registries fora da árvore: uma nota
 * pode ser referenciada de dois lugares, e uma referência bibliográfica não
 * pertence a nenhum ponto específico do texto. Árvore para hierarquia,
 * registry para identidade.
 */
export interface DocumentAst {
  readonly schema: 'document-ast';
  readonly version: 1;
  readonly documentId: DocumentId;
  readonly document: DocumentNode;
  readonly references: Registry<BibliographicEntity>;
  readonly resources: Registry<Resource>;
  readonly notes: Registry<Note>;
}

// ---------------------------------------------------------------------------
// Travessia
// ---------------------------------------------------------------------------

export type AnyNode = DocumentNode | BlockNode | InlineNode | TableRow | TableCell;

function* andarInline(nodes: readonly InlineNode[]): Generator<InlineNode> {
  for (const n of nodes) {
    yield n;

    if (temFilhosInline(n)) {
      yield* andarInline(n.children);
      continue;
    }

    if (n.type === 'citation') {
      for (const item of n.items) {
        if (item.prefix !== undefined) yield* andarInline(item.prefix);
        if (item.suffix !== undefined) yield* andarInline(item.suffix);
      }
    }
  }
}

function* andarCaption(caption: Caption | undefined): Generator<AnyNode> {
  if (caption === undefined) return;
  if (caption.short !== undefined) yield* andarInline(caption.short);
  if (caption.long !== undefined) yield* andarBlock(caption.long);
}

function* andarAttribution(attr: Attribution | undefined): Generator<AnyNode> {
  if (attr === undefined) return;
  if (attr.content !== undefined) yield* andarInline(attr.content);
  for (const item of attr.citations ?? []) {
    if (item.prefix !== undefined) yield* andarInline(item.prefix);
    if (item.suffix !== undefined) yield* andarInline(item.suffix);
  }
}

function* andarBlock(nodes: readonly BlockNode[]): Generator<AnyNode> {
  for (const n of nodes) {
    yield n;

    switch (n.type) {
      case 'paragraph':
      case 'heading':
        yield* andarInline(n.children);
        break;

      case 'section':
        if (n.title !== undefined) yield* andarInline(n.title);
        yield* andarBlock(n.children);
        break;

      case 'quote':
        yield* andarBlock(n.children);
        yield* andarAttribution(n.attribution);
        break;

      case 'list':
        yield* andarBlock(n.items);
        break;

      case 'list-item':
      case 'container':
        yield* andarBlock(n.children);
        break;

      case 'figure':
        for (const c of n.content) {
          if (c.type === 'image' && c.alt !== undefined) yield* andarInline(c.alt);
        }
        yield* andarCaption(n.caption);
        yield* andarAttribution(n.attribution);
        break;

      case 'table':
        for (const linha of [...(n.head ?? []), ...n.body, ...(n.foot ?? [])]) {
          yield linha;
          for (const celula of linha.cells) {
            yield celula;
            yield* andarBlock(celula.children);
          }
        }
        yield* andarCaption(n.caption);
        yield* andarAttribution(n.attribution);
        break;

      case 'code-block':
      case 'math-block':
        yield* andarCaption(n.caption);
        break;

      case 'thematic-break':
        break;
    }
  }
}

/**
 * Percorre a árvore em profundidade, incluindo o documento e os metadados.
 *
 * Cobre também os lugares fáceis de esquecer — células de tabela, legendas,
 * indicações de fonte e afixos de citação. Esquecer um deles faz a checagem de
 * unicidade de id passar sem verificar nada.
 */
export function* percorrer(ast: DocumentAst): Generator<AnyNode> {
  yield ast.document;

  const { metadata } = ast.document;
  if (metadata.title !== undefined) yield* andarInline(metadata.title);
  if (metadata.subtitle !== undefined) yield* andarInline(metadata.subtitle);
  if (metadata.abstract !== undefined) yield* andarBlock(metadata.abstract);

  yield* andarBlock(ast.document.children);
}

/** Percorre também o conteúdo das notas, que vive no registry e não na árvore. */
export function* percorrerTudo(ast: DocumentAst): Generator<AnyNode> {
  yield* percorrer(ast);
  for (const nota of Object.values(ast.notes)) yield* andarBlock(nota.children);
}

/** Índice nodeId -> nó. Derivado; nunca serializado junto da AST. */
export function indexarPorId(ast: DocumentAst): Map<NodeId, AnyNode> {
  const indice = new Map<NodeId, AnyNode>();
  for (const node of percorrerTudo(ast)) indice.set(node.id, node);
  return indice;
}
