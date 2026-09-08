import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MessageChannel } from 'node:worker_threads';

import { describe, expect, it } from 'vitest';

import { criarServicoDeCompiler } from '@abnt/compiler';
import { createInProcessCompilerClient, createWorkspaceMessagePortClient, serveWorkspaceOverMessagePort } from '@abnt/protocol';

import { DesktopWorkspaceServiceHost } from '../apps/desktop/src/workspace/workspace-service.js';

describe('F73 — busca por seção', () => {
  it('anexa a seção do outline indexado que contém o hit FTS, sem parser no renderer', async () => {
    const root = await mkdtemp(join(tmpdir(), 'folio-f73-'));
    const source = '# Introdução\n\nContexto geral.\n\n# Metodologia\n\nAmostragem qualitativa com entrevistas.\n';
    const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
    const channel = new MessageChannel();
    const stop = serveWorkspaceOverMessagePort(channel.port1, host);
    const client = createWorkspaceMessagePortClient(channel.port2);
    try {
      await writeFile(join(root, 'trabalho.md'), source, 'utf8');
      const opened = await client.open({ rootPath: root });
      if (!opened.ok) throw new Error('Vault deveria abrir.');

      const result = await client.search({ query: 'entrevistas' });
      expect(result).toMatchObject({
        ok: true,
        value: [expect.objectContaining({
          path: 'trabalho.md',
          section: {
            title: 'Metodologia',
            range: { start: source.indexOf('# Metodologia'), end: source.indexOf('# Metodologia') + '# Metodologia'.length },
          },
        })],
      });
    } finally {
      client.dispose(); stop(); channel.port1.close(); channel.port2.close();
      await host.dispose();
      await rm(root, { recursive: true, force: true });
    }
  });
});
