import type { Extension } from '@codemirror/state';
import type { EditorViewConfig } from '@codemirror/view';

import type { EditorController, EditorSnapshot } from '@abnt/editor-core';
import type { LanguageDiagnostic, LanguageLocation, LanguageService } from '@abnt/language-service';

/** Opções do adaptador visual; o controller continua sendo autoridade do texto. */
export interface CodeMirrorEditorAdapterOptions {
  readonly controller: EditorController;
  readonly language: LanguageService;
  /** Elemento ou ShadowRoot onde a view será montada. */
  readonly parent: NonNullable<EditorViewConfig['parent']>;
  /** Extensões visuais do host, sem acesso a workspace ou sessões. */
  readonly extensions?: Extension;
  /** Falhas de ponte não devem escapar pelo event loop do editor. */
  readonly onError?: (error: unknown) => void;
  /** Navegação vem do host; o adapter não conhece tabs, React nem workspace. */
  readonly onDefinition?: (locations: readonly LanguageLocation[]) => void;
  readonly onReferences?: (locations: readonly LanguageLocation[]) => void;
  /** O host decide se a posição corresponde a uma citação editável. */
  readonly onCitationClick?: (offset: number) => void;
}

export interface CodeMirrorDiagnostic {
  readonly from: number;
  readonly to: number;
  readonly severity: 'info' | 'warning' | 'error';
  readonly message: string;
  readonly source: string;
}

export interface CodeMirrorEditorAdapter {
  readonly controller: EditorController;
  readonly view: import('@codemirror/view').EditorView;
  snapshot(): EditorSnapshot;
  save(): Promise<EditorSnapshot>;
  focus(): void;
  destroy(): void;
}

/** Converte diagnósticos do language service para intervalos seguros do CodeMirror. */
export type ToCodeMirrorDiagnostics = (
  diagnostics: readonly LanguageDiagnostic[],
  documentLength: number,
) => readonly CodeMirrorDiagnostic[];
