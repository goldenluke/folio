import { watch, type FSWatcher } from 'node:fs';
import {
  lstat,
  mkdir,
  open,
  readdir,
  readFile,
  rename as renameOnDisk,
  rm,
  stat,
} from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';

import {
  DEFAULT_WORKSPACE_CONFIGURATION,
  WORKSPACE_CONFIGURATION_SCHEMA_VERSION,
  WORKSPACE_STATE_SCHEMA_VERSION,
  WorkspaceAlreadyExistsError,
  WorkspaceConflictError,
  WorkspaceFileNotFoundError,
  WorkspacePathError,
  asContentHash,
  asWorkspaceDocumentId,
  asWorkspaceFileId,
  asWorkspaceId,
  asWorkspacePath,
  isMarkdownPath,
  type ContentHash,
  type CreateWorkspaceBinaryFileRequest,
  type CreateWorkspaceFileRequest,
  type OpenWorkspaceResult,
  type PersistedWorkspaceFile,
  type RecoveryRecord,
  type RenameWorkspaceFileRequest,
  type WorkspaceConfiguration,
  type WorkspaceEvent,
  type WorkspaceEventListener,
  type WorkspaceFile,
  type WorkspaceFileContent,
  type WorkspaceFileId,
  type WorkspacePath,
  type WorkspaceState,
  type WorkspaceStorage,
  type WriteWorkspaceFileRequest,
} from '@abnt/workspace-core';

const META_DIRECTORY = '.academic';
const STATE_FILE = 'workspace-state.json';
const CONFIG_FILE = 'workspace-config.json';
const RECOVERY_DIRECTORY = 'recovery';

const hashContent = (content: string | Uint8Array): ContentHash =>
  asContentHash(`sha256:${createHash('sha256').update(content).digest('hex')}`);

const isMissing = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const mediaTypeFor = (path: WorkspacePath): string | undefined => {
  const lower = path.toLowerCase();
  if (lower.endsWith('.md')) return 'text/markdown';
  if (lower.endsWith('.bib')) return 'application/x-bibtex';
  if (lower.endsWith('.json')) return 'application/json';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  return undefined;
};

/** Normaliza paths internos para POSIX e nunca permite escapar do vault. */
export function normalizeWorkspacePath(value: string): WorkspacePath {
  const source = value.replace(/\\/gu, '/');
  if (source.length === 0 || isAbsolute(source)) {
    throw new WorkspacePathError(asWorkspacePath(value), `Path de workspace inválido: ${value}.`);
  }

  const parts = source.split('/').filter((part) => part !== '' && part !== '.');
  if (parts.some((part) => part === '..')) {
    throw new WorkspacePathError(asWorkspacePath(value), `Path não pode escapar do vault: ${value}.`);
  }
  if (parts.length === 0 || parts[0] === META_DIRECTORY) {
    throw new WorkspacePathError(asWorkspacePath(value), `Path reservado ou vazio: ${value}.`);
  }
  return asWorkspacePath(parts.join('/'));
}

const fileFromRecord = (record: PersistedWorkspaceFile): WorkspaceFile => ({
  id: record.id,
  ...(record.documentId !== undefined ? { documentId: record.documentId } : {}),
  path: record.path,
  revision: record.revision,
  contentHash: record.contentHash,
  ...(record.mediaType !== undefined ? { mediaType: record.mediaType } : {}),
});

interface ScannedFile {
  readonly path: WorkspacePath;
  readonly contentHash: ContentHash;
  readonly mediaType?: string;
}

/** Implementação Node do vault; o package core não conhece filesystem. */
export class LocalFilesystemStorage implements WorkspaceStorage {
  readonly #root: string;
  readonly #records = new Map<WorkspaceFileId, PersistedWorkspaceFile>();
  readonly #listeners = new Set<WorkspaceEventListener>();
  #workspaceId: ReturnType<typeof asWorkspaceId> | undefined;
  #configuration: WorkspaceConfiguration = DEFAULT_WORKSPACE_CONFIGURATION;
  #watchers: FSWatcher[] = [];
  #watcherIsRecursive = false;
  #watchStarted = false;
  #refreshTimer: ReturnType<typeof setTimeout> | undefined;
  readonly #refreshOperations = new Set<Promise<readonly WorkspaceFile[]>>();
  #lifecycleGeneration = 0;
  #closing = false;
  #opened = false;
  #writeSequence = 0;

