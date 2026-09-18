import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename, extname, join, resolve } from 'node:path';

import { app, BrowserWindow, dialog, ipcMain, shell, type WebContents } from 'electron';

import {
  protocolError,
  protocolOk,
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
  validarWorkspaceCreateDocumentRequest,
  validarWorkspaceRenameRequest,
  validarWorkspaceImportAssetRequest,
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
  validarWorkspaceScholarlyIdentifierReviewRequest,
  validarWorkspaceScholarlyIdentifierBatchReviewRequest,
  validarWorkspacePdfReconciliationRequest,
  validarWorkspaceWebCaptureExtractRequest,
  validarWorkspaceLibraryImportRequest,
  validarWorkspaceLibraryIntakePreviewRequest,
  validarWorkspaceLibraryDuplicatesRequest,
  validarWorkspaceLibraryMergeRequest,
  validarWorkspaceLibraryKeyPreviewRequest,
  validarWorkspaceLibraryRenameKeyRequest,
  validarWorkspaceReferenceHealthRequest,
  workspaceSetReferenceIntegrityRequestSchema,
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
  validarWorkspaceReferenceAttachmentRequest,
  validarWorkspaceReferenceAttachmentsRequest,
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
  workspaceEnablePageRequestSchema,
  workspaceSetPagePropertiesRequestSchema,
  workspaceTogglePageTaskRequestSchema,
  workspaceSetHomeLayoutRequestSchema,
  workspaceSetThemesRequestSchema,
  workspaceSetResearchProjectsRequestSchema,
  workspaceSetReadingQueueRequestSchema,
  workspaceImportLegacyResearchProjectsRequestSchema,
  workspaceImportLegacyReadingQueueRequestSchema,
  validarWorkspaceOpenRequest,
  validarLanguageCompletionRequest,
  validarLanguageDefinitionRequest,
  validarLanguageHoverRequest,
  validarLanguageReferencesRequest,
  validarLanguageCrossReferenceTargetsRequest,
  validarLanguageUnlinkedMentionsRequest,
  validarLanguageWritingStatisticsRequest,
  validarLanguageRenameRequest,
  validarLanguageMoveSectionRequest,
  workspaceAttachReferencePdfRequestSchema,
  workspaceListRequestSchema,
  workspaceReadRequestSchema,
  workspaceAssetPreviewRequestSchema,
  workspaceResolveSyncConflictRequestSchema,
  workspaceSetCollaborationRequestSchema,
  workspaceSetAcademicViewsRequestSchema,
  workspaceSetBookmarksRequestSchema,
  workspaceSetCaptureInboxRequestSchema,
  workspaceSetResearchCanvasesRequestSchema,
  workspaceJournalOpenRequestSchema,
  workspaceJournalCaptureRequestSchema,
  workspacePeekRequestSchema,
  workspaceFullTextDiscoveryRequestSchema,
  workspaceDownloadFullTextRequestSchema,
  workspaceSetSystematicReviewRequestSchema,
  workspaceSetEvidenceSynthesisRequestSchema,
  workspaceSetResearchDatasetsRequestSchema,
  workspaceImportResearchDatasetRequestSchema,
  workspaceResearchDatasetPreviewRequestSchema,
  type DesktopEventDto,
  type SystemInformationDto,
} from '@abnt/protocol';

import { DESKTOP_CHANNELS } from '../shared/api.js';
import type { ExportSupervisor } from './export-supervisor.js';
import { WorkspaceSupervisor } from './workspace-supervisor.js';

const sendEvent = (event: DesktopEventDto): void => {
  for (const window of BrowserWindow.getAllWindows()) window.webContents.send(DESKTOP_CHANNELS.event, event);
};

