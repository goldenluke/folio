import { describe, expect, it } from 'vitest';
import { createViewsModel } from '../apps/desktop/src/renderer/shell/views.js';

describe('F571 — CE.1 PDF como arquivo de primeira classe', () => {
  it('mantém uma única tab PDF por WorkspaceFileId, independente do caminho', () => {
    const views = createViewsModel();
    const first = views.openPdf({ fileId: 'pdf-1', path: 'papers/original.pdf' });
    const second = views.openPdf({ fileId: 'pdf-1', path: 'papers/renomeado.pdf' });
    expect(second).toBe(first);
    expect(views.list()).toEqual([expect.objectContaining({ type: 'pdf', fileId: 'pdf-1', path: 'papers/original.pdf' })]);
  });

  it('navega a uma página solicitada sem criar outra tab', () => {
    const views = createViewsModel();
    const first = views.openPdf({ fileId: 'pdf-1', path: 'papers/original.pdf' });
    const second = views.openPdf({ fileId: 'pdf-1', path: 'papers/original.pdf', page: 14 });
    expect(second).toBe(first);
    expect(views.active()).toEqual(expect.objectContaining({ type: 'pdf', fileId: 'pdf-1', page: 14 }));
  });
});
