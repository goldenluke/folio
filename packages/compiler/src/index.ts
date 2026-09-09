/**
 * @abnt/compiler — orquestrador headless do pipeline semântico.
 *
 * Não lê arquivos, não renderiza e não importa Electron/React. O host fornece
 * SourceSnapshot e CompilationEnvironment; o resultado termina em Publication AST.
 */

export { authoredDependencies, criarCompiler } from './compiler.js';
export type { CompilerOptions } from './compiler.js';
export { criarServicoDeCompiler, resolvedDocumentParaDto } from './protocol.js';
export { profileManifests } from './profiles.js';
export type { InstitutionalProfileComposition, PublicationProfileCapability, PublicationProfileManifest, PublicationProfileRuleManifest } from './model.js';
export {
  PERFIL_PADRAO,
  PERFIS_PADRAO,
  REGISTRO_DE_PERFIS_PADRAO,
  publicationProfiles,
} from './profiles.js';
export type {
  AuthoredDependencies,
  BibliographyEnvironment,
  BibliographyProvenance,
  BibliographySource,
  BibliographySourceFormat,
  CompilationConfiguration,
  CompilationEnvironment,
  CompilationProfileDefinition,
  CompilationProfileRegistry,
  CompilationRequest,
  CompilationResult,
  CompilationUnit,
  ContentHash,
  DependencySnapshot,
  EnvironmentPreparation,
  HeadlessCompiler,
  PreparedCompilation,
  ResourceResolution,
  SourceSnapshot,
} from './model.js';
export { asContentHash } from './model.js';
