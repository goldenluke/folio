/**
 * @abnt/editor-core — controlador headless de texto, seleção e projeções.
 *
 * O package não renderiza nada: CodeMirror, React e um futuro LSP adaptam este
 * contrato em vez de reimplementar sessão, offsets ou concorrência.
 */

export { EditorWorkspaceService } from './editor-workspace.js';
export { applyEditorTransaction, EditorTransactionError } from './transaction.js';
export type { AppliedEditorTransaction } from './transaction.js';
export type {
  EditorController,
  EditorEvent,
  EditorEventListener,
  EditorSelection,
  EditorSnapshot,
  EditorTextEdit,
  EditorTransaction,
  EditorWorkspace,
  EditorWorkspaceOptions,
} from './model.js';
