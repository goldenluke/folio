/** Onda BM (F476–F484). Feed nunca entra automaticamente na biblioteca canônica: tudo passa pelo inbox revisável. */
export interface FeedItem {
    readonly id: string;
    readonly title: string;
    readonly link: string;
    readonly publishedAt?: string;
    readonly summary?: string;
}
/**
 * Scanner determinístico: cobre RSS 2.0 (`<item>`) e Atom (`<entry>`) no caso
 * comum. Feeds RDF, namespaces exóticos ou XML agressivamente malformado
 * ficam fora de propósito — mesma régua de `identifiersFromPdfText` (Onda BG).
 */
export declare function parseFeed(xml: string): readonly FeedItem[];
export interface LiteratureSubscription {
    readonly id: string;
    readonly url: string;
    readonly title: string;
    readonly projectId?: string;
    readonly keywords?: readonly string[];
}
export interface LiteratureSubscriptionSet {
    readonly version: 1;
    readonly subscriptions: readonly LiteratureSubscription[];
}
export declare function createLiteratureSubscription(input: LiteratureSubscription): LiteratureSubscription;
export declare function createLiteratureSubscriptionSet(subscriptions?: readonly LiteratureSubscription[]): LiteratureSubscriptionSet;
/** Entrada individual corrompida é descartada, nunca derruba o conjunto inteiro. */
export declare function parseLiteratureSubscriptionSet(input: unknown): LiteratureSubscriptionSet;
export declare function removeLiteratureSubscription(set: LiteratureSubscriptionSet, id: string): LiteratureSubscriptionSet;
export interface LiteratureFeedInboxItem {
    readonly id: string;
    readonly subscriptionId: string;
    readonly title: string;
    readonly link: string;
    readonly publishedAt?: string;
    readonly summary?: string;
    readonly discoveredAt: string;
}
export interface LiteratureFeedInbox {
    readonly version: 1;
    readonly items: readonly LiteratureFeedInboxItem[];
}
export declare function createLiteratureFeedInbox(items?: readonly LiteratureFeedInboxItem[]): LiteratureFeedInbox;
export declare function parseLiteratureFeedInbox(input: unknown): LiteratureFeedInbox;
export declare function removeLiteratureFeedInboxItem(inbox: LiteratureFeedInbox, id: string): LiteratureFeedInbox;
export declare function matchesKeywords(item: Pick<FeedItem, 'title' | 'summary'>, keywords?: readonly string[]): boolean;
/** Só os itens do feed que ainda não estão no inbox desta assinatura (por id/guid) e passam no filtro de palavras-chave. */
export declare function newInboxItemsFromFeed(items: readonly FeedItem[], subscriptionId: string, existingInbox: LiteratureFeedInbox, keywords: readonly string[] | undefined, discoveredAt: string): readonly LiteratureFeedInboxItem[];
//# sourceMappingURL=index.d.ts.map