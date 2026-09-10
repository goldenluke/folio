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
  WriteWorkspaceBinaryFileRequest,
  WriteWorkspaceFileRequest,
} from './model.js';

export {
  WorkspaceAlreadyExistsError,
  WorkspaceConflictError,
  WorkspaceError,
  WorkspaceFileNotFoundError,
  WorkspacePathError,
} from './errors.js';

export {
  FULL_WORKSPACE_STORAGE_CAPABILITIES,
  supportsWorkspaceStorageCapabilities,
} from './storage.js';
export type { WorkspaceStorage, WorkspaceStorageCapabilities } from './storage.js';

export {
  PORTABLE_WORKSPACE_STATE_SCHEMA,
  PORTABLE_WORKSPACE_STATE_VERSION,
  WORKSPACE_STATE_POLICIES,
  InMemoryWorkspaceSyncAdapter,
  WorkspaceSyncRevisionConflictError,
  classifyWorkspaceSyncConflict,
  classifyWorkspaceSyncConflicts,
  createPortableWorkspaceState,
  isPortableWorkspaceState,
  replicateWorkspaceSyncRecord,
  workspaceStatePolicy,
} from './sync.js';
export type {
  DeleteWorkspaceSyncRecordRequest,
  PortableWorkspaceState,
  PortableWorkspaceStateEntry,
  RenameWorkspaceSyncRecordRequest,
  WorkspaceJsonValue,
  WorkspaceStateClassification,
  WorkspaceStatePolicy,
  WorkspaceStateResource,
  WorkspaceSyncAdapter,
  WorkspaceSyncChange,
  WorkspaceSyncConflict,
  WorkspaceSyncConflictKind,
  WorkspaceSyncContent,
  WorkspaceSyncEntityKind,
  WorkspaceSyncEvent,
  WorkspaceSyncEventListener,
  WorkspaceSyncOperation,
  WorkspaceSyncPollResult,
  WorkspaceSyncRecord,
  WorkspaceSyncTombstone,
  WriteWorkspaceSyncRecordRequest,
} from './sync.js';
