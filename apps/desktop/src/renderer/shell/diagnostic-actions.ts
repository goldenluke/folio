import type { WorkspaceProblemDto } from '@abnt/protocol';

/** F85: contrato explícito e revisionado para correções determinísticas. */
export interface DiagnosticWorkspaceEdit {
  readonly fileId: string;
  readonly expectedRevision: number;
  readonly edits: readonly { readonly range: { readonly start: number; readonly end: number }; readonly text: string }[];
}

export interface DiagnosticCodeAction {
  readonly id: string;
  readonly title: string;
  readonly edit: DiagnosticWorkspaceEdit;
}

const lineBounds = (content: string, offset: number): { readonly start: number; readonly end: number } => {
  const start = content.lastIndexOf('\n', offset) + 1;
  const ending = content.indexOf('\n', offset);
  return { start, end: ending < 0 ? content.length : ending };
};

/** Não interpreta significado acadêmico: só oferece transformações mecânicas seguras. */
export function codeActionsForProblem(problem: WorkspaceProblemDto, content: string): readonly DiagnosticCodeAction[] {
  if (problem.range === undefined) return [];
  const line = lineBounds(content, problem.range.start);
  if (problem.ruleId === 'ABNT-6022-FIG-001') return [{
    id: 'figure.add-caption', title: 'Adicionar legenda de figura',
    edit: { fileId: problem.fileId, expectedRevision: problem.revision, edits: [{ range: { start: line.start, end: line.start }, text: 'Figura: [Preencher legenda]\n' }] },
  }];
  if (problem.ruleId === 'ABNT-6022-FIG-002') return [{
    id: 'figure.add-source', title: 'Adicionar fonte da figura',
    edit: { fileId: problem.fileId, expectedRevision: problem.revision, edits: [{ range: { start: line.end, end: line.end }, text: '\nFonte: [Preencher fonte]' }] },
  }];
  return [];
}
