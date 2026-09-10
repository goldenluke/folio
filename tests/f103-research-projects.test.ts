import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MessageChannel } from 'node:worker_threads';

import { expect, it, vi } from 'vitest';

import { criarServicoDeCompiler } from '@abnt/compiler';
import { createInProcessCompilerClient, createWorkspaceMessagePortClient, serveWorkspaceOverMessagePort } from '@abnt/protocol';

import { DesktopWorkspaceServiceHost } from '../apps/desktop/src/workspace/workspace-service.js';
import { createResearchProject, readResearchProjects, writeResearchProjects } from '../apps/desktop/src/renderer/research-projects.js';

it('persiste imediatamente um projeto criado, sem depender de um efeito do React', () => {
  const values = new Map<string, string>();
  vi.stubGlobal('window', { localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } } });
  try {
    const project = createResearchProject('Pesquisa aplicada');
    writeResearchProjects('vault-1', [project]);
    expect(readResearchProjects('vault-1')).toMatchObject([{ id: project.id, title: 'Pesquisa aplicada' }]);
  } finally { vi.unstubAllGlobals(); }
});

it('F103–F105 — dashboard projeta documentos de um projeto por IDs, sem transformar o projeto em pasta', async () => {
  const root = await mkdtemp(join(tmpdir(), 'folio-f103-'));
  const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
  const channel = new MessageChannel(); const stop = serveWorkspaceOverMessagePort(channel.port1, host); const client = createWorkspaceMessagePortClient(channel.port2);
  try {
    await writeFile(join(root, 'partes.md'), '# Método\n\nUma seção pertence a mais de um projeto.\n', 'utf8');
    await writeFile(join(root, 'outro.md'), '# Resultados\n\nOutro documento.\n', 'utf8');
    const opened = await client.open({ rootPath: root });
    if (!opened.ok) throw new Error('vault não abriu');
    const method = opened.value.files.find((file) => file.path === 'partes.md');
    const other = opened.value.files.find((file) => file.path === 'outro.md');
    if (method === undefined || other === undefined) throw new Error('fixture incompleta');
    const single = await client.projectDashboard({ fileIds: [method.fileId] });
    expect(single).toMatchObject({ ok: true, value: { documents: [expect.objectContaining({ fileId: method.fileId, path: 'partes.md', revision: expect.any(Number), words: expect.any(Number), errors: expect.any(Number) })] } });
    if (!single.ok) return;
    expect(single.value.documents).toHaveLength(1);
    expect(single.value.documents[0]!.words).toBeGreaterThan(0);
    const shared = await client.projectDashboard({ fileIds: [method.fileId, other.fileId] });
    expect(shared).toMatchObject({ ok: true, value: { documents: expect.arrayContaining([expect.objectContaining({ fileId: method.fileId }), expect.objectContaining({ fileId: other.fileId })]) } });
  } finally {
    client.dispose(); stop(); channel.port1.close(); channel.port2.close();
    await host.dispose(); await rm(root, { recursive: true, force: true });
  }
});
