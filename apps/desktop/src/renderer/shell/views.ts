import type { EditorController, EditorSnapshot } from '@abnt/editor-core';
import type { EditorPreviewDto } from '@abnt/protocol';

/**
 * Uma tab é uma projeção visual; a sessão documental é autoridade à parte e
 * pode sobreviver ao fechamento da tab. Fechar uma tab decide explicitamente
 * se a sessão remota também fecha — nunca o contrário. Ver "Tab não é Session"
 * no roteiro de P9 e o invariante equivalente do adaptador CodeMirror (P7):
 * destruir a view não destrói o documento.
 */
export type ViewId = string & { readonly __brand: 'ViewId' };
export const asViewId = (value: string): ViewId => value as ViewId;

export interface EditorViewState {
  readonly id: ViewId;
  readonly type: 'editor';
  readonly fileId: string;
  readonly path: string;
  readonly controller: EditorController;
  readonly snapshot: EditorSnapshot;
}

/**
 * Uma tab de preview não tem controller nem sessão própria: ela só exibe o
 * último HTML pedido para `fileId`. `preview` fica `undefined` até a primeira
 * resposta chegar, ou se a sessão nunca produziu uma compilação bem-sucedida.
 */
export interface PreviewViewState {
  readonly id: ViewId;
  readonly type: 'preview';
  readonly fileId: string;
  readonly path: string;
  readonly preview: EditorPreviewDto | undefined;
  readonly loading: boolean;
}

export interface PdfViewState {
  readonly id: ViewId;
  readonly type: 'pdf';
  readonly fileId: string;
  readonly path: string;
  /** Destino transitório de navegação; o PDF continua sendo identificado só pelo arquivo. */
  readonly page?: number;
  /** Contexto transitório do handoff de pesquisa; não é persistido no vault. */
  readonly researchContext?: PdfResearchContext;
}

export interface PdfResearchContext { readonly referenceId?: string; readonly reviewId?: string; readonly searchRunId?: string; readonly artifactId?: string; }

export interface BrowserViewState {
  readonly id: ViewId;
  readonly type: 'browser';
  readonly url: string;
  readonly title: string;
}

export type ViewState = EditorViewState | PreviewViewState | PdfViewState | BrowserViewState;

export type ViewsEvent = { readonly type: 'views:changed'; readonly views: readonly ViewState[]; readonly activeId: ViewId | undefined };
export type ViewsListener = (event: ViewsEvent) => void;

export interface ViewsModel {
  openEditor(options: { readonly fileId: string; readonly path: string; readonly controller: EditorController; readonly snapshot: EditorSnapshot; readonly duplicate?: boolean }): ViewId;
  openPreview(options: { readonly fileId: string; readonly path: string; readonly activate?: boolean }): ViewId;
  openPdf(options: { readonly fileId: string; readonly path: string; readonly page?: number; readonly researchContext?: PdfResearchContext }): ViewId;
  openBrowser(options?: { readonly url?: string }): ViewId;
  updateBrowser(id: ViewId, details: { readonly url: string; readonly title: string }): void;
  activate(id: ViewId): void;
  updateSnapshot(fileId: string, snapshot: EditorSnapshot): void;
  /** `undefined` só é um estado de carregamento válido antes da primeira resposta chegar. */
  updatePreview(fileId: string, preview: EditorPreviewDto | undefined): void;
  /** Reordena a tab sem tocar em sessão, documento ou preview. */
  reorder(id: ViewId, beforeId: ViewId): void;
  /** Remove a tab da lista e devolve o estado removido para o chamador decidir o destino do controller. */
  close(id: ViewId): ViewState | undefined;
  /** Esvazia a lista de uma vez (troca de vault); o chamador descarta os controllers devolvidos. */
  closeAll(): readonly ViewState[];
  list(): readonly ViewState[];
  active(): ViewState | undefined;
  subscribe(listener: ViewsListener): () => void;
}

let counter = 0;
const nextViewId = (): ViewId => asViewId(`view_${(counter += 1)}`);

