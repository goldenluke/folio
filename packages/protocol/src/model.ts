import type {
  BibliographicEntity,
  DocumentAst,
  JsonValue,
  Registry,
} from '@abnt/document-model';
import type { PublicationDocument } from '@abnt/publication';
export type { PublicationDocument } from '@abnt/publication';

/**
 * Versão do protocolo entre processos. Ela não acompanha automaticamente a
 * versão da AST: contratos de transporte evoluem em ritmo próprio.
 */
export const PROTOCOL_VERSION = 1 as const;
export type ProtocolVersion = typeof PROTOCOL_VERSION;

/** Identidade pública de uma build; deliberadamente não contém paths nem dados do vault. */
export type BuildChannel = 'development' | 'preview' | 'stable';

export interface SystemInformationDto {
  readonly schemaVersion: 1;
  readonly product: 'Folio';
  readonly appVersion: string;
  readonly commit: string;
  readonly channel: BuildChannel;
  readonly platform: string;
  readonly architecture: string;
  readonly electronVersion: string;
  readonly protocolVersion: number;
  readonly workspaceConfigSchemaVersion: number;
  readonly workspaceStateSchemaVersion: number;
  readonly workspaceIndexSchemaVersion: number;
  readonly pluginApiVersion: number;
}

/** Resultado serializável para toda fronteira de serviço. */
export type ProtocolResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ProtocolError };

export type ProtocolErrorCode =
  | 'VALIDATION'
  | 'CANCELLED'
  | 'CONFLICT'
  | 'NOT_FOUND'
  | 'UNSUPPORTED_VERSION'
  | 'UNSUPPORTED_METHOD'
  | 'INTERNAL';

export interface ProtocolProblem {
  readonly path: string;
  readonly message: string;
}

/** Erros nunca atravessam a fronteira como `Error`, stack trace ou `unknown`. */
export interface ProtocolError {
  readonly code: ProtocolErrorCode;
  readonly message: string;
  readonly problems?: readonly ProtocolProblem[];
}

export const protocolOk = <T>(value: T): ProtocolResult<T> => ({ ok: true, value });

export const protocolError = (
  code: ProtocolErrorCode,
  message: string,
  problems?: readonly ProtocolProblem[],
): ProtocolResult<never> => ({
  ok: false,
  error: {
    code,
    message,
    ...(problems !== undefined && problems.length > 0 ? { problems } : {}),
  },
});

// ---------------------------------------------------------------------------
// DTOs do compiler
// ---------------------------------------------------------------------------

/** SourceSnapshot sem brands: strings cruzam o processo; brands ficam no domínio. */
export interface SourceSnapshotDto {
  readonly documentId: string;
  readonly revision: number;
  readonly content: string;
  readonly contentHash: string;
}

/** Posições e diagnósticos transportam strings, não IDs branded do domínio. */
export interface SourcePositionDto {
  readonly offset: number;
  readonly line?: number;
  readonly column?: number;
}

export interface SourceRangeDto {
  readonly documentId: string;
  readonly start: SourcePositionDto;
  readonly end: SourcePositionDto;
}

export interface DiagnosticDto {
  readonly id: string;
  readonly severity: 'info' | 'warning' | 'error';
  readonly message: string;
  readonly nodeId?: string;
  readonly source?: SourceRangeDto;
}

/** CSL-JSON atravessa o limite sem carregar o brand local de ReferenceId. */
export type BibliographicEntityDto = Omit<BibliographicEntity, 'id'> & {
  readonly id: string;
};

export interface AuthoredResourceDependencyDto {
  readonly resourceId: string;
  readonly authoredUri: string;
}

export interface AuthoredDependenciesDto {
  readonly bibliographyUris: readonly string[];
  readonly resources: readonly AuthoredResourceDependencyDto[];
}

export interface BibliographySourceDto {
  readonly id: string;
  readonly authoredUri?: string;
  readonly resolvedUri?: string;
  readonly format: 'bibtex' | 'csl-json' | 'ris' | 'memory' | 'remote';
  readonly contentHash?: string;
}

export interface BibliographyProvenanceDto {
  readonly sourceId: string;
  readonly sourceUri?: string;
}

export interface BibliographyEnvironmentDto {
  readonly entries: Registry<BibliographicEntityDto>;
  readonly sources: readonly BibliographySourceDto[];
  readonly provenanceByReference: Registry<readonly BibliographyProvenanceDto[]>;
}

export interface ResourceResolutionDto {
  readonly resourceId: string;
  readonly authoredUri: string;
  readonly status: 'resolved' | 'external' | 'missing' | 'blocked';
  readonly resolvedUri?: string;
  readonly mediaType?: string;
  readonly contentHash?: string;
}

export interface CompilationEnvironmentDto {
  readonly bibliography: BibliographyEnvironmentDto;
  readonly resources: Registry<ResourceResolutionDto>;
  readonly dependencies: {
    readonly bibliography: readonly BibliographySourceDto[];
    readonly resources: readonly ResourceResolutionDto[];
  };
  readonly configuration?: {
    readonly defaultProfileId?: string;
  };
}

export interface EnvironmentPreparationDto {
  readonly environment: CompilationEnvironmentDto;
  readonly diagnostics: readonly DiagnosticDto[];
}

export interface PreparedCompilationDto {
  readonly source: SourceSnapshotDto;
  readonly document: DocumentAst;
  readonly dependencies: AuthoredDependenciesDto;
  readonly diagnostics: readonly DiagnosticDto[];
}

/** `ResolvedDocument` serializado: Map e AnnotationStore não vazam para IPC. */
export interface ResolvedDocumentDto {
  readonly ast: DocumentAst;
  readonly bibliography: Registry<BibliographicEntityDto>;
  readonly annotations: Readonly<Record<string, Readonly<Record<string, JsonValue>>>>;
  readonly diagnostics: readonly DiagnosticDto[];
  readonly identifiers: Readonly<Record<string, string>>;
  readonly citations: {
    readonly citedReferenceIds: readonly string[];
    readonly numberByReference: Readonly<Record<string, number>>;
    readonly yearSuffixByReference: Readonly<Record<string, string>>;
  };
}

export interface ValidationReportDto {
  readonly standards: readonly { readonly id: string; readonly version: string }[];
  readonly diagnostics: readonly DiagnosticDto[];
  readonly errors: number;
  readonly warnings: number;
}

export interface CompilationResultDto {
  readonly unit: {
    readonly document: DocumentAst;
    readonly environment: CompilationEnvironmentDto;
  };
  readonly documentId: string;
  readonly revision: number;
  readonly contentHash: string;
  readonly profileId: string;
  readonly ast: DocumentAst;
  readonly resolved: ResolvedDocumentDto;
  readonly validation: ValidationReportDto;
  readonly publication: PublicationDocument;
  readonly diagnostics: readonly DiagnosticDto[];
}

export interface CompilerPrepareRequest {
  readonly source: SourceSnapshotDto;
}

export interface CompilerCompileRequest {
  readonly prepared: PreparedCompilationDto;
  readonly environment: EnvironmentPreparationDto;
  readonly profileId?: string;
}

/** F96/F97: metadata declarativa de profile para hosts; sem funções normativas. */
export interface PublicationProfileManifestDto {
  readonly id: string;
  readonly version: string;
  readonly name: string;
  readonly description?: string;
  readonly documentKinds: readonly string[];
  readonly citationSystem?: string;
  readonly capabilities: readonly string[];
  readonly requiredMetadata: readonly string[];
  readonly optionalMetadata: readonly string[];
  readonly rules: readonly { readonly id: string; readonly standard?: string; readonly description: string }[];
  readonly pagePolicy: { readonly size: 'A4' | 'Letter'; readonly margin: { readonly top: string; readonly right: string; readonly bottom: string; readonly left: string }; readonly pageNumber?: 'top-right' | 'top-center' | 'bottom-center' | 'none' };
  readonly composition?: { readonly baseProfileId: string; readonly overrides: readonly string[] };
}

export interface CompilerProfilesRequest {}

/** Contrato comum a implementação em memória, worker e utility process. */
export interface CompilerService {
  profiles(request: CompilerProfilesRequest, signal?: AbortSignal): Promise<ProtocolResult<readonly PublicationProfileManifestDto[]>>;
  prepare(
    request: CompilerPrepareRequest,
    signal?: AbortSignal,
  ): Promise<ProtocolResult<PreparedCompilationDto>>;
  compile(
    request: CompilerCompileRequest,
    signal?: AbortSignal,
  ): Promise<ProtocolResult<CompilationResultDto>>;
}

export type ExportFormat = 'pdf' | 'docx' | 'html';
/** Alias explícito do contrato de exportação que atravessa o desktop. */
export type DesktopExportFormat = ExportFormat;

export interface ExportRequest {
  readonly publication: PublicationDocument;
  readonly format: ExportFormat;
}

/** `pages` só é preenchido para PDF; DOCX não tem conceito de página na geração. */
export interface ExportResultDto {
  readonly bytes: Uint8Array;
  readonly pages?: number;
}

/**
 * Gera o arquivo final (PDF via Paged.js/Chromium, DOCX via OOXML) a partir
 * da Publication AST que o Workspace Service já resolveu. Roda isolado num
 * utility process próprio (Export Service) pelo mesmo motivo que o Compiler
 * Service é isolado — Chromium é um processo pesado e passível de travar, e
 * um crash aqui não pode levar o vault junto. Ver ADR 0019.
 */
export interface ExportService {
  export(request: ExportRequest, signal?: AbortSignal): Promise<ProtocolResult<ExportResultDto>>;
}

// ---------------------------------------------------------------------------
// Contratos iniciais do workspace (a implementação pertence à P2)
// ---------------------------------------------------------------------------

export interface WorkspaceFileDto {
  readonly fileId: string;
  readonly documentId?: string;
  readonly path: string;
  readonly revision: number;
  readonly contentHash: string;
  readonly mediaType?: string;
}

export interface WorkspaceReadRequest {
  readonly fileId: string;
}

export interface WorkspaceReadResponse {
  readonly file: WorkspaceFileDto;
  readonly content: string;
}

/** Preview seguro de um asset binário; nunca expõe path local ao renderer. */
export interface WorkspaceAssetPreviewRequest { readonly fileId: string; }
export interface WorkspaceAssetPreviewResponse { readonly dataUrl: string; readonly mediaType: string; }

export interface WorkspaceWriteRequest {
  readonly fileId: string;
  readonly content: string;
  /** Revisão que o cliente leu; protege contra sobrescrita externa silenciosa. */
  readonly expectedRevision: number;
}

export interface WorkspaceRenameRequest {
  readonly fileId: string;
  readonly path: string;
  readonly expectedRevision: number;
}

export interface WorkspaceListRequest {
  readonly path?: string;
}

export interface WorkspaceSearchRequest {
  readonly query: string;
  readonly limit?: number;
}

/** F83: projeção vault-wide de diagnósticos já produzidos pelo host. */
export interface WorkspaceProblemsRequest { readonly fileIds?: readonly string[]; }
/** F96/F97: o Workspace Service repassa manifests do Compiler Service ao desktop. */
export interface WorkspaceProfilesRequest {}
export type WorkspaceProfileManifestDto = PublicationProfileManifestDto;
/** F101: compilação seca de um profile sobre o draft vigente, sem alterar a sessão. */
export interface WorkspaceProfileValidationPreviewRequest {
  readonly fileId: string;
  readonly expectedRevision: number;
  readonly profileId: string;
}
export interface WorkspaceProfileValidationPreviewDto {
  readonly revision: number;
  readonly profileId: string;
  readonly errors: number;
  readonly warnings: number;
  /** Diferença contra os diagnósticos publicados na mesma revisão. */
  readonly errorDelta: number;
  readonly warningDelta: number;
}
/** Contribuições de plugins são DTOs declarativos; o renderer nunca executa código de plugin. */
export interface WorkspacePluginDto { readonly id: string; readonly version?: string; readonly apiVersion?: number; readonly capabilities: readonly string[]; readonly enabled: boolean; readonly commands: readonly { readonly id: string; readonly title: string }[]; readonly views: readonly { readonly id: string; readonly title: string; readonly body: string }[]; readonly exports: readonly { readonly id: string; readonly title: string; readonly extension: string; readonly mimeType: string }[]; readonly homeBlocks: readonly { readonly id: string; readonly title: string; readonly body: string }[]; readonly panels: readonly { readonly id: string; readonly title: string; readonly body: string }[]; readonly error?: string; }
export interface WorkspacePluginSetEnabledRequest { readonly id: string; readonly enabled: boolean; }
export interface WorkspacePluginCommandRequest { readonly pluginId: string; readonly commandId: string; readonly activeFileId?: string; readonly activeRevision?: number; }
export interface WorkspacePluginCommandResultDto { readonly kind: 'notice' | 'open-view' | 'open-intake' | 'open-template' | 'open-structured-research'; readonly message?: string; readonly viewId?: string; readonly intakeFormat?: 'bibtex' | 'ris' | 'csl-json'; readonly templateKind?: 'article' | 'institutional-article' | 'tcc' | 'institutional-tcc' | 'dissertation' | 'thesis' | 'abstract' | 'reading-note' | 'research-project'; }
export interface WorkspaceProblemDto {
  readonly fileId: string;
  readonly path: string;
  readonly revision: number;
  readonly severity: 'info' | 'warning' | 'error';
  readonly ruleId: string;
  readonly message: string;
  readonly range?: { readonly start: number; readonly end: number };
  readonly section?: string;
}

