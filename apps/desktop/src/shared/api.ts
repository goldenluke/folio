import {
  protocolError,
  validarDesktopEventDto,
  validarDesktopExportRequest,
  validarDesktopPluginExportRequest,
  validarDto,
  validarEditorCloseRequest,
  validarEditorDispatchRequest,
  validarEditorOpenRequest,
  validarEditorPreviewRequest,
  validarEditorResolveConflictRequest,
  validarEditorSaveRequest,
  validarEditorSnapshotRequest,
  validarEditorImportAssetRequest,
  validarWorkspaceImportAssetRequest,
  validarWorkspaceCreateDocumentRequest,
  validarWorkspaceRenameRequest,
  validarResultadoDoProtocolo,
  validarWorkspaceBacklinksRequest,
  validarWorkspaceReferencesRequest,
  validarWorkspaceGraphRequest,
  validarWorkspaceHistoryRequest,
  validarWorkspaceHistorySnapshotRequest,
  validarWorkspaceHistoryDiffRequest,
  validarWorkspaceDocumentComparisonRequest,
  validarWorkspaceCreateLiteratureNoteRequest,
  validarWorkspaceCitationExplorerRequest,
  validarWorkspaceResearchOverviewRequest,
  validarWorkspaceLibraryListRequest,
  validarWorkspaceLibraryUpsertRequest,
  validarWorkspaceLibraryRemoveRequest,
  validarWorkspaceLibraryFormatRequest,
  validarWorkspaceLibraryResolveDoiRequest,
  validarWorkspaceLibraryImportRequest,
  validarWorkspaceLibraryDuplicatesRequest,
  validarWorkspaceLibraryMergeRequest,
  validarWorkspaceLibraryKeyPreviewRequest,
  validarWorkspaceLibraryRenameKeyRequest,
  validarWorkspaceReferenceHealthRequest,
  validarWorkspaceReferenceAttachmentsRequest,
  validarWorkspaceReferenceAttachmentRequest,
  validarWorkspaceCreatePdfAnnotationRequest,
  validarWorkspacePdfAnnotationRequest,
  validarWorkspaceSearchRequest,
  validarWorkspaceProblemsRequest,
  validarWorkspacePluginSetEnabledRequest,
  validarWorkspacePluginCommandRequest,
  validarLanguageCompletionRequest,
  validarLanguageDefinitionRequest,
  validarLanguageHoverRequest,
  validarLanguageReferencesRequest,
  validarLanguageCrossReferenceTargetsRequest,
  validarLanguageUnlinkedMentionsRequest,
  validarLanguageWritingStatisticsRequest,
  validarLanguageRenameRequest,
  validarLanguageMoveSectionRequest,
  languageCrossReferenceTargetsResponseSchema,
  languageUnlinkedMentionsResponseSchema,
  languageWritingStatisticsResponseSchema,
  languageRenameResponseSchema,
  languageCompletionResponseSchema,
  languageHoverResponseSchema,
  languageLocationsResponseSchema,
  systemInformationDtoSchema,
  workspaceListResponseSchema,
  workspaceListRequestSchema,
  workspaceReadRequestSchema,
  workspaceReadResponseSchema,
  workspaceOpenRequestSchema,
  workspaceOpenResponseSchema,
  workspaceSearchResponseSchema,
  workspaceProblemsResponseSchema,
  workspacePluginsResponseSchema,
  workspacePluginCommandResponseSchema,
  workspaceBacklinksResponseSchema,
  workspaceReferencesResponseSchema,
  workspaceGraphResponseSchema,
  workspaceHistoryResponseSchema,
  workspaceHistoryRevisionSchema,
  workspaceHistoryDiffResponseSchema,
  workspaceHistoryStructuralDiffResponseSchema,
  workspaceDocumentComparisonResponseSchema,
  workspaceCreateLiteratureNoteResponseSchema,
  workspaceCitationExplorerResponseSchema,
  workspaceResearchOverviewResponseSchema,
  workspaceLibraryListResponseSchema,
  workspaceLibraryEntryResponseSchema,
  workspaceLibraryFormatResponseSchema,
  workspaceLibraryImportResponseSchema,
  workspaceLibraryDuplicatesResponseSchema,
  workspaceLibraryMergeResponseSchema,
  workspaceLibraryKeyPreviewResponseSchema,
  workspaceLibraryRenameKeyResponseSchema,
  workspaceReferenceHealthResponseSchema,
  workspaceReferenceAttachmentsResponseSchema,
  workspaceReferenceAttachmentDtoSchema,
  workspaceReferencePdfResponseSchema,
  workspacePdfAnnotationsResponseSchema,
  workspacePdfAnnotationDtoSchema,
  workspacePdfAnnotationLinkResponseSchema,
  editorExportResultDtoSchema,
  editorPreviewResponseSchema,
  editorSnapshotDtoSchema,
  workspaceAssetDtoSchema,
  workspaceFileDtoSchema,
  emptyResponseSchema,
  type DesktopEventDto,
  type DesktopExportRequest,
  type DesktopPluginExportRequest,
  type DtoSchema,
  type EditorCloseRequest,
  type EditorDispatchRequest,
  type EditorExportResultDto,
  type EditorOpenRequest,
  type EditorPreviewDto,
  type EditorPreviewRequest,
  type EditorResolveConflictRequest,
  type EditorSaveRequest,
  type EditorSnapshotDto,
  type EditorSnapshotRequest,
  type EditorImportAssetRequest,
  type WorkspaceAssetDto,
  type WorkspaceImportAssetRequest,
  type WorkspaceCreateDocumentRequest,
  type WorkspaceRenameRequest,
  type ProtocolResult,
  type LanguageCompletionDto,
  type LanguageCompletionRequest,
  type LanguageDefinitionRequest,
  type LanguageHoverDto,
  type LanguageHoverRequest,
  type LanguageLocationDto,
  type LanguageReferencesRequest,
  type LanguageCrossReferenceTargetsRequest,
  type LanguageCrossReferenceTargetDto,
  type LanguageUnlinkedMentionsRequest,
  type LanguageUnlinkedMentionDto,
  type LanguageWritingStatisticsRequest,
  type LanguageWritingStatisticsDto,
  type LanguageRenameRequest,
  type LanguageRenameResultDto,
  type LanguageMoveSectionRequest,
  type SystemInformationDto,
  type WorkspaceBacklinkDto,
  type WorkspaceBacklinksRequest,
  type WorkspaceFileDto,
  type WorkspaceGraphDto,
  type WorkspaceGraphRequest,
  type WorkspaceHistoryRequest,
  type WorkspaceHistoryDto,
  type WorkspaceHistorySnapshotRequest,
  type WorkspaceHistoryStructuralDiffDto,
  type WorkspaceHistoryRevisionDto,
  type WorkspaceHistoryDiffRequest,
  type WorkspaceHistoryDiffDto,
  type WorkspaceDocumentComparisonRequest,
  type WorkspaceDocumentComparisonDto,
  type WorkspacePluginDto,
  type WorkspacePluginSetEnabledRequest,
  type WorkspacePluginCommandRequest,
  type WorkspacePluginCommandResultDto,
  type WorkspaceCreateLiteratureNoteRequest,
  type WorkspaceCitationExplorerRequest,
  type WorkspaceCitationExplorerResponseDto,
  type WorkspaceResearchOverviewRequest,
  type WorkspaceResearchOverviewDto,
  type BibliographicEntityDto,
  type WorkspaceLibraryListRequest,
  type WorkspaceLibraryUpsertRequest,
  type WorkspaceLibraryRemoveRequest,
  type WorkspaceLibraryFormatRequest,
  type WorkspaceLibraryResolveDoiRequest,
  type WorkspaceLibraryImportRequest,
  type WorkspaceLibraryImportResponseDto,
  type WorkspaceLibraryDuplicateDto,
  type WorkspaceLibraryMergeRequest,
  type WorkspaceLibraryMergeResponseDto,
  type WorkspaceLibraryKeyPreviewRequest,
  type WorkspaceLibraryKeyPreviewDto,
  type WorkspaceLibraryRenameKeyRequest,
  type WorkspaceLibraryRenameKeyResponseDto,
  type WorkspaceReferenceHealthRequest,
  type WorkspaceReferenceHealthDto,
  type WorkspaceReferenceAttachmentsRequest,
  type WorkspaceReferenceAttachmentDto,
  type WorkspaceReferenceAttachmentRequest,
  type WorkspaceReferencePdfDto,
  type WorkspacePdfAnnotationDto,
  type WorkspaceCreatePdfAnnotationRequest,
  type WorkspacePdfAnnotationRequest,
  type WorkspacePdfAnnotationLinkDto,
  type WorkspaceListRequest,
  type WorkspaceOpenResponse,
  type WorkspaceOpenRequest,
  type WorkspaceReadRequest,
  type WorkspaceReadResponse,
  type WorkspaceReferenceDto,
  type WorkspaceReferencesRequest,
  type WorkspaceSearchRequest,
  type WorkspaceSearchResultDto,
  type WorkspaceProblemsRequest,
  type WorkspaceProblemDto,
} from '@abnt/protocol';

