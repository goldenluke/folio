/**
 * @abnt/language-service — operações editoriais sobre a fonte e o índice.
 *
 * Não conhece CodeMirror, Electron ou normas. Desktop, LSP e CLI de inspeção
 * podem consumir o mesmo contrato de outline, navegação e autocomplete.
 */

export { WorkspaceLanguageService, documentTarget } from './language-service.js';
export { parseStructuredQuery, executeStructuredQuery } from './query.js';
export type { QueryAst, QueryTerm, StructuredQueryBackend } from './query.js';
export type {
  LanguageBacklink,
  LanguageCompletionItem,
  LanguageCrossReferenceTarget,
  LanguageCompletionKind,
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
  LanguageUnlinkedMention,
  LanguageWritingStatistics,
  LanguageWritingSection,
  LanguageWorkspaceEdit,
} from './model.js';