/** Mesma forma de `@abnt/workspace-index` `WorkspaceSearchResult`, com IDs como string. */
export interface WorkspaceSearchResultDto {
  readonly fileId: string;
  readonly path: string;
  readonly title: string;
  readonly snippet: string;
  readonly score: number;
  /** F73: projeção do heading indexado que contém o resultado, não Markdown parseado no renderer. */
  readonly section?: { readonly title: string; readonly range: { readonly start: number; readonly end: number } };
}

export interface WorkspaceBacklinksRequest {
  readonly fileId: string;
}

/** Um link indexado de outro documento que resolve para o arquivo consultado. */
export interface WorkspaceBacklinkDto {
  readonly fileId: string;
  readonly path: string;
  readonly label: string;
  readonly range: { readonly start: number; readonly end: number };
}

export interface WorkspaceReferencesRequest {
  readonly fileId: string;
}

/**
 * Projeção de produto sobre uma entrada de `BibliographyEnvironmentDto` —
 * já formatada (ABNT) e com a proveniência resolvida para exibição, ao
 * contrário do `entries`/`provenanceByReference` brutos usados internamente
 * pela compilação.
 */
export interface WorkspaceReferenceDto {
  readonly id: string;
  readonly type: string;
  readonly formatted: string;
  readonly sourceLabel: string;
  readonly sourceUri?: string;
  readonly sourceFileId?: string;
  /** Onda BP (F505): citações no escopo da chamada — documento-scoped em `references()`, 0 nas demais. */
  readonly citationCount: number;
  /** Onda BP (F506): rótulos já extraídos pelo motor (F8/bibliography) para o picker montar uma prévia aproximada sem recompilar. */
  readonly narrativeAuthor: string;
  readonly parentheticalAuthor: string;
  readonly year: string;
}

/**
 * Grafo derivado do índice (F5); vazio = vault sem links/citações/recursos
 * ainda. `includePeople` (F33) agrega bibliografia vault-wide para nós
 * person/organization — mais caro, por isso opt-in.
 */
export interface WorkspaceGraphRequest {
  readonly includePeople?: boolean;
  /** F56: tags são uma projeção opcional porque exigem varrer metadados do vault. */
  readonly includeTags?: boolean;
  /** F57: reduz o grafo ao entorno não direcionado do documento ativo. */
  readonly focusFileId?: string;
  readonly depth?: 1 | 2;
}

export type WorkspaceGraphNodeKind = 'document' | 'reference' | 'resource' | 'person' | 'organization' | 'tag';

export interface WorkspaceGraphNodeDto {
  readonly id: string;
  readonly kind: WorkspaceGraphNodeKind;
  readonly label: string;
  readonly fileId?: string;
  readonly path?: string;
  readonly referenceId?: string;
  readonly identityState?: 'resolved' | 'possible-match' | 'ambiguous';
  readonly resolved?: boolean;
}

/** As últimas cinco vêm da Onda BJ (`ReferenceRelationKindDto`): projeção de relação explícita entre referências no mesmo grafo. */
export type WorkspaceGraphEdgeKind = 'links-to' | 'cites' | 'embeds' | 'authored-by' | 'tagged-with' | ReferenceRelationKindDto;

export interface WorkspaceGraphEdgeDto {
  readonly kind: WorkspaceGraphEdgeKind;
  readonly from: string;
  readonly to: string;
  readonly sourceFileId?: string;
}

export interface WorkspaceGraphDto {
  readonly nodes: readonly WorkspaceGraphNodeDto[];
  readonly edges: readonly WorkspaceGraphEdgeDto[];
}

/** F63–F65: histórico é operacional; conteúdo autoral nunca vive no índice. */
export interface WorkspaceHistoryRequest { readonly fileId: string; }
export interface WorkspaceHistoryRevisionDto { readonly id: string; readonly source: 'git' | 'snapshot'; readonly label: string; readonly createdAt: number; }
export interface WorkspaceHistoryDto { readonly gitAvailable: boolean; readonly revisions: readonly WorkspaceHistoryRevisionDto[]; }
export interface WorkspaceHistorySnapshotRequest { readonly fileId: string; readonly label?: string; }
export interface WorkspaceHistoryReadRequest { readonly fileId: string; readonly revisionId: string; }
export interface WorkspaceHistoryDiffRequest { readonly fileId: string; readonly fromRevisionId: string; readonly toRevisionId?: string; }
export interface WorkspaceHistoryDiffLineDto { readonly kind: 'equal' | 'added' | 'removed'; readonly leftLine?: number; readonly rightLine?: number; readonly text: string; }
export interface WorkspaceHistoryDiffDto { readonly lines: readonly WorkspaceHistoryDiffLineDto[]; }
/**
 * F70: complementa `WorkspaceHistoryDiffDto` (linha) sem substituí-lo. `kind`
 * é `string` de propósito — o protocolo não importa o union de
 * `@abnt/structural-diff` (fronteira de contratos, não de implementação).
 */
export interface WorkspaceHistoryStructuralChangeDto { readonly kind: string; readonly description: string; }
export interface WorkspaceHistoryStructuralDiffDto { readonly changes: readonly WorkspaceHistoryStructuralChangeDto[]; }
/** F89: comparação entre dois documentos do vault, sem leitura de arquivo no renderer. */
export interface WorkspaceDocumentComparisonRequest { readonly leftFileId: string; readonly rightFileId: string; }
export interface WorkspaceDocumentComparisonDto { readonly text: WorkspaceHistoryDiffDto; readonly structural: WorkspaceHistoryStructuralDiffDto; }

export interface WorkspaceCitationExplorerRequest {}

/** Local de uma citação, com a seção que a contém quando o outline resolve uma. */
export interface CitationExplorerLocationDto {
  readonly fileId: string;
  readonly path: string;
  readonly sectionTitle?: string;
  /** Trecho contextual calculado no Workspace Service; nunca parseado no renderer. */
  readonly snippet?: string;
  readonly range: { readonly start: number; readonly end: number };
}

export interface CitationExplorerEntryDto {
  readonly referenceId: string;
  /** Ausente quando nenhum `.bib` do vault resolve esta referência. */
  readonly formatted?: string;
  readonly count: number;
  readonly locations: readonly CitationExplorerLocationDto[];
}

/** `uncited` reaproveita `WorkspaceReferenceDto` — mesma projeção que `references()` já produz. */
export interface WorkspaceCitationExplorerResponseDto {
  readonly cited: readonly CitationExplorerEntryDto[];
  readonly uncited: readonly WorkspaceReferenceDto[];
}

/** F45–F47: projeção de pesquisa, derivada de biblioteca, anexos, notas e índice. */
export interface WorkspaceResearchOverviewRequest {}

export interface WorkspaceLiteratureReviewDto {
  readonly topic?: string;
  readonly method?: string;
  readonly sample?: string;
  readonly result?: string;
}

export interface WorkspaceResearchReferenceDto {
  readonly referenceId: string;
  readonly title: string;
  readonly authors: readonly string[];
  readonly doi?: string;
  readonly citationCount: number;
  readonly pdf?: WorkspaceFileDto;
  readonly literatureNote?: WorkspaceFileDto;
  readonly review: WorkspaceLiteratureReviewDto;
}

export interface WorkspaceResearchOverviewDto {
  readonly references: readonly WorkspaceResearchReferenceDto[];
}

/** F105: métricas derivadas para o dashboard; Project permanece estado operacional. */
export interface WorkspaceProjectDashboardRequest { readonly fileIds: readonly string[]; }
export interface WorkspaceProjectDocumentDto {
  readonly fileId: string;
  readonly path: string;
  readonly revision: number;
  /** Hash da fonte autoral nesta revisão, nunca da composição virtual. */
  readonly contentHash: string;
  readonly words: number;
  readonly citations: number;
  readonly figures: number;
  readonly tables: number;
  readonly errors: number;
  readonly warnings: number;
  readonly unresolvedCrossReferences: number;
}
export interface WorkspaceProjectDashboardDto { readonly documents: readonly WorkspaceProjectDocumentDto[]; }

/**
 * F6: biblioteca gerenciada do vault (`references/library.json`, CSL-JSON).
 * `entry.id` é a chave de citação; `libraryUpsert` cria ou substitui pela
 * mesma chave.
 */
export interface WorkspaceLibraryListRequest {}

export interface WorkspaceLibraryUpsertRequest {
  readonly entry: BibliographicEntityDto;
}

export interface WorkspaceLibraryRemoveRequest {
  readonly id: string;
}

/** Formatação transitória para o preview do editor de referências (F7). */
export interface WorkspaceLibraryFormatRequest {
  readonly entry: BibliographicEntityDto;
}

/** F8: resolve DOI para CSL-JSON normalizado; persistência é uma ação separada. */
export interface WorkspaceLibraryResolveDoiRequest {
  readonly doi: string;
}

/** Onda BQ: candidato resolvido ainda passa pela inbox; nunca persiste sozinho. */
export type ScholarlyIdentifierTypeDto = 'doi' | 'isbn' | 'pmid' | 'arxiv' | 'ads';
export interface ScholarlyIdentifierDto { readonly type: ScholarlyIdentifierTypeDto; readonly value: string; }
export interface ScholarlyIdentifierProvenanceDto { readonly field: string; readonly provider: string; readonly retrievedAt: string; readonly confidence?: number; }
export interface WorkspaceScholarlyIdentifierReviewRequest { readonly input: string; }
/** BF: cada entrada do lote recebe revisão independente; uma falha não cancela as demais. */
export interface WorkspaceScholarlyIdentifierBatchReviewRequest { readonly input: string; }
export interface WorkspaceScholarlyIdentifierReviewDto {
  readonly input: string;
  readonly identifier?: ScholarlyIdentifierDto;
  readonly entry?: BibliographicEntityDto;
  readonly provenance: readonly ScholarlyIdentifierProvenanceDto[];
  readonly duplicates: readonly WorkspaceLibraryDuplicateDto[];
  readonly error?: string;
}
/** Texto ou bytes de PDF extraídos localmente pelo host; não há OCR nem upload implícito. */
export interface WorkspacePdfReconciliationRequest { readonly text?: string; readonly base64?: string; }
export interface WorkspacePdfReconciliationDto { readonly identifiers: readonly ScholarlyIdentifierDto[]; readonly reviews: readonly WorkspaceScholarlyIdentifierReviewDto[]; }

export interface FullTextCandidateDto { readonly provider: string; readonly url: string; readonly license: 'open-access' | 'restricted' | 'unknown'; readonly version?: 'submitted' | 'accepted' | 'published'; readonly confidence: number; readonly retrievedAt: string; }
export interface WorkspaceFullTextDiscoveryRequest { readonly referenceId: string; }
export interface WorkspaceFullTextDiscoveryDto { readonly candidates: readonly FullTextCandidateDto[]; readonly failures: readonly { readonly provider: string; readonly message: string }[]; }
export interface WorkspaceDownloadFullTextRequest { readonly referenceId: string; readonly url: string; readonly displayTitle?: string; }

