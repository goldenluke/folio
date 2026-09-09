import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MessageChannel } from 'node:worker_threads';

import { describe, expect, it } from 'vitest';

import { criarServicoDeCompiler } from '@abnt/compiler';
import { createInProcessCompilerClient, createWorkspaceMessagePortClient, serveWorkspaceOverMessagePort } from '@abnt/protocol';

import { DesktopWorkspaceServiceHost } from '../apps/desktop/src/workspace/workspace-service.js';
import { captureUrl, doiFromPdfText, inboxSummary, type IntakeItem } from '../apps/desktop/src/renderer/shell/research-intake.js';

describe('F124–F130 — Research Capture & Intake', () => {
  it('pré-visualiza formato e duplicata no Workspace Service sem escrever library.json', async () => {
    const root = await mkdtemp(join(tmpdir(), 'folio-f124-'));
    const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
    const channel = new MessageChannel(); const stop = serveWorkspaceOverMessagePort(channel.port1, host); const client = createWorkspaceMessagePortClient(channel.port2);
    try {
      const opened = await client.open({ rootPath: root }); if (!opened.ok) throw new Error('vault não abriu');
      await client.libraryUpsert({ entry: { id: 'silva2024', type: 'article-journal', title: 'Método', DOI: '10.1234/metodo' } });
      const preview = await client.libraryIntakePreview({ format: 'bibtex', content: '@article{novo, title = {Método}, doi = {10.1234/metodo}}' });
      expect(preview).toMatchObject({ ok: true, value: { imported: [expect.objectContaining({ id: 'novo' })], duplicates: { novo: [expect.objectContaining({ rightId: 'silva2024', reasons: expect.arrayContaining(['doi']) })] } } });
      expect(await client.libraryList({})).toMatchObject({ ok: true, value: [expect.objectContaining({ id: 'silva2024' })] });
    } finally { client.dispose(); stop(); channel.port1.close(); channel.port2.close(); await host.dispose(); await rm(root, { recursive: true, force: true }); }
  });

  it('mantém URL e PDF honestos: URL não faz scraping e PDF só reconhece DOI literal', () => {
    expect(captureUrl('https://periodico.example.edu/artigo')).toMatchObject({ type: 'webpage', URL: 'https://periodico.example.edu/artigo' });
    expect(captureUrl('file:///segredo.pdf')).toBeUndefined();
    expect(doiFromPdfText('metadata 10.1234/artigo-2026.')).toBe('10.1234/artigo-2026');
    expect(doiFromPdfText('imagem escaneada sem texto')).toBeUndefined();
  });

  it('resume a inbox operacional sem transformá-la em bibliografia publicada', () => {
    const items: readonly IntakeItem[] = [
      { id: 'a', source: 'doi', entry: { id: 'a', type: 'article-journal', title: 'A' }, createdAt: '2026-09-09T00:00:00.000Z', provenance: ['DOI'], duplicates: [] },
      { id: 'b', source: 'pdf', createdAt: '2026-09-09T00:00:00.000Z', provenance: ['sem metadata'], duplicates: [], pdf: { name: 'b.pdf', sha256: 'abc' } },
    ];
    expect(inboxSummary(items)).toEqual({ total: 2, missingAuthors: 2, duplicates: 0, missingYear: 2 });
  });
});
