import { autocompletion, type CompletionSource } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { lintGutter, setDiagnostics, type Diagnostic } from '@codemirror/lint';
import { EditorSelection, EditorState, Transaction, type Extension } from '@codemirror/state';
import { drawSelection, EditorView, hoverTooltip, keymap, type ViewUpdate } from '@codemirror/view';

import type {
  EditorController,
  EditorEvent,
  EditorSelection as CoreSelection,
  EditorSnapshot,
  EditorTextEdit,
  EditorTransaction,
} from '@abnt/editor-core';
import type { LanguageDiagnostic, LanguageService } from '@abnt/language-service';

import type {
  CodeMirrorDiagnostic,
  CodeMirrorEditorAdapter,
  CodeMirrorEditorAdapterOptions,
  ToCodeMirrorDiagnostics,
} from './model.js';

const clamp = (offset: number, length: number): number => Math.max(0, Math.min(offset, length));

const sameSelection = (left: CoreSelection, right: CoreSelection): boolean =>
  left.anchor === right.anchor && left.head === right.head;

const selectionOf = (snapshot: EditorSnapshot): CoreSelection => snapshot.selection;

const selectionFromView = (view: EditorView): CoreSelection => ({
  anchor: view.state.selection.main.anchor,
  head: view.state.selection.main.head,
});

const transactionFromUpdate = (update: ViewUpdate): EditorTransaction | undefined => {
  if (!update.docChanged && !update.selectionSet) return undefined;
  const edits: EditorTextEdit[] = [];
  if (update.docChanged) {
    update.changes.iterChanges((from, to, _fromAfter, _toAfter, inserted) => {
      edits.push({ range: { start: from, end: to }, text: inserted.toString() });
    });
  }
  return {
    ...(edits.length > 0 ? { edits } : {}),
    selection: selectionFromView(update.view),
  };
};

const severity = (value: LanguageDiagnostic['severity']): CodeMirrorDiagnostic['severity'] => value;

/** Diagnósticos sem SourceRange aparecem no início, sem extrapolar o documento. */
export const toCodeMirrorDiagnostics: ToCodeMirrorDiagnostics = (diagnostics, documentLength) =>
  diagnostics.map((diagnostic) => {
    const from = clamp(diagnostic.source?.start.offset ?? 0, documentLength);
    const to = clamp(diagnostic.source?.end.offset ?? from, documentLength);
    return {
      from,
      to: Math.max(from, to),
      severity: severity(diagnostic.severity),
      message: diagnostic.message,
      source: diagnostic.id,
    };
  });

const asLintDiagnostics = (diagnostics: readonly CodeMirrorDiagnostic[]): readonly Diagnostic[] => diagnostics;

const completionSource = (language: LanguageService, fileId: EditorController['fileId']): CompletionSource =>
  async (context) => {
    const result = await language.completions({ fileId, offset: context.pos });
    if (context.aborted || result === undefined || result.items.length === 0) return null;
    return {
      from: clamp(result.range.start, context.state.doc.length),
      to: clamp(result.range.end, context.state.doc.length),
      options: result.items.map((item) => ({
        label: item.label,
        ...(item.detail !== undefined ? { detail: item.detail } : {}),
        type: item.kind === 'citation' ? 'reference' : item.kind === 'math' ? 'keyword' : 'link',
        apply: item.insertText,
      })),
    };
  };

const hoverExtension = (language: LanguageService, fileId: EditorController['fileId']): Extension =>
  hoverTooltip(async (view, position) => {
    const hover = await language.hover({ fileId, offset: position });
    if (hover === undefined) return null;
    const from = clamp(hover.range.start, view.state.doc.length);
    const to = clamp(hover.range.end, view.state.doc.length);
    if (position < from || position > to) return null;
    return {
      pos: from,
      ...(to !== from ? { end: to } : {}),
      create: (currentView) => {
        const dom = currentView.dom.ownerDocument.createElement('div');
        dom.className = 'abnt-editor-hover';
        dom.textContent = hover.contents.join('\n');
        return { dom };
      },
    };
  });

const languageNavigation = (
  language: LanguageService,
  fileId: EditorController['fileId'],
  onDefinition: ((locations: readonly import('@abnt/language-service').LanguageLocation[]) => void) | undefined,
  onReferences: ((locations: readonly import('@abnt/language-service').LanguageLocation[]) => void) | undefined,
  onError: ((error: unknown) => void) | undefined,
): Extension =>
  keymap.of([
    {
      key: 'Mod-Enter',
      run: (view) => {
        void language.definition({ fileId, offset: view.state.selection.main.head })
          .then((locations) => onDefinition?.(locations))
          .catch(onError);
        return true;
      },
    },
    {
      key: 'Mod-Shift-Enter',
      run: (view) => {
        void language.references({ fileId, offset: view.state.selection.main.head })
          .then((locations) => onReferences?.(locations))
          .catch(onError);
        return true;
      },
    },
  ]);

