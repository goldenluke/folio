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
  validarWorkspaceProjectDashboardRequest,
  validarWorkspaceLibraryListRequest,
  validarWorkspaceLibraryUpsertRequest,
  validarWorkspaceLibraryRemoveRequest,
  validarWorkspaceLibraryFormatRequest,
  validarWorkspaceLibraryResolveDoiRequest,
  validarWorkspaceWebCaptureExtractRequest,
  validarWorkspaceLibraryImportRequest,
  validarWorkspaceLibraryIntakePreviewRequest,
  validarWorkspaceLibraryDuplicatesRequest,
  validarWorkspaceLibraryMergeRequest,
  validarWorkspaceLibraryKeyPreviewRequest,
  validarWorkspaceLibraryRenameKeyRequest,
  validarWorkspaceReferenceHealthRequest,
  validarWorkspaceLibraryMaintenanceRequest,
  validarWorkspaceReferenceRelationsRequest,
  validarWorkspaceAddReferenceRelationRequest,
  validarWorkspaceRemoveReferenceRelationRequest,
  validarWorkspaceAnnotationsRequest,
  validarWorkspaceSetAnnotationColorSemanticsRequest,
  validarWorkspaceSynthesizeAnnotationsRequest,
  validarWorkspaceAddLiteratureSubscriptionRequest,
  validarWorkspaceRemoveLiteratureSubscriptionRequest,
  validarWorkspacePollLiteratureSubscriptionRequest,
  validarWorkspaceDismissFeedInboxItemRequest,
  validarWorkspaceImportFeedInboxItemRequest,
  validarWorkspaceReferenceAttachmentsRequest,
  validarWorkspaceReferenceAttachmentRequest,
  validarWorkspaceCreatePdfAnnotationRequest,
  validarWorkspacePdfAnnotationRequest,
  validarWorkspaceAttachmentsRequest,
  validarWorkspaceAddAttachmentRequest,
  validarWorkspacePickAttachmentRequest,
  validarWorkspaceAddAttachmentVersionRequest,
  validarWorkspaceAttachmentRequest,
  validarWorkspaceRenameAttachmentFileRequest,
  validarWorkspaceAttachmentHealthRequest,
  validarWorkspaceSearchRequest,
  validarWorkspaceProblemsRequest,
  validarWorkspaceProfileValidationPreviewRequest,
  validarWorkspacePluginSetEnabledRequest,
  validarWorkspacePluginCommandRequest,
  workspaceAcademicViewsResponseSchema,
  workspaceAcademicRelationsResponseSchema,
  referenceRelationDtoSchema,
  workspaceReferenceRelationsResponseSchema,
  workspaceAnnotationColorSemanticsResponseSchema,
  workspaceSynthesizeAnnotationsResponseSchema,
  literatureSubscriptionDtoSchema,
  workspaceLiteratureSubscriptionsResponseSchema,
  workspaceLiteratureFeedInboxResponseSchema,
  workspacePollLiteratureSubscriptionResponseSchema,
  workspaceBookmarksResponseSchema,
  workspaceSetBookmarksRequestSchema,
  workspaceCaptureInboxResponseSchema,
  workspaceSetCaptureInboxRequestSchema,
  workspaceResearchCanvasesResponseSchema,
  workspaceSetResearchCanvasesRequestSchema,
  workspacePeekRequestSchema,
  workspaceJournalOpenRequestSchema,
  workspaceJournalCaptureRequestSchema,
  workspacePeekResponseSchema,
  workspaceSetAcademicViewsRequestSchema,
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
  workspaceSyncStatusResponseSchema,
  workspaceCollaborationResponseSchema,
  workspaceSetCollaborationRequestSchema,
  workspaceResolveSyncConflictRequestSchema,
  workspaceSearchResponseSchema,
  workspaceProblemsResponseSchema,
  workspaceProfilesResponseSchema,
  workspaceProfileValidationPreviewResponseSchema,
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
  workspaceProjectDashboardResponseSchema,
  workspaceLibraryListResponseSchema,
  workspaceLibraryEntryResponseSchema,
  workspaceWebCaptureExtractResponseSchema,
  workspaceLibraryFormatResponseSchema,
  workspaceLibraryImportResponseSchema,
  workspaceLibraryIntakePreviewResponseSchema,
  workspaceLibraryDuplicatesResponseSchema,
  workspaceLibraryMergeResponseSchema,
  workspaceLibraryKeyPreviewResponseSchema,
  workspaceLibraryRenameKeyResponseSchema,
  workspaceReferenceHealthResponseSchema,
  workspaceLibraryMaintenanceResponseSchema,
  workspaceReferenceAttachmentsResponseSchema,
  workspaceReferenceAttachmentDtoSchema,
  workspaceAttachmentsResponseSchema,
  workspaceAttachmentResponseSchema,
  workspaceAttachmentHealthResponseSchema,
  workspaceAttachReferencePdfRequestSchema,
  workspaceReferencePdfResponseSchema,
  workspacePdfAnnotationsResponseSchema,
  workspacePdfAnnotationDtoSchema,
  workspacePdfAnnotationLinkResponseSchema,
  editorExportResultDtoSchema,
  editorPreviewResponseSchema,
  editorSnapshotDtoSchema,
  workspaceAssetDtoSchema,
  workspaceAssetPreviewRequestSchema,
  workspaceAssetPreviewResponseSchema,
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
  type WorkspaceAssetPreviewRequest,
  type WorkspaceAssetPreviewResponse,
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
  type WorkspaceProjectDashboardRequest,
  type WorkspaceProjectDashboardDto,
  type BibliographicEntityDto,
  type WorkspaceLibraryListRequest,
  type WorkspaceLibraryUpsertRequest,
  type WorkspaceLibraryRemoveRequest,
  type WorkspaceLibraryFormatRequest,
  type WorkspaceLibraryResolveDoiRequest,
  type WorkspaceWebCaptureExtractRequest,
  type WorkspaceWebCaptureExtractResponseDto,
  type WorkspaceLibraryImportRequest,
  type WorkspaceLibraryImportResponseDto,
  type WorkspaceLibraryIntakePreviewRequest,
  type WorkspaceLibraryIntakePreviewDto,
  type WorkspaceLibraryDuplicateDto,
  type WorkspaceLibraryMergeRequest,
  type WorkspaceLibraryMergeResponseDto,
  type WorkspaceLibraryKeyPreviewRequest,
  type WorkspaceLibraryKeyPreviewDto,
  type WorkspaceLibraryRenameKeyRequest,
  type WorkspaceLibraryRenameKeyResponseDto,
  type WorkspaceReferenceHealthRequest,
  type WorkspaceReferenceHealthDto,
  type WorkspaceLibraryMaintenanceRequest,
  type WorkspaceLibraryMaintenanceOverviewDto,
  type WorkspaceReferenceAttachmentsRequest,
  type WorkspaceReferenceAttachmentDto,
  type WorkspaceAttachReferencePdfRequest,
  type WorkspaceReferenceAttachmentRequest,
  type WorkspaceReferencePdfDto,
  type WorkspacePdfAnnotationDto,
  type WorkspaceCreatePdfAnnotationRequest,
  type WorkspacePdfAnnotationRequest,
  type WorkspacePdfAnnotationLinkDto,
  type AttachmentDto,
  type AttachmentHealthIssueDto,
  type WorkspaceAttachmentsRequest,
  type WorkspaceAddAttachmentRequest,
  type WorkspacePickAttachmentRequest,
  type WorkspaceAddAttachmentVersionRequest,
  type WorkspaceAttachmentRequest,
  type WorkspaceRenameAttachmentFileRequest,
  type WorkspaceListRequest,
  type WorkspaceOpenResponse,
  type WorkspaceOpenRequest,
  type WorkspaceSyncStatusDto,
  type WorkspaceCollaborationDto,
  type WorkspaceSetCollaborationRequest,
  type WorkspaceAcademicViewsDto,
  type WorkspaceSetAcademicViewsRequest,
  type WorkspaceAcademicRelationsDto,
  type ReferenceRelationDto,
  type WorkspaceReferenceRelationsRequest,
  type WorkspaceReferenceRelationsDto,
  type WorkspaceAddReferenceRelationRequest,
  type WorkspaceRemoveReferenceRelationRequest,
  type WorkspaceAnnotationsRequest,
  type WorkspaceAnnotationColorSemanticsDto,
  type WorkspaceSetAnnotationColorSemanticsRequest,
  type WorkspaceSynthesizeAnnotationsRequest,
  type WorkspaceSynthesizeAnnotationsResponseDto,
  type LiteratureSubscriptionDto,
  type WorkspaceLiteratureSubscriptionsDto,
  type WorkspaceLiteratureFeedInboxDto,
  type WorkspaceAddLiteratureSubscriptionRequest,
  type WorkspaceRemoveLiteratureSubscriptionRequest,
  type WorkspacePollLiteratureSubscriptionRequest,
  type WorkspacePollLiteratureSubscriptionResponseDto,
  type WorkspaceDismissFeedInboxItemRequest,
  type WorkspaceImportFeedInboxItemRequest,
  type WorkspaceBookmarksDto,
  type WorkspaceSetBookmarksRequest,
  type WorkspaceCaptureInboxDto,
  type WorkspaceSetCaptureInboxRequest,
  type WorkspaceResearchCanvasesDto,
  type WorkspaceSetResearchCanvasesRequest,
  type WorkspacePeekRequest,
  type WorkspaceJournalOpenRequest,
  type WorkspaceJournalCaptureRequest,
  type WorkspacePeekResponseDto,
  type WorkspaceResolveSyncConflictRequest,
  type WorkspaceReadRequest,
  type WorkspaceReadResponse,
  type WorkspaceReferenceDto,
  type WorkspaceReferencesRequest,
  type WorkspaceSearchRequest,
  type WorkspaceSearchResultDto,
  type WorkspaceProblemsRequest,
  type WorkspaceProblemDto,
  type WorkspaceProfileManifestDto,
  type WorkspaceProfileValidationPreviewRequest,
  type WorkspaceProfileValidationPreviewDto,
} from '@abnt/protocol';

