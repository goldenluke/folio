export type ScholarlyIdentifier = {
    readonly type: 'doi';
    readonly value: string;
} | {
    readonly type: 'isbn';
    readonly value: string;
} | {
    readonly type: 'pmid';
    readonly value: string;
} | {
    readonly type: 'arxiv';
    readonly value: string;
} | {
    readonly type: 'ads';
    readonly value: string;
};
export interface ResolutionProvenance {
    readonly field: string;
    readonly provider: string;
    readonly retrievedAt: string;
    readonly confidence?: number;
}
export interface IdentifierResolution<T> {
    readonly identifier: ScholarlyIdentifier;
    readonly entry: T;
    readonly provenance: readonly ResolutionProvenance[];
}
export interface IdentifierResolver<T> {
    readonly type: ScholarlyIdentifier['type'];
    readonly provider: string;
    resolve(identifier: ScholarlyIdentifier): Promise<IdentifierResolution<T>>;
}
export interface IdentifierReview<T> {
    readonly input: string;
    readonly identifier?: ScholarlyIdentifier;
    readonly resolution?: IdentifierResolution<T>;
    readonly duplicateIds: readonly string[];
    readonly error?: string;
}
export declare function detectScholarlyIdentifier(input: string): ScholarlyIdentifier | undefined;
export declare function detectScholarlyIdentifiers(input: string): readonly ScholarlyIdentifier[];
export declare class IdentifierResolverRegistry<T> {
    #private;
    register(resolver: IdentifierResolver<T>): void;
    resolve(identifier: ScholarlyIdentifier): Promise<IdentifierResolution<T>>;
    review(input: string, duplicateIds: (entry: T) => readonly string[]): Promise<IdentifierReview<T>>;
    reviewBatch(input: string, duplicateIds: (entry: T) => readonly string[]): Promise<readonly IdentifierReview<T>[]>;
}
//# sourceMappingURL=index.d.ts.map