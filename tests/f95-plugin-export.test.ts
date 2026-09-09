import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MessageChannel } from 'node:worker_threads';

import { expect, it } from 'vitest';

import { criarServicoDeCompiler } from '@abnt/compiler';
import { createInProcessCompilerClient, createWorkspaceMessagePortClient, serveWorkspaceOverMessagePort } from '@abnt/protocol';

import { DesktopWorkspaceServiceHost } from '../apps/desktop/src/workspace/workspace-service.js';

it('F95 — exportação declarativa usa a Publication AST revisionada e devolve somente texto ao Main', async () => {
  const root = await mkdtemp(join(tmpdir(), 'folio-f95-'));
  const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
  const channel = new MessageChannel(); const stop = serveWorkspaceOverMessagePort(channel.port1, host); const client = createWorkspaceMessagePortClient(channel.port2);
  try {
    const pluginDirectory = join(root, '.academic', 'plugins', 'texto'); await mkdir(pluginDirectory, { recursive: true });
    await writeFile(join(pluginDirectory, 'plugin.json'), JSON.stringify({ id: 'teste.texto', version: '1.0.0', apiVersion: 1, entry: 'index.mjs', capabilities: ['export'], exports: [{ id: 'txt', title: 'Texto simples', extension: 'txt', mimeType: 'text/plain' }] }), 'utf8');
    await writeFile(join(pluginDirectory, 'index.mjs'), "process.send({ version: 1, type: 'abnt-plugin/ready', plugin: { id: 'teste.texto', version: '1.0.0' } }); process.on('message', (msg) => { if (msg.type === 'abnt-plugin/export') process.send({ version: 1, type: 'abnt-plugin/export-result', requestId: msg.requestId, ok: true, result: { content: `TITULO:${msg.publication.title}` } }); });", 'utf8');
    await writeFile(join(root, 'artigo.md'), '---\ntitle: Artigo de teste\n---\n\n# Artigo de teste\n\nTexto.\n', 'utf8');
    const opened = await client.open({ rootPath: root }); if (!opened.ok) throw new Error('vault não abriu');
    const file = opened.value.files.find((candidate) => candidate.path === 'artigo.md'); if (file === undefined) throw new Error('documento não encontrado');
    const editor = await client.openEditor({ fileId: file.fileId }); if (!editor.ok) throw new Error('editor não abriu');
    for (let attempt = 0; attempt < 100; attempt += 1) { const exported = await client.exportWithPlugin({ fileId: file.fileId, expectedRevision: editor.value.session.revision, pluginId: 'teste.texto', exportId: 'txt' }); if (exported.ok) { expect(exported.value).toMatchObject({ extension: 'txt', mimeType: 'text/plain', content: 'TITULO:Artigo de teste' }); return; } await new Promise<void>((resolve) => setTimeout(resolve, 20)); }
    throw new Error('compilação não ficou pronta para exportação');
  } finally { client.dispose(); stop(); channel.port1.close(); channel.port2.close(); await host.dispose(); await rm(root, { recursive: true, force: true }); }
});