/**
 * Ponte fina entre uma EditorView e um EditorController.
 *
 * Toda mudança originada na view vira transação do core. Atualizações vindas da
 * sessão/controller são aplicadas de volta com `addToHistory: false`, para que
 * não virem uma segunda autoria nem poluam undo/redo.
 */
export class CodeMirrorEditorAdapterService implements CodeMirrorEditorAdapter {
  readonly controller;
  readonly view: EditorView;
  readonly #onError: ((error: unknown) => void) | undefined;
  #unsubscribe: (() => void) | undefined;
  #applyingController = false;
  #destroyed = false;

  constructor(options: CodeMirrorEditorAdapterOptions) {
    this.controller = options.controller;
    this.#onError = options.onError;
    const snapshot = this.controller.snapshot();
    const extensions: Extension[] = [
      history(),
      keymap.of([...historyKeymap, ...defaultKeymap]),
      drawSelection(),
      // Em uma view estreita (split editor/preview), Markdown continua legível
      // sem criar uma linha horizontal interminável. Offsets seguem UTF-16,
      // portanto o wrapping é puramente visual e não toca o documento.
      EditorView.lineWrapping,
      markdown(),
      lintGutter(),
      autocompletion({ override: [completionSource(options.language, this.controller.fileId)] }),
      hoverExtension(options.language, this.controller.fileId),
      languageNavigation(options.language, this.controller.fileId, options.onDefinition, options.onReferences, this.#onError),
      EditorView.domEventHandlers({
        mousedown: (event, view) => {
          if (options.onCitationClick === undefined) return false;
          const position = view.posAtCoords({ x: event.clientX, y: event.clientY });
          if (position !== null) options.onCitationClick(position);
          return false;
        },
      }),
      EditorView.updateListener.of((update) => this.#handleViewUpdate(update)),
      ...(options.extensions === undefined ? [] : [options.extensions]),
    ];
    const state = EditorState.create({
      doc: snapshot.session.content,
      selection: EditorSelection.single(snapshot.selection.anchor, snapshot.selection.head),
      extensions,
    });
    this.view = new EditorView({ state, parent: options.parent });
    this.#renderSnapshot(snapshot);
    this.#unsubscribe = this.controller.subscribe((event) => this.#handleControllerEvent(event));
  }

  static create(options: CodeMirrorEditorAdapterOptions): CodeMirrorEditorAdapterService {
    return new CodeMirrorEditorAdapterService(options);
  }

  snapshot(): EditorSnapshot {
    return this.controller.snapshot();
  }

  async save(): Promise<EditorSnapshot> {
    this.#requireActive();
    return this.controller.save();
  }

  focus(): void {
    this.#requireActive();
    this.view.focus();
  }

  destroy(): void {
    if (this.#destroyed) return;
    this.#destroyed = true;
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
    this.view.destroy();
  }

  #handleViewUpdate(update: ViewUpdate): void {
    if (this.#destroyed || this.#applyingController) return;
    const transaction = transactionFromUpdate(update);
    if (transaction === undefined) return;
    try {
      this.#applyingController = true;
      const snapshot = this.controller.dispatch(transaction);
      this.#renderSnapshot(snapshot);
    } catch (error) {
      this.#onError?.(error);
      this.#renderSnapshot(this.controller.snapshot());
    } finally {
      this.#applyingController = false;
    }
  }

  #handleControllerEvent(event: EditorEvent): void {
    if (this.#destroyed) return;
    if (event.type === 'editor:closed') {
      this.destroy();
      return;
    }
    if (this.#applyingController) return;
    this.#renderSnapshot(event.snapshot);
  }

  #renderSnapshot(snapshot: EditorSnapshot): void {
    if (this.#destroyed) return;
    const content = snapshot.session.content;
    const selection = selectionOf(snapshot);
    const currentContent = this.view.state.doc.toString();
    const currentSelection = selectionFromView(this.view);
    const contentChanged = currentContent !== content;
    const selectionChanged = !sameSelection(currentSelection, selection);
    this.#applyingController = true;
    try {
      if (contentChanged || selectionChanged) {
        this.view.dispatch({
          ...(contentChanged ? { changes: { from: 0, to: currentContent.length, insert: content } } : {}),
          ...(selectionChanged ? { selection: EditorSelection.single(selection.anchor, selection.head) } : {}),
          // Só revela quando a seleção muda sem edição junto — é o caso de navegação
          // externa (clique no outline, "ir para referência"), não o de uma edição
          // remota chegando enquanto o usuário olha outra parte do documento.
          ...(selectionChanged && !contentChanged ? { scrollIntoView: true } : {}),
          annotations: Transaction.addToHistory.of(false),
        });
      }
      this.view.dispatch({
        ...setDiagnostics(this.view.state, asLintDiagnostics(toCodeMirrorDiagnostics(snapshot.diagnostics, content.length))),
        annotations: Transaction.addToHistory.of(false),
      });
    } finally {
      this.#applyingController = false;
    }
  }

  #requireActive(): void {
    if (this.#destroyed) throw new Error('O adaptador CodeMirror já foi descartado.');
  }
}
