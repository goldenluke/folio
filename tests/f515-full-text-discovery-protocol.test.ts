import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MessageChannel } from 'node:worker_threads';
import { afterEach, describe, expect, it } from 'vitest';
import { criarServicoDeCompiler } from '@abnt/compiler';
import { createInProcessCompilerClient, createWorkspaceMessagePortClient, serveWorkspaceOverMessagePort } from '@abnt/protocol';
import { DesktopWorkspaceServiceHost } from '../apps/desktop/src/workspace/workspace-service.js';

const originalFetch = globalThis.fetch;
describe('F515–F522 — descoberta e download explícito de texto completo', () => {
  afterEach(() => { globalThis.fetch = originalFetch; });
  it('revisa candidato OpenAlex e só anexa PDF após comando separado', async () => {
    const root = await mkdtemp(join(tmpdir(), 'abnt-f515-'));
    const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
    const channel = new MessageChannel(); const stop = serveWorkspaceOverMessagePort(channel.port1, host); const client = createWorkspaceMessagePortClient(channel.port2);
    globalThis.fetch = (async (url: string) => String(url).includes('openalex') ? { ok: true, status: 200, json: async () => ({ results: [{ best_oa_location: { pdf_url: 'https://example.org/paper.pdf', version: 'publishedVersion' } }] }) } as Response : { ok: true, status: 200, headers: new Headers({ 'content-type': 'application/pdf' }), arrayBuffer: async () => new TextEncoder().encode('%PDF-demo').buffer } as Response) as typeof fetch;
    try {
      expect(await client.open({ rootPath: root })).toMatchObject({ ok: true });
      expect(await client.libraryUpsert({ entry: { id: 'paper', type: 'article-journal', title: 'Paper', DOI: '10.1000/paper' } })).toMatchObject({ ok: true });
      const review = await client.discoverFullText({ referenceId: 'paper' });
      expect(review).toMatchObject({ ok: true, value: { candidates: [expect.objectContaining({ provider: 'OpenAlex', url: 'https://example.org/paper.pdf' })] } });
      const attached = await client.downloadFullText({ referenceId: 'paper', url: 'https://example.org/paper.pdf' });
      expect(attached).toMatchObject({ ok: true, value: { referenceId: 'paper', kind: 'file', role: 'primary', mediaType: 'application/pdf' } });
    } finally { client.dispose(); stop(); channel.port1.close(); channel.port2.close(); await host.dispose(); await rm(root, { recursive: true, force: true }); }
  });
});
