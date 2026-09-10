import { expect, it } from 'vitest';

import { activityLabel, appendWorkspaceActivity, defaultLayouts, focusLayout, parseWorkspaceActivity, parseWorkspaceLayouts } from '../apps/desktop/src/renderer/shell/workspace-cohesion.js';
import { createCommandRegistry } from '../apps/desktop/src/renderer/shell/commands.js';
import { rankCommands } from '../apps/desktop/src/renderer/shell/palette.js';

it('F140/F142/F143 — atividade e layouts são estado operacional validado, sem conteúdo autoral', () => {
  expect(parseWorkspaceLayouts(defaultLayouts)).toHaveLength(4);
  expect(focusLayout(defaultLayouts, 'writing')).toMatchObject({ showNavigation: false, showContext: false });
  expect(focusLayout(defaultLayouts, 'reading')).toMatchObject({ showNavigation: true, showContext: false });
  expect(focusLayout(defaultLayouts, 'review')).toMatchObject({ showNavigation: true, showContext: true });
  const activity = appendWorkspaceActivity([], { kind: 'document-edited', fileId: 'metodo' }, 'event-1', '2026-09-09T12:00:00.000Z');
  expect(activity).toEqual([{ id: 'event-1', kind: 'document-edited', fileId: 'metodo', createdAt: '2026-09-09T12:00:00.000Z' }]);
  expect(activityLabel(activity[0]!, 'capitulos/metodo.md')).toBe('Documento editado: capitulos/metodo.md');
  expect(parseWorkspaceActivity([{ ...activity[0], content: 'não pode entrar' }])).toEqual(activity);
});

it('F145 — a mesma Command Palette encontra aliases e expõe categoria/atalho', () => {
  const commands = createCommandRegistry();
  commands.register({ id: 'workspace.home', title: 'Abrir Home', category: 'Workspace', aliases: ['início', 'dashboard'], run: () => {} });
  const item = rankCommands(commands, {}, 'inicio', new Map([['workspace.home', 'mod+h']]), ['workspace.home'])[0];
  expect(item).toMatchObject({ id: 'workspace.home', category: 'Workspace', shortcut: 'mod+h' });
});
