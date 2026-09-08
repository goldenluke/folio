import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MessageChannel } from 'node:worker_threads';

import { describe, expect, it } from 'vitest';

import { criarServicoDeCompiler } from '@abnt/compiler';
import { createInProcessCompilerClient, createWorkspaceMessagePortClient, serveWorkspaceOverMessagePort } from '@abnt/protocol';

import { DesktopWorkspaceServiceHost } from '../apps/desktop/src/workspace/workspace-service.js';

const withVault = async (run: (root: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), 'abnt-f6-'));
  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

describe('F6 — biblioteca gerenciada do vault (references/library.json)', () => {
  it('cria, lista, atualiza e remove entradas sem exigir o arquivo pré-existente', async () => {
    await withVault(async (root) => {
      const host = DesktopWorkspaceServiceHost.create({
        compiler: createInProcessCompilerClient(criarServicoDeCompiler()),
      });
      const channel = new MessageChannel();
      const stop = serveWorkspaceOverMessagePort(channel.port1, host);
      const client = createWorkspaceMessagePortClient(channel.port2);

      try {
        const opened = await client.open({ rootPath: root });
        if (!opened.ok) throw new Error('Vault deveria abrir.');
        expect(opened.value.files.some((file) => file.path === 'references/library.json')).toBe(false);

        const empty = await client.libraryList({});
        expect(empty).toEqual({ ok: true, value: [] });

        const created = await client.libraryUpsert({
          entry: { id: 'tanenbaum2017', type: 'book', title: 'Distributed Systems', publisher: 'Pearson' },
        });
        expect(created).toMatchObject({ ok: true, value: { id: 'tanenbaum2017', title: 'Distributed Systems' } });

        const afterCreate = await client.list({});
        expect(afterCreate).toMatchObject({
          ok: true,
          value: expect.arrayContaining([expect.objectContaining({ path: 'references/library.json' })]),
        });

        const listed = await client.libraryList({});
        expect(listed).toMatchObject({ ok: true, value: [expect.objectContaining({ id: 'tanenbaum2017' })] });

        const updated = await client.libraryUpsert({
          entry: { id: 'tanenbaum2017', type: 'book', title: 'Distributed Systems, 3rd ed.', publisher: 'Pearson' },
        });
        expect(updated).toMatchObject({ ok: true, value: { title: 'Distributed Systems, 3rd ed.' } });
        await expect(client.libraryFormat({ entry: updated.ok ? updated.value : { id: 'x', type: 'book' } })).resolves.toMatchObject({
          ok: true,
          value: expect.stringContaining('Distributed Systems'),
        });
        const afterUpdate = await client.libraryList({});
        expect(afterUpdate).toMatchObject({ ok: true, value: [expect.objectContaining({ title: 'Distributed Systems, 3rd ed.' })] });

        const added = await client.libraryUpsert({ entry: { id: 'silva2024', type: 'webpage', title: 'Outra' } });
        expect(added.ok).toBe(true);
        await expect(client.libraryImport({
          format: 'csl-json',
          content: JSON.stringify([{ id: 'zotero2024', type: 'article-journal', title: 'Importada do Zotero' }]),
        })).resolves.toMatchObject({ ok: true, value: { imported: [expect.objectContaining({ id: 'zotero2024' })] } });
        expect(await client.libraryList({})).toMatchObject({ ok: true, value: expect.arrayContaining([
          expect.objectContaining({ id: 'tanenbaum2017' }),
          expect.objectContaining({ id: 'silva2024' }),
          expect.objectContaining({ id: 'zotero2024' }),
        ]) });

        const removed = await client.libraryRemove({ id: 'silva2024' });
        expect(removed).toEqual({ ok: true, value: undefined });
        const afterRemove = await client.libraryList({});
        expect(afterRemove).toMatchObject({ ok: true, value: expect.arrayContaining([expect.objectContaining({ id: 'tanenbaum2017' })]) });

        const rejected = await client.libraryUpsert({ entry: { id: 'invalido', type: 'tipo-invalido' as never } });
        expect(rejected).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
      } finally {
        client.dispose();
        stop();
        channel.port1.close();
        channel.port2.close();
        await host.dispose();
      }
    });
  });
});
