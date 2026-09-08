/**
 * @abnt/editor-codemirror — adaptador visual do EditorController.
 *
 * Este package pode importar CodeMirror, mas não filesystem, sessões ou UI de
 * aplicação. A autoridade do texto continua no editor-core/P4.
 */

export { CodeMirrorEditorAdapterService, toCodeMirrorDiagnostics } from './editor-codemirror.js';
export type {
  CodeMirrorDiagnostic,
  CodeMirrorEditorAdapter,
  CodeMirrorEditorAdapterOptions,
  ToCodeMirrorDiagnostics,
} from './model.js';
