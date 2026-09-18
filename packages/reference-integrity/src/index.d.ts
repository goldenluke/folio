/** Onda BR: evidência de integridade é operacional e nunca altera o CSL-JSON. */
export type ReferenceIntegrityStatus = 'normal' | 'retracted' | 'corrected' | 'expression-of-concern' | 'unknown';
export interface ReferenceIntegrityRecord {
    readonly referenceId: string;
    readonly status: ReferenceIntegrityStatus;
    /** Fonte declarada pelo pesquisador, por exemplo Crossmark ou editora. */
    readonly provider: string;
    /** URL ou identificador da evidência consultada; não é buscado silenciosamente. */
    readonly evidence: string;
    readonly checkedAt: string;
}
export interface ReferenceIntegritySet {
    readonly version: 1;
    readonly records: readonly ReferenceIntegrityRecord[];
}
export declare function createReferenceIntegrityRecord(input: ReferenceIntegrityRecord): ReferenceIntegrityRecord;
export declare function createReferenceIntegritySet(records?: readonly ReferenceIntegrityRecord[]): ReferenceIntegritySet;
/** Entradas corrompidas são isoladas: uma fonte ruim não invalida toda a auditoria. */
export declare function parseReferenceIntegritySet(value: unknown): ReferenceIntegritySet;
export declare function upsertReferenceIntegrity(set: ReferenceIntegritySet, record: ReferenceIntegrityRecord): ReferenceIntegritySet;
export declare function integrityForReference(set: ReferenceIntegritySet, referenceId: string): ReferenceIntegrityRecord | undefined;
//# sourceMappingURL=index.d.ts.map