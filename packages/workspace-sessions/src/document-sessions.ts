import {
  protocolOk,
  type CompilationEnvironmentDto,
  type CompilerService,
  type DiagnosticDto,
  type EnvironmentPreparationDto,
  type PreparedCompilationDto,
  type ProtocolError,
  type SourceSnapshotDto,
} from '@abnt/protocol';
import type {
  WorkspaceEvent,
  WorkspaceFile,
  WorkspaceFileId,
  WorkspaceStorage,
} from '@abnt/workspace-core';

import type {
  CompilationEnvironmentResolver,
  CompilationSourceExpansion,
  CompileDocumentSessionOptions,
  DocumentSessionEvent,
  DocumentSessionEventListener,
  DocumentSessionPreview,
  DocumentSessionSnapshot,
  DocumentSessions,
  DocumentSessionsOptions,
  ExternalConflictResolution,
  ProfileEvaluation,
} from './model.js';

interface ActiveCompilation {
  readonly token: number;
  readonly revision: number;
  readonly controller: AbortController;
  promise?: Promise<void>;
}

interface MutableSession {
  readonly id: WorkspaceFileId;
  file: WorkspaceFile;
  revision: number;
  content: string;
  contentHash: string | undefined;
  dirty: boolean;
  status: 'idle' | 'compiling' | 'failed';
  dependencies: PreparedCompilationDto['dependencies'] | undefined;
  diagnostics: readonly import('@abnt/protocol').DiagnosticDto[];
  preview: DocumentSessionPreview | undefined;
  resolved: import('@abnt/protocol').ResolvedDocumentDto | undefined;
  bibliography: import('@abnt/protocol').BibliographyEnvironmentDto | undefined;
  externalChange: WorkspaceFile | undefined;
  active: ActiveCompilation | undefined;
  saving: boolean;
}

const emptyEnvironment = (defaultProfileId?: string): CompilationEnvironmentDto => ({
  bibliography: { entries: {}, sources: [], provenanceByReference: {} },
  resources: {},
  dependencies: { bibliography: [], resources: [] },
  ...(defaultProfileId !== undefined ? { configuration: { defaultProfileId } } : {}),
});

const internalFailure = (): ProtocolError => ({
  code: 'INTERNAL',
  message: 'A sessão não conseguiu concluir a compilação.',
});

const isCancellation = (error: ProtocolError): boolean => error.code === 'CANCELLED';

/** Resolver útil para preview puramente local antes de integrar bibliografia/recursos. */
export const criarResolvedorDeAmbienteVazio = (): CompilationEnvironmentResolver => ({
  async resolve(request) {
    return protocolOk<EnvironmentPreparationDto>({
      environment: emptyEnvironment(request.workspaceConfiguration.defaultProfileId),
      diagnostics: [],
    });
  },
});

/**
 * Serviço headless de rascunhos e compilações. Ele nunca acessa fs diretamente
 * e nunca interpreta Markdown: WorkspaceStorage e CompilerService já são as
 * fronteiras corretas para esses domínios.
 */
export class DocumentSessionsService implements DocumentSessions {
  readonly #storage: WorkspaceStorage;
  readonly #compiler: CompilerService;
  readonly #environment: CompilationEnvironmentResolver;
  readonly #hashContent: DocumentSessionsOptions['hashContent'];
  readonly #autoCompile: boolean;
  readonly #sessions = new Map<string, MutableSession>();
  readonly #listeners = new Set<DocumentSessionEventListener>();
  #unsubscribeWorkspace: (() => void) | undefined;
  #nextToken = 0;
  #disposed = false;

  constructor(options: DocumentSessionsOptions) {
    this.#storage = options.storage;
    this.#compiler = options.compiler;
    this.#environment = options.environment;
    this.#hashContent = options.hashContent;
    this.#autoCompile = options.autoCompile ?? true;
  }

  static create(options: DocumentSessionsOptions): DocumentSessionsService {
    return new DocumentSessionsService(options);
  }

