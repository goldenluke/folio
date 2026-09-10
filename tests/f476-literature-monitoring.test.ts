import { describe, expect, it } from 'vitest';

import {
  createLiteratureFeedInbox,
  createLiteratureSubscription,
  createLiteratureSubscriptionSet,
  matchesKeywords,
  newInboxItemsFromFeed,
  parseFeed,
  parseLiteratureFeedInbox,
  parseLiteratureSubscriptionSet,
  removeLiteratureFeedInboxItem,
  removeLiteratureSubscription,
} from '../packages/literature-monitoring/src/index.js';

const RSS_FIXTURE = `<?xml version="1.0"?>
<rss version="2.0"><channel><title>Periódico ABNT</title>
<item>
  <title>Ensino híbrido &amp; ABNT</title>
  <link>https://example.org/artigo-1</link>
  <guid>urn:example:1</guid>
  <pubDate>Wed, 10 Sep 2026 00:00:00 GMT</pubDate>
  <description><![CDATA[<p>Resumo do <b>artigo</b> um.</p>]]></description>
</item>
<item>
  <title>Outro assunto</title>
  <link>https://example.org/artigo-2</link>
  <description>Resumo simples do artigo dois.</description>
</item>
</channel></rss>`;

const ATOM_FIXTURE = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom"><title>Blog acadêmico</title>
<entry>
  <title>Nota sobre metodologia</title>
  <link href="https://example.org/nota-1"/>
  <id>tag:example.org,2026:nota-1</id>
  <updated>2026-09-10T00:00:00Z</updated>
  <summary>Uma nota curta sobre metodologia de pesquisa.</summary>
</entry>
</feed>`;

describe('F476–F484 — Literature Monitoring', () => {
  it('extrai itens de RSS 2.0, decodificando entidades e CDATA', () => {
    const items = parseFeed(RSS_FIXTURE);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ id: 'urn:example:1', title: 'Ensino híbrido & ABNT', link: 'https://example.org/artigo-1', publishedAt: 'Wed, 10 Sep 2026 00:00:00 GMT', summary: 'Resumo do artigo um.' });
    expect(items[1]).toMatchObject({ id: 'https://example.org/artigo-2', title: 'Outro assunto' });
  });

  it('extrai itens de Atom, incluindo link por atributo href', () => {
    const items = parseFeed(ATOM_FIXTURE);
    expect(items).toEqual([{ id: 'tag:example.org,2026:nota-1', title: 'Nota sobre metodologia', link: 'https://example.org/nota-1', publishedAt: '2026-09-10T00:00:00Z', summary: 'Uma nota curta sobre metodologia de pesquisa.' }]);
  });

  it('ignora feed vazio ou sem itens reconhecíveis, sem lançar', () => {
    expect(parseFeed('<rss version="2.0"><channel></channel></rss>')).toEqual([]);
    expect(parseFeed('não é xml nenhum')).toEqual([]);
  });

  it('cria e valida assinatura, exigindo URL HTTP(S) e título', () => {
    const subscription = createLiteratureSubscription({ id: 's1', url: 'https://example.org/feed.xml', title: 'Periódico ABNT' });
    expect(subscription.title).toBe('Periódico ABNT');
    expect(() => createLiteratureSubscription({ id: 's1', url: 'ftp://example.org/feed', title: 'X' })).toThrow('HTTP(S)');
    expect(() => createLiteratureSubscription({ id: '', url: 'https://example.org', title: 'X' })).toThrow('identidade');
  });

  it('acrescenta e remove assinaturas do conjunto, rejeitando id duplicado', () => {
    const set = createLiteratureSubscriptionSet([createLiteratureSubscription({ id: 's1', url: 'https://example.org/a.xml', title: 'A' })]);
    expect(() => createLiteratureSubscriptionSet([...set.subscriptions, createLiteratureSubscription({ id: 's1', url: 'https://example.org/b.xml', title: 'B' })])).toThrow('duplicada');
    expect(removeLiteratureSubscription(set, 's1').subscriptions).toEqual([]);
  });

  it('descarta assinatura corrompida do JSON sem derrubar o conjunto', () => {
    const set = parseLiteratureSubscriptionSet({ version: 1, subscriptions: [{ id: 's1', url: 'https://example.org/a.xml', title: 'A' }, { id: 's2', url: 'not-a-url', title: 'B' }] });
    expect(set.subscriptions.map((subscription) => subscription.id)).toEqual(['s1']);
    expect(parseLiteratureSubscriptionSet({ garbage: true })).toEqual({ version: 1, subscriptions: [] });
  });

  it('filtra por palavras-chave em título e resumo, sem filtro aceita tudo', () => {
    const item = { title: 'Ensino híbrido em ABNT', summary: 'Discussão sobre metodologia ativa.' };
    expect(matchesKeywords(item, undefined)).toBe(true);
    expect(matchesKeywords(item, ['metodologia'])).toBe(true);
    expect(matchesKeywords(item, ['inexistente'])).toBe(false);
  });

  it('deduplica itens já conhecidos do inbox por assinatura e aplica o filtro de palavras-chave', () => {
    const items = parseFeed(RSS_FIXTURE);
    const inbox = createLiteratureFeedInbox([{ id: items[0]!.id, subscriptionId: 's1', title: items[0]!.title, link: items[0]!.link, discoveredAt: '2026-09-01T00:00:00.000Z' }]);
    const fresh = newInboxItemsFromFeed(items, 's1', inbox, undefined, '2026-09-10T00:00:00.000Z');
    expect(fresh.map((item) => item.id)).toEqual([items[1]!.id]);
    const filtered = newInboxItemsFromFeed(items, 's2', createLiteratureFeedInbox(), ['assunto'], '2026-09-10T00:00:00.000Z');
    expect(filtered.map((item) => item.id)).toEqual([items[1]!.id]);
  });

  it('remove item do inbox e descarta entrada corrompida na leitura sem derrubar as demais', () => {
    const inbox = createLiteratureFeedInbox([{ id: 'a', subscriptionId: 's1', title: 'A', link: 'https://example.org/a', discoveredAt: '2026-09-10' }]);
    expect(removeLiteratureFeedInboxItem(inbox, 'a').items).toEqual([]);
    const parsed = parseLiteratureFeedInbox({ version: 1, items: [{ id: 'a', subscriptionId: 's1', title: 'A', link: 'https://example.org/a', discoveredAt: '2026-09-10' }, { id: 'b', subscriptionId: 's1', title: '', link: 'https://example.org/b', discoveredAt: '2026-09-10' }] });
    expect(parsed.items.map((item) => item.id)).toEqual(['a']);
  });
});
