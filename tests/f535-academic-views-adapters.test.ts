import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('BT — Academic Views product adapters', () => {
  it('expõe as fontes reais e a configuração declarativa da view', () => {
    const source = readFileSync('apps/desktop/src/renderer/academic-views.tsx', 'utf8');
    for (const value of ['documents', 'references', 'literature-notes', 'projects', 'datasets', 'review-studies', 'annotations']) expect(source).toContain(`'${value}'`);
    for (const value of ['table', 'list', 'cards', 'board', 'calendar', 'timeline', 'chart']) expect(source).toContain(`'${value}'`);
    for (const value of ['filterQuery', 'sortField', 'groupField', 'draftColumns', 'rollup', 'formula', 'relation', 'rowsForView']) expect(source).toContain(value);
    expect(source).toContain('setAcademicViews');
  });
});
