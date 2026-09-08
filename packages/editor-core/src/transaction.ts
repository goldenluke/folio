import type { EditorSelection, EditorTextEdit, EditorTransaction } from './model.js';

interface NormalizedEdit extends EditorTextEdit {}

/** Erro determinístico para uma transação que não pode ser aplicada. */
export class EditorTransactionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EditorTransactionError';
  }
}

export interface AppliedEditorTransaction {
  readonly content: string;
  readonly selection: EditorSelection;
}

const clamp = (offset: number, content: string): number => Math.max(0, Math.min(offset, content.length));

const validateSelection = (selection: EditorSelection, content: string): EditorSelection => {
  if (!Number.isInteger(selection.anchor) || !Number.isInteger(selection.head)) {
    throw new EditorTransactionError('A seleção precisa usar offsets inteiros.');
  }
  if (selection.anchor < 0 || selection.anchor > content.length || selection.head < 0 || selection.head > content.length) {
    throw new EditorTransactionError('A seleção está fora dos limites do documento.');
  }
  return selection;
};

const normalizeEdits = (edits: readonly EditorTextEdit[] | undefined, content: string): readonly NormalizedEdit[] => {
  if (edits === undefined || edits.length === 0) return [];
  const ordered = [...edits].sort((left, right) => left.range.start - right.range.start || left.range.end - right.range.end);
  let previous: NormalizedEdit | undefined;
  for (const edit of ordered) {
    if (
      !Number.isInteger(edit.range.start) ||
      !Number.isInteger(edit.range.end) ||
      edit.range.start < 0 ||
      edit.range.end < edit.range.start ||
      edit.range.end > content.length
    ) {
      throw new EditorTransactionError('Uma edição possui intervalo inválido.');
    }
    if (
      previous !== undefined &&
      (previous.range.end > edit.range.start ||
        (previous.range.start === previous.range.end &&
          edit.range.start === edit.range.end &&
          previous.range.start === edit.range.start))
    ) {
      throw new EditorTransactionError('Uma transação não pode conter edições sobrepostas.');
    }
    previous = edit;
  }
  return ordered;
};

const applyEdits = (content: string, edits: readonly NormalizedEdit[]): string =>
  [...edits]
    .reverse()
    .reduce((next, edit) => `${next.slice(0, edit.range.start)}${edit.text}${next.slice(edit.range.end)}`, content);

const transformOffset = (offset: number, edits: readonly NormalizedEdit[]): number => {
  let result = offset;
  for (const edit of edits) {
    if (result < edit.range.start) continue;
    if (result > edit.range.end) {
      result += edit.text.length - (edit.range.end - edit.range.start);
      continue;
    }
    result = edit.range.start + edit.text.length;
  }
  return result;
};

const transformedSelection = (selection: EditorSelection, edits: readonly NormalizedEdit[], content: string): EditorSelection => ({
  anchor: clamp(transformOffset(selection.anchor, edits), content),
  head: clamp(transformOffset(selection.head, edits), content),
});

/**
 * Aplica uma transação sem conhecer sessão, CodeMirror ou transporte.
 * O controller local e a projeção remota usam exatamente esta semântica.
 */
export function applyEditorTransaction(
  content: string,
  selection: EditorSelection,
  transaction: EditorTransaction,
): AppliedEditorTransaction {
  const edits = normalizeEdits(transaction.edits, content);
  const nextContent = applyEdits(content, edits);
  const nextSelection =
    transaction.selection === undefined
      ? transformedSelection(selection, edits, nextContent)
      : validateSelection(transaction.selection, nextContent);
  return { content: nextContent, selection: nextSelection };
}
