import { randomUUID } from 'node:crypto';
import {
  WorkspaceSyncRevisionConflictError,
  FULL_WORKSPACE_STORAGE_CAPABILITIES,
  asWorkspacePath,
  classifyWorkspaceSyncConflict,
  isPortableWorkspaceState,
  type WorkspaceFile,
  type WorkspaceStorage,
  type WorkspaceStateResource,
  type WorkspaceSyncAdapter,
  type WorkspaceSyncConflict,
  type WorkspaceSyncRecord,
  type WorkspaceSyncTombstone,
  type WorkspaceJsonValue,
  type WriteWorkspaceSyncRecordRequest,
} from '@abnt/workspace-core';

export type SyncStatus = 'synced' | 'pending' | 'conflict' | 'offline' | 'error';
export interface SyncProvider { readonly id: string; readonly label: string; readonly adapter: WorkspaceSyncAdapter; }
export interface DeviceIdentity { readonly id: string; readonly label: string; }
export interface SyncOperation { readonly record: WorkspaceSyncRecord; readonly expectedRevision?: string; }
export interface SyncConflictInboxItem { readonly id: string; readonly conflict: WorkspaceSyncConflict; readonly createdAt: string; }
export interface SyncResult { readonly status: SyncStatus; readonly applied: number; readonly conflicts: readonly SyncConflictInboxItem[]; }
export type SyncConflictResolution = 'keep-local' | 'use-mirror';

export interface ManualTextMergeResult { readonly content: string; readonly clean: boolean; }

/**
 * Merge conservador de três versões. Nunca escolhe silenciosamente uma edição
 * concorrente: sobreposição vira marcadores que o usuário precisa revisar.
 */
export function mergeTextThreeWay(base: string, local: string, remote: string): ManualTextMergeResult {
  if (local === remote) return { content: local, clean: true };
  if (local === base) return { content: remote, clean: true };
  if (remote === base) return { content: local, clean: true };
  return { content: `<<<<<<< local\n${local}\n=======\n${remote}\n>>>>>>> remoto\n`, clean: false };
}

export interface HttpSyncFetchResponse { readonly ok: boolean; readonly status: number; json(): Promise<unknown>; }
export type HttpSyncFetch = (input: string, init?: { readonly method?: string; readonly headers?: Readonly<Record<string, string>>; readonly body?: string }) => Promise<HttpSyncFetchResponse>;
export interface HttpSyncProviderOptions { readonly endpoint: string; readonly accessToken?: string; readonly fetch?: HttpSyncFetch; }
type RemoteRecord = { readonly key: string; readonly resource: WorkspaceStateResource; readonly revision: string; readonly contentHash: string; readonly contentKind: 'bytes' | 'text' | 'json'; readonly contentBase64?: string; readonly contentText?: string; readonly contentJson?: WorkspaceJsonValue; };

const bytesToBase64 = (bytes: Uint8Array): string => { let text = ''; for (const byte of bytes) text += String.fromCharCode(byte); return btoa(text); };
const base64ToBytes = (value: string): Uint8Array => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
const textEncoder = new TextEncoder();
const remoteRecord = (record: WorkspaceSyncRecord): RemoteRecord => record.content instanceof Uint8Array
  ? { key: record.key, resource: record.resource, revision: record.revision, contentHash: record.contentHash, contentKind: 'bytes', contentBase64: bytesToBase64(record.content) }
  : typeof record.content === 'string'
    ? { key: record.key, resource: record.resource, revision: record.revision, contentHash: record.contentHash, contentKind: 'text', contentText: record.content }
    : { key: record.key, resource: record.resource, revision: record.revision, contentHash: record.contentHash, contentKind: 'json', contentJson: record.content };
const recordFromRemote = (value: unknown): WorkspaceSyncRecord => {
  if (typeof value !== 'object' || value === null) throw new Error('Resposta de sync remota inválida.');
  const item = value as Partial<RemoteRecord>;
  if (typeof item.key !== 'string' || typeof item.resource !== 'string' || typeof item.revision !== 'string' || typeof item.contentHash !== 'string' || (item.contentKind !== 'bytes' && item.contentKind !== 'text' && item.contentKind !== 'json')) throw new Error('Registro de sync remoto inválido.');
  const content = item.contentKind === 'json'
    ? item.contentJson
    : item.contentKind === 'text'
      ? item.contentText
      : typeof item.contentBase64 === 'string' ? base64ToBytes(item.contentBase64) : undefined;
  if (content === undefined) throw new Error('Conteúdo de sync remoto inválido.');
  return { key: item.key, resource: item.resource as WorkspaceStateResource, revision: item.revision, contentHash: item.contentHash, content };
};