/** Onda BS: estado operacional de revisão; Markdown e CSL-JSON continuam canônicos fora deste recurso. */
export interface WorkspaceSystematicReviewDto { readonly version: 1; readonly protocol?: { readonly id: string; readonly title: string; readonly question: string; readonly framework: 'freeform' | 'pico' | 'picos' | 'spider'; readonly frameworkFields: Readonly<Record<string, string>>; readonly databases: readonly string[]; readonly searchStrategy: string; readonly inclusionCriteria: readonly string[]; readonly exclusionCriteria: readonly string[]; }; readonly searches?: readonly { readonly id: string; readonly database: string; readonly query: string; readonly searchedAt: string; readonly resultCount: number }[]; readonly exclusionReasons?: readonly { readonly id: string; readonly label: string }[]; readonly studies: readonly { readonly id: string; readonly referenceId?: string; readonly title: string; readonly stage: string; readonly decisions: readonly { readonly reviewerId: string; readonly decision: 'include' | 'exclude' | 'maybe'; readonly at: string; readonly reasonId?: string }[]; readonly exclusionReasonId?: string }[]; readonly extractions?: Readonly<Record<string, Readonly<Record<string, string>>>>; readonly quality?: Readonly<Record<string, readonly { readonly itemId: string; readonly value: 'yes' | 'no' | 'unclear' | 'na' }[]>>; readonly evidence?: readonly { readonly studyId: string; readonly fieldId: string; readonly target: string }[]; }
export interface WorkspaceSetSystematicReviewRequest { readonly review: WorkspaceSystematicReviewDto; }
/** BX.2: inbox de busca é operacional e só vira CSL-JSON após confirmação na Biblioteca. */
export interface WorkspaceEvidenceSynthesisDto {
  readonly version: 1;
  readonly migratedFrom?: 'systematic-review-v1';
  readonly protocol?: { readonly id: string; readonly title: string; readonly question: string };
  readonly sources: readonly { readonly id: string; readonly label: string; readonly kind: string }[];
  readonly strategies: readonly { readonly id: string; readonly sourceId: string; readonly label: string; readonly conceptualQuery: string; readonly compiledQuery: string }[];
  readonly runs: readonly { readonly id: string; readonly strategyId: string; readonly executedAt: string; readonly resultCount: number; readonly importedCount: number; readonly query: string; readonly page?: number; readonly filters?: readonly string[]; readonly artifactHash?: string }[];
  readonly inbox: readonly { readonly id: string; readonly runId?: string; readonly title: string; readonly authors?: readonly string[]; readonly year?: string; readonly identifiers: readonly string[]; readonly importedAt: string; readonly format: 'ris' | 'bibtex' | 'csl-json' | 'csv' | 'manual'; readonly rawHash: string }[];
  readonly records: readonly { readonly id: string; readonly title: string; readonly sourceId?: string; readonly searchRunId?: string; readonly referenceId?: string; readonly workId: string; readonly identifiers: readonly string[] }[];
  readonly works: readonly { readonly id: string; readonly title: string; readonly referenceId?: string; readonly recordIds: readonly string[]; readonly artifactIds: readonly string[]; readonly fullText: 'not-requested' | 'searching' | 'candidate-found' | 'available' | 'unavailable' | 'restricted' | 'manual-needed' }[];
  readonly artifacts: readonly { readonly id: string; readonly workId: string; readonly attachmentId?: string; readonly kind: string }[];
  readonly evidenceItems: readonly { readonly id: string; readonly workId: string; readonly label: string; readonly kind: string }[];
  readonly stages: readonly { readonly id: string; readonly label: string; readonly decisions: readonly ('include' | 'exclude' | 'maybe')[]; readonly reviewersRequired: number; readonly blind: boolean; readonly exclusionReasonRequired: boolean }[];
  readonly criteria: readonly { readonly id: string; readonly label: string; readonly description?: string; readonly stageId: string; readonly polarity: 'include' | 'exclude'; readonly required: boolean }[];
  readonly decisions: readonly { readonly evidenceItemId: string; readonly stageId: string; readonly reviewerId: string; readonly decision: 'include' | 'exclude' | 'maybe'; readonly at: string; readonly reasonId?: string }[];
  readonly extractions: readonly { readonly id: string; readonly evidenceItemId: string; readonly fieldId: string; readonly value: string | number | boolean | Readonly<Record<string, unknown>>; readonly artifactId?: string; readonly page?: number; readonly annotationId?: string; readonly reviewerId: string; readonly verifiedAt: string }[];
  readonly claimRelations?: readonly { readonly id: string; readonly claimId: string; readonly evidenceItemId: string; readonly relation: 'supports' | 'contradicts'; readonly note?: string; readonly reviewerId: string; readonly createdAt: string }[];
}
export interface WorkspaceSetEvidenceSynthesisRequest { readonly synthesis: WorkspaceEvidenceSynthesisDto; }
export interface WorkspaceResearchDatasetsDto { readonly version: 1; readonly datasets: readonly { readonly id: string; readonly path: string; readonly format: string; readonly metadata: { readonly title: string; readonly description?: string; readonly creator?: string; readonly license?: string; readonly source?: string; readonly collectedAt?: string; readonly version?: string }; readonly sha256: string; readonly previousVersionId?: string }[]; }
export interface WorkspaceSetResearchDatasetsRequest { readonly datasets: WorkspaceResearchDatasetsDto; }
export interface WorkspaceImportResearchDatasetRequest { readonly name: string; readonly base64: string; readonly metadata: { readonly title: string; readonly description?: string; readonly creator?: string; readonly license?: string; readonly source?: string; readonly collectedAt?: string; readonly version?: string }; readonly previousVersionId?: string; }
export interface WorkspaceResearchDatasetPreviewRequest { readonly datasetId: string; }
export interface WorkspaceResearchDatasetPreviewDto { readonly datasetId: string; readonly preview?: { readonly columns: readonly string[]; readonly rows: readonly (readonly string[])[]; readonly totalRows?: number }; readonly schema: readonly { readonly name: string; readonly type: 'string' | 'number' | 'boolean' | 'date' | 'unknown'; readonly missing: number; readonly distinct: number }[]; }

/** Onda BN: campos parciais, sem `id` — o candidato ainda não é uma referência. */
export type WebCaptureFieldsDto = Partial<Omit<BibliographicEntityDto, 'id'>>;

export interface WebCaptureAttachmentCandidateDto {
  readonly kind: 'link';
  readonly role: 'snapshot' | 'supplementary' | 'dataset';
  readonly url: string;
  readonly label?: string;
}

export interface WebCaptureCandidateDto {
  readonly extractorId: string;
  readonly fields: WebCaptureFieldsDto;
  readonly attachments: readonly WebCaptureAttachmentCandidateDto[];
  readonly quality: number;
}

/** F485–F495: extrai metadados de uma página já publicada; nunca persiste nada sozinho. */
export interface WorkspaceWebCaptureExtractRequest {
  readonly url: string;
  /** HTML já carregado no webview; ausente mantém o provider HTTP do host. */
  readonly html?: string;
}

export interface WorkspaceWebCaptureExtractResponseDto {
  readonly candidates: readonly WebCaptureCandidateDto[];
}

export interface WorkspaceLibraryImportRequest {
  readonly format: 'bibtex' | 'ris' | 'csl-json';
  readonly content: string;
}

export interface WorkspaceLibraryImportResponseDto {
  readonly imported: readonly BibliographicEntityDto[];
  readonly diagnostics: readonly DiagnosticDto[];
}

/** F124/F128: parse e comparação antes de promover qualquer dado à biblioteca. */
export interface WorkspaceLibraryIntakePreviewRequest {
  readonly format?: 'bibtex' | 'ris' | 'csl-json';
  readonly content?: string;
  readonly entry?: BibliographicEntityDto;
}
export interface WorkspaceLibraryIntakePreviewDto {
  readonly imported: readonly BibliographicEntityDto[];
  readonly diagnostics: readonly DiagnosticDto[];
  readonly duplicates: Readonly<Record<string, readonly WorkspaceLibraryDuplicateDto[]>>;
}

export type WorkspaceReferenceDuplicateReason = 'doi' | 'isbn' | 'title' | 'author-year';
export interface WorkspaceLibraryDuplicateDto {
  readonly leftId: string;
  readonly rightId: string;
  readonly score: number;
  readonly reasons: readonly WorkspaceReferenceDuplicateReason[];
}
export interface WorkspaceLibraryDuplicatesRequest {}

export interface WorkspaceLibraryMergeRequest {
  readonly canonicalId: string;
  readonly duplicateId: string;
  /** Resultado revisado pelo usuário; o host nunca escolhe campos sozinho. */
  readonly entry: BibliographicEntityDto;
}
export interface WorkspaceLibraryMergeResponseDto {
  readonly entry: BibliographicEntityDto;
  readonly changedFiles: readonly string[];
}

export type WorkspaceReferenceKeyPolicy = 'author-year' | 'title-year';
export interface WorkspaceLibraryKeyPreviewRequest { readonly id: string; readonly policy: WorkspaceReferenceKeyPolicy; }
export interface WorkspaceLibraryKeyPreviewDto { readonly id: string; readonly suggestion: string; readonly policy: WorkspaceReferenceKeyPolicy; }
export interface WorkspaceLibraryRenameKeyRequest { readonly id: string; readonly nextId: string; }
export interface WorkspaceLibraryRenameKeyResponseDto { readonly entry: BibliographicEntityDto; readonly changedFiles: readonly string[]; }

export interface WorkspaceReferenceHealthRequest {}
export type ReferenceIntegrityStatusDto = 'normal' | 'retracted' | 'corrected' | 'expression-of-concern' | 'unknown';
export interface ReferenceIntegrityRecordDto {
  readonly referenceId: string;
  readonly status: ReferenceIntegrityStatusDto;
  readonly provider: string;
  readonly evidence: string;
  readonly checkedAt: string;
}
export interface WorkspaceReferenceIntegrityDto { readonly version: 1; readonly records: readonly ReferenceIntegrityRecordDto[]; }
export interface WorkspaceSetReferenceIntegrityRequest extends WorkspaceReferenceIntegrityDto {}
export type WorkspaceReferenceAuditCode =
  | 'invalid-doi' | 'invalid-isbn' | 'missing-url' | 'missing-access-date'
  | 'incomplete-author' | 'missing-year' | 'possible-duplicate'
  | 'inconsistent-key' | 'missing-pdf' | 'missing-literature-note'
  | 'reference-retracted' | 'reference-corrected' | 'reference-expression-of-concern' | 'reference-integrity-unknown';
export interface WorkspaceReferenceAuditIssueDto {
  readonly referenceId: string;
  readonly code: WorkspaceReferenceAuditCode;
  readonly message: string;
}
export interface WorkspaceReferenceHealthDto {
  readonly total: number;
  readonly cited: number;
  readonly unused: number;
  readonly missing: readonly string[];
  readonly withoutDoi: number;
  /** F81: qualidade bibliográfica, distinta de diagnostics normativos do documento. */
  readonly audit: readonly WorkspaceReferenceAuditIssueDto[];
}

/** Onda BO: agregação read-only de sinais já existentes (saúde, duplicatas, anexos, relações) — nenhum algoritmo novo. */
export interface WorkspaceLibraryMaintenanceRequest {}
export interface WorkspaceLibraryMaintenanceRowDto {
  readonly referenceId: string;
  readonly title: string;
  readonly cited: boolean;
  readonly citationCount: number;
  readonly withoutDoi: boolean;
  readonly auditCodes: readonly WorkspaceReferenceAuditCode[];
  readonly duplicateOf: readonly string[];
  readonly attachmentCount: number;
  readonly attachmentIssueCodes: readonly AttachmentHealthCodeDto[];
  readonly relationCount: number;
}
export interface WorkspaceLibraryMaintenanceTotalsDto {
  readonly total: number;
  readonly cited: number;
  readonly unused: number;
  readonly missing: readonly string[];
  readonly withoutDoi: number;
  readonly duplicatePairs: number;
  readonly attachmentIssues: number;
}
export interface WorkspaceLibraryMaintenanceOverviewDto {
  readonly rows: readonly WorkspaceLibraryMaintenanceRowDto[];
  readonly totals: WorkspaceLibraryMaintenanceTotalsDto;
}

/** F35: PDF local ligado a uma entrada CSL sem contaminar `library.json`. */
export interface WorkspaceReferenceAttachmentDto {
  readonly referenceId: string;
  readonly file: WorkspaceFileDto;
  readonly mediaType: 'application/pdf';
}
export interface WorkspaceReferenceAttachmentsRequest {}
export interface WorkspaceAttachReferencePdfRequest { readonly referenceId: string; readonly name: string; readonly base64: string; }
export interface WorkspaceReferenceAttachmentRequest { readonly referenceId: string; }

