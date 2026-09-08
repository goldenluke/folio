import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MessageChannel } from 'node:worker_threads';

import { describe, expect, it } from 'vitest';

import { criarServicoDeCompiler } from '@abnt/compiler';
import { createInProcessCompilerClient, createWorkspaceMessagePortClient, serveWorkspaceOverMessagePort } from '@abnt/protocol';

import { DesktopWorkspaceServiceHost } from '../apps/desktop/src/workspace/workspace-service.js';

const ARTIGO = '# Introdução\n\nEste trabalho trata de coordenação distribuída em sistemas de larga escala.\n';
const METODOLOGIA = '# Metodologia\n\nVeja a [introdução](artigo.md) para o problema de pesquisa.\n';

const withVault = async (run: (root: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), 'abnt-p11-'));
  try {
    await writeFile(join(root, 'artigo.md'), ARTIGO, 'utf8');
    await writeFile(join(root, 'metodologia.md'), METODOLOGIA, 'utf8');
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

describe('P11 — busca e backlinks sobre o protocolo do desktop', () => {
  it('search encontra por conteúdo indexado; backlinks projeta links de outros documentos', async () => {
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
        const artigo = opened.value.files.find((file) => file.path === 'artigo.md');
        const metodologia = opened.value.files.find((file) => file.path === 'metodologia.md');
        if (artigo === undefined || metodologia === undefined) throw new Error('Fixture incompleta.');

        const found = await client.search({ query: 'coordenação' });
        expect(found).toMatchObject({
          ok: true,
          value: [expect.objectContaining({ fileId: artigo.fileId, path: 'artigo.md' })],
        });
        if (found.ok) expect(found.value[0]?.snippet).toContain('<mark>');

        const nothing = await client.search({ query: 'termo-que-nao-existe-em-lugar-nenhum' });
        expect(nothing).toEqual({ ok: true, value: [] });

        const backlinks = await client.backlinks({ fileId: artigo.fileId });
        expect(backlinks).toMatchObject({
          ok: true,
          value: [expect.objectContaining({ fileId: metodologia.fileId, path: 'metodologia.md', label: 'introdução' })],
        });

        const noBacklinks = await client.backlinks({ fileId: metodologia.fileId });
        expect(noBacklinks).toEqual({ ok: true, value: [] });

        const missing = await client.backlinks({ fileId: 'file_inexistente' });
        expect(missing).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
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
