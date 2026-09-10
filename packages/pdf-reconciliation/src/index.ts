import { detectScholarlyIdentifier, type IdentifierResolverRegistry, type IdentifierReview, type ScholarlyIdentifier } from '@abnt/scholarly-identifiers';

/** Scanner literal: não usa OCR, LLM ou heurística que invente metadata. */
export function identifiersFromPdfText(text: string): readonly ScholarlyIdentifier[] {
  const candidates = [
    ...(text.match(/10\.\d{4,9}\/[\w.()/:;-]+/giu) ?? []),
    ...(text.match(/(?:PMID:\s*)\d{5,9}/giu) ?? []),
    ...(text.match(/(?:arXiv:\s*)(?:\d{4}\.\d{4,5}|[a-z-]+\/\d{7})(?:v\d+)?/giu) ?? []),
    ...(text.match(/(?:ISBN(?:-1[03])?:?\s*)?(?:(?:\d[ -]?){12}\d|(?:\d[ -]?){9}[\dX])/giu) ?? []),
  ];
  const seen = new Set<string>();
  return candidates.flatMap((candidate) => {
    const identifier = detectScholarlyIdentifier(candidate.replace(/[.,;:)}\]]+$/u, ''));
    if (identifier === undefined || seen.has(`${identifier.type}:${identifier.value}`)) return [];
    seen.add(`${identifier.type}:${identifier.value}`);
    return [identifier];
  });
}

export interface PdfReconciliationCandidate<T> { readonly identifiers: readonly ScholarlyIdentifier[]; readonly reviews: readonly IdentifierReview<T>[]; }
export async function reconcilePdfText<T>(text: string, registry: IdentifierResolverRegistry<T>, duplicates: (entry: T) => readonly string[]): Promise<PdfReconciliationCandidate<T>> {
  const identifiers = identifiersFromPdfText(text);
  const reviews = await Promise.all(identifiers.map(async (identifier) => registry.review(`${identifier.type === 'pmid' ? 'PMID:' : identifier.type === 'arxiv' ? 'arXiv:' : ''}${identifier.value}`, duplicates)));
  return { identifiers, reviews };
}
