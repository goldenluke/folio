import { z } from 'zod';

import {
  PROTOCOL_VERSION,
  protocolError,
  type DesktopWorkspaceService,
  type EditorCloseRequest,
  type EditorDispatchRequest,
  type EditorExportRequest,
  type EditorOpenRequest,
  type EditorPreviewRequest,
  type EditorResolveConflictRequest,
  type EditorSaveRequest,
  type EditorSnapshotRequest,
  type LanguageCompletionRequest,
  type LanguageDefinitionRequest,
  type LanguageHoverRequest,
  type LanguageReferencesRequest,
  type LanguageCrossReferenceTargetsRequest,
  type LanguageUnlinkedMentionsRequest,
  type LanguageWritingStatisticsRequest,
  type LanguageRenameRequest,
  type LanguageMoveSectionRequest,
  type MessagePortLike,
  type ProtocolEnvelope,
  type ProtocolResponseEnvelope,
  type ProtocolResult,
  type WorkspaceBacklinksRequest,
  type WorkspaceGraphRequest,
  type WorkspaceHistoryRequest,
  type WorkspaceHistorySnapshotRequest,
  type WorkspaceHistoryDiffRequest,
  type WorkspaceDocumentComparisonRequest,
  type WorkspaceCreateLiteratureNoteRequest,
  type WorkspaceJournalOpenRequest,
  type WorkspaceJournalCaptureRequest,
  type WorkspaceCitationExplorerRequest,
  type WorkspaceResearchOverviewRequest,
  type WorkspaceProjectDashboardRequest,
  type WorkspaceLibraryListRequest,
  type WorkspaceLibraryUpsertRequest,
  type WorkspaceLibraryRemoveRequest,
  type WorkspaceLibraryFormatRequest,
  type WorkspaceLibraryResolveDoiRequest,
  type WorkspaceScholarlyIdentifierReviewRequest,
  type WorkspacePdfReconciliationRequest,
  type WorkspaceFullTextDiscoveryRequest,
  type WorkspaceDownloadFullTextRequest,
  type WorkspaceSetSystematicReviewRequest,
  type WorkspaceSetResearchDatasetsRequest,
  type WorkspaceImportResearchDatasetRequest,
  type WorkspaceResearchDatasetPreviewRequest,
  type WorkspaceWebCaptureExtractRequest,
  type WorkspaceLibraryImportRequest,
  type WorkspaceLibraryIntakePreviewRequest,
  type WorkspaceLibraryDuplicatesRequest,
  type WorkspaceLibraryMergeRequest,
  type WorkspaceLibraryKeyPreviewRequest,
  type WorkspaceLibraryRenameKeyRequest,
  type WorkspaceReferenceHealthRequest,
  type WorkspaceLibraryMaintenanceRequest,
  type WorkspaceReferenceRelationsRequest,
  type WorkspaceAddReferenceRelationRequest,
  type WorkspaceRemoveReferenceRelationRequest,
  type WorkspaceAddLiteratureSubscriptionRequest,
  type WorkspaceRemoveLiteratureSubscriptionRequest,
  type WorkspacePollLiteratureSubscriptionRequest,
  type WorkspaceDismissFeedInboxItemRequest,
  type WorkspaceImportFeedInboxItemRequest,
  type WorkspaceReferenceAttachmentsRequest,
  type WorkspaceAttachReferencePdfRequest,
  type WorkspaceReferenceAttachmentRequest,
  type WorkspaceCreatePdfAnnotationRequest,
  type WorkspacePdfAnnotationRequest,
  type WorkspaceAnnotationsRequest,
  type WorkspaceSetAnnotationColorSemanticsRequest,
  type WorkspaceSynthesizeAnnotationsRequest,
  type WorkspaceAttachmentsRequest,
  type WorkspaceAddAttachmentRequest,
  type WorkspaceAddAttachmentVersionRequest,
  type WorkspaceAttachmentRequest,
  type WorkspaceRenameAttachmentFileRequest,
  type WorkspaceAttachmentHealthRequest,
  type WorkspaceImportAssetRequest,
  type WorkspaceAssetPreviewRequest,
  type WorkspaceCreateDocumentRequest,
  type WorkspaceRenameRequest,
  type WorkspaceListRequest,
  type WorkspaceOpenRequest,
  type WorkspaceConfigureSyncRequest,
  type WorkspaceResolveSyncConflictRequest,
  type WorkspaceSetCollaborationRequest,
  type WorkspaceSetAcademicViewsRequest,
  type WorkspaceEnablePageRequest,
  type WorkspaceSetPagePropertiesRequest,
  type WorkspaceTogglePageTaskRequest,
  type WorkspaceSetHomeLayoutRequest,
  type WorkspaceSetThemesRequest,
  type WorkspaceSetResearchProjectsRequest,
  type WorkspaceSetReadingQueueRequest,
  type WorkspaceImportLegacyResearchProjectsRequest,
  type WorkspaceImportLegacyReadingQueueRequest,
  type WorkspaceSetBookmarksRequest,
  type WorkspaceSetCaptureInboxRequest,
  type WorkspaceSetResearchCanvasesRequest,
  type WorkspacePeekRequest,
  type WorkspaceReadRequest,
  type WorkspaceReferencesRequest,
  type WorkspaceSearchRequest,
  type WorkspaceProblemsRequest,
  type WorkspaceProfilesRequest,
  type WorkspaceProfileValidationPreviewRequest,
  type WorkspacePluginSetEnabledRequest,
  type WorkspacePluginCommandRequest,
  type WorkspacePluginExportRequest,
} from './model.js';
import {
  editorCloseRequestSchema,
  editorDispatchRequestSchema,
  editorExportRequestSchema,
  editorExportResponseSchema,
  editorOpenRequestSchema,
  editorPreviewRequestSchema,
  editorPreviewResponseSchema,
  editorResolveConflictRequestSchema,
  editorSaveRequestSchema,
  editorSnapshotDtoSchema,
  editorSnapshotRequestSchema,
  emptyResponseSchema,
  protocolEnvelopeSchema,
  protocolResponseEnvelopeSchema,
  validarDto,
  validarResultadoDoProtocolo,
  validarVersaoDoProtocolo,
  workspaceBacklinksRequestSchema,
  workspaceBacklinksResponseSchema,
  workspaceListRequestSchema,
  workspaceListResponseSchema,
  workspaceOpenRequestSchema,
  workspaceOpenResponseSchema,
  workspaceConfigureSyncRequestSchema,
  workspaceSyncStatusResponseSchema,
  workspaceResolveSyncConflictRequestSchema,
  workspaceCollaborationResponseSchema,
  workspaceSetCollaborationRequestSchema,
  workspaceAcademicViewsResponseSchema,
  workspaceAcademicRelationsResponseSchema,
  workspaceReferenceRelationsRequestSchema,
  workspaceReferenceRelationsResponseSchema,
  literatureSubscriptionDtoSchema,
  workspaceLiteratureSubscriptionsResponseSchema,
  workspaceAddLiteratureSubscriptionRequestSchema,
  workspaceRemoveLiteratureSubscriptionRequestSchema,
  workspaceLiteratureFeedInboxResponseSchema,
  workspacePollLiteratureSubscriptionRequestSchema,
  workspacePollLiteratureSubscriptionResponseSchema,
  workspaceDismissFeedInboxItemRequestSchema,
  workspaceImportFeedInboxItemRequestSchema,
  workspaceAddReferenceRelationRequestSchema,
  referenceRelationDtoSchema,
  workspaceRemoveReferenceRelationRequestSchema,
  workspaceBookmarksResponseSchema,
  workspaceSetBookmarksRequestSchema,
  workspaceCaptureInboxResponseSchema,
  workspaceSetCaptureInboxRequestSchema,
  workspaceResearchCanvasesResponseSchema,
  workspaceSetResearchCanvasesRequestSchema,
  workspacePeekRequestSchema,
  workspacePeekResponseSchema,
  workspaceSetAcademicViewsRequestSchema,
  workspacePagesResponseSchema,
  workspaceEnablePageRequestSchema,
  workspaceSetPagePropertiesRequestSchema,
  workspaceTogglePageTaskRequestSchema,
  workspacePageDtoSchema,
  workspaceHomeLayoutResponseSchema,
  workspaceSetHomeLayoutRequestSchema,
  workspaceThemesResponseSchema,
  workspaceSetThemesRequestSchema,
  workspaceResearchProjectsResponseSchema,
  workspaceSetResearchProjectsRequestSchema,
  workspaceReadingQueueResponseSchema,
  workspaceSetReadingQueueRequestSchema,
  workspaceImportLegacyResearchProjectsRequestSchema,
  workspaceImportLegacyResearchProjectsResponseSchema,
  workspaceImportLegacyReadingQueueRequestSchema,
  workspaceImportLegacyReadingQueueResponseSchema,
  workspaceReadRequestSchema,
  workspaceReadResponseSchema,
  workspaceAssetPreviewRequestSchema,
  workspaceAssetPreviewResponseSchema,
  workspaceReferencesRequestSchema,
  workspaceReferencesResponseSchema,
  workspaceGraphRequestSchema,
  workspaceGraphResponseSchema,
  workspaceHistoryRequestSchema,
  workspaceHistorySnapshotRequestSchema,
  workspaceHistoryDiffRequestSchema,
  workspaceHistoryResponseSchema,
  workspaceHistoryRevisionSchema,
  workspaceHistoryDiffResponseSchema,
  workspaceHistoryStructuralDiffResponseSchema,
  workspaceDocumentComparisonRequestSchema,
  workspaceDocumentComparisonResponseSchema,
  workspaceCreateLiteratureNoteRequestSchema,
  workspaceCreateLiteratureNoteResponseSchema,
  workspaceJournalOpenRequestSchema,
  workspaceJournalCaptureRequestSchema,
  workspaceCitationExplorerRequestSchema,
  workspaceCitationExplorerResponseSchema,
  workspaceResearchOverviewRequestSchema,
  workspaceResearchOverviewResponseSchema,
  workspaceProjectDashboardRequestSchema,
  workspaceProjectDashboardResponseSchema,
  workspaceLibraryListRequestSchema,
  workspaceLibraryListResponseSchema,
  workspaceLibraryEntryResponseSchema,
  workspaceLibraryUpsertRequestSchema,
  workspaceLibraryRemoveRequestSchema,
  workspaceLibraryFormatRequestSchema,
  workspaceLibraryFormatResponseSchema,
  workspaceLibraryResolveDoiRequestSchema,
  workspaceScholarlyIdentifierReviewRequestSchema,
  workspaceScholarlyIdentifierReviewResponseSchema,
  workspacePdfReconciliationRequestSchema,
  workspacePdfReconciliationResponseSchema,
  workspaceFullTextDiscoveryRequestSchema,
  workspaceFullTextDiscoveryResponseSchema,
  workspaceDownloadFullTextRequestSchema,
  workspaceSystematicReviewResponseSchema,
  workspaceSetSystematicReviewRequestSchema,
  workspaceResearchDatasetsResponseSchema,
  workspaceSetResearchDatasetsRequestSchema,
  workspaceImportResearchDatasetRequestSchema,
  workspaceResearchDatasetPreviewRequestSchema,
  workspaceResearchDatasetPreviewResponseSchema,
  workspaceWebCaptureExtractRequestSchema,
  workspaceWebCaptureExtractResponseSchema,
  workspaceLibraryImportRequestSchema,
  workspaceLibraryImportResponseSchema,
  workspaceLibraryIntakePreviewRequestSchema,
  workspaceLibraryIntakePreviewResponseSchema,
  workspaceLibraryDuplicatesRequestSchema,
  workspaceLibraryDuplicatesResponseSchema,
  workspaceLibraryMergeRequestSchema,
  workspaceLibraryMergeResponseSchema,
  workspaceLibraryKeyPreviewRequestSchema,
  workspaceLibraryKeyPreviewResponseSchema,
  workspaceLibraryRenameKeyRequestSchema,
  workspaceLibraryRenameKeyResponseSchema,
  workspaceReferenceHealthRequestSchema,
  workspaceReferenceHealthResponseSchema,
  workspaceLibraryMaintenanceRequestSchema,
  workspaceLibraryMaintenanceResponseSchema,
  workspaceReferenceAttachmentsRequestSchema,
  workspaceReferenceAttachmentsResponseSchema,
  workspaceAttachReferencePdfRequestSchema,
  workspaceReferenceAttachmentResponseSchema,
  workspaceReferenceAttachmentRequestSchema,
  workspaceReferenceAttachmentLocalPathResponseSchema,
  workspaceReferencePdfResponseSchema,
  workspacePdfAnnotationDtoSchema,
  workspacePdfAnnotationsResponseSchema,
  workspaceCreatePdfAnnotationRequestSchema,
  workspacePdfAnnotationRequestSchema,
  workspacePdfAnnotationLinkResponseSchema,
  workspaceAnnotationsRequestSchema,
  workspaceAnnotationColorSemanticsResponseSchema,
  workspaceSetAnnotationColorSemanticsRequestSchema,
  workspaceSynthesizeAnnotationsRequestSchema,
  workspaceSynthesizeAnnotationsResponseSchema,
  workspaceAttachmentsRequestSchema,
  workspaceAttachmentsResponseSchema,
  workspaceAddAttachmentRequestSchema,
  workspaceAddAttachmentVersionRequestSchema,
  workspaceAttachmentRequestSchema,
  workspaceAttachmentResponseSchema,
  workspaceRenameAttachmentFileRequestSchema,
  workspaceAttachmentLocalPathResponseSchema,
  workspaceAttachmentHealthRequestSchema,
  workspaceAttachmentHealthResponseSchema,
  workspaceImportAssetRequestSchema,
  workspaceAssetDtoSchema,
  workspaceFileDtoSchema,
  workspaceCreateDocumentRequestSchema,
  workspaceRenameRequestSchema,
  workspaceSearchRequestSchema,
  workspaceSearchResponseSchema,
  workspaceProblemsRequestSchema,
  workspaceProblemsResponseSchema,
  workspaceProfilesRequestSchema,
  workspaceProfilesResponseSchema,
  workspaceProfileValidationPreviewRequestSchema,
  workspaceProfileValidationPreviewResponseSchema,
  workspacePluginsResponseSchema,
  workspacePluginSetEnabledRequestSchema,
  workspacePluginCommandRequestSchema,
  workspacePluginCommandResponseSchema,
  workspacePluginExportRequestSchema,
  workspacePluginExportResponseSchema,
  languageCompletionRequestSchema,
  languageCompletionResponseSchema,
  languageDefinitionRequestSchema,
  languageHoverRequestSchema,
  languageHoverResponseSchema,
  languageLocationsResponseSchema,
  languageReferencesRequestSchema,
  languageCrossReferenceTargetsRequestSchema,
  languageCrossReferenceTargetsResponseSchema,
  languageUnlinkedMentionsRequestSchema,
  languageUnlinkedMentionsResponseSchema,
  languageWritingStatisticsRequestSchema,
  languageWritingStatisticsResponseSchema,
  languageRenameRequestSchema,
  languageRenameResponseSchema,
  languageMoveSectionRequestSchema,
} from './schemas.js';
import { attachMessageListener, type MessagePortUnsubscribe } from './message-port.js';

