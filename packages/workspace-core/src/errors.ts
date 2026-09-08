import type { WorkspaceFileId, WorkspacePath } from './model.js';

export class WorkspaceError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'WorkspaceError';
  }
}

export class WorkspaceFileNotFoundError extends WorkspaceError {
  constructor(readonly fileId: WorkspaceFileId) {
    super('WORKSPACE_FILE_NOT_FOUND', `Arquivo de workspace não encontrado: ${fileId}.`);
    this.name = 'WorkspaceFileNotFoundError';
  }
}

export class WorkspaceConflictError extends WorkspaceError {
  constructor(
    readonly fileId: WorkspaceFileId,
    readonly expectedRevision: number,
    readonly actualRevision: number,
  ) {
    super(
      'WORKSPACE_CONFLICT',
      `O arquivo ${fileId} mudou fora desta sessão (esperado r${expectedRevision}, atual r${actualRevision}).`,
    );
    this.name = 'WorkspaceConflictError';
  }
}

export class WorkspacePathError extends WorkspaceError {
  constructor(readonly path: WorkspacePath, message: string) {
    super('WORKSPACE_INVALID_PATH', message);
    this.name = 'WorkspacePathError';
  }
}

export class WorkspaceAlreadyExistsError extends WorkspaceError {
  constructor(readonly path: WorkspacePath) {
    super('WORKSPACE_PATH_EXISTS', `Já existe um arquivo em ${path}.`);
    this.name = 'WorkspaceAlreadyExistsError';
  }
}
