import { parseFeed, type FeedItem } from '@abnt/literature-monitoring';

export type FetchLike = (input: string, init?: RequestInit) => Promise<{
  readonly ok: boolean;
  readonly status: number;
  text(): Promise<string>;
}>;

/** Provider explícito, nunca rede silenciosa — mesma régua de `resolveDoi` (doi-resolver.ts). */
export async function fetchFeedItems(url: string, fetcher: FetchLike = globalThis.fetch.bind(globalThis) as FetchLike): Promise<readonly FeedItem[]> {
  const response = await fetcher(url);
  if (!response.ok) throw new Error(`Não foi possível buscar o feed (HTTP ${response.status}).`);
  return parseFeed(await response.text());
}
