/**
 * @abnt/publication — ResolvedDocument + profile -> Publication AST.
 *
 * Define a interface `PublicationProfile`; não implementa norma nenhuma.
 * `@abnt/standards` implementa a interface para ABNT. Esta inversão é o que
 * mantém o compilador sem conhecimento de norma e permite mais de um profile.
 */

export type {
  PagePolicy,
  PublicationBlock,
  PublicationCaption,
  PublicationCode,
  PublicationDocument,
  PublicationFigure,
  PublicationFrontMatterBlock,
  PublicationHeading,
  PublicationInline,
  PublicationLink,
  PublicationList,
  PublicationListItem,
  PublicationMarked,
  PublicationMath,
  PublicationMathBlock,
  PublicationNote,
  PublicationNoteMark,
  PublicationParagraph,
  PublicationQuote,
  PublicationTable,
  PublicationTableCell,
  PublicationTableRow,
  PublicationText,
  PublicationThematicBreak,
  PublicationToc,
  PublicationTocEntry,
  StyleDefinition,
  StyleToken,
  StyleTokenRegistry,
} from './model.js';

export type {
  ContextoDeCitacao,
  MotorDeCitacao,
  PublicationProfile,
  ResultadoDeCitacao,
  TipoDeLegenda,
  TokensDoProfile,
  UtilitariosDoProfile,
} from './profile.js';
export { motorDeCitacaoProvisorio } from './profile.js';

export { compilarPublicacao, textoPuro } from './compile.js';
export type { OpcoesDeCompilacaoDePublicacao } from './compile.js';