/** F36: bytes só chegam ao renderer pelo contrato validado; paths continuam no host confiável. */
export interface WorkspaceReferencePdfDto {
  readonly attachment: WorkspaceReferenceAttachmentDto;
  readonly base64: string;
}

/** Uma annotation pertence ao PDF local, nunca à entrada CSL-JSON canônica. */
export interface WorkspacePdfAnnotationDto {
  readonly id: string;
  readonly referenceId: string;
  readonly pdfDocumentId?: string;
  readonly fileId?: string;
  readonly page: number;
  readonly quote: string;
  readonly kind?: 'highlight' | 'underline' | 'strikeout' | 'comment' | 'area' | 'ink';
  readonly anchor?: { readonly quote: string; readonly start?: number; readonly end?: number; };
  readonly rects?: readonly { readonly x: number; readonly y: number; readonly width: number; readonly height: number; }[];
  /** Identidade da annotation no PDF de origem; evita importar o mesmo item duas vezes. */
  readonly externalId?: string;
  readonly comment?: string;
  /** Onda BL: significado da cor é configurável (`WorkspaceAnnotationColorSemanticsDto`), nunca fixo no produto. */
  readonly color?: string;
  readonly semanticType?: 'population' | 'intervention' | 'method' | 'outcome' | 'finding' | 'limitation' | 'risk' | 'quote' | 'context';
  readonly createdAt: string;
  readonly modifiedAt?: string;
  readonly literatureNoteFileId?: string;
}
export interface WorkspaceCreatePdfAnnotationRequest {
  /** Referência é opcional: PDFs soltos também recebem anotações no sidecar. */
  readonly referenceId?: string;
  readonly fileId?: string;
  readonly page: number;
  readonly quote: string;
  readonly kind?: 'highlight' | 'underline' | 'strikeout' | 'comment' | 'area' | 'ink';
  readonly anchor?: { readonly quote: string; readonly start?: number; readonly end?: number; };
  readonly rects?: readonly { readonly x: number; readonly y: number; readonly width: number; readonly height: number; }[];
  readonly externalId?: string;
  readonly comment?: string;
  readonly color?: string;
  readonly semanticType?: 'population' | 'intervention' | 'method' | 'outcome' | 'finding' | 'limitation' | 'risk' | 'quote' | 'context';
}
export interface WorkspacePdfAnnotationRequest { readonly referenceId?: string; readonly fileId?: string; readonly id: string; }
export interface WorkspacePdfAnnotationLinkDto {
  readonly annotation: WorkspacePdfAnnotationDto;
  readonly literatureNote: WorkspaceFileDto;
}

/** Onda BL (F468–F475): síntese de anotações de uma ou várias fontes, inserida por EditorTransaction. */
export interface WorkspaceAnnotationsRequest { readonly referenceId?: string; readonly fileId?: string; }
export type WorkspaceAnnotationColorSemanticsDto = Readonly<Record<string, string>>;
export interface WorkspaceSetAnnotationColorSemanticsRequest { readonly colors: WorkspaceAnnotationColorSemanticsDto; }
export type AnnotationSynthesisTemplateDto = 'quote-list' | 'grouped-by-source' | 'grouped-by-color';
export type WorkspaceSynthesisTargetDto =
  | { readonly kind: 'reference'; readonly referenceId: string }
  | { readonly kind: 'file'; readonly fileId: string };
export interface WorkspaceSynthesizeAnnotationsRequest {
  readonly annotationIds: readonly string[];
  readonly template: AnnotationSynthesisTemplateDto;
  readonly target: WorkspaceSynthesisTargetDto;
}
export interface WorkspaceSynthesizeAnnotationsResponseDto {
  readonly file: WorkspaceFileDto;
  readonly insertedIds: readonly string[];
  readonly skippedIds: readonly string[];
}

/**
 * Onda BH (F436–F446): múltiplos anexos por referência, além do PDF único
 * de F35 (`WorkspaceReferenceAttachmentDto`, preservado para compatibilidade
 * — o papel `primary` é o mesmo dado, só que agora dentro do manifesto v2).
 */
export type AttachmentRoleDto = 'primary' | 'supplementary' | 'dataset' | 'snapshot';
export type AttachmentKindDto = 'file' | 'link';
export interface AttachmentVersionDto {
  readonly versionId: string;
  readonly createdAt: string;
  readonly path?: string;
  readonly uri?: string;
  readonly snapshotText?: string;
  readonly note?: string;
  /** Só presente quando o arquivo da versão ainda existe no vault. */
  readonly file?: WorkspaceFileDto;
}
export interface AttachmentDto {
  readonly id: string;
  readonly referenceId: string;
  readonly kind: AttachmentKindDto;
  readonly role: AttachmentRoleDto;
  readonly mediaType: string;
  readonly displayTitle?: string;
  /** Sugestão determinística (sobrenome-ano-título); aplicar exige `renameAttachmentFile` explícito. */
  readonly suggestedFilename?: string;
  readonly versions: readonly AttachmentVersionDto[];
}
export interface WorkspaceAttachmentsRequest { readonly referenceId?: string; }
export interface WorkspaceAddAttachmentRequest {
  readonly referenceId: string;
  readonly role: AttachmentRoleDto;
  readonly kind: AttachmentKindDto;
  readonly mediaType: string;
  readonly displayTitle?: string;
  /** kind === 'file' */
  readonly name?: string;
  readonly base64?: string;
  /** Reutiliza um arquivo já presente no vault, sem cópia nem escrita no PDF. */
  readonly existingFileId?: string;
  /** kind === 'link' */
  readonly uri?: string;
  readonly snapshotHtml?: string;
}
export interface WorkspaceAddAttachmentVersionRequest {
  readonly attachmentId: string;
  readonly name?: string;
  readonly base64?: string;
  readonly uri?: string;
  readonly snapshotHtml?: string;
  readonly note?: string;
}
export interface WorkspaceAttachmentRequest { readonly attachmentId: string; }
/** Só o gatilho do diálogo nativo em Main; Main preenche kind/mediaType/name/base64 antes de chamar `addAttachment`. */
export interface WorkspacePickAttachmentRequest { readonly referenceId: string; readonly role: AttachmentRoleDto; readonly displayTitle?: string; }
export interface WorkspaceRenameAttachmentFileRequest { readonly attachmentId: string; readonly filename: string; }
export interface WorkspaceAttachmentHealthRequest {}
export type AttachmentHealthCodeDto = 'missing-file' | 'broken-link' | 'orphan-reference';
export interface AttachmentHealthIssueDto {
  readonly attachmentId: string;
  readonly referenceId: string;
  readonly code: AttachmentHealthCodeDto;
  readonly message: string;
}

/** F13–F15: recurso copiado para o vault; `authoredUri` é relativo ao documento. */
export interface WorkspaceAssetDto {
  readonly file: WorkspaceFileDto;
  readonly authoredUri: string;
}

/** Transporte interno Main → Workspace; bytes chegam como base64, nunca como path externo. */
export interface WorkspaceImportAssetRequest {
  readonly sourceFileId: string;
  readonly name: string;
  readonly mediaType: string;
  readonly base64: string;
  readonly directory?: string;
}

/** Cria conteúdo inicial normal do vault; template não vira tipo de documento. */
export interface WorkspaceCreateDocumentRequest {
  readonly path: string;
  readonly content: string;
}

/**
 * F34: cria (ou reabre, se já existir) a literature note de uma referência.
 * `activeFileId` é o documento cuja bibliografia resolvida contém `referenceId`
 * — nunca uma resolução de bibliografia vault-wide nova só para isso.
 */
export interface WorkspaceCreateLiteratureNoteRequest {
  readonly referenceId: string;
  /** Opcional no leitor PDF: o catálogo canônico do vault resolve o título. */
  readonly activeFileId?: string;
}

/** F331–F335: diário de pesquisa — arquivo Markdown comum, criado sob demanda por data (padrão: hoje). */
export interface WorkspaceJournalOpenRequest { readonly date?: string; }
export interface WorkspaceJournalCaptureRequest { readonly date?: string; readonly text: string; }

/** Pedido do renderer; o Main abre o seletor nativo e não revela o path escolhido. */
export interface EditorImportAssetRequest {
  readonly fileId: string;
  readonly directory?: string;
}

export type WorkspaceEvent =
  | { readonly type: 'workspace:file-created'; readonly file: WorkspaceFileDto }
  | { readonly type: 'workspace:file-changed'; readonly file: WorkspaceFileDto }
  | { readonly type: 'workspace:file-renamed'; readonly file: WorkspaceFileDto; readonly previousPath: string }
  | { readonly type: 'workspace:file-removed'; readonly fileId: string; readonly path: string };

