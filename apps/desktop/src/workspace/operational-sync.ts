import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import {
  FULL_WORKSPACE_STORAGE_CAPABILITIES,
  WorkspaceSyncRevisionConflictError,
  type WorkspaceJsonValue,
  type WorkspaceStateResource,
  type WorkspaceSyncAdapter,
  type WorkspaceSyncRecord,
  type WriteWorkspaceSyncRecordRequest,
} from '@abnt/workspace-core';

const contentHash = (content: string): string => `sha256:${createHash('sha256').update(content).digest('hex')}`;

/** Uma entrada operacional versionada, armazenada fora da árvore autoral. */
export class JsonOperationalSyncAdapter implements WorkspaceSyncAdapter {
  readonly capabilities = FULL_WORKSPACE_STORAGE_CAPABILITIES;
  readonly #resource: WorkspaceStateResource;
  readonly #key: string;
  readonly #filePath: string;
  constructor(rootPath: string, resource: WorkspaceStateResource, key: string, directory: readonly string[] = ['.academic', 'operational']) {
    this.#resource = resource;
    this.#key = key;
    this.#filePath = join(rootPath, ...directory, `${resource}-${key}.json`);
  }
  async list(): Promise<readonly WorkspaceSyncRecord[]> { const record = await this.read(this.#key); return record === undefined ? [] : [record]; }
  async read(key: string): Promise<WorkspaceSyncRecord | undefined> {
    if (key !== this.#key) return undefined;
    try {
      const raw = await readFile(this.#filePath, 'utf8');
      const content = JSON.parse(raw) as WorkspaceJsonValue;
      return { key, resource: this.#resource, revision: contentHash(raw), contentHash: contentHash(raw), content };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      throw error;
    }
  }
  async write(request: WriteWorkspaceSyncRecordRequest): Promise<WorkspaceSyncRecord> {
    if (request.key !== this.#key || request.resource !== this.#resource || request.content instanceof Uint8Array) throw new Error('Registro operacional inválido.');
    const current = await this.read(this.#key);
    if (request.expectedRevision !== undefined && current?.revision !== request.expectedRevision) throw new WorkspaceSyncRevisionConflictError(this.#key, request.expectedRevision, current?.revision);
    const raw = `${JSON.stringify(request.content, null, 2)}\n`;
    await mkdir(dirname(this.#filePath), { recursive: true });
    const temporary = `${this.#filePath}.tmp`;
    await writeFile(temporary, raw, 'utf8'); await rename(temporary, this.#filePath);
    return { key: this.#key, resource: this.#resource, revision: contentHash(raw), contentHash: contentHash(raw), content: request.content };
  }
}
