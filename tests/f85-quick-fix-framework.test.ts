import { expect, it } from 'vitest';

import { codeActionsForProblem } from '../apps/desktop/src/renderer/shell/diagnostic-actions.js';

it('F85 — quick fix só produz WorkspaceEdit determinístico para diagnóstico seguro', () => {
  const [action] = codeActionsForProblem({
    fileId: 'file_figure', path: 'figuras.md', revision: 7, severity: 'warning',
    ruleId: 'ABNT-6022-FIG-001', message: 'Legenda ausente.', range: { start: 12, end: 30 },
  }, '# Método\n\n![gráfico](grafico.png)\n');
  expect(action).toMatchObject({
    id: 'figure.add-caption',
    edit: { fileId: 'file_figure', expectedRevision: 7, edits: [{ range: { start: 10, end: 10 }, text: 'Figura: [Preencher legenda]\n' }] },
  });
  expect(codeActionsForProblem({ fileId: 'file', path: 'a.md', revision: 1, severity: 'error', ruleId: 'CIT-REF-AUSENTE', message: 'Escolha uma referência.', range: { start: 0, end: 1 } }, 'x')).toEqual([]);
});
