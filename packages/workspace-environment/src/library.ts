import { importarCslJson } from '@abnt/bibliography';
import type { BibliographicEntity, Registry } from '@abnt/document-model';
import { asWorkspacePath, type WorkspacePath, type WorkspaceStorage } from '@abnt/workspace-core';

/**
 * Biblioteca gerenciada do vault (F6/F37) — CSL-JSON em `references/library.json`,
 * sempre disponível para qualquer documento citar, sem exigir `bibliography:`
 * no frontmatter. Path compartilhado entre o resolvedor de ambiente (leitura,
 * usado por compilação) e o host desktop (CRUD, ver
 * `apps/desktop/src/workspace/reference-library.ts`) para nunca divergir.
 */
export const LIBRARY_PATH: WorkspacePath = asWorkspacePath('references/library.json');

export async function readVaultLibrary(storage: WorkspaceStorage): Promise<Registry<BibliographicEntity>> {
  const files = await storage.list();
  const file = files.find((candidate) => String(candidate.path) === String(LIBRARY_PATH));
  if (file === undefined) return {};
  const { content } = await storage.read(file.id);
  return importarCslJson(content).references;
}
