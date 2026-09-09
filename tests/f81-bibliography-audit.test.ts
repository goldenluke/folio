import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MessageChannel } from 'node:worker_threads';

import { expect, it } from 'vitest';

import { criarServicoDeCompiler } from '@abnt/compiler';
import { createInProcessCompilerClient, createWorkspaceMessagePortClient, serveWorkspaceOverMessagePort } from '@abnt/protocol';

import { DesktopWorkspaceServiceHost } from '../apps/desktop/src/workspace/workspace-service.js';

it('F81 — auditoria bibliográfica separa qualidade do catálogo de diagnostics normativos', async () => {
  const root = await mkdtemp(join(tmpdir(), 'folio-f81-'));
  const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
  const channel = new MessageChannel(); const stop = serveWorkspaceOverMessagePort(channel.port1, host); const client = createWorkspaceMessagePortClient(channel.port2);
  try {
    await mkdir(join(root, 'references'), { recursive: true });
    await writeFile(join(root, 'artigo.md'), '# Texto\n\n[@silva2024]\n');
    await writeFile(join(root, 'references', 'library.json'), JSON.stringify([
      { id: 'chave-antiga', type: 'book', title: 'Livro sem dados', DOI: 'doi-invalido', ISBN: '123', URL: 'https://example.test' },
      { id: 'silva2024', type: 'book', title: 'Livro sem dados' },
    ]), 'utf8');
    await expect(client.open({ rootPath: root })).resolves.toMatchObject({ ok: true });
    const health = await client.referenceHealth({});
    expect(health).toMatchObject({ ok: true });
    if (!health.ok) return;
    expect(health.value.audit).toEqual(expect.arrayContaining([
      expect.objectContaining({ referenceId: 'chave-antiga', code: 'invalid-doi' }),
      expect.objectContaining({ referenceId: 'chave-antiga', code: 'invalid-isbn' }),
      expect.objectContaining({ referenceId: 'chave-antiga', code: 'missing-access-date' }),
      expect.objectContaining({ referenceId: 'chave-antiga', code: 'incomplete-author' }),
      expect.objectContaining({ referenceId: 'chave-antiga', code: 'inconsistent-key' }),
      expect.objectContaining({ referenceId: 'chave-antiga', code: 'missing-pdf' }),
      expect.objectContaining({ referenceId: 'chave-antiga', code: 'missing-literature-note' }),
      expect.objectContaining({ referenceId: 'silva2024', code: 'possible-duplicate' }),
    ]));
  } finally { client.dispose(); stop(); channel.port1.close(); channel.port2.close(); await host.dispose(); await rm(root, { recursive: true, force: true }); }
});
