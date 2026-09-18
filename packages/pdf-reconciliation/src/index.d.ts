import { type IdentifierResolverRegistry, type IdentifierReview, type ScholarlyIdentifier } from '@abnt/scholarly-identifiers';
/** Scanner literal: não usa OCR, LLM ou heurística que invente metadata. */
export declare function identifiersFromPdfText(text: string): readonly ScholarlyIdentifier[];
export interface PdfReconciliationCandidate<T> {
    readonly identifiers: readonly ScholarlyIdentifier[];
    readonly reviews: readonly IdentifierReview<T>[];
}
export declare function reconcilePdfText<T>(text: string, registry: IdentifierResolverRegistry<T>, duplicates: (entry: T) => readonly string[]): Promise<PdfReconciliationCandidate<T>>;
//# sourceMappingURL=index.d.ts.map