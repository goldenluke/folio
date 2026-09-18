/** Onda BM (F476–F484). Feed nunca entra automaticamente na biblioteca canônica: tudo passa pelo inbox revisável. */
const isHttpUri = (value) => /^https?:\/\//iu.test(value);
const stripCdata = (value) => {
    const match = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/u.exec(value);
    return match?.[1] ?? value;
};
const decodeEntities = (value) => value
    .replace(/&lt;/giu, '<').replace(/&gt;/giu, '>').replace(/&quot;/giu, '"').replace(/&(?:#39|apos);/giu, "'").replace(/&amp;/giu, '&');
const stripTags = (value) => value.replace(/<[^>]+>/gu, ' ').replace(/\s+/gu, ' ').trim();
function extractBlocks(xml, tag) {
    const pattern = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'giu');
    const blocks = [];
    let match = pattern.exec(xml);
    while (match !== null) {
        blocks.push(match[1] ?? '');
        match = pattern.exec(xml);
    }
    return blocks;
}
function extractText(block, tag) {
    const match = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'iu').exec(block);
    if (match?.[1] === undefined)
        return undefined;
    return decodeEntities(stripCdata(match[1].trim()));
}
function extractLink(block) {
    const withHref = /<link\b[^>]*\bhref="([^"]+)"/iu.exec(block);
    if (withHref?.[1] !== undefined)
        return decodeEntities(withHref[1]);
    return extractText(block, 'link');
}
/**
 * Scanner determinístico: cobre RSS 2.0 (`<item>`) e Atom (`<entry>`) no caso
 * comum. Feeds RDF, namespaces exóticos ou XML agressivamente malformado
 * ficam fora de propósito — mesma régua de `identifiersFromPdfText` (Onda BG).
 */
export function parseFeed(xml) {
    const blocks = [...extractBlocks(xml, 'item'), ...extractBlocks(xml, 'entry')];
    return blocks.flatMap((block) => {
        const title = extractText(block, 'title');
        const link = extractLink(block);
        if (title === undefined || link === undefined || !isHttpUri(link))
            return [];
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
export function createLiteratureSubscription(input) {
    if (input.id.trim() === '')
        throw new Error('Assinatura exige identidade.');
    if (!isHttpUri(input.url))
        throw new Error('Assinatura exige URL de feed HTTP(S).');
    if (input.title.trim() === '')
        throw new Error('Assinatura exige título.');
    return input;
}
export function createLiteratureSubscriptionSet(subscriptions = []) {
    const ids = new Set();
    for (const subscription of subscriptions) {
        if (ids.has(subscription.id))
            throw new Error(`Assinatura duplicada: ${subscription.id}.`);
        ids.add(subscription.id);
    }
    return { version: 1, subscriptions };
}
/** Entrada individual corrompida é descartada, nunca derruba o conjunto inteiro. */
export function parseLiteratureSubscriptionSet(input) {
    if (typeof input !== 'object' || input === null || input.version !== 1 || !Array.isArray(input.subscriptions)) {
        return createLiteratureSubscriptionSet([]);
    }
    const seen = new Set();
    const subscriptions = [];
    for (const candidate of input.subscriptions) {
        if (typeof candidate !== 'object' || candidate === null)
            continue;
        const entry = candidate;
        if (typeof entry.id !== 'string' || typeof entry.url !== 'string' || typeof entry.title !== 'string')
            continue;
        if (entry.projectId !== undefined && typeof entry.projectId !== 'string')
            continue;
        if (entry.keywords !== undefined && !(Array.isArray(entry.keywords) && entry.keywords.every((keyword) => typeof keyword === 'string')))
            continue;
        try {
            const subscription = createLiteratureSubscription({
                id: entry.id, url: entry.url, title: entry.title,
                ...(entry.projectId === undefined ? {} : { projectId: entry.projectId }),
                ...(entry.keywords === undefined ? {} : { keywords: entry.keywords }),
            });
            if (seen.has(subscription.id))
                continue;
            seen.add(subscription.id);
            subscriptions.push(subscription);
        }
        catch { /* entrada corrompida: descarta e segue */ }
    }
    return { version: 1, subscriptions };
}
export function removeLiteratureSubscription(set, id) {
    return { version: 1, subscriptions: set.subscriptions.filter((subscription) => subscription.id !== id) };
}
const inboxKey = (item) => `${item.subscriptionId}:${item.id}`;
export function createLiteratureFeedInbox(items = []) {
    const keys = new Set();
    for (const item of items) {
        const key = inboxKey(item);
        if (keys.has(key))
            throw new Error(`Item de inbox duplicado: ${key}.`);
        keys.add(key);
    }
    return { version: 1, items };
}
export function parseLiteratureFeedInbox(input) {
    if (typeof input !== 'object' || input === null || input.version !== 1 || !Array.isArray(input.items)) {
        return createLiteratureFeedInbox([]);
    }
    const seen = new Set();
    const items = [];
    for (const candidate of input.items) {
        if (typeof candidate !== 'object' || candidate === null)
            continue;
        const entry = candidate;
        if (typeof entry.id !== 'string' || entry.id.trim() === '' || typeof entry.subscriptionId !== 'string' || entry.subscriptionId.trim() === '' ||
            typeof entry.title !== 'string' || entry.title.trim() === '' || typeof entry.link !== 'string' || !isHttpUri(entry.link) || typeof entry.discoveredAt !== 'string')
            continue;
        const key = inboxKey(entry);
        if (seen.has(key))
            continue;
        seen.add(key);
        items.push({
            id: entry.id, subscriptionId: entry.subscriptionId, title: entry.title, link: entry.link, discoveredAt: entry.discoveredAt,
            ...(typeof entry.publishedAt === 'string' ? { publishedAt: entry.publishedAt } : {}),
            ...(typeof entry.summary === 'string' ? { summary: entry.summary } : {}),
        });
    }
    return { version: 1, items };
}
export function removeLiteratureFeedInboxItem(inbox, id) {
    return { version: 1, items: inbox.items.filter((item) => item.id !== id) };
}
export function matchesKeywords(item, keywords) {
    if (keywords === undefined || keywords.length === 0)
        return true;
    const haystack = `${item.title} ${item.summary ?? ''}`.toLocaleLowerCase();
    return keywords.some((keyword) => keyword.trim() !== '' && haystack.includes(keyword.trim().toLocaleLowerCase()));
}
/** Só os itens do feed que ainda não estão no inbox desta assinatura (por id/guid) e passam no filtro de palavras-chave. */
export function newInboxItemsFromFeed(items, subscriptionId, existingInbox, keywords, discoveredAt) {
    const known = new Set(existingInbox.items.filter((entry) => entry.subscriptionId === subscriptionId).map((entry) => entry.id));
    return items.filter((item) => !known.has(item.id) && matchesKeywords(item, keywords)).map((item) => ({
        id: item.id, subscriptionId, title: item.title, link: item.link, discoveredAt,
        ...(item.publishedAt === undefined ? {} : { publishedAt: item.publishedAt }),
        ...(item.summary === undefined ? {} : { summary: item.summary }),
    }));
}
//# sourceMappingURL=index.js.map