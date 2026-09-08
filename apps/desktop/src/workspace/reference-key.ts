import type { BibliographicEntity } from '@abnt/document-model';

export type ReferenceKeyPolicy = 'author-year' | 'title-year';

const slug = (value: string | undefined): string => (value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-+|-+$/gu, '');
const year = (entry: BibliographicEntity): string => {
  const parts = entry.issued?.['date-parts'];
  const date = parts?.[0];
  const value = date?.[0];
  return value === undefined ? '' : String(value);
};

export function suggestReferenceKey(entry: BibliographicEntity, policy: ReferenceKeyPolicy, occupied: ReadonlySet<string>): string {
  const author = entry.author?.[0]?.family ?? entry.author?.[0]?.literal;
  const seed = policy === 'author-year' ? `${slug(author) || slug(entry.title) || 'referencia'}${year(entry)}` : `${slug(entry.title).split('-').slice(0, 3).join('-') || slug(author) || 'referencia'}${year(entry)}`;
  if (!occupied.has(seed)) return seed;
  for (let index = 0; index < 26; index += 1) { const candidate = `${seed}${String.fromCharCode(97 + index)}`; if (!occupied.has(candidate)) return candidate; }
  let index = 2; while (occupied.has(`${seed}-${index}`)) index += 1;
  return `${seed}-${index}`;
}