type Unsubscribe = MessagePortUnsubscribe;

const cancellation = () => protocolError('CANCELLED', 'Operação cancelada.');
const internalError = () => protocolError('INTERNAL', 'Falha interna do serviço.');
const unsupportedMethod = () => protocolError('UNSUPPORTED_METHOD', 'Método não suportado pelo Workspace Service.');
const isCancelled = (signal?: AbortSignal): boolean => signal?.aborted ?? false;

const call = async <I, O>(
  input: unknown,
  inputSchema: z.ZodType<I>,
  outputSchema: z.ZodType<O>,
  operation: (request: I, signal?: AbortSignal) => Promise<ProtocolResult<O>>,
  signal?: AbortSignal,
): Promise<ProtocolResult<O>> => {
  const checkedInput = validarDto(inputSchema, input);
  if (!checkedInput.ok) return checkedInput;
  if (isCancelled(signal)) return cancellation();
  try {
    const result = await operation(checkedInput.value, signal);
    if (isCancelled(signal)) return cancellation();
    const checkedOutput = validarResultadoDoProtocolo(result, outputSchema);
    return checkedOutput.ok ? checkedOutput.value : checkedOutput;
  } catch {
    return isCancelled(signal) ? cancellation() : internalError();
  }
};

/** Cliente local com a mesma validação da porta remota. */
export function createInProcessWorkspaceClient(service: DesktopWorkspaceService): DesktopWorkspaceService {
  return {
    profiles: (request, signal) => call(request, workspaceProfilesRequestSchema, workspaceProfilesResponseSchema, service.profiles.bind(service), signal),
    previewProfileValidation: (request, signal) => call(request, workspaceProfileValidationPreviewRequestSchema, workspaceProfileValidationPreviewResponseSchema, service.previewProfileValidation.bind(service), signal),
    open: (request, signal) => call(request, workspaceOpenRequestSchema, workspaceOpenResponseSchema, service.open.bind(service), signal),
    configureSync: (request, signal) => call(request, workspaceConfigureSyncRequestSchema, workspaceSyncStatusResponseSchema, service.configureSync.bind(service), signal),
    syncStatus: (signal) => call(undefined, emptyResponseSchema, workspaceSyncStatusResponseSchema, (_request, currentSignal) => service.syncStatus(currentSignal), signal),
    syncNow: (signal) => call(undefined, emptyResponseSchema, workspaceSyncStatusResponseSchema, (_request, currentSignal) => service.syncNow(currentSignal), signal),
    recoverFromSync: (signal) => call(undefined, emptyResponseSchema, workspaceSyncStatusResponseSchema, (_request, currentSignal) => service.recoverFromSync(currentSignal), signal),
    resolveSyncConflict: (request, signal) => call(request, workspaceResolveSyncConflictRequestSchema, workspaceSyncStatusResponseSchema, service.resolveSyncConflict.bind(service), signal),
    collaboration: (signal) => call(undefined, emptyResponseSchema, workspaceCollaborationResponseSchema, (_request, currentSignal) => service.collaboration(currentSignal), signal),
    setCollaboration: (request, signal) => call(request, workspaceSetCollaborationRequestSchema, workspaceCollaborationResponseSchema, service.setCollaboration.bind(service), signal),
    academicViews: (signal) => call(undefined, emptyResponseSchema, workspaceAcademicViewsResponseSchema, (_request, currentSignal) => service.academicViews(currentSignal), signal),
    setAcademicViews: (request, signal) => call(request, workspaceSetAcademicViewsRequestSchema, workspaceAcademicViewsResponseSchema, service.setAcademicViews.bind(service), signal),
    pages: (signal) => call(undefined, emptyResponseSchema, workspacePagesResponseSchema, (_request, currentSignal) => service.pages(currentSignal), signal),
    enablePage: (request, signal) => call(request, workspaceEnablePageRequestSchema, workspacePageDtoSchema, service.enablePage.bind(service), signal),
    setPageProperties: (request, signal) => call(request, workspaceSetPagePropertiesRequestSchema, workspacePageDtoSchema, service.setPageProperties.bind(service), signal),
    togglePageTask: (request, signal) => call(request, workspaceTogglePageTaskRequestSchema, workspacePageDtoSchema, service.togglePageTask.bind(service), signal),
    homeLayout: (signal) => call(undefined, emptyResponseSchema, workspaceHomeLayoutResponseSchema, (_request, currentSignal) => service.homeLayout(currentSignal), signal),
    setHomeLayout: (request, signal) => call(request, workspaceSetHomeLayoutRequestSchema, workspaceHomeLayoutResponseSchema, service.setHomeLayout.bind(service), signal),
    themes: (signal) => call(undefined, emptyResponseSchema, workspaceThemesResponseSchema, (_request, currentSignal) => service.themes(currentSignal), signal),
    setThemes: (request, signal) => call(request, workspaceSetThemesRequestSchema, workspaceThemesResponseSchema, service.setThemes.bind(service), signal),
    researchProjects: (signal) => call(undefined, emptyResponseSchema, workspaceResearchProjectsResponseSchema, (_request, currentSignal) => service.researchProjects(currentSignal), signal),
    setResearchProjects: (request, signal) => call(request, workspaceSetResearchProjectsRequestSchema, workspaceResearchProjectsResponseSchema, service.setResearchProjects.bind(service), signal),
    readingQueue: (signal) => call(undefined, emptyResponseSchema, workspaceReadingQueueResponseSchema, (_request, currentSignal) => service.readingQueue(currentSignal), signal),
    setReadingQueue: (request, signal) => call(request, workspaceSetReadingQueueRequestSchema, workspaceReadingQueueResponseSchema, service.setReadingQueue.bind(service), signal),
    importLegacyResearchProjects: (request, signal) => call(request, workspaceImportLegacyResearchProjectsRequestSchema, workspaceImportLegacyResearchProjectsResponseSchema, service.importLegacyResearchProjects.bind(service), signal),
    importLegacyReadingQueue: (request, signal) => call(request, workspaceImportLegacyReadingQueueRequestSchema, workspaceImportLegacyReadingQueueResponseSchema, service.importLegacyReadingQueue.bind(service), signal),
    academicRelations: (signal) => call(undefined, emptyResponseSchema, workspaceAcademicRelationsResponseSchema, (_request, currentSignal) => service.academicRelations(currentSignal), signal),
    referenceRelations: (request, signal) => call(request, workspaceReferenceRelationsRequestSchema, workspaceReferenceRelationsResponseSchema, service.referenceRelations.bind(service), signal),
    addReferenceRelation: (request, signal) => call(request, workspaceAddReferenceRelationRequestSchema, referenceRelationDtoSchema, service.addReferenceRelation.bind(service), signal),
    removeReferenceRelation: (request, signal) => call(request, workspaceRemoveReferenceRelationRequestSchema, emptyResponseSchema, service.removeReferenceRelation.bind(service), signal),
    literatureSubscriptions: (signal) => call(undefined, emptyResponseSchema, workspaceLiteratureSubscriptionsResponseSchema, (_request, currentSignal) => service.literatureSubscriptions(currentSignal), signal),
    addLiteratureSubscription: (request, signal) => call(request, workspaceAddLiteratureSubscriptionRequestSchema, literatureSubscriptionDtoSchema, service.addLiteratureSubscription.bind(service), signal),
    removeLiteratureSubscription: (request, signal) => call(request, workspaceRemoveLiteratureSubscriptionRequestSchema, emptyResponseSchema, service.removeLiteratureSubscription.bind(service), signal),
    literatureFeedInbox: (signal) => call(undefined, emptyResponseSchema, workspaceLiteratureFeedInboxResponseSchema, (_request, currentSignal) => service.literatureFeedInbox(currentSignal), signal),
    pollLiteratureSubscription: (request, signal) => call(request, workspacePollLiteratureSubscriptionRequestSchema, workspacePollLiteratureSubscriptionResponseSchema, service.pollLiteratureSubscription.bind(service), signal),
    dismissFeedInboxItem: (request, signal) => call(request, workspaceDismissFeedInboxItemRequestSchema, emptyResponseSchema, service.dismissFeedInboxItem.bind(service), signal),
    importFeedInboxItem: (request, signal) => call(request, workspaceImportFeedInboxItemRequestSchema, workspaceLibraryEntryResponseSchema, service.importFeedInboxItem.bind(service), signal),
    bookmarks: (signal) => call(undefined, emptyResponseSchema, workspaceBookmarksResponseSchema, (_request, currentSignal) => service.bookmarks(currentSignal), signal),
    setBookmarks: (request, signal) => call(request, workspaceSetBookmarksRequestSchema, workspaceBookmarksResponseSchema, service.setBookmarks.bind(service), signal),
    captureInbox: (signal) => call(undefined, emptyResponseSchema, workspaceCaptureInboxResponseSchema, (_request, currentSignal) => service.captureInbox(currentSignal), signal),
    setCaptureInbox: (request, signal) => call(request, workspaceSetCaptureInboxRequestSchema, workspaceCaptureInboxResponseSchema, service.setCaptureInbox.bind(service), signal),
    researchCanvases: (signal) => call(undefined, emptyResponseSchema, workspaceResearchCanvasesResponseSchema, (_request, currentSignal) => service.researchCanvases(currentSignal), signal),
    setResearchCanvases: (request, signal) => call(request, workspaceSetResearchCanvasesRequestSchema, workspaceResearchCanvasesResponseSchema, service.setResearchCanvases.bind(service), signal),
    peek: (request, signal) => call(request, workspacePeekRequestSchema, workspacePeekResponseSchema, service.peek.bind(service), signal),
    list: (request, signal) =>
      call(request, workspaceListRequestSchema, workspaceListResponseSchema, service.list.bind(service), signal),
    read: (request, signal) =>
      call(request, workspaceReadRequestSchema, workspaceReadResponseSchema, service.read.bind(service), signal),
    assetPreview: (request, signal) =>
      call(request, workspaceAssetPreviewRequestSchema, workspaceAssetPreviewResponseSchema, service.assetPreview.bind(service), signal),
    openEditor: (request, signal) =>
      call(request, editorOpenRequestSchema, editorSnapshotDtoSchema, service.openEditor.bind(service), signal),
    editorSnapshot: (request, signal) =>
      call(request, editorSnapshotRequestSchema, editorSnapshotDtoSchema, service.editorSnapshot.bind(service), signal),
    dispatchEditor: (request, signal) =>
      call(request, editorDispatchRequestSchema, editorSnapshotDtoSchema, service.dispatchEditor.bind(service), signal),
    saveEditor: (request, signal) =>
      call(request, editorSaveRequestSchema, editorSnapshotDtoSchema, service.saveEditor.bind(service), signal),
    closeEditor: (request, signal) =>
      call(request, editorCloseRequestSchema, emptyResponseSchema, service.closeEditor.bind(service), signal),
    resolveEditorConflict: (request, signal) =>
      call(request, editorResolveConflictRequestSchema, editorSnapshotDtoSchema, service.resolveEditorConflict.bind(service), signal),
    previewEditor: (request, signal) =>
      call(request, editorPreviewRequestSchema, editorPreviewResponseSchema, service.previewEditor.bind(service), signal),
    exportDocument: (request, signal) =>
      call(request, editorExportRequestSchema, editorExportResponseSchema, service.exportDocument.bind(service), signal),
    search: (request, signal) =>
      call(request, workspaceSearchRequestSchema, workspaceSearchResponseSchema, service.search.bind(service), signal),
    problems: (request, signal) =>
      call(request, workspaceProblemsRequestSchema, workspaceProblemsResponseSchema, service.problems.bind(service), signal),
    plugins: (signal) => call({}, emptyResponseSchema, workspacePluginsResponseSchema, service.plugins.bind(service), signal),
    setPluginEnabled: (request, signal) => call(request, workspacePluginSetEnabledRequestSchema, workspacePluginsResponseSchema, service.setPluginEnabled.bind(service), signal),
    reloadPlugins: (signal) => call({}, emptyResponseSchema, workspacePluginsResponseSchema, service.reloadPlugins.bind(service), signal),
    runPluginCommand: (request, signal) => call(request, workspacePluginCommandRequestSchema, workspacePluginCommandResponseSchema, service.runPluginCommand.bind(service), signal),
    exportWithPlugin: (request, signal) => call(request, workspacePluginExportRequestSchema, workspacePluginExportResponseSchema, service.exportWithPlugin.bind(service), signal),
    backlinks: (request, signal) =>
      call(request, workspaceBacklinksRequestSchema, workspaceBacklinksResponseSchema, service.backlinks.bind(service), signal),
    references: (request, signal) =>
      call(request, workspaceReferencesRequestSchema, workspaceReferencesResponseSchema, service.references.bind(service), signal),
    graph: (request, signal) =>
      call(request, workspaceGraphRequestSchema, workspaceGraphResponseSchema, service.graph.bind(service), signal),
    history: (request, signal) => call(request, workspaceHistoryRequestSchema, workspaceHistoryResponseSchema, service.history.bind(service), signal),
    historyCreateSnapshot: (request, signal) => call(request, workspaceHistorySnapshotRequestSchema, workspaceHistoryRevisionSchema, service.historyCreateSnapshot.bind(service), signal),
    historyDiff: (request, signal) => call(request, workspaceHistoryDiffRequestSchema, workspaceHistoryDiffResponseSchema, service.historyDiff.bind(service), signal),
    historyStructuralDiff: (request, signal) => call(request, workspaceHistoryDiffRequestSchema, workspaceHistoryStructuralDiffResponseSchema, service.historyStructuralDiff.bind(service), signal),
    compareDocuments: (request, signal) => call(request, workspaceDocumentComparisonRequestSchema, workspaceDocumentComparisonResponseSchema, service.compareDocuments.bind(service), signal),
    createLiteratureNote: (request, signal) =>
      call(
        request,
        workspaceCreateLiteratureNoteRequestSchema,
        workspaceCreateLiteratureNoteResponseSchema,
        service.createLiteratureNote.bind(service),
        signal,
      ),
    journalOpen: (request, signal) => call(request, workspaceJournalOpenRequestSchema, workspaceFileDtoSchema, service.journalOpen.bind(service), signal),
    journalCapture: (request, signal) => call(request, workspaceJournalCaptureRequestSchema, workspaceFileDtoSchema, service.journalCapture.bind(service), signal),
    citationExplorer: (request, signal) =>
      call(
        request,
        workspaceCitationExplorerRequestSchema,
        workspaceCitationExplorerResponseSchema,
        service.citationExplorer.bind(service),
        signal,
      ),
    researchOverview: (request, signal) =>
      call(
        request,
        workspaceResearchOverviewRequestSchema,
        workspaceResearchOverviewResponseSchema,
        service.researchOverview.bind(service),
        signal,
      ),
    projectDashboard: (request, signal) =>
      call(request, workspaceProjectDashboardRequestSchema, workspaceProjectDashboardResponseSchema, service.projectDashboard.bind(service), signal),
    libraryList: (request, signal) =>
      call(request, workspaceLibraryListRequestSchema, workspaceLibraryListResponseSchema, service.libraryList.bind(service), signal),
    libraryUpsert: (request, signal) =>
      call(
        request,
        workspaceLibraryUpsertRequestSchema,
        workspaceLibraryEntryResponseSchema,
        service.libraryUpsert.bind(service),
        signal,
      ),
    libraryRemove: (request, signal) =>
      call(request, workspaceLibraryRemoveRequestSchema, emptyResponseSchema, service.libraryRemove.bind(service), signal),
    libraryFormat: (request, signal) =>
      call(request, workspaceLibraryFormatRequestSchema, workspaceLibraryFormatResponseSchema, service.libraryFormat.bind(service), signal),
    libraryResolveDoi: (request, signal) =>
      call(request, workspaceLibraryResolveDoiRequestSchema, workspaceLibraryEntryResponseSchema, service.libraryResolveDoi.bind(service), signal),
    reviewScholarlyIdentifier: (request, signal) =>
      call(request, workspaceScholarlyIdentifierReviewRequestSchema, workspaceScholarlyIdentifierReviewResponseSchema, service.reviewScholarlyIdentifier.bind(service), signal),
    reconcilePdf: (request, signal) =>
      call(request, workspacePdfReconciliationRequestSchema, workspacePdfReconciliationResponseSchema, service.reconcilePdf.bind(service), signal),
    discoverFullText: (request, signal) => call(request, workspaceFullTextDiscoveryRequestSchema, workspaceFullTextDiscoveryResponseSchema, service.discoverFullText.bind(service), signal),
    downloadFullText: (request, signal) => call(request, workspaceDownloadFullTextRequestSchema, workspaceAttachmentResponseSchema, service.downloadFullText.bind(service), signal),
    systematicReview: (signal) => call(undefined, emptyResponseSchema, workspaceSystematicReviewResponseSchema, (_request, currentSignal) => service.systematicReview(currentSignal), signal),
    setSystematicReview: (request, signal) => call(request, workspaceSetSystematicReviewRequestSchema, workspaceSystematicReviewResponseSchema, service.setSystematicReview.bind(service), signal),
    researchDatasets: (signal) => call(undefined, emptyResponseSchema, workspaceResearchDatasetsResponseSchema, (_request, currentSignal) => service.researchDatasets(currentSignal), signal),
    setResearchDatasets: (request, signal) => call(request, workspaceSetResearchDatasetsRequestSchema, workspaceResearchDatasetsResponseSchema, service.setResearchDatasets.bind(service), signal),
    importResearchDataset: (request, signal) => call(request, workspaceImportResearchDatasetRequestSchema, workspaceResearchDatasetsResponseSchema, service.importResearchDataset.bind(service), signal),
    researchDatasetPreview: (request, signal) => call(request, workspaceResearchDatasetPreviewRequestSchema, workspaceResearchDatasetPreviewResponseSchema, service.researchDatasetPreview.bind(service), signal),
    webCaptureExtract: (request, signal) =>
      call(request, workspaceWebCaptureExtractRequestSchema, workspaceWebCaptureExtractResponseSchema, service.webCaptureExtract.bind(service), signal),
    libraryImport: (request, signal) =>
      call(request, workspaceLibraryImportRequestSchema, workspaceLibraryImportResponseSchema, service.libraryImport.bind(service), signal),
    libraryIntakePreview: (request, signal) =>
      call(request, workspaceLibraryIntakePreviewRequestSchema, workspaceLibraryIntakePreviewResponseSchema, service.libraryIntakePreview.bind(service), signal),
    libraryDuplicates: (request, signal) => call(request, workspaceLibraryDuplicatesRequestSchema, workspaceLibraryDuplicatesResponseSchema, service.libraryDuplicates.bind(service), signal),
    libraryMerge: (request, signal) => call(request, workspaceLibraryMergeRequestSchema, workspaceLibraryMergeResponseSchema, service.libraryMerge.bind(service), signal),
    libraryKeyPreview: (request, signal) => call(request, workspaceLibraryKeyPreviewRequestSchema, workspaceLibraryKeyPreviewResponseSchema, service.libraryKeyPreview.bind(service), signal),
    libraryRenameKey: (request, signal) => call(request, workspaceLibraryRenameKeyRequestSchema, workspaceLibraryRenameKeyResponseSchema, service.libraryRenameKey.bind(service), signal),
    referenceHealth: (request, signal) =>
      call(request, workspaceReferenceHealthRequestSchema, workspaceReferenceHealthResponseSchema, service.referenceHealth.bind(service), signal),
    libraryMaintenanceOverview: (request, signal) =>
      call(request, workspaceLibraryMaintenanceRequestSchema, workspaceLibraryMaintenanceResponseSchema, service.libraryMaintenanceOverview.bind(service), signal),
    referenceAttachments: (request, signal) => call(request, workspaceReferenceAttachmentsRequestSchema, workspaceReferenceAttachmentsResponseSchema, service.referenceAttachments.bind(service), signal),
    attachReferencePdf: (request, signal) => call(request, workspaceAttachReferencePdfRequestSchema, workspaceReferenceAttachmentResponseSchema, service.attachReferencePdf.bind(service), signal),
    removeReferenceAttachment: (request, signal) => call(request, workspaceReferenceAttachmentRequestSchema, emptyResponseSchema, service.removeReferenceAttachment.bind(service), signal),
    referenceAttachmentLocalPath: (request, signal) => call(request, workspaceReferenceAttachmentRequestSchema, workspaceReferenceAttachmentLocalPathResponseSchema, service.referenceAttachmentLocalPath.bind(service), signal),
    referencePdf: (request, signal) => call(request, workspaceReferenceAttachmentRequestSchema, workspaceReferencePdfResponseSchema, service.referencePdf.bind(service), signal),
    pdfAnnotations: (request, signal) => call(request, workspaceReferenceAttachmentRequestSchema, workspacePdfAnnotationsResponseSchema, service.pdfAnnotations.bind(service), signal),
    createPdfAnnotation: (request, signal) => call(request, workspaceCreatePdfAnnotationRequestSchema, workspacePdfAnnotationDtoSchema, service.createPdfAnnotation.bind(service), signal),
    removePdfAnnotation: (request, signal) => call(request, workspacePdfAnnotationRequestSchema, emptyResponseSchema, service.removePdfAnnotation.bind(service), signal),
    linkPdfAnnotation: (request, signal) => call(request, workspacePdfAnnotationRequestSchema, workspacePdfAnnotationLinkResponseSchema, service.linkPdfAnnotation.bind(service), signal),
    annotations: (request, signal) => call(request, workspaceAnnotationsRequestSchema, workspacePdfAnnotationsResponseSchema, service.annotations.bind(service), signal),
    annotationColorSemantics: (signal) => call(undefined, emptyResponseSchema, workspaceAnnotationColorSemanticsResponseSchema, (_request, currentSignal) => service.annotationColorSemantics(currentSignal), signal),
    setAnnotationColorSemantics: (request, signal) => call(request, workspaceSetAnnotationColorSemanticsRequestSchema, workspaceAnnotationColorSemanticsResponseSchema, service.setAnnotationColorSemantics.bind(service), signal),
    synthesizeAnnotations: (request, signal) => call(request, workspaceSynthesizeAnnotationsRequestSchema, workspaceSynthesizeAnnotationsResponseSchema, service.synthesizeAnnotations.bind(service), signal),
    attachments: (request, signal) => call(request, workspaceAttachmentsRequestSchema, workspaceAttachmentsResponseSchema, service.attachments.bind(service), signal),
    addAttachment: (request, signal) => call(request, workspaceAddAttachmentRequestSchema, workspaceAttachmentResponseSchema, service.addAttachment.bind(service), signal),
    addAttachmentVersion: (request, signal) => call(request, workspaceAddAttachmentVersionRequestSchema, workspaceAttachmentResponseSchema, service.addAttachmentVersion.bind(service), signal),
    removeAttachment: (request, signal) => call(request, workspaceAttachmentRequestSchema, emptyResponseSchema, service.removeAttachment.bind(service), signal),
    renameAttachmentFile: (request, signal) => call(request, workspaceRenameAttachmentFileRequestSchema, workspaceAttachmentResponseSchema, service.renameAttachmentFile.bind(service), signal),
    attachmentLocalPath: (request, signal) => call(request, workspaceAttachmentRequestSchema, workspaceAttachmentLocalPathResponseSchema, service.attachmentLocalPath.bind(service), signal),
    attachmentHealth: (request, signal) => call(request, workspaceAttachmentHealthRequestSchema, workspaceAttachmentHealthResponseSchema, service.attachmentHealth.bind(service), signal),
    importAsset: (request, signal) =>
      call(request, workspaceImportAssetRequestSchema, workspaceAssetDtoSchema, service.importAsset.bind(service), signal),
    createDocument: (request, signal) =>
      call(request, workspaceCreateDocumentRequestSchema, workspaceFileDtoSchema, service.createDocument.bind(service), signal),
    renameDocument: (request, signal) => call(request, workspaceRenameRequestSchema, workspaceFileDtoSchema, service.renameDocument.bind(service), signal),
    completions: (request, signal) =>
      call(request, languageCompletionRequestSchema, languageCompletionResponseSchema, service.completions.bind(service), signal),
    hover: (request, signal) =>
      call(request, languageHoverRequestSchema, languageHoverResponseSchema, service.hover.bind(service), signal),
    definition: (request, signal) =>
      call(request, languageDefinitionRequestSchema, languageLocationsResponseSchema, service.definition.bind(service), signal),
    languageReferences: (request, signal) =>
      call(request, languageReferencesRequestSchema, languageLocationsResponseSchema, service.languageReferences.bind(service), signal),
    crossReferenceTargets: (request, signal) => call(request, languageCrossReferenceTargetsRequestSchema, languageCrossReferenceTargetsResponseSchema, service.crossReferenceTargets.bind(service), signal),
    unlinkedMentions: (request, signal) => call(request, languageUnlinkedMentionsRequestSchema, languageUnlinkedMentionsResponseSchema, service.unlinkedMentions.bind(service), signal),
    writingStatistics: (request, signal) => call(request, languageWritingStatisticsRequestSchema, languageWritingStatisticsResponseSchema, service.writingStatistics.bind(service), signal),
    renameSymbol: (request, signal) => call(request, languageRenameRequestSchema, languageRenameResponseSchema, service.renameSymbol.bind(service), signal),
    moveSection: (request, signal) => call(request, languageMoveSectionRequestSchema, languageRenameResponseSchema, service.moveSection.bind(service), signal),
  };
}

