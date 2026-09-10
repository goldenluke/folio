export type DatasetFormat = 'csv' | 'tsv' | 'json' | 'xlsx' | 'parquet' | 'image' | 'archive' | 'other';
export interface DatasetMetadata { readonly title: string; readonly description?: string; readonly creator?: string; readonly license?: string; readonly source?: string; readonly collectedAt?: string; readonly version?: string; }
export interface DatasetRecord { readonly id: string; readonly path: string; readonly format: DatasetFormat; readonly metadata: DatasetMetadata; readonly sha256: string; readonly previousVersionId?: string; }
export interface DatasetColumn { readonly name: string; readonly type: 'string' | 'number' | 'boolean' | 'date' | 'unknown'; readonly missing: number; readonly distinct: number; }
export interface DatasetPreview { readonly columns: readonly string[]; readonly rows: readonly (readonly string[])[]; readonly totalRows?: number; }
export interface DataDictionaryEntry { readonly column: string; readonly meaning?: string; readonly unit?: string; readonly allowedValues?: readonly string[]; }
export interface ResearchArtifactLink { readonly datasetId: string; readonly kind: 'figure' | 'table' | 'manuscript-section'; readonly target: string; }
export interface AnalysisProvenance { readonly id: string; readonly datasetId: string; readonly inputHash: string; readonly scriptOrNotebook: string; readonly outputArtifact: string; readonly outputHash: string; }
export interface ReproducibilityManifest { readonly sourceRevision: string; readonly datasets: readonly { readonly id: string; readonly sha256: string; readonly version?: string }[]; readonly analyses: readonly AnalysisProvenance[]; readonly artifacts: readonly string[]; }
