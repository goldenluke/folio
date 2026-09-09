/**
 * @abnt/workspace-sessions — camada headless de sessões revisionadas.
 *
 * Coordena WorkspaceStorage e CompilerService, mas não importa filesystem,
 * Electron, React ou o domínio do compilador. É reutilizável por desktop, CLI
 * de watch e language service.
 */

export { criarResolvedorDeAmbienteVazio, DocumentSessionsService } from './document-sessions.js';
export type {
  CompilationEnvironmentRequest,
  CompilationEnvironmentResolver,
  CompilationSourceExpansion,
  CompilationSourceExpansionRequest,
  CompileDocumentSessionOptions,
  ProfileEvaluation,
  DocumentSessionChangeOrigin,
  DocumentSessionEvent,
  DocumentSessionEventListener,
  ExternalConflictResolution,
  DocumentSessionId,
  DocumentSessionPreview,
  DocumentSessionRevision,
  DocumentSessionSnapshot,
  DocumentSessionStatus,
  DocumentSessions,
  DocumentSessionsOptions,
  SessionContentHasher,
} from './model.js';
