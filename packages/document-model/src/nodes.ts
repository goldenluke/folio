import type { NodeId, NoteId, ReferenceId, ResourceId } from './ids.js';
import type { SourceRange } from './source.js';

/**
 * Papel semântico, sempre com namespace.
 *
 * O core trata isto como identificador opaco: ele não sabe o que
 * `abnt:folha-aprovacao` significa, e é justamente por isso que um módulo de
 * norma pode introduzir papéis novos sem alterar este package.
 *
 * Convenção de namespaces:
 *   doc:*       estrutura documental universal (doc:abstract, doc:appendix)
 *   academic:*  papéis acadêmicos genéricos (academic:methodology)
 *   <norma>:*   específicos de uma norma (abnt:errata)
 *   custom:*    definidos pelo usuário
 */
export type SemanticRole = `${string}:${string}`;

/** Valor serializável em JSON. Extensões e atributos não guardam nada além disso. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

/**
 * Atributos declarados pelo autor no documento (id, classes, chave/valor).
 * Contraste com anotações, que são derivadas pelo compilador e vivem fora da
 * AST — ver AnnotationStore no package `semantics`.
 */
export interface AttributeMap {
  readonly identifier?: string;
  readonly classes?: readonly string[];
  readonly properties?: { readonly [key: string]: JsonValue };
}

/** Dados de módulos externos. A chave precisa de namespace: `abnt:algo`. */
export type ExtensionMap = { readonly [key: `${string}:${string}`]: JsonValue };

export interface NodeBase {
  readonly id: NodeId;
  readonly type: string;
  readonly source?: SourceRange;
  readonly attributes?: AttributeMap;
  readonly extensions?: ExtensionMap;
}

// ===========================================================================
// Citação
// ===========================================================================

/**
 * Como a citação se apresenta no texto.
 *
 * `parenthetical` -> (Silva, 2024)
 * `narrative`     -> Silva (2024)
 *
 * A escolha é semântica (o autor faz parte da frase, ou não), não tipográfica.
 * Como cada modo vira texto é decisão da norma: em sistema numérico ambos
 * podem virar `[7]`.
 */
export type CitationMode =
  | 'parenthetical'
  | 'narrative'
  | 'author-only'
  | 'year-only'
  | `custom:${string}`;

/**
 * Tipo de localização dentro da fonte.
 *
 * Aberto por `custom:` porque fontes novas trazem localizadores novos
 * (timestamp de vídeo, posição em e-book) sem que o schema precise mudar.
 */
export type LocatorType =
  | 'page'
  | 'page-range'
  | 'chapter'
  | 'section'
  | 'paragraph'
  | 'volume'
  | 'issue'
  | 'figure'
  | 'table'
  | 'note'
  | 'timestamp'
  | `custom:${string}`;

/**
 * Localização dentro da fonte citada.
 *
 * `value` é string, nunca número: "42", "42-46", "xv", "A3" e "00:13:24" são
 * todos válidos dependendo da fonte. Tipar como número obrigaria a perder
 * informação já na entrada.
 */
export interface Locator {
  readonly type: LocatorType;
  readonly value: string;
}

export interface CitationItem {
  readonly referenceId: ReferenceId;
  /** Texto antes da entrada: "cf.", "ver também". */
  readonly prefix?: readonly InlineNode[];
  readonly suffix?: readonly InlineNode[];
  readonly locator?: Locator;
  /** Autor já dito na frase; a norma decide se o suprime na saída. */
  readonly suppressAuthor?: boolean;
}

/**
 * Uma citação, com uma ou mais entradas.
 *
 * INVARIANTE: não guarda o texto formatado. `(Silva, 2024, p. 42)` é produto do
 * motor de citação sob uma norma específica, e a mesma citação sob a IEEE vira
 * `[7]`. Guardar a saída aqui congelaria a norma dentro do documento.
 *
 * Múltiplas entradas num único nó — e não vários nós — porque
 * `(Silva, 2024; Souza, 2023)` é uma citação só, e a norma ordena e separa as
 * entradas como um conjunto.
 */
export interface CitationNode extends NodeBase {
  readonly type: 'citation';
  readonly mode: CitationMode;
  readonly items: readonly CitationItem[];
}

// ===========================================================================
// Referência cruzada
// ===========================================================================

export type CrossReferenceTarget =
  | { readonly kind: 'node'; readonly nodeId: NodeId }
  | { readonly kind: 'identifier'; readonly identifier: string };

/** Como a referência aparece: "Figura 3", "3", o título, ou tudo. */
export type CrossReferencePresentation = 'label' | 'number' | 'title' | 'full' | `custom:${string}`;

/**
 * Referência a outro elemento do documento.
 *
 * O número NÃO está resolvido aqui — resolver é trabalho do pass de
 * numeração, e o resultado vai para as anotações.
 */