export const DESKTOP_CHANNELS = {
  systemInformation: 'abnt:application:system-information',
  newWindow: 'abnt:application:new-window',
  chooseWorkspace: 'abnt:workspace:choose-open',
  restoreWorkspace: 'abnt:workspace:restore-last',
  openWorkspace: 'abnt:workspace:open',
  listWorkspace: 'abnt:workspace:list',
  readDocument: 'abnt:document:read',
  openEditor: 'abnt:editor:open',
  snapshotEditor: 'abnt:editor:snapshot',
  dispatchEditor: 'abnt:editor:dispatch',
  saveEditor: 'abnt:editor:save',
  closeEditor: 'abnt:editor:close',
  previewEditor: 'abnt:editor:preview',
  resolveEditorConflict: 'abnt:editor:resolve-conflict',
  exportDocument: 'abnt:editor:export',
  exportPlugin: 'abnt:editor:export-plugin',
  importAsset: 'abnt:editor:import-asset',
  importAssetData: 'abnt:editor:import-asset-data',
  createDocument: 'abnt:workspace:create-document',
  renameDocument: 'abnt:workspace:rename-document',
  search: 'abnt:workspace:search',
  problems: 'abnt:workspace:problems',
  plugins: 'abnt:workspace:plugins',
  pluginSetEnabled: 'abnt:workspace:plugin-set-enabled',
  pluginsReload: 'abnt:workspace:plugins-reload',
  pluginCommand: 'abnt:workspace:plugin-command',
  graph: 'abnt:workspace:graph',
  history: 'abnt:workspace:history',
  historyCreateSnapshot: 'abnt:workspace:history-create-snapshot',
  historyDiff: 'abnt:workspace:history-diff',
  historyStructuralDiff: 'abnt:workspace:history-structural-diff',
  compareDocuments: 'abnt:workspace:compare-documents',
  backlinks: 'abnt:document:backlinks',
  references: 'abnt:document:references',
  createLiteratureNote: 'abnt:document:create-literature-note',
  citationExplorer: 'abnt:workspace:citation-explorer',
  researchOverview: 'abnt:workspace:research-overview',
  libraryList: 'abnt:library:list',
  libraryUpsert: 'abnt:library:upsert',
  libraryRemove: 'abnt:library:remove',
  libraryFormat: 'abnt:library:format',
  libraryResolveDoi: 'abnt:library:resolve-doi',
  libraryImport: 'abnt:library:import',
  libraryDuplicates: 'abnt:library:duplicates',
  libraryMerge: 'abnt:library:merge',
  libraryKeyPreview: 'abnt:library:key-preview',
  libraryRenameKey: 'abnt:library:rename-key',
  libraryAttachPdf: 'abnt:library:attach-pdf',
  libraryOpenAttachment: 'abnt:library:open-attachment',
  libraryRevealAttachment: 'abnt:library:reveal-attachment',
  libraryRemoveAttachment: 'abnt:library:remove-attachment',
  libraryReferencePdf: 'abnt:library:reference-pdf',
  libraryPdfAnnotations: 'abnt:library:pdf-annotations',
  libraryCreatePdfAnnotation: 'abnt:library:create-pdf-annotation',
  libraryRemovePdfAnnotation: 'abnt:library:remove-pdf-annotation',
  libraryLinkPdfAnnotation: 'abnt:library:link-pdf-annotation',
  referenceHealth: 'abnt:workspace:reference-health',
  referenceAttachments: 'abnt:workspace:reference-attachments',
  languageCompletions: 'abnt:language:completions',
  languageHover: 'abnt:language:hover',
  languageDefinition: 'abnt:language:definition',
  languageReferences: 'abnt:language:references',
  languageCrossReferenceTargets: 'abnt:language:cross-reference-targets',
  languageUnlinkedMentions: 'abnt:language:unlinked-mentions',
  languageWritingStatistics: 'abnt:language:writing-statistics',
  languageRenameSymbol: 'abnt:language:rename-symbol',
  languageMoveSection: 'abnt:language:move-section',
  event: 'abnt:desktop:event',
} as const;

