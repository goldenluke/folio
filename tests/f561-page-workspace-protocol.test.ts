import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MessageChannel } from 'node:worker_threads';

import { describe, expect, it } from 'vitest';
import { criarServicoDeCompiler } from '@abnt/compiler';
import { createInProcessCompilerClient, createWorkspaceMessagePortClient, serveWorkspaceOverMessagePort } from '@abnt/protocol';
import { DesktopWorkspaceServiceHost } from '../apps/desktop/src/workspace/workspace-service.js';

describe('F561 — páginas e Home passam pelo protocolo revisionado', () => {
  it('converte Markdown explicitamente, salva propriedades/tarefas e persiste o layout da Home', async () => {
    const root = await mkdtemp(join(tmpdir(), 'folio-f561-'));
    const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
    const channel = new MessageChannel(); const stop = serveWorkspaceOverMessagePort(channel.port1, host); const client = createWorkspaceMessagePortClient(channel.port2);
    try {
      expect(await client.open({ rootPath: root })).toMatchObject({ ok: true });
      const created = await client.createDocument({ path: 'notas/pesquisa.md', content: '# Pesquisa\n\n- [ ] Ler o corpus\n' });
      if (!created.ok) throw new Error('Documento não criado.');
      const enabled = await client.enablePage({ fileId: created.value.fileId, expectedRevision: created.value.revision, id: 'page-pesquisa' });
      expect(enabled).toMatchObject({ ok: true, value: { properties: { id: 'page-pesquisa' } } });
      if (!enabled.ok) return;
      const configured = await client.setPageProperties({ fileId: created.value.fileId, expectedRevision: enabled.value.file.revision, properties: { ...enabled.value.properties, status: 'em andamento', tags: ['método'], due: '2026-10-01' } });
      expect(configured).toMatchObject({ ok: true, value: { properties: { status: 'em andamento', tags: ['método'] } } });
      if (!configured.ok) return;
      const task = configured.value.tasks[0]!;
      const toggled = await client.togglePageTask({ fileId: created.value.fileId, expectedRevision: configured.value.file.revision, offset: task.offset, completed: true });
      expect(toggled).toMatchObject({ ok: true, value: { tasks: [expect.objectContaining({ completed: true })] } });
      const allPages = await client.pages();
      expect(allPages).toMatchObject({ ok: true, value: { pages: [expect.objectContaining({ properties: expect.objectContaining({ id: 'page-pesquisa' }) })] } });
      const initial = await client.homeLayout();
      if (!initial.ok) return;
      const changed = await client.setHomeLayout({ ...initial.value, blocks: initial.value.blocks.map((block) => block.id === 'recent' ? { ...block, enabled: false } : block) });
      expect(changed).toMatchObject({ ok: true, value: { blocks: expect.arrayContaining([expect.objectContaining({ id: 'recent', enabled: false })]) } });
      const themes = await client.themes();
      if (!themes.ok) return;
      const savedThemes = await client.setThemes({ ...themes.value, activeId: 'folio-dark' });
      expect(savedThemes).toMatchObject({ ok: true, value: { activeId: 'folio-dark' } });
      const imported = await client.importLegacyResearchProjects({ projects: [{ id: 'legacy-project', title: 'Projeto legado', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }] });
      expect(imported).toMatchObject({ ok: true, value: { imported: 1, skipped: 0 } });
      const repeatedImport = await client.importLegacyResearchProjects({ projects: [{ id: 'legacy-project', title: 'Projeto legado', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }] });
      expect(repeatedImport).toMatchObject({ ok: true, value: { imported: 0, skipped: 1 } });
      expect(await client.researchProjects()).toMatchObject({ ok: true, value: { projects: [expect.objectContaining({ id: 'legacy-project' })] } });
      expect(await client.setResearchProjects({ version: 1, projects: [{ id: 'portable-project', title: 'Projeto portátil', createdAt: '2026-01-02T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z' }] })).toMatchObject({ ok: true, value: { projects: [expect.objectContaining({ id: 'portable-project' })] } });
      expect(await client.importLegacyReadingQueue({ entries: { silva2024: 'to-read' } })).toMatchObject({ ok: true, value: { imported: 1, skipped: 0 } });
      expect(await client.importLegacyReadingQueue({ entries: { silva2024: 'to-read' } })).toMatchObject({ ok: true, value: { imported: 0, skipped: 1 } });
      expect(await client.readingQueue()).toMatchObject({ ok: true, value: { entries: { silva2024: expect.objectContaining({ state: 'to-read' }) } } });
      expect(await client.setReadingQueue({ version: 1, entries: { silva2024: { state: 'reading', updatedAt: '2026-01-03T00:00:00.000Z' } } })).toMatchObject({ ok: true, value: { entries: { silva2024: expect.objectContaining({ state: 'reading' }) } } });
    } finally { client.dispose(); stop(); channel.port1.close(); channel.port2.close(); await host.dispose(); await rm(root, { recursive: true, force: true }); }
  });
});
