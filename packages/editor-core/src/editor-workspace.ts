import type { LanguageService } from '@abnt/language-service';
import type { WorkspaceFileId } from '@abnt/workspace-core';
import type { DocumentSessionEvent, DocumentSessionSnapshot, DocumentSessions } from '@abnt/workspace-sessions';

import { applyEditorTransaction } from './transaction.js';

import type {
  EditorController,
  EditorEvent,
  EditorEventListener,
  EditorSelection,
  EditorSnapshot,
  EditorTransaction,
  EditorWorkspace,
  EditorWorkspaceOptions,
} from './model.js';

const clamp = (offset: number, content: string): number => Math.max(0, Math.min(offset, content.length));

/** Controller por documento; não é CodeMirror e não mantém outra fonte de texto. */
class DocumentEditorController implements EditorController {
  readonly fileId: WorkspaceFileId;
  readonly #sessions: DocumentSessions;
  readonly #language: LanguageService;
  readonly #onDispose: () => void;
  readonly #listeners = new Set<EditorEventListener>();
  #state: EditorSnapshot;
  #unsubscribeSession: (() => void) | undefined;
  #projectionEpoch = 0;
  #projectionTask: Promise<void> = Promise.resolve();
  #suppressSession = false;
  #disposed = false;

  constructor(
    fileId: WorkspaceFileId,
    session: DocumentSessionSnapshot,
    options: EditorWorkspaceOptions,
    onDispose: () => void,
  ) {
    this.fileId = fileId;
    this.#sessions = options.sessions;
    this.#language = options.language;
    this.#onDispose = onDispose;
    this.#state = {
      fileId,
      version: 1,
      session,
      selection: { anchor: 0, head: 0 },
      outline: [],
      diagnostics: [],
      ...(session.preview !== undefined ? { preview: session.preview } : {}),
      ...(session.bibliography !== undefined ? { bibliography: session.bibliography } : {}),
      ...(session.externalChange !== undefined ? { externalChange: session.externalChange } : {}),
    };
  }

  async initialize(): Promise<void> {
    this.#unsubscribeSession = this.#sessions.subscribe((event) => this.#handleSessionEvent(event));
    await this.#refreshProjections();
  }

  snapshot(): EditorSnapshot {
    return this.#state;
  }

  dispatch(transaction: EditorTransaction): EditorSnapshot {
    this.#requireActive();
    const applied = applyEditorTransaction(this.#state.session.content, this.#state.selection, transaction);
    if (transaction.edits === undefined || transaction.edits.length === 0) {
      this.#replaceState({ ...this.#state, selection: applied.selection }, 'editor:changed');
      return this.#state;
    }

    this.#suppressSession = true;
    try {
      this.#sessions.replaceContent(this.fileId, applied.content);
    } finally {
      this.#suppressSession = false;
    }
    const session = this.#sessions.snapshot(this.fileId);
    if (session === undefined) throw new Error('A sessão foi fechada durante a transação.');
    this.#adoptSession(session, applied.selection);
    void this.#refreshProjections();
    return this.#state;
  }

  async save(): Promise<EditorSnapshot> {
    this.#requireActive();
    this.#suppressSession = true;
    try {
      await this.#sessions.save(this.fileId);
    } finally {
      this.#suppressSession = false;
    }
    const session = this.#sessions.snapshot(this.fileId);
    if (session === undefined) throw new Error('A sessão foi fechada durante o salvamento.');
    this.#adoptSession(session, this.#state.selection);
    void this.#refreshProjections();
    return this.#state;
  }

  async resolveExternalConflict(resolution: import('@abnt/workspace-sessions').ExternalConflictResolution): Promise<EditorSnapshot> {
    this.#requireActive();
    this.#suppressSession = true;
    try {
      await this.#sessions.resolveExternalConflict(this.fileId, resolution);
    } finally {
      this.#suppressSession = false;
    }
    const session = this.#sessions.snapshot(this.fileId);
    if (session === undefined) throw new Error('A sessão foi fechada durante a resolução do conflito externo.');
    this.#adoptSession(session, this.#state.selection);
    void this.#refreshProjections();
    return this.#state;
  }

  async idle(): Promise<void> {
    await this.#sessions.idle(this.fileId);
    await this.#projectionTask;
  }

  subscribe(listener: EditorEventListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#projectionEpoch += 1;
    this.#unsubscribeSession?.();
    this.#unsubscribeSession = undefined;
    this.#onDispose();
    this.#emit({ type: 'editor:closed', fileId: this.fileId });
  }

  #handleSessionEvent(event: DocumentSessionEvent): void {
    if (this.#disposed || this.#suppressSession) return;
    const eventFileId =
      event.type === 'session:dependencies-resolved' ||
      event.type === 'session:diagnostics-updated' ||
      event.type === 'session:preview-updated' ||
      event.type === 'session:compilation-discarded' ||
      event.type === 'session:closed'
        ? event.sessionId
        : event.session.id;
    if (eventFileId !== this.fileId) return;
    if (event.type === 'session:closed') {
      this.dispose();
      return;
    }
    const session = this.#sessions.snapshot(this.fileId);
    if (session === undefined) {
      this.dispose();
      return;
    }
    this.#adoptSession(session, this.#state.selection);
    if (event.type !== 'session:preview-updated') void this.#refreshProjections();
  }

  #adoptSession(session: DocumentSessionSnapshot, selection: EditorSelection): void {
    const contentChanged =
      session.revision !== this.#state.session.revision || session.content !== this.#state.session.content;
    const nextContent = session.content;
    this.#replaceState(
      {
        fileId: this.fileId,
        version: this.#state.version + 1,
        session,
        selection: {
          anchor: clamp(selection.anchor, nextContent),
          head: clamp(selection.head, nextContent),
        },
        outline: contentChanged ? [] : this.#state.outline,
        diagnostics: contentChanged ? [] : this.#state.diagnostics,
        ...(session.preview !== undefined ? { preview: session.preview } : {}),
        ...(session.bibliography !== undefined ? { bibliography: session.bibliography } : {}),
        ...(session.externalChange !== undefined ? { externalChange: session.externalChange } : {}),
      },
      'editor:changed',
    );
  }

  async #refreshProjections(): Promise<void> {
    const epoch = ++this.#projectionEpoch;
    const revision = this.#state.session.revision;
    const task = Promise.all([
      this.#language.outline(this.fileId),
      this.#language.diagnostics(this.fileId),
    ])
      .then(([outline, diagnostics]) => {
        if (this.#disposed || epoch !== this.#projectionEpoch || revision !== this.#state.session.revision) return;
        this.#replaceState(
          {
            ...this.#state,
            version: this.#state.version + 1,
            outline,
            diagnostics,
            ...(this.#state.session.preview !== undefined ? { preview: this.#state.session.preview } : {}),
            ...(this.#state.session.bibliography !== undefined ? { bibliography: this.#state.session.bibliography } : {}),
            ...(this.#state.session.externalChange !== undefined ? { externalChange: this.#state.session.externalChange } : {}),
          },
          'editor:projections-updated',
        );
      })
      .catch(() => {
        // Falha de projeção nunca pode apagar a fonte ou derrubar a edição.
      });
    this.#projectionTask = task;
    await task;
  }

  #replaceState(state: EditorSnapshot, type: Extract<EditorEvent['type'], 'editor:changed' | 'editor:projections-updated'>): void {
    this.#state = state;
    this.#emit({ type, snapshot: state });
  }

  #emit(event: EditorEvent): void {
    for (const listener of this.#listeners) listener(event);
  }

  #requireActive(): void {
    if (this.#disposed) throw new Error('O controller do editor já foi descartado.');
  }
}

