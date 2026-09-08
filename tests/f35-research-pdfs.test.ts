import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MessageChannel } from 'node:worker_threads';

import { describe, expect, it } from 'vitest';

import { criarServicoDeCompiler } from '@abnt/compiler';
import { createInProcessCompilerClient, createWorkspaceMessagePortClient, serveWorkspaceOverMessagePort } from '@abnt/protocol';

import { DesktopWorkspaceServiceHost } from '../apps/desktop/src/workspace/workspace-service.js';

describe('F35 — PDFs como recursos de pesquisa', () => {
  it('copia PDF para o vault e preserva o vínculo fora do CSL-JSON', async () => {
    const root = await mkdtemp(join(tmpdir(), 'abnt-f35-'));
    const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
    const channel = new MessageChannel(); const stop = serveWorkspaceOverMessagePort(channel.port1, host); const client = createWorkspaceMessagePortClient(channel.port2);
    try {
      expect(await client.open({ rootPath: root })).toMatchObject({ ok: true });
      expect(await client.libraryUpsert({ entry: { id: 'silva2024', type: 'article-journal', title: 'Pesquisa' } })).toMatchObject({ ok: true });
      const attached = await client.attachReferencePdf({ referenceId: 'silva2024', name: 'Pesquisa final.pdf', base64: Buffer.from('%PDF-1.4\n').toString('base64') });
      expect(attached).toMatchObject({ ok: true, value: { referenceId: 'silva2024', file: { path: 'resources/papers/Pesquisa-final.pdf', mediaType: 'application/pdf' } } });
      expect(await client.referenceAttachments({})).toMatchObject({ ok: true, value: [expect.objectContaining({ referenceId: 'silva2024' })] });
      const files = await client.list({});
      expect(files).toMatchObject({ ok: true, value: expect.arrayContaining([expect.objectContaining({ path: 'references/library.json' }), expect.objectContaining({ path: 'references/attachments.json' })]) });
      expect(await client.removeReferenceAttachment({ referenceId: 'silva2024' })).toMatchObject({ ok: true });
      expect(await client.referenceAttachments({})).toMatchObject({ ok: true, value: [] });
    } finally { client.dispose(); stop(); channel.port1.close(); channel.port2.close(); await host.dispose(); await rm(root, { recursive: true, force: true }); }
  });
});
