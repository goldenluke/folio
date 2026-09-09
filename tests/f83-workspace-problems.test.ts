import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MessageChannel } from 'node:worker_threads';

import { expect, it } from 'vitest';

import { criarServicoDeCompiler } from '@abnt/compiler';
import { createInProcessCompilerClient, createWorkspaceMessagePortClient, serveWorkspaceOverMessagePort } from '@abnt/protocol';

import { DesktopWorkspaceServiceHost } from '../apps/desktop/src/workspace/workspace-service.js';

it('F83 — Problems do workspace é uma projeção host-side de diagnósticos revisionados', async () => {
  const root = await mkdtemp(join(tmpdir(), 'folio-f83-'));
  const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
  const channel = new MessageChannel(); const stop = serveWorkspaceOverMessagePort(channel.port1, host); const client = createWorkspaceMessagePortClient(channel.port2);
  try {
    await writeFile(join(root, 'a.md'), '# A\n\n[@ausente2024]\n');
    await writeFile(join(root, 'b.md'), '# B\n\n![Sem legenda](figura.png)\n');
    const opened = await client.open({ rootPath: root }); if (!opened.ok) throw new Error('vault não abriu');
    const problems = await client.problems({});
    expect(problems).toMatchObject({ ok: true, value: expect.arrayContaining([
      expect.objectContaining({ path: 'a.md', ruleId: 'CIT-REF-AUSENTE', severity: 'error', revision: expect.any(Number) }),
    ]) });
    if (!problems.ok) return;
    expect(problems.value.every((problem) => typeof problem.path === 'string' && typeof problem.revision === 'number')).toBe(true);
    const a = opened.value.files.find((file) => file.path === 'a.md'); if (a === undefined) throw new Error('fixture incompleta');
    await expect(client.problems({ fileIds: [a.fileId] })).resolves.toMatchObject({ ok: true, value: expect.arrayContaining([expect.objectContaining({ path: 'a.md' })]) });
  } finally { client.dispose(); stop(); channel.port1.close(); channel.port2.close(); await host.dispose(); await rm(root, { recursive: true, force: true }); }
});
