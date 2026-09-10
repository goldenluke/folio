import type {
  CreateWorkspaceFileRequest,
  OpenWorkspaceResult,
  RenameWorkspaceFileRequest,
  WorkspaceConfiguration,
  WorkspaceEventListener,
  WorkspaceFile,
  WorkspaceFileContent,
  WorkspaceFileId,
  WorkspacePath,
  WriteWorkspaceFileRequest,
} from './model.js';

/**
 * Garantias declaradas por um backend de vault. Código de domínio decide pelo
 * contrato, nunca por `instanceof` de uma implementação local/remota.
 */
export interface WorkspaceStorageCapabilities {
  readonly atomicWrite: boolean;
  readonly atomicRename: boolean;
  readonly watch: boolean;
  readonly binaryRead: boolean;
  readonly binaryWrite: boolean;
  readonly conditionalWrite: boolean;
  readonly revisionCompare: boolean;
}

/** Garantias completas oferecidas pelo adaptador filesystem local atual. */
export const FULL_WORKSPACE_STORAGE_CAPABILITIES: WorkspaceStorageCapabilities = {
  atomicWrite: true,
  atomicRename: true,
  watch: true,
  binaryRead: true,
  binaryWrite: true,
  conditionalWrite: true,
  revisionCompare: true,
};

export function supportsWorkspaceStorageCapabilities(
  capabilities: WorkspaceStorageCapabilities,
  required: Partial<WorkspaceStorageCapabilities>,
): boolean {
  return Object.entries(required).every(([key, value]) => value !== true || capabilities[key as keyof WorkspaceStorageCapabilities]);
}

/**
 * Contrato de armazenamento do vault. Não expõe fs, paths absolutos nem Node:
 * a implementação local, sync ou criptografada pode mudar sem mover o editor.
 */
export interface WorkspaceStorage {
  readonly capabilities: WorkspaceStorageCapabilities;
  open(): Promise<OpenWorkspaceResult>;
  close(): Promise<void>;
  list(path?: WorkspacePath): Promise<readonly WorkspaceFile[]>;
  read(fileId: WorkspaceFileId): Promise<WorkspaceFileContent>;
  /** Backends locais podem expor recursos binários sem transformar bytes em texto. */
  readBinary?(fileId: WorkspaceFileId): Promise<import('./model.js').WorkspaceBinaryFileContent>;
  writeBinary?(request: import('./model.js').WriteWorkspaceBinaryFileRequest): Promise<WorkspaceFile>;
  write(request: WriteWorkspaceFileRequest): Promise<WorkspaceFile>;
  /** Cria um arquivo que ainda não existe no vault; nunca sobrescreve. */
  create(request: CreateWorkspaceFileRequest): Promise<WorkspaceFile>;
  /** Cria um recurso binário; opcional para backends que ainda só tratam texto. */
  createBinary?(request: import('./model.js').CreateWorkspaceBinaryFileRequest): Promise<WorkspaceFile>;
  rename(request: RenameWorkspaceFileRequest): Promise<WorkspaceFile>;
  configuration(): Promise<WorkspaceConfiguration>;
  updateConfiguration(configuration: WorkspaceConfiguration): Promise<void>;
  /** Reconcilição explícita para testes, CLI e hosts sem watcher ativo. */
  refresh(): Promise<readonly WorkspaceFile[]>;
  subscribe(listener: WorkspaceEventListener): () => void;
}