const sendResponse = (port: MessagePortLike, id: string, result: ProtocolResult<unknown>): void => {
  port.postMessage({ version: PROTOCOL_VERSION, kind: 'response', id, result } satisfies ProtocolResponseEnvelope);
};

/** Expõe o Workspace Service em MessagePort; o owner do SQLite segue sendo único. */
export function serveWorkspaceOverMessagePort(port: MessagePortLike, service: DesktopWorkspaceService): Unsubscribe {
  const local = createInProcessWorkspaceClient(service);
  const pending = new Map<string, AbortController>();

  const handleRequest = async (envelope: Extract<ProtocolEnvelope, { kind: 'request' }>): Promise<void> => {
    const version = validarVersaoDoProtocolo(envelope.version);
    if (!version.ok) return sendResponse(port, envelope.id, version);
    const controller = new AbortController();
    pending.set(envelope.id, controller);
    try {
      const result = await (async (): Promise<ProtocolResult<unknown>> => {
        switch (envelope.method) {
          case 'workspace/open':
            return local.open(envelope.payload as WorkspaceOpenRequest, controller.signal);
          case 'workspace/sync-configure':
            return local.configureSync(envelope.payload as WorkspaceConfigureSyncRequest, controller.signal);
          case 'workspace/sync-status':
            return local.syncStatus(controller.signal);
          case 'workspace/sync-now':
            return local.syncNow(controller.signal);
          case 'workspace/sync-recover':
            return local.recoverFromSync(controller.signal);
          case 'workspace/sync-resolve-conflict':
            return local.resolveSyncConflict(envelope.payload as WorkspaceResolveSyncConflictRequest, controller.signal);
          case 'workspace/collaboration':
            return local.collaboration(controller.signal);
          case 'workspace/collaboration-set':
            return local.setCollaboration(envelope.payload as WorkspaceSetCollaborationRequest, controller.signal);
          case 'workspace/academic-views':
            return local.academicViews(controller.signal);
          case 'workspace/academic-views-set':
            return local.setAcademicViews(envelope.payload as WorkspaceSetAcademicViewsRequest, controller.signal);
          case 'workspace/pages':
            return local.pages(controller.signal);
          case 'workspace/page-enable':
            return local.enablePage(envelope.payload as WorkspaceEnablePageRequest, controller.signal);
          case 'workspace/page-properties-set':
            return local.setPageProperties(envelope.payload as WorkspaceSetPagePropertiesRequest, controller.signal);
          case 'workspace/page-task-toggle':
            return local.togglePageTask(envelope.payload as WorkspaceTogglePageTaskRequest, controller.signal);
          case 'workspace/home-layout':
            return local.homeLayout(controller.signal);
          case 'workspace/home-layout-set':
            return local.setHomeLayout(envelope.payload as WorkspaceSetHomeLayoutRequest, controller.signal);
          case 'workspace/themes':
            return local.themes(controller.signal);
          case 'workspace/themes-set':
            return local.setThemes(envelope.payload as WorkspaceSetThemesRequest, controller.signal);
          case 'workspace/research-projects':
            return local.researchProjects(controller.signal);
          case 'workspace/research-projects-set':
            return local.setResearchProjects(envelope.payload as WorkspaceSetResearchProjectsRequest, controller.signal);
          case 'workspace/reading-queue':
            return local.readingQueue(controller.signal);
          case 'workspace/reading-queue-set':
            return local.setReadingQueue(envelope.payload as WorkspaceSetReadingQueueRequest, controller.signal);
          case 'workspace/research-projects-import-legacy':
            return local.importLegacyResearchProjects(envelope.payload as WorkspaceImportLegacyResearchProjectsRequest, controller.signal);
          case 'workspace/reading-queue-import-legacy':
            return local.importLegacyReadingQueue(envelope.payload as WorkspaceImportLegacyReadingQueueRequest, controller.signal);
          case 'workspace/academic-relations':
            return local.academicRelations(controller.signal);
          case 'workspace/reference-relations':
            return local.referenceRelations(envelope.payload as WorkspaceReferenceRelationsRequest, controller.signal);
          case 'workspace/add-reference-relation':
            return local.addReferenceRelation(envelope.payload as WorkspaceAddReferenceRelationRequest, controller.signal);
          case 'workspace/remove-reference-relation':
            return local.removeReferenceRelation(envelope.payload as WorkspaceRemoveReferenceRelationRequest, controller.signal);
          case 'workspace/literature-subscriptions':
            return local.literatureSubscriptions(controller.signal);
          case 'workspace/add-literature-subscription':
            return local.addLiteratureSubscription(envelope.payload as WorkspaceAddLiteratureSubscriptionRequest, controller.signal);
          case 'workspace/remove-literature-subscription':
            return local.removeLiteratureSubscription(envelope.payload as WorkspaceRemoveLiteratureSubscriptionRequest, controller.signal);
          case 'workspace/literature-feed-inbox':
            return local.literatureFeedInbox(controller.signal);
          case 'workspace/poll-literature-subscription':
            return local.pollLiteratureSubscription(envelope.payload as WorkspacePollLiteratureSubscriptionRequest, controller.signal);
          case 'workspace/dismiss-feed-inbox-item':
            return local.dismissFeedInboxItem(envelope.payload as WorkspaceDismissFeedInboxItemRequest, controller.signal);
          case 'workspace/import-feed-inbox-item':
            return local.importFeedInboxItem(envelope.payload as WorkspaceImportFeedInboxItemRequest, controller.signal);
          case 'workspace/bookmarks':
            return local.bookmarks(controller.signal);
          case 'workspace/bookmarks-set':
            return local.setBookmarks(envelope.payload as WorkspaceSetBookmarksRequest, controller.signal);
          case 'workspace/capture-inbox':
            return local.captureInbox(controller.signal);
          case 'workspace/capture-inbox-set':
            return local.setCaptureInbox(envelope.payload as WorkspaceSetCaptureInboxRequest, controller.signal);
          case 'workspace/research-canvases':
            return local.researchCanvases(controller.signal);
          case 'workspace/research-canvases-set':
            return local.setResearchCanvases(envelope.payload as WorkspaceSetResearchCanvasesRequest, controller.signal);
          case 'workspace/peek':
            return local.peek(envelope.payload as WorkspacePeekRequest, controller.signal);
          case 'workspace/list':
            return local.list(envelope.payload as WorkspaceListRequest, controller.signal);
          case 'workspace/read':
            return local.read(envelope.payload as WorkspaceReadRequest, controller.signal);
          case 'workspace/asset-preview':
            return local.assetPreview(envelope.payload as WorkspaceAssetPreviewRequest, controller.signal);
          case 'editor/open':
            return local.openEditor(envelope.payload as EditorOpenRequest, controller.signal);
          case 'editor/snapshot':
            return local.editorSnapshot(envelope.payload as EditorSnapshotRequest, controller.signal);
          case 'editor/dispatch':
            return local.dispatchEditor(envelope.payload as EditorDispatchRequest, controller.signal);
          case 'editor/save':
            return local.saveEditor(envelope.payload as EditorSaveRequest, controller.signal);
          case 'editor/close':
            return local.closeEditor(envelope.payload as EditorCloseRequest, controller.signal);
          case 'editor/resolve-conflict':
            return local.resolveEditorConflict(envelope.payload as EditorResolveConflictRequest, controller.signal);
          case 'editor/preview':
            return local.previewEditor(envelope.payload as EditorPreviewRequest, controller.signal);
          case 'editor/export':
            return local.exportDocument(envelope.payload as EditorExportRequest, controller.signal);
          case 'workspace/search':
            return local.search(envelope.payload as WorkspaceSearchRequest, controller.signal);
          case 'workspace/problems':
            return local.problems(envelope.payload as WorkspaceProblemsRequest, controller.signal);
          case 'workspace/profiles':
            return local.profiles(envelope.payload as WorkspaceProfilesRequest, controller.signal);
          case 'workspace/profile-validation-preview':
            return local.previewProfileValidation(envelope.payload as WorkspaceProfileValidationPreviewRequest, controller.signal);
          case 'workspace/plugins': return local.plugins(controller.signal);
          case 'workspace/plugin-set-enabled': return local.setPluginEnabled(envelope.payload as WorkspacePluginSetEnabledRequest, controller.signal);
          case 'workspace/plugins-reload': return local.reloadPlugins(controller.signal);
          case 'workspace/plugin-command': return local.runPluginCommand(envelope.payload as WorkspacePluginCommandRequest, controller.signal);
          case 'workspace/plugin-export': return local.exportWithPlugin(envelope.payload as WorkspacePluginExportRequest, controller.signal);
          case 'workspace/backlinks':
            return local.backlinks(envelope.payload as WorkspaceBacklinksRequest, controller.signal);
          case 'workspace/references':
            return local.references(envelope.payload as WorkspaceReferencesRequest, controller.signal);
          case 'workspace/graph':
            return local.graph(envelope.payload as WorkspaceGraphRequest, controller.signal);
          case 'workspace/history':
            return local.history(envelope.payload as WorkspaceHistoryRequest, controller.signal);
          case 'workspace/history-create-snapshot':
            return local.historyCreateSnapshot(envelope.payload as WorkspaceHistorySnapshotRequest, controller.signal);
          case 'workspace/history-diff':
            return local.historyDiff(envelope.payload as WorkspaceHistoryDiffRequest, controller.signal);
          case 'workspace/history-structural-diff':
            return local.historyStructuralDiff(envelope.payload as WorkspaceHistoryDiffRequest, controller.signal);
          case 'workspace/compare-documents':
            return local.compareDocuments(envelope.payload as WorkspaceDocumentComparisonRequest, controller.signal);
          case 'workspace/create-literature-note':
            return local.createLiteratureNote(envelope.payload as WorkspaceCreateLiteratureNoteRequest, controller.signal);
          case 'workspace/journal-open':
            return local.journalOpen(envelope.payload as WorkspaceJournalOpenRequest, controller.signal);
          case 'workspace/journal-capture':
            return local.journalCapture(envelope.payload as WorkspaceJournalCaptureRequest, controller.signal);
          case 'workspace/citation-explorer':
            return local.citationExplorer(envelope.payload as WorkspaceCitationExplorerRequest, controller.signal);
          case 'workspace/research-overview':
            return local.researchOverview(envelope.payload as WorkspaceResearchOverviewRequest, controller.signal);
          case 'workspace/project-dashboard':
            return local.projectDashboard(envelope.payload as WorkspaceProjectDashboardRequest, controller.signal);
          case 'workspace/library-list':
            return local.libraryList(envelope.payload as WorkspaceLibraryListRequest, controller.signal);
          case 'workspace/library-upsert':
            return local.libraryUpsert(envelope.payload as WorkspaceLibraryUpsertRequest, controller.signal);
          case 'workspace/library-remove':
            return local.libraryRemove(envelope.payload as WorkspaceLibraryRemoveRequest, controller.signal);
          case 'workspace/library-format':
            return local.libraryFormat(envelope.payload as WorkspaceLibraryFormatRequest, controller.signal);
          case 'workspace/library-resolve-doi':
            return local.libraryResolveDoi(envelope.payload as WorkspaceLibraryResolveDoiRequest, controller.signal);
          case 'workspace/review-scholarly-identifier':
            return local.reviewScholarlyIdentifier(envelope.payload as WorkspaceScholarlyIdentifierReviewRequest, controller.signal);
          case 'workspace/reconcile-pdf':
            return local.reconcilePdf(envelope.payload as WorkspacePdfReconciliationRequest, controller.signal);
          case 'workspace/discover-full-text':
            return local.discoverFullText(envelope.payload as WorkspaceFullTextDiscoveryRequest, controller.signal);
          case 'workspace/download-full-text':
            return local.downloadFullText(envelope.payload as WorkspaceDownloadFullTextRequest, controller.signal);
          case 'workspace/systematic-review': return local.systematicReview(controller.signal);
          case 'workspace/systematic-review-set': return local.setSystematicReview(envelope.payload as WorkspaceSetSystematicReviewRequest, controller.signal);
          case 'workspace/research-datasets': return local.researchDatasets(controller.signal);
          case 'workspace/research-datasets-set': return local.setResearchDatasets(envelope.payload as WorkspaceSetResearchDatasetsRequest, controller.signal);
          case 'workspace/research-datasets-import': return local.importResearchDataset(envelope.payload as WorkspaceImportResearchDatasetRequest, controller.signal);
          case 'workspace/research-dataset-preview': return local.researchDatasetPreview(envelope.payload as WorkspaceResearchDatasetPreviewRequest, controller.signal);
          case 'workspace/web-capture-extract':
            return local.webCaptureExtract(envelope.payload as WorkspaceWebCaptureExtractRequest, controller.signal);
          case 'workspace/library-import':
            return local.libraryImport(envelope.payload as WorkspaceLibraryImportRequest, controller.signal);
          case 'workspace/library-intake-preview':
            return local.libraryIntakePreview(envelope.payload as WorkspaceLibraryIntakePreviewRequest, controller.signal);
          case 'workspace/library-duplicates':
            return local.libraryDuplicates(envelope.payload as WorkspaceLibraryDuplicatesRequest, controller.signal);
          case 'workspace/library-merge':
            return local.libraryMerge(envelope.payload as WorkspaceLibraryMergeRequest, controller.signal);
          case 'workspace/library-key-preview':
            return local.libraryKeyPreview(envelope.payload as WorkspaceLibraryKeyPreviewRequest, controller.signal);
          case 'workspace/library-rename-key':
            return local.libraryRenameKey(envelope.payload as WorkspaceLibraryRenameKeyRequest, controller.signal);
          case 'workspace/reference-health':
            return local.referenceHealth(envelope.payload as WorkspaceReferenceHealthRequest, controller.signal);
          case 'workspace/library-maintenance-overview':
            return local.libraryMaintenanceOverview(envelope.payload as WorkspaceLibraryMaintenanceRequest, controller.signal);
          case 'workspace/reference-attachments':
            return local.referenceAttachments(envelope.payload as WorkspaceReferenceAttachmentsRequest, controller.signal);
          case 'workspace/attach-reference-pdf':
            return local.attachReferencePdf(envelope.payload as WorkspaceAttachReferencePdfRequest, controller.signal);
          case 'workspace/remove-reference-attachment':
            return local.removeReferenceAttachment(envelope.payload as WorkspaceReferenceAttachmentRequest, controller.signal);
          case 'workspace/reference-attachment-local-path':
            return local.referenceAttachmentLocalPath(envelope.payload as WorkspaceReferenceAttachmentRequest, controller.signal);
          case 'workspace/reference-pdf':
            return local.referencePdf(envelope.payload as WorkspaceReferenceAttachmentRequest, controller.signal);
          case 'workspace/pdf-annotations':
            return local.pdfAnnotations(envelope.payload as WorkspaceReferenceAttachmentRequest, controller.signal);
          case 'workspace/create-pdf-annotation':
            return local.createPdfAnnotation(envelope.payload as WorkspaceCreatePdfAnnotationRequest, controller.signal);
          case 'workspace/remove-pdf-annotation':
            return local.removePdfAnnotation(envelope.payload as WorkspacePdfAnnotationRequest, controller.signal);
          case 'workspace/link-pdf-annotation':
            return local.linkPdfAnnotation(envelope.payload as WorkspacePdfAnnotationRequest, controller.signal);
          case 'workspace/annotations':
            return local.annotations(envelope.payload as WorkspaceAnnotationsRequest, controller.signal);
          case 'workspace/annotation-color-semantics':
            return local.annotationColorSemantics(controller.signal);
          case 'workspace/set-annotation-color-semantics':
            return local.setAnnotationColorSemantics(envelope.payload as WorkspaceSetAnnotationColorSemanticsRequest, controller.signal);
          case 'workspace/synthesize-annotations':
            return local.synthesizeAnnotations(envelope.payload as WorkspaceSynthesizeAnnotationsRequest, controller.signal);
          case 'workspace/attachments':
            return local.attachments(envelope.payload as WorkspaceAttachmentsRequest, controller.signal);
          case 'workspace/add-attachment':
            return local.addAttachment(envelope.payload as WorkspaceAddAttachmentRequest, controller.signal);
          case 'workspace/add-attachment-version':
            return local.addAttachmentVersion(envelope.payload as WorkspaceAddAttachmentVersionRequest, controller.signal);
          case 'workspace/remove-attachment':
            return local.removeAttachment(envelope.payload as WorkspaceAttachmentRequest, controller.signal);
          case 'workspace/rename-attachment-file':
            return local.renameAttachmentFile(envelope.payload as WorkspaceRenameAttachmentFileRequest, controller.signal);
          case 'workspace/attachment-local-path':
            return local.attachmentLocalPath(envelope.payload as WorkspaceAttachmentRequest, controller.signal);
          case 'workspace/attachment-health':
            return local.attachmentHealth(envelope.payload as WorkspaceAttachmentHealthRequest, controller.signal);
          case 'workspace/import-asset':
            return local.importAsset(envelope.payload as WorkspaceImportAssetRequest, controller.signal);
          case 'workspace/create-document':
            return local.createDocument(envelope.payload as WorkspaceCreateDocumentRequest, controller.signal);
          case 'workspace/rename-document':
            return local.renameDocument(envelope.payload as WorkspaceRenameRequest, controller.signal);
          case 'language/completions':
            return local.completions(envelope.payload as LanguageCompletionRequest, controller.signal);
          case 'language/hover':
            return local.hover(envelope.payload as LanguageHoverRequest, controller.signal);
          case 'language/definition':
            return local.definition(envelope.payload as LanguageDefinitionRequest, controller.signal);
          case 'language/references':
            return local.languageReferences(envelope.payload as LanguageReferencesRequest, controller.signal);
          case 'language/cross-reference-targets':
            return local.crossReferenceTargets(envelope.payload as LanguageCrossReferenceTargetsRequest, controller.signal);
          case 'language/unlinked-mentions':
            return local.unlinkedMentions(envelope.payload as LanguageUnlinkedMentionsRequest, controller.signal);
          case 'language/writing-statistics':
            return local.writingStatistics(envelope.payload as LanguageWritingStatisticsRequest, controller.signal);
          case 'language/rename-symbol':
            return local.renameSymbol(envelope.payload as LanguageRenameRequest, controller.signal);
          case 'language/move-section':
            return local.moveSection(envelope.payload as LanguageMoveSectionRequest, controller.signal);
          default:
            return unsupportedMethod();
        }
      })();
      sendResponse(port, envelope.id, result);
    } finally {
      pending.delete(envelope.id);
    }
  };

  const unsubscribe = attachMessageListener(port, (value) => {
    const parsed = protocolEnvelopeSchema.safeParse(value);
    if (!parsed.success) return;
    const envelope = parsed.data;
    if (envelope.kind === 'cancel') {
      pending.get(envelope.id)?.abort();
      return;
    }
    if (envelope.kind === 'request' && !envelope.method.startsWith('compiler/')) void handleRequest(envelope);
  });

  return () => {
    unsubscribe();
    for (const controller of pending.values()) controller.abort();
    pending.clear();
  };
}

