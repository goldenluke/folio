import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rename as renameOnDisk, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it } from 'vitest';

import {
  WorkspaceConflictError,
  asWorkspacePath,
  type WorkspaceEvent,
} from '@abnt/workspace-core';
import { LocalFilesystemStorage } from '@abnt/workspace-local';

const hash = (content: string): string =>
  `sha256:${createHash('sha256').update(content).digest('hex')}`;

const withVault = async (run: (root: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), 'abnt-p2-'));
  try {
    await writeFile(join(root, 'artigo.md'), '# Introdução\n\nVersão inicial.\n', 'utf8');
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

const waitForEvent = <T extends WorkspaceEvent['type']>(
  storage: LocalFilesystemStorage,
  type: T,
): Promise<Extract<WorkspaceEvent, { type: T }>> =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error(`Evento ${type} não recebido.`));
    }, 2_000);
    const unsubscribe = storage.subscribe((event) => {
      if (event.type !== type) return;
      clearTimeout(timeout);
      unsubscribe();
      resolve(event as Extract<WorkspaceEvent, { type: T }>);
    });
  });

describe('P2 — workspace local-first headless', () => {
  it('abre, edita, salva e renomeia sem perder FileId/DocumentId', async () => {
    await withVault(async (root) => {
      const storage = LocalFilesystemStorage.create(root);
      const opened = await storage.open();
      const original = opened.files.find((file) => file.path === 'artigo.md');
      if (original === undefined || original.documentId === undefined) throw new Error('Documento inicial ausente.');

      const written = await storage.write({
        fileId: original.id,
        content: '# Introdução\n\nVersão salva.\n',
        expectedRevision: original.revision,
      });
      const renamed = await storage.rename({
        fileId: written.id,
        path: asWorkspacePath('artigos/artigo-final.md'),
        expectedRevision: written.revision,
      });

      expect(renamed.id).toBe(original.id);
      expect(renamed.documentId).toBe(original.documentId);
      expect(renamed.path).toBe('artigos/artigo-final.md');
      await expect(storage.read(renamed.id)).resolves.toMatchObject({ content: '# Introdução\n\nVersão salva.\n' });
      await expect(readFile(join(root, 'artigos', 'artigo-final.md'), 'utf8')).resolves.toContain('Versão salva.');

      await storage.updateConfiguration({
        schema: 'abnt-workspace-config',
        version: 1,
        defaultProfileId: 'abnt-tcc',
        ignoredPaths: [asWorkspacePath('rascunhos')],
      });
      await storage.close();

      const reopened = LocalFilesystemStorage.create(root);
      await reopened.open();
      await expect(reopened.configuration()).resolves.toMatchObject({ defaultProfileId: 'abnt-tcc' });
      expect((await reopened.list())[0]).toMatchObject({ id: original.id, path: 'artigos/artigo-final.md' });
      await reopened.close();
    });
  });

  it('detecta modificação externa antes de sobrescrever conteúdo', async () => {
    await withVault(async (root) => {
      const storage = LocalFilesystemStorage.create(root);
      const opened = await storage.open();
      const original = opened.files[0];
      if (original === undefined) throw new Error('Arquivo inicial ausente.');

      await writeFile(join(root, 'artigo.md'), '# Introdução\n\nMudança externa.\n', 'utf8');
      await expect(
        storage.write({
          fileId: original.id,
          content: '# Introdução\n\nTentativa local.\n',
          expectedRevision: original.revision,
        }),
      ).rejects.toBeInstanceOf(WorkspaceConflictError);

      const current = await storage.read(original.id);
      expect(current.content).toContain('Mudança externa.');
      expect(current.file.revision).toBeGreaterThan(original.revision);
      await storage.close();
    });
  });

  it('normaliza eventos do watcher em criação sem expor ruído do filesystem', async () => {
    await withVault(async (root) => {
      const storage = LocalFilesystemStorage.create(root);
      await storage.open();
      const created = waitForEvent(storage, 'workspace:file-created');

      await writeFile(join(root, 'nova-nota.md'), '# Nova nota\n', 'utf8');

      await expect(created).resolves.toMatchObject({
        file: { path: 'nova-nota.md', documentId: expect.any(String) },
      });
      await storage.close();
    });
  });

  it('reconcilia rename externo com a identidade existente quando o hash é único', async () => {
    await withVault(async (root) => {
      const storage = LocalFilesystemStorage.create(root);
      const opened = await storage.open();
      const original = opened.files[0];
      if (original === undefined) throw new Error('Arquivo inicial ausente.');
      const events: WorkspaceEvent[] = [];
      const unsubscribe = storage.subscribe((event) => events.push(event));

      await renameOnDisk(join(root, 'artigo.md'), join(root, 'renomeado.md'));
      const files = await storage.refresh();

      expect(files).toEqual([
        expect.objectContaining({ id: original.id, documentId: original.documentId, path: 'renomeado.md' }),
      ]);
      expect(events).toContainEqual(
        expect.objectContaining({ type: 'workspace:file-renamed', previousPath: 'artigo.md' }),
      );
      unsubscribe();
      await storage.close();
    });
  });

  it('recupera uma escrita registrada antes de uma interrupção', async () => {
    await withVault(async (root) => {
      const first = LocalFilesystemStorage.create(root);
      const opened = await first.open();
      const file = opened.files[0];
      if (file === undefined) throw new Error('Arquivo inicial ausente.');
      const recoveredContent = '# Introdução\n\nConteúdo recuperado.\n';
      await first.close();

      await mkdir(join(root, '.academic', 'recovery'), { recursive: true });
      await writeFile(
        join(root, '.academic', 'recovery', 'pending.json'),
        `${JSON.stringify({
          schema: 'abnt-workspace-recovery',
          version: 1,
          fileId: file.id,
          path: file.path,
          baseHash: file.contentHash,
          nextHash: hash(recoveredContent),
          content: recoveredContent,
        })}\n`,
        'utf8',
      );

      const recovered = LocalFilesystemStorage.create(root);
      await recovered.open();
      await expect(recovered.read(file.id)).resolves.toMatchObject({ content: recoveredContent });
      await expect(readFile(join(root, '.academic', 'recovery', 'pending.json'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
      await recovered.close();
    });
  });
});
