import type { BibliographicEntity } from '@abnt/document-model';

export type DuplicateReason = 'doi' | 'isbn' | 'title' | 'author-year';
export interface ReferenceDuplicate {
  readonly leftId: string;
  readonly rightId: string;
  readonly score: number;
  readonly reasons: readonly DuplicateReason[];
}

const normalized = (value: string | undefined): string => (value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const tokens = (value: string | undefined): ReadonlySet<string> => new Set(normalized(value).split(' ').filter((token) => token.length > 2));
const similarity = (left: ReadonlySet<string>, right: ReadonlySet<string>): number => {
  const union = new Set([...left, ...right]);
  if (union.size === 0) return 0;
  return [...left].filter((item) => right.has(item)).length / union.size;
};
const year = (entry: BibliographicEntity): string | undefined => {
  const parts = entry.issued?.['date-parts'];
  const date = parts?.[0];
  const value = date?.[0];
  return value === undefined ? undefined : String(value);
};
const author = (entry: BibliographicEntity): string | undefined => entry.author?.[0]?.family ?? entry.author?.[0]?.literal;

/** F53: só sugere pares explicáveis; nenhuma heurística altera a biblioteca. */
export function findReferenceDuplicates(entries: Readonly<Record<string, BibliographicEntity>>): readonly ReferenceDuplicate[] {
  const result: ReferenceDuplicate[] = [];
  const records = Object.entries(entries);
  for (let index = 0; index < records.length; index += 1) {
    const [leftId, left] = records[index]!;
    for (const [rightId, right] of records.slice(index + 1)) {
      const reasons: DuplicateReason[] = [];
      if (normalized(left.DOI) !== '' && normalized(left.DOI) === normalized(right.DOI)) reasons.push('doi');
      if (normalized(left.ISBN) !== '' && normalized(left.ISBN) === normalized(right.ISBN)) reasons.push('isbn');
      const titleSimilarity = similarity(tokens(left.title), tokens(right.title));
      if (titleSimilarity >= 0.82) reasons.push('title');
      if (normalized(author(left)) !== '' && normalized(author(left)) === normalized(author(right)) && year(left) !== undefined && year(left) === year(right)) reasons.push('author-year');
      if (reasons.length === 0) continue;
      const score = reasons.includes('doi') || reasons.includes('isbn') ? 100 : reasons.includes('title') && reasons.includes('author-year') ? 92 : Math.round(titleSimilarity * 100);
      result.push({ leftId, rightId, score, reasons });
    }
  }
  return result.sort((left, right) => right.score - left.score || left.leftId.localeCompare(right.leftId));
}
