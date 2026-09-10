/** Onda BM (F476–F484). Feed nunca entra automaticamente na biblioteca canônica: tudo passa pelo inbox revisável. */

export interface FeedItem {
  readonly id: string;
  readonly title: string;
  readonly link: string;
  readonly publishedAt?: string;
  readonly summary?: string;
}

const isHttpUri = (value: string): boolean => /^https?:\/\//iu.test(value);

const stripCdata = (value: string): string => {
  const match = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/u.exec(value);
  return match?.[1] ?? value;
};
const decodeEntities = (value: string): string => value
  .replace(/&lt;/giu, '<').replace(/&gt;/giu, '>').replace(/&quot;/giu, '"').replace(/&(?:#39|apos);/giu, "'").replace(/&amp;/giu, '&');
const stripTags = (value: string): string => value.replace(/<[^>]+>/gu, ' ').replace(/\s+/gu, ' ').trim();

function extractBlocks(xml: string, tag: string): readonly string[] {
  const pattern = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'giu');
  const blocks: string[] = [];
  let match = pattern.exec(xml);
  while (match !== null) { blocks.push(match[1] ?? ''); match = pattern.exec(xml); }
  return blocks;
}

function extractText(block: string, tag: string): string | undefined {
  const match = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'iu').exec(block);
  if (match?.[1] === undefined) return undefined;
  return decodeEntities(stripCdata(match[1].trim()));
}

function extractLink(block: string): string | undefined {
  const withHref = /<link\b[^>]*\bhref="([^"]+)"/iu.exec(block);
  if (withHref?.[1] !== undefined) return decodeEntities(withHref[1]);
  return extractText(block, 'link');
}

/**
 * Scanner determinístico: cobre RSS 2.0 (`<item>`) e Atom (`<entry>`) no caso
 * comum. Feeds RDF, namespaces exóticos ou XML agressivamente malformado
 * ficam fora de propósito — mesma régua de `identifiersFromPdfText` (Onda BG).
 */
export function parseFeed(xml: string): readonly FeedItem[] {
  const blocks = [...extractBlocks(xml, 'item'), ...extractBlocks(xml, 'entry')];
  return blocks.flatMap((block) => {
    const title = extractText(block, 'title');
    const link = extractLink(block);
    if (title === undefined || link === undefined || !isHttpUri(link)) return [];
    const guid = extractText(block, 'guid') ?? extractText(block, 'id');
    const publishedAt = extractText(block, 'pubDate') ?? extractText(block, 'updated') ?? extractText(block, 'published');
    const summaryRaw = extractText(block, 'summary') ?? extractText(block, 'description') ?? extractText(block, 'content');
    const summary = summaryRaw === undefined ? undefined : stripTags(summaryRaw);
    return [{
      id: guid ?? link, title: stripTags(title), link,
      ...(publishedAt === undefined ? {} : { publishedAt }),
      ...(summary === undefined || summary === '' ? {} : { summary }),
    }];
  });
}

export interface LiteratureSubscription {
  readonly id: string;
  readonly url: string;
  readonly title: string;
  readonly projectId?: string;
  readonly keywords?: readonly string[];
}
export interface LiteratureSubscriptionSet { readonly version: 1; readonly subscriptions: readonly LiteratureSubscription[]; }

export function createLiteratureSubscription(input: LiteratureSubscription): LiteratureSubscription {
  if (input.id.trim() === '') throw new Error('Assinatura exige identidade.');
  if (!isHttpUri(input.url)) throw new Error('Assinatura exige URL de feed HTTP(S).');
  if (input.title.trim() === '') throw new Error('Assinatura exige título.');
  return input;
}

export function createLiteratureSubscriptionSet(subscriptions: readonly LiteratureSubscription[] = []): LiteratureSubscriptionSet {
  const ids = new Set<string>();
  for (const subscription of subscriptions) { if (ids.has(subscription.id)) throw new Error(`Assinatura duplicada: ${subscription.id}.`); ids.add(subscription.id); }
  return { version: 1, subscriptions };
}

/** Entrada individual corrompida é descartada, nunca derruba o conjunto inteiro. */
export function parseLiteratureSubscriptionSet(input: unknown): LiteratureSubscriptionSet {
  if (typeof input !== 'object' || input === null || (input as { version?: unknown }).version !== 1 || !Array.isArray((input as { subscriptions?: unknown }).subscriptions)) {
    return createLiteratureSubscriptionSet([]);
  }
  const seen = new Set<string>();
  const subscriptions: LiteratureSubscription[] = [];
  for (const candidate of (input as { subscriptions: readonly unknown[] }).subscriptions) {
    if (typeof candidate !== 'object' || candidate === null) continue;
    const entry = candidate as Partial<LiteratureSubscription>;
    if (typeof entry.id !== 'string' || typeof entry.url !== 'string' || typeof entry.title !== 'string') continue;
    if (entry.projectId !== undefined && typeof entry.projectId !== 'string') continue;
    if (entry.keywords !== undefined && !(Array.isArray(entry.keywords) && entry.keywords.every((keyword) => typeof keyword === 'string'))) continue;
    try {
      const subscription = createLiteratureSubscription({
        id: entry.id, url: entry.url, title: entry.title,
        ...(entry.projectId === undefined ? {} : { projectId: entry.projectId }),
        ...(entry.keywords === undefined ? {} : { keywords: entry.keywords }),
      });
      if (seen.has(subscription.id)) continue;
      seen.add(subscription.id);
      subscriptions.push(subscription);
    } catch { /* entrada corrompida: descarta e segue */ }
  }
  return { version: 1, subscriptions };
}