/** Fábrica de controllers; não abre filesystem nem instancia um editor visual. */
export class EditorWorkspaceService implements EditorWorkspace {
  readonly #options: EditorWorkspaceOptions;
  readonly #controllers = new Map<string, DocumentEditorController>();
  #disposed = false;

  constructor(options: EditorWorkspaceOptions) {
    this.#options = options;
  }

  static create(options: EditorWorkspaceOptions): EditorWorkspaceService {
    return new EditorWorkspaceService(options);
  }

  async open(fileId: WorkspaceFileId): Promise<EditorController> {
    if (this.#disposed) throw new Error('O workspace do editor já foi descartado.');
    const existing = this.#controllers.get(String(fileId));
    if (existing !== undefined) return existing;
    const session = await this.#options.sessions.open(fileId);
    const controller = new DocumentEditorController(fileId, session, this.#options, () => {
      if (this.#controllers.get(String(fileId)) === controller) this.#controllers.delete(String(fileId));
    });
    this.#controllers.set(String(fileId), controller);
    await controller.initialize();
    return controller;
  }

  controller(fileId: WorkspaceFileId): EditorController | undefined {
    return this.#controllers.get(String(fileId));
  }

  close(fileId: WorkspaceFileId): void {
    const controller = this.#controllers.get(String(fileId));
    if (controller === undefined) return;
    this.#controllers.delete(String(fileId));
    controller.dispose();
    this.#options.sessions.close(fileId);
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    for (const [key, controller] of this.#controllers) {
      controller.dispose();
      this.#options.sessions.close(key as WorkspaceFileId);
    }
    this.#controllers.clear();
  }
}