export function createViewsModel(): ViewsModel {
  let views: ViewState[] = [];
  let activeId: ViewId | undefined;
  const listeners = new Set<ViewsListener>();

  const emit = (): void => {
    const event: ViewsEvent = { type: 'views:changed', views, activeId };
    for (const listener of listeners) listener(event);
  };

  return {
    openEditor({ fileId, path, controller, snapshot, duplicate = false }) {
      const existing = views.find((view) => view.type === 'editor' && view.fileId === fileId);
      if (!duplicate && existing !== undefined) {
        activeId = existing.id;
        emit();
        return existing.id;
      }
      const id = nextViewId();
      views = [...views, { id, type: 'editor', fileId, path, controller, snapshot }];
      activeId = id;
      emit();
      return id;
    },
    openPreview({ fileId, path, activate = true }) {
      const existing = views.find((view) => view.type === 'preview' && view.fileId === fileId);
      if (existing !== undefined) {
        if (activate && activeId !== existing.id) {
          activeId = existing.id;
          emit();
        }
        return existing.id;
      }
      const id = nextViewId();
      views = [...views, { id, type: 'preview', fileId, path, preview: undefined, loading: true }];
      if (activate || activeId === undefined) activeId = id;
      emit();
      return id;
    },
    openPdf({ fileId, path, page, researchContext }) {
      const existing = views.find((view) => view.type === 'pdf' && view.fileId === fileId);
      if (existing !== undefined) {
        activeId = existing.id;
        views = views.map((view) => view.id === existing.id ? { ...view, ...(page === undefined ? {} : { page }), ...(researchContext === undefined ? {} : { researchContext }) } : view);
        emit();
        return existing.id;
      }
      const id = nextViewId();
      views = [...views, { id, type: 'pdf', fileId, path, ...(page === undefined ? {} : { page }), ...(researchContext === undefined ? {} : { researchContext }) }];
      activeId = id;
      emit();
      return id;
    },
    openBrowser({ url = 'https://scholar.google.com/' } = {}) {
      const id = nextViewId();
      views = [...views, { id, type: 'browser', url, title: 'Navegador' }];
      activeId = id;
      emit();
      return id;
    },
    updateBrowser(id, details) {
      const current = views.find((view) => view.id === id);
      if (current === undefined || current.type !== 'browser' || (current.url === details.url && current.title === details.title)) return;
      views = views.map((view) => view.id === id && view.type === 'browser' ? { ...view, ...details } : view);
      emit();
    },
    activate(id) {
      if (!views.some((view) => view.id === id) || activeId === id) return;
      activeId = id;
      emit();
    },
    updateSnapshot(fileId, snapshot) {
      let changed = false;
      views = views.map((current) => {
        if (current.type !== 'editor' || current.fileId !== fileId) return current;
        changed = true;
        return { ...current, snapshot };
      });
      if (!changed) return;
      emit();
    },
    updatePreview(fileId, preview) {
      const index = views.findIndex((view) => view.type === 'preview' && view.fileId === fileId);
      if (index === -1) return;
      const current = views[index];
      if (current === undefined || current.type !== 'preview') return;
      views = [...views.slice(0, index), { ...current, preview, loading: false }, ...views.slice(index + 1)];
      emit();
    },
    reorder(id, beforeId) {
      if (id === beforeId) return;
      const from = views.findIndex((view) => view.id === id);
      const to = views.findIndex((view) => view.id === beforeId);
      if (from === -1 || to === -1) return;
      const moved = views[from];
      if (moved === undefined) return;
      const next = views.filter((view) => view.id !== id);
      const target = next.findIndex((view) => view.id === beforeId);
      if (target === -1) return;
      views = [...next.slice(0, target), moved, ...next.slice(target)];
      emit();
    },
    close(id) {
      const index = views.findIndex((view) => view.id === id);
      if (index === -1) return undefined;
      const removed = views[index];
      views = [...views.slice(0, index), ...views.slice(index + 1)];
      if (activeId === id) {
        const fallback = views[index] ?? views[index - 1];
        activeId = fallback?.id;
      }
      emit();
      return removed;
    },
    closeAll() {
      const removed = views;
      views = [];
      activeId = undefined;
      emit();
      return removed;
    },
    list() {
      return views;
    },
    active() {
      return views.find((view) => view.id === activeId);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
