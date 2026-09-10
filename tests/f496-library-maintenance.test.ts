import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MessageChannel } from 'node:worker_threads';

import { expect, it } from 'vitest';

import { criarServicoDeCompiler } from '@abnt/compiler';
import { createInProcessCompilerClient, createWorkspaceMessagePortClient, serveWorkspaceOverMessagePort } from '@abnt/protocol';

import { DesktopWorkspaceServiceHost } from '../apps/desktop/src/workspace/workspace-service.js';

it('F496–F504 — Library Maintenance Center compõe saúde/duplicatas/anexos/relações por referência, sem recalcular nenhum algoritmo', async () => {
  const root = await mkdtemp(join(tmpdir(), 'folio-f496-'));
  const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
  const channel = new MessageChannel();
  const stop = serveWorkspaceOverMessagePort(channel.port1, host);
  const client = createWorkspaceMessagePortClient(channel.port2);
  try {
    await mkdir(join(root, 'references'), { recursive: true });
    await writeFile(join(root, 'artigo.md'), '# Texto\n\n[@pereira2020] e também [@fantasma2099].\n');
    await writeFile(join(root, 'references', 'library.json'), JSON.stringify([
      { id: 'pereira2020', type: 'article-journal', title: 'Aprendizagem Ativa', author: [{ family: 'Pereira', given: 'Ana' }], issued: { 'date-parts': [[2020]] }, DOI: '10.1000/exemplo' },
      { id: 'pereira2020b', type: 'article-journal', title: 'Aprendizagem Ativa', author: [{ family: 'Pereira', given: 'Ana' }], issued: { 'date-parts': [[2020]] }, DOI: '10.1000/exemplo' },
      { id: 'naoUsada2021', type: 'book', title: 'Referência não citada', author: [{ family: 'Silva', given: 'Bruno' }], issued: { 'date-parts': [[2021]] } },
    ]), 'utf8');
    await expect(client.open({ rootPath: root })).resolves.toMatchObject({ ok: true });

    expect(await client.addAttachment({ referenceId: 'pereira2020', kind: 'link', role: 'supplementary', mediaType: 'text/html', uri: 'https://example.org/pereira2020' })).toMatchObject({ ok: true });
    expect(await client.addReferenceRelation({ kind: 'version-of', fromId: 'naoUsada2021', toId: 'pereira2020' })).toMatchObject({ ok: true });

    const overview = await client.libraryMaintenanceOverview({});
    expect(overview).toMatchObject({ ok: true });
    if (!overview.ok) return;

    expect(overview.value.totals).toMatchObject({ total: 3, cited: 1, unused: 2, withoutDoi: 1, duplicatePairs: 1, attachmentIssues: 0, missing: ['fantasma2099'] });

    const byId = Object.fromEntries(overview.value.rows.map((row) => [row.referenceId, row]));
    expect(byId['pereira2020']).toMatchObject({ cited: true, citationCount: 1, withoutDoi: false, attachmentCount: 1, relationCount: 1, duplicateOf: ['pereira2020b'] });
    expect(byId['pereira2020b']).toMatchObject({ cited: false, citationCount: 0, withoutDoi: false, attachmentCount: 0, relationCount: 0, duplicateOf: ['pereira2020'] });
    expect(byId['naoUsada2021']).toMatchObject({ cited: false, withoutDoi: true, attachmentCount: 0, relationCount: 1, duplicateOf: [] });
    expect(byId['pereira2020']!.auditCodes).toContain('possible-duplicate');

    // A mesma auditoria de referenceHealth() deve concordar com o painel de manutenção — mesmo algoritmo, não uma cópia.
    const health = await client.referenceHealth({});
    expect(health).toMatchObject({ ok: true });
    if (health.ok) {
      expect(health.value.total).toBe(overview.value.totals.total);
      expect(health.value.cited).toBe(overview.value.totals.cited);
      expect(health.value.missing).toEqual(overview.value.totals.missing);
    }
  } finally {
    client.dispose(); stop(); channel.port1.close(); channel.port2.close(); await host.dispose(); await rm(root, { recursive: true, force: true });
  }
});
