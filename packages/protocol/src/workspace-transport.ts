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
  type WorkspaceCreateLiteratureNoteRequest,
  type WorkspaceCitationExplorerRequest,
  type WorkspaceResearchOverviewRequest,
  type WorkspaceLibraryListRequest,
  type WorkspaceLibraryUpsertRequest,
  type WorkspaceLibraryRemoveRequest,
  type WorkspaceLibraryFormatRequest,
  type WorkspaceLibraryResolveDoiRequest,
  type WorkspaceLibraryImportRequest,
  type WorkspaceLibraryDuplicatesRequest,
  type WorkspaceLibraryMergeRequest,
  type WorkspaceLibraryKeyPreviewRequest,
  type WorkspaceLibraryRenameKeyRequest,
  type WorkspaceReferenceHealthRequest,
  type WorkspaceReferenceAttachmentsRequest,
  type WorkspaceAttachReferencePdfRequest,
  type WorkspaceReferenceAttachmentRequest,
  type WorkspaceCreatePdfAnnotationRequest,
  type WorkspacePdfAnnotationRequest,
  type WorkspaceImportAssetRequest,
  type WorkspaceCreateDocumentRequest,
  type WorkspaceRenameRequest,
  type WorkspaceListRequest,
  type WorkspaceOpenRequest,
  type WorkspaceReadRequest,
  type WorkspaceReferencesRequest,
  type WorkspaceSearchRequest,
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
  workspaceReadRequestSchema,
  workspaceReadResponseSchema,
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
  workspaceCreateLiteratureNoteRequestSchema,
  workspaceCreateLiteratureNoteResponseSchema,
  workspaceCitationExplorerRequestSchema,
  workspaceCitationExplorerResponseSchema,
  workspaceResearchOverviewRequestSchema,
  workspaceResearchOverviewResponseSchema,
  workspaceLibraryListRequestSchema,
  workspaceLibraryListResponseSchema,
  workspaceLibraryEntryResponseSchema,
  workspaceLibraryUpsertRequestSchema,
  workspaceLibraryRemoveRequestSchema,
  workspaceLibraryFormatRequestSchema,
  workspaceLibraryFormatResponseSchema,
  workspaceLibraryResolveDoiRequestSchema,
  workspaceLibraryImportRequestSchema,
  workspaceLibraryImportResponseSchema,
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
  workspaceImportAssetRequestSchema,
  workspaceAssetDtoSchema,
  workspaceFileDtoSchema,
  workspaceCreateDocumentRequestSchema,
  workspaceRenameRequestSchema,
  workspaceSearchRequestSchema,
  workspaceSearchResponseSchema,
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
    open: (request, signal) => call(request, workspaceOpenRequestSchema, workspaceOpenResponseSchema, service.open.bind(service), signal),
    list: (request, signal) =>
      call(request, workspaceListRequestSchema, workspaceListResponseSchema, service.list.bind(service), signal),
    read: (request, signal) =>
      call(request, workspaceReadRequestSchema, workspaceReadResponseSchema, service.read.bind(service), signal),
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
    createLiteratureNote: (request, signal) =>
      call(
        request,
        workspaceCreateLiteratureNoteRequestSchema,
        workspaceCreateLiteratureNoteResponseSchema,
        service.createLiteratureNote.bind(service),
        signal,
      ),
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
    libraryImport: (request, signal) =>
      call(request, workspaceLibraryImportRequestSchema, workspaceLibraryImportResponseSchema, service.libraryImport.bind(service), signal),
    libraryDuplicates: (request, signal) => call(request, workspaceLibraryDuplicatesRequestSchema, workspaceLibraryDuplicatesResponseSchema, service.libraryDuplicates.bind(service), signal),
    libraryMerge: (request, signal) => call(request, workspaceLibraryMergeRequestSchema, workspaceLibraryMergeResponseSchema, service.libraryMerge.bind(service), signal),
    libraryKeyPreview: (request, signal) => call(request, workspaceLibraryKeyPreviewRequestSchema, workspaceLibraryKeyPreviewResponseSchema, service.libraryKeyPreview.bind(service), signal),
    libraryRenameKey: (request, signal) => call(request, workspaceLibraryRenameKeyRequestSchema, workspaceLibraryRenameKeyResponseSchema, service.libraryRenameKey.bind(service), signal),
    referenceHealth: (request, signal) =>
      call(request, workspaceReferenceHealthRequestSchema, workspaceReferenceHealthResponseSchema, service.referenceHealth.bind(service), signal),
    referenceAttachments: (request, signal) => call(request, workspaceReferenceAttachmentsRequestSchema, workspaceReferenceAttachmentsResponseSchema, service.referenceAttachments.bind(service), signal),
    attachReferencePdf: (request, signal) => call(request, workspaceAttachReferencePdfRequestSchema, workspaceReferenceAttachmentResponseSchema, service.attachReferencePdf.bind(service), signal),
    removeReferenceAttachment: (request, signal) => call(request, workspaceReferenceAttachmentRequestSchema, emptyResponseSchema, service.removeReferenceAttachment.bind(service), signal),
    referenceAttachmentLocalPath: (request, signal) => call(request, workspaceReferenceAttachmentRequestSchema, workspaceReferenceAttachmentLocalPathResponseSchema, service.referenceAttachmentLocalPath.bind(service), signal),
    referencePdf: (request, signal) => call(request, workspaceReferenceAttachmentRequestSchema, workspaceReferencePdfResponseSchema, service.referencePdf.bind(service), signal),
    pdfAnnotations: (request, signal) => call(request, workspaceReferenceAttachmentRequestSchema, workspacePdfAnnotationsResponseSchema, service.pdfAnnotations.bind(service), signal),
    createPdfAnnotation: (request, signal) => call(request, workspaceCreatePdfAnnotationRequestSchema, workspacePdfAnnotationDtoSchema, service.createPdfAnnotation.bind(service), signal),
    removePdfAnnotation: (request, signal) => call(request, workspacePdfAnnotationRequestSchema, emptyResponseSchema, service.removePdfAnnotation.bind(service), signal),
    linkPdfAnnotation: (request, signal) => call(request, workspacePdfAnnotationRequestSchema, workspacePdfAnnotationLinkResponseSchema, service.linkPdfAnnotation.bind(service), signal),
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
          case 'workspace/list':
            return local.list(envelope.payload as WorkspaceListRequest, controller.signal);
          case 'workspace/read':
            return local.read(envelope.payload as WorkspaceReadRequest, controller.signal);
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
          case 'workspace/create-literature-note':
            return local.createLiteratureNote(envelope.payload as WorkspaceCreateLiteratureNoteRequest, controller.signal);
          case 'workspace/citation-explorer':
            return local.citationExplorer(envelope.payload as WorkspaceCitationExplorerRequest, controller.signal);
          case 'workspace/research-overview':
            return local.researchOverview(envelope.payload as WorkspaceResearchOverviewRequest, controller.signal);
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
          case 'workspace/library-import':
            return local.libraryImport(envelope.payload as WorkspaceLibraryImportRequest, controller.signal);
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
    open: (value, signal) => request('workspace/open', value, workspaceOpenRequestSchema, workspaceOpenResponseSchema, signal),
    list: (value, signal) => request('workspace/list', value, workspaceListRequestSchema, workspaceListResponseSchema, signal),
    read: (value, signal) => request('workspace/read', value, workspaceReadRequestSchema, workspaceReadResponseSchema, signal),
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
    createLiteratureNote: (value, signal) =>
      request(
        'workspace/create-literature-note',
        value,
        workspaceCreateLiteratureNoteRequestSchema,
        workspaceCreateLiteratureNoteResponseSchema,
        signal,
      ),
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
    libraryImport: (value, signal) =>
      request('workspace/library-import', value, workspaceLibraryImportRequestSchema, workspaceLibraryImportResponseSchema, signal),
    libraryDuplicates: (value, signal) => request('workspace/library-duplicates', value, workspaceLibraryDuplicatesRequestSchema, workspaceLibraryDuplicatesResponseSchema, signal),
    libraryMerge: (value, signal) => request('workspace/library-merge', value, workspaceLibraryMergeRequestSchema, workspaceLibraryMergeResponseSchema, signal),
    libraryKeyPreview: (value, signal) => request('workspace/library-key-preview', value, workspaceLibraryKeyPreviewRequestSchema, workspaceLibraryKeyPreviewResponseSchema, signal),
    libraryRenameKey: (value, signal) => request('workspace/library-rename-key', value, workspaceLibraryRenameKeyRequestSchema, workspaceLibraryRenameKeyResponseSchema, signal),
    referenceHealth: (value, signal) =>
      request('workspace/reference-health', value, workspaceReferenceHealthRequestSchema, workspaceReferenceHealthResponseSchema, signal),
    referenceAttachments: (value, signal) => request('workspace/reference-attachments', value, workspaceReferenceAttachmentsRequestSchema, workspaceReferenceAttachmentsResponseSchema, signal),
    attachReferencePdf: (value, signal) => request('workspace/attach-reference-pdf', value, workspaceAttachReferencePdfRequestSchema, workspaceReferenceAttachmentResponseSchema, signal),
    removeReferenceAttachment: (value, signal) => request('workspace/remove-reference-attachment', value, workspaceReferenceAttachmentRequestSchema, emptyResponseSchema, signal),
    referenceAttachmentLocalPath: (value, signal) => request('workspace/reference-attachment-local-path', value, workspaceReferenceAttachmentRequestSchema, workspaceReferenceAttachmentLocalPathResponseSchema, signal),
    referencePdf: (value, signal) => request('workspace/reference-pdf', value, workspaceReferenceAttachmentRequestSchema, workspaceReferencePdfResponseSchema, signal),
    pdfAnnotations: (value, signal) => request('workspace/pdf-annotations', value, workspaceReferenceAttachmentRequestSchema, workspacePdfAnnotationsResponseSchema, signal),
    createPdfAnnotation: (value, signal) => request('workspace/create-pdf-annotation', value, workspaceCreatePdfAnnotationRequestSchema, workspacePdfAnnotationDtoSchema, signal),
    removePdfAnnotation: (value, signal) => request('workspace/remove-pdf-annotation', value, workspacePdfAnnotationRequestSchema, emptyResponseSchema, signal),
    linkPdfAnnotation: (value, signal) => request('workspace/link-pdf-annotation', value, workspacePdfAnnotationRequestSchema, workspacePdfAnnotationLinkResponseSchema, signal),
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