/** Nome de arquivo seguro a partir do título do documento — sem separador de caminho nem caracteres de controle. */
const nomeSeguroDeArquivo = (titulo: string): string => {
  const limpo = titulo.trim().replace(/[/\\:*?"<>|\u0000-\u001f]/gu, ' ').replace(/\s+/gu, ' ').trim();
  return limpo === '' ? 'documento' : limpo;
};

const FILTRO_POR_FORMATO: Readonly<Record<'pdf' | 'docx' | 'html', { readonly name: string; readonly extensions: string[] }>> = {
  pdf: { name: 'PDF', extensions: ['pdf'] },
  docx: { name: 'Word', extensions: ['docx'] },
  html: { name: 'HTML', extensions: ['html'] },
};
const mediaTypeForAsset = (path: string): string => ({
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
}[extname(path).toLowerCase()] ?? 'application/octet-stream');
/** Onda BH: anexo aceita qualquer arquivo, não só imagem — mapa próprio em vez de estender `mediaTypeForAsset`. */
const mediaTypeForAttachment = (path: string): string => ({
  '.pdf': 'application/pdf', '.zip': 'application/zip', '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.csv': 'text/csv', '.json': 'application/json', '.txt': 'text/plain', '.bib': 'application/x-bibtex',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
}[extname(path).toLowerCase()] ?? 'application/octet-stream');

/** Main é somente proxy validado + diálogo nativo; não manipula vault nem editor. */
export function registerDesktopIpc(
  workspace: WorkspaceSupervisor,
  exportService: ExportSupervisor,
  systemInformation: SystemInformationDto,
  openNewWindow: () => Promise<void>,
): () => void {
  const senderWindow = (contents: WebContents): BrowserWindow | undefined => BrowserWindow.fromWebContents(contents) ?? undefined;
  /** F40: uma sessão pertence ao Workspace Service, mas várias janelas podem visualizá-la. */
  const editorOwners = new Map<number, Set<string>>();
  const claimEditor = (contents: WebContents, fileId: string): void => {
    const owned = editorOwners.get(contents.id) ?? new Set<string>();
    owned.add(fileId);
    editorOwners.set(contents.id, owned);
  };
  const isClaimedElsewhere = (fileId: string): boolean => [...editorOwners.values()].some((owned) => owned.has(fileId));
  const releaseEditor = async (contents: WebContents, fileId: string): Promise<unknown> => {
    const owned = editorOwners.get(contents.id);
    owned?.delete(fileId);
    if (owned?.size === 0) editorOwners.delete(contents.id);
    return isClaimedElsewhere(fileId) ? protocolOk(undefined) : workspace.client().closeEditor({ fileId });
  };
  const releaseWindowEditors = (contents: WebContents): void => {
    const files = [...(editorOwners.get(contents.id) ?? [])];
    editorOwners.delete(contents.id);
    for (const fileId of files) {
      if (!isClaimedElsewhere(fileId)) void workspace.client().closeEditor({ fileId });
    }
  };
  const lastVaultFile = join(app.getPath('userData'), 'last-vault.json');
  const vaultRecentsFile = join(app.getPath('userData'), 'vault-recents.json');
  const syncMirrorsFile = join(app.getPath('userData'), 'sync-mirrors.json');
  let activeRootPath: string | undefined;
  type VaultRecent = { readonly rootPath: string; readonly name: string; readonly lastOpenedAt: string };
  const readVaultRecents = async (): Promise<readonly VaultRecent[]> => {
    try {
      const value: unknown = JSON.parse(await readFile(vaultRecentsFile, 'utf8'));
      if (!Array.isArray(value)) return [];
      return value.flatMap((entry): readonly VaultRecent[] => typeof entry === 'object' && entry !== null && typeof (entry as VaultRecent).rootPath === 'string' && typeof (entry as VaultRecent).name === 'string' && typeof (entry as VaultRecent).lastOpenedAt === 'string' ? [entry as VaultRecent] : []);
    } catch { return []; }
  };
  const rememberLastVault = async (rootPath: string): Promise<void> => {
    const absolute = resolve(rootPath);
    const recent: VaultRecent = { rootPath: absolute, name: basename(absolute) || 'Vault sem nome', lastOpenedAt: new Date().toISOString() };
    const others = (await readVaultRecents()).filter((entry) => entry.rootPath !== absolute);
    await mkdir(app.getPath('userData'), { recursive: true });
    await Promise.all([
      writeFile(lastVaultFile, JSON.stringify({ rootPath: absolute }), 'utf8'),
      writeFile(vaultRecentsFile, JSON.stringify([recent, ...others].slice(0, 12)), 'utf8'),
    ]);
  };
  const readSyncMirrors = async (): Promise<Readonly<Record<string, string>>> => {
    try {
      const value: unknown = JSON.parse(await readFile(syncMirrorsFile, 'utf8'));
      if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
      return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].trim() !== ''));
    } catch { return {}; }
  };
  const rememberSyncMirror = async (rootPath: string, mirrorRootPath: string): Promise<void> => {
    const mirrors = await readSyncMirrors();
    await mkdir(app.getPath('userData'), { recursive: true });
    await writeFile(syncMirrorsFile, JSON.stringify({ ...mirrors, [resolve(rootPath)]: mirrorRootPath }), 'utf8');
  };
  const openWorkspace = async (rootPath: string) => {
    const opened = await workspace.client().open({ rootPath });
    if (!opened.ok) return opened;
    activeRootPath = resolve(rootPath);
    await rememberLastVault(activeRootPath);
    const mirror = (await readSyncMirrors())[resolve(rootPath)];
    if (mirror !== undefined) await workspace.client().configureSync({ mirrorRootPath: mirror });
    return opened;
  };
  const restoreLastVault = async () => {
    try {
      const value: unknown = JSON.parse(await readFile(lastVaultFile, 'utf8'));
      if (typeof value !== 'object' || value === null || !('rootPath' in value) || typeof value.rootPath !== 'string' || value.rootPath.trim() === '') {
        return protocolError('NOT_FOUND', 'Nenhum vault recente disponível.');
      }
      return openWorkspace(value.rootPath);
    } catch {
      return protocolError('NOT_FOUND', 'Nenhum vault recente disponível.');
    }
  };
  const operations: readonly [string, (value: unknown, sender: WebContents) => Promise<unknown>][] = [
    [DESKTOP_CHANNELS.systemInformation, async () => protocolOk(systemInformation)],
    [DESKTOP_CHANNELS.newWindow, async () => {
      await openNewWindow();
      return protocolOk(undefined);
    }],
    [DESKTOP_CHANNELS.chooseWorkspace, async (_value, sender) => {
      const options = {
        title: 'Abrir vault acadêmico',
        properties: ['openDirectory'] as const,
        buttonLabel: 'Abrir vault',
      };
      const parent = senderWindow(sender);
      const selected = await (parent === undefined
        ? dialog.showOpenDialog({ ...options, properties: [...options.properties] })
        : dialog.showOpenDialog(parent, { ...options, properties: [...options.properties] }));
      if (selected.canceled || selected.filePaths[0] === undefined) {
        return protocolError('CANCELLED', 'Seleção de vault cancelada.');
      }
      const opened = await openWorkspace(selected.filePaths[0]);
      return opened;
    }],
    [DESKTOP_CHANNELS.vaults, async () => protocolOk(await readVaultRecents())],
    [DESKTOP_CHANNELS.createVault, async (_value, sender) => {
      const options = { title: 'Criar vault acadêmico', properties: ['openDirectory', 'createDirectory'] as const, buttonLabel: 'Criar vault' };
      const parent = senderWindow(sender);
      const selected = await (parent === undefined ? dialog.showOpenDialog({ ...options, properties: [...options.properties] }) : dialog.showOpenDialog(parent, { ...options, properties: [...options.properties] }));
      if (selected.canceled || selected.filePaths[0] === undefined) return protocolError('CANCELLED', 'Criação de vault cancelada.');
      const rootPath = selected.filePaths[0];
      await mkdir(rootPath, { recursive: true });
      try { await writeFile(join(rootPath, 'README.md'), '# Novo vault\n\nComece a escrever aqui.\n', { encoding: 'utf8', flag: 'wx' }); } catch (error) { if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST') throw error; }
      return openWorkspace(rootPath);
    }],
    [DESKTOP_CHANNELS.forgetVault, async (value) => {
      if (typeof value !== 'object' || value === null || !('rootPath' in value) || typeof value.rootPath !== 'string') return protocolError('VALIDATION', 'Vault inválido.');
      const rootPath = resolve(value.rootPath);
      const recents = (await readVaultRecents()).filter((entry) => entry.rootPath !== rootPath);
      await mkdir(app.getPath('userData'), { recursive: true });
      await writeFile(vaultRecentsFile, JSON.stringify(recents), 'utf8');
      return protocolOk(undefined);
    }],
    [DESKTOP_CHANNELS.restoreWorkspace, async () => restoreLastVault()],
    [DESKTOP_CHANNELS.openWorkspace, async (value) => {
      const checked = validarWorkspaceOpenRequest(value);
      return checked.ok ? openWorkspace(checked.value.rootPath) : checked;
    }],
    [DESKTOP_CHANNELS.chooseSyncMirror, async (_value, sender) => {
      const options = {
        title: 'Escolher pasta espelho local',
        properties: ['openDirectory', 'createDirectory'] as const,
        buttonLabel: 'Usar como espelho',
      };
      const parent = senderWindow(sender);
      const selected = await (parent === undefined
        ? dialog.showOpenDialog({ ...options, properties: [...options.properties] })
        : dialog.showOpenDialog(parent, { ...options, properties: [...options.properties] }));
      if (selected.canceled || selected.filePaths[0] === undefined) {
        return protocolError('CANCELLED', 'Seleção de pasta espelho cancelada.');
      }
      const configured = await workspace.client().configureSync({ mirrorRootPath: selected.filePaths[0] });
      if (configured.ok && activeRootPath !== undefined) await rememberSyncMirror(activeRootPath, selected.filePaths[0]);
      return configured;
    }],
    [DESKTOP_CHANNELS.syncStatus, async () => workspace.client().syncStatus()],
    [DESKTOP_CHANNELS.syncNow, async () => workspace.client().syncNow()],
    [DESKTOP_CHANNELS.syncRecover, async () => workspace.client().recoverFromSync()],
    [DESKTOP_CHANNELS.syncResolveConflict, async (value) => {
      const checked = validarDto(workspaceResolveSyncConflictRequestSchema, value);
      return checked.ok ? workspace.client().resolveSyncConflict(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.collaboration, async () => workspace.client().collaboration()],
    [DESKTOP_CHANNELS.setCollaboration, async (value) => {
      const checked = validarDto(workspaceSetCollaborationRequestSchema, value);
      return checked.ok ? workspace.client().setCollaboration(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.academicViews, async () => workspace.client().academicViews()],
    [DESKTOP_CHANNELS.setAcademicViews, async (value) => {
      const checked = validarDto(workspaceSetAcademicViewsRequestSchema, value);
      return checked.ok ? workspace.client().setAcademicViews(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.pages, async () => workspace.client().pages()],
    [DESKTOP_CHANNELS.enablePage, async (value) => {
      const checked = validarDto(workspaceEnablePageRequestSchema, value);
      return checked.ok ? workspace.client().enablePage(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.setPageProperties, async (value) => {
      const checked = validarDto(workspaceSetPagePropertiesRequestSchema, value);
      return checked.ok ? workspace.client().setPageProperties(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.togglePageTask, async (value) => {
      const checked = validarDto(workspaceTogglePageTaskRequestSchema, value);
      return checked.ok ? workspace.client().togglePageTask(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.homeLayout, async () => workspace.client().homeLayout()],
    [DESKTOP_CHANNELS.setHomeLayout, async (value) => {
      const checked = validarDto(workspaceSetHomeLayoutRequestSchema, value);
      return checked.ok ? workspace.client().setHomeLayout(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.themes, async () => workspace.client().themes()],
    [DESKTOP_CHANNELS.setThemes, async (value) => {
      const checked = validarDto(workspaceSetThemesRequestSchema, value);
      return checked.ok ? workspace.client().setThemes(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.researchProjects, async () => workspace.client().researchProjects()],
    [DESKTOP_CHANNELS.setResearchProjects, async (value) => {
      const checked = validarDto(workspaceSetResearchProjectsRequestSchema, value);
      return checked.ok ? workspace.client().setResearchProjects(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.readingQueue, async () => workspace.client().readingQueue()],
    [DESKTOP_CHANNELS.setReadingQueue, async (value) => {
      const checked = validarDto(workspaceSetReadingQueueRequestSchema, value);
      return checked.ok ? workspace.client().setReadingQueue(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.importLegacyResearchProjects, async (value) => {
      const checked = validarDto(workspaceImportLegacyResearchProjectsRequestSchema, value);
      return checked.ok ? workspace.client().importLegacyResearchProjects(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.importLegacyReadingQueue, async (value) => {
      const checked = validarDto(workspaceImportLegacyReadingQueueRequestSchema, value);
      return checked.ok ? workspace.client().importLegacyReadingQueue(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.academicRelations, async () => workspace.client().academicRelations()],
    [DESKTOP_CHANNELS.referenceRelations, async (value) => {
      const checked = validarWorkspaceReferenceRelationsRequest(value);
      return checked.ok ? workspace.client().referenceRelations(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.addReferenceRelation, async (value) => {
      const checked = validarWorkspaceAddReferenceRelationRequest(value);
      return checked.ok ? workspace.client().addReferenceRelation(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.removeReferenceRelation, async (value) => {
      const checked = validarWorkspaceRemoveReferenceRelationRequest(value);
      return checked.ok ? workspace.client().removeReferenceRelation(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.annotations, async (value) => {
      const checked = validarWorkspaceAnnotationsRequest(value);
      return checked.ok ? workspace.client().annotations(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.annotationColorSemantics, async () => workspace.client().annotationColorSemantics()],
    [DESKTOP_CHANNELS.setAnnotationColorSemantics, async (value) => {
      const checked = validarWorkspaceSetAnnotationColorSemanticsRequest(value);
      return checked.ok ? workspace.client().setAnnotationColorSemantics(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.synthesizeAnnotations, async (value) => {
      const checked = validarWorkspaceSynthesizeAnnotationsRequest(value);
      return checked.ok ? workspace.client().synthesizeAnnotations(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.literatureSubscriptions, async () => workspace.client().literatureSubscriptions()],
    [DESKTOP_CHANNELS.addLiteratureSubscription, async (value) => {
      const checked = validarWorkspaceAddLiteratureSubscriptionRequest(value);
      return checked.ok ? workspace.client().addLiteratureSubscription(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.removeLiteratureSubscription, async (value) => {
      const checked = validarWorkspaceRemoveLiteratureSubscriptionRequest(value);
      return checked.ok ? workspace.client().removeLiteratureSubscription(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.literatureFeedInbox, async () => workspace.client().literatureFeedInbox()],
    [DESKTOP_CHANNELS.pollLiteratureSubscription, async (value) => {
      const checked = validarWorkspacePollLiteratureSubscriptionRequest(value);
      return checked.ok ? workspace.client().pollLiteratureSubscription(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.dismissFeedInboxItem, async (value) => {
      const checked = validarWorkspaceDismissFeedInboxItemRequest(value);
      return checked.ok ? workspace.client().dismissFeedInboxItem(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.importFeedInboxItem, async (value) => {
      const checked = validarWorkspaceImportFeedInboxItemRequest(value);
      return checked.ok ? workspace.client().importFeedInboxItem(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.bookmarks, async () => workspace.client().bookmarks()],
    [DESKTOP_CHANNELS.setBookmarks, async (value) => {
      const checked = validarDto(workspaceSetBookmarksRequestSchema, value);
      return checked.ok ? workspace.client().setBookmarks(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.captureInbox, async () => workspace.client().captureInbox()],
    [DESKTOP_CHANNELS.setCaptureInbox, async (value) => {
      const checked = validarDto(workspaceSetCaptureInboxRequestSchema, value);
      return checked.ok ? workspace.client().setCaptureInbox(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.researchCanvases, async () => workspace.client().researchCanvases()],
    [DESKTOP_CHANNELS.setResearchCanvases, async (value) => {
      const checked = validarDto(workspaceSetResearchCanvasesRequestSchema, value);
      return checked.ok ? workspace.client().setResearchCanvases(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.peek, async (value) => {
      const checked = validarDto(workspacePeekRequestSchema, value);
      return checked.ok ? workspace.client().peek(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.listWorkspace, async (value) => {
      const checked = validarDto(workspaceListRequestSchema, value);
      return checked.ok ? workspace.client().list(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.history, async (value) => { const checked = validarWorkspaceHistoryRequest(value); return checked.ok ? workspace.client().history(checked.value) : checked; }],
    [DESKTOP_CHANNELS.historyCreateSnapshot, async (value) => { const checked = validarWorkspaceHistorySnapshotRequest(value); return checked.ok ? workspace.client().historyCreateSnapshot(checked.value) : checked; }],
    [DESKTOP_CHANNELS.historyDiff, async (value) => { const checked = validarWorkspaceHistoryDiffRequest(value); return checked.ok ? workspace.client().historyDiff(checked.value) : checked; }],
    [DESKTOP_CHANNELS.historyStructuralDiff, async (value) => { const checked = validarWorkspaceHistoryDiffRequest(value); return checked.ok ? workspace.client().historyStructuralDiff(checked.value) : checked; }],
    [DESKTOP_CHANNELS.compareDocuments, async (value) => { const checked = validarWorkspaceDocumentComparisonRequest(value); return checked.ok ? workspace.client().compareDocuments(checked.value) : checked; }],
    [DESKTOP_CHANNELS.plugins, async () => workspace.client().plugins()],
    [DESKTOP_CHANNELS.pluginSetEnabled, async (value) => { const checked = validarWorkspacePluginSetEnabledRequest(value); return checked.ok ? workspace.client().setPluginEnabled(checked.value) : checked; }],
    [DESKTOP_CHANNELS.pluginsReload, async () => workspace.client().reloadPlugins()],
    [DESKTOP_CHANNELS.pluginCommand, async (value) => { const checked = validarWorkspacePluginCommandRequest(value); return checked.ok ? workspace.client().runPluginCommand(checked.value) : checked; }],
    [DESKTOP_CHANNELS.readDocument, async (value) => {
      const checked = validarDto(workspaceReadRequestSchema, value);
      return checked.ok ? workspace.client().read(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.assetPreview, async (value) => {
      const checked = validarDto(workspaceAssetPreviewRequestSchema, value);
      return checked.ok ? workspace.client().assetPreview(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.openEditor, async (value, sender) => {
      const checked = validarEditorOpenRequest(value);
      if (!checked.ok) return checked;
      const opened = await workspace.client().openEditor(checked.value);
      if (opened.ok) claimEditor(sender, checked.value.fileId);
      return opened;
    }],
    [DESKTOP_CHANNELS.snapshotEditor, async (value) => {
      const checked = validarEditorSnapshotRequest(value);
      return checked.ok ? workspace.client().editorSnapshot(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.dispatchEditor, async (value) => {
      const checked = validarEditorDispatchRequest(value);
      return checked.ok ? workspace.client().dispatchEditor(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.saveEditor, async (value) => {
      const checked = validarEditorSaveRequest(value);
      return checked.ok ? workspace.client().saveEditor(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.closeEditor, async (value, sender) => {
      const checked = validarEditorCloseRequest(value);
      return checked.ok ? releaseEditor(sender, checked.value.fileId) : checked;
    }],
    [DESKTOP_CHANNELS.previewEditor, async (value) => {
      const checked = validarEditorPreviewRequest(value);
      return checked.ok ? workspace.client().previewEditor(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.resolveEditorConflict, async (value) => {
      const checked = validarEditorResolveConflictRequest(value);
      return checked.ok ? workspace.client().resolveEditorConflict(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.exportDocument, async (value, sender) => {
      const checked = validarDesktopExportRequest(value);
      if (!checked.ok) return checked;
      const { fileId, format } = checked.value;

      const exported = await workspace.client().exportDocument({ fileId });
      if (!exported.ok) return exported;
      if (exported.value === undefined) {
        return protocolError('CONFLICT', 'O documento ainda não tem uma compilação para exportar.');
      }
      const { publication } = exported.value;

      const parent = senderWindow(sender);
      const options = {
        title: 'Exportar documento',
        defaultPath: `${nomeSeguroDeArquivo(publication.title)}.${format}`,
        filters: [FILTRO_POR_FORMATO[format]],
      };
      const selected = await (parent === undefined ? dialog.showSaveDialog(options) : dialog.showSaveDialog(parent, options));
      if (selected.canceled || selected.filePath === undefined) {
        return protocolError('CANCELLED', 'Exportação cancelada.');
      }

      const generated = await exportService.client().export({ publication, format });
      if (!generated.ok) return generated;

      await writeFile(selected.filePath, generated.value.bytes);
      return protocolOk({
        path: selected.filePath,
        revision: exported.value.revision,
        profileId: exported.value.profileId,
        contentHash: exported.value.contentHash,
        sha256: `sha256:${createHash('sha256').update(generated.value.bytes).digest('hex')}`,
        ...(generated.value.pages !== undefined ? { pages: generated.value.pages } : {}),
      });
    }],
    [DESKTOP_CHANNELS.exportPlugin, async (value, sender) => {
      const checked = validarDesktopPluginExportRequest(value);
      if (!checked.ok) return checked;
      const exported = await workspace.client().exportWithPlugin(checked.value);
      if (!exported.ok) return exported;
      const parent = senderWindow(sender);
      const options = {
        title: 'Exportar contribuição de plugin',
        defaultPath: `${nomeSeguroDeArquivo(exported.value.title)}.${exported.value.extension}`,
        filters: [{ name: exported.value.mimeType, extensions: [exported.value.extension] }],
      };
      const selected = await (parent === undefined ? dialog.showSaveDialog(options) : dialog.showSaveDialog(parent, options));
      if (selected.canceled || selected.filePath === undefined) return protocolError('CANCELLED', 'Exportação cancelada.');
      await writeFile(selected.filePath, exported.value.content, 'utf8');
      return protocolOk({ path: selected.filePath });
    }],
    [DESKTOP_CHANNELS.importAsset, async (value, sender) => {
      const checked = validarEditorImportAssetRequest(value);
      if (!checked.ok) return checked;
      const options = { title: 'Inserir figura', properties: ['openFile'] as Array<'openFile'>, filters: [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] }] };
      const parent = senderWindow(sender);
      const selected = await (parent === undefined ? dialog.showOpenDialog(options) : dialog.showOpenDialog(parent, options));
      const selectedPath = selected.filePaths[0];
      if (selected.canceled || selectedPath === undefined) return protocolError('CANCELLED', 'Seleção de recurso cancelada.');
      const bytes = await readFile(selectedPath);
      return workspace.client().importAsset({
        sourceFileId: checked.value.fileId,
        name: basename(selectedPath),
        mediaType: mediaTypeForAsset(selectedPath),
        base64: bytes.toString('base64'),
        ...(checked.value.directory === undefined ? {} : { directory: checked.value.directory }),
      });
    }],
    [DESKTOP_CHANNELS.importAssetData, async (value) => {
      const checked = validarWorkspaceImportAssetRequest(value);
      return checked.ok ? workspace.client().importAsset(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.createDocument, async (value) => {
      const checked = validarWorkspaceCreateDocumentRequest(value);
      return checked.ok ? workspace.client().createDocument(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.renameDocument, async (value) => {
      const checked = validarWorkspaceRenameRequest(value);
      return checked.ok ? workspace.client().renameDocument(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.search, async (value) => {
      const checked = validarWorkspaceSearchRequest(value);
      return checked.ok ? workspace.client().search(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.problems, async (value) => {
      const checked = validarWorkspaceProblemsRequest(value);
      return checked.ok ? workspace.client().problems(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.profiles, async () => workspace.client().profiles({})],
    [DESKTOP_CHANNELS.profileValidationPreview, async (value) => {
      const checked = validarWorkspaceProfileValidationPreviewRequest(value);
      return checked.ok ? workspace.client().previewProfileValidation(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.backlinks, async (value) => {
      const checked = validarWorkspaceBacklinksRequest(value);
      return checked.ok ? workspace.client().backlinks(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.references, async (value) => {
      const checked = validarWorkspaceReferencesRequest(value);
      return checked.ok ? workspace.client().references(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.graph, async (value) => {
      const checked = validarWorkspaceGraphRequest(value);
      return checked.ok ? workspace.client().graph(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.createLiteratureNote, async (value) => {
      const checked = validarWorkspaceCreateLiteratureNoteRequest(value);
      return checked.ok ? workspace.client().createLiteratureNote(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.journalOpen, async (value) => {
      const checked = validarDto(workspaceJournalOpenRequestSchema, value);
      return checked.ok ? workspace.client().journalOpen(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.journalCapture, async (value) => {
      const checked = validarDto(workspaceJournalCaptureRequestSchema, value);
      return checked.ok ? workspace.client().journalCapture(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.citationExplorer, async (value) => {
      const checked = validarWorkspaceCitationExplorerRequest(value);
      return checked.ok ? workspace.client().citationExplorer(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.researchOverview, async (value) => {
      const checked = validarWorkspaceResearchOverviewRequest(value);
      return checked.ok ? workspace.client().researchOverview(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.projectDashboard, async (value) => {
      const checked = validarWorkspaceProjectDashboardRequest(value);
      return checked.ok ? workspace.client().projectDashboard(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.libraryList, async (value) => {
      const checked = validarWorkspaceLibraryListRequest(value);
      return checked.ok ? workspace.client().libraryList(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.libraryUpsert, async (value) => {
      const checked = validarWorkspaceLibraryUpsertRequest(value);
      return checked.ok ? workspace.client().libraryUpsert(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.libraryRemove, async (value) => {
      const checked = validarWorkspaceLibraryRemoveRequest(value);
      return checked.ok ? workspace.client().libraryRemove(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.libraryFormat, async (value) => {
      const checked = validarWorkspaceLibraryFormatRequest(value);
      return checked.ok ? workspace.client().libraryFormat(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.libraryResolveDoi, async (value) => {
      const checked = validarWorkspaceLibraryResolveDoiRequest(value);
      return checked.ok ? workspace.client().libraryResolveDoi(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.libraryReviewScholarlyIdentifier, async (value) => {
      const checked = validarWorkspaceScholarlyIdentifierReviewRequest(value);
      return checked.ok ? workspace.client().reviewScholarlyIdentifier(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.libraryReviewScholarlyIdentifiersBatch, async (value) => {
      const checked = validarWorkspaceScholarlyIdentifierBatchReviewRequest(value);
      return checked.ok ? workspace.client().reviewScholarlyIdentifiersBatch(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.libraryReconcilePdf, async (value) => {
      const checked = validarWorkspacePdfReconciliationRequest(value);
      return checked.ok ? workspace.client().reconcilePdf(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.libraryDiscoverFullText, async (value) => {
      const checked = validarDto(workspaceFullTextDiscoveryRequestSchema, value);
      return checked.ok ? workspace.client().discoverFullText(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.libraryDownloadFullText, async (value) => {
      const checked = validarDto(workspaceDownloadFullTextRequestSchema, value);
      return checked.ok ? workspace.client().downloadFullText(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.systematicReview, async () => workspace.client().systematicReview()],
    [DESKTOP_CHANNELS.systematicReviewSet, async (value) => { const checked = validarDto(workspaceSetSystematicReviewRequestSchema, value); return checked.ok ? workspace.client().setSystematicReview(checked.value) : checked; }],
    [DESKTOP_CHANNELS.evidenceSynthesis, async () => workspace.client().evidenceSynthesis()],
    [DESKTOP_CHANNELS.evidenceSynthesisSet, async (value) => { const checked = validarDto(workspaceSetEvidenceSynthesisRequestSchema, value); return checked.ok ? workspace.client().setEvidenceSynthesis(checked.value) : checked; }],
    [DESKTOP_CHANNELS.researchDatasets, async () => workspace.client().researchDatasets()],
    [DESKTOP_CHANNELS.researchDatasetsSet, async (value) => { const checked = validarDto(workspaceSetResearchDatasetsRequestSchema, value); return checked.ok ? workspace.client().setResearchDatasets(checked.value) : checked; }],
    [DESKTOP_CHANNELS.researchDatasetsImport, async (value) => { const checked = validarDto(workspaceImportResearchDatasetRequestSchema, value); return checked.ok ? workspace.client().importResearchDataset(checked.value) : checked; }],
    [DESKTOP_CHANNELS.researchDatasetPreview, async (value) => { const checked = validarDto(workspaceResearchDatasetPreviewRequestSchema, value); return checked.ok ? workspace.client().researchDatasetPreview(checked.value) : checked; }],
    [DESKTOP_CHANNELS.webCaptureExtract, async (value) => {
      const checked = validarWorkspaceWebCaptureExtractRequest(value);
      return checked.ok ? workspace.client().webCaptureExtract(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.libraryImport, async (value) => {
      const checked = validarWorkspaceLibraryImportRequest(value);
      return checked.ok ? workspace.client().libraryImport(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.libraryIntakePreview, async (value) => {
      const checked = validarWorkspaceLibraryIntakePreviewRequest(value);
      return checked.ok ? workspace.client().libraryIntakePreview(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.libraryDuplicates, async (value) => {
      const checked = validarWorkspaceLibraryDuplicatesRequest(value);
      return checked.ok ? workspace.client().libraryDuplicates(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.libraryMerge, async (value) => {
      const checked = validarWorkspaceLibraryMergeRequest(value);
      return checked.ok ? workspace.client().libraryMerge(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.libraryKeyPreview, async (value) => {
      const checked = validarWorkspaceLibraryKeyPreviewRequest(value);
      return checked.ok ? workspace.client().libraryKeyPreview(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.libraryRenameKey, async (value) => {
      const checked = validarWorkspaceLibraryRenameKeyRequest(value);
      return checked.ok ? workspace.client().libraryRenameKey(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.libraryAttachPdf, async (value, sender) => {
      const checked = validarWorkspaceReferenceAttachmentRequest(value); if (!checked.ok) return checked;
      const parent = senderWindow(sender); const selected = await (parent === undefined ? dialog.showOpenDialog({ title: 'Anexar PDF', properties: ['openFile'], filters: [{ name: 'PDF', extensions: ['pdf'] }] }) : dialog.showOpenDialog(parent, { title: 'Anexar PDF', properties: ['openFile'], filters: [{ name: 'PDF', extensions: ['pdf'] }] }));
      const path = selected.filePaths[0]; if (selected.canceled || path === undefined) return protocolError('CANCELLED', 'Seleção de PDF cancelada.');
      const bytes = await readFile(path); return workspace.client().attachReferencePdf({ referenceId: checked.value.referenceId, name: basename(path), base64: bytes.toString('base64') });
    }],
    [DESKTOP_CHANNELS.libraryAttachPdfData, async (value) => {
      const checked = validarDto(workspaceAttachReferencePdfRequestSchema, value);
      return checked.ok ? workspace.client().attachReferencePdf(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.libraryOpenAttachment, async (value) => {
      const checked = validarWorkspaceReferenceAttachmentRequest(value); if (!checked.ok) return checked;
      const path = await workspace.client().referenceAttachmentLocalPath(checked.value); if (!path.ok) return path; if (path.value === undefined) return protocolError('NOT_FOUND', 'PDF não anexado a esta referência.');
      const failure = await shell.openPath(path.value); return failure === '' ? protocolOk(undefined) : protocolError('INTERNAL', failure);
    }],
    [DESKTOP_CHANNELS.libraryRevealAttachment, async (value) => {
      const checked = validarWorkspaceReferenceAttachmentRequest(value); if (!checked.ok) return checked;
      const path = await workspace.client().referenceAttachmentLocalPath(checked.value); if (!path.ok) return path; if (path.value === undefined) return protocolError('NOT_FOUND', 'PDF não anexado a esta referência.');
      shell.showItemInFolder(path.value); return protocolOk(undefined);
    }],
    [DESKTOP_CHANNELS.libraryRemoveAttachment, async (value) => {
      const checked = validarWorkspaceReferenceAttachmentRequest(value); return checked.ok ? workspace.client().removeReferenceAttachment(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.libraryReferencePdf, async (value) => {
      const checked = validarWorkspaceReferenceAttachmentRequest(value); return checked.ok ? workspace.client().referencePdf(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.libraryPdfAnnotations, async (value) => {
      const checked = validarWorkspaceAnnotationsRequest(value); return checked.ok ? workspace.client().pdfAnnotations(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.libraryCreatePdfAnnotation, async (value) => {
      const checked = validarWorkspaceCreatePdfAnnotationRequest(value); return checked.ok ? workspace.client().createPdfAnnotation(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.libraryRemovePdfAnnotation, async (value) => {
      const checked = validarWorkspacePdfAnnotationRequest(value); return checked.ok ? workspace.client().removePdfAnnotation(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.libraryLinkPdfAnnotation, async (value) => {
      const checked = validarWorkspacePdfAnnotationRequest(value); return checked.ok ? workspace.client().linkPdfAnnotation(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.referenceHealth, async (value) => {
      const checked = validarWorkspaceReferenceHealthRequest(value);
      return checked.ok ? workspace.client().referenceHealth(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.referenceIntegrity, async () => workspace.client().referenceIntegrity()],
    [DESKTOP_CHANNELS.referenceIntegritySet, async (value) => {
      const checked = validarDto(workspaceSetReferenceIntegrityRequestSchema, value);
      return checked.ok ? workspace.client().setReferenceIntegrity(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.libraryMaintenanceOverview, async (value) => {
      const checked = validarWorkspaceLibraryMaintenanceRequest(value);
      return checked.ok ? workspace.client().libraryMaintenanceOverview(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.referenceAttachments, async (value) => {
      const checked = validarWorkspaceReferenceAttachmentsRequest(value);
      return checked.ok ? workspace.client().referenceAttachments(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.attachments, async (value) => {
      const checked = validarWorkspaceAttachmentsRequest(value);
      return checked.ok ? workspace.client().attachments(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.addAttachment, async (value) => {
      const checked = validarWorkspaceAddAttachmentRequest(value);
      return checked.ok ? workspace.client().addAttachment(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.pickAndAddAttachment, async (value, sender) => {
      const checked = validarWorkspacePickAttachmentRequest(value); if (!checked.ok) return checked;
      const parent = senderWindow(sender);
      const selected = await (parent === undefined ? dialog.showOpenDialog({ title: 'Anexar arquivo', properties: ['openFile'] }) : dialog.showOpenDialog(parent, { title: 'Anexar arquivo', properties: ['openFile'] }));
      const path = selected.filePaths[0]; if (selected.canceled || path === undefined) return protocolError('CANCELLED', 'Seleção de arquivo cancelada.');
      const bytes = await readFile(path);
      return workspace.client().addAttachment({
        referenceId: checked.value.referenceId, role: checked.value.role, kind: 'file',
        mediaType: mediaTypeForAttachment(path), name: basename(path), base64: bytes.toString('base64'),
        ...(checked.value.displayTitle === undefined ? {} : { displayTitle: checked.value.displayTitle }),
      });
    }],
    [DESKTOP_CHANNELS.addAttachmentVersion, async (value) => {
      const checked = validarWorkspaceAddAttachmentVersionRequest(value);
      return checked.ok ? workspace.client().addAttachmentVersion(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.pickAndAddAttachmentVersion, async (value, sender) => {
      const checked = validarWorkspaceAttachmentRequest(value); if (!checked.ok) return checked;
      const parent = senderWindow(sender);
      const selected = await (parent === undefined ? dialog.showOpenDialog({ title: 'Nova versão do anexo', properties: ['openFile'] }) : dialog.showOpenDialog(parent, { title: 'Nova versão do anexo', properties: ['openFile'] }));
      const path = selected.filePaths[0]; if (selected.canceled || path === undefined) return protocolError('CANCELLED', 'Seleção de arquivo cancelada.');
      const bytes = await readFile(path);
      return workspace.client().addAttachmentVersion({ attachmentId: checked.value.attachmentId, name: basename(path), base64: bytes.toString('base64') });
    }],
    [DESKTOP_CHANNELS.removeAttachment, async (value) => {
      const checked = validarWorkspaceAttachmentRequest(value); return checked.ok ? workspace.client().removeAttachment(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.renameAttachmentFile, async (value) => {
      const checked = validarWorkspaceRenameAttachmentFileRequest(value); return checked.ok ? workspace.client().renameAttachmentFile(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.openAttachmentFile, async (value) => {
      const checked = validarWorkspaceAttachmentRequest(value); if (!checked.ok) return checked;
      const path = await workspace.client().attachmentLocalPath(checked.value); if (!path.ok) return path; if (path.value === undefined) return protocolError('NOT_FOUND', 'Anexo não encontrado.');
      const failure = await shell.openPath(path.value); return failure === '' ? protocolOk(undefined) : protocolError('INTERNAL', failure);
    }],
    [DESKTOP_CHANNELS.revealAttachmentFile, async (value) => {
      const checked = validarWorkspaceAttachmentRequest(value); if (!checked.ok) return checked;
      const path = await workspace.client().attachmentLocalPath(checked.value); if (!path.ok) return path; if (path.value === undefined) return protocolError('NOT_FOUND', 'Anexo não encontrado.');
      shell.showItemInFolder(path.value); return protocolOk(undefined);
    }],
    [DESKTOP_CHANNELS.attachmentHealth, async (value) => {
      const checked = validarWorkspaceAttachmentHealthRequest(value);
      return checked.ok ? workspace.client().attachmentHealth(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.languageCompletions, async (value) => {
      const checked = validarLanguageCompletionRequest(value);
      return checked.ok ? workspace.client().completions(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.languageHover, async (value) => {
      const checked = validarLanguageHoverRequest(value);
      return checked.ok ? workspace.client().hover(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.languageDefinition, async (value) => {
      const checked = validarLanguageDefinitionRequest(value);
      return checked.ok ? workspace.client().definition(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.languageReferences, async (value) => {
      const checked = validarLanguageReferencesRequest(value);
      return checked.ok ? workspace.client().languageReferences(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.languageCrossReferenceTargets, async (value) => {
      const checked = validarLanguageCrossReferenceTargetsRequest(value);
      return checked.ok ? workspace.client().crossReferenceTargets(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.languageUnlinkedMentions, async (value) => {
      const checked = validarLanguageUnlinkedMentionsRequest(value);
      return checked.ok ? workspace.client().unlinkedMentions(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.languageWritingStatistics, async (value) => {
      const checked = validarLanguageWritingStatisticsRequest(value);
      return checked.ok ? workspace.client().writingStatistics(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.languageRenameSymbol, async (value) => {
      const checked = validarLanguageRenameRequest(value);
      return checked.ok ? workspace.client().renameSymbol(checked.value) : checked;
    }],
    [DESKTOP_CHANNELS.languageMoveSection, async (value) => {
      const checked = validarLanguageMoveSectionRequest(value);
      return checked.ok ? workspace.client().moveSection(checked.value) : checked;
    }],
  ];

  const subscribedSenders = new Set<number>();
  for (const [channel, operation] of operations) {
    ipcMain.handle(channel, async (event, value) => {
      if (!subscribedSenders.has(event.sender.id)) {
        subscribedSenders.add(event.sender.id);
        event.sender.once('destroyed', () => {
          subscribedSenders.delete(event.sender.id);
          releaseWindowEditors(event.sender);
        });
      }
      return operation(value, event.sender);
    });
  }
  const unsubscribe = workspace.subscribe(sendEvent);
  return () => {
    unsubscribe();
    editorOwners.clear();
    for (const [channel] of operations) ipcMain.removeHandler(channel);
  };
}