export const DESKTOP_CHANNELS = {
  systemInformation: 'abnt:application:system-information',
  newWindow: 'abnt:application:new-window',
  chooseWorkspace: 'abnt:workspace:choose-open',
  restoreWorkspace: 'abnt:workspace:restore-last',
  openWorkspace: 'abnt:workspace:open',
  chooseSyncMirror: 'abnt:workspace:choose-sync-mirror',
  syncStatus: 'abnt:workspace:sync-status',
  syncNow: 'abnt:workspace:sync-now',
  syncRecover: 'abnt:workspace:sync-recover',
  syncResolveConflict: 'abnt:workspace:sync-resolve-conflict',
  collaboration: 'abnt:workspace:collaboration',
  setCollaboration: 'abnt:workspace:set-collaboration',
  academicViews: 'abnt:workspace:academic-views',
  setAcademicViews: 'abnt:workspace:set-academic-views',
  academicRelations: 'abnt:workspace:academic-relations',
  referenceRelations: 'abnt:workspace:reference-relations',
  addReferenceRelation: 'abnt:workspace:add-reference-relation',
  removeReferenceRelation: 'abnt:workspace:remove-reference-relation',
  annotations: 'abnt:workspace:annotations',
  annotationColorSemantics: 'abnt:workspace:annotation-color-semantics',
  setAnnotationColorSemantics: 'abnt:workspace:set-annotation-color-semantics',
  synthesizeAnnotations: 'abnt:workspace:synthesize-annotations',
  literatureSubscriptions: 'abnt:workspace:literature-subscriptions',
  addLiteratureSubscription: 'abnt:workspace:add-literature-subscription',
  removeLiteratureSubscription: 'abnt:workspace:remove-literature-subscription',
  literatureFeedInbox: 'abnt:workspace:literature-feed-inbox',
  pollLiteratureSubscription: 'abnt:workspace:poll-literature-subscription',
  dismissFeedInboxItem: 'abnt:workspace:dismiss-feed-inbox-item',
  importFeedInboxItem: 'abnt:workspace:import-feed-inbox-item',
  bookmarks: 'abnt:workspace:bookmarks',
  setBookmarks: 'abnt:workspace:set-bookmarks',
  captureInbox: 'abnt:workspace:capture-inbox',
  setCaptureInbox: 'abnt:workspace:set-capture-inbox',
  researchCanvases: 'abnt:workspace:research-canvases',
  setResearchCanvases: 'abnt:workspace:set-research-canvases',
  peek: 'abnt:workspace:peek',
  journalOpen: 'abnt:workspace:journal-open',
  journalCapture: 'abnt:workspace:journal-capture',
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
  assetPreview: 'abnt:editor:asset-preview',
  createDocument: 'abnt:workspace:create-document',
  renameDocument: 'abnt:workspace:rename-document',
  search: 'abnt:workspace:search',
  problems: 'abnt:workspace:problems',
  profiles: 'abnt:workspace:profiles',
  profileValidationPreview: 'abnt:workspace:profile-validation-preview',
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
  projectDashboard: 'abnt:workspace:project-dashboard',
  libraryList: 'abnt:library:list',
  libraryUpsert: 'abnt:library:upsert',
  libraryRemove: 'abnt:library:remove',
  libraryFormat: 'abnt:library:format',
  libraryResolveDoi: 'abnt:library:resolve-doi',
  webCaptureExtract: 'abnt:library:web-capture-extract',
  libraryImport: 'abnt:library:import',
  libraryIntakePreview: 'abnt:library:intake-preview',
  libraryDuplicates: 'abnt:library:duplicates',
  libraryMerge: 'abnt:library:merge',
  libraryKeyPreview: 'abnt:library:key-preview',
  libraryRenameKey: 'abnt:library:rename-key',
  libraryAttachPdf: 'abnt:library:attach-pdf',
  libraryAttachPdfData: 'abnt:library:attach-pdf-data',
  libraryOpenAttachment: 'abnt:library:open-attachment',
  libraryRevealAttachment: 'abnt:library:reveal-attachment',
  libraryRemoveAttachment: 'abnt:library:remove-attachment',
  libraryReferencePdf: 'abnt:library:reference-pdf',
  libraryPdfAnnotations: 'abnt:library:pdf-annotations',
  libraryCreatePdfAnnotation: 'abnt:library:create-pdf-annotation',
  libraryRemovePdfAnnotation: 'abnt:library:remove-pdf-annotation',
  libraryLinkPdfAnnotation: 'abnt:library:link-pdf-annotation',
  referenceHealth: 'abnt:workspace:reference-health',
  libraryMaintenanceOverview: 'abnt:workspace:library-maintenance-overview',
  referenceAttachments: 'abnt:workspace:reference-attachments',
  attachments: 'abnt:workspace:attachments',
  addAttachment: 'abnt:workspace:add-attachment',
  pickAndAddAttachment: 'abnt:workspace:pick-and-add-attachment',
  addAttachmentVersion: 'abnt:workspace:add-attachment-version',
  pickAndAddAttachmentVersion: 'abnt:workspace:pick-and-add-attachment-version',
  removeAttachment: 'abnt:workspace:remove-attachment',
  renameAttachmentFile: 'abnt:workspace:rename-attachment-file',
  openAttachmentFile: 'abnt:workspace:open-attachment-file',
  revealAttachmentFile: 'abnt:workspace:reveal-attachment-file',
  attachmentHealth: 'abnt:workspace:attachment-health',
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
    /** Abre o seletor nativo; o caminho da pasta permanece fora do renderer. */
    chooseSyncMirror(): Promise<ProtocolResult<WorkspaceSyncStatusDto>>;
    syncStatus(): Promise<ProtocolResult<WorkspaceSyncStatusDto>>;
    syncNow(): Promise<ProtocolResult<WorkspaceSyncStatusDto>>;
    recoverFromSync(): Promise<ProtocolResult<WorkspaceSyncStatusDto>>;
    resolveSyncConflict(request: WorkspaceResolveSyncConflictRequest): Promise<ProtocolResult<WorkspaceSyncStatusDto>>;
    collaboration(): Promise<ProtocolResult<WorkspaceCollaborationDto>>;
    setCollaboration(request: WorkspaceSetCollaborationRequest): Promise<ProtocolResult<WorkspaceCollaborationDto>>;
    academicViews(): Promise<ProtocolResult<WorkspaceAcademicViewsDto>>;
    setAcademicViews(request: WorkspaceSetAcademicViewsRequest): Promise<ProtocolResult<WorkspaceAcademicViewsDto>>;
    academicRelations(): Promise<ProtocolResult<WorkspaceAcademicRelationsDto>>;
    /** Onda BJ: relação explícita entre duas referências — nunca substitui merge de duplicata. */
    referenceRelations(request: WorkspaceReferenceRelationsRequest): Promise<ProtocolResult<WorkspaceReferenceRelationsDto>>;
    addReferenceRelation(request: WorkspaceAddReferenceRelationRequest): Promise<ProtocolResult<ReferenceRelationDto>>;
    removeReferenceRelation(request: WorkspaceRemoveReferenceRelationRequest): Promise<ProtocolResult<undefined>>;
    /** Onda BL: anotações do vault inteiro (ou de uma referência, se informada). */
    annotations(request: WorkspaceAnnotationsRequest): Promise<ProtocolResult<readonly WorkspacePdfAnnotationDto[]>>;
    annotationColorSemantics(): Promise<ProtocolResult<WorkspaceAnnotationColorSemanticsDto>>;
    setAnnotationColorSemantics(request: WorkspaceSetAnnotationColorSemanticsRequest): Promise<ProtocolResult<WorkspaceAnnotationColorSemanticsDto>>;
    synthesizeAnnotations(request: WorkspaceSynthesizeAnnotationsRequest): Promise<ProtocolResult<WorkspaceSynthesizeAnnotationsResponseDto>>;
    /** Onda BM: feed nunca entra automaticamente na biblioteca — só `importFeedInboxItem` cria uma entrada. */
    literatureSubscriptions(): Promise<ProtocolResult<WorkspaceLiteratureSubscriptionsDto>>;
    addLiteratureSubscription(request: WorkspaceAddLiteratureSubscriptionRequest): Promise<ProtocolResult<LiteratureSubscriptionDto>>;
    removeLiteratureSubscription(request: WorkspaceRemoveLiteratureSubscriptionRequest): Promise<ProtocolResult<undefined>>;
    literatureFeedInbox(): Promise<ProtocolResult<WorkspaceLiteratureFeedInboxDto>>;
    pollLiteratureSubscription(request: WorkspacePollLiteratureSubscriptionRequest): Promise<ProtocolResult<WorkspacePollLiteratureSubscriptionResponseDto>>;
    dismissFeedInboxItem(request: WorkspaceDismissFeedInboxItemRequest): Promise<ProtocolResult<undefined>>;
    importFeedInboxItem(request: WorkspaceImportFeedInboxItemRequest): Promise<ProtocolResult<BibliographicEntityDto>>;
    /** Onda BN: registry de extractors sobre uma página já publicada — nunca persiste nada sozinho. */
    webCaptureExtract(request: WorkspaceWebCaptureExtractRequest): Promise<ProtocolResult<WorkspaceWebCaptureExtractResponseDto>>;
    bookmarks(): Promise<ProtocolResult<WorkspaceBookmarksDto>>;
    setBookmarks(request: WorkspaceSetBookmarksRequest): Promise<ProtocolResult<WorkspaceBookmarksDto>>;
    captureInbox(): Promise<ProtocolResult<WorkspaceCaptureInboxDto>>;
    setCaptureInbox(request: WorkspaceSetCaptureInboxRequest): Promise<ProtocolResult<WorkspaceCaptureInboxDto>>;
    researchCanvases(): Promise<ProtocolResult<WorkspaceResearchCanvasesDto>>;
    setResearchCanvases(request: WorkspaceSetResearchCanvasesRequest): Promise<ProtocolResult<WorkspaceResearchCanvasesDto>>;
    peek(request: WorkspacePeekRequest): Promise<ProtocolResult<WorkspacePeekResponseDto>>;
    journalOpen(request: WorkspaceJournalOpenRequest): Promise<ProtocolResult<WorkspaceFileDto>>;
    journalCapture(request: WorkspaceJournalCaptureRequest): Promise<ProtocolResult<WorkspaceFileDto>>;
    list(request: WorkspaceListRequest): Promise<ProtocolResult<readonly WorkspaceFileDto[]>>;
    search(request: WorkspaceSearchRequest): Promise<ProtocolResult<readonly WorkspaceSearchResultDto[]>>;
    problems(request: WorkspaceProblemsRequest): Promise<ProtocolResult<readonly WorkspaceProblemDto[]>>;
    profiles(): Promise<ProtocolResult<readonly WorkspaceProfileManifestDto[]>>;
    previewProfileValidation(request: WorkspaceProfileValidationPreviewRequest): Promise<ProtocolResult<WorkspaceProfileValidationPreviewDto>>;
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
    projectDashboard(request: WorkspaceProjectDashboardRequest): Promise<ProtocolResult<WorkspaceProjectDashboardDto>>;
    referenceHealth(request: WorkspaceReferenceHealthRequest): Promise<ProtocolResult<WorkspaceReferenceHealthDto>>;
    /** Onda BO: painel único de manutenção — composição de saúde/duplicatas/anexos/relações por referência. */
    libraryMaintenanceOverview(request: WorkspaceLibraryMaintenanceRequest): Promise<ProtocolResult<WorkspaceLibraryMaintenanceOverviewDto>>;
    referenceAttachments(request: WorkspaceReferenceAttachmentsRequest): Promise<ProtocolResult<readonly WorkspaceReferenceAttachmentDto[]>>;
    /** Onda BH: múltiplos anexos por referência (ou vault inteiro, se `referenceId` ausente). */
    attachments(request: WorkspaceAttachmentsRequest): Promise<ProtocolResult<readonly AttachmentDto[]>>;
    addAttachment(request: WorkspaceAddAttachmentRequest): Promise<ProtocolResult<AttachmentDto>>;
    /** Abre o diálogo nativo de arquivo; Main preenche kind/mediaType/name/base64. */
    pickAndAddAttachment(request: WorkspacePickAttachmentRequest): Promise<ProtocolResult<AttachmentDto>>;
    addAttachmentVersion(request: WorkspaceAddAttachmentVersionRequest): Promise<ProtocolResult<AttachmentDto>>;
    pickAndAddAttachmentVersion(request: WorkspaceAttachmentRequest): Promise<ProtocolResult<AttachmentDto>>;
    removeAttachment(request: WorkspaceAttachmentRequest): Promise<ProtocolResult<undefined>>;
    /** Sugestão de renomeação vira escrita só quando este comando é chamado. */
    renameAttachmentFile(request: WorkspaceRenameAttachmentFileRequest): Promise<ProtocolResult<AttachmentDto>>;
    openAttachmentFile(request: WorkspaceAttachmentRequest): Promise<ProtocolResult<undefined>>;
    revealAttachmentFile(request: WorkspaceAttachmentRequest): Promise<ProtocolResult<undefined>>;
    attachmentHealth(): Promise<ProtocolResult<readonly AttachmentHealthIssueDto[]>>;
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
    intakePreview(request: WorkspaceLibraryIntakePreviewRequest): Promise<ProtocolResult<WorkspaceLibraryIntakePreviewDto>>;
    duplicates(): Promise<ProtocolResult<readonly WorkspaceLibraryDuplicateDto[]>>;
    merge(request: WorkspaceLibraryMergeRequest): Promise<ProtocolResult<WorkspaceLibraryMergeResponseDto>>;
    keyPreview(request: WorkspaceLibraryKeyPreviewRequest): Promise<ProtocolResult<WorkspaceLibraryKeyPreviewDto>>;
    renameKey(request: WorkspaceLibraryRenameKeyRequest): Promise<ProtocolResult<WorkspaceLibraryRenameKeyResponseDto>>;
    attachPdf(request: WorkspaceReferenceAttachmentRequest): Promise<ProtocolResult<WorkspaceReferenceAttachmentDto>>;
    /** F126: bytes de PDF recebidos por drop passam pelo Main e pelo Workspace Service. */
    attachPdfData(request: WorkspaceAttachReferencePdfRequest): Promise<ProtocolResult<WorkspaceReferenceAttachmentDto>>;
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
    assetPreview(request: WorkspaceAssetPreviewRequest): Promise<ProtocolResult<WorkspaceAssetPreviewResponse>>;
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
      chooseSyncMirror: () => invoke(bridge, DESKTOP_CHANNELS.chooseSyncMirror, undefined, workspaceSyncStatusResponseSchema),
      syncStatus: () => invoke(bridge, DESKTOP_CHANNELS.syncStatus, undefined, workspaceSyncStatusResponseSchema),
      syncNow: () => invoke(bridge, DESKTOP_CHANNELS.syncNow, undefined, workspaceSyncStatusResponseSchema),
      recoverFromSync: () => invoke(bridge, DESKTOP_CHANNELS.syncRecover, undefined, workspaceSyncStatusResponseSchema),
      resolveSyncConflict: async (request) => {
        const checked = validarDto(workspaceResolveSyncConflictRequestSchema, request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.syncResolveConflict, checked.value, workspaceSyncStatusResponseSchema) : checked;
      },
      collaboration: () => invoke(bridge, DESKTOP_CHANNELS.collaboration, undefined, workspaceCollaborationResponseSchema),
      setCollaboration: async (request) => {
        const checked = validarDto(workspaceSetCollaborationRequestSchema, request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.setCollaboration, checked.value, workspaceCollaborationResponseSchema) : checked;
      },
      academicViews: () => invoke(bridge, DESKTOP_CHANNELS.academicViews, undefined, workspaceAcademicViewsResponseSchema),
      setAcademicViews: async (request) => {
        const checked = validarDto(workspaceSetAcademicViewsRequestSchema, request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.setAcademicViews, checked.value, workspaceAcademicViewsResponseSchema) : checked;
      },
      academicRelations: () => invoke(bridge, DESKTOP_CHANNELS.academicRelations, undefined, workspaceAcademicRelationsResponseSchema),
      referenceRelations: async (request) => {
        const checked = validarWorkspaceReferenceRelationsRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.referenceRelations, checked.value, workspaceReferenceRelationsResponseSchema) : checked;
      },
      addReferenceRelation: async (request) => {
        const checked = validarWorkspaceAddReferenceRelationRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.addReferenceRelation, checked.value, referenceRelationDtoSchema) : checked;
      },
      removeReferenceRelation: async (request) => {
        const checked = validarWorkspaceRemoveReferenceRelationRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.removeReferenceRelation, checked.value, emptyResponseSchema) : checked;
      },
      annotations: async (request) => {
        const checked = validarWorkspaceAnnotationsRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.annotations, checked.value, workspacePdfAnnotationsResponseSchema) : checked;
      },
      annotationColorSemantics: () => invoke(bridge, DESKTOP_CHANNELS.annotationColorSemantics, undefined, workspaceAnnotationColorSemanticsResponseSchema),
      setAnnotationColorSemantics: async (request) => {
        const checked = validarWorkspaceSetAnnotationColorSemanticsRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.setAnnotationColorSemantics, checked.value, workspaceAnnotationColorSemanticsResponseSchema) : checked;
      },
      synthesizeAnnotations: async (request) => {
        const checked = validarWorkspaceSynthesizeAnnotationsRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.synthesizeAnnotations, checked.value, workspaceSynthesizeAnnotationsResponseSchema) : checked;
      },
      literatureSubscriptions: () => invoke(bridge, DESKTOP_CHANNELS.literatureSubscriptions, undefined, workspaceLiteratureSubscriptionsResponseSchema),
      addLiteratureSubscription: async (request) => {
        const checked = validarWorkspaceAddLiteratureSubscriptionRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.addLiteratureSubscription, checked.value, literatureSubscriptionDtoSchema) : checked;
      },
      removeLiteratureSubscription: async (request) => {
        const checked = validarWorkspaceRemoveLiteratureSubscriptionRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.removeLiteratureSubscription, checked.value, emptyResponseSchema) : checked;
      },
      literatureFeedInbox: () => invoke(bridge, DESKTOP_CHANNELS.literatureFeedInbox, undefined, workspaceLiteratureFeedInboxResponseSchema),
      pollLiteratureSubscription: async (request) => {
        const checked = validarWorkspacePollLiteratureSubscriptionRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.pollLiteratureSubscription, checked.value, workspacePollLiteratureSubscriptionResponseSchema) : checked;
      },
      dismissFeedInboxItem: async (request) => {
        const checked = validarWorkspaceDismissFeedInboxItemRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.dismissFeedInboxItem, checked.value, emptyResponseSchema) : checked;
      },
      importFeedInboxItem: async (request) => {
        const checked = validarWorkspaceImportFeedInboxItemRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.importFeedInboxItem, checked.value, workspaceLibraryEntryResponseSchema) : checked;
      },
      webCaptureExtract: async (request) => {
        const checked = validarWorkspaceWebCaptureExtractRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.webCaptureExtract, checked.value, workspaceWebCaptureExtractResponseSchema) : checked;
      },
      bookmarks: () => invoke(bridge, DESKTOP_CHANNELS.bookmarks, undefined, workspaceBookmarksResponseSchema),
      setBookmarks: async (request) => {
        const checked = validarDto(workspaceSetBookmarksRequestSchema, request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.setBookmarks, checked.value, workspaceBookmarksResponseSchema) : checked;
      },
      captureInbox: () => invoke(bridge, DESKTOP_CHANNELS.captureInbox, undefined, workspaceCaptureInboxResponseSchema),
      setCaptureInbox: async (request) => {
        const checked = validarDto(workspaceSetCaptureInboxRequestSchema, request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.setCaptureInbox, checked.value, workspaceCaptureInboxResponseSchema) : checked;
      },
      researchCanvases: () => invoke(bridge, DESKTOP_CHANNELS.researchCanvases, undefined, workspaceResearchCanvasesResponseSchema),
      setResearchCanvases: async (request) => {
        const checked = validarDto(workspaceSetResearchCanvasesRequestSchema, request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.setResearchCanvases, checked.value, workspaceResearchCanvasesResponseSchema) : checked;
      },
      peek: async (request) => {
        const checked = validarDto(workspacePeekRequestSchema, request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.peek, checked.value, workspacePeekResponseSchema) : checked;
      },
      journalOpen: async (request) => {
        const checked = validarDto(workspaceJournalOpenRequestSchema, request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.journalOpen, checked.value, workspaceFileDtoSchema) : checked;
      },
      journalCapture: async (request) => {
        const checked = validarDto(workspaceJournalCaptureRequestSchema, request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.journalCapture, checked.value, workspaceFileDtoSchema) : checked;
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
      profiles: () => invoke(bridge, DESKTOP_CHANNELS.profiles, {}, workspaceProfilesResponseSchema),
      previewProfileValidation: async (request) => {
        const checked = validarWorkspaceProfileValidationPreviewRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.profileValidationPreview, checked.value, workspaceProfileValidationPreviewResponseSchema) : checked;
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
      projectDashboard: async (request) => {
        const checked = validarWorkspaceProjectDashboardRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.projectDashboard, checked.value, workspaceProjectDashboardResponseSchema) : checked;
      },
      referenceHealth: async (request) => {
        const checked = validarWorkspaceReferenceHealthRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.referenceHealth, checked.value, workspaceReferenceHealthResponseSchema) : checked;
      },
      libraryMaintenanceOverview: async (request) => {
        const checked = validarWorkspaceLibraryMaintenanceRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.libraryMaintenanceOverview, checked.value, workspaceLibraryMaintenanceResponseSchema) : checked;
      },
      referenceAttachments: async (request) => {
        const checked = validarWorkspaceReferenceAttachmentsRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.referenceAttachments, checked.value, workspaceReferenceAttachmentsResponseSchema) : checked;
      },
      attachments: async (request) => {
        const checked = validarWorkspaceAttachmentsRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.attachments, checked.value, workspaceAttachmentsResponseSchema) : checked;
      },
      addAttachment: async (request) => {
        const checked = validarWorkspaceAddAttachmentRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.addAttachment, checked.value, workspaceAttachmentResponseSchema) : checked;
      },
      pickAndAddAttachment: async (request) => {
        const checked = validarWorkspacePickAttachmentRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.pickAndAddAttachment, checked.value, workspaceAttachmentResponseSchema) : checked;
      },
      addAttachmentVersion: async (request) => {
        const checked = validarWorkspaceAddAttachmentVersionRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.addAttachmentVersion, checked.value, workspaceAttachmentResponseSchema) : checked;
      },
      pickAndAddAttachmentVersion: async (request) => {
        const checked = validarWorkspaceAttachmentRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.pickAndAddAttachmentVersion, checked.value, workspaceAttachmentResponseSchema) : checked;
      },
      removeAttachment: async (request) => {
        const checked = validarWorkspaceAttachmentRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.removeAttachment, checked.value, emptyResponseSchema) : checked;
      },
      renameAttachmentFile: async (request) => {
        const checked = validarWorkspaceRenameAttachmentFileRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.renameAttachmentFile, checked.value, workspaceAttachmentResponseSchema) : checked;
      },
      openAttachmentFile: async (request) => {
        const checked = validarWorkspaceAttachmentRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.openAttachmentFile, checked.value, emptyResponseSchema) : checked;
      },
      revealAttachmentFile: async (request) => {
        const checked = validarWorkspaceAttachmentRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.revealAttachmentFile, checked.value, emptyResponseSchema) : checked;
      },
      attachmentHealth: async () => {
        const checked = validarWorkspaceAttachmentHealthRequest({});
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.attachmentHealth, checked.value, workspaceAttachmentHealthResponseSchema) : checked;
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
      intakePreview: async (request) => {
        const checked = validarWorkspaceLibraryIntakePreviewRequest(request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.libraryIntakePreview, checked.value, workspaceLibraryIntakePreviewResponseSchema) : checked;
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
      attachPdfData: async (request) => { const checked=validarDto(workspaceAttachReferencePdfRequestSchema, request); return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.libraryAttachPdfData, checked.value, workspaceReferenceAttachmentDtoSchema) : checked; },
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
      assetPreview: async (request) => {
        const checked = validarDto(workspaceAssetPreviewRequestSchema, request);
        return checked.ok ? invoke(bridge, DESKTOP_CHANNELS.assetPreview, checked.value, workspaceAssetPreviewResponseSchema) : checked;
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
