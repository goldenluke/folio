/**
 * Tipos de domínio para o vault local-first.
 *
 * Um path é localização atual; FileId e DocumentId são identidade. A separação
 * impede que uma renomeação quebre abas, backlinks, cache ou futuras sessões.
 */

declare const workspaceBrand: unique symbol;

type Branded<T extends string> = string & { readonly [workspaceBrand]: T };

export type WorkspaceId = Branded<'WorkspaceId'>;
export type WorkspaceFileId = Branded<'WorkspaceFileId'>;
export type WorkspaceDocumentId = Branded<'WorkspaceDocumentId'>;
export type WorkspacePath = Branded<'WorkspacePath'>;
export type ContentHash = Branded<'ContentHash'>;

/** Versões persistidas do estado operacional do vault, independentes do índice SQLite. */
export const WORKSPACE_CONFIGURATION_SCHEMA_VERSION = 1 as const;
export const WORKSPACE_STATE_SCHEMA_VERSION = 1 as const;

export const asWorkspaceId = (value: string): WorkspaceId => value as WorkspaceId;
export const asWorkspaceFileId = (value: string): WorkspaceFileId => value as WorkspaceFileId;
export const asWorkspaceDocumentId = (value: string): WorkspaceDocumentId => value as WorkspaceDocumentId;
export const asWorkspacePath = (value: string): WorkspacePath => value as WorkspacePath;
export const asContentHash = (value: string): ContentHash => value as ContentHash;

/** Metadados observáveis de um arquivo; conteúdo continua no filesystem. */
export interface WorkspaceFile {
  readonly id: WorkspaceFileId;
  readonly documentId?: WorkspaceDocumentId;
  readonly path: WorkspacePath;
  readonly revision: number;
  readonly contentHash: ContentHash;
  readonly mediaType?: string;
}

export interface WorkspaceFileContent {
  readonly file: WorkspaceFile;
  readonly content: string;
}

/** Conteúdo binário de um recurso do vault; textos autorais continuam em `read`. */
export interface WorkspaceBinaryFileContent {
  readonly file: WorkspaceFile;
  readonly bytes: Uint8Array;
}

/** Configuração declarada pelo usuário; estado/índices derivados ficam separados. */
export interface WorkspaceConfiguration {
  readonly schema: 'abnt-workspace-config';
  readonly version: typeof WORKSPACE_CONFIGURATION_SCHEMA_VERSION;
  readonly defaultProfileId?: string;
  readonly ignoredPaths?: readonly WorkspacePath[];
}

export const DEFAULT_WORKSPACE_CONFIGURATION: WorkspaceConfiguration = {
  schema: 'abnt-workspace-config',
  version: WORKSPACE_CONFIGURATION_SCHEMA_VERSION,
  ignoredPaths: [],
};

export interface OpenWorkspaceResult {
  readonly workspaceId: WorkspaceId;
  readonly configuration: WorkspaceConfiguration;
  readonly files: readonly WorkspaceFile[];
}

export type WorkspaceEvent =
  | { readonly type: 'workspace:file-created'; readonly file: WorkspaceFile }
  | { readonly type: 'workspace:file-changed'; readonly file: WorkspaceFile }
  | {
      readonly type: 'workspace:file-renamed';
      readonly file: WorkspaceFile;
      readonly previousPath: WorkspacePath;
    }
  | { readonly type: 'workspace:file-removed'; readonly fileId: WorkspaceFileId; readonly path: WorkspacePath }
  | {
      readonly type: 'workspace:recovery-conflict';
      readonly fileId: WorkspaceFileId;
      readonly path: WorkspacePath;
      /** Caminho interno em `.academic`; não é um path publicável do vault. */
      readonly recoveryPath: string;
    };

export type WorkspaceEventListener = (event: WorkspaceEvent) => void;

export interface WriteWorkspaceFileRequest {
  readonly fileId: WorkspaceFileId;
  readonly content: string;
  /** Revisão apresentada ao usuário no editor; se divergir, o write falha. */
  readonly expectedRevision: number;
}

/** Cria um arquivo novo; falha com WorkspaceAlreadyExistsError se o path já existir. */
export interface CreateWorkspaceFileRequest {
  readonly path: WorkspacePath;
  readonly content: string;
}

/** Criação atômica de recurso não textual (imagem, PDF etc.). */
export interface CreateWorkspaceBinaryFileRequest {
  readonly path: WorkspacePath;
  readonly bytes: Uint8Array;
}

/** Overwrite atômico de recurso binário revisionado. */
export interface WriteWorkspaceBinaryFileRequest {
  readonly fileId: WorkspaceFileId;
  readonly bytes: Uint8Array;
  readonly expectedRevision: number;
}

export interface RenameWorkspaceFileRequest {
  readonly fileId: WorkspaceFileId;
  readonly path: WorkspacePath;
  readonly expectedRevision: number;
}

/** Registro persistido apenas para estabilizar identidade e revisão entre sessões. */
export interface PersistedWorkspaceFile {
  readonly id: WorkspaceFileId;
  readonly documentId?: WorkspaceDocumentId;
  readonly path: WorkspacePath;
  readonly revision: number;
  readonly contentHash: ContentHash;
  readonly mediaType?: string;
}

export interface WorkspaceState {
  readonly schema: 'abnt-workspace-state';
  readonly version: typeof WORKSPACE_STATE_SCHEMA_VERSION;
  readonly workspaceId: WorkspaceId;
  readonly files: Readonly<Record<string, PersistedWorkspaceFile>>;
}

export interface RecoveryRecord {
  readonly schema: 'abnt-workspace-recovery';
  readonly version: 1;
  readonly fileId: WorkspaceFileId;
  readonly path: WorkspacePath;
  readonly baseHash: ContentHash;
  readonly nextHash: ContentHash;
  readonly content: string;
}

export const isMarkdownPath = (path: WorkspacePath): boolean => /\.md$/iu.test(path);
