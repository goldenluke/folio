import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MessageChannel } from 'node:worker_threads';

import { expect, it } from 'vitest';

import { criarServicoDeCompiler } from '@abnt/compiler';
import { createInProcessCompilerClient, createWorkspaceMessagePortClient, serveWorkspaceOverMessagePort } from '@abnt/protocol';

import { DesktopWorkspaceServiceHost } from '../apps/desktop/src/workspace/workspace-service.js';

it('F89 — compara dois documentos no host em texto e linguagem estrutural', async () => {
  const root = await mkdtemp(join(tmpdir(), 'folio-f89-'));
  const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
  const channel = new MessageChannel(); const stop = serveWorkspaceOverMessagePort(channel.port1, host); const client = createWorkspaceMessagePortClient(channel.port2);
  try {
    await writeFile(join(root, 'submetido.md'), '# Método\n\nTexto base.\n');
    await writeFile(join(root, 'revisado.md'), '# Metodologia\n\nTexto base.\n\n[@silva2024]\n');
    const opened = await client.open({ rootPath: root }); if (!opened.ok) throw new Error('vault não abriu');
    const left = opened.value.files.find((file) => file.path === 'submetido.md'); const right = opened.value.files.find((file) => file.path === 'revisado.md');
    if (left === undefined || right === undefined) throw new Error('fixture incompleta');
    await expect(client.compareDocuments({ leftFileId: left.fileId, rightFileId: right.fileId })).resolves.toMatchObject({
      ok: true,
      value: {
        text: { lines: expect.arrayContaining([expect.objectContaining({ kind: 'removed', text: '# Método' }), expect.objectContaining({ kind: 'added', text: '# Metodologia' })]) },
        structural: { changes: expect.arrayContaining([expect.objectContaining({ description: expect.stringMatching(/Seção/u) }), expect.objectContaining({ description: expect.stringMatching(/Citação/u) })]) },
      },
    });
  } finally { client.dispose(); stop(); channel.port1.close(); channel.port2.close(); await host.dispose(); await rm(root, { recursive: true, force: true }); }
});
