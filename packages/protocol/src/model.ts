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

/** Contrato comum a implementação em memória, worker e utility process. */
export interface CompilerService {
  prepare(
    request: CompilerPrepareRequest,
    signal?: AbortSignal,
  ): Promise<ProtocolResult<PreparedCompilationDto>>;
  compile(
    request: CompilerCompileRequest,
    signal?: AbortSignal,
  ): Promise<ProtocolResult<CompilationResultDto>>;
}

export type ExportFormat = 'pdf' | 'docx';

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
export interface WorkspacePluginDto { readonly id: string; readonly version?: string; readonly apiVersion?: number; readonly capabilities: readonly string[]; readonly enabled: boolean; readonly commands: readonly { readonly id: string; readonly title: string }[]; readonly views: readonly { readonly id: string; readonly title: string; readonly body: string }[]; readonly exports: readonly { readonly id: string; readonly title: string; readonly extension: string; readonly mimeType: string }[]; readonly error?: string; }
export interface WorkspacePluginSetEnabledRequest { readonly id: string; readonly enabled: boolean; }
export interface WorkspacePluginCommandRequest { readonly pluginId: string; readonly commandId: string; readonly activeFileId?: string; readonly activeRevision?: number; }
export interface WorkspacePluginCommandResultDto { readonly kind: 'notice' | 'open-view'; readonly message?: string; readonly viewId?: string; }
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

export type WorkspaceGraphEdgeKind = 'links-to' | 'cites' | 'embeds' | 'authored-by' | 'tagged-with';

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

export interface WorkspaceLibraryImportRequest {
  readonly format: 'bibtex' | 'ris' | 'csl-json';
  readonly content: string;
}

export interface WorkspaceLibraryImportResponseDto {
  readonly imported: readonly BibliographicEntityDto[];
  readonly diagnostics: readonly DiagnosticDto[];
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
export type WorkspaceReferenceAuditCode =
  | 'invalid-doi' | 'invalid-isbn' | 'missing-url' | 'missing-access-date'
  | 'incomplete-author' | 'missing-year' | 'possible-duplicate'
  | 'inconsistent-key' | 'missing-pdf' | 'missing-literature-note';
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
  readonly page: number;
  readonly quote: string;
  readonly comment?: string;
  readonly createdAt: string;
  readonly literatureNoteFileId?: string;
}
export interface WorkspaceCreatePdfAnnotationRequest {
  readonly referenceId: string;
  readonly page: number;
  readonly quote: string;
  readonly comment?: string;
}
export interface WorkspacePdfAnnotationRequest { readonly referenceId: string; readonly id: string; }
export interface WorkspacePdfAnnotationLinkDto {
  readonly annotation: WorkspacePdfAnnotationDto;
  readonly literatureNote: WorkspaceFileDto;
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
  readonly publication: PublicationDocument;
}

/**
 * Pedido do canal IPC `editor.export` (não de `DesktopWorkspaceService`): o
 * formato só importa para a orquestração que Main faz entre Workspace Service
 * e Export Service, não para "qual é a Publication AST atual".
 */
export interface DesktopExportRequest {
  readonly fileId: string;
  readonly format: ExportFormat;
}

/**
 * Resultado de uma exportação concluída pelo Main: caminho escolhido pelo
 * usuário no diálogo nativo de salvar. Não faz parte de `DesktopWorkspaceService`
 * — o Workspace Service não abre diálogo nem escreve fora do vault; é
 * resultado do canal IPC `editor.export`, que orquestra Main + Export Service.
 */