export function removeLiteratureSubscription(set: LiteratureSubscriptionSet, id: string): LiteratureSubscriptionSet {
  return { version: 1, subscriptions: set.subscriptions.filter((subscription) => subscription.id !== id) };
}

export interface LiteratureFeedInboxItem {
  readonly id: string;
  readonly subscriptionId: string;
  readonly title: string;
  readonly link: string;
  readonly publishedAt?: string;
  readonly summary?: string;
  readonly discoveredAt: string;
}
export interface LiteratureFeedInbox { readonly version: 1; readonly items: readonly LiteratureFeedInboxItem[]; }

const inboxKey = (item: Pick<LiteratureFeedInboxItem, 'subscriptionId' | 'id'>): string => `${item.subscriptionId}:${item.id}`;

export function createLiteratureFeedInbox(items: readonly LiteratureFeedInboxItem[] = []): LiteratureFeedInbox {
  const keys = new Set<string>();
  for (const item of items) { const key = inboxKey(item); if (keys.has(key)) throw new Error(`Item de inbox duplicado: ${key}.`); keys.add(key); }
  return { version: 1, items };
}

export function parseLiteratureFeedInbox(input: unknown): LiteratureFeedInbox {
  if (typeof input !== 'object' || input === null || (input as { version?: unknown }).version !== 1 || !Array.isArray((input as { items?: unknown }).items)) {
    return createLiteratureFeedInbox([]);
  }
  const seen = new Set<string>();
  const items: LiteratureFeedInboxItem[] = [];
  for (const candidate of (input as { items: readonly unknown[] }).items) {
    if (typeof candidate !== 'object' || candidate === null) continue;
    const entry = candidate as Partial<LiteratureFeedInboxItem>;
    if (typeof entry.id !== 'string' || entry.id.trim() === '' || typeof entry.subscriptionId !== 'string' || entry.subscriptionId.trim() === '' ||
      typeof entry.title !== 'string' || entry.title.trim() === '' || typeof entry.link !== 'string' || !isHttpUri(entry.link) || typeof entry.discoveredAt !== 'string') continue;
    const key = inboxKey(entry as LiteratureFeedInboxItem);
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      id: entry.id, subscriptionId: entry.subscriptionId, title: entry.title, link: entry.link, discoveredAt: entry.discoveredAt,
      ...(typeof entry.publishedAt === 'string' ? { publishedAt: entry.publishedAt } : {}),
      ...(typeof entry.summary === 'string' ? { summary: entry.summary } : {}),
    });
  }
  return { version: 1, items };
}

export function removeLiteratureFeedInboxItem(inbox: LiteratureFeedInbox, id: string): LiteratureFeedInbox {
  return { version: 1, items: inbox.items.filter((item) => item.id !== id) };
}

export function matchesKeywords(item: Pick<FeedItem, 'title' | 'summary'>, keywords?: readonly string[]): boolean {
  if (keywords === undefined || keywords.length === 0) return true;
  const haystack = `${item.title} ${item.summary ?? ''}`.toLocaleLowerCase();
  return keywords.some((keyword) => keyword.trim() !== '' && haystack.includes(keyword.trim().toLocaleLowerCase()));
}

/** Só os itens do feed que ainda não estão no inbox desta assinatura (por id/guid) e passam no filtro de palavras-chave. */
export function newInboxItemsFromFeed(
  items: readonly FeedItem[],
  subscriptionId: string,
  existingInbox: LiteratureFeedInbox,
  keywords: readonly string[] | undefined,
  discoveredAt: string,
): readonly LiteratureFeedInboxItem[] {
  const known = new Set(existingInbox.items.filter((entry) => entry.subscriptionId === subscriptionId).map((entry) => entry.id));
  return items.filter((item) => !known.has(item.id) && matchesKeywords(item, keywords)).map((item) => ({
    id: item.id, subscriptionId, title: item.title, link: item.link, discoveredAt,
    ...(item.publishedAt === undefined ? {} : { publishedAt: item.publishedAt }),
    ...(item.summary === undefined ? {} : { summary: item.summary }),
  }));
}
