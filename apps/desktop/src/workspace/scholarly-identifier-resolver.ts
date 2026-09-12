import { asReferenceId, type BibliographicEntity } from '@abnt/document-model';
import { IdentifierResolverRegistry, type IdentifierResolution, type ScholarlyIdentifier } from '@abnt/scholarly-identifiers';

import { resolveDoi } from './doi-resolver.js';

type FetchResponse = { readonly ok: boolean; readonly status: number; json(): Promise<unknown>; text(): Promise<string>; };
export type ScholarlyFetch = (input: string, init?: RequestInit) => Promise<FetchResponse>;

const fetcher: ScholarlyFetch = (input, init) => globalThis.fetch(input, init) as Promise<FetchResponse>;
const now = (): string => new Date().toISOString();
const key = (prefix: string, value: string): string => `${prefix}-${value.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/gu, '').toLowerCase()}`;
const provenance = (field: string, provider: string) => [{ field, provider, retrievedAt: now() }];
const year = (value: string | undefined): BibliographicEntity['issued'] | undefined => {
  const found = value?.match(/(?:19|20)\d{2}/u)?.[0];
  return found === undefined ? undefined : { 'date-parts': [[Number(found)]] };
};
const authors = (value: string | undefined): BibliographicEntity['author'] | undefined => value?.split(/\s*(?:;|,\s+and\s+)\s*/u).filter(Boolean).map((name) => ({ literal: name }));

export function createScholarlyIdentifierRegistry(currentFetcher: ScholarlyFetch = fetcher): IdentifierResolverRegistry<BibliographicEntity> {
  const registry = new IdentifierResolverRegistry<BibliographicEntity>();
  registry.register({
    type: 'doi', provider: 'doi.org',
    async resolve(identifier) {
      const entry = await resolveDoi(identifier.value, currentFetcher);
      return { identifier, entry, provenance: provenance('DOI', 'doi.org') };
    },
  });
  registry.register({
    type: 'isbn', provider: 'Open Library',
    async resolve(identifier) {
      const response = await currentFetcher(`https://openlibrary.org/isbn/${encodeURIComponent(identifier.value)}.json`);
      if (!response.ok) throw new Error(`Não foi possível resolver o ISBN (HTTP ${response.status}).`);
      const data = await response.json() as { title?: unknown; authors?: unknown; publish_date?: unknown };
      if (typeof data.title !== 'string' || data.title.trim() === '') throw new Error('O provider não devolveu um título para este ISBN.');
      const names = Array.isArray(data.authors) ? data.authors.flatMap((author) => typeof author === 'object' && author !== null && typeof (author as { name?: unknown }).name === 'string' ? [(author as { name: string }).name] : []) : [];
      const published = typeof data.publish_date === 'string' ? year(data.publish_date) : undefined;
      const entry: BibliographicEntity = { id: asReferenceId(key('isbn', identifier.value)), type: 'book', title: data.title, ISBN: identifier.value, ...(names.length === 0 ? {} : { author: names.map((literal) => ({ literal })) }), ...(published === undefined ? {} : { issued: published }) };
      return { identifier, entry, provenance: provenance('ISBN', 'Open Library') };
    },
  });
  registry.register({
    type: 'pmid', provider: 'Europe PMC',
    async resolve(identifier) {
      const response = await currentFetcher(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?format=json&query=EXT_ID:${encodeURIComponent(identifier.value)}`);
      if (!response.ok) throw new Error(`Não foi possível resolver o PMID (HTTP ${response.status}).`);
      const data = await response.json() as { resultList?: { result?: readonly { title?: unknown; authorString?: unknown; journalTitle?: unknown; pubYear?: unknown; doi?: unknown }[] } };
      const result = data.resultList?.result?.[0];
      if (result === undefined || typeof result.title !== 'string' || result.title.trim() === '') throw new Error('O provider não devolveu um artigo para este PMID.');
      const people = typeof result.authorString === 'string' ? authors(result.authorString) : undefined;
      const published = typeof result.pubYear === 'string' ? year(result.pubYear) : undefined;
      const entry: BibliographicEntity = { id: asReferenceId(key('pmid', identifier.value)), type: 'article-journal', title: result.title, ...(typeof result.doi === 'string' ? { DOI: result.doi } : {}), ...(typeof result.journalTitle === 'string' ? { 'container-title': result.journalTitle } : {}), ...(people === undefined ? {} : { author: people }), ...(published === undefined ? {} : { issued: published }), custom: { PMID: identifier.value } };
      return { identifier, entry, provenance: provenance('PMID', 'Europe PMC') };
    },
  });
  registry.register({
    type: 'arxiv', provider: 'arXiv',
    async resolve(identifier) {
      const response = await currentFetcher(`https://export.arxiv.org/api/query?id_list=${encodeURIComponent(identifier.value)}`);
      if (!response.ok) throw new Error(`Não foi possível resolver o arXiv (HTTP ${response.status}).`);
      const xml = await response.text();
      const tag = (name: string): string | undefined => xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'iu'))?.[1]?.replace(/<[^>]+>/gu, '').replace(/\s+/gu, ' ').trim();
      const title = tag('title');
      if (title === undefined || title === '') throw new Error('O provider não devolveu um artigo para este arXiv.');
      const people = [...xml.matchAll(/<author>\s*<name>([\s\S]*?)<\/name>\s*<\/author>/giu)].map((match) => (match[1] ?? '').replace(/\s+/gu, ' ').trim()).filter(Boolean);
      const published = year(tag('published'));
      const entry: BibliographicEntity = { id: asReferenceId(key('arxiv', identifier.value)), type: 'article-journal', title, URL: `https://arxiv.org/abs/${identifier.value}`, ...(people.length === 0 ? {} : { author: people.map((literal) => ({ literal })) }), ...(published === undefined ? {} : { issued: published }), custom: { arXiv: identifier.value } };
      return { identifier, entry, provenance: provenance('arXiv', 'arXiv') };
    },
  });
  registry.register({ type: 'ads', provider: 'NASA ADS', async resolve(identifier: ScholarlyIdentifier): Promise<IdentifierResolution<BibliographicEntity>> { throw new Error(`O identificador ADS ${identifier.value} requer uma credencial NASA ADS configurada.`); } });
  return registry;
}
