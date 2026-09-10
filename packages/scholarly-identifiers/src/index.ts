export type ScholarlyIdentifier =
  | { readonly type: 'doi'; readonly value: string }
  | { readonly type: 'isbn'; readonly value: string }
  | { readonly type: 'pmid'; readonly value: string }
  | { readonly type: 'arxiv'; readonly value: string }
  | { readonly type: 'ads'; readonly value: string };

export interface ResolutionProvenance { readonly field: string; readonly provider: string; readonly retrievedAt: string; readonly confidence?: number; }
export interface IdentifierResolution<T> { readonly identifier: ScholarlyIdentifier; readonly entry: T; readonly provenance: readonly ResolutionProvenance[]; }
export interface IdentifierResolver<T> { readonly type: ScholarlyIdentifier['type']; readonly provider: string; resolve(identifier: ScholarlyIdentifier): Promise<IdentifierResolution<T>>; }
export interface IdentifierReview<T> { readonly input: string; readonly identifier?: ScholarlyIdentifier; readonly resolution?: IdentifierResolution<T>; readonly duplicateIds: readonly string[]; readonly error?: string; }

const clean = (value: string): string => value.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//iu, '').replace(/^doi:\s*/iu, '');
export function detectScholarlyIdentifier(input: string): ScholarlyIdentifier | undefined {
  const value = clean(input);
  if (/^10\.\d{4,9}\/\S+$/iu.test(value)) return { type: 'doi', value };
  const isbn = value.replace(/^(?:isbn(?:-1[03])?:?\s*)/iu, '').replace(/[\s-]/gu, '');
  if (/^(?:\d{9}[\dX]|\d{13})$/iu.test(isbn)) return { type: 'isbn', value: isbn };
  const pmid = value.replace(/^pmid:\s*/iu, '');
  if (/^\d{5,9}$/u.test(pmid) && /^pmid:/iu.test(value)) return { type: 'pmid', value: pmid };
  const arxiv = value.replace(/^arxiv:\s*/iu, '');
  if (/^(?:\d{4}\.\d{4,5}|[a-z-]+\/\d{7})(?:v\d+)?$/iu.test(arxiv) && /^arxiv:/iu.test(value)) return { type: 'arxiv', value: arxiv };
  if (/^\d{4}[A-Za-z].{13}[A-Za-z]$/u.test(value)) return { type: 'ads', value };
  return undefined;
}
export function detectScholarlyIdentifiers(input: string): readonly ScholarlyIdentifier[] {
  const seen = new Set<string>();
  return input.split(/[\n,;]/u).flatMap((item) => { const identifier = detectScholarlyIdentifier(item); if (identifier === undefined || seen.has(`${identifier.type}:${identifier.value}`)) return []; seen.add(`${identifier.type}:${identifier.value}`); return [identifier]; });
}
export class IdentifierResolverRegistry<T> {
  #resolvers = new Map<ScholarlyIdentifier['type'], IdentifierResolver<T>>();
  register(resolver: IdentifierResolver<T>): void { this.#resolvers.set(resolver.type, resolver); }
  async resolve(identifier: ScholarlyIdentifier): Promise<IdentifierResolution<T>> { const resolver = this.#resolvers.get(identifier.type); if (resolver === undefined) throw new Error(`Nenhum resolver configurado para ${identifier.type.toUpperCase()}.`); return resolver.resolve(identifier); }
  async review(input: string, duplicateIds: (entry: T) => readonly string[]): Promise<IdentifierReview<T>> { const identifier = detectScholarlyIdentifier(input); return identifier === undefined ? { input, duplicateIds: [], error: 'Identificador acadêmico não reconhecido.' } : this.#review(input, identifier, duplicateIds); }
  async reviewBatch(input: string, duplicateIds: (entry: T) => readonly string[]): Promise<readonly IdentifierReview<T>[]> { return Promise.all(detectScholarlyIdentifiers(input).map((identifier) => this.#review(identifier.value, identifier, duplicateIds))); }
  async #review(input: string, identifier: ScholarlyIdentifier, duplicateIds: (entry: T) => readonly string[]): Promise<IdentifierReview<T>> { try { const resolution = await this.resolve(identifier); return { input, identifier, resolution, duplicateIds: duplicateIds(resolution.entry) }; } catch (error) { return { input, identifier, duplicateIds: [], error: error instanceof Error ? error.message : 'Não foi possível resolver o identificador.' }; } }
}