interface PendingRequest {
  readonly resolve: (result: ProtocolResult<unknown>) => void;
  readonly schema: z.ZodType<unknown>;
  readonly cleanupAbort: () => void;
}

export interface MessagePortWorkspaceClient extends DesktopWorkspaceService {
  dispose(): void;
}

/** Cliente remoto para a autoridade do workspace, com validação e cancelamento. */
export function createWorkspaceMessagePortClient(port: MessagePortLike): MessagePortWorkspaceClient {
  let sequence = 0;
  const pending = new Map<string, PendingRequest>();
  const unsubscribe = attachMessageListener(port, (value) => {
    const parsed = protocolResponseEnvelopeSchema.safeParse(value);
    if (!parsed.success) return;
    const request = pending.get(parsed.data.id);
    if (request === undefined) return;
    pending.delete(parsed.data.id);
    request.cleanupAbort();
    const version = validarVersaoDoProtocolo(parsed.data.version);
    if (!version.ok) return request.resolve(version);
    const checked = validarResultadoDoProtocolo(parsed.data.result, request.schema);
    request.resolve(checked.ok ? checked.value : checked);
  });

  const request = <I, O>(
    method: Extract<ProtocolEnvelope, { kind: 'request' }>['method'],
    payload: I,
    inputSchema: z.ZodType<I>,
    outputSchema: z.ZodType<O>,
    signal?: AbortSignal,
  ): Promise<ProtocolResult<O>> => {
    const checkedInput = validarDto(inputSchema, payload);
    if (!checkedInput.ok) return Promise.resolve(checkedInput);
    if (isCancelled(signal)) return Promise.resolve(cancellation());
    const id = `workspace-${++sequence}`;
    return new Promise((resolve) => {
      const onAbort = () => {
        if (!pending.delete(id)) return;
        port.postMessage({ version: PROTOCOL_VERSION, kind: 'cancel', id });
        resolve(cancellation());
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      const cleanupAbort = () => signal?.removeEventListener('abort', onAbort);
      pending.set(id, { resolve: resolve as (result: ProtocolResult<unknown>) => void, schema: outputSchema, cleanupAbort });
      port.postMessage({ version: PROTOCOL_VERSION, kind: 'request', id, method, payload: checkedInput.value });
    });
  };

  return {
    profiles: (value, signal) => request('workspace/profiles', value, workspaceProfilesRequestSchema, workspaceProfilesResponseSchema, signal),
    previewProfileValidation: (value, signal) => request('workspace/profile-validation-preview', value, workspaceProfileValidationPreviewRequestSchema, workspaceProfileValidationPreviewResponseSchema, signal),
    open: (value, signal) => request('workspace/open', value, workspaceOpenRequestSchema, workspaceOpenResponseSchema, signal),
    configureSync: (value, signal) => request('workspace/sync-configure', value, workspaceConfigureSyncRequestSchema, workspaceSyncStatusResponseSchema, signal),
    syncStatus: (signal) => request('workspace/sync-status', undefined, emptyResponseSchema, workspaceSyncStatusResponseSchema, signal),
    syncNow: (signal) => request('workspace/sync-now', undefined, emptyResponseSchema, workspaceSyncStatusResponseSchema, signal),
    recoverFromSync: (signal) => request('workspace/sync-recover', undefined, emptyResponseSchema, workspaceSyncStatusResponseSchema, signal),
    resolveSyncConflict: (value, signal) => request('workspace/sync-resolve-conflict', value, workspaceResolveSyncConflictRequestSchema, workspaceSyncStatusResponseSchema, signal),
    collaboration: (signal) => request('workspace/collaboration', undefined, emptyResponseSchema, workspaceCollaborationResponseSchema, signal),
    setCollaboration: (value, signal) => request('workspace/collaboration-set', value, workspaceSetCollaborationRequestSchema, workspaceCollaborationResponseSchema, signal),
    academicViews: (signal) => request('workspace/academic-views', undefined, emptyResponseSchema, workspaceAcademicViewsResponseSchema, signal),
    setAcademicViews: (value, signal) => request('workspace/academic-views-set', value, workspaceSetAcademicViewsRequestSchema, workspaceAcademicViewsResponseSchema, signal),
    pages: (signal) => request('workspace/pages', undefined, emptyResponseSchema, workspacePagesResponseSchema, signal),
    enablePage: (value, signal) => request('workspace/page-enable', value, workspaceEnablePageRequestSchema, workspacePageDtoSchema, signal),
    setPageProperties: (value, signal) => request('workspace/page-properties-set', value, workspaceSetPagePropertiesRequestSchema, workspacePageDtoSchema, signal),
    togglePageTask: (value, signal) => request('workspace/page-task-toggle', value, workspaceTogglePageTaskRequestSchema, workspacePageDtoSchema, signal),
    homeLayout: (signal) => request('workspace/home-layout', undefined, emptyResponseSchema, workspaceHomeLayoutResponseSchema, signal),
    setHomeLayout: (value, signal) => request('workspace/home-layout-set', value, workspaceSetHomeLayoutRequestSchema, workspaceHomeLayoutResponseSchema, signal),
    themes: (signal) => request('workspace/themes', undefined, emptyResponseSchema, workspaceThemesResponseSchema, signal),
    setThemes: (value, signal) => request('workspace/themes-set', value, workspaceSetThemesRequestSchema, workspaceThemesResponseSchema, signal),
    researchProjects: (signal) => request('workspace/research-projects', undefined, emptyResponseSchema, workspaceResearchProjectsResponseSchema, signal),
    setResearchProjects: (value, signal) => request('workspace/research-projects-set', value, workspaceSetResearchProjectsRequestSchema, workspaceResearchProjectsResponseSchema, signal),
    readingQueue: (signal) => request('workspace/reading-queue', undefined, emptyResponseSchema, workspaceReadingQueueResponseSchema, signal),
    setReadingQueue: (value, signal) => request('workspace/reading-queue-set', value, workspaceSetReadingQueueRequestSchema, workspaceReadingQueueResponseSchema, signal),
    importLegacyResearchProjects: (value, signal) => request('workspace/research-projects-import-legacy', value, workspaceImportLegacyResearchProjectsRequestSchema, workspaceImportLegacyResearchProjectsResponseSchema, signal),
    importLegacyReadingQueue: (value, signal) => request('workspace/reading-queue-import-legacy', value, workspaceImportLegacyReadingQueueRequestSchema, workspaceImportLegacyReadingQueueResponseSchema, signal),
    academicRelations: (signal) => request('workspace/academic-relations', undefined, emptyResponseSchema, workspaceAcademicRelationsResponseSchema, signal),
    referenceRelations: (value, signal) => request('workspace/reference-relations', value, workspaceReferenceRelationsRequestSchema, workspaceReferenceRelationsResponseSchema, signal),
    addReferenceRelation: (value, signal) => request('workspace/add-reference-relation', value, workspaceAddReferenceRelationRequestSchema, referenceRelationDtoSchema, signal),
    removeReferenceRelation: (value, signal) => request('workspace/remove-reference-relation', value, workspaceRemoveReferenceRelationRequestSchema, emptyResponseSchema, signal),
    literatureSubscriptions: (signal) => request('workspace/literature-subscriptions', undefined, emptyResponseSchema, workspaceLiteratureSubscriptionsResponseSchema, signal),
    addLiteratureSubscription: (value, signal) => request('workspace/add-literature-subscription', value, workspaceAddLiteratureSubscriptionRequestSchema, literatureSubscriptionDtoSchema, signal),
    removeLiteratureSubscription: (value, signal) => request('workspace/remove-literature-subscription', value, workspaceRemoveLiteratureSubscriptionRequestSchema, emptyResponseSchema, signal),
    literatureFeedInbox: (signal) => request('workspace/literature-feed-inbox', undefined, emptyResponseSchema, workspaceLiteratureFeedInboxResponseSchema, signal),
    pollLiteratureSubscription: (value, signal) => request('workspace/poll-literature-subscription', value, workspacePollLiteratureSubscriptionRequestSchema, workspacePollLiteratureSubscriptionResponseSchema, signal),
    dismissFeedInboxItem: (value, signal) => request('workspace/dismiss-feed-inbox-item', value, workspaceDismissFeedInboxItemRequestSchema, emptyResponseSchema, signal),
    importFeedInboxItem: (value, signal) => request('workspace/import-feed-inbox-item', value, workspaceImportFeedInboxItemRequestSchema, workspaceLibraryEntryResponseSchema, signal),
    bookmarks: (signal) => request('workspace/bookmarks', undefined, emptyResponseSchema, workspaceBookmarksResponseSchema, signal),
    setBookmarks: (value, signal) => request('workspace/bookmarks-set', value, workspaceSetBookmarksRequestSchema, workspaceBookmarksResponseSchema, signal),
    captureInbox: (signal) => request('workspace/capture-inbox', undefined, emptyResponseSchema, workspaceCaptureInboxResponseSchema, signal),
    setCaptureInbox: (value, signal) => request('workspace/capture-inbox-set', value, workspaceSetCaptureInboxRequestSchema, workspaceCaptureInboxResponseSchema, signal),
    researchCanvases: (signal) => request('workspace/research-canvases', undefined, emptyResponseSchema, workspaceResearchCanvasesResponseSchema, signal),
    setResearchCanvases: (value, signal) => request('workspace/research-canvases-set', value, workspaceSetResearchCanvasesRequestSchema, workspaceResearchCanvasesResponseSchema, signal),
    peek: (value, signal) => request('workspace/peek', value, workspacePeekRequestSchema, workspacePeekResponseSchema, signal),
    list: (value, signal) => request('workspace/list', value, workspaceListRequestSchema, workspaceListResponseSchema, signal),
    read: (value, signal) => request('workspace/read', value, workspaceReadRequestSchema, workspaceReadResponseSchema, signal),
    assetPreview: (value, signal) => request('workspace/asset-preview', value, workspaceAssetPreviewRequestSchema, workspaceAssetPreviewResponseSchema, signal),
    openEditor: (value, signal) => request('editor/open', value, editorOpenRequestSchema, editorSnapshotDtoSchema, signal),
    editorSnapshot: (value, signal) => request('editor/snapshot', value, editorSnapshotRequestSchema, editorSnapshotDtoSchema, signal),
    dispatchEditor: (value, signal) => request('editor/dispatch', value, editorDispatchRequestSchema, editorSnapshotDtoSchema, signal),
    saveEditor: (value, signal) => request('editor/save', value, editorSaveRequestSchema, editorSnapshotDtoSchema, signal),
    closeEditor: (value, signal) => request('editor/close', value, editorCloseRequestSchema, emptyResponseSchema, signal),
    resolveEditorConflict: (value, signal) =>
      request('editor/resolve-conflict', value, editorResolveConflictRequestSchema, editorSnapshotDtoSchema, signal),
    previewEditor: (value, signal) =>
      request('editor/preview', value, editorPreviewRequestSchema, editorPreviewResponseSchema, signal),
    exportDocument: (value, signal) =>
      request('editor/export', value, editorExportRequestSchema, editorExportResponseSchema, signal),
    search: (value, signal) =>
      request('workspace/search', value, workspaceSearchRequestSchema, workspaceSearchResponseSchema, signal),
    problems: (value, signal) =>
      request('workspace/problems', value, workspaceProblemsRequestSchema, workspaceProblemsResponseSchema, signal),
    plugins: (signal) => request('workspace/plugins', {}, emptyResponseSchema, workspacePluginsResponseSchema, signal),
    setPluginEnabled: (value, signal) => request('workspace/plugin-set-enabled', value, workspacePluginSetEnabledRequestSchema, workspacePluginsResponseSchema, signal),
    reloadPlugins: (signal) => request('workspace/plugins-reload', {}, emptyResponseSchema, workspacePluginsResponseSchema, signal),
    runPluginCommand: (value, signal) => request('workspace/plugin-command', value, workspacePluginCommandRequestSchema, workspacePluginCommandResponseSchema, signal),
    exportWithPlugin: (value, signal) => request('workspace/plugin-export', value, workspacePluginExportRequestSchema, workspacePluginExportResponseSchema, signal),
    backlinks: (value, signal) =>
      request('workspace/backlinks', value, workspaceBacklinksRequestSchema, workspaceBacklinksResponseSchema, signal),
    references: (value, signal) =>
      request('workspace/references', value, workspaceReferencesRequestSchema, workspaceReferencesResponseSchema, signal),
    graph: (value, signal) =>
      request('workspace/graph', value, workspaceGraphRequestSchema, workspaceGraphResponseSchema, signal),
    history: (value, signal) => request('workspace/history', value, workspaceHistoryRequestSchema, workspaceHistoryResponseSchema, signal),
    historyCreateSnapshot: (value, signal) => request('workspace/history-create-snapshot', value, workspaceHistorySnapshotRequestSchema, workspaceHistoryRevisionSchema, signal),
    historyDiff: (value, signal) => request('workspace/history-diff', value, workspaceHistoryDiffRequestSchema, workspaceHistoryDiffResponseSchema, signal),
    historyStructuralDiff: (value, signal) => request('workspace/history-structural-diff', value, workspaceHistoryDiffRequestSchema, workspaceHistoryStructuralDiffResponseSchema, signal),
    compareDocuments: (value, signal) => request('workspace/compare-documents', value, workspaceDocumentComparisonRequestSchema, workspaceDocumentComparisonResponseSchema, signal),
    createLiteratureNote: (value, signal) =>
      request(
        'workspace/create-literature-note',
        value,
        workspaceCreateLiteratureNoteRequestSchema,
        workspaceCreateLiteratureNoteResponseSchema,
        signal,
      ),
    journalOpen: (value, signal) => request('workspace/journal-open', value, workspaceJournalOpenRequestSchema, workspaceFileDtoSchema, signal),
    journalCapture: (value, signal) => request('workspace/journal-capture', value, workspaceJournalCaptureRequestSchema, workspaceFileDtoSchema, signal),
    citationExplorer: (value, signal) =>
      request(
        'workspace/citation-explorer',
        value,
        workspaceCitationExplorerRequestSchema,
        workspaceCitationExplorerResponseSchema,
        signal,
      ),
    researchOverview: (value, signal) =>
      request(
        'workspace/research-overview',
        value,
        workspaceResearchOverviewRequestSchema,
        workspaceResearchOverviewResponseSchema,
        signal,
      ),
    projectDashboard: (value, signal) =>
      request('workspace/project-dashboard', value, workspaceProjectDashboardRequestSchema, workspaceProjectDashboardResponseSchema, signal),
    libraryList: (value, signal) =>
      request('workspace/library-list', value, workspaceLibraryListRequestSchema, workspaceLibraryListResponseSchema, signal),
    libraryUpsert: (value, signal) =>
      request(
        'workspace/library-upsert',
        value,
        workspaceLibraryUpsertRequestSchema,
        workspaceLibraryEntryResponseSchema,
        signal,
      ),
    libraryRemove: (value, signal) =>
      request('workspace/library-remove', value, workspaceLibraryRemoveRequestSchema, emptyResponseSchema, signal),
    libraryFormat: (value, signal) =>
      request('workspace/library-format', value, workspaceLibraryFormatRequestSchema, workspaceLibraryFormatResponseSchema, signal),
    libraryResolveDoi: (value, signal) =>
      request('workspace/library-resolve-doi', value, workspaceLibraryResolveDoiRequestSchema, workspaceLibraryEntryResponseSchema, signal),
    reviewScholarlyIdentifier: (value, signal) =>
      request('workspace/review-scholarly-identifier', value, workspaceScholarlyIdentifierReviewRequestSchema, workspaceScholarlyIdentifierReviewResponseSchema, signal),
    reconcilePdf: (value, signal) =>
      request('workspace/reconcile-pdf', value, workspacePdfReconciliationRequestSchema, workspacePdfReconciliationResponseSchema, signal),
    discoverFullText: (value, signal) => request('workspace/discover-full-text', value, workspaceFullTextDiscoveryRequestSchema, workspaceFullTextDiscoveryResponseSchema, signal),
    downloadFullText: (value, signal) => request('workspace/download-full-text', value, workspaceDownloadFullTextRequestSchema, workspaceAttachmentResponseSchema, signal),
    systematicReview: (signal) => request('workspace/systematic-review', undefined, emptyResponseSchema, workspaceSystematicReviewResponseSchema, signal),
    setSystematicReview: (value, signal) => request('workspace/systematic-review-set', value, workspaceSetSystematicReviewRequestSchema, workspaceSystematicReviewResponseSchema, signal),
    researchDatasets: (signal) => request('workspace/research-datasets', undefined, emptyResponseSchema, workspaceResearchDatasetsResponseSchema, signal),
    setResearchDatasets: (value, signal) => request('workspace/research-datasets-set', value, workspaceSetResearchDatasetsRequestSchema, workspaceResearchDatasetsResponseSchema, signal),
    importResearchDataset: (value, signal) => request('workspace/research-datasets-import', value, workspaceImportResearchDatasetRequestSchema, workspaceResearchDatasetsResponseSchema, signal),
    researchDatasetPreview: (value, signal) => request('workspace/research-dataset-preview', value, workspaceResearchDatasetPreviewRequestSchema, workspaceResearchDatasetPreviewResponseSchema, signal),
    webCaptureExtract: (value, signal) =>
      request('workspace/web-capture-extract', value, workspaceWebCaptureExtractRequestSchema, workspaceWebCaptureExtractResponseSchema, signal),
    libraryImport: (value, signal) =>
      request('workspace/library-import', value, workspaceLibraryImportRequestSchema, workspaceLibraryImportResponseSchema, signal),
    libraryIntakePreview: (value, signal) =>
      request('workspace/library-intake-preview', value, workspaceLibraryIntakePreviewRequestSchema, workspaceLibraryIntakePreviewResponseSchema, signal),
    libraryDuplicates: (value, signal) => request('workspace/library-duplicates', value, workspaceLibraryDuplicatesRequestSchema, workspaceLibraryDuplicatesResponseSchema, signal),
    libraryMerge: (value, signal) => request('workspace/library-merge', value, workspaceLibraryMergeRequestSchema, workspaceLibraryMergeResponseSchema, signal),
    libraryKeyPreview: (value, signal) => request('workspace/library-key-preview', value, workspaceLibraryKeyPreviewRequestSchema, workspaceLibraryKeyPreviewResponseSchema, signal),
    libraryRenameKey: (value, signal) => request('workspace/library-rename-key', value, workspaceLibraryRenameKeyRequestSchema, workspaceLibraryRenameKeyResponseSchema, signal),
    referenceHealth: (value, signal) =>
      request('workspace/reference-health', value, workspaceReferenceHealthRequestSchema, workspaceReferenceHealthResponseSchema, signal),
    libraryMaintenanceOverview: (value, signal) =>
      request('workspace/library-maintenance-overview', value, workspaceLibraryMaintenanceRequestSchema, workspaceLibraryMaintenanceResponseSchema, signal),
    referenceAttachments: (value, signal) => request('workspace/reference-attachments', value, workspaceReferenceAttachmentsRequestSchema, workspaceReferenceAttachmentsResponseSchema, signal),
    attachReferencePdf: (value, signal) => request('workspace/attach-reference-pdf', value, workspaceAttachReferencePdfRequestSchema, workspaceReferenceAttachmentResponseSchema, signal),
    removeReferenceAttachment: (value, signal) => request('workspace/remove-reference-attachment', value, workspaceReferenceAttachmentRequestSchema, emptyResponseSchema, signal),
    referenceAttachmentLocalPath: (value, signal) => request('workspace/reference-attachment-local-path', value, workspaceReferenceAttachmentRequestSchema, workspaceReferenceAttachmentLocalPathResponseSchema, signal),
    referencePdf: (value, signal) => request('workspace/reference-pdf', value, workspaceReferenceAttachmentRequestSchema, workspaceReferencePdfResponseSchema, signal),
    pdfAnnotations: (value, signal) => request('workspace/pdf-annotations', value, workspaceReferenceAttachmentRequestSchema, workspacePdfAnnotationsResponseSchema, signal),
    createPdfAnnotation: (value, signal) => request('workspace/create-pdf-annotation', value, workspaceCreatePdfAnnotationRequestSchema, workspacePdfAnnotationDtoSchema, signal),
    removePdfAnnotation: (value, signal) => request('workspace/remove-pdf-annotation', value, workspacePdfAnnotationRequestSchema, emptyResponseSchema, signal),
    linkPdfAnnotation: (value, signal) => request('workspace/link-pdf-annotation', value, workspacePdfAnnotationRequestSchema, workspacePdfAnnotationLinkResponseSchema, signal),
    annotations: (value, signal) => request('workspace/annotations', value, workspaceAnnotationsRequestSchema, workspacePdfAnnotationsResponseSchema, signal),
    annotationColorSemantics: (signal) => request('workspace/annotation-color-semantics', undefined, emptyResponseSchema, workspaceAnnotationColorSemanticsResponseSchema, signal),
    setAnnotationColorSemantics: (value, signal) => request('workspace/set-annotation-color-semantics', value, workspaceSetAnnotationColorSemanticsRequestSchema, workspaceAnnotationColorSemanticsResponseSchema, signal),
    synthesizeAnnotations: (value, signal) => request('workspace/synthesize-annotations', value, workspaceSynthesizeAnnotationsRequestSchema, workspaceSynthesizeAnnotationsResponseSchema, signal),
    attachments: (value, signal) => request('workspace/attachments', value, workspaceAttachmentsRequestSchema, workspaceAttachmentsResponseSchema, signal),
    addAttachment: (value, signal) => request('workspace/add-attachment', value, workspaceAddAttachmentRequestSchema, workspaceAttachmentResponseSchema, signal),
    addAttachmentVersion: (value, signal) => request('workspace/add-attachment-version', value, workspaceAddAttachmentVersionRequestSchema, workspaceAttachmentResponseSchema, signal),
    removeAttachment: (value, signal) => request('workspace/remove-attachment', value, workspaceAttachmentRequestSchema, emptyResponseSchema, signal),
    renameAttachmentFile: (value, signal) => request('workspace/rename-attachment-file', value, workspaceRenameAttachmentFileRequestSchema, workspaceAttachmentResponseSchema, signal),
    attachmentLocalPath: (value, signal) => request('workspace/attachment-local-path', value, workspaceAttachmentRequestSchema, workspaceAttachmentLocalPathResponseSchema, signal),
    attachmentHealth: (value, signal) => request('workspace/attachment-health', value, workspaceAttachmentHealthRequestSchema, workspaceAttachmentHealthResponseSchema, signal),
    importAsset: (value, signal) =>
      request('workspace/import-asset', value, workspaceImportAssetRequestSchema, workspaceAssetDtoSchema, signal),
    createDocument: (value, signal) =>
      request('workspace/create-document', value, workspaceCreateDocumentRequestSchema, workspaceFileDtoSchema, signal),
    renameDocument: (value, signal) => request('workspace/rename-document', value, workspaceRenameRequestSchema, workspaceFileDtoSchema, signal),
    completions: (value, signal) =>
      request('language/completions', value, languageCompletionRequestSchema, languageCompletionResponseSchema, signal),
    hover: (value, signal) =>
      request('language/hover', value, languageHoverRequestSchema, languageHoverResponseSchema, signal),
    definition: (value, signal) =>
      request('language/definition', value, languageDefinitionRequestSchema, languageLocationsResponseSchema, signal),
    languageReferences: (value, signal) =>
      request('language/references', value, languageReferencesRequestSchema, languageLocationsResponseSchema, signal),
    crossReferenceTargets: (value, signal) => request('language/cross-reference-targets', value, languageCrossReferenceTargetsRequestSchema, languageCrossReferenceTargetsResponseSchema, signal),
    unlinkedMentions: (value, signal) => request('language/unlinked-mentions', value, languageUnlinkedMentionsRequestSchema, languageUnlinkedMentionsResponseSchema, signal),
    writingStatistics: (value, signal) => request('language/writing-statistics', value, languageWritingStatisticsRequestSchema, languageWritingStatisticsResponseSchema, signal),
    renameSymbol: (value, signal) => request('language/rename-symbol', value, languageRenameRequestSchema, languageRenameResponseSchema, signal),
    moveSection: (value, signal) => request('language/move-section', value, languageMoveSectionRequestSchema, languageRenameResponseSchema, signal),
    dispose: () => {
      unsubscribe();
      for (const [id, entry] of pending) {
        entry.cleanupAbort();
        entry.resolve(cancellation());
        pending.delete(id);
      }
    },
  };
}
