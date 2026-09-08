import { expect, it } from 'vitest';

import { importLibraryContent } from '../apps/desktop/src/workspace/library-import.js';

it('F10 — exportação CSL-JSON do Zotero converge para a biblioteca canônica', () => {
  const result = importLibraryContent('csl-json', JSON.stringify([{ id: 'zotero2024', type: 'book', title: 'Livro do Zotero' }]));
  expect(result).toMatchObject({ entries: { zotero2024: { type: 'book', title: 'Livro do Zotero' } }, diagnostics: [] });
});
