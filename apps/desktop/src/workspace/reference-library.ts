import { exportarCslJson } from '@abnt/bibliography';
import type { BibliographicEntity, Registry } from '@abnt/document-model';
import { LIBRARY_PATH, readVaultLibrary } from '@abnt/workspace-environment';
import type { WorkspaceFile, WorkspaceStorage } from '@abnt/workspace-core';

export { LIBRARY_PATH, readVaultLibrary as readLibrary };

/**
 * Biblioteca gerenciada do vault (F6) — CSL-JSON no próprio vault,
 * `.bib`/RIS continuam import/export (F9). Local-first: o SQLite nunca vira
 * fonte canônica, só `references/library.json` é. Leitura (`readVaultLibrary`)
 * é compartilhada com `@abnt/workspace-environment` (F37 mescla a mesma
 * biblioteca na compilação) — só as mutações (upsert/remove) são exclusivas
 * do host desktop.
 */
async function findLibraryFile(storage: WorkspaceStorage): Promise<WorkspaceFile | undefined> {
  const files = await storage.list();
  return files.find((file) => String(file.path) === String(LIBRARY_PATH));
}

async function writeLibrary(storage: WorkspaceStorage, entries: Registry<BibliographicEntity>): Promise<void> {
  const content = exportarCslJson(entries);
  const file = await findLibraryFile(storage);
  if (file === undefined) {
    await storage.create({ path: LIBRARY_PATH, content });
    return;
  }
  const current = await storage.read(file.id);
  await storage.write({ fileId: file.id, content, expectedRevision: current.file.revision });
}

export async function replaceLibraryEntries(storage: WorkspaceStorage, entries: Registry<BibliographicEntity>): Promise<void> {
  await writeLibrary(storage, entries);
}

export async function upsertLibraryEntry(storage: WorkspaceStorage, id: string, entry: BibliographicEntity): Promise<void> {
  const entries = await readVaultLibrary(storage);
  await writeLibrary(storage, { ...entries, [id]: entry });
}

export async function removeLibraryEntry(storage: WorkspaceStorage, id: string): Promise<void> {
  const entries = await readVaultLibrary(storage);
  const rest = { ...entries };
  delete rest[id];
  await writeLibrary(storage, rest);
}
