import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MessageChannel } from 'node:worker_threads';

import { expect, it } from 'vitest';

import { criarServicoDeCompiler } from '@abnt/compiler';
import { createInProcessCompilerClient, createWorkspaceMessagePortClient, serveWorkspaceOverMessagePort } from '@abnt/protocol';

import { DesktopWorkspaceServiceHost } from '../apps/desktop/src/workspace/workspace-service.js';

it('F30 — reference health deriva uso, chaves ausentes e DOI do catálogo e índice', async () => {
  const root = await mkdtemp(join(tmpdir(), 'abnt-f30-'));
  const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
  const channel = new MessageChannel();
  const stop = serveWorkspaceOverMessagePort(channel.port1, host);
  const client = createWorkspaceMessagePortClient(channel.port2);
  try {
    await mkdir(join(root, 'references'), { recursive: true });
    await writeFile(join(root, 'artigo.md'), '# Texto\n\nCita [@silva2024] e [@ausente2024].\n', 'utf8');
    await writeFile(join(root, 'references', 'library.json'), JSON.stringify([
      { id: 'silva2024', type: 'book', title: 'Conhecida' },
      { id: 'naoUsada2023', type: 'article-journal', title: 'Não usada', DOI: '10.1234/x' },
    ]), 'utf8');
    await expect(client.open({ rootPath: root })).resolves.toMatchObject({ ok: true });
    await expect(client.referenceHealth({})).resolves.toEqual({
      ok: true,
      value: { total: 2, cited: 1, unused: 1, missing: ['ausente2024'], withoutDoi: 1 },
    });
  } finally {
    client.dispose(); stop(); channel.port1.close(); channel.port2.close(); await host.dispose();
    await rm(root, { recursive: true, force: true });
  }
});
