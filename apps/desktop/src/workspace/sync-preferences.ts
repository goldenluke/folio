import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/** Preferência estritamente local: nunca entra no adapter de sync nem no vault autoral. */
export interface LocalSyncPreference { readonly version: 1; readonly mirrorRootPath: string; }

const pathFor = (rootPath: string): string => join(rootPath, '.academic', 'local', 'sync-preference.json');

export async function readLocalSyncPreference(rootPath: string): Promise<LocalSyncPreference | undefined> {
  try {
    const value: unknown = JSON.parse(await readFile(pathFor(rootPath), 'utf8'));
    if (typeof value !== 'object' || value === null || (value as { version?: unknown }).version !== 1 || typeof (value as { mirrorRootPath?: unknown }).mirrorRootPath !== 'string' || (value as { mirrorRootPath: string }).mirrorRootPath.trim() === '') return undefined;
    return { version: 1, mirrorRootPath: (value as { mirrorRootPath: string }).mirrorRootPath };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

export async function writeLocalSyncPreference(rootPath: string, preference: LocalSyncPreference): Promise<void> {
  const path = pathFor(rootPath); await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`; await writeFile(temporary, `${JSON.stringify(preference)}\n`, 'utf8'); await rename(temporary, path);
}
