import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it } from 'vitest';

import { WORKSPACE_INDEX_SCHEMA_VERSION, SqliteWorkspaceIndex } from '@abnt/workspace-index';
import type {
  CreateWorkspaceFileRequest,
  RenameWorkspaceFileRequest,
  WorkspaceConfiguration,
  WorkspaceEvent,
  WorkspaceEventListener,
  WorkspaceFile,
  WorkspaceFileContent,
  WorkspaceFileId,
  WorkspacePath,
  WorkspaceStorage,
  WriteWorkspaceFileRequest,
} from '@abnt/workspace-core';
import { LocalFilesystemStorage } from '@abnt/workspace-local';

const ARTICLE = `---
title: "Sistemas Distribuídos"
---

# Introdução

Sistemas distribuídos exigem coordenação [@tanenbaum2017, p. 32].
Veja também [as notas](notas.md).

![Modelo de arquitetura](figuras/modelo.svg)
`;

const UPDATED_ARTICLE = `${ARTICLE}
# Resultados

Os resultados confirmam a hipótese.
`;

const withVault = async (run: (root: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), 'abnt-p3-'));
  try {
    await mkdir(join(root, 'figuras'), { recursive: true });
    await writeFile(join(root, 'artigo.md'), ARTICLE, 'utf8');
    await writeFile(join(root, 'notas.md'), '# Notas\n\nConhecimento relacionado.\n', 'utf8');
    await writeFile(join(root, 'figuras', 'modelo.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>', 'utf8');
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

/** Permite reproduzir um evento que foi enfileirado antes de o arquivo sumir. */
class EventInjectingStorage implements WorkspaceStorage {
  readonly #listeners = new Set<WorkspaceEventListener>();
  readonly #delegate: WorkspaceStorage;

  constructor(delegate: WorkspaceStorage) {
    this.#delegate = delegate;
  }

  open() {
    return this.#delegate.open();
  }

  close() {
    return this.#delegate.close();
  }

  list(path?: WorkspacePath) {
    return this.#delegate.list(path);
  }

  read(fileId: WorkspaceFileId): Promise<WorkspaceFileContent> {
    return this.#delegate.read(fileId);
  }

  write(request: WriteWorkspaceFileRequest): Promise<WorkspaceFile> {
    return this.#delegate.write(request);
  }

  create(request: CreateWorkspaceFileRequest): Promise<WorkspaceFile> {
    return this.#delegate.create(request);
  }

  rename(request: RenameWorkspaceFileRequest): Promise<WorkspaceFile> {
    return this.#delegate.rename(request);
  }

  configuration(): Promise<WorkspaceConfiguration> {
    return this.#delegate.configuration();
  }

  updateConfiguration(configuration: WorkspaceConfiguration): Promise<void> {
    return this.#delegate.updateConfiguration(configuration);
  }

  refresh() {
    return this.#delegate.refresh();
  }

  subscribe(listener: WorkspaceEventListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  emit(event: WorkspaceEvent): void {
    for (const listener of this.#listeners) listener(event);
  }
}

describe('P3 — índice SQLite reconstruível', () => {
  it('indexa headings, links, citações, recursos e FTS5', async () => {
    await withVault(async (root) => {
      const storage = LocalFilesystemStorage.create(root);
      const index = SqliteWorkspaceIndex.create({
        storage,
        databasePath: join(root, '.academic', 'index.sqlite'),
      });

      try {
        const initial = await index.open();
        const article = (await storage.list()).find((file) => file.path === 'artigo.md');
        if (article === undefined) throw new Error('Artigo não encontrado no workspace.');

        expect(initial.indexed).toBe(3);
        expect(index.stats()).toMatchObject({
          schemaVersion: WORKSPACE_INDEX_SCHEMA_VERSION,
          files: 3,
          markdownFiles: 2,
          headings: 2,
          links: 1,
          citations: 1,
          resources: 1,
        });
        expect(index.search('sistemas').map((result) => result.path)).toContain('artigo.md');
        expect(index.headings(article.id)).toContainEqual(expect.objectContaining({ title: 'Introdução' }));
        expect(index.links(article.id)).toContainEqual(
          expect.objectContaining({ target: 'notas.md', kind: 'document', label: 'as notas' }),
        );
        expect(index.citations(article.id)).toContainEqual(
          expect.objectContaining({ referenceId: 'tanenbaum2017', locatorType: 'page', locatorValue: '32' }),
        );
        expect(index.resources(article.id)).toContainEqual(
          expect.objectContaining({ uri: 'figuras/modelo.svg' }),
        );

        await expect(index.synchronize()).resolves.toEqual({ indexed: 0, skipped: 3, removed: 0 });
      } finally {
        await index.close();
        await storage.close();
      }
    });
  });

  it('atualiza incrementalmente por eventos e reconstrói após apagar index.sqlite', async () => {
    await withVault(async (root) => {
      const storage = LocalFilesystemStorage.create(root);
      const databasePath = join(root, '.academic', 'index.sqlite');
      const index = SqliteWorkspaceIndex.create({ storage, databasePath });
      await index.open();
      const article = (await storage.list()).find((file) => file.path === 'artigo.md');
      if (article === undefined) throw new Error('Artigo não encontrado no workspace.');

      await storage.write({
        fileId: article.id,
        content: UPDATED_ARTICLE,
        expectedRevision: article.revision,
      });
      await index.idle();
      expect(index.headings(article.id)).toContainEqual(expect.objectContaining({ title: 'Resultados' }));

      const renamed = await storage.rename({
        fileId: article.id,
        path: 'artigos/distribuidos.md' as typeof article.path,
        expectedRevision: article.revision + 1,
      });
      await index.idle();
      expect(index.search('coordenação')).toContainEqual(
        expect.objectContaining({ fileId: renamed.id, path: 'artigos/distribuidos.md' }),
      );

      await index.close();
      await rm(databasePath, { force: true });
      await rm(`${databasePath}-wal`, { force: true });
      await rm(`${databasePath}-shm`, { force: true });

      const rebuilt = SqliteWorkspaceIndex.create({ storage, databasePath });
      try {
        await expect(rebuilt.open()).resolves.toMatchObject({ indexed: 3, removed: 0 });
        expect(rebuilt.stats().files).toBe(3);
        expect(rebuilt.search('resultados')).toContainEqual(
          expect.objectContaining({ fileId: article.id, path: 'artigos/distribuidos.md' }),
        );
      } finally {
        await rebuilt.close();
        await storage.close();
      }
    });
  });

  it('trata evento obsoleto de arquivo removido como remoção da projeção', async () => {
    await withVault(async (root) => {
      const localStorage = LocalFilesystemStorage.create(root);
      const storage = new EventInjectingStorage(localStorage);
      const index = SqliteWorkspaceIndex.create({
        storage,
        databasePath: join(root, '.academic', 'index.sqlite'),
      });

      try {
        await index.open();
        const article = (await storage.list()).find((file) => file.path === 'artigo.md');
        if (article === undefined) throw new Error('Artigo não encontrado no workspace.');

        await rm(join(root, 'artigo.md'));
        storage.emit({ type: 'workspace:file-changed', file: article });

        await expect(index.idle()).resolves.toBeUndefined();
        expect(index.stats().files).toBe(2);
        expect(index.search('sistemas')).not.toContainEqual(expect.objectContaining({ fileId: article.id }));
      } finally {
        await index.close();
        await localStorage.close();
      }
    });
  });
});
