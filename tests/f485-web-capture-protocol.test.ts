import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MessageChannel } from 'node:worker_threads';

import { afterEach, describe, expect, it } from 'vitest';

import { criarServicoDeCompiler } from '@abnt/compiler';
import { createInProcessCompilerClient, createWorkspaceMessagePortClient, serveWorkspaceOverMessagePort } from '@abnt/protocol';

import { DesktopWorkspaceServiceHost } from '../apps/desktop/src/workspace/workspace-service.js';

const PAGE_URL = 'https://example.org/artigo';
const PAGE_HTML = `<html><head>
<meta name="citation_title" content="Título scrapeado da página">
<meta name="citation_doi" content="10.1000/exemplo.protocolo">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":"Item JSON-LD sem DOI","author":"Autor Sem DOI"}</script>
</head><body></body></html>`;
const DOI_PAYLOAD = { id: 'silva2026', type: 'article-journal', title: 'Título verdadeiro via Crossref', author: [{ family: 'Silva' }], issued: { 'date-parts': [[2026]] } };

const originalFetch = globalThis.fetch;

describe('F485–F495 — Scholarly Web Capture 2.0 (integração de protocolo)', () => {
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('extrai candidatos de múltiplos formatos, ranqueados, e enriquece o candidato com DOI via resolveDoi (F8)', async () => {
    const root = await mkdtemp(join(tmpdir(), 'abnt-f485-'));
    const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
    const channel = new MessageChannel();
    const stop = serveWorkspaceOverMessagePort(channel.port1, host);
    const client = createWorkspaceMessagePortClient(channel.port2);
    globalThis.fetch = (async (url: string) => {
      if (String(url).startsWith('https://doi.org/')) return { ok: true, status: 200, json: async () => DOI_PAYLOAD } as Response;
      return { ok: true, status: 200, text: async () => PAGE_HTML } as Response;
    }) as typeof fetch;
    try {
      expect(await client.open({ rootPath: root })).toMatchObject({ ok: true });

      const result = await client.webCaptureExtract({ url: PAGE_URL });
      expect(result).toMatchObject({ ok: true });
      if (!result.ok) return;

      expect(result.value.candidates.length).toBeGreaterThanOrEqual(2);
      const extractorIds = result.value.candidates.map((candidate) => candidate.extractorId);
      expect(extractorIds).toEqual(expect.arrayContaining(['citation-meta', 'json-ld']));

      for (let index = 1; index < result.value.candidates.length; index += 1) {
        expect(result.value.candidates[index]!.quality).toBeLessThanOrEqual(result.value.candidates[index - 1]!.quality);
      }

      const enriched = result.value.candidates.find((candidate) => candidate.extractorId === 'citation-meta');
      expect(enriched?.fields).toMatchObject({ title: 'Título verdadeiro via Crossref', DOI: '10.1000/exemplo.protocolo' });
      expect(enriched?.fields.author).toBeDefined();
      // Ganhou author+issued do Crossref: pontua mais que os 2 campos só de citation_meta (title+DOI).
      expect(enriched!.quality).toBeGreaterThan(0.4);

      const untouched = result.value.candidates.find((candidate) => candidate.extractorId === 'json-ld');
      expect(untouched?.fields).toMatchObject({ title: 'Item JSON-LD sem DOI' });
      expect(untouched?.fields.DOI).toBeUndefined();
    } finally {
      client.dispose(); stop(); channel.port1.close(); channel.port2.close(); await host.dispose(); await rm(root, { recursive: true, force: true });
    }
  });

  it('propaga erro de rede sem derrubar o protocolo quando a página não pode ser buscada', async () => {
    const root = await mkdtemp(join(tmpdir(), 'abnt-f485-erro-'));
    const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
    const channel = new MessageChannel();
    const stop = serveWorkspaceOverMessagePort(channel.port1, host);
    const client = createWorkspaceMessagePortClient(channel.port2);
    globalThis.fetch = (async () => ({ ok: false, status: 404, text: async () => '' }) as Response) as typeof fetch;
    try {
      expect(await client.open({ rootPath: root })).toMatchObject({ ok: true });
      const result = await client.webCaptureExtract({ url: PAGE_URL });
      expect(result).toMatchObject({ ok: false, error: { code: 'INTERNAL' } });
    } finally {
      client.dispose(); stop(); channel.port1.close(); channel.port2.close(); await host.dispose(); await rm(root, { recursive: true, force: true });
    }
  });
});
