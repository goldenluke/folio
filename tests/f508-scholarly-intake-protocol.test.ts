import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MessageChannel } from 'node:worker_threads';

import { afterEach, describe, expect, it } from 'vitest';

import { criarServicoDeCompiler } from '@abnt/compiler';
import { createInProcessCompilerClient, createWorkspaceMessagePortClient, serveWorkspaceOverMessagePort } from '@abnt/protocol';

import { DesktopWorkspaceServiceHost } from '../apps/desktop/src/workspace/workspace-service.js';

const DOI_PAYLOAD = { id: 'silva2026', type: 'article-journal', title: 'Pesquisa reprodutível', author: [{ family: 'Silva' }], issued: { 'date-parts': [[2026]] } };
const originalFetch = globalThis.fetch;

describe('F508–F514 — intake de identificadores e reconciliação de PDF', () => {
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('revisa DOI, encontra duplicata e reutiliza o mesmo resolver ao varrer PDF', async () => {
    const root = await mkdtemp(join(tmpdir(), 'abnt-f508-'));
    const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
    const channel = new MessageChannel();
    const stop = serveWorkspaceOverMessagePort(channel.port1, host);
    const client = createWorkspaceMessagePortClient(channel.port2);
    globalThis.fetch = (async () => ({ ok: true, status: 200, json: async () => DOI_PAYLOAD }) as Response) as typeof fetch;
    try {
      expect(await client.open({ rootPath: root })).toMatchObject({ ok: true });
      const first = await client.reviewScholarlyIdentifier({ input: 'https://doi.org/10.1000/exemplo' });
      expect(first).toMatchObject({ ok: true, value: { identifier: { type: 'doi', value: '10.1000/exemplo' }, entry: { id: 'silva2026' }, provenance: [expect.objectContaining({ provider: 'doi.org' })], duplicates: [] } });
      if (!first.ok || first.value.entry === undefined) return;
      expect(await client.libraryUpsert({ entry: first.value.entry })).toMatchObject({ ok: true });
      const duplicate = await client.reviewScholarlyIdentifier({ input: '10.1000/exemplo' });
      expect(duplicate).toMatchObject({ ok: true, value: { duplicates: [expect.objectContaining({ rightId: 'silva2026', reasons: expect.arrayContaining(['doi']) })] } });
      const pdf = await client.reconcilePdf({ text: 'capa\nDOI: 10.1000/exemplo.\n' });
      expect(pdf).toMatchObject({ ok: true, value: { identifiers: [{ type: 'doi', value: '10.1000/exemplo' }] } });
      if (pdf.ok) expect(pdf.value.reviews[0]).toMatchObject({ entry: { id: 'silva2026' }, duplicates: [{ rightId: 'silva2026' }] });
      const pdfBytes = await client.reconcilePdf({ base64: Buffer.from('(DOI: 10.1000/exemplo)', 'latin1').toString('base64') });
      expect(pdfBytes).toMatchObject({ ok: true, value: { identifiers: [{ type: 'doi', value: '10.1000/exemplo' }] } });
    } finally {
      client.dispose(); stop(); channel.port1.close(); channel.port2.close(); await host.dispose(); await rm(root, { recursive: true, force: true });
    }
  });

  it('mantém resultados válidos quando um provider falha no lote', async () => {
    const root = await mkdtemp(join(tmpdir(), 'abnt-f508-batch-'));
    const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
    const channel = new MessageChannel();
    const stop = serveWorkspaceOverMessagePort(channel.port1, host);
    const client = createWorkspaceMessagePortClient(channel.port2);
    globalThis.fetch = (async (input) => String(input).includes('falha')
      ? ({ ok: false, status: 503, json: async () => ({}) }) as Response
      : ({ ok: true, status: 200, json: async () => DOI_PAYLOAD }) as Response) as typeof fetch;
    try {
      expect(await client.open({ rootPath: root })).toMatchObject({ ok: true });
      const result = await client.reviewScholarlyIdentifiersBatch({ input: '10.1000/exemplo; 10.1000/falha' });
      expect(result).toMatchObject({ ok: true });
      if (!result.ok) return;
      expect(result.value).toEqual(expect.arrayContaining([
        expect.objectContaining({ input: '10.1000/exemplo', entry: expect.objectContaining({ id: 'silva2026' }) }),
        expect.objectContaining({ input: '10.1000/falha', error: expect.stringContaining('HTTP 503') }),
      ]));
    } finally {
      client.dispose(); stop(); channel.port1.close(); channel.port2.close(); await host.dispose(); await rm(root, { recursive: true, force: true });
    }
  });
});
