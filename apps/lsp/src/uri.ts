import { URI } from 'vscode-uri';

import { asWorkspacePath, type WorkspacePath } from '@abnt/workspace-core';

/**
 * Converte entre `file://` (identidade do lado do cliente LSP) e o caminho
 * vault-relativo que `WorkspaceStorage`/`WorkspaceFileId` usam. Um único
 * lugar para essa conversão — o resto do adapter nunca monta uma URI à mão.
 */
export function pathFromUri(rootPath: string, uri: string): WorkspacePath | undefined {
  const fsPath = URI.parse(uri).fsPath;
  const rootWithSlash = rootPath.endsWith('/') ? rootPath : `${rootPath}/`;
  if (!fsPath.startsWith(rootWithSlash)) return undefined;
  const relative = fsPath.slice(rootWithSlash.length).split(/[\\/]/u).join('/');
  return relative === '' ? undefined : asWorkspacePath(relative);
}

export function uriFromPath(rootPath: string, path: WorkspacePath | string): string {
  const rootWithSlash = rootPath.endsWith('/') ? rootPath : `${rootPath}/`;
  return URI.file(`${rootWithSlash}${String(path)}`).toString();
}