export interface CrossReferenceNode extends NodeBase {
  readonly type: 'cross-reference';
  readonly target: CrossReferenceTarget;
  readonly presentation?: CrossReferencePresentation;
}

// ===========================================================================
// Inline
// ===========================================================================

export interface TextNode extends NodeBase {
  readonly type: 'text';
  readonly value: string;
}

export interface EmphasisNode extends NodeBase {
  readonly type: 'emphasis';
  readonly children: readonly InlineNode[];
}

export interface StrongNode extends NodeBase {
  readonly type: 'strong';
  readonly children: readonly InlineNode[];
}

export interface StrikeNode extends NodeBase {
  readonly type: 'strike';
  readonly children: readonly InlineNode[];
}

export interface CodeInlineNode extends NodeBase {
  readonly type: 'code-inline';
  readonly value: string;
}

export interface MathInlineNode extends NodeBase {
  readonly type: 'math-inline';
  readonly language: 'tex' | 'mathml' | `custom:${string}`;
  readonly value: string;
}

export interface LinkNode extends NodeBase {
  readonly type: 'link';
  readonly url: string;
  readonly title?: string;
  readonly children: readonly InlineNode[];
}

export interface NoteReferenceNode extends NodeBase {
  readonly type: 'note-reference';
  readonly noteId: NoteId;
}

/** Quebra de linha suave (fim de linha no fonte); não é quebra de parágrafo. */
export interface SoftBreakNode extends NodeBase {
  readonly type: 'soft-break';
}

/** Quebra de linha explícita. */
export interface HardBreakNode extends NodeBase {
  readonly type: 'hard-break';
}

/**
 * Válvula de escape inline: agrupa conteúdo com um papel semântico que o core
 * não precisa entender. Evita inflar o union type a cada extensão.
 */
export interface InlineContainerNode extends NodeBase {
  readonly type: 'inline-container';
  readonly role?: SemanticRole;
  readonly children: readonly InlineNode[];
}

export type InlineNode =
  | TextNode
  | EmphasisNode
  | StrongNode
  | StrikeNode
  | CodeInlineNode
  | MathInlineNode
  | LinkNode
  | CitationNode
  | CrossReferenceNode
  | NoteReferenceNode
  | SoftBreakNode
  | HardBreakNode
  | InlineContainerNode;

// ===========================================================================
// Estruturas auxiliares de bloco
// ===========================================================================

/**
 * Legenda.
 *
 * `short` é o texto que vai na legenda impressa e nas listas de figuras;
 * `long` é descrição estendida, útil para acessibilidade e para publicações
 * que a exigem. Separar evita ter que escolher entre uma legenda curta legível
 * e uma descrição completa.
 */
export interface Caption {
  readonly short?: readonly InlineNode[];
  readonly long?: readonly BlockNode[];
}

/**
 * Indicação de fonte/autoria de um elemento.
 *
 * A ABNT exige indicação de fonte em figuras e tabelas; modelamos como
 * citações estruturadas mais texto livre, porque a fonte tanto pode ser uma
 * entrada bibliográfica ("SILVA, 2024") quanto uma declaração ("Elaborado
 * pelo autor").
 */
export interface Attribution {
  readonly citations?: readonly CitationItem[];
  readonly content?: readonly InlineNode[];
}

export type TableAlignment = 'left' | 'right' | 'center' | 'justify';

export interface TableColumn {
  readonly alignment?: TableAlignment;
  /** Largura relativa; o renderer decide como interpretar. */
  readonly width?: string;
}

export interface TableCell extends NodeBase {
  readonly type: 'table-cell';
  readonly rowSpan?: number;
  readonly columnSpan?: number;
  readonly alignment?: TableAlignment;
  readonly children: readonly BlockNode[];
}

export interface TableRow extends NodeBase {
  readonly type: 'table-row';
  readonly cells: readonly TableCell[];
}

export interface ImageContent {
  readonly type: 'image';
  readonly resourceId: ResourceId;
  readonly alt?: readonly InlineNode[];
}

/** Conteúdo embutido que não é imagem (diagrama, objeto). */
export interface EmbeddedContent {
  readonly type: 'embedded';
  readonly resourceId: ResourceId;
  readonly mediaType?: string;
}

export type FigureContent = ImageContent | EmbeddedContent;

// ===========================================================================
// Block
// ===========================================================================

export interface ParagraphNode extends NodeBase {
  readonly type: 'paragraph';
  readonly children: readonly InlineNode[];
}

/**
 * Seção estrutural.
 *
 * Deliberadamente NÃO carrega número. "1.2 Metodologia" é resultado de um pass
 * de numeração que roda depois e grava o resultado nas anotações. Se o número
 * morasse aqui, inserir uma seção acima obrigaria a reescrever a AST inteira —
 * e a mesma AST não poderia ser publicada sob duas normas com regras de
 * numeração diferentes. Ver docs/adr/0001.
 */
