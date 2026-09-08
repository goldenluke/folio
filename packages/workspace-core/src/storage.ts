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
 * Contrato de armazenamento do vault. Não expõe fs, paths absolutos nem Node:
 * a implementação local, sync ou criptografada pode mudar sem mover o editor.
 */
export interface WorkspaceStorage {
  open(): Promise<OpenWorkspaceResult>;
  close(): Promise<void>;
  list(path?: WorkspacePath): Promise<readonly WorkspaceFile[]>;
  read(fileId: WorkspaceFileId): Promise<WorkspaceFileContent>;
  /** Backends locais podem expor recursos binários sem transformar bytes em texto. */
  readBinary?(fileId: WorkspaceFileId): Promise<import('./model.js').WorkspaceBinaryFileContent>;
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
