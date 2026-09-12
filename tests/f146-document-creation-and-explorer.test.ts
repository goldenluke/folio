import { expect, it } from 'vitest';

import { buildWorkspaceFileTree, directoryPathsFor } from '../apps/desktop/src/renderer/file-explorer.js';

it('F146 — o explorador lateral preserva hierarquia de pastas sem transformar path em identidade', () => {
  const tree = buildWorkspaceFileTree([
    { fileId: 'file-article', path: 'artigos/artigo.md', revision: 1, contentHash: 'sha256:article', mediaType: 'text/markdown' },
    { fileId: 'file-method', path: 'tcc/chapters/metodo.md', revision: 1, contentHash: 'sha256:method', mediaType: 'text/markdown' },
    { fileId: 'file-index', path: 'tcc/index.md', revision: 1, contentHash: 'sha256:index', mediaType: 'text/markdown' },
  ]);

  expect(tree.directories.map((directory) => directory.name)).toEqual(['artigos', 'tcc']);
  expect(tree.directories[1]).toMatchObject({
    files: [expect.objectContaining({ fileId: 'file-index' })],
    directories: [{ name: 'chapters', files: [expect.objectContaining({ fileId: 'file-method' })] }],
  });
});

it('F146 — uma pasta vazia materializada por .gitkeep aparece sem expor o marcador operacional', () => {
  const tree = buildWorkspaceFileTree([
    { fileId: 'folder-marker', path: 'notas/.gitkeep', revision: 1, contentHash: 'sha256:folder', mediaType: 'text/plain' },
  ]);

  expect(tree.directories).toHaveLength(1);
  expect(tree.directories[0]).toMatchObject({ name: 'notas', files: [] });
});

it('F146 — revelar um documento conhece todos os diretórios ancestrais', () => {
  expect(directoryPathsFor('pesquisa/campo/notas.md')).toEqual(['pesquisa', 'pesquisa/campo']);
  expect(directoryPathsFor('raiz.md')).toEqual([]);
});