  async open(fileId: WorkspaceFileId): Promise<DocumentSessionSnapshot> {
    this.#requireActive();
    const existing = this.#session(fileId);
    if (existing !== undefined) return this.#snapshot(existing);

    await this.#storage.open();
    this.#subscribeToWorkspace();
    const source = await this.#storage.read(fileId);
    if (source.file.documentId === undefined) {
      throw new Error(`O arquivo ${source.file.path} não possui DocumentId e não pode abrir uma sessão documental.`);
    }

    const session: MutableSession = {
      id: source.file.id,
      file: source.file,
      revision: source.file.revision,
      content: source.content,
      contentHash: String(source.file.contentHash),
      dirty: false,
      status: 'idle',
      dependencies: undefined,
      diagnostics: [],
      preview: undefined,
      resolved: undefined,
      bibliography: undefined,
      externalChange: undefined,
      active: undefined,
      saving: false,
    };
    this.#sessions.set(String(fileId), session);
    this.#emit({ type: 'session:opened', session: this.#snapshot(session) });
    if (this.#autoCompile) void this.compile(fileId);
    return this.#snapshot(session);
  }

  close(fileId: WorkspaceFileId): void {
    const session = this.#session(fileId);
    if (session === undefined) return;
    session.active?.controller.abort();
    this.#sessions.delete(String(fileId));
    this.#emit({ type: 'session:closed', sessionId: fileId, reason: 'explicit' });
  }

  snapshot(fileId: WorkspaceFileId): DocumentSessionSnapshot | undefined {
    const session = this.#session(fileId);
    return session === undefined ? undefined : this.#snapshot(session);
  }

  replaceContent(fileId: WorkspaceFileId, content: string): DocumentSessionSnapshot {
    const session = this.#requiredSession(fileId);
    if (session.content === content) return this.#snapshot(session);

    session.active?.controller.abort();
    session.revision += 1;
    session.content = content;
    session.contentHash = undefined;
    session.dirty = true;
    session.status = 'idle';
    session.dependencies = undefined;
    session.diagnostics = [];
    session.preview = undefined;
    session.resolved = undefined;
    // Diferente de uma edição incremental, uma recarga troca toda a fonte:
    // o catálogo de referências anterior não pode continuar projetado.
    session.bibliography = undefined;
    this.#emit({ type: 'session:changed', origin: 'edit', session: this.#snapshot(session) });
    if (this.#autoCompile) void this.compile(fileId);
    return this.#snapshot(session);
  }

  async save(fileId: WorkspaceFileId): Promise<DocumentSessionSnapshot> {
    const session = this.#requiredSession(fileId);
    if (!session.dirty) return this.#snapshot(session);

    const savedRevision = session.revision;
    const savedContent = session.content;
    session.saving = true;
    try {
      const file = await this.#storage.write({
        fileId,
        content: savedContent,
        expectedRevision: session.file.revision,
      });
      session.file = file;
      if (session.revision === savedRevision && session.content === savedContent) {
        session.dirty = false;
        session.contentHash = String(file.contentHash);
        session.externalChange = undefined;
      }
      this.#emit({ type: 'session:changed', origin: 'save', session: this.#snapshot(session) });
      return this.#snapshot(session);
    } finally {
      session.saving = false;
    }
  }

  async resolveExternalConflict(
    fileId: WorkspaceFileId,
    resolution: ExternalConflictResolution,
  ): Promise<DocumentSessionSnapshot> {
    const session = this.#requiredSession(fileId);
    if (session.externalChange === undefined) return this.#snapshot(session);

    if (resolution === 'reload-external') {
      await this.#reloadFromDisk(session);
      return this.#snapshot(session);
    }

    // keep-local: o rascunho não muda; só aceitamos a revisão externa como
    // nova base do arquivo persistido, para o próximo save() não falhar por
    // expectedRevision desatualizado — ele sobrescreve o disco de propósito.
    session.file = session.externalChange;
    session.externalChange = undefined;
    this.#emit({ type: 'session:changed', origin: 'workspace', session: this.#snapshot(session) });
    return this.#snapshot(session);
  }

