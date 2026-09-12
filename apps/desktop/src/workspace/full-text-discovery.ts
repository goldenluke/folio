import { FullTextDiscoveryRegistry, createFullTextCandidate, type FullTextReview } from '@abnt/full-text-discovery';
import type { BibliographicEntity } from '@abnt/document-model';

type FetchResponse = { readonly ok: boolean; readonly status: number; readonly headers: { get(name: string): string | null }; json(): Promise<unknown>; arrayBuffer(): Promise<ArrayBuffer>; };
export type FullTextFetch = (input: string, init?: RequestInit) => Promise<FetchResponse>;
const fetcher: FullTextFetch = (input, init) => globalThis.fetch(input, init) as Promise<FetchResponse>;

/** OpenAlex é provider explícito e devolve somente URLs publicamente declaradas. */
export async function discoverFullText(entry: BibliographicEntity, currentFetcher: FullTextFetch = fetcher): Promise<FullTextReview> {
  const registry = new FullTextDiscoveryRegistry();
  registry.register({ provider: 'OpenAlex', async resolve(query) {
    const filter = query.doi === undefined ? `search=${encodeURIComponent(query.title ?? '')}` : `filter=doi:${encodeURIComponent(query.doi)}`;
    const response = await currentFetcher(`https://api.openalex.org/works?${filter}&per-page=1`);
    if (!response.ok) throw new Error(`Não foi possível consultar OpenAlex (HTTP ${response.status}).`);
    const data = await response.json() as { results?: readonly { best_oa_location?: { pdf_url?: unknown; landing_page_url?: unknown; version?: unknown } }[] };
    const location = data.results?.[0]?.best_oa_location;
    const url = typeof location?.pdf_url === 'string' ? location.pdf_url : typeof location?.landing_page_url === 'string' ? location.landing_page_url : undefined;
    if (url === undefined || location === undefined) return [];
    return [createFullTextCandidate({ provider: 'OpenAlex', url, license: 'open-access', confidence: typeof location.pdf_url === 'string' ? 0.9 : 0.55, retrievedAt: new Date().toISOString(), ...(location.version === 'acceptedVersion' ? { version: 'accepted' } : { version: 'published' }) })];
  } });
  return registry.discover({ ...(entry.DOI === undefined ? {} : { doi: entry.DOI }), ...(entry.title === undefined ? {} : { title: entry.title }) });
}

export async function downloadFullText(url: string, currentFetcher: FullTextFetch = fetcher): Promise<{ readonly base64: string; readonly mediaType: string }> {
  const response = await currentFetcher(url, { headers: { Accept: 'application/pdf,application/octet-stream;q=0.8' } });
  if (!response.ok) throw new Error(`Não foi possível baixar o texto completo (HTTP ${response.status}).`);
  const mediaType = response.headers.get('content-type')?.split(';')[0]?.trim() || 'application/pdf';
  if (mediaType !== 'application/pdf') throw new Error('O candidato não devolveu um PDF; revise o link antes de anexar.');
  return { mediaType, base64: Buffer.from(await response.arrayBuffer()).toString('base64') };
}
