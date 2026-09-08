import {
  applyEditorTransaction,
  type EditorController,
  type EditorEvent,
  type EditorEventListener,
  type EditorSnapshot,
  type EditorTransaction,
} from '@abnt/editor-core';
import { asDocumentId, type SourceRange } from '@abnt/document-model';
import type {
  LanguageBacklink,
  LanguageCompletionResult,
  LanguageHover,
  LanguageLocation,
  LanguageService,
  LanguageUnlinkedMention,
} from '@abnt/language-service';
import type { AcademicDesktopApi } from '../shared/api.js';
import type { EditorSnapshotDto, ProtocolResult, WorkspaceFileDto } from '@abnt/protocol';
import {
  asContentHash,
  asWorkspaceDocumentId,
  asWorkspaceFileId,
  asWorkspacePath,
  type WorkspaceFile,
} from '@abnt/workspace-core';

const workspaceFile = (file: WorkspaceFileDto): WorkspaceFile => ({
  id: asWorkspaceFileId(file.fileId),
  ...(file.documentId !== undefined ? { documentId: asWorkspaceDocumentId(file.documentId) } : {}),
  path: asWorkspacePath(file.path),
  revision: file.revision,
  contentHash: asContentHash(file.contentHash),
  ...(file.mediaType !== undefined ? { mediaType: file.mediaType } : {}),
});

type SourceRangeDto = NonNullable<EditorSnapshotDto['diagnostics'][number]['source']>;

const source = (value: SourceRangeDto): SourceRange => ({
  documentId: asDocumentId(value.documentId),
  start: value.start,
  end: value.end,
});

const snapshotFromDto = (value: EditorSnapshotDto): EditorSnapshot => ({
  fileId: asWorkspaceFileId(value.fileId),
  version: value.version,
  session: {
    id: asWorkspaceFileId(value.fileId),
    file: workspaceFile(value.session.file),
    revision: value.session.revision,
    content: value.session.content,
    ...(value.session.contentHash !== undefined ? { contentHash: value.session.contentHash } : {}),
    dirty: value.session.dirty,
    status: value.session.status,
    // A sessão carrega DiagnosticDto; o range fica no formato do protocolo.
    diagnostics: value.session.diagnostics,
    ...(value.session.externalChange !== undefined ? { externalChange: workspaceFile(value.session.externalChange) } : {}),
  },
  selection: value.selection,
  outline: value.outline,
  // Já o LanguageDiagnostic usa SourceRange com DocumentId branded. `source` sai do
  // spread de propósito: espalhá-lo junto faria o TS alargar de volta para o DTO.
  diagnostics: value.diagnostics.map(({ source: range, ...resto }) => ({
    ...resto,
    ...(range === undefined ? {} : { source: source(range) }),
  })),
  ...(value.session.externalChange !== undefined ? { externalChange: workspaceFile(value.session.externalChange) } : {}),
});

export interface RemoteEditorControllerOptions {
  readonly api: AcademicDesktopApi;
  readonly snapshot: EditorSnapshotDto;
  readonly onError?: (message: string) => void;
}

/**
 * Projeção assíncrona de um EditorController remoto. A sessão do Workspace
 * Service continua sendo a fonte do texto; esta classe só aplica a transação
 * canônica otimisticamente para manter CodeMirror responsivo.
 */
export class RemoteEditorController implements EditorController {
  readonly fileId;
  readonly #api: AcademicDesktopApi;
  readonly #listeners = new Set<EditorEventListener>();
  readonly #onError: ((message: string) => void) | undefined;
  #state: EditorSnapshot;
  #server: EditorSnapshot;
  #tail: Promise<void> = Promise.resolve();
  #pending = 0;
  #unsubscribe: (() => void) | undefined;
  #disposed = false;

