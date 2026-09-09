import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MessageChannel } from 'node:worker_threads';

import { expect, it } from 'vitest';

import { criarServicoDeCompiler } from '@abnt/compiler';
import { createInProcessCompilerClient, createWorkspaceMessagePortClient, serveWorkspaceOverMessagePort } from '@abnt/protocol';

import { openWorkspaceProblem } from '../apps/desktop/src/renderer/workspace-problem-navigation.js';
import { DesktopWorkspaceServiceHost } from '../apps/desktop/src/workspace/workspace-service.js';

it('O-UI.1/O-UI.3 — problema remapeado abre o módulo autoral e seleciona o range desse módulo', async () => {
  const calls: unknown[] = [];
  await openWorkspaceProblem(
    {
      fileId: 'metodo-file-id', path: 'capitulos/metodo.md', revision: 4,
      severity: 'error', ruleId: 'CIT-REF-AUSENTE', message: 'Referência ausente.', range: { start: 42, end: 55 },
    },
    async (fileId, path, options) => {
      calls.push({ fileId, path, options });
      return { dispatch: (transaction) => calls.push(transaction) };
    },
  );
  expect(calls).toEqual([
    { fileId: 'metodo-file-id', path: 'capitulos/metodo.md', options: { remember: true } },
    { selection: { anchor: 42, head: 55 } },
  ]);
});

it('O-UI.1/O-UI.3 — Problems do TCC composto preserva o fileId, o heading e o range do capítulo autoral', async () => {
  const root = await mkdtemp(join(tmpdir(), 'folio-o-ui-'));
  const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
  const channel = new MessageChannel(); const stop = serveWorkspaceOverMessagePort(channel.port1, host); const client = createWorkspaceMessagePortClient(channel.port2);
  try {
    const method = '# Método\n\nVeja [[ref:fig:inexistente]] para detalhes.\n';
    await mkdir(join(root, 'capitulos'));
    await writeFile(join(root, 'index.md'), '# Trabalho\n\n![[capitulos/metodo.md]]\n', 'utf8');
    await writeFile(join(root, 'capitulos', 'metodo.md'), method, 'utf8');
    const opened = await client.open({ rootPath: root }); if (!opened.ok) throw new Error('vault não abriu');
    const metodo = opened.value.files.find((file) => file.path === 'capitulos/metodo.md'); if (metodo === undefined) throw new Error('módulo ausente');
    const problems = await client.problems({}); if (!problems.ok) throw new Error('Problems não respondeu');
    expect(problems.value).toContainEqual(expect.objectContaining({
      fileId: metodo.fileId, path: 'capitulos/metodo.md', section: 'Método', ruleId: 'XREF-NAO-RESOLVIDA',
      range: { start: method.indexOf('[[ref:fig:inexistente]]'), end: method.indexOf('[[ref:fig:inexistente]]') + '[[ref:fig:inexistente]]'.length },
    }));
  } finally { client.dispose(); stop(); channel.port1.close(); channel.port2.close(); await host.dispose(); await rm(root, { recursive: true, force: true }); }
});
