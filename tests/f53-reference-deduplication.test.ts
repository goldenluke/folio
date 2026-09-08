import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MessageChannel } from 'node:worker_threads';

import { describe, expect, it } from 'vitest';

import { criarServicoDeCompiler } from '@abnt/compiler';
import { createInProcessCompilerClient, createWorkspaceMessagePortClient, serveWorkspaceOverMessagePort } from '@abnt/protocol';

import { DesktopWorkspaceServiceHost } from '../apps/desktop/src/workspace/workspace-service.js';

describe('Onda K — deduplicação e chaves de referências', () => {
  it('explica duplicatas, mescla somente após revisão e renomeia chaves no vault inteiro', async () => {
    const root = await mkdtemp(join(tmpdir(), 'folio-f53-'));
    await mkdir(join(root, 'papers'));
    await writeFile(join(root, 'paper.md'), '# Texto\n\nBaseado em [@silva-duplicada]. Também [@souza-antiga].\n');
    await writeFile(join(root, 'papers', 'silva.md'), '---\nsourceReference: silva-duplicada\n---\n\n[@silva-duplicada]\n');
    const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
    const channel = new MessageChannel(); const stop = serveWorkspaceOverMessagePort(channel.port1, host); const client = createWorkspaceMessagePortClient(channel.port2);
    try {
      const opened = await client.open({ rootPath: root }); if (!opened.ok) throw new Error('vault não abriu');
      const add = async (id: string, title: string, doi: string, family: string, year: number): Promise<void> => {
        const result = await client.libraryUpsert({ entry: { id, type: 'article-journal', title, DOI: doi, author: [{ family }], issued: { 'date-parts': [[year]] } } });
        if (!result.ok) throw new Error(result.error.message);
      };
      await add('silva2024', 'Métodos qualitativos na pesquisa', '10.1000/silva', 'Silva', 2024);
      await add('silva-duplicada', 'Métodos Qualitativos na Pesquisa', '10.1000/SILVA', 'Silva', 2024);
      await add('souza-antiga', 'Outra referência', '10.1000/souza', 'Souza', 2020);

      const duplicates = await client.libraryDuplicates({});
      expect(duplicates).toMatchObject({ ok: true, value: [expect.objectContaining({ reasons: expect.arrayContaining(['doi', 'title', 'author-year']) })] });
      if (duplicates.ok) expect(new Set([duplicates.value[0]?.leftId, duplicates.value[0]?.rightId])).toEqual(new Set(['silva2024', 'silva-duplicada']));

      const canonical = (await client.libraryList({})); if (!canonical.ok) throw new Error('biblioteca não abriu');
      const entry = canonical.value.find((item) => item.id === 'silva2024'); if (entry === undefined) throw new Error('canônica ausente');
      const merged = await client.libraryMerge({ canonicalId: 'silva2024', duplicateId: 'silva-duplicada', entry });
      expect(merged).toMatchObject({ ok: true, value: { entry: { id: 'silva2024' }, changedFiles: expect.arrayContaining(['paper.md', 'papers/silva.md']) } });
      const paper = opened.value.files.find((file) => file.path === 'paper.md'); const note = opened.value.files.find((file) => file.path === 'papers/silva.md');
      if (paper === undefined || note === undefined) throw new Error('fixture incompleta');
      expect(await client.read({ fileId: paper.fileId })).toMatchObject({ ok: true, value: { content: expect.stringContaining('@silva2024') } });
      expect(await client.read({ fileId: note.fileId })).toMatchObject({ ok: true, value: { content: expect.stringContaining('sourceReference: silva2024') } });
      const afterMerge = await client.libraryList({});
      expect(afterMerge).toMatchObject({ ok: true, value: expect.not.arrayContaining([expect.objectContaining({ id: 'silva-duplicada' })]) });

      const preview = await client.libraryKeyPreview({ id: 'souza-antiga', policy: 'author-year' });
      expect(preview).toMatchObject({ ok: true, value: { suggestion: 'souza2020' } });
      const renamed = await client.libraryRenameKey({ id: 'souza-antiga', nextId: 'souza2020' });
      expect(renamed).toMatchObject({ ok: true, value: { entry: { id: 'souza2020' }, changedFiles: expect.arrayContaining(['paper.md']) } });
      expect(await client.read({ fileId: paper.fileId })).toMatchObject({ ok: true, value: { content: expect.stringContaining('@souza2020') } });
    } finally { client.dispose(); stop(); channel.port1.close(); channel.port2.close(); await host.dispose(); await rm(root, { recursive: true, force: true }); }
  });
});
