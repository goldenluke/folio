import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MessageChannel } from 'node:worker_threads';

import { afterEach, describe, expect, it } from 'vitest';

import { criarServicoDeCompiler } from '@abnt/compiler';
import { createInProcessCompilerClient, createWorkspaceMessagePortClient, serveWorkspaceOverMessagePort } from '@abnt/protocol';

import { DesktopWorkspaceServiceHost } from '../apps/desktop/src/workspace/workspace-service.js';

const FEED_URL = 'https://example.org/feed.xml';
const RSS_FIXTURE = `<?xml version="1.0"?><rss version="2.0"><channel>
<item><title>Ensino híbrido em ABNT</title><link>https://example.org/artigo-1</link><guid>urn:example:1</guid><description>Resumo sem identificador.</description></item>
<item><title>Achado com DOI</title><link>https://example.org/artigo-2</link><guid>urn:example:2</guid><description>Ver https://doi.org/10.1000/exemplo para detalhes.</description></item>
</channel></rss>`;
const DOI_PAYLOAD = { id: 'silva2026', type: 'article-journal', title: 'Achado com DOI', author: [{ family: 'Silva' }], issued: { 'date-parts': [[2026]] } };

const originalFetch = globalThis.fetch;

describe('F476–F484 — Literature Monitoring (integração de protocolo)', () => {
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('assina, busca (com provider stub), deduplica, filtra, descarta e importa (DOI e manual)', async () => {
    const root = await mkdtemp(join(tmpdir(), 'abnt-f476-'));
    const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
    const channel = new MessageChannel();
    const stop = serveWorkspaceOverMessagePort(channel.port1, host);
    const client = createWorkspaceMessagePortClient(channel.port2);
    globalThis.fetch = (async (url: string) => {
      if (String(url).startsWith('https://doi.org/')) return { ok: true, status: 200, json: async () => DOI_PAYLOAD } as Response;
      return { ok: true, status: 200, text: async () => RSS_FIXTURE } as Response;
    }) as typeof fetch;
    try {
      expect(await client.open({ rootPath: root })).toMatchObject({ ok: true });

      const created = await client.addLiteratureSubscription({ url: FEED_URL, title: 'Periódico ABNT' });
      expect(created).toMatchObject({ ok: true, value: { url: FEED_URL, title: 'Periódico ABNT' } });
      if (!created.ok) return;

      expect(await client.literatureSubscriptions()).toMatchObject({ ok: true, value: { subscriptions: [expect.objectContaining({ id: created.value.id })] } });

      const polled = await client.pollLiteratureSubscription({ id: created.value.id });
      expect(polled).toMatchObject({ ok: true, value: { added: 2 } });

      const inbox = await client.literatureFeedInbox();
      expect(inbox).toMatchObject({ ok: true });
      if (!inbox.ok) return;
      expect(inbox.value.items).toHaveLength(2);

      // Idempotência: buscar de novo com o mesmo feed não duplica.
      const polledAgain = await client.pollLiteratureSubscription({ id: created.value.id });
      expect(polledAgain).toMatchObject({ ok: true, value: { added: 0 } });

      const manualItem = inbox.value.items.find((item) => item.title === 'Ensino híbrido em ABNT')!;
      const doiItem = inbox.value.items.find((item) => item.title === 'Achado com DOI')!;

      // Importação manual (sem DOI detectável): cria entrada mínima e remove do inbox.
      const importedManual = await client.importFeedInboxItem({ id: manualItem.id });
      expect(importedManual).toMatchObject({ ok: true, value: { type: 'webpage', title: 'Ensino híbrido em ABNT', URL: 'https://example.org/artigo-1' } });

      // Importação com DOI detectado no resumo: resolve via o mesmo resolveDoi de F8.
      const importedDoi = await client.importFeedInboxItem({ id: doiItem.id });
      expect(importedDoi).toMatchObject({ ok: true, value: { id: 'silva2026', title: 'Achado com DOI' } });

      const afterImports = await client.literatureFeedInbox();
      if (afterImports.ok) expect(afterImports.value.items).toEqual([]);

      const library = await client.libraryList({});
      expect(library).toMatchObject({ ok: true });
      if (library.ok) expect(library.value.map((entry) => entry.id).sort()).toEqual(expect.arrayContaining(['silva2026']));

      // Filtro por palavra-chave: nova assinatura só aceita itens com "DOI" no texto.
      const filtered = await client.addLiteratureSubscription({ url: 'https://example.org/outro.xml', title: 'Outro feed', keywords: ['DOI'] });
      expect(filtered).toMatchObject({ ok: true });
      if (!filtered.ok) return;
      globalThis.fetch = (async () => ({ ok: true, status: 200, text: async () => RSS_FIXTURE }) as Response) as typeof fetch;
      const polledFiltered = await client.pollLiteratureSubscription({ id: filtered.value.id });
      expect(polledFiltered).toMatchObject({ ok: true, value: { added: 1 } });

      expect(await client.removeLiteratureSubscription({ id: created.value.id })).toMatchObject({ ok: true });
      expect(await client.literatureSubscriptions()).toMatchObject({ ok: true, value: { subscriptions: [expect.objectContaining({ id: filtered.value.id })] } });

      // Descartar remove sem criar referência.
      const secondInbox = await client.literatureFeedInbox();
      if (secondInbox.ok && secondInbox.value.items[0] !== undefined) {
        expect(await client.dismissFeedInboxItem({ id: secondInbox.value.items[0].id })).toMatchObject({ ok: true });
        const finalInbox = await client.literatureFeedInbox();
        if (finalInbox.ok) expect(finalInbox.value.items).toEqual([]);
      }
    } finally {
      client.dispose(); stop(); channel.port1.close(); channel.port2.close(); await host.dispose(); await rm(root, { recursive: true, force: true });
    }
  });
});