  async compile(
    fileId: WorkspaceFileId,
    options: CompileDocumentSessionOptions = {},
  ): Promise<DocumentSessionSnapshot | undefined> {
    const session = this.#requiredSession(fileId);
    session.active?.controller.abort();
    const active: ActiveCompilation = {
      token: ++this.#nextToken,
      revision: session.revision,
      controller: new AbortController(),
    };
    session.active = active;
    session.status = 'compiling';
    this.#emit({ type: 'session:compilation-started', session: this.#snapshot(session) });
    const promise = this.#runCompilation(session, active, options.profileId);
    active.promise = promise;
    await promise;
    return this.snapshot(fileId);
  }

  async idle(fileId?: WorkspaceFileId): Promise<void> {
    const sessions =
      fileId === undefined
        ? [...this.#sessions.values()]
        : [this.#session(fileId)].filter((session): session is MutableSession => session !== undefined);
    await Promise.all(sessions.map((session) => session.active?.promise));
  }

  /** Avalia profile candidato sobre a mesma revisão, sem publicar resultado na sessão. */
  async evaluateProfile(fileId: WorkspaceFileId, profileId: string, signal?: AbortSignal): Promise<ProfileEvaluation | undefined> {
    const session = this.#requiredSession(fileId);
    const revision = session.revision;
    const current = (): boolean => this.#sessions.get(String(session.id)) === session && session.revision === revision && signal?.aborted !== true;
    const expansion = this.#environment.expandSource === undefined
      ? { content: session.content, diagnostics: [] }
      : await this.#environment.expandSource({ file: session.file, content: session.content }, signal);
    if (!current()) return undefined;
    const authoredHash = await this.#hashContent(session.content, signal);
    if (!current()) return undefined;
    const compilationHash = expansion.content === session.content ? authoredHash : await this.#hashContent(expansion.content, signal);
    if (!current()) return undefined;
    const source: SourceSnapshotDto = { documentId: String(session.file.documentId), revision, content: expansion.content, contentHash: compilationHash };
    const prepared = await this.#compiler.prepare({ source }, signal);
    if (!current() || !prepared.ok) return undefined;
    const workspaceConfiguration = await this.#storage.configuration();
    if (!current()) return undefined;
    const environment = await this.#environment.resolve({ file: session.file, source, prepared: prepared.value, workspaceConfiguration }, signal);
    if (!current() || !environment.ok) return undefined;
    const result = await this.#compiler.compile({ prepared: prepared.value, environment: environment.value, profileId }, signal);
    if (!current() || !result.ok) return undefined;
    return {
      revision,
      profileId: result.value.profileId,
      errors: result.value.validation.errors,
      warnings: result.value.validation.warnings,
      diagnostics: [...expansion.diagnostics, ...this.#remapDiagnostics(result.value.diagnostics, expansion, source.documentId)],
    };
  }

  subscribe(listener: DocumentSessionEventListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async dispose(): Promise<void> {
    if (this.#disposed) return;
    this.#disposed = true;
    for (const session of this.#sessions.values()) session.active?.controller.abort();
    await this.idle();
    this.#sessions.clear();
    this.#unsubscribeWorkspace?.();
    this.#unsubscribeWorkspace = undefined;
  }

  async #runCompilation(
    session: MutableSession,
    active: ActiveCompilation,
    profileId: string | undefined,
  ): Promise<void> {
    try {
      // A sessão preserva a fonte autoral; o host pode projetar uma fonte de
      // compilação (F60–F62) para expandir módulos sem reescrever o rascunho.
      const expansion = this.#environment.expandSource === undefined
        ? { content: session.content, diagnostics: [] }
        : await this.#environment.expandSource({ file: session.file, content: session.content }, active.controller.signal);
      if (!this.#current(session, active)) return this.#discard(session, active);

      const contentHash = await this.#hashContent(session.content, active.controller.signal);
      if (!this.#current(session, active)) return this.#discard(session, active);
      if (contentHash.length === 0) throw new Error('O hash de conteúdo não pode ser vazio.');

      session.contentHash = contentHash;
      const compilationHash = expansion.content === session.content
        ? contentHash
        : await this.#hashContent(expansion.content, active.controller.signal);
      if (!this.#current(session, active)) return this.#discard(session, active);
      const source: SourceSnapshotDto = {
        documentId: String(session.file.documentId),
        revision: active.revision,
        content: expansion.content,
        contentHash: compilationHash,
      };
      const prepared = await this.#compiler.prepare({ source }, active.controller.signal);
      if (!this.#current(session, active)) return this.#discard(session, active);
      if (!prepared.ok) return this.#failure(session, active, prepared.error);

      session.dependencies = prepared.value.dependencies;
      session.diagnostics = [...expansion.diagnostics, ...this.#remapDiagnostics(prepared.value.diagnostics, expansion, source.documentId)];
      this.#emit({
        type: 'session:dependencies-resolved',
        sessionId: session.id,
        revision: active.revision,
        dependencies: prepared.value.dependencies,
      });
      this.#emitDiagnostics(session, active.revision);

      const workspaceConfiguration = await this.#storage.configuration();
      if (!this.#current(session, active)) return this.#discard(session, active);
      const environment = await this.#environment.resolve(
        {
          file: session.file,
          source,
          prepared: prepared.value,
          workspaceConfiguration,
        },
        active.controller.signal,
      );
      if (!this.#current(session, active)) return this.#discard(session, active);
      if (!environment.ok) return this.#failure(session, active, environment.error);
      // Persiste mesmo se a compilação falhar depois: a bibliografia já foi
      // resolvida com sucesso e continua válida independente de um erro de
      // sintaxe não relacionado no restante do documento.
      session.bibliography = environment.value.environment.bibliography;

      const result = await this.#compiler.compile(
        {
          prepared: prepared.value,
          environment: environment.value,
          ...(profileId !== undefined ? { profileId } : {}),
        },
        active.controller.signal,
      );
      if (!this.#current(session, active)) return this.#discard(session, active);
      if (!result.ok) return this.#failure(session, active, result.error);

      session.status = 'idle';
      session.diagnostics = [...expansion.diagnostics, ...this.#remapDiagnostics(result.value.diagnostics, expansion, source.documentId)];
      session.preview = { profileId: result.value.profileId, revision: active.revision, publication: result.value.publication };
      session.resolved = result.value.resolved;
      this.#emitDiagnostics(session, active.revision);
      this.#emit({
        type: 'session:preview-updated',
        sessionId: session.id,
        revision: active.revision,
        preview: session.preview,
      });
    } catch (error) {
      if (!this.#current(session, active)) return this.#discard(session, active);
      if (active.controller.signal.aborted) return this.#discard(session, active);
      this.#failure(session, active, internalFailure());
    } finally {
      if (this.#current(session, active)) session.active = undefined;
    }
  }

  #failure(session: MutableSession, active: ActiveCompilation, error: ProtocolError): void {
    if (!this.#current(session, active)) return this.#discard(session, active);
    if (isCancellation(error)) return this.#discard(session, active);
    session.status = 'failed';
    this.#emit({ type: 'session:compilation-failed', session: this.#snapshot(session), error });
  }

  #discard(session: MutableSession, active: ActiveCompilation): void {
    this.#emit({
      type: 'session:compilation-discarded',
      sessionId: session.id,
      revision: active.revision,
      reason: active.controller.signal.aborted ? 'cancelled' : 'stale',
    });
  }

  /**
   * F67 — diagnósticos do compiler carregam offset da fonte virtual quando a
   * expansão (F60–F62) compôs o documento a partir de embeds. Delega a
   * tradução de volta ao arquivo real ao resolvedor, que é quem conhece o
   * `CompositeSourceMap`; sem `sourceMap` (host sem transclusão) ou sem o
   * método (resolvedor mínimo de teste), os diagnósticos passam inalterados.
   */
  #remapDiagnostics(
    diagnostics: readonly DiagnosticDto[],
    expansion: CompilationSourceExpansion,
    rootDocumentId: string,
  ): readonly DiagnosticDto[] {
    if (expansion.sourceMap === undefined || this.#environment.remapCompositionDiagnostics === undefined) return diagnostics;
    return this.#environment.remapCompositionDiagnostics(diagnostics, expansion.sourceMap, rootDocumentId);
  }

  #emitDiagnostics(session: MutableSession, revision: number): void {
    this.#emit({
      type: 'session:diagnostics-updated',
      sessionId: session.id,
      revision,
      diagnostics: session.diagnostics,
    });
  }

  #subscribeToWorkspace(): void {
    if (this.#unsubscribeWorkspace !== undefined) return;
    this.#unsubscribeWorkspace = this.#storage.subscribe((event) => {
      void this.#applyWorkspaceEvent(event);
    });
  }

  async #applyWorkspaceEvent(event: WorkspaceEvent): Promise<void> {
    const fileId =
      event.type === 'workspace:file-created' ||
      event.type === 'workspace:file-changed' ||
      event.type === 'workspace:file-renamed'
        ? event.file.id
        : event.fileId;
    const session = this.#session(fileId);
    if (session === undefined) return;

    switch (event.type) {
      case 'workspace:file-created':
      case 'workspace:recovery-conflict':
        return;
      case 'workspace:file-removed':
        session.active?.controller.abort();
        this.#sessions.delete(String(session.id));
        this.#emit({ type: 'session:closed', sessionId: session.id, reason: 'removed' });
        return;
      case 'workspace:file-renamed':
        session.file = event.file;
        this.#emit({ type: 'session:changed', origin: 'workspace', session: this.#snapshot(session) });
        return;
      case 'workspace:file-changed':
        if (session.saving) return;
        if (
          session.file.revision >= event.file.revision &&
          String(session.file.contentHash) === String(event.file.contentHash)
        ) {
          session.file = event.file;
          return;
        }
        if (session.dirty) {
          session.externalChange = event.file;
          this.#emit({
            type: 'session:external-conflict',
            session: this.#snapshot(session),
            externalFile: event.file,
          });
          return;
        }
        await this.#reloadFromDisk(session);
    }
  }

  /**
   * Descarta o conteúdo em memória e recarrega do storage — usado tanto
   * automaticamente (sessão limpa, arquivo mudou por baixo) quanto sob pedido
   * explícito do usuário (`resolveExternalConflict('reload-external')`).
   */
  async #reloadFromDisk(session: MutableSession): Promise<void> {
    session.active?.controller.abort();
    const source = await this.#storage.read(session.id);
    if (this.#session(session.id) !== session) return;
    session.file = source.file;
    session.revision = Math.max(session.revision + 1, source.file.revision);
    session.content = source.content;
    session.contentHash = String(source.file.contentHash);
    session.dirty = false;
    session.externalChange = undefined;
    session.status = 'idle';
    session.dependencies = undefined;
    session.diagnostics = [];
    session.preview = undefined;
    this.#emit({ type: 'session:changed', origin: 'workspace', session: this.#snapshot(session) });
    if (this.#autoCompile) void this.compile(session.id);
  }

  #snapshot(session: MutableSession): DocumentSessionSnapshot {
    return {
      id: session.id,
      file: session.file,
      revision: session.revision,
      content: session.content,
      ...(session.contentHash !== undefined ? { contentHash: session.contentHash } : {}),
      dirty: session.dirty,
      status: session.status,
      ...(session.dependencies !== undefined ? { dependencies: session.dependencies } : {}),
      diagnostics: session.diagnostics,
      ...(session.preview !== undefined ? { preview: session.preview } : {}),
      ...(session.resolved !== undefined ? { resolved: session.resolved } : {}),
      ...(session.bibliography !== undefined ? { bibliography: session.bibliography } : {}),
      ...(session.externalChange !== undefined ? { externalChange: session.externalChange } : {}),
    };
  }

  #session(fileId: WorkspaceFileId): MutableSession | undefined {
    return this.#sessions.get(String(fileId));
  }

  #requiredSession(fileId: WorkspaceFileId): MutableSession {
    const session = this.#session(fileId);
    if (session === undefined) throw new Error(`A sessão do arquivo ${fileId} não está aberta.`);
    return session;
  }

  #current(session: MutableSession, active: ActiveCompilation): boolean {
    return (
      this.#sessions.get(String(session.id)) === session &&
      session.active?.token === active.token &&
      session.revision === active.revision
    );
  }

  #emit(event: DocumentSessionEvent): void {
    for (const listener of this.#listeners) listener(event);
  }

  #requireActive(): void {
    if (this.#disposed) throw new Error('O serviço de sessões já foi descartado.');
  }
}
