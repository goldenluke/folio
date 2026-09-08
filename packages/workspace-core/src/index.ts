/**
 * @abnt/workspace-core — domínio do vault local-first, sem I/O ou UI.
 *
 * `workspace-local` é o adaptador filesystem. Editor, CLI e sync dependem da
 * interface `WorkspaceStorage`, não da implementação Node.
 */

export {
  DEFAULT_WORKSPACE_CONFIGURATION,
  WORKSPACE_CONFIGURATION_SCHEMA_VERSION,
  WORKSPACE_STATE_SCHEMA_VERSION,
  asContentHash,
  asWorkspaceDocumentId,
  asWorkspaceFileId,
  asWorkspaceId,
  asWorkspacePath,
  isMarkdownPath,
} from './model.js';
export type {
  ContentHash,
  CreateWorkspaceBinaryFileRequest,
  CreateWorkspaceFileRequest,
  OpenWorkspaceResult,
  PersistedWorkspaceFile,
  RecoveryRecord,
  RenameWorkspaceFileRequest,
  WorkspaceConfiguration,
  WorkspaceDocumentId,
  WorkspaceEvent,
  WorkspaceEventListener,
  WorkspaceFile,
  WorkspaceBinaryFileContent,
  WorkspaceFileContent,
  WorkspaceFileId,
  WorkspaceId,
  WorkspacePath,
  WorkspaceState,
  WriteWorkspaceFileRequest,
} from './model.js';

export {
  WorkspaceAlreadyExistsError,
  WorkspaceConflictError,
  WorkspaceError,
  WorkspaceFileNotFoundError,
  WorkspacePathError,
} from './errors.js';

export type { WorkspaceStorage } from './storage.js';