  constructor(root: string) {
    this.#root = resolve(root);
  }

  static create(root: string): LocalFilesystemStorage {
    return new LocalFilesystemStorage(root);
  }

  async open(): Promise<OpenWorkspaceResult> {
    if (this.#opened) {
      return {
        workspaceId: this.#requireWorkspaceId(),
        configuration: this.#configuration,
        files: await this.list(),
      };
    }

    const root = await stat(this.#root).catch((error: unknown) => {
      if (isMissing(error)) throw new Error(`Vault inexistente: ${this.#root}.`);
      throw error;
    });
    if (!root.isDirectory()) throw new Error(`Vault não é diretório: ${this.#root}.`);

    await mkdir(this.#metaPath(), { recursive: true });
    await mkdir(this.#recoveryDirectory(), { recursive: true });
    this.#configuration = await this.#loadConfiguration();
    const state = await this.#loadState();
    this.#workspaceId = state?.workspaceId ?? asWorkspaceId(`workspace_${randomUUID()}`);
    for (const record of Object.values(state?.files ?? {})) this.#records.set(record.id, record);

    await this.#recoverPendingWrites();
    this.#opened = true;
    await this.refresh();
    await this.#startWatchers();

    return {
      workspaceId: this.#requireWorkspaceId(),
      configuration: this.#configuration,
      files: await this.list(),
    };
  }

  async close(): Promise<void> {
    if (!this.#opened || this.#closing) return;
    this.#closing = true;
    this.#lifecycleGeneration += 1;
    if (this.#refreshTimer !== undefined) clearTimeout(this.#refreshTimer);
    this.#refreshTimer = undefined;
    this.#stopWatchers();
    await Promise.all([...this.#refreshOperations]);
    this.#watchStarted = false;
    this.#opened = false;
    this.#closing = false;
  }

  async list(prefix?: WorkspacePath): Promise<readonly WorkspaceFile[]> {
    this.#requireOpen();
    const normalized = prefix === undefined ? undefined : normalizeWorkspacePath(String(prefix));
    return [...this.#records.values()]
      .filter((record) => !this.#isIgnored(record.path))
      .filter((record) => normalized === undefined || record.path === normalized || record.path.startsWith(`${normalized}/`))
      .map(fileFromRecord)
      .sort((a, b) => a.path.localeCompare(b.path));
  }

  async read(fileId: WorkspaceFileId): Promise<WorkspaceFileContent> {
    this.#requireOpen();
    const record = this.#record(fileId);
    const absolute = this.#absolutePath(record.path);
    let bytes: Uint8Array;
    try {
      bytes = await readFile(absolute);
    } catch (error) {
      if (!isMissing(error)) throw error;
      await this.#removeMissingRecord(record);
      throw new WorkspaceFileNotFoundError(fileId);
    }

    const currentHash = hashContent(bytes);
    const current = currentHash === record.contentHash ? record : await this.#recordExternalChange(record, currentHash);
    return { file: fileFromRecord(current), content: Buffer.from(bytes).toString('utf8') };
  }

  async readBinary(fileId: WorkspaceFileId): Promise<import('@abnt/workspace-core').WorkspaceBinaryFileContent> {
    this.#requireOpen();
    const record = this.#record(fileId);
    let bytes: Uint8Array;
    try {
      bytes = await readFile(this.#absolutePath(record.path));
    } catch (error) {
      if (!isMissing(error)) throw error;
      await this.#removeMissingRecord(record);
      throw new WorkspaceFileNotFoundError(fileId);
    }
    const currentHash = hashContent(bytes);
    const current = currentHash === record.contentHash ? record : await this.#recordExternalChange(record, currentHash);
    return { file: fileFromRecord(current), bytes };
  }

  async write(request: WriteWorkspaceFileRequest): Promise<WorkspaceFile> {
    this.#requireOpen();
    const record = this.#record(request.fileId);
    await this.#assertWritable(record, request.expectedRevision);

    const nextHash = hashContent(request.content);
    const recovery: RecoveryRecord = {
      schema: 'abnt-workspace-recovery',
      version: 1,
      fileId: record.id,
      path: record.path,
      baseHash: record.contentHash,
      nextHash,
      content: request.content,
    };
    const recoveryPath = this.#recoveryPath(record.id);
    await this.#writeJsonAtomically(recoveryPath, recovery);
    await this.#writeTextAtomically(this.#absolutePath(record.path), request.content);

    const next: PersistedWorkspaceFile = {
      ...record,
      revision: record.revision + 1,
      contentHash: nextHash,
    };
    this.#records.set(next.id, next);
    await this.#persistState();
    await rm(recoveryPath, { force: true });
    this.#emit({ type: 'workspace:file-changed', file: fileFromRecord(next) });
    return fileFromRecord(next);
  }

  async create(request: CreateWorkspaceFileRequest): Promise<WorkspaceFile> {
    this.#requireOpen();
    const path = normalizeWorkspacePath(String(request.path));
    const destination = this.#absolutePath(path);
    const destinationExists = await lstat(destination)
      .then(() => true)
      .catch((error: unknown) => {
        if (isMissing(error)) return false;
        throw error;
      });
    if (destinationExists) throw new WorkspaceAlreadyExistsError(path);

    await this.#writeTextAtomically(destination, request.content);
    const mediaType = mediaTypeFor(path);
    const record = this.#newRecord({
      path,
      contentHash: hashContent(request.content),
      ...(mediaType !== undefined ? { mediaType } : {}),
    });
    this.#records.set(record.id, record);
    await this.#persistState();
    this.#emit({ type: 'workspace:file-created', file: fileFromRecord(record) });
    return fileFromRecord(record);
  }

  async createBinary(request: CreateWorkspaceBinaryFileRequest): Promise<WorkspaceFile> {
    this.#requireOpen();
    const path = normalizeWorkspacePath(String(request.path));
    const destination = this.#absolutePath(path);
    const exists = await lstat(destination).then(() => true).catch((error: unknown) => {
      if (isMissing(error)) return false;
      throw error;
    });
    if (exists) throw new WorkspaceAlreadyExistsError(path);
    await this.#writeBytesAtomically(destination, request.bytes);
    const mediaType = mediaTypeFor(path);
    const record = this.#newRecord({ path, contentHash: hashContent(request.bytes), ...(mediaType !== undefined ? { mediaType } : {}) });
    this.#records.set(record.id, record);
    await this.#persistState();
    this.#emit({ type: 'workspace:file-created', file: fileFromRecord(record) });
    return fileFromRecord(record);
  }

  async rename(request: RenameWorkspaceFileRequest): Promise<WorkspaceFile> {
    this.#requireOpen();
    const record = this.#record(request.fileId);
    await this.#assertWritable(record, request.expectedRevision);
    const nextPath = normalizeWorkspacePath(String(request.path));
    if (nextPath === record.path) return fileFromRecord(record);

    const destination = this.#absolutePath(nextPath);
    const destinationExists = await lstat(destination)
      .then(() => true)
      .catch((error: unknown) => {
        if (isMissing(error)) return false;
        throw error;
      });
    if (destinationExists) throw new WorkspaceAlreadyExistsError(nextPath);

    await mkdir(dirname(destination), { recursive: true });
    await renameOnDisk(this.#absolutePath(record.path), destination);
    const next: PersistedWorkspaceFile = { ...record, path: nextPath, revision: record.revision + 1 };
    this.#records.set(next.id, next);
    await this.#persistState();
    this.#emit({ type: 'workspace:file-renamed', file: fileFromRecord(next), previousPath: record.path });
    return fileFromRecord(next);
  }

  async configuration(): Promise<WorkspaceConfiguration> {
    this.#requireOpen();
    return this.#configuration;
  }

  async updateConfiguration(configuration: WorkspaceConfiguration): Promise<void> {
    this.#requireOpen();
    this.#configuration = this.#validateConfiguration(configuration);
    await this.#writeJsonAtomically(this.#configPath(), this.#configuration);
    await this.refresh();
  }

  /** Transforma eventos ruidosos de fs.watch em um diff determinístico de snapshots. */
  async refresh(): Promise<readonly WorkspaceFile[]> {
    this.#requireOpen();
    const generation = this.#lifecycleGeneration;
    const operation = this.#refreshInternal(generation);
    this.#refreshOperations.add(operation);
    try {
      return await operation;
    } finally {
      this.#refreshOperations.delete(operation);
    }
  }

  async #refreshInternal(generation: number): Promise<readonly WorkspaceFile[]> {
    const scanned = await this.#scanFiles();
    if (!this.#canRefresh(generation)) return [];
    const byPath = new Map(scanned.map((entry) => [entry.path, entry]));
    const missing = new Map<WorkspaceFileId, PersistedWorkspaceFile>();
    const events: WorkspaceEvent[] = [];
    let changed = false;

    for (const record of this.#records.values()) {
      if (this.#isIgnored(record.path)) continue;
      const entry = byPath.get(record.path);
      if (entry === undefined) {
        missing.set(record.id, record);
        continue;
      }
      byPath.delete(record.path);
      if (entry.contentHash !== record.contentHash || entry.mediaType !== record.mediaType) {
        const next: PersistedWorkspaceFile = {
          ...record,
          revision: record.revision + 1,
          contentHash: entry.contentHash,
          ...(entry.mediaType !== undefined ? { mediaType: entry.mediaType } : {}),
        };
        this.#records.set(next.id, next);
        events.push({ type: 'workspace:file-changed', file: fileFromRecord(next) });
        changed = true;
      }
    }

    for (const entry of byPath.values()) {
      const matchingMissing = [...missing.values()].filter((record) => record.contentHash === entry.contentHash);
      if (matchingMissing.length === 1) {
        const previous = matchingMissing[0] as PersistedWorkspaceFile;
        missing.delete(previous.id);
        const next: PersistedWorkspaceFile = {
          ...previous,
          path: entry.path,
          revision: previous.revision + 1,
          ...(entry.mediaType !== undefined ? { mediaType: entry.mediaType } : {}),
        };
        this.#records.set(next.id, next);
        events.push({ type: 'workspace:file-renamed', file: fileFromRecord(next), previousPath: previous.path });
      } else {
        const created = this.#newRecord(entry);
        this.#records.set(created.id, created);
        events.push({ type: 'workspace:file-created', file: fileFromRecord(created) });
      }
      changed = true;
    }

    for (const record of missing.values()) {
      this.#records.delete(record.id);
      events.push({ type: 'workspace:file-removed', fileId: record.id, path: record.path });
      changed = true;
    }

    const stateExists = await this.#stateExists();
    if (!this.#canRefresh(generation)) return [];
    if (changed || !stateExists) {
      await this.#persistState();
      if (!this.#canRefresh(generation)) return [];
    }
    for (const event of events) this.#emit(event);
    if (this.#watchStarted && !this.#watcherIsRecursive) await this.#restartFallbackWatchers(generation);
    if (!this.#canRefresh(generation)) return [];
    return this.list();
  }

  subscribe(listener: WorkspaceEventListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #requireOpen(): void {
    if (!this.#opened || this.#closing) throw new Error('Workspace não está aberto.');
  }

  #canRefresh(generation: number): boolean {
    return this.#opened && !this.#closing && generation === this.#lifecycleGeneration;
  }

  #requireWorkspaceId(): ReturnType<typeof asWorkspaceId> {
    if (this.#workspaceId === undefined) throw new Error('Workspace ainda não foi inicializado.');
    return this.#workspaceId;
  }

  #record(fileId: WorkspaceFileId): PersistedWorkspaceFile {
    const record = this.#records.get(fileId);
    if (record === undefined) throw new WorkspaceFileNotFoundError(fileId);
    return record;
  }

  async #assertWritable(record: PersistedWorkspaceFile, expectedRevision: number): Promise<void> {
    if (record.revision !== expectedRevision) {
      throw new WorkspaceConflictError(record.id, expectedRevision, record.revision);
    }
    const absolute = this.#absolutePath(record.path);
    let currentHash: ContentHash;
    try {
      currentHash = hashContent(await readFile(absolute));
    } catch (error) {
      if (!isMissing(error)) throw error;
      await this.#removeMissingRecord(record);
      throw new WorkspaceFileNotFoundError(record.id);
    }
    if (currentHash === record.contentHash) return;
    const updated = await this.#recordExternalChange(record, currentHash);
    throw new WorkspaceConflictError(record.id, expectedRevision, updated.revision);
  }

  async #recordExternalChange(
    record: PersistedWorkspaceFile,
    contentHash: ContentHash,
  ): Promise<PersistedWorkspaceFile> {
    const next = { ...record, revision: record.revision + 1, contentHash };
    this.#records.set(next.id, next);
    await this.#persistState();
    this.#emit({ type: 'workspace:file-changed', file: fileFromRecord(next) });
    return next;
  }

  async #removeMissingRecord(record: PersistedWorkspaceFile): Promise<void> {
    this.#records.delete(record.id);
    await this.#persistState();
    this.#emit({ type: 'workspace:file-removed', fileId: record.id, path: record.path });
  }

  #newRecord(entry: ScannedFile): PersistedWorkspaceFile {
    const id = asWorkspaceFileId(`file_${randomUUID()}`);
    return {
      id,
      ...(isMarkdownPath(entry.path) ? { documentId: asWorkspaceDocumentId(`document_${randomUUID()}`) } : {}),
      path: entry.path,
      revision: 1,
      contentHash: entry.contentHash,
      ...(entry.mediaType !== undefined ? { mediaType: entry.mediaType } : {}),
    };
  }

  async #scanFiles(): Promise<readonly ScannedFile[]> {
    const files: ScannedFile[] = [];
    const visit = async (absoluteDirectory: string): Promise<void> => {
      const entries = await readdir(absoluteDirectory, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === META_DIRECTORY && absoluteDirectory === this.#root) continue;
        const absolute = resolve(absoluteDirectory, entry.name);
        if (entry.isSymbolicLink()) continue;
        if (entry.isDirectory()) {
          await visit(absolute);
          continue;
        }
        if (!entry.isFile()) continue;
        const path = this.#relativePath(absolute);
        if (this.#isIgnored(path)) continue;
        const mediaType = mediaTypeFor(path);
        files.push({
          path,
          contentHash: hashContent(await readFile(absolute)),
          ...(mediaType !== undefined ? { mediaType } : {}),
        });
      }
    };
    await visit(this.#root);
    return files.sort((a, b) => a.path.localeCompare(b.path));
  }

  #isIgnored(path: WorkspacePath): boolean {
    const ignored = this.#configuration.ignoredPaths ?? [];
    return ignored.some((entry) => path === entry || path.startsWith(`${entry}/`));
  }

  #absolutePath(path: WorkspacePath): string {
    const absolute = resolve(this.#root, ...String(path).split('/'));
    const relativeToRoot = relative(this.#root, absolute);
    if (relativeToRoot === '' || relativeToRoot === '..' || relativeToRoot.startsWith(`..${sep}`) || isAbsolute(relativeToRoot)) {
      throw new WorkspacePathError(path, `Path fora do vault: ${path}.`);
    }
    return absolute;
  }

  #relativePath(absolute: string): WorkspacePath {
    return normalizeWorkspacePath(relative(this.#root, absolute).split(sep).join('/'));
  }

  #metaPath(...segments: readonly string[]): string {
    return resolve(this.#root, META_DIRECTORY, ...segments);
  }

  #configPath(): string {
    return this.#metaPath(CONFIG_FILE);
  }

  #statePath(): string {
    return this.#metaPath(STATE_FILE);
  }

  #recoveryDirectory(): string {
    return this.#metaPath(RECOVERY_DIRECTORY);
  }

  #recoveryPath(fileId: WorkspaceFileId): string {
    return this.#metaPath(RECOVERY_DIRECTORY, `${encodeURIComponent(String(fileId))}.json`);
  }

  async #loadConfiguration(): Promise<WorkspaceConfiguration> {
    const raw = await this.#readJson(this.#configPath());
    if (raw === undefined) {
      await this.#writeJsonAtomically(this.#configPath(), DEFAULT_WORKSPACE_CONFIGURATION);
      return DEFAULT_WORKSPACE_CONFIGURATION;
    }
    return this.#validateConfiguration(raw);
  }

  #validateConfiguration(value: unknown): WorkspaceConfiguration {
    if (!isRecord(value) || value.schema !== 'abnt-workspace-config' || value.version !== WORKSPACE_CONFIGURATION_SCHEMA_VERSION) {
      throw new Error('workspace-config.json inválido ou incompatível.');
    }
    const ignoredPaths = Array.isArray(value.ignoredPaths)
      ? value.ignoredPaths.map((path) => normalizeWorkspacePath(String(path)))
      : [];
    const defaultProfileId = typeof value.defaultProfileId === 'string' ? value.defaultProfileId : undefined;
    return {
      schema: 'abnt-workspace-config',
      version: WORKSPACE_CONFIGURATION_SCHEMA_VERSION,
      ...(defaultProfileId !== undefined ? { defaultProfileId } : {}),
      ignoredPaths,
    };
  }

  async #loadState(): Promise<WorkspaceState | undefined> {
    const raw = await this.#readJson(this.#statePath());
    if (raw === undefined) return undefined;
    if (!isRecord(raw) || raw.schema !== 'abnt-workspace-state' || raw.version !== WORKSPACE_STATE_SCHEMA_VERSION || typeof raw.workspaceId !== 'string' || !isRecord(raw.files)) {
      throw new Error('workspace-state.json inválido ou incompatível.');
    }

    const files: Record<string, PersistedWorkspaceFile> = {};
    for (const [id, value] of Object.entries(raw.files)) {
      if (!isRecord(value) || typeof value.path !== 'string' || typeof value.revision !== 'number' || typeof value.contentHash !== 'string') {
        throw new Error(`Registro inválido em workspace-state.json: ${id}.`);
      }
      const fileId = asWorkspaceFileId(typeof value.id === 'string' ? value.id : id);
      files[String(fileId)] = {
        id: fileId,
        ...(typeof value.documentId === 'string' ? { documentId: asWorkspaceDocumentId(value.documentId) } : {}),
        path: normalizeWorkspacePath(value.path),
        revision: value.revision,
        contentHash: asContentHash(value.contentHash),
        ...(typeof value.mediaType === 'string' ? { mediaType: value.mediaType } : {}),
      };
    }
    return {
      schema: 'abnt-workspace-state',
      version: WORKSPACE_STATE_SCHEMA_VERSION,
      workspaceId: asWorkspaceId(raw.workspaceId),
      files,
    };
  }

  async #persistState(): Promise<void> {
    const files = Object.fromEntries([...this.#records.values()].map((record) => [String(record.id), record]));
    await this.#writeJsonAtomically(this.#statePath(), {
      schema: 'abnt-workspace-state',
      version: 1,
      workspaceId: this.#requireWorkspaceId(),
      files,
    } satisfies WorkspaceState);
  }

  async #stateExists(): Promise<boolean> {
    return lstat(this.#statePath())
      .then(() => true)
      .catch((error: unknown) => {
        if (isMissing(error)) return false;
        throw error;
      });
  }

  async #recoverPendingWrites(): Promise<void> {
    const entries = await readdir(this.#recoveryDirectory(), { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
      const recoveryPath = resolve(this.#recoveryDirectory(), entry.name);
      const raw = await this.#readJson(recoveryPath);
      const recovery = this.#parseRecovery(raw);
      if (recovery === undefined) continue;

      const target = this.#absolutePath(recovery.path);
      const currentHash = await readFile(target)
        .then(hashContent)
        .catch((error: unknown) => (isMissing(error) ? undefined : Promise.reject(error)));
      if (currentHash === recovery.nextHash) {
        await rm(recoveryPath, { force: true });
      } else if (currentHash === recovery.baseHash) {
        await this.#writeTextAtomically(target, recovery.content);
        await rm(recoveryPath, { force: true });
      } else {
        this.#emit({
          type: 'workspace:recovery-conflict',
          fileId: recovery.fileId,
          path: recovery.path,
          recoveryPath,
        });
      }
    }
  }

  #parseRecovery(value: unknown): RecoveryRecord | undefined {
    if (!isRecord(value) || value.schema !== 'abnt-workspace-recovery' || value.version !== 1) return undefined;
    if (
      typeof value.fileId !== 'string' ||
      typeof value.path !== 'string' ||
      typeof value.baseHash !== 'string' ||
      typeof value.nextHash !== 'string' ||
      typeof value.content !== 'string'
    ) {
      return undefined;
    }
    return {
      schema: 'abnt-workspace-recovery',
      version: 1,
      fileId: asWorkspaceFileId(value.fileId),
      path: normalizeWorkspacePath(value.path),
      baseHash: asContentHash(value.baseHash),
      nextHash: asContentHash(value.nextHash),
      content: value.content,
    };
  }

  async #readJson(path: string): Promise<unknown | undefined> {
    try {
      return JSON.parse(await readFile(path, 'utf8')) as unknown;
    } catch (error) {
      if (isMissing(error)) return undefined;
      throw error;
    }
  }

  async #writeJsonAtomically(path: string, value: unknown): Promise<void> {
    await this.#writeTextAtomically(path, `${JSON.stringify(value, null, 2)}\n`);
  }

  async #writeTextAtomically(destination: string, content: string): Promise<void> {
    await this.#writeAtomically(destination, content, 'utf8');
  }

  async #writeBytesAtomically(destination: string, content: Uint8Array): Promise<void> {
    await this.#writeAtomically(destination, content);
  }

  async #writeAtomically(destination: string, content: string | Uint8Array, encoding?: BufferEncoding): Promise<void> {
    await mkdir(dirname(destination), { recursive: true });
    this.#writeSequence += 1;
    const temporary = resolve(dirname(destination), `.${basename(destination)}.${process.pid}.${this.#writeSequence}.tmp`);
    const handle = await open(temporary, 'wx');
    try {
      await handle.writeFile(content, encoding);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await renameOnDisk(temporary, destination);
    await this.#syncDirectory(dirname(destination));
  }

  async #syncDirectory(path: string): Promise<void> {
    const handle = await open(path, 'r');
    try {
      await handle.sync();
    } catch {
      // Alguns filesystems/Windows não permitem fsync de diretório; rename ainda
      // preserva atomicidade, apenas sem a garantia extra de durabilidade.
    } finally {
      await handle.close();
    }
  }

  async #startWatchers(): Promise<void> {
    const onChange = (_event: string, fileName: string | Buffer | null): void => {
      const candidate = fileName === null ? undefined : String(fileName).replace(/\\/gu, '/');
      if (candidate !== undefined && (candidate === META_DIRECTORY || candidate.startsWith(`${META_DIRECTORY}/`))) return;
      this.#scheduleRefresh();
    };
    try {
      this.#watchers = [watch(this.#root, { recursive: true }, onChange)];
      this.#watcherIsRecursive = true;
    } catch {
      this.#watcherIsRecursive = false;
      await this.#startFallbackWatchers(onChange);
    }
    this.#watchStarted = true;
  }

  async #startFallbackWatchers(listener: (event: string, fileName: string | Buffer | null) => void): Promise<void> {
    for (const directory of await this.#directories()) this.#watchers.push(watch(directory, listener));
  }

  async #restartFallbackWatchers(generation: number): Promise<void> {
    const listener = (_event: string, fileName: string | Buffer | null): void => {
      const candidate = fileName === null ? undefined : String(fileName).replace(/\\/gu, '/');
      if (candidate !== undefined && (candidate === META_DIRECTORY || candidate.startsWith(`${META_DIRECTORY}/`))) return;
      this.#scheduleRefresh();
    };
    this.#stopWatchers();
    const directories = await this.#directories();
    if (!this.#canRefresh(generation)) return;
    for (const directory of directories) this.#watchers.push(watch(directory, listener));
  }

  async #directories(): Promise<readonly string[]> {
    const directories: string[] = [];
    const visit = async (directory: string): Promise<void> => {
      directories.push(directory);
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (entry.name === META_DIRECTORY && directory === this.#root) continue;
        if (entry.isDirectory() && !entry.isSymbolicLink()) await visit(resolve(directory, entry.name));
      }
    };
    await visit(this.#root);
    return directories;
  }

  #stopWatchers(): void {
    for (const watcher of this.#watchers) watcher.close();
    this.#watchers = [];
  }

  #scheduleRefresh(): void {
    if (!this.#opened || this.#closing) return;
    if (this.#refreshTimer !== undefined) clearTimeout(this.#refreshTimer);
    this.#refreshTimer = setTimeout(() => {
      this.#refreshTimer = undefined;
      if (!this.#opened || this.#closing) return;
      void this.refresh().catch(() => undefined);
    }, 30);
  }

  #emit(event: WorkspaceEvent): void {
    for (const listener of this.#listeners) {
      try {
        listener(event);
      } catch {
        // Um consumidor de UI não pode interromper persistência ou indexação.
      }
    }
  }
}