export interface DesktopIpcBridge {
  invoke(channel: string, value?: unknown): Promise<unknown>;
  subscribe(channel: string, listener: (value: unknown) => void): () => void;
}

export interface AcademicDesktopApi {
  readonly application: {
    systemInformation(): Promise<ProtocolResult<SystemInformationDto>>;
    newWindow(): Promise<ProtocolResult<undefined>>;
  };
  readonly workspace: {
    chooseAndOpen(): Promise<ProtocolResult<WorkspaceOpenResponse>>;
    /** Reabre a última pasta escolhida pelo usuário; nunca expõe seu caminho ao renderer. */
    restoreLast(): Promise<ProtocolResult<WorkspaceOpenResponse>>;
    open(request: WorkspaceOpenRequest): Promise<ProtocolResult<WorkspaceOpenResponse>>;
    list(request: WorkspaceListRequest): Promise<ProtocolResult<readonly WorkspaceFileDto[]>>;
    search(request: WorkspaceSearchRequest): Promise<ProtocolResult<readonly WorkspaceSearchResultDto[]>>;
    problems(request: WorkspaceProblemsRequest): Promise<ProtocolResult<readonly WorkspaceProblemDto[]>>;
    plugins(): Promise<ProtocolResult<readonly WorkspacePluginDto[]>>;
    setPluginEnabled(request: WorkspacePluginSetEnabledRequest): Promise<ProtocolResult<readonly WorkspacePluginDto[]>>;
    reloadPlugins(): Promise<ProtocolResult<readonly WorkspacePluginDto[]>>;
    runPluginCommand(request: WorkspacePluginCommandRequest): Promise<ProtocolResult<WorkspacePluginCommandResultDto>>;
    graph(request: WorkspaceGraphRequest): Promise<ProtocolResult<WorkspaceGraphDto>>;
    history(request: WorkspaceHistoryRequest): Promise<ProtocolResult<WorkspaceHistoryDto>>;
    historyCreateSnapshot(request: WorkspaceHistorySnapshotRequest): Promise<ProtocolResult<WorkspaceHistoryRevisionDto>>;
    historyDiff(request: WorkspaceHistoryDiffRequest): Promise<ProtocolResult<WorkspaceHistoryDiffDto>>;
    historyStructuralDiff(request: WorkspaceHistoryDiffRequest): Promise<ProtocolResult<WorkspaceHistoryStructuralDiffDto>>;
    compareDocuments(request: WorkspaceDocumentComparisonRequest): Promise<ProtocolResult<WorkspaceDocumentComparisonDto>>;
    citationExplorer(request: WorkspaceCitationExplorerRequest): Promise<ProtocolResult<WorkspaceCitationExplorerResponseDto>>;
    researchOverview(request: WorkspaceResearchOverviewRequest): Promise<ProtocolResult<WorkspaceResearchOverviewDto>>;
    referenceHealth(request: WorkspaceReferenceHealthRequest): Promise<ProtocolResult<WorkspaceReferenceHealthDto>>;
    referenceAttachments(request: WorkspaceReferenceAttachmentsRequest): Promise<ProtocolResult<readonly WorkspaceReferenceAttachmentDto[]>>;
    createDocument(request: WorkspaceCreateDocumentRequest): Promise<ProtocolResult<WorkspaceFileDto>>;
    renameDocument(request: WorkspaceRenameRequest): Promise<ProtocolResult<WorkspaceFileDto>>;
  };
  readonly library: {
    list(request: WorkspaceLibraryListRequest): Promise<ProtocolResult<readonly BibliographicEntityDto[]>>;
    upsert(request: WorkspaceLibraryUpsertRequest): Promise<ProtocolResult<BibliographicEntityDto>>;
    remove(request: WorkspaceLibraryRemoveRequest): Promise<ProtocolResult<undefined>>;
    format(request: WorkspaceLibraryFormatRequest): Promise<ProtocolResult<string>>;
    resolveDoi(request: WorkspaceLibraryResolveDoiRequest): Promise<ProtocolResult<BibliographicEntityDto>>;
    import(request: WorkspaceLibraryImportRequest): Promise<ProtocolResult<WorkspaceLibraryImportResponseDto>>;
    duplicates(): Promise<ProtocolResult<readonly WorkspaceLibraryDuplicateDto[]>>;
    merge(request: WorkspaceLibraryMergeRequest): Promise<ProtocolResult<WorkspaceLibraryMergeResponseDto>>;
    keyPreview(request: WorkspaceLibraryKeyPreviewRequest): Promise<ProtocolResult<WorkspaceLibraryKeyPreviewDto>>;
    renameKey(request: WorkspaceLibraryRenameKeyRequest): Promise<ProtocolResult<WorkspaceLibraryRenameKeyResponseDto>>;
    attachPdf(request: WorkspaceReferenceAttachmentRequest): Promise<ProtocolResult<WorkspaceReferenceAttachmentDto>>;
    openAttachment(request: WorkspaceReferenceAttachmentRequest): Promise<ProtocolResult<undefined>>;
    revealAttachment(request: WorkspaceReferenceAttachmentRequest): Promise<ProtocolResult<undefined>>;
    removeAttachment(request: WorkspaceReferenceAttachmentRequest): Promise<ProtocolResult<undefined>>;
    pdf(request: WorkspaceReferenceAttachmentRequest): Promise<ProtocolResult<WorkspaceReferencePdfDto>>;
    pdfAnnotations(request: WorkspaceReferenceAttachmentRequest): Promise<ProtocolResult<readonly WorkspacePdfAnnotationDto[]>>;
    createPdfAnnotation(request: WorkspaceCreatePdfAnnotationRequest): Promise<ProtocolResult<WorkspacePdfAnnotationDto>>;
    removePdfAnnotation(request: WorkspacePdfAnnotationRequest): Promise<ProtocolResult<undefined>>;
    linkPdfAnnotation(request: WorkspacePdfAnnotationRequest): Promise<ProtocolResult<WorkspacePdfAnnotationLinkDto>>;
  };
  readonly documents: {
    read(request: WorkspaceReadRequest): Promise<ProtocolResult<WorkspaceReadResponse>>;
    backlinks(request: WorkspaceBacklinksRequest): Promise<ProtocolResult<readonly WorkspaceBacklinkDto[]>>;
    references(request: WorkspaceReferencesRequest): Promise<ProtocolResult<readonly WorkspaceReferenceDto[]>>;
    createLiteratureNote(request: WorkspaceCreateLiteratureNoteRequest): Promise<ProtocolResult<WorkspaceFileDto>>;
  };
  readonly editor: {
    open(request: EditorOpenRequest): Promise<ProtocolResult<EditorSnapshotDto>>;
    snapshot(request: EditorSnapshotRequest): Promise<ProtocolResult<EditorSnapshotDto>>;
    dispatch(request: EditorDispatchRequest): Promise<ProtocolResult<EditorSnapshotDto>>;
    save(request: EditorSaveRequest): Promise<ProtocolResult<EditorSnapshotDto>>;
    close(request: EditorCloseRequest): Promise<ProtocolResult<undefined>>;
    preview(request: EditorPreviewRequest): Promise<ProtocolResult<EditorPreviewDto | undefined>>;
    resolveConflict(request: EditorResolveConflictRequest): Promise<ProtocolResult<EditorSnapshotDto>>;
    /** Mostra o diálogo nativo de salvar; `CANCELLED` se o usuário desistir. */
    export(request: DesktopExportRequest): Promise<ProtocolResult<EditorExportResultDto>>;
    exportPlugin(request: DesktopPluginExportRequest): Promise<ProtocolResult<EditorExportResultDto>>;
    /** Abre o seletor nativo, copia o recurso para o vault e devolve URI relativa. */
    importAsset(request: EditorImportAssetRequest): Promise<ProtocolResult<WorkspaceAssetDto>>;
    importAssetData(request: WorkspaceImportAssetRequest): Promise<ProtocolResult<WorkspaceAssetDto>>;
  };
  readonly language: {
    completions(request: LanguageCompletionRequest): Promise<ProtocolResult<LanguageCompletionDto | undefined>>;
    hover(request: LanguageHoverRequest): Promise<ProtocolResult<LanguageHoverDto | undefined>>;
    definition(request: LanguageDefinitionRequest): Promise<ProtocolResult<readonly LanguageLocationDto[]>>;
    references(request: LanguageReferencesRequest): Promise<ProtocolResult<readonly LanguageLocationDto[]>>;
    crossReferenceTargets(request: LanguageCrossReferenceTargetsRequest): Promise<ProtocolResult<readonly LanguageCrossReferenceTargetDto[]>>;
    unlinkedMentions(request: LanguageUnlinkedMentionsRequest): Promise<ProtocolResult<readonly LanguageUnlinkedMentionDto[]>>;
    writingStatistics(request: LanguageWritingStatisticsRequest): Promise<ProtocolResult<LanguageWritingStatisticsDto>>;
    renameSymbol(request: LanguageRenameRequest): Promise<ProtocolResult<LanguageRenameResultDto | undefined>>;
    moveSection(request: LanguageMoveSectionRequest): Promise<ProtocolResult<LanguageRenameResultDto | undefined>>;
  };
  onEvent(listener: (event: DesktopEventDto) => void): () => void;
}

