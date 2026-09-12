import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MessageChannel } from 'node:worker_threads';
import { describe, expect, it } from 'vitest';
import { criarServicoDeCompiler } from '@abnt/compiler';
import { createInProcessCompilerClient, createWorkspaceMessagePortClient, serveWorkspaceOverMessagePort } from '@abnt/protocol';
import { DesktopWorkspaceServiceHost } from '../apps/desktop/src/workspace/workspace-service.js';

describe('F523–F534 — estado operacional da pesquisa estruturada', () => {
  it('persiste protocolo de revisão e registry de datasets no workspace', async () => {
    const root = await mkdtemp(join(tmpdir(), 'abnt-f523-')); const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) }); const channel = new MessageChannel(); const stop = serveWorkspaceOverMessagePort(channel.port1, host); const client = createWorkspaceMessagePortClient(channel.port2);
    try {
      expect(await client.open({ rootPath: root })).toMatchObject({ ok: true });
      const review = { version: 1 as const, protocol: { id: 'r1', title: 'Pergunta', question: 'Qual efeito?', framework: 'pico' as const, frameworkFields: { population: 'estudantes' }, databases: ['Scopus'], searchStrategy: 'teste', inclusionCriteria: [], exclusionCriteria: [] }, searches: [{ id: 'search-1', database: 'Scopus', query: 'reprodutibilidade', searchedAt: '2026-09-11', resultCount: 12 }], exclusionReasons: [{ id: 'fora-escopo', label: 'Fora de escopo' }], studies: [{ id: 's1', title: 'Estudo', stage: 'included', decisions: [{ reviewerId: 'ana', decision: 'include' as const, at: '2026-09-11' }] }], extractions: { s1: { method: 'ensaio' } }, quality: { s1: [{ itemId: 'bias', value: 'yes' as const }] }, evidence: [{ studyId: 's1', fieldId: 'method', target: 'nota.md' }] };
      expect(await client.setSystematicReview({ review })).toMatchObject({ ok: true, value: { protocol: { id: 'r1' } } });
      const readReview = await client.systematicReview();
      if (!readReview.ok) throw new Error(JSON.stringify(readReview.error));
      expect(readReview).toMatchObject({ ok: true, value: { searches: [{ database: 'Scopus', resultCount: 12 }], exclusionReasons: [{ label: 'Fora de escopo' }], studies: [{ id: 's1' }], extractions: { s1: { method: 'ensaio' } }, quality: { s1: [{ itemId: 'bias', value: 'yes' }] }, evidence: [{ target: 'nota.md' }] } });
      const imported = await client.importResearchDataset({ name: 'dados.csv', base64: Buffer.from('nome,valor\na,1\n').toString('base64'), metadata: { title: 'Dados de teste' } });
      expect(imported).toMatchObject({ ok: true, value: { datasets: [expect.objectContaining({ path: 'datasets/dados.csv', format: 'csv', metadata: { title: 'Dados de teste' } })] } });
      const datasets = await client.researchDatasets();
      expect(datasets).toMatchObject({ ok: true, value: { datasets: [expect.objectContaining({ sha256: expect.any(String) })] } });
      if (!datasets.ok) return;
      const nextVersion = await client.importResearchDataset({ name: 'dados.csv', base64: Buffer.from('nome,valor\nb,2\n').toString('base64'), metadata: { title: 'Dados de teste v2' }, previousVersionId: datasets.value.datasets[0]!.id });
      expect(nextVersion).toMatchObject({ ok: true, value: { datasets: [expect.anything(), expect.objectContaining({ previousVersionId: datasets.value.datasets[0]!.id })] } });
      const dataPreview = await client.researchDatasetPreview({ datasetId: datasets.value.datasets[0]!.id });
      expect(dataPreview).toMatchObject({ ok: true, value: { preview: { columns: ['nome', 'valor'], rows: [['a', '1']] } } });
      if (dataPreview.ok) expect(dataPreview.value.schema).toContainEqual(expect.objectContaining({ name: 'valor', type: 'number' }));
    } finally { client.dispose(); stop(); channel.port1.close(); channel.port2.close(); await host.dispose(); await rm(root, { recursive: true, force: true }); }
  });
});
