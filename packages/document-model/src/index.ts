/**
 * @abnt/document-model — modelo semântico canônico.
 *
 * INVARIANTE: este package não importa nenhum outro package do workspace e não
 * conhece norma alguma (ABNT, APA, IEEE). Ele descreve o que o documento *é*,
 * nunca como deve aparecer. Fiscalizado em `pnpm check:boundaries`.
 *
 * Se você está prestes a adicionar algo daqui que menciona uma norma, um
 * tamanho de fonte, uma margem ou um número de seção resolvido — está na
 * camada errada. Ver docs/adr/0001.
 */

export type { NodeId, DocumentId, ReferenceId, ResourceId, NoteId } from './ids.js';
export {
  asNodeId,
  asDocumentId,
  asReferenceId,
  asResourceId,
  asNoteId,
  NodeIdFactory,
} from './ids.js';

export type { Diagnostic, Severidade } from './diagnostic.js';

export type { SourcePosition, SourceRange } from './source.js';
export { posicaoLegivel, IndiceDeLinhas } from './source.js';

export type {
  AttributeMap,
  Attribution,
  BlockNode,
  Caption,
  CitationItem,
  CitationMode,
  CitationNode,
  CodeBlockNode,
  CodeInlineNode,
  ContainerNode,
  CrossReferenceNode,
  CrossReferencePresentation,
  CrossReferenceTarget,
  EmbeddedContent,
  EmphasisNode,
  ExtensionMap,
  FigureContent,
  FigureNode,
  HardBreakNode,
  HeadingNode,
  ImageContent,
  InlineContainerNode,
  InlineNode,
  JsonValue,
  LinkNode,
  ListItemNode,
  ListNode,
  Locator,
  LocatorType,
  MathBlockNode,
  MathInlineNode,
  NodeBase,
  NoteReferenceNode,
  ParagraphNode,
  QuoteNode,
  SectionNode,
  SemanticRole,
  SoftBreakNode,
  StrikeNode,
  StrongNode,
  TableAlignment,
  TableCell,
  TableColumn,
  TableNode,
  TableRow,
  TextNode,
  ThematicBreakNode,
} from './nodes.js';
export {
  isCitation,
  isFigure,
  isInline,
  isParagraph,
  isQuote,
  isSection,
  isStrong,
  isTable,
  isText,
  temFilhosInline,
} from './nodes.js';

export type {
  AnyNode,
  BibliographicEntity,
  CslDate,
  CslDatePart,
  CslItemType,
  CslName,
  Contributor,
  ContributorRole,
  DocumentAst,
  DocumentDate,
  DocumentMetadata,
  DocumentNode,
  Note,
  PartialDate,
  PersonName,
  Registry,
  Resource,
  ResourceIntegrity,
  RichText,
} from './document.js';
export { indexarPorId, percorrer, percorrerTudo } from './document.js';

export {
  assertirDocumentAst,
  carregarDocumentAst,
  cslBibliographicEntityV1,
  documentAstV1,
  DocumentAstInvalido,
  gerarJsonSchema,
  migracoesRegistradas,
  SCHEMA_ID,
  SCHEMA_VERSION,
  validarDocumentAst,
  VersaoNaoSuportada,
} from './schema/index.js';
export type { Migracao, ProblemaDeValidacao, ResultadoDeValidacao } from './schema/index.js';