export interface SectionNode extends NodeBase {
  readonly type: 'section';
  readonly role?: SemanticRole;
  readonly title?: readonly InlineNode[];
  readonly depth: number;
  readonly children: readonly BlockNode[];
}

/**
 * Título solto, sem seção estruturada em volta.
 *
 * Existe para preservar documentos importados em que o heading não implica
 * hierarquia. A normalização converte a maioria em SectionNode; o que sobra
 * fica aqui em vez de ser descartado.
 */
export interface HeadingNode extends NodeBase {
  readonly type: 'heading';
  readonly depth: number;
  readonly children: readonly InlineNode[];
}

/**
 * Citação em bloco.
 *
 * Não distingue "curta" de "longa": esse é um julgamento da norma (a NBR 10520
 * usa o número de linhas como critério) e vira anotação no pass de análise,
 * não propriedade do nó.
 */
export interface QuoteNode extends NodeBase {
  readonly type: 'quote';
  readonly children: readonly BlockNode[];
  readonly attribution?: Attribution;
}

export interface ListItemNode extends NodeBase {
  readonly type: 'list-item';
  /** Estado de caixa de seleção; ausente quando não é lista de tarefas. */
  readonly checked?: boolean;
  readonly children: readonly BlockNode[];
}

export interface ListNode extends NodeBase {
  readonly type: 'list';
  readonly ordered: boolean;
  readonly start?: number;
  readonly items: readonly ListItemNode[];
}

export interface FigureNode extends NodeBase {
  readonly type: 'figure';
  readonly content: readonly FigureContent[];
  readonly caption?: Caption;
  readonly attribution?: Attribution;
}

export interface TableNode extends NodeBase {
  readonly type: 'table';
  readonly columns: readonly TableColumn[];
  readonly head?: readonly TableRow[];
  readonly body: readonly TableRow[];
  readonly foot?: readonly TableRow[];
  readonly caption?: Caption;
  readonly attribution?: Attribution;
}

export interface CodeBlockNode extends NodeBase {
  readonly type: 'code-block';
  readonly language?: string;
  readonly value: string;
  readonly caption?: Caption;
}

export interface MathBlockNode extends NodeBase {
  readonly type: 'math-block';
  readonly language: 'tex' | 'mathml' | `custom:${string}`;
  readonly value: string;
  readonly caption?: Caption;
}

export interface ThematicBreakNode extends NodeBase {
  readonly type: 'thematic-break';
}

/**
 * Válvula de escape de bloco.
 *
 * Permite representar `abnt:dedicatoria` ou `usp:folha-aprovacao` sem alterar
 * o union type nem este package — o core carrega o papel sem interpretá-lo.
 */
export interface ContainerNode extends NodeBase {
  readonly type: 'container';
  readonly role?: SemanticRole;
  readonly children: readonly BlockNode[];
}

export type BlockNode =
  | ParagraphNode
  | SectionNode
  | HeadingNode
  | QuoteNode
  | ListNode
  | ListItemNode
  | FigureNode
  | TableNode
  | CodeBlockNode
  | MathBlockNode
  | ThematicBreakNode
  | ContainerNode;

// ===========================================================================
// Type guards
// ===========================================================================

const inlineTypes = new Set([
  'text',
  'emphasis',
  'strong',
  'strike',
  'code-inline',
  'math-inline',
  'link',
  'citation',
  'cross-reference',
  'note-reference',
  'soft-break',
  'hard-break',
  'inline-container',
]);

export const isInline = (n: { readonly type: string }): n is InlineNode =>
  inlineTypes.has(n.type);

export const isText = (n: InlineNode): n is TextNode => n.type === 'text';
export const isStrong = (n: InlineNode): n is StrongNode => n.type === 'strong';
export const isCitation = (n: InlineNode): n is CitationNode => n.type === 'citation';
export const isParagraph = (n: BlockNode): n is ParagraphNode => n.type === 'paragraph';
export const isSection = (n: BlockNode): n is SectionNode => n.type === 'section';
export const isFigure = (n: BlockNode): n is FigureNode => n.type === 'figure';
export const isTable = (n: BlockNode): n is TableNode => n.type === 'table';
export const isQuote = (n: BlockNode): n is QuoteNode => n.type === 'quote';

/** Nós inline que agrupam outros inline. */
export const temFilhosInline = (
  n: InlineNode,
): n is EmphasisNode | StrongNode | StrikeNode | LinkNode | InlineContainerNode =>
  n.type === 'emphasis' ||
  n.type === 'strong' ||
  n.type === 'strike' ||
  n.type === 'link' ||
  n.type === 'inline-container';
