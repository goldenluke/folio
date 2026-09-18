import { describe, expect, it } from 'vitest';

import { buildWorkspaceFileTree, isExplorerVisibleFile } from '../apps/desktop/src/renderer/file-explorer.js';

const file = (path: string) => ({ fileId: path, path, revision: 1, contentHash: 'hash' });

describe('F564 — explorador focado em autoria', () => {
  it('oculta código, configuração e metadados operacionais', () => {
    for (const path of ['package.json', 'scripts/build.ts', 'theme.css', 'scripts/export.lua', 'modelo.tex', 'abnt.sty', 'DO_NOT_DELETE.txt', '.academic/home/layout.json', 'node_modules/x/index.js']) {
      expect(isExplorerVisibleFile(file(path))).toBe(false);
    }
  });

  it('mantém documentos e anexos acadêmicos na árvore', () => {
    const tree = buildWorkspaceFileTree([file('tcc/index.md'), file('assets/artigo.pdf'), file('figuras/grafico.png'), file('config.json')]);
    expect(tree.directories.map((directory) => directory.name)).toEqual(['assets', 'figuras', 'tcc']);
    expect(tree.directories.find((directory) => directory.name === 'tcc')?.files.map((item) => item.path)).toEqual(['tcc/index.md']);
  });
});