/** Primeiro provider de rede: REST simples, injetável e sem credencial no vault. */
export class HttpWorkspaceSyncAdapter implements WorkspaceSyncAdapter {
  readonly capabilities = FULL_WORKSPACE_STORAGE_CAPABILITIES;
  readonly #endpoint: string; readonly #token: string | undefined; readonly #fetch: HttpSyncFetch;
  constructor(options: HttpSyncProviderOptions) { this.#endpoint = options.endpoint.replace(/\/$/u, ''); this.#token = options.accessToken; this.#fetch = options.fetch ?? (globalThis.fetch as unknown as HttpSyncFetch); if (this.#endpoint === '' || this.#fetch === undefined) throw new Error('Provider HTTP exige endpoint e fetch.'); }
  async list(): Promise<readonly WorkspaceSyncRecord[]> { const value = await this.#request('/records'); if (!Array.isArray(value)) throw new Error('Lista de sync remota inválida.'); return value.map(recordFromRemote); }
  async read(key: string): Promise<WorkspaceSyncRecord | undefined> { const response = await this.#fetch(`${this.#endpoint}/records/${encodeURIComponent(key)}`, { headers: this.#headers() }); if (response.status === 404) return undefined; if (!response.ok) throw new Error(`Provider HTTP respondeu ${response.status}.`); return recordFromRemote(await response.json()); }
  async write(request: WriteWorkspaceSyncRecordRequest): Promise<WorkspaceSyncRecord> { const response = await this.#fetch(`${this.#endpoint}/records/${encodeURIComponent(request.key)}`, { method: 'PUT', headers: this.#headers(), body: JSON.stringify({ ...remoteRecord({ ...request, revision: '' }), ...(request.expectedRevision === undefined ? {} : { expectedRevision: request.expectedRevision }) }) }); if (!response.ok) throw new WorkspaceSyncRevisionConflictError(request.key, request.expectedRevision ?? 'atual', undefined); return recordFromRemote(await response.json()); }
  async listTombstones(): Promise<readonly WorkspaceSyncTombstone[]> { const value = await this.#request('/tombstones'); if (!Array.isArray(value)) throw new Error('Lista de tombstones remota inválida.'); return value.filter((item): item is WorkspaceSyncTombstone => typeof item === 'object' && item !== null && typeof (item as WorkspaceSyncTombstone).key === 'string' && typeof (item as WorkspaceSyncTombstone).revision === 'string' && typeof (item as WorkspaceSyncTombstone).deletedAt === 'string'); }
  #headers(): Readonly<Record<string, string>> { return { 'content-type': 'application/json', ...(this.#token === undefined ? {} : { authorization: `Bearer ${this.#token}` }) }; }
  async #request(path: string): Promise<unknown> { const response = await this.#fetch(`${this.#endpoint}${path}`, { headers: this.#headers() }); if (!response.ok) throw new Error(`Provider HTTP respondeu ${response.status}.`); return response.json(); }
}

/** Combina recursos autorais e operacionais sem fazer o engine conhecer paths ou filesystem. */
export class CompositeWorkspaceSyncAdapter implements WorkspaceSyncAdapter {
  readonly capabilities: WorkspaceStorage['capabilities'];
  readonly #routes: readonly { readonly accepts: (resource: WorkspaceStateResource) => boolean; readonly adapter: WorkspaceSyncAdapter }[];
  constructor(routes: readonly { readonly accepts: (resource: WorkspaceStateResource) => boolean; readonly adapter: WorkspaceSyncAdapter }[]) {
    if (routes.length === 0) throw new Error('Composite sync adapter exige ao menos uma rota.');
    this.#routes = routes;
    this.capabilities = routes[0]!.adapter.capabilities;
  }
  async list(): Promise<readonly WorkspaceSyncRecord[]> {
    const records = (await Promise.all(this.#routes.map(async (route) => route.adapter.list()))).flat();
    const keys = new Set<string>();
    for (const record of records) { const id = `${record.resource}:${record.key}`; if (keys.has(id)) throw new Error(`Registro de sync duplicado: ${id}.`); keys.add(id); }
    return records;
  }
  async read(key: string): Promise<WorkspaceSyncRecord | undefined> {
    for (const route of this.#routes) { const record = await route.adapter.read(key); if (record !== undefined) return record; }
    return undefined;
  }
  write(request: WriteWorkspaceSyncRecordRequest): Promise<WorkspaceSyncRecord> {
    const route = this.#routes.find((candidate) => candidate.accepts(request.resource));
    if (route === undefined) return Promise.reject(new Error(`Nenhuma rota de sync para ${request.resource}.`));
    return route.adapter.write(request);
  }
  async compareRevision(key: string, revision: string): Promise<boolean> {
    for (const route of this.#routes) { const record = await route.adapter.read(key); if (record !== undefined) return record.revision === revision; }
    return false;
  }
}
export const createDeviceIdentity = (label: string): DeviceIdentity => ({ id: randomUUID(), label: label.trim() || 'Dispositivo Folio' });
export const portableRecords = (records: readonly WorkspaceSyncRecord[]): readonly WorkspaceSyncRecord[] => records.filter((record) => record.resource === 'vault-content' || isPortableWorkspaceState(record.resource));
const isTextVaultFile = (file: WorkspaceFile): boolean => file.mediaType?.startsWith('text/') === true || file.mediaType === 'application/json' || /\.(?:md|markdown|bib|txt|json|ya?ml|csv|tsv|svg)$/iu.test(String(file.path));

/**
 * Bridges an opened vault to the sync contract without leaking filesystem
 * paths. The first concrete provider can therefore be another local vault
 * (for example a user-selected mirror folder) while the engine remains
 * provider-agnostic. Only authorial vault files cross this adapter.
 */
export class WorkspaceStorageSyncAdapter implements WorkspaceSyncAdapter {
  readonly capabilities: WorkspaceStorage['capabilities'];
  readonly #storage: WorkspaceStorage;

  constructor(storage: WorkspaceStorage) { this.#storage = storage; this.capabilities = storage.capabilities; }

  async list(): Promise<readonly WorkspaceSyncRecord[]> {
    return Promise.all((await this.#storage.list()).map((file) => this.#record(file)));
  }

  async read(key: string): Promise<WorkspaceSyncRecord | undefined> {
    const file = (await this.#storage.list()).find((candidate) => candidate.path === key);
    return file === undefined ? undefined : this.#record(file);
  }

  async write(request: WriteWorkspaceSyncRecordRequest): Promise<WorkspaceSyncRecord> {
    if (request.resource !== 'vault-content') throw new Error(`O adaptador de vault não aceita recurso operacional: ${request.resource}.`);
    if (!(request.content instanceof Uint8Array) && typeof request.content !== 'string') throw new Error('Conteúdo de vault deve ser texto ou bytes.');
    const existing = (await this.#storage.list()).find((file) => file.path === request.key);
    if (existing !== undefined && request.expectedRevision !== undefined && String(existing.revision) !== request.expectedRevision) {
      throw new WorkspaceSyncRevisionConflictError(request.key, request.expectedRevision, String(existing.revision));
    }
    const content = request.content instanceof Uint8Array ? request.content : new TextEncoder().encode(request.content);
    const file = existing === undefined
      ? await this.#create(request.key, content)
      : await this.#write(existing, content);
    return this.#record(file);
  }

  async compareRevision(key: string, revision: string): Promise<boolean> {
    return String((await this.#storage.list()).find((file) => file.path === key)?.revision) === revision;
  }

  async #record(file: WorkspaceFile): Promise<WorkspaceSyncRecord> {
    const binary = this.#storage.readBinary === undefined
      ? new TextEncoder().encode((await this.#storage.read(file.id)).content)
      : (await this.#storage.readBinary(file.id)).bytes;
    return { key: String(file.path), resource: 'vault-content', revision: String(file.revision), contentHash: String(file.contentHash), content: binary };
  }

  async #create(path: string, bytes: Uint8Array): Promise<WorkspaceFile> {
    if (this.#storage.createBinary !== undefined) return this.#storage.createBinary({ path: asWorkspacePath(path), bytes });
    return this.#storage.create({ path: asWorkspacePath(path), content: new TextDecoder().decode(bytes) });
  }

  async #write(file: WorkspaceFile, bytes: Uint8Array): Promise<WorkspaceFile> {
    if (this.#storage.writeBinary !== undefined) return this.#storage.writeBinary({ fileId: file.id, expectedRevision: file.revision, bytes });
    if (!isTextVaultFile(file)) throw new Error(`O provider não suporta sobrescrever recurso binário em ${file.path}.`);
    const text = new TextDecoder('utf-8', { fatal: true });
    try {
      return this.#storage.write({ fileId: file.id, expectedRevision: file.revision, content: text.decode(bytes) });
    } catch (error) {
      throw new Error(`O conteúdo textual recebido para ${file.path} não é UTF-8 válido.`, { cause: error });
    }
  }
}

/** Local queue keeps authoring usable while a provider is unavailable. */
export class OfflineSyncQueue {
  #operations: SyncOperation[] = [];
  enqueue(operation: SyncOperation): void { this.#operations = [...this.#operations.filter((item) => item.record.key !== operation.record.key), operation]; }
  list(): readonly SyncOperation[] { return this.#operations; }
  clear(keys: readonly string[]): void { const set = new Set(keys); this.#operations = this.#operations.filter((item) => !set.has(item.record.key)); }
}

export class SyncEngine {
  readonly #provider: SyncProvider;
  readonly queue = new OfflineSyncQueue();
  #status: SyncStatus = 'synced';
  #inbox: SyncConflictInboxItem[] = [];
  constructor(provider: SyncProvider) { this.#provider = provider; }
  status(): SyncStatus { return this.#status; }
  conflicts(): readonly SyncConflictInboxItem[] { return this.#inbox; }
  #appendConflicts(conflicts: readonly SyncConflictInboxItem[]): void {
    const known = new Set(this.#inbox.map((item) => `${item.conflict.kind}:${item.conflict.local.entity.id}:${item.conflict.remote.entity.id}`));
    this.#inbox = [...this.#inbox, ...conflicts.filter((item) => {
      const key = `${item.conflict.kind}:${item.conflict.local.entity.id}:${item.conflict.remote.entity.id}`;
      if (known.has(key)) return false;
      known.add(key);
      return true;
    })];
  }
  async sync(local: WorkspaceSyncAdapter): Promise<SyncResult> {
    this.#status = 'pending'; const conflicts: SyncConflictInboxItem[] = []; let applied = 0; let localRecords: readonly WorkspaceSyncRecord[] = [];
    try {
      localRecords = portableRecords(await local.list()); const remoteRecords = portableRecords(await this.#provider.adapter.list());
      const remoteByKey = new Map(remoteRecords.map((record) => [record.key, record]));
      const tombstones = this.#provider.adapter.listTombstones === undefined ? [] : await this.#provider.adapter.listTombstones();
      const tombstoneByKey = new Map(tombstones.map((item) => [item.key, item]));
      for (const record of localRecords) {
        const tombstone = tombstoneByKey.get(record.key);
        if (tombstone !== undefined) {
          const conflict = classifyWorkspaceSyncConflict({ entity: { kind: record.resource === 'vault-content' ? 'text' : 'workspace-state', id: record.key }, operation: 'upsert', revision: record.revision, contentHash: record.contentHash, path: record.key }, { entity: { kind: tombstone.resource === 'vault-content' ? 'text' : 'workspace-state', id: tombstone.key }, operation: 'delete', revision: tombstone.revision, path: tombstone.key });
          if (conflict !== undefined) { conflicts.push({ id: randomUUID(), conflict, createdAt: new Date().toISOString() }); continue; }
        }
        const remote = remoteByKey.get(record.key);
        if (remote !== undefined && remote.contentHash !== record.contentHash) {
          const conflict = classifyWorkspaceSyncConflict({ entity: { kind: record.resource === 'vault-content' ? 'text' : 'workspace-state', id: record.key }, operation: 'upsert', revision: record.revision, contentHash: record.contentHash, path: record.key }, { entity: { kind: remote.resource === 'vault-content' ? 'text' : 'workspace-state', id: remote.key }, operation: 'upsert', revision: remote.revision, contentHash: remote.contentHash, path: remote.key });
          if (conflict !== undefined) { conflicts.push({ id: randomUUID(), conflict, createdAt: new Date().toISOString() }); continue; }
        }
        await this.#provider.adapter.write({ key: record.key, resource: record.resource, contentHash: record.contentHash, content: record.content, ...(remote === undefined ? {} : { expectedRevision: remote.revision }) }); applied += 1;
      }
      const currentKeys = new Set(localRecords.map((record) => record.key));
      for (const operation of this.queue.list()) {
        // A varredura atual já publicou a versão mais recente dessa chave.
        if (currentKeys.has(operation.record.key)) continue;
        await this.#provider.adapter.write({ key: operation.record.key, resource: operation.record.resource, contentHash: operation.record.contentHash, content: operation.record.content, ...(operation.expectedRevision === undefined ? {} : { expectedRevision: operation.expectedRevision }) }); applied += 1;
      }
      this.queue.clear(this.queue.list().map((item) => item.record.key)); this.#appendConflicts(conflicts); this.#status = this.#inbox.length > 0 ? 'conflict' : 'synced'; return { status: this.#status, applied, conflicts: this.#inbox };
    } catch (error) {
      if (error instanceof WorkspaceSyncRevisionConflictError) {
        this.#status = 'conflict';
        return { status: this.#status, applied, conflicts: this.#inbox };
      }
      // Offline não bloqueia autoria: a próxima tentativa reaplica o snapshot
      // local mais recente de cada chave, sem acumular versões antigas.
      for (const record of localRecords) this.queue.enqueue({ record });
      this.#status = 'offline';
      return { status: this.#status, applied, conflicts: this.#inbox };
    }
  }
  /** Applies an explicit user choice; no conflict is ever resolved implicitly. */
  async resolveConflict(local: WorkspaceSyncAdapter, id: string, resolution: SyncConflictResolution): Promise<SyncResult> {
    const item = this.#inbox.find((candidate) => candidate.id === id);
    if (item === undefined) throw new Error('Conflito de sincronização não encontrado.');
    const key = item.conflict.local.path ?? item.conflict.local.entity.id;
    const [localRecord, remoteRecord] = await Promise.all([local.read(key), this.#provider.adapter.read(key)]);
    if (localRecord === undefined || remoteRecord === undefined) throw new Error('O conflito mudou antes de poder ser resolvido.');
    if (resolution === 'keep-local') {
      await this.#provider.adapter.write({ key, resource: localRecord.resource, contentHash: localRecord.contentHash, content: localRecord.content, expectedRevision: remoteRecord.revision });
    } else {
      await local.write({ key, resource: remoteRecord.resource, contentHash: remoteRecord.contentHash, content: remoteRecord.content, expectedRevision: localRecord.revision });
    }
    this.#inbox = this.#inbox.filter((candidate) => candidate.id !== id);
    this.#status = this.#inbox.length === 0 ? 'synced' : 'conflict';
    return { status: this.#status, applied: 1, conflicts: this.#inbox };
  }
  /** Persiste texto revisado pelo usuário depois de um conflito; não tenta inferir o merge. */
  async resolveTextConflict(local: WorkspaceSyncAdapter, id: string, mergedContent: string): Promise<SyncResult> {
    const item = this.#inbox.find((candidate) => candidate.id === id);
    if (item === undefined || item.conflict.resolution !== 'manual-text-merge') throw new Error('Conflito de texto não encontrado.');
    const key = item.conflict.local.path ?? item.conflict.local.entity.id;
    const [localRecord, remoteRecord] = await Promise.all([local.read(key), this.#provider.adapter.read(key)]);
    if (localRecord === undefined || remoteRecord === undefined) throw new Error('O conflito mudou antes de poder ser mesclado.');
    const content = textEncoder.encode(mergedContent);
    const contentHash = `manual:${content.length}:${mergedContent}`;
    const saved = await local.write({ key, resource: 'vault-content', contentHash, content, expectedRevision: localRecord.revision });
    await this.#provider.adapter.write({ key, resource: saved.resource, contentHash: saved.contentHash, content: saved.content, expectedRevision: remoteRecord.revision });
    this.#inbox = this.#inbox.filter((candidate) => candidate.id !== id);
    this.#status = this.#inbox.length === 0 ? 'synced' : 'conflict';
    return { status: this.#status, applied: 1, conflicts: this.#inbox };
  }
  /** Recovery rebuilds a local adapter from remote portable state; no automatic delete. */
  async recover(local: WorkspaceSyncAdapter): Promise<number> { let restored = 0; for (const record of portableRecords(await this.#provider.adapter.list())) { const previous = await local.read(record.key); await local.write({ key: record.key, resource: record.resource, contentHash: record.contentHash, content: record.content, ...(previous === undefined ? {} : { expectedRevision: previous.revision }) }); restored += 1; } return restored; }
}
