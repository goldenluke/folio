import type { WorkspaceProjectDashboardDto, WorkspaceReferenceHealthDto } from '@abnt/protocol';

/** Estado operacional de um target; o formato publicado continua sendo Markdown. */
export type SubmissionOutput = 'pdf' | 'docx' | 'html' | 'supplemental';

export interface SubmissionPreflightReport {
  readonly generatedAt: string;
  readonly documents: number;
  readonly errors: number;
  readonly warnings: number;
  readonly citations: number;
  readonly figures: number;
  readonly tables: number;
  readonly unresolvedCrossReferences: number;
  /** Referências que a biblioteca não resolve, projetadas por Reference Health. */
  readonly unresolvedCitations: number;
  readonly bibliographyIssues: number;
}

const sum = (documents: readonly WorkspaceProjectDashboardDto['documents'][number][], field: keyof WorkspaceProjectDashboardDto['documents'][number]): number =>
  documents.reduce((total, document) => total + (typeof document[field] === 'number' ? document[field] : 0), 0);

/** F132: composição de projeções existentes, sem parse Markdown ou validador novo no renderer. */
export const submissionPreflight = (
  dashboard: WorkspaceProjectDashboardDto,
  health: WorkspaceReferenceHealthDto,
  generatedAt = new Date().toISOString(),
): SubmissionPreflightReport => ({
  generatedAt,
  documents: dashboard.documents.length,
  errors: sum(dashboard.documents, 'errors'),
  warnings: sum(dashboard.documents, 'warnings'),
  citations: sum(dashboard.documents, 'citations'),
  figures: sum(dashboard.documents, 'figures'),
  tables: sum(dashboard.documents, 'tables'),
  unresolvedCrossReferences: sum(dashboard.documents, 'unresolvedCrossReferences'),
  unresolvedCitations: health.missing.length,
  bibliographyIssues: health.audit.length,
});

export const submissionOutputLabel = (output: SubmissionOutput): string => ({
  pdf: 'PDF', docx: 'DOCX', html: 'HTML', supplemental: 'Arquivos suplementares',
})[output];

export const submissionIsReady = (report: SubmissionPreflightReport): boolean =>
  report.errors === 0 && report.unresolvedCitations === 0 && report.unresolvedCrossReferences === 0;
