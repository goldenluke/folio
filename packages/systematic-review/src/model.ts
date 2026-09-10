export type ReviewFramework = 'freeform' | 'pico' | 'picos' | 'spider';
export type ScreeningStage = 'identified' | 'deduplicated' | 'title-screened' | 'abstract-screened' | 'full-text' | 'included' | 'excluded';
export type ScreeningDecision = 'include' | 'exclude' | 'maybe';

export interface ReviewProtocol {
  readonly id: string; readonly title: string; readonly question: string; readonly framework: ReviewFramework;
  readonly frameworkFields: Readonly<Record<string, string>>; readonly databases: readonly string[];
  readonly searchStrategy: string; readonly inclusionCriteria: readonly string[]; readonly exclusionCriteria: readonly string[];
  readonly dateRange?: { readonly from?: string; readonly to?: string };
}
export interface SearchStrategyRecord { readonly id: string; readonly database: string; readonly query: string; readonly searchedAt: string; readonly resultCount: number; }
export interface ReviewStudy { readonly id: string; readonly referenceId?: string; readonly title: string; readonly stage: ScreeningStage; readonly duplicateOf?: string; readonly decisions: readonly ReviewerDecision[]; readonly exclusionReasonId?: string; }
export interface ReviewerDecision { readonly reviewerId: string; readonly decision: ScreeningDecision; readonly at: string; readonly reasonId?: string; }
export interface ExclusionReason { readonly id: string; readonly label: string; }
export interface ExtractionField { readonly id: string; readonly label: string; readonly type: 'text' | 'number' | 'select' | 'boolean'; readonly options?: readonly string[]; readonly required?: boolean; }
export interface ExtractionValue { readonly fieldId: string; readonly value: string | number | boolean; }
export interface QualityItem { readonly id: string; readonly label: string; }
export interface QualityAssessment { readonly studyId: string; readonly answers: readonly { readonly itemId: string; readonly value: 'yes' | 'no' | 'unclear' | 'na' }[]; }
export interface EvidenceLink { readonly studyId: string; readonly extractionFieldId: string; readonly literatureNoteFileId?: string; readonly manuscriptFileId?: string; readonly manuscriptSection?: string; }
export interface PrismaFlow { readonly identified: number; readonly deduplicated: number; readonly titleScreened: number; readonly abstractScreened: number; readonly fullText: number; readonly included: number; readonly excluded: number; }