/** Superfície mínima; a semântica de storage e eventos será implementada na P2. */
export interface WorkspaceService {
  read(request: WorkspaceReadRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceReadResponse>>;
  assetPreview(request: WorkspaceAssetPreviewRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceAssetPreviewResponse>>;
  write(request: WorkspaceWriteRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceFileDto>>;
  rename(request: WorkspaceRenameRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceFileDto>>;
  list(request: WorkspaceListRequest, signal?: AbortSignal): Promise<ProtocolResult<readonly WorkspaceFileDto[]>>;
}

// ---------------------------------------------------------------------------
// DTOs de produto: workspace e editor remoto
// ---------------------------------------------------------------------------

/** Caminho absoluto só é aceito pelo host confiável (main/testes), nunca pela UI. */
export interface WorkspaceOpenRequest {
  readonly rootPath: string;
}

export interface WorkspaceConfigurationDto {
  readonly defaultProfileId?: string;
  readonly ignoredPaths: readonly string[];
}

export interface WorkspaceOpenResponse {
  readonly workspaceId: string;
  readonly configuration: WorkspaceConfigurationDto;
  readonly files: readonly WorkspaceFileDto[];
}

/** Configuração interna Main → Workspace: a UI nunca recebe este caminho. */
export interface WorkspaceConfigureSyncRequest {
  readonly mirrorRootPath: string;
}

export interface WorkspaceSyncConflictDto {
  readonly id: string;
  readonly key: string;
  readonly kind: 'text' | 'binary' | 'workspace-state';
  readonly createdAt: string;
}

/** Projeção segura da sync: deliberadamente não expõe paths do dispositivo. */
export interface WorkspaceSyncStatusDto {
  readonly configured: boolean;
  readonly provider?: { readonly id: string; readonly label: string };
  readonly status: 'synced' | 'pending' | 'conflict' | 'offline' | 'error';
  readonly pending: number;
  readonly conflicts: readonly WorkspaceSyncConflictDto[];
}

export interface WorkspaceResolveSyncConflictRequest {
  readonly conflictId: string;
  readonly resolution: 'keep-local' | 'use-mirror';
}

/** Estado operacional compartilhado; não contém conteúdo nem caminhos do vault. */
export interface WorkspaceCollaboratorDto { readonly id: string; readonly name: string; readonly role: 'owner' | 'editor' | 'reviewer' | 'viewer'; }
export interface WorkspaceReviewReplyDto { readonly id: string; readonly message: string; readonly authorId?: string; readonly createdAt: number; }
export interface WorkspaceReviewCommentDto { readonly id: string; readonly fileId: string; readonly path: string; readonly revision: number; readonly range: { readonly start: number; readonly end: number }; readonly message: string; readonly authorId?: string; readonly createdAt: number; readonly resolvedAt?: number; readonly replies?: readonly WorkspaceReviewReplyDto[]; }
export interface WorkspaceCollaborationMilestoneDto { readonly id: string; readonly title: string; readonly dueDate?: string; readonly completedAt?: string | undefined; }
export interface WorkspaceReviewAssignmentDto { readonly id: string; readonly target: { readonly kind: 'document' | 'reference' | 'screening-item'; readonly id: string }; readonly reviewerIds: readonly string[]; }
export interface WorkspaceScreeningDecisionDto { readonly reviewerId: string; readonly itemId: string; readonly decision: 'include' | 'exclude' | 'maybe'; readonly at: string; }
export interface WorkspacePresenceDto { readonly collaboratorId: string; readonly location: string; readonly observedAt: string; }
export interface WorkspaceCollaborationMentionDto { readonly id: string; readonly authorId: string; readonly collaboratorId: string; readonly context: string; readonly createdAt: string; }
export interface WorkspaceCollaborationDto { readonly projectId: string; readonly title: string; readonly collaborators: readonly WorkspaceCollaboratorDto[]; readonly comments?: readonly WorkspaceReviewCommentDto[]; readonly milestones?: readonly WorkspaceCollaborationMilestoneDto[]; readonly assignments?: readonly WorkspaceReviewAssignmentDto[]; readonly screening?: { readonly phase: 'independent' | 'reconciliation'; readonly decisions: readonly WorkspaceScreeningDecisionDto[]; }; readonly presence?: readonly WorkspacePresenceDto[]; readonly mentions?: readonly WorkspaceCollaborationMentionDto[]; readonly concurrentEditing?: 'undecided'; }
export interface WorkspaceSetCollaborationRequest extends WorkspaceCollaborationDto {}

/** F243/F251: configuração portátil; as linhas são sempre uma projeção do host. */
export type WorkspaceAcademicViewSourceDto = 'documents' | 'references' | 'literature-notes' | 'projects' | 'datasets' | 'review-studies' | 'annotations';
export type WorkspaceAcademicViewLayoutDto = 'table' | 'list' | 'cards' | 'board' | 'calendar' | 'timeline' | 'chart';
/** F301–F306: relações só cobrem vínculos já conhecidos pelo domínio — ver ADR 0070. */
export type WorkspaceAcademicRelationKindDto = 'cites' | 'annotates' | 'belongs-to-project' | 'uses-dataset' | 'evidence-for';
export interface WorkspaceAcademicRelationEndpointDto { readonly kind: string; readonly id: string; }
export interface WorkspaceAcademicRelationDto { readonly from: WorkspaceAcademicRelationEndpointDto; readonly to: WorkspaceAcademicRelationEndpointDto; readonly kind: WorkspaceAcademicRelationKindDto; }
export interface WorkspaceAcademicRelationsDto { readonly relations: readonly WorkspaceAcademicRelationDto[]; }

/** Onda BJ (F454–F459): relação explícita entre DUAS referências bibliográficas — nunca equivale a duplicata. */
export type ReferenceRelationKindDto = 'version-of' | 'extension-of' | 'replica-of' | 'revision-of' | 'correction-of';
export interface ReferenceRelationDto {
  readonly id: string;
  readonly kind: ReferenceRelationKindDto;
  readonly fromId: string;
  readonly toId: string;
  readonly note?: string;
  readonly createdAt: string;
}
export interface WorkspaceReferenceRelationsRequest { readonly referenceId?: string; }
export interface WorkspaceReferenceRelationsDto { readonly relations: readonly ReferenceRelationDto[]; }
export interface WorkspaceAddReferenceRelationRequest {
  readonly kind: ReferenceRelationKindDto;
  readonly fromId: string;
  readonly toId: string;
  readonly note?: string;
}
export interface WorkspaceRemoveReferenceRelationRequest { readonly id: string; }

/** Onda BM (F476–F484): feed nunca entra automaticamente na biblioteca — tudo passa pelo inbox revisável. */
export interface LiteratureSubscriptionDto {
  readonly id: string;
  readonly url: string;
  readonly title: string;
  readonly projectId?: string;
  readonly keywords?: readonly string[];
}
export interface WorkspaceLiteratureSubscriptionsDto { readonly subscriptions: readonly LiteratureSubscriptionDto[]; }
export interface WorkspaceAddLiteratureSubscriptionRequest {
  readonly url: string;
  readonly title: string;
  readonly projectId?: string;
  readonly keywords?: readonly string[];
}
export interface WorkspaceRemoveLiteratureSubscriptionRequest { readonly id: string; }
export interface LiteratureFeedInboxItemDto {
  readonly id: string;
  readonly subscriptionId: string;
  readonly title: string;
  readonly link: string;
  readonly publishedAt?: string;
  readonly summary?: string;
  readonly discoveredAt: string;
}
export interface WorkspaceLiteratureFeedInboxDto { readonly items: readonly LiteratureFeedInboxItemDto[]; }
export interface WorkspacePollLiteratureSubscriptionRequest { readonly id: string; }
export interface WorkspacePollLiteratureSubscriptionResponseDto { readonly added: number; }
export interface WorkspaceDismissFeedInboxItemRequest { readonly id: string; }
export interface WorkspaceImportFeedInboxItemRequest { readonly id: string; }

export type WorkspaceAcademicDerivedColumnDto =
  | { readonly kind: 'rollup'; readonly relationKind: WorkspaceAcademicRelationKindDto; readonly operation: 'count' | 'unique-count' }
  | { readonly kind: 'formula'; readonly expression: string; readonly inputs: Readonly<Record<string, string>> }
  | { readonly kind: 'relation'; readonly targetKind?: string };
export interface WorkspaceDashboardBlockDto { readonly id: string; readonly viewId: string; readonly title: string; readonly kind: 'metric' | 'chart' | 'table'; }
export interface WorkspaceAcademicViewColumnDto { readonly field: string; readonly label?: string; readonly width?: number; readonly visible?: boolean; readonly derived?: WorkspaceAcademicDerivedColumnDto; }
export interface WorkspaceAcademicViewSortDto { readonly field: string; readonly direction: 'ascending' | 'descending'; }
export interface WorkspaceAcademicViewDto {
  readonly version: 1; readonly id: string; readonly name: string; readonly source: WorkspaceAcademicViewSourceDto; readonly layout: WorkspaceAcademicViewLayoutDto;
  readonly filterQuery?: string; readonly sort?: readonly WorkspaceAcademicViewSortDto[];
  readonly group?: { readonly field: string; readonly direction?: 'ascending' | 'descending' };
  readonly columns?: readonly WorkspaceAcademicViewColumnDto[];
}
export interface WorkspaceAcademicViewsDto { readonly version: 1; readonly views: readonly WorkspaceAcademicViewDto[]; readonly dashboards?: readonly WorkspaceDashboardBlockDto[]; }
export interface WorkspaceSetAcademicViewsRequest extends WorkspaceAcademicViewsDto {}

/** Onda BW: páginas continuam Markdown; este DTO é apenas sua projeção segura. */
export interface WorkspacePagePropertiesDto {
  readonly id?: string; readonly type?: 'document' | 'note' | 'project' | 'dataset' | 'evidence'; readonly status?: string;
  readonly tags: readonly string[]; readonly aliases: readonly string[]; readonly due?: string; readonly project?: string;
  readonly relations: readonly { readonly targetId: string; readonly kind: string }[];
}
export interface WorkspacePageTaskDto { readonly text: string; readonly completed: boolean; readonly line: number; readonly offset: number; readonly due?: string; readonly status?: string; readonly project?: string; }
export interface WorkspacePageDto { readonly file: WorkspaceFileDto; readonly title: string; readonly properties: WorkspacePagePropertiesDto; readonly tasks: readonly WorkspacePageTaskDto[]; readonly diagnostics: readonly { readonly field: string; readonly message: string }[]; }
export interface WorkspacePagesDto { readonly pages: readonly WorkspacePageDto[]; }
export interface WorkspaceEnablePageRequest { readonly fileId: string; readonly expectedRevision: number; readonly id: string; }
export interface WorkspaceSetPagePropertiesRequest { readonly fileId: string; readonly expectedRevision: number; readonly properties: WorkspacePagePropertiesDto; }
export interface WorkspaceTogglePageTaskRequest { readonly fileId: string; readonly expectedRevision: number; readonly offset: number; readonly completed: boolean; }
export type WorkspaceHomeBlockKindDto = 'recent' | 'favorites' | 'documents' | 'tasks' | 'projects' | 'bases' | 'captures' | 'calendar' | 'graph' | 'shortcuts';
export interface WorkspaceHomeBlockDto { readonly id: string; readonly kind: WorkspaceHomeBlockKindDto; readonly title: string; readonly span: 1 | 2 | 3; readonly enabled: boolean; }
export interface WorkspaceHomeLayoutDto { readonly version: 1; readonly blocks: readonly WorkspaceHomeBlockDto[]; readonly panels: { readonly explorerWidth: number; readonly contextWidth: number; }; }
export interface WorkspaceSetHomeLayoutRequest extends WorkspaceHomeLayoutDto {}
export interface WorkspaceThemeDto { readonly version: 1; readonly id: string; readonly name: string; readonly mode: 'light' | 'dark'; readonly tokens: Readonly<Record<string, string>>; }
export interface WorkspaceThemesDto { readonly version: 1; readonly activeId: string; readonly themes: readonly WorkspaceThemeDto[]; }
export interface WorkspaceSetThemesRequest extends WorkspaceThemesDto {}
/** Projetos são estado operacional portátil; o conteúdo dos documentos permanece no vault. */
export interface WorkspaceResearchProjectsDto { readonly version: 1; readonly projects: readonly Readonly<Record<string, unknown>>[]; }
export interface WorkspaceSetResearchProjectsRequest extends WorkspaceResearchProjectsDto {}
export type WorkspaceReadingStateDto = 'to-read' | 'reading' | 'read' | 'reviewed';
export interface WorkspaceReadingQueueEntryDto { readonly state: WorkspaceReadingStateDto; readonly updatedAt: string; }
export interface WorkspaceReadingQueueDto { readonly version: 1; readonly entries: Readonly<Record<string, WorkspaceReadingQueueEntryDto>>; }
export interface WorkspaceSetReadingQueueRequest extends WorkspaceReadingQueueDto {}
/** Migração explícita: dados legados só entram no vault após ação do usuário. */
export interface WorkspaceImportLegacyResearchProjectsRequest { readonly projects: readonly Readonly<Record<string, unknown>>[]; }
export interface WorkspaceImportLegacyResearchProjectsResponse { readonly imported: number; readonly skipped: number; }
export interface WorkspaceImportLegacyReadingQueueRequest { readonly entries: Readonly<Record<string, 'to-read' | 'reading' | 'read' | 'reviewed'>>; }
export interface WorkspaceImportLegacyReadingQueueResponse { readonly imported: number; readonly skipped: number; }

/** F307–F318: bookmarks apontam para identidades já existentes, nunca copiam conteúdo — ver ADR 0068. */
export type BookmarkTargetDto =
  | { readonly kind: 'document'; readonly fileId: string; readonly path: string }
  | { readonly kind: 'section'; readonly fileId: string; readonly path: string; readonly offset: number }
  | { readonly kind: 'reference'; readonly referenceId: string }
  | { readonly kind: 'annotation'; readonly referenceId: string; readonly annotationId: string }
  | { readonly kind: 'project'; readonly projectId: string }
  | { readonly kind: 'view'; readonly viewId: string }
  | { readonly kind: 'search'; readonly query: string }
  | { readonly kind: 'dataset'; readonly datasetId: string };
export interface WorkspaceBookmarkDto { readonly version: 1; readonly id: string; readonly label: string; readonly target: BookmarkTargetDto; readonly createdAt: string; }
export interface WorkspaceBookmarksDto { readonly version: 1; readonly bookmarks: readonly WorkspaceBookmarkDto[]; }
export interface WorkspaceSetBookmarksRequest extends WorkspaceBookmarksDto {}

/** F336–F343: inbox operacional revisável; candidatos só viram dados canônicos por ação explícita do usuário. */
export interface WorkspaceCaptureInboxItemDto { readonly id: string; readonly capturedAt: string; readonly title?: string; readonly url?: string; readonly selection?: string; readonly note?: string; }
export interface WorkspaceCaptureInboxDto { readonly version: 1; readonly items: readonly WorkspaceCaptureInboxItemDto[]; }
export interface WorkspaceSetCaptureInboxRequest extends WorkspaceCaptureInboxDto {}
/** Payload aceito pela bridge local; o Main valida e o renderer pede confirmação antes de persistir. */
export interface WorkspaceBrowserCaptureDto { readonly version: 1; readonly url: string; readonly title?: string; readonly selection?: string; readonly capturedAt: string; }

/** F344–F360: canvas é operacional e só aponta para identidades do vault. */
export type WorkspaceResearchCanvasNodeDto =
  | { readonly id: string; readonly type: 'document' | 'literature-note'; readonly fileId: string; readonly path: string; readonly x: number; readonly y: number }
  | { readonly id: string; readonly type: 'section'; readonly fileId: string; readonly path: string; readonly offset: number; readonly x: number; readonly y: number }
  | { readonly id: string; readonly type: 'reference'; readonly referenceId: string; readonly x: number; readonly y: number }
  | { readonly id: string; readonly type: 'pdf-annotation'; readonly referenceId: string; readonly annotationId: string; readonly x: number; readonly y: number }
  | { readonly id: string; readonly type: 'dataset'; readonly datasetId: string; readonly x: number; readonly y: number }
  | { readonly id: string; readonly type: 'project'; readonly projectId: string; readonly x: number; readonly y: number }
  | { readonly id: string; readonly type: 'text'; readonly text: string; readonly role?: 'claim' | 'evidence' | 'counterargument'; readonly x: number; readonly y: number };
export interface WorkspaceResearchCanvasEdgeDto { readonly id: string; readonly from: string; readonly to: string; readonly kind: 'related-to' | 'supports' | 'contradicts' | 'derived-from'; readonly label?: string; }
export interface WorkspaceResearchCanvasGroupDto { readonly id: string; readonly label: string; readonly nodeIds: readonly string[]; }
export interface WorkspaceResearchCanvasDto { readonly schema: 'folio-research-canvas'; readonly version: 1; readonly id: string; readonly title: string; readonly nodes: readonly WorkspaceResearchCanvasNodeDto[]; readonly edges: readonly WorkspaceResearchCanvasEdgeDto[]; readonly groups: readonly WorkspaceResearchCanvasGroupDto[]; }
export interface WorkspaceResearchCanvasesDto { readonly version: 1; readonly canvases: readonly WorkspaceResearchCanvasDto[]; }
export interface WorkspaceSetResearchCanvasesRequest extends WorkspaceResearchCanvasesDto {}

/** F319–F325: Peek Service — deriva sob demanda, nunca materializa (mesmo princípio da ADR 0070). */
export type PeekEntityDto =
  | { readonly kind: 'document'; readonly id: string; readonly title: string; readonly excerpt?: string }
  | { readonly kind: 'reference'; readonly id: string; readonly title: string; readonly authors?: string }
  | { readonly kind: 'annotation'; readonly id: string; readonly title: string; readonly excerpt: string }
  | { readonly kind: 'dataset' | 'project' | 'view' | 'search'; readonly id: string; readonly title: string; readonly excerpt?: string };
export interface WorkspacePeekRequest { readonly target: BookmarkTargetDto; }
/** `entity` fica `undefined` para alvos que o host deliberadamente não resolve (project/view/search/dataset) ou não encontra. */
export interface WorkspacePeekResponseDto { readonly entity?: PeekEntityDto; }

/** Offsets UTF-16; a mesma unidade usada por editor-core, CodeMirror e DOM. */
export interface EditorSelectionDto {
  readonly anchor: number;
  readonly head: number;
}

export interface EditorTextEditDto {
  readonly range: { readonly start: number; readonly end: number };
  readonly text: string;
}

export interface EditorTransactionDto {
  readonly edits?: readonly EditorTextEditDto[];
  readonly selection?: EditorSelectionDto;
}

export interface EditorOutlineItemDto {
  readonly nodeId: string;
  readonly title: string;
  readonly depth: number;
  readonly role?: string;
  readonly range: { readonly start: number; readonly end: number };
}

/**
 * Projeção serializável de sessão/controlador; não inclui AST nem HTML de
 * preview. `previewRevision`/`previewProfileId` são só um marcador de
 * novidade — o HTML em si é pedido sob demanda por `previewEditor`, para não
 * carregar o caminho de cada tecla com um payload que a maioria das edições
 * não precisa. Ver ADR 0015.
 */
export interface EditorSnapshotDto {
  readonly fileId: string;
  readonly version: number;
  readonly session: {
    readonly file: WorkspaceFileDto;
    readonly revision: number;
    readonly content: string;
    readonly contentHash?: string;
    readonly dirty: boolean;
    readonly status: 'idle' | 'compiling' | 'failed';
    readonly diagnostics: readonly DiagnosticDto[];
    /** Presente quando o arquivo mudou fora da sessão enquanto havia rascunho não salvo. Ver ADR 0021. */
    readonly externalChange?: WorkspaceFileDto;
  };
  readonly selection: EditorSelectionDto;
  readonly outline: readonly EditorOutlineItemDto[];
  readonly diagnostics: readonly DiagnosticDto[];
  readonly previewRevision?: number;
  readonly previewProfileId?: string;
}

export interface EditorPreviewRequest {
  readonly fileId: string;
}

/** HTML "rápido" (sem paginação): mesma Publication AST que alimentará o PDF. */
export interface EditorPreviewDto {
  readonly fileId: string;
  readonly revision: number;
  readonly profileId: string;
  readonly html: string;
}

export interface EditorExportRequest {
  readonly fileId: string;
}

/**
 * Publication AST da sessão, para um host gerar PDF/DOCX fora do processo de
 * compilação — mesma fonte que `previewEditor` já usa para HTML, exposta crua
 * porque o consumidor (Export Service) decide o formato, não o Workspace
 * Service. Ver ADR 0019.
 */
export interface EditorExportDto {
  readonly fileId: string;
  readonly revision: number;
  readonly profileId: string;
  /** Fingerprint da fonte autoral que gerou a Publication AST. */
  readonly contentHash: string;
  readonly publication: PublicationDocument;
}

/**
 * Pedido do canal IPC `editor.export` (não de `DesktopWorkspaceService`): o
 * formato só importa para a orquestração que Main faz entre Workspace Service
 * e Export Service, não para "qual é a Publication AST atual".
 */
export interface DesktopExportRequest {
  readonly fileId: string;
  readonly format: DesktopExportFormat;
}

/** F95: Main salva texto fornecido por uma contribuição declarada de plugin. */
export interface DesktopPluginExportRequest {
  readonly fileId: string;
  readonly expectedRevision: number;
  readonly pluginId: string;
  readonly exportId: string;
}
export interface WorkspacePluginExportRequest {
  readonly fileId: string;
  readonly expectedRevision: number;
  readonly pluginId: string;
  readonly exportId: string;
}
export interface WorkspacePluginExportDto {
  readonly title: string;
  readonly extension: string;
  readonly mimeType: string;
  readonly content: string;
}

/**
 * Resultado de uma exportação concluída pelo Main: caminho escolhido pelo
 * usuário no diálogo nativo de salvar. Não faz parte de `DesktopWorkspaceService`
 * — o Workspace Service não abre diálogo nem escreve fora do vault; é
 * resultado do canal IPC `editor.export`, que orquestra Main + Export Service.
 */
export interface EditorExportResultDto {
  readonly path: string;
  readonly revision?: number;
  readonly profileId?: string;
  readonly contentHash?: string;
  /** SHA-256 do artefato salvo, calculado antes de Main gravá-lo fora do vault. */
  readonly sha256?: string;
  readonly pages?: number;
}

export interface EditorOpenRequest {
  readonly fileId: string;
}

export interface EditorSnapshotRequest {
  readonly fileId: string;
}

export interface EditorDispatchRequest {
  readonly fileId: string;
  /** Revisão autoritativa da sessão; não muda quando só chegam projeções. */
  readonly expectedRevision: number;
  readonly transaction: EditorTransactionDto;
}

export interface EditorSaveRequest {
  readonly fileId: string;
  readonly expectedRevision: number;
}

export interface EditorCloseRequest {
  readonly fileId: string;
}

export interface EditorResolveConflictRequest {
  readonly fileId: string;
  /** `keep-local`: mantém o rascunho e aceita a revisão externa como nova base para salvar por cima. `reload-external`: descarta o rascunho. */
  readonly resolution: 'keep-local' | 'reload-external';
}

/** Pedido revisionado de inteligência editorial; offsets seguem CodeMirror/UTF-16. */
export interface LanguageQueryRequest {
  readonly fileId: string;
  readonly offset: number;
  /** Evita aplicar ranges produzidos para um rascunho que já mudou. */
  readonly expectedRevision: number;
  readonly limit?: number;
}

export type LanguageCompletionRequest = LanguageQueryRequest;
export type LanguageHoverRequest = LanguageQueryRequest;
export type LanguageDefinitionRequest = LanguageQueryRequest;
export type LanguageReferencesRequest = LanguageQueryRequest;
export interface LanguageCrossReferenceTargetsRequest { readonly fileId: string; readonly expectedRevision: number; }

export interface LanguageRangeDto {
  readonly start: number;
  readonly end: number;
}

export interface LanguageCompletionItemDto {
  readonly kind: 'citation' | 'document' | 'block' | 'math' | 'pdf';
  readonly label: string;
  readonly detail?: string;
  readonly insertText: string;
}

export interface LanguageCompletionDto {
  readonly range: LanguageRangeDto;
  readonly items: readonly LanguageCompletionItemDto[];
}

export interface LanguageHoverDto {
  readonly range: LanguageRangeDto;
  readonly contents: readonly string[];
}

export interface LanguageLocationDto {
  readonly fileId: string;
  readonly path: string;
  readonly range: LanguageRangeDto;
  readonly page?: number;
  readonly annotationId?: string;
}
export interface LanguageCrossReferenceTargetDto { readonly identifier: string; readonly kind: 'section' | 'figure' | 'table' | 'equation'; readonly label: string; readonly range: LanguageRangeDto; }

export interface LanguageUnlinkedMentionsRequest {
  readonly fileId: string;
  readonly expectedRevision: number;
}

export type LanguageUnlinkedMentionDto =
  | {
    readonly kind: 'document';
    readonly range: LanguageRangeDto;
    readonly targetFileId: string;
    readonly targetPath: string;
    readonly text: string;
  }
  | {
    readonly kind: 'reference';
    readonly range: LanguageRangeDto;
    readonly referenceId: string;
    readonly text: string;
  };

/** @deprecated Use LanguageUnlinkedMentionDto discriminado por kind. */
export interface LegacyLanguageUnlinkedMentionDto {
  readonly range: LanguageRangeDto;
  readonly targetFileId: string;
  readonly targetPath: string;
  readonly text: string;
}

export interface LanguageWritingStatisticsRequest {
  readonly fileId: string;
  readonly expectedRevision: number;
}

export interface LanguageWritingStatisticsDto {
  readonly words: number;
  readonly characters: number;
  readonly paragraphs: number;
  readonly citations: number;
  readonly figures: number;
  readonly tables: number;
  readonly equations: number;
  readonly estimatedReadingMinutes: number;
  readonly sections: readonly { readonly title: string; readonly words: number }[];
}
export interface LanguageRenameRequest { readonly fileId: string; readonly offset: number; readonly newName: string; readonly expectedRevision: number; }
export interface LanguageMoveSectionRequest { readonly fileId: string; readonly offset: number; readonly direction: 'up' | 'down'; readonly expectedRevision: number; }
export interface LanguageRenameResultDto { readonly label: string; readonly changedFiles: readonly string[]; }

export type DesktopEventDto =
  | { readonly type: 'desktop:editor-updated'; readonly snapshot: EditorSnapshotDto }
  | { readonly type: 'desktop:editor-closed'; readonly fileId: string }
  | { readonly type: 'desktop:workspace-event'; readonly event: WorkspaceEvent }
  | { readonly type: 'desktop:operational-error'; readonly operation: string; readonly error: ProtocolError }
  | { readonly type: 'desktop:browser-capture'; readonly capture: WorkspaceBrowserCaptureDto };

/** Contrato da autoridade desktop. O renderer recebe esta superfície via preload. */
export interface DesktopWorkspaceService {
  profiles(request: WorkspaceProfilesRequest, signal?: AbortSignal): Promise<ProtocolResult<readonly WorkspaceProfileManifestDto[]>>;
  previewProfileValidation(request: WorkspaceProfileValidationPreviewRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceProfileValidationPreviewDto>>;
  open(request: WorkspaceOpenRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceOpenResponse>>;
  configureSync(request: WorkspaceConfigureSyncRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceSyncStatusDto>>;
  syncStatus(signal?: AbortSignal): Promise<ProtocolResult<WorkspaceSyncStatusDto>>;
  syncNow(signal?: AbortSignal): Promise<ProtocolResult<WorkspaceSyncStatusDto>>;
  recoverFromSync(signal?: AbortSignal): Promise<ProtocolResult<WorkspaceSyncStatusDto>>;
  resolveSyncConflict(request: WorkspaceResolveSyncConflictRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceSyncStatusDto>>;
  collaboration(signal?: AbortSignal): Promise<ProtocolResult<WorkspaceCollaborationDto>>;
  setCollaboration(request: WorkspaceSetCollaborationRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceCollaborationDto>>;
  academicViews(signal?: AbortSignal): Promise<ProtocolResult<WorkspaceAcademicViewsDto>>;
  setAcademicViews(request: WorkspaceSetAcademicViewsRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceAcademicViewsDto>>;
  pages(signal?: AbortSignal): Promise<ProtocolResult<WorkspacePagesDto>>;
  enablePage(request: WorkspaceEnablePageRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspacePageDto>>;
  setPageProperties(request: WorkspaceSetPagePropertiesRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspacePageDto>>;
  togglePageTask(request: WorkspaceTogglePageTaskRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspacePageDto>>;
  homeLayout(signal?: AbortSignal): Promise<ProtocolResult<WorkspaceHomeLayoutDto>>;
  setHomeLayout(request: WorkspaceSetHomeLayoutRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceHomeLayoutDto>>;
  themes(signal?: AbortSignal): Promise<ProtocolResult<WorkspaceThemesDto>>;
  setThemes(request: WorkspaceSetThemesRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceThemesDto>>;
  researchProjects(signal?: AbortSignal): Promise<ProtocolResult<WorkspaceResearchProjectsDto>>;
  setResearchProjects(request: WorkspaceSetResearchProjectsRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceResearchProjectsDto>>;
  readingQueue(signal?: AbortSignal): Promise<ProtocolResult<WorkspaceReadingQueueDto>>;
  setReadingQueue(request: WorkspaceSetReadingQueueRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceReadingQueueDto>>;
  importLegacyResearchProjects(request: WorkspaceImportLegacyResearchProjectsRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceImportLegacyResearchProjectsResponse>>;
  importLegacyReadingQueue(request: WorkspaceImportLegacyReadingQueueRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceImportLegacyReadingQueueResponse>>;
  academicRelations(signal?: AbortSignal): Promise<ProtocolResult<WorkspaceAcademicRelationsDto>>;
  /** Onda BJ: relação explícita entre duas referências — nunca substitui merge de duplicata. */
  referenceRelations(request: WorkspaceReferenceRelationsRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceReferenceRelationsDto>>;
  addReferenceRelation(request: WorkspaceAddReferenceRelationRequest, signal?: AbortSignal): Promise<ProtocolResult<ReferenceRelationDto>>;
  removeReferenceRelation(request: WorkspaceRemoveReferenceRelationRequest, signal?: AbortSignal): Promise<ProtocolResult<undefined>>;
  /** Onda BM: assinaturas de feed são operacionais; a biblioteca canônica só recebe o que passar por `importFeedInboxItem`. */
  literatureSubscriptions(signal?: AbortSignal): Promise<ProtocolResult<WorkspaceLiteratureSubscriptionsDto>>;
  addLiteratureSubscription(request: WorkspaceAddLiteratureSubscriptionRequest, signal?: AbortSignal): Promise<ProtocolResult<LiteratureSubscriptionDto>>;
  removeLiteratureSubscription(request: WorkspaceRemoveLiteratureSubscriptionRequest, signal?: AbortSignal): Promise<ProtocolResult<undefined>>;
  literatureFeedInbox(signal?: AbortSignal): Promise<ProtocolResult<WorkspaceLiteratureFeedInboxDto>>;
  /** Provider explícito: busca a URL da assinatura e anexa só os itens novos e filtrados ao inbox. */
  pollLiteratureSubscription(request: WorkspacePollLiteratureSubscriptionRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspacePollLiteratureSubscriptionResponseDto>>;
  dismissFeedInboxItem(request: WorkspaceDismissFeedInboxItemRequest, signal?: AbortSignal): Promise<ProtocolResult<undefined>>;
  /** Resolve DOI se detectado no item; senão cria entrada manual mínima. Sempre remove do inbox ao concluir. */
  importFeedInboxItem(request: WorkspaceImportFeedInboxItemRequest, signal?: AbortSignal): Promise<ProtocolResult<BibliographicEntityDto>>;
  bookmarks(signal?: AbortSignal): Promise<ProtocolResult<WorkspaceBookmarksDto>>;
  setBookmarks(request: WorkspaceSetBookmarksRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceBookmarksDto>>;
  captureInbox(signal?: AbortSignal): Promise<ProtocolResult<WorkspaceCaptureInboxDto>>;
  setCaptureInbox(request: WorkspaceSetCaptureInboxRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceCaptureInboxDto>>;
  researchCanvases(signal?: AbortSignal): Promise<ProtocolResult<WorkspaceResearchCanvasesDto>>;
  setResearchCanvases(request: WorkspaceSetResearchCanvasesRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceResearchCanvasesDto>>;
  peek(request: WorkspacePeekRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspacePeekResponseDto>>;
  list(request: WorkspaceListRequest, signal?: AbortSignal): Promise<ProtocolResult<readonly WorkspaceFileDto[]>>;
  read(request: WorkspaceReadRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceReadResponse>>;
  assetPreview(request: WorkspaceAssetPreviewRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceAssetPreviewResponse>>;
  openEditor(request: EditorOpenRequest, signal?: AbortSignal): Promise<ProtocolResult<EditorSnapshotDto>>;
  editorSnapshot(request: EditorSnapshotRequest, signal?: AbortSignal): Promise<ProtocolResult<EditorSnapshotDto>>;
  dispatchEditor(request: EditorDispatchRequest, signal?: AbortSignal): Promise<ProtocolResult<EditorSnapshotDto>>;
  saveEditor(request: EditorSaveRequest, signal?: AbortSignal): Promise<ProtocolResult<EditorSnapshotDto>>;
  closeEditor(request: EditorCloseRequest, signal?: AbortSignal): Promise<ProtocolResult<undefined>>;
  resolveEditorConflict(request: EditorResolveConflictRequest, signal?: AbortSignal): Promise<ProtocolResult<EditorSnapshotDto>>;
  /** `undefined` quando a sessão ainda não produziu nenhuma compilação bem-sucedida. */
  previewEditor(request: EditorPreviewRequest, signal?: AbortSignal): Promise<ProtocolResult<EditorPreviewDto | undefined>>;
  /** `undefined` quando a sessão ainda não produziu nenhuma compilação bem-sucedida. */
  exportDocument(request: EditorExportRequest, signal?: AbortSignal): Promise<ProtocolResult<EditorExportDto | undefined>>;
  search(request: WorkspaceSearchRequest, signal?: AbortSignal): Promise<ProtocolResult<readonly WorkspaceSearchResultDto[]>>;
  problems(request: WorkspaceProblemsRequest, signal?: AbortSignal): Promise<ProtocolResult<readonly WorkspaceProblemDto[]>>;
  plugins(signal?: AbortSignal): Promise<ProtocolResult<readonly WorkspacePluginDto[]>>;
  setPluginEnabled(request: WorkspacePluginSetEnabledRequest, signal?: AbortSignal): Promise<ProtocolResult<readonly WorkspacePluginDto[]>>;
  reloadPlugins(signal?: AbortSignal): Promise<ProtocolResult<readonly WorkspacePluginDto[]>>;
  runPluginCommand(request: WorkspacePluginCommandRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspacePluginCommandResultDto>>;
  exportWithPlugin(request: WorkspacePluginExportRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspacePluginExportDto>>;
  backlinks(request: WorkspaceBacklinksRequest, signal?: AbortSignal): Promise<ProtocolResult<readonly WorkspaceBacklinkDto[]>>;
  references(request: WorkspaceReferencesRequest, signal?: AbortSignal): Promise<ProtocolResult<readonly WorkspaceReferenceDto[]>>;
  graph(request: WorkspaceGraphRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceGraphDto>>;
  history(request: WorkspaceHistoryRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceHistoryDto>>;
  historyCreateSnapshot(request: WorkspaceHistorySnapshotRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceHistoryRevisionDto>>;
  historyDiff(request: WorkspaceHistoryDiffRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceHistoryDiffDto>>;
  historyStructuralDiff(request: WorkspaceHistoryDiffRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceHistoryStructuralDiffDto>>;
  compareDocuments(request: WorkspaceDocumentComparisonRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceDocumentComparisonDto>>;
  createLiteratureNote(request: WorkspaceCreateLiteratureNoteRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceFileDto>>;
  journalOpen(request: WorkspaceJournalOpenRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceFileDto>>;
  journalCapture(request: WorkspaceJournalCaptureRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceFileDto>>;
  citationExplorer(request: WorkspaceCitationExplorerRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceCitationExplorerResponseDto>>;
  researchOverview(request: WorkspaceResearchOverviewRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceResearchOverviewDto>>;
  projectDashboard(request: WorkspaceProjectDashboardRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceProjectDashboardDto>>;
  libraryList(request: WorkspaceLibraryListRequest, signal?: AbortSignal): Promise<ProtocolResult<readonly BibliographicEntityDto[]>>;
  libraryUpsert(request: WorkspaceLibraryUpsertRequest, signal?: AbortSignal): Promise<ProtocolResult<BibliographicEntityDto>>;
  libraryRemove(request: WorkspaceLibraryRemoveRequest, signal?: AbortSignal): Promise<ProtocolResult<undefined>>;
  libraryFormat(request: WorkspaceLibraryFormatRequest, signal?: AbortSignal): Promise<ProtocolResult<string>>;
  libraryResolveDoi(request: WorkspaceLibraryResolveDoiRequest, signal?: AbortSignal): Promise<ProtocolResult<BibliographicEntityDto>>;
  reviewScholarlyIdentifier(request: WorkspaceScholarlyIdentifierReviewRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceScholarlyIdentifierReviewDto>>;
  reviewScholarlyIdentifiersBatch(request: WorkspaceScholarlyIdentifierBatchReviewRequest, signal?: AbortSignal): Promise<ProtocolResult<readonly WorkspaceScholarlyIdentifierReviewDto[]>>;
  reconcilePdf(request: WorkspacePdfReconciliationRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspacePdfReconciliationDto>>;
  discoverFullText(request: WorkspaceFullTextDiscoveryRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceFullTextDiscoveryDto>>;
  downloadFullText(request: WorkspaceDownloadFullTextRequest, signal?: AbortSignal): Promise<ProtocolResult<AttachmentDto>>;
  systematicReview(signal?: AbortSignal): Promise<ProtocolResult<WorkspaceSystematicReviewDto>>;
  setSystematicReview(request: WorkspaceSetSystematicReviewRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceSystematicReviewDto>>;
  evidenceSynthesis(signal?: AbortSignal): Promise<ProtocolResult<WorkspaceEvidenceSynthesisDto>>;
  setEvidenceSynthesis(request: WorkspaceSetEvidenceSynthesisRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceEvidenceSynthesisDto>>;
  researchDatasets(signal?: AbortSignal): Promise<ProtocolResult<WorkspaceResearchDatasetsDto>>;
  setResearchDatasets(request: WorkspaceSetResearchDatasetsRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceResearchDatasetsDto>>;
  importResearchDataset(request: WorkspaceImportResearchDatasetRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceResearchDatasetsDto>>;
  researchDatasetPreview(request: WorkspaceResearchDatasetPreviewRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceResearchDatasetPreviewDto>>;
  /** Onda BN: registry de extractors (Schema.org, citation meta, Dublin Core, JSON-LD, DOI) — múltiplos resultados, nunca auto-mescla. */
  webCaptureExtract(request: WorkspaceWebCaptureExtractRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceWebCaptureExtractResponseDto>>;
  libraryImport(request: WorkspaceLibraryImportRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceLibraryImportResponseDto>>;
  libraryIntakePreview(request: WorkspaceLibraryIntakePreviewRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceLibraryIntakePreviewDto>>;
  libraryDuplicates(request: WorkspaceLibraryDuplicatesRequest, signal?: AbortSignal): Promise<ProtocolResult<readonly WorkspaceLibraryDuplicateDto[]>>;
  libraryMerge(request: WorkspaceLibraryMergeRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceLibraryMergeResponseDto>>;
  libraryKeyPreview(request: WorkspaceLibraryKeyPreviewRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceLibraryKeyPreviewDto>>;
  libraryRenameKey(request: WorkspaceLibraryRenameKeyRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceLibraryRenameKeyResponseDto>>;
  referenceIntegrity(signal?: AbortSignal): Promise<ProtocolResult<WorkspaceReferenceIntegrityDto>>;
  setReferenceIntegrity(request: WorkspaceSetReferenceIntegrityRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceReferenceIntegrityDto>>;
  referenceHealth(request: WorkspaceReferenceHealthRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceReferenceHealthDto>>;
  /** Onda BO: painel único para triagem em lote — composição de referenceHealth/libraryDuplicates/attachmentHealth/referenceRelations. */
  libraryMaintenanceOverview(request: WorkspaceLibraryMaintenanceRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceLibraryMaintenanceOverviewDto>>;
  referenceAttachments(request: WorkspaceReferenceAttachmentsRequest, signal?: AbortSignal): Promise<ProtocolResult<readonly WorkspaceReferenceAttachmentDto[]>>;
  attachReferencePdf(request: WorkspaceAttachReferencePdfRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceReferenceAttachmentDto>>;
  removeReferenceAttachment(request: WorkspaceReferenceAttachmentRequest, signal?: AbortSignal): Promise<ProtocolResult<undefined>>;
  referencePdf(request: WorkspaceReferenceAttachmentRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceReferencePdfDto>>;
  pdfAnnotations(request: WorkspaceAnnotationsRequest, signal?: AbortSignal): Promise<ProtocolResult<readonly WorkspacePdfAnnotationDto[]>>;
  createPdfAnnotation(request: WorkspaceCreatePdfAnnotationRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspacePdfAnnotationDto>>;
  removePdfAnnotation(request: WorkspacePdfAnnotationRequest, signal?: AbortSignal): Promise<ProtocolResult<undefined>>;
  linkPdfAnnotation(request: WorkspacePdfAnnotationRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspacePdfAnnotationLinkDto>>;
  /** Onda BL: anotações do vault inteiro (ou de uma referência, se informada) — não só do PDF aberto no momento. */
  annotations(request: WorkspaceAnnotationsRequest, signal?: AbortSignal): Promise<ProtocolResult<readonly WorkspacePdfAnnotationDto[]>>;
  annotationColorSemantics(signal?: AbortSignal): Promise<ProtocolResult<WorkspaceAnnotationColorSemanticsDto>>;
  setAnnotationColorSemantics(request: WorkspaceSetAnnotationColorSemanticsRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceAnnotationColorSemanticsDto>>;
  /** Insere via EditorTransaction (sessão do documento-alvo), nunca escrita direta de arquivo. */
  synthesizeAnnotations(request: WorkspaceSynthesizeAnnotationsRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceSynthesizeAnnotationsResponseDto>>;
  /** Apenas Main chama isto para abrir/revelar o PDF; nunca expor ao renderer. */
  referenceAttachmentLocalPath(request: WorkspaceReferenceAttachmentRequest, signal?: AbortSignal): Promise<ProtocolResult<string | undefined>>;
  /** Onda BH: múltiplos anexos por referência (ou vault inteiro, se `referenceId` ausente). */
  attachments(request: WorkspaceAttachmentsRequest, signal?: AbortSignal): Promise<ProtocolResult<readonly AttachmentDto[]>>;
  addAttachment(request: WorkspaceAddAttachmentRequest, signal?: AbortSignal): Promise<ProtocolResult<AttachmentDto>>;
  addAttachmentVersion(request: WorkspaceAddAttachmentVersionRequest, signal?: AbortSignal): Promise<ProtocolResult<AttachmentDto>>;
  removeAttachment(request: WorkspaceAttachmentRequest, signal?: AbortSignal): Promise<ProtocolResult<undefined>>;
  /** Sugestão determinística vira escrita só quando o usuário confirma este comando. */
  renameAttachmentFile(request: WorkspaceRenameAttachmentFileRequest, signal?: AbortSignal): Promise<ProtocolResult<AttachmentDto>>;
  /** Apenas Main chama isto para abrir/revelar um anexo em arquivo; nunca expor ao renderer. */
  attachmentLocalPath(request: WorkspaceAttachmentRequest, signal?: AbortSignal): Promise<ProtocolResult<string | undefined>>;
  attachmentHealth(request: WorkspaceAttachmentHealthRequest, signal?: AbortSignal): Promise<ProtocolResult<readonly AttachmentHealthIssueDto[]>>;
  importAsset(request: WorkspaceImportAssetRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceAssetDto>>;
  createDocument(request: WorkspaceCreateDocumentRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceFileDto>>;
  /** Renomeia o arquivo autoral; o host também atualiza links Markdown simples que o apontavam. */
  renameDocument(request: WorkspaceRenameRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceFileDto>>;
  completions(request: LanguageCompletionRequest, signal?: AbortSignal): Promise<ProtocolResult<LanguageCompletionDto | undefined>>;
  hover(request: LanguageHoverRequest, signal?: AbortSignal): Promise<ProtocolResult<LanguageHoverDto | undefined>>;
  definition(request: LanguageDefinitionRequest, signal?: AbortSignal): Promise<ProtocolResult<readonly LanguageLocationDto[]>>;
  languageReferences(request: LanguageReferencesRequest, signal?: AbortSignal): Promise<ProtocolResult<readonly LanguageLocationDto[]>>;
  crossReferenceTargets(request: LanguageCrossReferenceTargetsRequest, signal?: AbortSignal): Promise<ProtocolResult<readonly LanguageCrossReferenceTargetDto[]>>;
  unlinkedMentions(request: LanguageUnlinkedMentionsRequest, signal?: AbortSignal): Promise<ProtocolResult<readonly LanguageUnlinkedMentionDto[]>>;
  writingStatistics(request: LanguageWritingStatisticsRequest, signal?: AbortSignal): Promise<ProtocolResult<LanguageWritingStatisticsDto>>;
  renameSymbol(request: LanguageRenameRequest, signal?: AbortSignal): Promise<ProtocolResult<LanguageRenameResultDto | undefined>>;
  moveSection(request: LanguageMoveSectionRequest, signal?: AbortSignal): Promise<ProtocolResult<LanguageRenameResultDto | undefined>>;
}

// ---------------------------------------------------------------------------
// Envelope independente de plataforma para MessagePort/Worker/IPC.
// ---------------------------------------------------------------------------

export type CompilerMethod = 'compiler/profiles' | 'compiler/prepare' | 'compiler/compile';

export type WorkspaceMethod =
  | 'workspace/profiles'
  | 'workspace/profile-validation-preview'
  | 'workspace/open'
  | 'workspace/sync-configure'
  | 'workspace/sync-status'
  | 'workspace/sync-now'
  | 'workspace/sync-recover'
  | 'workspace/sync-resolve-conflict'
  | 'workspace/collaboration'
  | 'workspace/collaboration-set'
  | 'workspace/academic-views'
  | 'workspace/academic-views-set'
  | 'workspace/pages'
  | 'workspace/page-enable'
  | 'workspace/page-properties-set'
  | 'workspace/page-task-toggle'
  | 'workspace/home-layout'
  | 'workspace/home-layout-set'
  | 'workspace/themes'
  | 'workspace/themes-set'
  | 'workspace/research-projects'
  | 'workspace/research-projects-set'
  | 'workspace/reading-queue'
  | 'workspace/reading-queue-set'
  | 'workspace/research-projects-import-legacy'
  | 'workspace/reading-queue-import-legacy'
  | 'workspace/academic-relations'
  | 'workspace/reference-relations'
  | 'workspace/add-reference-relation'
  | 'workspace/remove-reference-relation'
  | 'workspace/literature-subscriptions'
  | 'workspace/add-literature-subscription'
  | 'workspace/remove-literature-subscription'
  | 'workspace/literature-feed-inbox'
  | 'workspace/poll-literature-subscription'
  | 'workspace/dismiss-feed-inbox-item'
  | 'workspace/import-feed-inbox-item'
  | 'workspace/bookmarks'
  | 'workspace/bookmarks-set'
  | 'workspace/capture-inbox'
  | 'workspace/capture-inbox-set'
  | 'workspace/research-canvases'
  | 'workspace/research-canvases-set'
  | 'workspace/peek'
  | 'workspace/list'
  | 'workspace/read'
  | 'workspace/asset-preview'
  | 'editor/open'
  | 'editor/snapshot'
  | 'editor/dispatch'
  | 'editor/save'
  | 'editor/close'
  | 'editor/resolve-conflict'
  | 'editor/preview'
  | 'editor/export'
  | 'workspace/search'
  | 'workspace/problems'
  | 'workspace/plugins'
  | 'workspace/plugin-set-enabled'
  | 'workspace/plugins-reload'
  | 'workspace/plugin-command'
  | 'workspace/plugin-export'
  | 'workspace/backlinks'
  | 'workspace/references'
  | 'workspace/graph'
  | 'workspace/history'
  | 'workspace/history-create-snapshot'
  | 'workspace/history-diff'
  | 'workspace/history-structural-diff'
  | 'workspace/compare-documents'
  | 'workspace/create-literature-note'
  | 'workspace/journal-open'
  | 'workspace/journal-capture'
  | 'workspace/citation-explorer'
  | 'workspace/research-overview'
  | 'workspace/project-dashboard'
  | 'workspace/library-list'
  | 'workspace/library-upsert'
  | 'workspace/library-remove'
  | 'workspace/library-format'
  | 'workspace/library-resolve-doi'
  | 'workspace/review-scholarly-identifier'
  | 'workspace/review-scholarly-identifiers-batch'
  | 'workspace/reconcile-pdf'
  | 'workspace/discover-full-text'
  | 'workspace/download-full-text'
  | 'workspace/systematic-review'
  | 'workspace/systematic-review-set'
  | 'workspace/evidence-synthesis'
  | 'workspace/evidence-synthesis-set'
  | 'workspace/research-datasets'
  | 'workspace/research-datasets-set'
  | 'workspace/research-datasets-import'
  | 'workspace/research-dataset-preview'
  | 'workspace/web-capture-extract'
  | 'workspace/library-import'
  | 'workspace/library-intake-preview'
  | 'workspace/library-duplicates'
  | 'workspace/library-merge'
  | 'workspace/library-key-preview'
  | 'workspace/library-rename-key'
  | 'workspace/reference-integrity'
  | 'workspace/reference-integrity-set'
  | 'workspace/reference-health'
  | 'workspace/library-maintenance-overview'
  | 'workspace/reference-attachments'
  | 'workspace/attach-reference-pdf'
  | 'workspace/remove-reference-attachment'
  | 'workspace/reference-attachment-local-path'
  | 'workspace/reference-pdf'
  | 'workspace/pdf-annotations'
  | 'workspace/create-pdf-annotation'
  | 'workspace/remove-pdf-annotation'
  | 'workspace/link-pdf-annotation'
  | 'workspace/annotations'
  | 'workspace/annotation-color-semantics'
  | 'workspace/set-annotation-color-semantics'
  | 'workspace/synthesize-annotations'
  | 'workspace/attachments'
  | 'workspace/add-attachment'
  | 'workspace/add-attachment-version'
  | 'workspace/remove-attachment'
  | 'workspace/rename-attachment-file'
  | 'workspace/attachment-local-path'
  | 'workspace/attachment-health'
  | 'workspace/import-asset'
  | 'workspace/create-document'
  | 'workspace/rename-document'
  | 'language/completions'
  | 'language/hover'
  | 'language/definition'
  | 'language/references'
  | 'language/cross-reference-targets'
  | 'language/unlinked-mentions'
  | 'language/writing-statistics'
  | 'language/rename-symbol'
  | 'language/move-section';

export type ExportMethod = 'export/run';

export type ProtocolMethod = CompilerMethod | WorkspaceMethod | ExportMethod;

export interface ProtocolRequestEnvelope {
  readonly version: number;
  readonly kind: 'request';
  readonly id: string;
  readonly method: ProtocolMethod;
  readonly payload: unknown;
}

export interface ProtocolResponseEnvelope {
  readonly version: number;
  readonly kind: 'response';
  readonly id: string;
  readonly result: ProtocolResult<unknown>;
}

export interface ProtocolCancelEnvelope {
  readonly version: number;
  readonly kind: 'cancel';
  readonly id: string;
}

export type ProtocolEnvelope =
  | ProtocolRequestEnvelope
  | ProtocolResponseEnvelope
  | ProtocolCancelEnvelope;

/** Subconjunto comum de `MessagePort` do navegador e de `worker_threads`. */
export interface MessagePortLike {
  postMessage(message: unknown): void;
  start?: () => void;
  addEventListener?: (type: 'message', listener: (event: { readonly data: unknown }) => void) => void;
  removeEventListener?: (type: 'message', listener: (event: { readonly data: unknown }) => void) => void;
  on?: (type: 'message', listener: (message: unknown) => void) => void;
  off?: (type: 'message', listener: (message: unknown) => void) => void;
}