export interface EditorExportResultDto {
  readonly path: string;
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
  readonly kind: 'citation' | 'document' | 'math';
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
  | { readonly type: 'desktop:operational-error'; readonly operation: string; readonly error: ProtocolError };

/** Contrato da autoridade desktop. O renderer recebe esta superfície via preload. */
export interface DesktopWorkspaceService {
  open(request: WorkspaceOpenRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceOpenResponse>>;
  list(request: WorkspaceListRequest, signal?: AbortSignal): Promise<ProtocolResult<readonly WorkspaceFileDto[]>>;
  read(request: WorkspaceReadRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceReadResponse>>;
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
  backlinks(request: WorkspaceBacklinksRequest, signal?: AbortSignal): Promise<ProtocolResult<readonly WorkspaceBacklinkDto[]>>;
  references(request: WorkspaceReferencesRequest, signal?: AbortSignal): Promise<ProtocolResult<readonly WorkspaceReferenceDto[]>>;
  graph(request: WorkspaceGraphRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceGraphDto>>;
  history(request: WorkspaceHistoryRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceHistoryDto>>;
  historyCreateSnapshot(request: WorkspaceHistorySnapshotRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceHistoryRevisionDto>>;
  historyDiff(request: WorkspaceHistoryDiffRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceHistoryDiffDto>>;
  historyStructuralDiff(request: WorkspaceHistoryDiffRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceHistoryStructuralDiffDto>>;
  compareDocuments(request: WorkspaceDocumentComparisonRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceDocumentComparisonDto>>;
  createLiteratureNote(request: WorkspaceCreateLiteratureNoteRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceFileDto>>;
  citationExplorer(request: WorkspaceCitationExplorerRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceCitationExplorerResponseDto>>;
  researchOverview(request: WorkspaceResearchOverviewRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceResearchOverviewDto>>;
  libraryList(request: WorkspaceLibraryListRequest, signal?: AbortSignal): Promise<ProtocolResult<readonly BibliographicEntityDto[]>>;
  libraryUpsert(request: WorkspaceLibraryUpsertRequest, signal?: AbortSignal): Promise<ProtocolResult<BibliographicEntityDto>>;
  libraryRemove(request: WorkspaceLibraryRemoveRequest, signal?: AbortSignal): Promise<ProtocolResult<undefined>>;
  libraryFormat(request: WorkspaceLibraryFormatRequest, signal?: AbortSignal): Promise<ProtocolResult<string>>;
  libraryResolveDoi(request: WorkspaceLibraryResolveDoiRequest, signal?: AbortSignal): Promise<ProtocolResult<BibliographicEntityDto>>;
  libraryImport(request: WorkspaceLibraryImportRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceLibraryImportResponseDto>>;
  libraryDuplicates(request: WorkspaceLibraryDuplicatesRequest, signal?: AbortSignal): Promise<ProtocolResult<readonly WorkspaceLibraryDuplicateDto[]>>;
  libraryMerge(request: WorkspaceLibraryMergeRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceLibraryMergeResponseDto>>;
  libraryKeyPreview(request: WorkspaceLibraryKeyPreviewRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceLibraryKeyPreviewDto>>;
  libraryRenameKey(request: WorkspaceLibraryRenameKeyRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceLibraryRenameKeyResponseDto>>;
  referenceHealth(request: WorkspaceReferenceHealthRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceReferenceHealthDto>>;
  referenceAttachments(request: WorkspaceReferenceAttachmentsRequest, signal?: AbortSignal): Promise<ProtocolResult<readonly WorkspaceReferenceAttachmentDto[]>>;
  attachReferencePdf(request: WorkspaceAttachReferencePdfRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceReferenceAttachmentDto>>;
  removeReferenceAttachment(request: WorkspaceReferenceAttachmentRequest, signal?: AbortSignal): Promise<ProtocolResult<undefined>>;
  referencePdf(request: WorkspaceReferenceAttachmentRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspaceReferencePdfDto>>;
  pdfAnnotations(request: WorkspaceReferenceAttachmentRequest, signal?: AbortSignal): Promise<ProtocolResult<readonly WorkspacePdfAnnotationDto[]>>;
  createPdfAnnotation(request: WorkspaceCreatePdfAnnotationRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspacePdfAnnotationDto>>;
  removePdfAnnotation(request: WorkspacePdfAnnotationRequest, signal?: AbortSignal): Promise<ProtocolResult<undefined>>;
  linkPdfAnnotation(request: WorkspacePdfAnnotationRequest, signal?: AbortSignal): Promise<ProtocolResult<WorkspacePdfAnnotationLinkDto>>;
  /** Apenas Main chama isto para abrir/revelar o PDF; nunca expor ao renderer. */
  referenceAttachmentLocalPath(request: WorkspaceReferenceAttachmentRequest, signal?: AbortSignal): Promise<ProtocolResult<string | undefined>>;
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

export type CompilerMethod = 'compiler/prepare' | 'compiler/compile';

export type WorkspaceMethod =
  | 'workspace/open'
  | 'workspace/list'
  | 'workspace/read'
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
  | 'workspace/backlinks'
  | 'workspace/references'
  | 'workspace/graph'
  | 'workspace/history'
  | 'workspace/history-create-snapshot'
  | 'workspace/history-diff'
  | 'workspace/history-structural-diff'
  | 'workspace/compare-documents'
  | 'workspace/create-literature-note'
  | 'workspace/citation-explorer'
  | 'workspace/research-overview'
  | 'workspace/library-list'
  | 'workspace/library-upsert'
  | 'workspace/library-remove'
  | 'workspace/library-format'
  | 'workspace/library-resolve-doi'
  | 'workspace/library-import'
  | 'workspace/library-duplicates'
  | 'workspace/library-merge'
  | 'workspace/library-key-preview'
  | 'workspace/library-rename-key'
  | 'workspace/reference-health'
  | 'workspace/reference-attachments'
  | 'workspace/attach-reference-pdf'
  | 'workspace/remove-reference-attachment'
  | 'workspace/reference-attachment-local-path'
  | 'workspace/reference-pdf'
  | 'workspace/pdf-annotations'
  | 'workspace/create-pdf-annotation'
  | 'workspace/remove-pdf-annotation'
  | 'workspace/link-pdf-annotation'
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