const invoke = async <T>(
  bridge: DesktopIpcBridge,
  channel: string,
  value: unknown,
  schema: DtoSchema<T>,
): Promise<ProtocolResult<T>> => {
  try {
    const result = await bridge.invoke(channel, value);
    const checked = validarResultadoDoProtocolo(result, schema);
    return checked.ok ? checked.value : checked;
  } catch {
    return protocolError('INTERNAL', 'O shell desktop não respondeu à solicitação.');
  }
};

/** API que o preload entrega ao renderer; não carrega nomes de canais para a UI. */
export function createAcademicDesktopApi(bridge: DesktopIpcBridge): AcademicDesktopApi {
  return {
    application: {
      systemInformation: () => invoke(bridge, DESKTOP_CHANNELS.systemInformation, undefined, systemInformationDtoSchema),
      newWindow: () => invoke(bridge, DESKTOP_CHANNELS.newWindow, undefined, emptyResponseSchema),
    },
    workspace: {
      chooseAndOpen: () => invoke(bridge, DESKTOP_CHANNELS.chooseWorkspace, undefined, workspaceOpenResponseSchema),
      restoreLast: () => invoke(bridge, DESKTOP_CHANNELS.restoreWorkspace, undefined, workspaceOpenResponseSchema),
      open: async (request) => {
        const checked = validarDto(workspaceOpenRequestSchema, request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.openWorkspace, checked.value, workspaceOpenResponseSchema) : checked;
      },
      list: async (request) => {
        const checked = validarDto(workspaceListRequestSchema, request);
        return checked.ok
          ? invoke(bridge, DESKTOP_CHANNELS.listWorkspace, checked.value, workspaceListResponseSchema)
          : checked;
      },
      search: async (request) => {
        const checked = validarWorkspaceSearchRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.search, checked.value, workspaceSearchResponseSchema) : checked;
      },
      problems: async (request) => {
        const checked = validarWorkspaceProblemsRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.problems, checked.value, workspaceProblemsResponseSchema) : checked;
      },
      plugins: () => invoke(bridge, DESKTOP_CHANNELS.plugins, undefined, workspacePluginsResponseSchema),
      setPluginEnabled: async (request) => { const checked = validarWorkspacePluginSetEnabledRequest(request); return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.pluginSetEnabled, checked.value, workspacePluginsResponseSchema) : checked; },
      reloadPlugins: () => invoke(bridge, DESKTOP_CHANNELS.pluginsReload, undefined, workspacePluginsResponseSchema),
      runPluginCommand: async (request) => { const checked = validarWorkspacePluginCommandRequest(request); return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.pluginCommand, checked.value, workspacePluginCommandResponseSchema) : checked; },
      graph: async (request) => {
        const checked = validarWorkspaceGraphRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.graph, checked.value, workspaceGraphResponseSchema) : checked;
      },
      history: async (request) => { const checked = validarWorkspaceHistoryRequest(request); return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.history, checked.value, workspaceHistoryResponseSchema) : checked; },
      historyCreateSnapshot: async (request) => { const checked = validarWorkspaceHistorySnapshotRequest(request); return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.historyCreateSnapshot, checked.value, workspaceHistoryRevisionSchema) : checked; },
      historyDiff: async (request) => { const checked = validarWorkspaceHistoryDiffRequest(request); return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.historyDiff, checked.value, workspaceHistoryDiffResponseSchema) : checked; },
      historyStructuralDiff: async (request) => { const checked = validarWorkspaceHistoryDiffRequest(request); return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.historyStructuralDiff, checked.value, workspaceHistoryStructuralDiffResponseSchema) : checked; },
      compareDocuments: async (request) => { const checked = validarWorkspaceDocumentComparisonRequest(request); return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.compareDocuments, checked.value, workspaceDocumentComparisonResponseSchema) : checked; },
      citationExplorer: async (request) => {
        const checked = validarWorkspaceCitationExplorerRequest(request);
        return checked.ok
          ? invoke(bridge, DESKTOP_CHANNELS.citationExplorer, checked.value, workspaceCitationExplorerResponseSchema)
          : checked;
      },
      researchOverview: async (request) => {
        const checked = validarWorkspaceResearchOverviewRequest(request);
        return checked.ok
          ? invoke(bridge, DESKTOP_CHANNELS.researchOverview, checked.value, workspaceResearchOverviewResponseSchema)
          : checked;
      },
      referenceHealth: async (request) => {
        const checked = validarWorkspaceReferenceHealthRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.referenceHealth, checked.value, workspaceReferenceHealthResponseSchema) : checked;
      },
      referenceAttachments: async (request) => {
        const checked = validarWorkspaceReferenceAttachmentsRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.referenceAttachments, checked.value, workspaceReferenceAttachmentsResponseSchema) : checked;
      },
      createDocument: async (request) => {
        const checked = validarWorkspaceCreateDocumentRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.createDocument, checked.value, workspaceFileDtoSchema) : checked;
      },
      renameDocument: async (request) => {
        const checked = validarWorkspaceRenameRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.renameDocument, checked.value, workspaceFileDtoSchema) : checked;
      },
    },
    library: {
      list: async (request) => {
        const checked = validarWorkspaceLibraryListRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.libraryList, checked.value, workspaceLibraryListResponseSchema) : checked;
      },
      upsert: async (request) => {
        const checked = validarWorkspaceLibraryUpsertRequest(request);
        return checked.ok
          ? invoke(bridge, DESKTOP_CHANNELS.libraryUpsert, checked.value, workspaceLibraryEntryResponseSchema)
          : checked;
      },
      remove: async (request) => {
        const checked = validarWorkspaceLibraryRemoveRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.libraryRemove, checked.value, emptyResponseSchema) : checked;
      },
      format: async (request) => {
        const checked = validarWorkspaceLibraryFormatRequest(request);
        return checked.ok
          ? invoke(bridge, DESKTOP_CHANNELS.libraryFormat, checked.value, workspaceLibraryFormatResponseSchema)
          : checked;
      },
      resolveDoi: async (request) => {
        const checked = validarWorkspaceLibraryResolveDoiRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.libraryResolveDoi, checked.value, workspaceLibraryEntryResponseSchema) : checked;
      },
      import: async (request) => {
        const checked = validarWorkspaceLibraryImportRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.libraryImport, checked.value, workspaceLibraryImportResponseSchema) : checked;
      },
      duplicates: async () => {
        const checked = validarWorkspaceLibraryDuplicatesRequest({});
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.libraryDuplicates, checked.value, workspaceLibraryDuplicatesResponseSchema) : checked;
      },
      merge: async (request) => {
        const checked = validarWorkspaceLibraryMergeRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.libraryMerge, checked.value, workspaceLibraryMergeResponseSchema) : checked;
      },
      keyPreview: async (request) => {
        const checked = validarWorkspaceLibraryKeyPreviewRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.libraryKeyPreview, checked.value, workspaceLibraryKeyPreviewResponseSchema) : checked;
      },
      renameKey: async (request) => {
        const checked = validarWorkspaceLibraryRenameKeyRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.libraryRenameKey, checked.value, workspaceLibraryRenameKeyResponseSchema) : checked;
      },
      attachPdf: async (request) => { const checked=validarWorkspaceReferenceAttachmentRequest(request); return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.libraryAttachPdf, checked.value, workspaceReferenceAttachmentDtoSchema) : checked; },
      openAttachment: async (request) => { const checked=validarWorkspaceReferenceAttachmentRequest(request); return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.libraryOpenAttachment, checked.value, emptyResponseSchema) : checked; },
      revealAttachment: async (request) => { const checked=validarWorkspaceReferenceAttachmentRequest(request); return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.libraryRevealAttachment, checked.value, emptyResponseSchema) : checked; },
      removeAttachment: async (request) => { const checked=validarWorkspaceReferenceAttachmentRequest(request); return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.libraryRemoveAttachment, checked.value, emptyResponseSchema) : checked; },
      pdf: async (request) => { const checked=validarWorkspaceReferenceAttachmentRequest(request); return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.libraryReferencePdf, checked.value, workspaceReferencePdfResponseSchema) : checked; },
      pdfAnnotations: async (request) => { const checked=validarWorkspaceReferenceAttachmentRequest(request); return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.libraryPdfAnnotations, checked.value, workspacePdfAnnotationsResponseSchema) : checked; },
      createPdfAnnotation: async (request) => { const checked=validarWorkspaceCreatePdfAnnotationRequest(request); return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.libraryCreatePdfAnnotation, checked.value, workspacePdfAnnotationDtoSchema) : checked; },
      removePdfAnnotation: async (request) => { const checked=validarWorkspacePdfAnnotationRequest(request); return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.libraryRemovePdfAnnotation, checked.value, emptyResponseSchema) : checked; },
      linkPdfAnnotation: async (request) => { const checked=validarWorkspacePdfAnnotationRequest(request); return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.libraryLinkPdfAnnotation, checked.value, workspacePdfAnnotationLinkResponseSchema) : checked; },
    },
    documents: {
      read: async (request) => {
        const checked = validarDto(workspaceReadRequestSchema, request);
        return checked.ok
          ? invoke(bridge, DESKTOP_CHANNELS.readDocument, checked.value, workspaceReadResponseSchema)
          : checked;
      },
      backlinks: async (request) => {
        const checked = validarWorkspaceBacklinksRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.backlinks, checked.value, workspaceBacklinksResponseSchema) : checked;
      },
      references: async (request) => {
        const checked = validarWorkspaceReferencesRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.references, checked.value, workspaceReferencesResponseSchema) : checked;
      },
      createLiteratureNote: async (request) => {
        const checked = validarWorkspaceCreateLiteratureNoteRequest(request);
        return checked.ok
          ? invoke(bridge, DESKTOP_CHANNELS.createLiteratureNote, checked.value, workspaceCreateLiteratureNoteResponseSchema)
          : checked;
      },
    },
    editor: {
      open: async (request) => {
        const checked = validarEditorOpenRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.openEditor, checked.value, editorSnapshotDtoSchema) : checked;
      },
      snapshot: async (request) => {
        const checked = validarEditorSnapshotRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.snapshotEditor, checked.value, editorSnapshotDtoSchema) : checked;
      },
      dispatch: async (request) => {
        const checked = validarEditorDispatchRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.dispatchEditor, checked.value, editorSnapshotDtoSchema) : checked;
      },
      save: async (request) => {
        const checked = validarEditorSaveRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.saveEditor, checked.value, editorSnapshotDtoSchema) : checked;
      },
      close: async (request) => {
        const checked = validarEditorCloseRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.closeEditor, checked.value, emptyResponseSchema) : checked;
      },
      preview: async (request) => {
        const checked = validarEditorPreviewRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.previewEditor, checked.value, editorPreviewResponseSchema) : checked;
      },
      resolveConflict: async (request) => {
        const checked = validarEditorResolveConflictRequest(request);
        return checked.ok
          ? invoke(bridge, DESKTOP_CHANNELS.resolveEditorConflict, checked.value, editorSnapshotDtoSchema)
          : checked;
      },
      export: async (request) => {
        const checked = validarDesktopExportRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.exportDocument, checked.value, editorExportResultDtoSchema) : checked;
      },
      exportPlugin: async (request) => {
        const checked = validarDesktopPluginExportRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.exportPlugin, checked.value, editorExportResultDtoSchema) : checked;
      },
      importAsset: async (request) => {
        const checked = validarEditorImportAssetRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.importAsset, checked.value, workspaceAssetDtoSchema) : checked;
      },
      importAssetData: async (request) => {
        const checked = validarWorkspaceImportAssetRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.importAssetData, checked.value, workspaceAssetDtoSchema) : checked;
      },
    },
    language: {
      completions: async (request) => {
        const checked = validarLanguageCompletionRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.languageCompletions, checked.value, languageCompletionResponseSchema) : checked;
      },
      hover: async (request) => {
        const checked = validarLanguageHoverRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.languageHover, checked.value, languageHoverResponseSchema) : checked;
      },
      definition: async (request) => {
        const checked = validarLanguageDefinitionRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.languageDefinition, checked.value, languageLocationsResponseSchema) : checked;
      },
      references: async (request) => {
        const checked = validarLanguageReferencesRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.languageReferences, checked.value, languageLocationsResponseSchema) : checked;
      },
      crossReferenceTargets: async (request) => {
        const checked = validarLanguageCrossReferenceTargetsRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.languageCrossReferenceTargets, checked.value, languageCrossReferenceTargetsResponseSchema) : checked;
      },
      unlinkedMentions: async (request) => {
        const checked = validarLanguageUnlinkedMentionsRequest(request);
        return checked.ok
          ? invoke(bridge, DESKTOP_CHANNELS.languageUnlinkedMentions, checked.value, languageUnlinkedMentionsResponseSchema)
          : checked;
      },
      writingStatistics: async (request) => {
        const checked = validarLanguageWritingStatisticsRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.languageWritingStatistics, checked.value, languageWritingStatisticsResponseSchema) : checked;
      },
      renameSymbol: async (request) => {
        const checked = validarLanguageRenameRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.languageRenameSymbol, checked.value, languageRenameResponseSchema) : checked;
      },
      moveSection: async (request) => {
        const checked = validarLanguageMoveSectionRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.languageMoveSection, checked.value, languageRenameResponseSchema) : checked;
      },
    },
    onEvent(listener) {
      return bridge.subscribe(DESKTOP_CHANNELS.event, (value) => {
        const checked = validarDesktopEventDto(value);
        if (checked.ok) listener(checked.value);
      });
    },
  };
}