  constructor(options: RemoteEditorControllerOptions) {
    this.#api = options.api;
    this.#onError = options.onError;
    this.#state = snapshotFromDto(options.snapshot);
    this.#server = this.#state;
    this.fileId = this.#state.fileId;
    this.#unsubscribe = this.#api.onEvent((event) => {
      if (event.type === 'desktop:editor-closed' && event.fileId === String(this.fileId)) {
        this.dispose();
        return;
      }
      if (event.type !== 'desktop:editor-updated' || event.snapshot.fileId !== String(this.fileId)) return;
      const next = snapshotFromDto(event.snapshot);
      this.#server = next;
      if (this.#pending === 0 || next.session.content === this.#state.session.content) this.#replace({ ...next, selection: this.#state.selection }, 'editor:changed');
    });
  }

  snapshot(): EditorSnapshot {
    return this.#state;
  }

  dispatch(transaction: EditorTransaction): EditorSnapshot {
    this.#requireActive();
    const applied = applyEditorTransaction(this.#state.session.content, this.#state.selection, transaction);
    const changed = transaction.edits !== undefined && transaction.edits.length > 0;
    const localVersion = this.#state.version + 1;
    // O rascunho editado perde o fingerprint até o host recalcular. `contentHash`
    // é opcional-sem-undefined, então a chave precisa sumir, não virar undefined.
    const { contentHash: _semFingerprint, ...sessionSemHash } = this.#state.session;
    this.#replace(
      {
        ...this.#state,
        version: localVersion,
        session: changed
          ? {
              ...sessionSemHash,
              content: applied.content,
              revision: this.#state.session.revision + 1,
              dirty: true,
              status: 'idle' as const,
              diagnostics: [],
            }
          : { ...this.#state.session, content: applied.content },
        selection: applied.selection,
        ...(changed ? { diagnostics: [], outline: [] } : {}),
      },
      'editor:changed',
    );
    // Seleção é estado da view, não do documento. Isso preserva dois cursores
    // independentes quando duas views apontam para a mesma DocumentSession e
    // também evita uma ida ao processo de workspace para navegação local.
    if (!changed) return this.#state;
    this.#pending += 1;
    this.#tail = this.#tail.then(async () => {
      const result = await this.#api.editor.dispatch({
        fileId: String(this.fileId),
        expectedRevision: this.#server.session.revision,
        transaction,
      });
      this.#pending -= 1;
      await this.#adoptResult(result, localVersion);
    });
    return this.#state;
  }

  async save(): Promise<EditorSnapshot> {
    this.#requireActive();
    await this.#tail;
    const result = await this.#api.editor.save({
      fileId: String(this.fileId),
      expectedRevision: this.#server.session.revision,
    });
    await this.#adoptResult(result, this.#state.version);
    return this.#state;
  }

  async resolveExternalConflict(resolution: 'keep-local' | 'reload-external'): Promise<EditorSnapshot> {
    this.#requireActive();
    await this.#tail;
    const result = await this.#api.editor.resolveConflict({ fileId: String(this.fileId), resolution });
    await this.#adoptResult(result, this.#state.version);
    return this.#state;
  }

  async idle(): Promise<void> {
    await this.#tail;
  }

  subscribe(listener: EditorEventListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
    for (const listener of this.#listeners) listener({ type: 'editor:closed', fileId: this.fileId });
    this.#listeners.clear();
  }

  async #adoptResult(result: ProtocolResult<EditorSnapshotDto>, localVersion: number): Promise<void> {
    if (!result.ok) {
      this.#onError?.(result.error.message);
      const latest = await this.#api.editor.snapshot({ fileId: String(this.fileId) });
      if (latest.ok) {
        const next = snapshotFromDto(latest.value);
        this.#server = next;
        this.#replace({ ...next, selection: this.#state.selection }, 'editor:changed');
      }
      return;
    }
    const next = snapshotFromDto(result.value);
    this.#server = next;
    if (this.#pending === 0 && this.#state.version <= localVersion) this.#replace({ ...next, selection: this.#state.selection }, 'editor:changed');
  }

  #replace(snapshot: EditorSnapshot, type: Extract<EditorEvent['type'], 'editor:changed' | 'editor:projections-updated'>): void {
    if (this.#disposed) return;
    this.#state = snapshot;
    for (const listener of this.#listeners) listener({ type, snapshot });
  }

  #requireActive(): void {
    if (this.#disposed) throw new Error('O controller remoto do editor foi descartado.');
  }
}

const location = (value: { readonly fileId: string; readonly path: string; readonly range: { readonly start: number; readonly end: number } }): LanguageLocation => ({
  fileId: asWorkspaceFileId(value.fileId),
  path: asWorkspacePath(value.path),
  range: value.range,
});

/**
 * Adapter remoto do contrato headless. O renderer só traduz DTOs e guarda a
 * revisão que a view está mostrando; nunca parseia Markdown para "ajudar" o
 * autocomplete ou a navegação.
 */
export function createRemoteLanguageService(
  api: AcademicDesktopApi,
  revisionFor: (fileId: import('@abnt/workspace-core').WorkspaceFileId) => number | undefined,
): LanguageService {
  const revision = (fileId: import('@abnt/workspace-core').WorkspaceFileId): number | undefined => revisionFor(fileId);
  return {
    outline: async () => [], // snapshots do EditorController já carregam esta projeção revisionada.
    diagnostics: async () => [], // snapshots do EditorController já carregam esta projeção revisionada.
    async completions(position, limit): Promise<LanguageCompletionResult | undefined> {
      const expectedRevision = revision(position.fileId);
      if (expectedRevision === undefined) return undefined;
      const result = await api.language.completions({ fileId: String(position.fileId), offset: position.offset, expectedRevision, ...(limit === undefined ? {} : { limit }) });
      return result.ok ? result.value : undefined;
    },
    async hover(position): Promise<LanguageHover | undefined> {
      const expectedRevision = revision(position.fileId);
      if (expectedRevision === undefined) return undefined;
      const result = await api.language.hover({ fileId: String(position.fileId), offset: position.offset, expectedRevision });
      return result.ok ? result.value : undefined;
    },
    async definition(position): Promise<readonly LanguageLocation[]> {
      const expectedRevision = revision(position.fileId);
      if (expectedRevision === undefined) return [];
      const result = await api.language.definition({ fileId: String(position.fileId), offset: position.offset, expectedRevision });
      return result.ok ? result.value.map(location) : [];
    },
    async references(position): Promise<readonly LanguageLocation[]> {
      const expectedRevision = revision(position.fileId);
      if (expectedRevision === undefined) return [];
      const result = await api.language.references({ fileId: String(position.fileId), offset: position.offset, expectedRevision });
      return result.ok ? result.value.map(location) : [];
    },
    async crossReferenceTargets() { return []; },
    async backlinks(fileId): Promise<readonly LanguageBacklink[]> {
      const result = await api.documents.backlinks({ fileId: String(fileId) });
      return result.ok
        ? result.value.map((backlink) => ({ fileId: asWorkspaceFileId(backlink.fileId), path: asWorkspacePath(backlink.path), label: backlink.label, range: backlink.range }))
        : [];
    },
    async unlinkedMentions(fileId): Promise<readonly LanguageUnlinkedMention[]> {
      const expectedRevision = revision(fileId);
      if (expectedRevision === undefined) return [];
      const result = await api.language.unlinkedMentions({ fileId: String(fileId), expectedRevision });
      return result.ok
        ? result.value.map((mention) => ({
            range: mention.range,
            targetFileId: asWorkspaceFileId(mention.targetFileId),
            targetPath: asWorkspacePath(mention.targetPath),
            text: mention.text,
          }))
        : [];
    },
    async writingStatistics(fileId) {
      const expectedRevision = revision(fileId);
      if (expectedRevision === undefined) return { words: 0, characters: 0, paragraphs: 0, citations: 0, figures: 0, tables: 0, equations: 0, estimatedReadingMinutes: 1, sections: [] };
      const result = await api.language.writingStatistics({ fileId: String(fileId), expectedRevision });
      return result.ok ? result.value : { words: 0, characters: 0, paragraphs: 0, citations: 0, figures: 0, tables: 0, equations: 0, estimatedReadingMinutes: 1, sections: [] };
    },
    async rename() { return undefined; }, // Rename cruza o WorkspaceEdit do host, não o adapter do CodeMirror.
    async moveSection() { return undefined; },
  };
}
