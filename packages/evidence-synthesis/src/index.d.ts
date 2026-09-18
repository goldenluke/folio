/** BX.1 — modelo de evidence synthesis; referências, anexos e Markdown continuam externos. */
export type SourceKind = 'academic-database' | 'search-engine' | 'repository' | 'website' | 'feed' | 'manual-import' | 'reference-manager' | 'filesystem' | 'api' | 'catalog' | 'registry' | 'other';
export type FullTextState = 'not-requested' | 'searching' | 'candidate-found' | 'available' | 'unavailable' | 'restricted' | 'manual-needed';
export type DecisionValue = 'include' | 'exclude' | 'maybe';
export interface EvidenceSource {
    readonly id: string;
    readonly label: string;
    readonly kind: SourceKind;
}
export interface SearchStrategy {
    readonly id: string;
    readonly sourceId: string;
    readonly label: string;
    readonly conceptualQuery: string;
    readonly compiledQuery: string;
}
export interface SearchRun {
    readonly id: string;
    readonly strategyId: string;
    readonly executedAt: string;
    readonly resultCount: number;
    readonly importedCount: number;
    readonly query: string;
    readonly page?: number;
    readonly filters?: readonly string[];
    readonly artifactHash?: string;
}
export interface EvidenceRecord {
    readonly id: string;
    readonly title: string;
    readonly sourceId?: string;
    readonly searchRunId?: string;
    readonly referenceId?: string;
    readonly workId: string;
    readonly identifiers: readonly string[];
}
export interface EvidenceWork {
    readonly id: string;
    readonly title: string;
    readonly referenceId?: string;
    readonly recordIds: readonly string[];
    readonly artifactIds: readonly string[];
    readonly fullText: FullTextState;
}
export interface EvidenceArtifact {
    readonly id: string;
    readonly workId: string;
    readonly attachmentId?: string;
    readonly kind: 'pdf' | 'preprint' | 'accepted-manuscript' | 'supplementary' | 'dataset' | 'webpage' | 'other';
}
export interface EvidenceItem {
    readonly id: string;
    readonly workId: string;
    readonly label: string;
    readonly kind: 'study' | 'experiment' | 'claim' | 'finding' | 'dataset' | 'case' | 'policy' | 'patent' | 'document' | 'interview' | 'legal-precedent' | 'other';
}
export type ClaimRelationKind = 'supports' | 'contradicts';
export interface EvidenceClaimRelation {
    readonly id: string;
    readonly claimId: string;
    readonly evidenceItemId: string;
    readonly relation: ClaimRelationKind;
    readonly note?: string;
    readonly reviewerId: string;
    readonly createdAt: string;
}
export interface ClaimProvenanceEntry {
    readonly claimId: string;
    readonly evidenceItemId: string;
    readonly relation: ClaimRelationKind;
    readonly workId: string;
    readonly workTitle: string;
    readonly extractionIds: readonly string[];
    readonly artifactIds: readonly string[];
    readonly pages: readonly number[];
    readonly annotationIds: readonly string[];
}
export interface AssessmentStage {
    readonly id: string;
    readonly label: string;
    readonly decisions: readonly DecisionValue[];
    readonly reviewersRequired: number;
    readonly blind: boolean;
    readonly exclusionReasonRequired: boolean;
}
export interface Criterion {
    readonly id: string;
    readonly label: string;
    readonly description?: string;
    readonly stageId: string;
    readonly polarity: 'include' | 'exclude';
    readonly required: boolean;
}
export interface EvidenceDecision {
    readonly evidenceItemId: string;
    readonly stageId: string;
    readonly reviewerId: string;
    readonly decision: DecisionValue;
    readonly at: string;
    readonly reasonId?: string;
}
export interface EvidenceInboxItem {
    readonly id: string;
    readonly runId?: string;
    readonly title: string;
    readonly authors?: readonly string[];
    readonly year?: string;
    readonly identifiers: readonly string[];
    readonly importedAt: string;
    readonly format: 'ris' | 'bibtex' | 'csl-json' | 'csv' | 'manual';
    readonly rawHash: string;
}
export type ExtractionValue = string | number | boolean | {
    readonly kind: 'date';
    readonly value: string;
} | {
    readonly kind: 'selection';
    readonly value: string;
} | {
    readonly kind: 'identifier';
    readonly value: string;
} | {
    readonly kind: 'reference';
    readonly referenceId: string;
} | {
    readonly kind: 'annotation';
    readonly annotationId: string;
} | {
    readonly kind: 'measure';
    readonly value: number;
    readonly unit?: string;
} | {
    readonly kind: 'object';
    readonly value: Readonly<Record<string, unknown>>;
};
export interface EvidenceExtraction {
    readonly id: string;
    readonly evidenceItemId: string;
    readonly fieldId: string;
    readonly value: ExtractionValue;
    readonly artifactId?: string;
    readonly page?: number;
    readonly annotationId?: string;
    readonly reviewerId: string;
    readonly verifiedAt: string;
}
export interface EvidenceSynthesis {
    readonly version: 1;
    readonly migratedFrom?: 'systematic-review-v1';
    readonly protocol?: {
        readonly id: string;
        readonly title: string;
        readonly question: string;
    };
    readonly sources: readonly EvidenceSource[];
    readonly strategies: readonly SearchStrategy[];
    readonly runs: readonly SearchRun[];
    readonly inbox: readonly EvidenceInboxItem[];
    readonly records: readonly EvidenceRecord[];
    readonly works: readonly EvidenceWork[];
    readonly artifacts: readonly EvidenceArtifact[];
    readonly evidenceItems: readonly EvidenceItem[];
    readonly stages: readonly AssessmentStage[];
    readonly criteria: readonly Criterion[];
    readonly decisions: readonly EvidenceDecision[];
    readonly extractions: readonly EvidenceExtraction[];
    readonly claimRelations?: readonly EvidenceClaimRelation[];
}
export declare function createEvidenceClaim(synthesis: EvidenceSynthesis, input: {
    readonly id?: string;
    readonly workId: string;
    readonly label: string;
}): EvidenceSynthesis;
export declare function linkClaimEvidence(synthesis: EvidenceSynthesis, input: Omit<EvidenceClaimRelation, 'id'> & {
    readonly id?: string;
}): EvidenceSynthesis;
export declare function claimEvidenceRelations(synthesis: EvidenceSynthesis, claimId: string): readonly EvidenceClaimRelation[];
/** Gera um rascunho de manuscrito para prévia; nunca altera o texto autoral. */
export declare function claimManuscriptDraft(synthesis: EvidenceSynthesis, claimId: string): string;
/** Consolida a cadeia de origem da claim para auditoria e revisão editorial. */
export declare function claimProvenance(synthesis: EvidenceSynthesis, claimId: string): readonly ClaimProvenanceEntry[];
export interface ClaimReadiness {
    readonly ready: boolean;
    readonly relationCount: number;
    readonly supportedRelations: number;
    readonly contradictedRelations: number;
    readonly relationsWithoutExtraction: number;
}
export declare function claimReadiness(synthesis: EvidenceSynthesis, claimId: string): ClaimReadiness;
export type LivingClaimState = 'current' | 'stale' | 'unverified';
export interface LivingClaimStatus {
    readonly claimId: string;
    readonly state: LivingClaimState;
    readonly lastEvidenceAt?: string;
    readonly evidenceCount: number;
    readonly staleAfterDays: number;
}
export declare function livingClaimStatus(synthesis: EvidenceSynthesis, claimId: string, now?: Date, staleAfterDays?: number): LivingClaimStatus;
export interface SearchQueryAst {
    readonly operator: 'and' | 'or';
    readonly terms: readonly string[];
}
export interface SearchProviderCapabilities {
    readonly id: string;
    readonly supportsBoolean: boolean;
    readonly supportsQuotedPhrases: boolean;
    readonly supportedFields: readonly ('title' | 'abstract' | 'author' | 'year' | 'doi')[];
}
export interface EvidenceCandidate {
    readonly title: string;
    readonly authors?: readonly string[];
    readonly year?: string;
    readonly identifiers?: readonly string[];
}
export interface Reconciliation {
    readonly evidenceItemId: string;
    readonly stageId: string;
    readonly decision: DecisionValue;
    readonly reconciledBy: string;
    readonly reconciledAt: string;
    readonly note?: string;
}
/** Compila uma AST pequena e auditável; providers não recebem strings autorais opacas. */
export declare function compileSearchQuery(ast: SearchQueryAst, capabilities: SearchProviderCapabilities): string;
/** Importação propositalmente não cria CSL-JSON: resultados entram primeiro na inbox revisável. */
export declare function addCandidatesToInbox(synthesis: EvidenceSynthesis, candidates: readonly EvidenceCandidate[], format: EvidenceInboxItem['format'], importedAt: string, runId?: string): EvidenceSynthesis;
/** Leitura conservadora para intake: campos desconhecidos ficam fora até a revisão humana. */
export declare function parseEvidenceCandidates(input: string, format: EvidenceInboxItem['format']): readonly EvidenceCandidate[];
export declare function createAssessmentStage(input: Omit<AssessmentStage, 'id'> & {
    readonly id?: string;
}): AssessmentStage;
export declare function createCriterion(input: Omit<Criterion, 'id'> & {
    readonly id?: string;
}, stages: readonly AssessmentStage[]): Criterion;
/** Admissão deliberada: um candidato vira item avaliável, mas não uma referência CSL-JSON. */
export declare function admitInboxItem(synthesis: EvidenceSynthesis, inboxId: string): EvidenceSynthesis;
export declare function recordEvidenceDecision(synthesis: EvidenceSynthesis, decision: EvidenceDecision): EvidenceSynthesis;
/** Não infere maioria: divergências só terminam numa decisão explícita de reconciliação. */
export declare function reconcileEvidenceItem(synthesis: EvidenceSynthesis, reconciliation: Reconciliation): EvidenceSynthesis;
export declare function assessmentState(synthesis: EvidenceSynthesis, evidenceItemId: string, stageId: string): 'pending' | 'agreement' | 'conflict' | 'reconciled';
export declare function linkWorkReference(synthesis: EvidenceSynthesis, workId: string, referenceId: string): EvidenceSynthesis;
export declare function recordExtraction(synthesis: EvidenceSynthesis, extraction: EvidenceExtraction): EvidenceSynthesis;
export interface EvidenceOverview {
    readonly sources: number;
    readonly strategies: number;
    readonly runs: number;
    readonly inbox: number;
    readonly records: number;
    readonly works: number;
    readonly fullTexts: number;
    readonly evidenceItems: number;
    readonly pendingAssessments: number;
    readonly conflicts: number;
    readonly extractions: number;
}
export declare function evidenceOverview(synthesis: EvidenceSynthesis): EvidenceOverview;
export declare function narrativeSynthesis(synthesis: EvidenceSynthesis): string;
export declare function evidenceTable(synthesis: EvidenceSynthesis): readonly Readonly<Record<string, string>>[];
export declare function evidenceMap(synthesis: EvidenceSynthesis): readonly {
    readonly fieldId: string;
    readonly count: number;
}[];
export declare function exportEvidenceSynthesis(synthesis: EvidenceSynthesis, format: 'csv' | 'tsv' | 'json'): string;
export interface ReproducibilityPackage {
    readonly version: 1;
    readonly generatedAt: string;
    readonly contentHash: string;
    readonly sources: readonly EvidenceSource[];
    readonly strategies: readonly SearchStrategy[];
    readonly runs: readonly SearchRun[];
    readonly decisions: readonly EvidenceDecision[];
    readonly extractions: readonly EvidenceExtraction[];
    readonly claimRelations: readonly EvidenceClaimRelation[];
    readonly includedEvidenceItems: readonly string[];
    readonly excludedPdfArtifacts: readonly string[];
}
/** Pacote leve e exportável: inclui rastreabilidade, nunca bytes de PDFs protegidos. */
export declare function reproducibilityPackage(synthesis: EvidenceSynthesis, generatedAt?: string): ReproducibilityPackage;
export interface LegacySystematicReview {
    readonly version: 1;
    readonly protocol?: {
        readonly id: string;
        readonly title: string;
        readonly question: string;
        readonly databases: readonly string[];
        readonly searchStrategy: string;
        readonly inclusionCriteria: readonly string[];
        readonly exclusionCriteria: readonly string[];
    };
    readonly searches?: readonly {
        readonly id: string;
        readonly database: string;
        readonly query: string;
        readonly searchedAt: string;
        readonly resultCount: number;
    }[];
    readonly studies: readonly {
        readonly id: string;
        readonly referenceId?: string;
        readonly title: string;
        readonly stage: string;
        readonly decisions: readonly {
            readonly reviewerId: string;
            readonly decision: DecisionValue;
            readonly at: string;
            readonly reasonId?: string;
        }[];
    }[];
    readonly exclusionReasons?: readonly {
        readonly id: string;
        readonly label: string;
    }[];
}
/** Converte sem mutar o legado e sem gerar novas identidades em uma segunda execução. */
export declare function migrateSystematicReview(legacy: LegacySystematicReview): EvidenceSynthesis;
//# sourceMappingURL=index.d.ts.map