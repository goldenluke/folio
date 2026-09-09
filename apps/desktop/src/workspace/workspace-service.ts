import { createHash, randomUUID } from 'node:crypto';
import { basename, dirname, join, relative } from 'node:path';

import { formatarReferenciaAbnt, referenciaComoTexto } from '@abnt/bibliography';
import { asReferenceId, type BibliographicEntity } from '@abnt/document-model';
import { EditorWorkspaceService } from '@abnt/editor-core';
import {
  WorkspaceLanguageService,
  documentTarget,
  executeStructuredQuery,
  parseStructuredQuery,
  type LanguageReference,
  type LanguageReferenceCatalog,
  type LanguageWorkspaceEdit,
} from '@abnt/language-service';
import {
  protocolError,
  protocolOk,
  type CompilerService,
  type DesktopEventDto,
  type DesktopWorkspaceService,
  type EditorCloseRequest,
  type EditorDispatchRequest,
  type EditorExportDto,
  type EditorExportRequest,
  type EditorOpenRequest,
  type EditorPreviewDto,
  type EditorPreviewRequest,
  type EditorResolveConflictRequest,
  type EditorSaveRequest,
  type EditorSnapshotDto,
  type EditorSnapshotRequest,
  type LanguageCompletionDto,
  type LanguageCompletionRequest,
  type LanguageDefinitionRequest,
  type LanguageHoverDto,
  type LanguageHoverRequest,
  type LanguageLocationDto,
  type LanguageReferencesRequest,
  type LanguageWritingStatisticsRequest,
  type LanguageWritingStatisticsDto,
  type LanguageRenameRequest,
  type LanguageRenameResultDto,
  type LanguageMoveSectionRequest,
  type ProtocolError,
  type ProtocolResult,
  type WorkspaceBacklinkDto,
  type WorkspaceBacklinksRequest,
  type WorkspaceFileDto,
  type WorkspaceGraphDto,
  type WorkspaceGraphRequest,
  type WorkspaceHistoryRequest,
  type WorkspaceHistoryDto,
  type WorkspaceHistorySnapshotRequest,
  type WorkspaceHistoryRevisionDto,
  type WorkspaceHistoryDiffRequest,
  type WorkspaceHistoryDiffDto,
  type WorkspaceHistoryStructuralDiffDto,
  type WorkspaceDocumentComparisonRequest,
  type WorkspaceDocumentComparisonDto,
  type WorkspaceCreateLiteratureNoteRequest,
  type WorkspaceCitationExplorerRequest,
  type WorkspaceCitationExplorerResponseDto,
  type CitationExplorerEntryDto,
  type CitationExplorerLocationDto,
  type WorkspaceResearchOverviewRequest,
  type WorkspaceResearchOverviewDto,
  type WorkspaceResearchReferenceDto,
  type BibliographicEntityDto,
  type WorkspaceLibraryListRequest,
  type WorkspaceLibraryUpsertRequest,
  type WorkspaceLibraryRemoveRequest,
  type WorkspaceLibraryFormatRequest,
  type WorkspaceLibraryResolveDoiRequest,
  type WorkspaceLibraryImportRequest,
  type WorkspaceLibraryImportResponseDto,
  type WorkspaceLibraryDuplicatesRequest,
  type WorkspaceLibraryDuplicateDto,
  type WorkspaceLibraryMergeRequest,
  type WorkspaceLibraryMergeResponseDto,
  type WorkspaceLibraryKeyPreviewRequest,
  type WorkspaceLibraryKeyPreviewDto,
  type WorkspaceLibraryRenameKeyRequest,
  type WorkspaceLibraryRenameKeyResponseDto,
  type WorkspaceReferenceHealthRequest,
  type WorkspaceReferenceHealthDto,
  type WorkspaceAssetDto,
  type WorkspaceImportAssetRequest,
  type WorkspaceCreateDocumentRequest,
  type WorkspaceRenameRequest,
  type WorkspaceListRequest,
  type WorkspaceOpenRequest,
  type WorkspaceOpenResponse,
  type WorkspaceReadRequest,
  type WorkspaceReadResponse,
  type WorkspaceReferenceDto,
  type WorkspaceReferencesRequest,
  type WorkspaceSearchRequest,
  type WorkspaceSearchResultDto,
  type WorkspaceProblemsRequest,
  type WorkspaceProblemDto,
  type WorkspacePluginDto,
  type WorkspacePluginSetEnabledRequest,
  type WorkspacePluginCommandRequest,
  type WorkspacePluginCommandResultDto,
  type WorkspacePluginExportRequest,
  type WorkspacePluginExportDto,
} from '@abnt/protocol';
import { renderizarHtml } from '@abnt/renderer-html';
import type { PublicationBlock, PublicationDocument } from '@abnt/publication';
import { buildWorkspaceGraph } from '@abnt/workspace-graph';
import {
  WorkspaceAlreadyExistsError,
  WorkspaceConflictError,
  WorkspaceFileNotFoundError,
  asWorkspaceFileId,
  asWorkspacePath,
  type WorkspaceEvent,
  type WorkspaceFile,
} from '@abnt/workspace-core';
import { criarResolvedorDeAmbienteLocal } from '@abnt/workspace-environment';
import { SqliteWorkspaceIndex } from '@abnt/workspace-index';
import { LocalFilesystemStorage } from '@abnt/workspace-local';
import { DocumentSessionsService } from '@abnt/workspace-sessions';

import { scanBibliographyDeclarations, scanLiteratureReviewNotes, scanQueryMetadata } from './frontmatter-scan.js';
import { readLibrary, removeLibraryEntry, replaceLibraryEntries, upsertLibraryEntry } from './reference-library.js';
import { moveReferenceAttachment, readReferenceAttachments, removeReferenceAttachment, setReferenceAttachment } from './reference-attachments.js';
import { addPdfAnnotation, movePdfAnnotations, readPdfAnnotations, removeStoredPdfAnnotation, updatePdfAnnotation, type PdfAnnotation } from './pdf-annotations.js';
import { resolveDoi } from './doi-resolver.js';
import { importLibraryContent } from './library-import.js';
import { findReferenceDuplicates } from './reference-duplicates.js';
import { suggestReferenceKey } from './reference-key.js';
import { structuralDiff } from '@abnt/structural-diff';

import { WorkspaceHistory, lineDiff } from './history.js';
import { WorkspacePluginCatalog } from './plugins.js';

type DesktopEventListener = (event: DesktopEventDto) => void;

export interface DesktopWorkspaceServiceOptions {
  readonly compiler: CompilerService;
}

const workspaceFileDto = (file: WorkspaceFile): WorkspaceFileDto => ({
  fileId: String(file.id),
  ...(file.documentId !== undefined ? { documentId: String(file.documentId) } : {}),
  path: String(file.path),
  revision: file.revision,
  contentHash: String(file.contentHash),
  ...(file.mediaType !== undefined ? { mediaType: file.mediaType } : {}),
});

const errorFor = (error: unknown): ProtocolError => {
  if (error instanceof WorkspaceConflictError) {
    return { code: 'CONFLICT', message: 'O arquivo foi modificado fora da sessão.' };
  }
  if (error instanceof WorkspaceFileNotFoundError) {
    return { code: 'NOT_FOUND', message: 'Arquivo não encontrado no workspace.' };
  }
  if (error instanceof WorkspaceAlreadyExistsError) {
    return { code: 'CONFLICT', message: 'Já existe um arquivo neste caminho do vault.' };
  }
  return { code: 'INTERNAL', message: 'O Workspace Service não conseguiu concluir a operação.' };
};

/**
 * Catálogo vault-wide (F31/F33): `dto` é a projeção de produto que
 * `citationExplorer()` expõe; `entity` é o `BibliographicEntity` cru que só
 * `buildWorkspaceGraph` (F33, nós person/organization) precisa — nunca sai
 * pelo protocolo.
 */
interface VaultBibliographyEntry {
  readonly dto: WorkspaceReferenceDto;
  readonly entity: BibliographicEntity;
  readonly sourceFileId?: import('@abnt/workspace-core').WorkspaceFileId;
}

/** Chave BibTeX/CSL raramente tem caractere reservado de path, mas nunca confiar nisso. */
const sanitizeReferenceFileName = (referenceId: string): string => referenceId.replace(/[/\\:*?"<>|]/gu, '-');

const authorLabel = (author: { readonly family?: string; readonly given?: string; readonly literal?: string }): string =>
  author.literal ?? [author.family, author.given].filter((value): value is string => value !== undefined && value !== '').join(', ');

const citationSnippet = (content: string, start: number, end: number): string | undefined => {
  const paragraphStart = Math.max(0, content.lastIndexOf('\n\n', start) + 2);
  const followingBreak = content.indexOf('\n\n', end);
  const paragraphEnd = followingBreak === -1 ? content.length : followingBreak;
  const compact = content.slice(paragraphStart, paragraphEnd).replace(/\s+/gu, ' ').trim();
  if (compact === '') return undefined;
  return compact.length <= 280 ? compact : `${compact.slice(0, 277).trimEnd()}…`;
};

/**
 * Vínculo autoritativo nota↔referência é a citação `[@id]` no corpo — reaproveita
 * busca estruturada (F4), citation explorer (F31) e grafo (F5/F33) sem indexação
 * nova. `sourceReference` no frontmatter é só atalho de UI, não uma segunda fonte
 * de verdade: se divergir, a nota simplesmente some das projeções derivadas da
 * citação, mas continua existindo como arquivo comum.
 */
const literatureNoteContent = (referenceId: string, title: string): string => `---
title: "${title.replace(/"/gu, '\\"')}"
sourceReference: ${referenceId}
review:
  topic: ""
  method: ""
  sample: ""
  result: ""
---

# Notas de leitura — ${title}

> Fonte: [@${referenceId}]

## Read

## Annotate

## Cite

## Write
`;

const validDoi = (value: string): boolean => /^10\.\d{4,9}\/.+$/iu.test(value.trim());
const validIsbn = (value: string): boolean => {
  const digits = value.replace(/[-\s]/gu, '');
  if (/^\d{9}[\dX]$/iu.test(digits)) return [...digits].reduce((sum, digit, index) => sum + (digit.toUpperCase() === 'X' ? 10 : Number(digit)) * (10 - index), 0) % 11 === 0;
  if (!/^\d{13}$/u.test(digits)) return false;
  return [...digits].reduce((sum, digit, index) => sum + Number(digit) * (index % 2 === 0 ? 1 : 3), 0) % 10 === 0;
};
const hasYear = (entry: BibliographicEntity): boolean => entry.issued?.['date-parts']?.[0]?.[0] !== undefined || entry.issued?.literal !== undefined || entry.issued?.raw !== undefined;
const hasCompleteAuthor = (entry: BibliographicEntity): boolean => {
  const authors = entry.author ?? entry.editor;
  return authors !== undefined && authors.length > 0 && authors.every((author) => (author.literal?.trim() ?? '') !== '' || (author.family?.trim() ?? '') !== '');
};
const templateValue = (value: string): string => value.replace(/\r?\n/gu, ' ').trim();
const renderLiteratureTemplate = (template: string, values: Readonly<Record<string, string>>): string =>
  template.replace(/\{\{(referenceId|title|authors|year|doi)\}\}/gu, (_match, key: string) => values[key] ?? '');

const sourceRangeDto = (source: import('@abnt/document-model').SourceRange) => ({
  documentId: String(source.documentId),
  start: source.start,
  end: source.end,
});

/** Único dono de storage, SQLite, sessões e controllers de um vault desktop. */
export class DesktopWorkspaceServiceHost implements DesktopWorkspaceService {
  readonly #compiler: CompilerService;
  readonly #listeners = new Set<DesktopEventListener>();
  #storage: LocalFilesystemStorage | undefined;
  #index: SqliteWorkspaceIndex | undefined;
  #sessions: DocumentSessionsService | undefined;
  #editors: EditorWorkspaceService | undefined;
  #language: WorkspaceLanguageService | undefined;
  #history: WorkspaceHistory | undefined;
  #plugins: WorkspacePluginCatalog | undefined;
  #rootPath: string | undefined;
  #openResponse: WorkspaceOpenResponse | undefined;
  #unsubscribeWorkspace: (() => void) | undefined;
  readonly #unsubscribeEditor = new Map<string, () => void>();

  constructor(options: DesktopWorkspaceServiceOptions) {
    this.#compiler = options.compiler;
  }

  static create(options: DesktopWorkspaceServiceOptions): DesktopWorkspaceServiceHost {
    return new DesktopWorkspaceServiceHost(options);
  }

  subscribe(listener: DesktopEventListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async open(request: WorkspaceOpenRequest): Promise<ProtocolResult<WorkspaceOpenResponse>> {
    return this.#run(async () => {
      // F40: janelas novas restauram o mesmo vault; reabrir não pode destruir
      // sessões, editores ou a única autoridade de workspace já em uso.
      if (this.#rootPath === request.rootPath && this.#openResponse !== undefined) {
        return { ...this.#openResponse, files: (await this.#requireStorage().list()).map(workspaceFileDto) };
      }
      await this.#disposeWorkspace();
      const storage = LocalFilesystemStorage.create(request.rootPath);
      const opened = await storage.open();
      const index = SqliteWorkspaceIndex.create({
        storage,
        databasePath: join(request.rootPath, '.academic', 'index.sqlite'),
      });
      await index.open();
      const sessions = DocumentSessionsService.create({
        storage,
        compiler: this.#compiler,
        environment: criarResolvedorDeAmbienteLocal(storage),
        hashContent: (content) => `sha256:${createHash('sha256').update(content).digest('hex')}`,
        autoCompile: true,
      });
      const language = WorkspaceLanguageService.create({
        storage,
        index,
        sessions,
        referencesFor: async (fileId) => this.#referenceCatalog(fileId),
      });
      const editors = EditorWorkspaceService.create({ sessions, language });

      this.#storage = storage;
      this.#index = index;
      this.#sessions = sessions;
      this.#editors = editors;
      this.#language = language;
      this.#history = new WorkspaceHistory(request.rootPath);
      this.#plugins = new WorkspacePluginCatalog(request.rootPath);
      await this.#plugins.discover();
      this.#rootPath = request.rootPath;
      this.#unsubscribeWorkspace = storage.subscribe((event) => {
        const dto = this.#workspaceEventDto(event);
        if (dto !== undefined) this.#emit({ type: 'desktop:workspace-event', event: dto });
        if (event.type === 'workspace:recovery-conflict') {
          this.#emit({
            type: 'desktop:operational-error',
            operation: 'workspace:recovery',
            error: {
              code: 'CONFLICT',
              message: 'Há um rascunho de recuperação que conflita com o arquivo persistido.',
            },
          });
        }
      });

      const response: WorkspaceOpenResponse = {
        workspaceId: String(opened.workspaceId),
        configuration: {
          ...(opened.configuration.defaultProfileId !== undefined
            ? { defaultProfileId: opened.configuration.defaultProfileId }
            : {}),
          ignoredPaths: (opened.configuration.ignoredPaths ?? []).map(String),
        },
        files: opened.files.map(workspaceFileDto),
      };
      this.#openResponse = response;
      return response;
    });
  }

  async list(request: WorkspaceListRequest): Promise<ProtocolResult<readonly WorkspaceFileDto[]>> {
    return this.#run(async () => {
      const storage = this.#requireStorage();
      const files = await storage.list(request.path === undefined ? undefined : asWorkspacePath(request.path));
      return files.map(workspaceFileDto);
    });
  }

  async read(request: WorkspaceReadRequest): Promise<ProtocolResult<WorkspaceReadResponse>> {
    return this.#run(async () => {
      const content = await this.#requireStorage().read(asWorkspaceFileId(request.fileId));
      return { file: workspaceFileDto(content.file), content: content.content };
    });
  }

  async openEditor(request: EditorOpenRequest): Promise<ProtocolResult<EditorSnapshotDto>> {
    return this.#run(async () => {
      const fileId = asWorkspaceFileId(request.fileId);
      const controller = await this.#requireEditors().open(fileId);
      if (!this.#unsubscribeEditor.has(request.fileId)) {
        const unsubscribe = controller.subscribe((event) => {
          if (event.type === 'editor:closed') {
            this.#unsubscribeEditor.get(request.fileId)?.();
            this.#unsubscribeEditor.delete(request.fileId);
            this.#emit({ type: 'desktop:editor-closed', fileId: request.fileId });
            return;
          }
          this.#emit({ type: 'desktop:editor-updated', snapshot: this.#editorSnapshotDto(event.snapshot) });
        });
        this.#unsubscribeEditor.set(request.fileId, unsubscribe);
      }
      return this.#editorSnapshotDto(controller.snapshot());
    });
  }

  async editorSnapshot(request: EditorSnapshotRequest): Promise<ProtocolResult<EditorSnapshotDto>> {
    return this.#run(async () => this.#editorSnapshotFor(request.fileId));
  }

  async dispatchEditor(request: EditorDispatchRequest): Promise<ProtocolResult<EditorSnapshotDto>> {
    return this.#run(async () => {
      const controller = this.#requireEditors().controller(asWorkspaceFileId(request.fileId));
      if (controller === undefined) throw new WorkspaceFileNotFoundError(asWorkspaceFileId(request.fileId));
      if (controller.snapshot().session.revision !== request.expectedRevision) {
        throw new WorkspaceConflictError(
          asWorkspaceFileId(request.fileId),
          request.expectedRevision,
          controller.snapshot().session.revision,
        );
      }
      const snapshot = controller.dispatch({
        ...(request.transaction.edits !== undefined ? { edits: request.transaction.edits } : {}),
        ...(request.transaction.selection !== undefined ? { selection: request.transaction.selection } : {}),
      });
      return this.#editorSnapshotDto(snapshot);
    });
  }

  async saveEditor(request: EditorSaveRequest): Promise<ProtocolResult<EditorSnapshotDto>> {
    return this.#run(async () => {
      const controller = this.#requireEditors().controller(asWorkspaceFileId(request.fileId));
      if (controller === undefined) throw new WorkspaceFileNotFoundError(asWorkspaceFileId(request.fileId));
      if (controller.snapshot().session.revision !== request.expectedRevision) {
        throw new WorkspaceConflictError(
          asWorkspaceFileId(request.fileId),
          request.expectedRevision,
          controller.snapshot().session.revision,
        );
      }
      return this.#editorSnapshotDto(await controller.save());
    });
  }

  async closeEditor(request: EditorCloseRequest): Promise<ProtocolResult<undefined>> {
    return this.#run(async () => {
      this.#requireEditors().close(asWorkspaceFileId(request.fileId));
      return undefined;
    });
  }

  async resolveEditorConflict(request: EditorResolveConflictRequest): Promise<ProtocolResult<EditorSnapshotDto>> {
    return this.#run(async () => {
      const fileId = asWorkspaceFileId(request.fileId);
      const controller = this.#requireEditors().controller(fileId);
      if (controller === undefined) throw new WorkspaceFileNotFoundError(fileId);
      return this.#editorSnapshotDto(await controller.resolveExternalConflict(request.resolution));
    });
  }

  /**
   * HTML "rápido" sob demanda a partir da Publication AST que a sessão já
   * mantém revisionada. `undefined` enquanto nenhuma compilação bem-sucedida
   * ainda produziu preview — não é erro, é estado inicial legítimo.
   */
  async previewEditor(request: EditorPreviewRequest): Promise<ProtocolResult<EditorPreviewDto | undefined>> {
    return this.#run(async () => {
      const fileId = asWorkspaceFileId(request.fileId);
      const controller = this.#requireEditors().controller(fileId);
      if (controller === undefined) throw new WorkspaceFileNotFoundError(fileId);
      const snapshot = controller.snapshot();
      const preview = snapshot.preview;
      if (preview === undefined) return undefined;
      return {
        fileId: request.fileId,
        revision: preview.revision,
        profileId: preview.profileId,
        html: renderizarHtml(await this.#publicationWithResolvedResources(preview.publication, fileId), { preview: true }),
      };
    });
  }

  /**
   * Publication AST crua da sessão, para o Export Service gerar PDF/DOCX fora
   * do processo de compilação. Mesma fonte que `previewEditor` usa para HTML
   * — não recompila, não decide formato: isso é papel de quem consome.
   */
  async exportDocument(request: EditorExportRequest): Promise<ProtocolResult<EditorExportDto | undefined>> {
    return this.#run(async () => {
      const fileId = asWorkspaceFileId(request.fileId);
      const controller = this.#requireEditors().controller(fileId);
      if (controller === undefined) throw new WorkspaceFileNotFoundError(fileId);
      const preview = controller.snapshot().preview;
      if (preview === undefined) return undefined;
      return { fileId: request.fileId, revision: preview.revision, publication: await this.#publicationWithResolvedResources(preview.publication, fileId) };
    });
  }

  /**
   * Só o índice persistido — mesmo caminho que sobrevive a `rm index.sqlite`.
   * Sintaxe estruturada (`cites:`, `has:figure`, `linksto:`, `type:`) é um
   * Query AST/Planner sobre o mesmo índice (F4); texto livre continua puro
   * FTS5, sem AST nenhum de permeio.
   */
  async search(request: WorkspaceSearchRequest): Promise<ProtocolResult<readonly WorkspaceSearchResultDto[]>> {
    return this.#run(async () => {
      const ast = parseStructuredQuery(request.query);
      const results = await executeStructuredQuery(
        ast,
        {
          index: this.#requireIndex(),
          storage: this.#requireStorage(),
          metadata: async () => {
            const storage = this.#requireStorage();
            return scanQueryMetadata(storage, await storage.list());
          },
        },
        request.limit,
      );
      return results.map((result) => ({
        fileId: String(result.fileId),
        path: String(result.path),
        title: result.title,
        snippet: result.snippet,
        score: result.score,
        ...(result.section === undefined ? {} : { section: result.section }),
      }));
    });
  }

  /** F83: o host produz a projeção vault-wide; o renderer não recompila nem parseia Markdown. */
  async problems(request: WorkspaceProblemsRequest): Promise<ProtocolResult<readonly WorkspaceProblemDto[]>> {
    return this.#run(async () => {
      const storage = this.#requireStorage();
      const editors = this.#requireEditors();
      const sessions = this.#requireSessions();
      const index = this.#requireIndex();
      const selected = request.fileIds === undefined ? undefined : new Set(request.fileIds);
      const files = (await storage.list()).filter((file) => /\.md$/iu.test(String(file.path)) && (selected === undefined || selected.has(String(file.id))));
      const result: WorkspaceProblemDto[] = [];
      for (const file of files) {
        const alreadyOpen = editors.controller(file.id) !== undefined;
        const controller = alreadyOpen ? editors.controller(file.id) : await editors.open(file.id);
        if (controller === undefined) continue;
        await sessions.idle(file.id);
        const snapshot = controller.snapshot();
        const headings = index.headings(file.id);
        const diagnostics = [...await this.#requireLanguage().diagnostics(file.id), ...(snapshot.session.resolved === undefined ? [] : await this.#requirePlugins().languageDiagnostics(snapshot.session.resolved))];
        for (const diagnostic of diagnostics) {
          const start = diagnostic.source?.start.offset;
          const end = diagnostic.source?.end.offset;
          const section = start === undefined ? undefined : headings.filter((heading) => heading.sourceStart !== undefined && heading.sourceStart <= start).at(-1)?.title;
          result.push({
            fileId: String(file.id), path: String(file.path), revision: snapshot.session.revision,
            severity: diagnostic.severity, ruleId: diagnostic.id, message: diagnostic.message,
            ...(start === undefined || end === undefined ? {} : { range: { start, end } }),
            ...(section === undefined ? {} : { section }),
          });
        }
        if (!alreadyOpen) await editors.close(file.id);
      }
      return result.sort((left, right) => left.path.localeCompare(right.path) || (left.range?.start ?? -1) - (right.range?.start ?? -1) || left.ruleId.localeCompare(right.ruleId));
    });
  }

  async plugins(): Promise<ProtocolResult<readonly WorkspacePluginDto[]>> { return this.#run(async () => this.#requirePlugins().list()); }
  async setPluginEnabled(request: WorkspacePluginSetEnabledRequest): Promise<ProtocolResult<readonly WorkspacePluginDto[]>> { return this.#run(async () => this.#requirePlugins().setEnabled(request.id, request.enabled)); }
  async reloadPlugins(): Promise<ProtocolResult<readonly WorkspacePluginDto[]>> { return this.#run(async () => this.#requirePlugins().reload()); }
  async runPluginCommand(request: WorkspacePluginCommandRequest): Promise<ProtocolResult<WorkspacePluginCommandResultDto>> { return this.#run(async () => this.#requirePlugins().command(request.pluginId, request.commandId, { ...(request.activeFileId === undefined ? {} : { activeFileId: request.activeFileId }), ...(request.activeRevision === undefined ? {} : { activeRevision: request.activeRevision }) })); }
  async exportWithPlugin(request: WorkspacePluginExportRequest): Promise<ProtocolResult<WorkspacePluginExportDto>> {
    return this.#run(async () => {
      const fileId = asWorkspaceFileId(request.fileId);
      const controller = this.#requireEditors().controller(fileId);
      if (controller === undefined) throw new WorkspaceFileNotFoundError(fileId);
      const before = controller.snapshot();
      if (before.session.revision !== request.expectedRevision || before.preview === undefined || before.preview.revision !== request.expectedRevision) throw new WorkspaceConflictError(fileId, request.expectedRevision, before.session.revision);
      const descriptor = this.#requirePlugins().list().find((plugin) => plugin.id === request.pluginId)?.exports.find((output) => output.id === request.exportId);
      if (descriptor === undefined) throw new Error('Contribuição de exportação não encontrada ou não habilitada.');
      const publication = await this.#publicationWithResolvedResources(before.preview.publication, fileId);
      const result = await this.#requirePlugins().export(request.pluginId, request.exportId, publication);
      const after = controller.snapshot();
      if (after.session.revision !== request.expectedRevision || after.preview?.revision !== request.expectedRevision) throw new WorkspaceConflictError(fileId, request.expectedRevision, after.session.revision);
      return { title: before.preview.publication.title, extension: descriptor.extension, mimeType: descriptor.mimeType, content: result.content };
    });
  }

  /**
   * Formata com o mesmo motor ABNT do compilador (`@abnt/bibliography`) — não
   * reimplementa a regra de formatação para a UI, só a chama sob demanda.
   */
  async references(request: WorkspaceReferencesRequest): Promise<ProtocolResult<readonly WorkspaceReferenceDto[]>> {
    return this.#run(async () => {
      const fileId = asWorkspaceFileId(request.fileId);
      const controller = this.#requireEditors().controller(fileId);
      if (controller === undefined) throw new WorkspaceFileNotFoundError(fileId);
      const bibliography = controller.snapshot().bibliography;
      if (bibliography === undefined) return [];

      const files = await this.#requireStorage().list();
      return Object.entries(bibliography.entries).map(([id, entry]) => this.#referenceDtoFrom(id, entry, bibliography, files));
    });
  }

  /**
   * Mesma projeção que `references()` já produz para um documento — extraída
   * para ser reaproveitada por `citationExplorer()` (F31), que agrega
   * bibliografia de vários documentos, nunca uma segunda regra de formatação.
   */
  #referenceDtoFrom(
    id: string,
    entry: unknown,
    bibliography: NonNullable<import('@abnt/editor-core').EditorSnapshot['bibliography']>,
    files: readonly WorkspaceFile[],
  ): WorkspaceReferenceDto {
    const sourceFileFor = (uri: string | undefined): WorkspaceFileDto | undefined => {
      if (uri === undefined) return undefined;
      const file = files.find((candidate) => String(candidate.path) === uri);
      return file === undefined ? undefined : workspaceFileDto(file);
    };
    const labelFor = (uri: string | undefined, fallback: string): string => uri?.split('/').at(-1) ?? fallback;

    const provenance = bibliography.provenanceByReference[id]?.[0];
    const source = bibliography.sources.find((candidate) => candidate.id === provenance?.sourceId);
    const sourceFile = sourceFileFor(source?.resolvedUri);
    return {
      id,
      type: (entry as { readonly type: string }).type,
      formatted: referenciaComoTexto(formatarReferenciaAbnt(entry as unknown as BibliographicEntity)),
      sourceLabel: labelFor(source?.resolvedUri, source?.id ?? 'desconhecida'),
      ...(source?.resolvedUri !== undefined ? { sourceUri: source.resolvedUri } : {}),
      ...(sourceFile !== undefined ? { sourceFileId: sourceFile.fileId } : {}),
    };
  }

  /**
   * Catálogo bibliográfico do vault inteiro (F31/F33) — pré-filtra por
   * frontmatter (regex+YAML, nunca `@abnt/markdown`) quais documentos
   * declaram `bibliography:`, resolve só esses via o mesmo pipeline de
   * compilação existente (P12/ADR 0017), e fecha as sessões que abriu para
   * isso. Documentos já abertos pelo usuário não são fechados.
   */
  async #resolveVaultBibliography(): Promise<Map<string, VaultBibliographyEntry>> {
    const storage = this.#requireStorage();
    const editors = this.#requireEditors();
    const sessions = this.#requireSessions();
    const files = await storage.list();
    const declared = await scanBibliographyDeclarations(storage, files);
    const catalog = new Map<string, VaultBibliographyEntry>();
    const library = await readLibrary(storage);
    const libraryFile = files.find((file) => String(file.path) === 'references/library.json');
    for (const [id, entity] of Object.entries(library)) {
      const dto: WorkspaceReferenceDto = {
        id,
        type: entity.type,
        formatted: referenciaComoTexto(formatarReferenciaAbnt(entity)),
        sourceLabel: 'library.json',
        sourceUri: 'references/library.json',
        ...(libraryFile === undefined ? {} : { sourceFileId: String(libraryFile.id) }),
      };
      catalog.set(id, {
        dto,
        entity,
        ...(libraryFile === undefined ? {} : { sourceFileId: libraryFile.id }),
      });
    }

    for (const file of declared) {
      const alreadyOpen = editors.controller(file.id) !== undefined;
      const controller = alreadyOpen ? editors.controller(file.id) : await editors.open(file.id);
      if (controller === undefined) continue;
      await sessions.idle(file.id);
      const bibliography = controller.snapshot().bibliography;
      if (bibliography !== undefined) {
        for (const [id, entry] of Object.entries(bibliography.entries)) {
          if (catalog.has(id)) continue;
          const dto = this.#referenceDtoFrom(id, entry, bibliography, files);
          catalog.set(id, {
            dto,
            entity: { ...(entry as object), id: asReferenceId(id) } as BibliographicEntity,
            ...(dto.sourceFileId !== undefined ? { sourceFileId: asWorkspaceFileId(dto.sourceFileId) } : {}),
          });
        }
      }
      if (!alreadyOpen) editors.close(file.id);
    }
    return catalog;
  }

  /**
   * Agrupa `index.citations()` (vault inteiro) por referência, localizando a
   * seção que contém cada citação via `index.headings()` — nenhuma indexação
   * nova. `uncited` reaproveita `#resolveVaultBibliography()`; referências
   * nunca citadas em documento algum aparecem lá mesmo sem `.bib` aberto.
   */
  async citationExplorer(_request: WorkspaceCitationExplorerRequest): Promise<ProtocolResult<WorkspaceCitationExplorerResponseDto>> {
    return this.#run(async () => {
      const index = this.#requireIndex();
      const citations = index.citations();
      const byReference = new Map<string, typeof citations[number][]>();
      for (const citation of citations) {
        const list = byReference.get(citation.referenceId);
        if (list === undefined) byReference.set(citation.referenceId, [citation]);
        else list.push(citation);
      }

      const headingsCache = new Map<string, ReturnType<typeof index.headings>>();
      const contentCache = new Map<string, string>();
      const sectionTitleFor = (fileId: ReturnType<typeof asWorkspaceFileId>, offset: number): string | undefined => {
        const key = String(fileId);
        let headings = headingsCache.get(key);
        if (headings === undefined) {
          headings = index.headings(fileId);
          headingsCache.set(key, headings);
        }
        return headings.filter((heading) => heading.sourceStart !== undefined && heading.sourceStart <= offset).at(-1)?.title;
      };
      const snippetFor = async (fileId: ReturnType<typeof asWorkspaceFileId>, start: number, end: number): Promise<string | undefined> => {
        const key = String(fileId);
        let content = contentCache.get(key);
        if (content === undefined) {
          content = (await this.#requireStorage().read(fileId)).content;
          contentCache.set(key, content);
        }
        return citationSnippet(content, start, end);
      };

      const catalog = await this.#resolveVaultBibliography();
      const cited: CitationExplorerEntryDto[] = await Promise.all([...byReference.entries()].map(async ([referenceId, entries]) => {
        const known = catalog.get(referenceId);
        return {
          referenceId,
          ...(known !== undefined ? { formatted: known.dto.formatted } : {}),
          count: entries.length,
          locations: (await Promise.all(entries.map(async (entry): Promise<CitationExplorerLocationDto | undefined> => {
            if (entry.sourceStart === undefined || entry.sourceEnd === undefined) return undefined;
            const sectionTitle = sectionTitleFor(entry.fileId, entry.sourceStart);
            const snippet = await snippetFor(entry.fileId, entry.sourceStart, entry.sourceEnd);
            return {
              fileId: String(entry.fileId),
              path: String(entry.path),
              ...(sectionTitle !== undefined ? { sectionTitle } : {}),
              ...(snippet === undefined ? {} : { snippet }),
              range: { start: entry.sourceStart, end: entry.sourceEnd },
            };
          }))).flatMap((location) => location === undefined ? [] : [location]),
        };
      }));
      const uncited = [...catalog.values()].flatMap((entry) => (byReference.has(entry.dto.id) ? [] : [entry.dto]));

      return { cited, uncited };
    });
  }

  /** F45–F47: cruza as fontes existentes sem transformar SQLite em fonte canônica. */
  async researchOverview(_request: WorkspaceResearchOverviewRequest): Promise<ProtocolResult<WorkspaceResearchOverviewDto>> {
    return this.#run(async () => {
      const storage = this.#requireStorage();
      const files = await storage.list();
      const catalog = await this.#resolveVaultBibliography();
      const citations = this.#requireIndex().citations();
      const citationCounts = new Map<string, number>();
      for (const citation of citations) citationCounts.set(citation.referenceId, (citationCounts.get(citation.referenceId) ?? 0) + 1);
      const attachmentByReference = new Map((await readReferenceAttachments(storage)).map((attachment) => [attachment.referenceId, attachment]));
      const notesByReference = new Map((await scanLiteratureReviewNotes(storage, files)).map((note) => [note.referenceId, note]));
      const references: WorkspaceResearchReferenceDto[] = [...catalog.entries()].map(([referenceId, entry]) => {
        const attachment = attachmentByReference.get(referenceId);
        const pdf = attachment === undefined ? undefined : files.find((file) => String(file.id) === attachment.fileId && String(file.path) === attachment.path);
        const note = notesByReference.get(referenceId);
        return {
          referenceId,
          title: entry.entity.title ?? referenceId,
          authors: (entry.entity.author ?? []).map(authorLabel).filter((name) => name !== ''),
          ...(entry.entity.DOI === undefined ? {} : { doi: entry.entity.DOI }),
          citationCount: citationCounts.get(referenceId) ?? 0,
          ...(pdf === undefined ? {} : { pdf: workspaceFileDto(pdf) }),
          ...(note === undefined ? {} : { literatureNote: workspaceFileDto(note.file) }),
          review: note?.review ?? {},
        };
      });
      return { references: references.sort((left, right) => left.title.localeCompare(right.title, 'pt-BR')) };
    });
  }

  /**
   * F6: biblioteca gerenciada do vault (`references/library.json`,
   * CSL-JSON). SQLite nunca é a fonte canônica — `readLibrary`/
   * `upsertLibraryEntry`/`removeLibraryEntry` (`./reference-library.js`) só
   * leem/escrevem o arquivo via `WorkspaceStorage`, revisionado como
   * qualquer outro arquivo do vault.
   */
  async libraryList(_request: WorkspaceLibraryListRequest): Promise<ProtocolResult<readonly BibliographicEntityDto[]>> {
    return this.#run(async () => {
      const entries = await readLibrary(this.#requireStorage());
      return Object.entries(entries).map(([id, entry]) => ({ ...entry, id }));
    });
  }

  async libraryUpsert(request: WorkspaceLibraryUpsertRequest): Promise<ProtocolResult<BibliographicEntityDto>> {
    return this.#run(async () => {
      const { id, ...rest } = request.entry;
      await upsertLibraryEntry(this.#requireStorage(), id, { ...rest, id: asReferenceId(id) });
      return request.entry;
    });
  }

  async libraryRemove(request: WorkspaceLibraryRemoveRequest): Promise<ProtocolResult<undefined>> {
    return this.#run(async () => {
      await removeLibraryEntry(this.#requireStorage(), request.id);
      return undefined;
    });
  }

  async libraryFormat(request: WorkspaceLibraryFormatRequest): Promise<ProtocolResult<string>> {
    return this.#run(async () => {
      const { id, ...entry } = request.entry;
      return referenciaComoTexto(formatarReferenciaAbnt({ ...entry, id: asReferenceId(id) }));
    });
  }

  async libraryResolveDoi(request: WorkspaceLibraryResolveDoiRequest): Promise<ProtocolResult<BibliographicEntityDto>> {
    return this.#run(async () => {
      const entry = await resolveDoi(request.doi);
      return { ...entry, id: String(entry.id) };
    });
  }

  async libraryImport(request: WorkspaceLibraryImportRequest): Promise<ProtocolResult<WorkspaceLibraryImportResponseDto>> {
    return this.#run(async () => {
      const imported = importLibraryContent(request.format, request.content);
      const storage = this.#requireStorage();
      const entries = Object.entries(imported.entries);
      for (const [id, entry] of entries) await upsertLibraryEntry(storage, id, entry);
      return {
        imported: entries.map(([id, entry]) => ({ ...entry, id })),
        diagnostics: imported.diagnostics.map((diagnostic) => ({
          id: diagnostic.id, severity: diagnostic.severity, message: diagnostic.message,
        })),
      };
    });
  }

  /** F53: sinais são devolvidos com a razão; detectar nunca altera CSL-JSON. */
  async libraryDuplicates(_request: WorkspaceLibraryDuplicatesRequest): Promise<ProtocolResult<readonly WorkspaceLibraryDuplicateDto[]>> {
    return this.#run(async () => findReferenceDuplicates(await readLibrary(this.#requireStorage())));
  }

  /** F54: o usuário revisa a entrada antes da transação; o host só aplica tudo atomicamente por autoridade. */
  async libraryMerge(request: WorkspaceLibraryMergeRequest): Promise<ProtocolResult<WorkspaceLibraryMergeResponseDto>> {
    return this.#run(async () => {
      if (request.canonicalId === request.duplicateId || request.entry.id !== request.canonicalId) throw new Error('A referência canônica e a duplicada precisam ser distintas.');
      const storage = this.#requireStorage();
      const entries = await readLibrary(storage);
      if (entries[request.canonicalId] === undefined || entries[request.duplicateId] === undefined) throw new WorkspaceFileNotFoundError(asWorkspaceFileId(request.duplicateId));
      const changedFiles = await this.#renameReferenceKey(request.duplicateId, request.canonicalId);
      const { id: _id, ...entry } = request.entry;
      const next = { ...entries, [request.canonicalId]: { ...entry, id: asReferenceId(request.canonicalId) } };
      delete next[request.duplicateId];
      await replaceLibraryEntries(storage, next);
      await moveReferenceAttachment(storage, request.duplicateId, request.canonicalId);
      await movePdfAnnotations(storage, request.duplicateId, request.canonicalId);
      return { entry: request.entry, changedFiles };
    });
  }

  async libraryKeyPreview(request: WorkspaceLibraryKeyPreviewRequest): Promise<ProtocolResult<WorkspaceLibraryKeyPreviewDto>> {
    return this.#run(async () => {
      const entries = await readLibrary(this.#requireStorage());
      const entry = entries[request.id];
      if (entry === undefined) throw new WorkspaceFileNotFoundError(asWorkspaceFileId(request.id));
      const occupied = new Set(Object.keys(entries)); occupied.delete(request.id);
      return { id: request.id, policy: request.policy, suggestion: suggestReferenceKey(entry, request.policy, occupied) };
    });
  }

  /** F55: troca chave, citações e o atalho de literature note numa única autoridade revisionada. */
  async libraryRenameKey(request: WorkspaceLibraryRenameKeyRequest): Promise<ProtocolResult<WorkspaceLibraryRenameKeyResponseDto>> {
    return this.#run(async () => {
      const nextId = request.nextId.trim();
      if (!/^[\p{L}\p{N}_:-]+$/u.test(nextId)) throw new Error('A chave deve conter apenas letras, números, _, : ou -.');
      const storage = this.#requireStorage();
      const entries = await readLibrary(storage);
      const entry = entries[request.id];
      if (entry === undefined) throw new WorkspaceFileNotFoundError(asWorkspaceFileId(request.id));
      if (request.id === nextId) return { entry: { ...entry, id: request.id }, changedFiles: [] };
      if (entries[nextId] !== undefined) throw new WorkspaceAlreadyExistsError(asWorkspacePath(`references/${nextId}`));
      const changedFiles = await this.#renameReferenceKey(request.id, nextId);
      const { [request.id]: _removed, ...rest } = entries;
      const renamed = { ...entry, id: asReferenceId(nextId) };
      await replaceLibraryEntries(storage, { ...rest, [nextId]: renamed });
      await moveReferenceAttachment(storage, request.id, nextId);
      await movePdfAnnotations(storage, request.id, nextId);
      return { entry: { ...renamed, id: nextId }, changedFiles };
    });
  }

  async referenceHealth(_request: WorkspaceReferenceHealthRequest): Promise<ProtocolResult<WorkspaceReferenceHealthDto>> {
    return this.#run(async () => {
      const storage = this.#requireStorage();
      const files = await storage.list();
      const catalog = await this.#resolveVaultBibliography();
      const citedIds = new Set(this.#requireIndex().citations().map((citation) => citation.referenceId));
      const missing = [...citedIds].filter((id) => !catalog.has(id)).sort();
      const cited = [...catalog.keys()].filter((id) => citedIds.has(id)).length;
      const attachmentIds = new Set((await readReferenceAttachments(storage)).map((attachment) => attachment.referenceId));
      const noteIds = new Set((await scanLiteratureReviewNotes(storage, files)).map((note) => note.referenceId));
      const duplicates = findReferenceDuplicates(Object.fromEntries([...catalog.entries()].map(([id, entry]) => [id, entry.entity])));
      const duplicateIds = new Set(duplicates.flatMap((pair) => [pair.leftId, pair.rightId]));
      const audit: import('@abnt/protocol').WorkspaceReferenceAuditIssueDto[] = [];
      for (const [referenceId, item] of catalog) {
        const entry = item.entity;
        if (entry.DOI !== undefined && !validDoi(entry.DOI)) audit.push({ referenceId, code: 'invalid-doi', message: 'DOI inválido.' });
        if (entry.ISBN !== undefined && !validIsbn(entry.ISBN)) audit.push({ referenceId, code: 'invalid-isbn', message: 'ISBN inválido.' });
        if (entry.URL === undefined) audit.push({ referenceId, code: 'missing-url', message: 'URL ausente.' });
        if (entry.URL !== undefined && entry.accessed === undefined) audit.push({ referenceId, code: 'missing-access-date', message: 'Data de acesso ausente para URL.' });
        if (!hasCompleteAuthor(entry)) audit.push({ referenceId, code: 'incomplete-author', message: 'Autor ou editor incompleto.' });
        if (!hasYear(entry)) audit.push({ referenceId, code: 'missing-year', message: 'Ano ausente.' });
        if (duplicateIds.has(referenceId)) audit.push({ referenceId, code: 'possible-duplicate', message: 'Possível duplicata na biblioteca.' });
        const expectedKey = suggestReferenceKey(entry, 'author-year', new Set());
        if (expectedKey !== referenceId) audit.push({ referenceId, code: 'inconsistent-key', message: `Chave difere da política autor-ano sugerida (${expectedKey}).` });
        if (!attachmentIds.has(referenceId)) audit.push({ referenceId, code: 'missing-pdf', message: 'PDF de pesquisa ausente.' });
        if (!noteIds.has(referenceId)) audit.push({ referenceId, code: 'missing-literature-note', message: 'Literature note ausente.' });
      }
      return {
        total: catalog.size,
        cited,
        unused: catalog.size - cited,
        missing,
        withoutDoi: [...catalog.values()].filter((entry) => entry.entity.DOI === undefined).length,
        audit: audit.sort((left, right) => left.referenceId.localeCompare(right.referenceId) || left.code.localeCompare(right.code)),
      };
    });
  }

  async referenceAttachments(_request: import('@abnt/protocol').WorkspaceReferenceAttachmentsRequest): Promise<ProtocolResult<readonly import('@abnt/protocol').WorkspaceReferenceAttachmentDto[]>> {
    return this.#run(async () => {
      const storage = this.#requireStorage(); const files = await storage.list();
      return (await readReferenceAttachments(storage)).flatMap((attachment) => {
        const file = files.find((candidate) => String(candidate.id) === attachment.fileId && String(candidate.path) === attachment.path);
        return file === undefined ? [] : [{ referenceId: attachment.referenceId, file: workspaceFileDto(file), mediaType: 'application/pdf' as const }];
      });
    });
  }

  async attachReferencePdf(request: import('@abnt/protocol').WorkspaceAttachReferencePdfRequest): Promise<ProtocolResult<import('@abnt/protocol').WorkspaceReferenceAttachmentDto>> {
    return this.#run(async () => {
      const storage = this.#requireStorage();
      if (storage.createBinary === undefined) throw new Error('O backend do vault não suporta recursos binários.');
      if ((await readLibrary(storage))[request.referenceId] === undefined) throw new WorkspaceFileNotFoundError(asWorkspaceFileId(request.referenceId));
      const clean = basename(request.name).replace(/[^a-zA-Z0-9._-]/gu, '-').replace(/^-+|[-]+$/gu, '') || 'artigo.pdf';
      const name = clean.toLowerCase().endsWith('.pdf') ? clean : `${clean}.pdf`;
      const stem = name.slice(0, -4); const files = await storage.list(); let suffix = 0; let path = `resources/papers/${stem}.pdf`;
      while (files.some((file) => String(file.path) === path)) path = `resources/papers/${stem}-${++suffix}.pdf`;
      const file = await storage.createBinary({ path: asWorkspacePath(path), bytes: Buffer.from(request.base64, 'base64') });
      await setReferenceAttachment(storage, { referenceId: request.referenceId, fileId: String(file.id), path, mediaType: 'application/pdf' });
      return { referenceId: request.referenceId, file: workspaceFileDto(file), mediaType: 'application/pdf' };
    });
  }

  async removeReferenceAttachment(request: import('@abnt/protocol').WorkspaceReferenceAttachmentRequest): Promise<ProtocolResult<undefined>> {
    return this.#run(async () => { await removeReferenceAttachment(this.#requireStorage(), request.referenceId); return undefined; });
  }

  /** F36: conteúdo do PDF transita sem revelar a localização física do vault. */
  async referencePdf(request: import('@abnt/protocol').WorkspaceReferenceAttachmentRequest): Promise<ProtocolResult<import('@abnt/protocol').WorkspaceReferencePdfDto>> {
    return this.#run(async () => {
      const storage = this.#requireStorage();
      const attachment = (await readReferenceAttachments(storage)).find((entry) => entry.referenceId === request.referenceId);
      if (attachment === undefined) throw new WorkspaceFileNotFoundError(asWorkspaceFileId(request.referenceId));
      const content = await storage.readBinary(asWorkspaceFileId(attachment.fileId));
      return {
        attachment: { referenceId: attachment.referenceId, file: workspaceFileDto(content.file), mediaType: 'application/pdf' },
        base64: Buffer.from(content.bytes).toString('base64'),
      };
    });
  }

  async pdfAnnotations(request: import('@abnt/protocol').WorkspaceReferenceAttachmentRequest): Promise<ProtocolResult<readonly import('@abnt/protocol').WorkspacePdfAnnotationDto[]>> {
    return this.#run(async () => (await readPdfAnnotations(this.#requireStorage()))
      .filter((annotation) => annotation.referenceId === request.referenceId)
      .sort((left, right) => left.page - right.page || left.createdAt.localeCompare(right.createdAt)));
  }

  async createPdfAnnotation(request: import('@abnt/protocol').WorkspaceCreatePdfAnnotationRequest): Promise<ProtocolResult<import('@abnt/protocol').WorkspacePdfAnnotationDto>> {
    return this.#run(async () => {
      const annotation: PdfAnnotation = {
        id: randomUUID(), referenceId: request.referenceId, page: request.page,
        quote: request.quote.trim(), createdAt: new Date().toISOString(),
        ...(request.comment?.trim() === '' || request.comment === undefined ? {} : { comment: request.comment.trim() }),
      };
      await addPdfAnnotation(this.#requireStorage(), annotation);
      return annotation;
    });
  }

  async removePdfAnnotation(request: import('@abnt/protocol').WorkspacePdfAnnotationRequest): Promise<ProtocolResult<undefined>> {
    return this.#run(async () => { await removeStoredPdfAnnotation(this.#requireStorage(), request.referenceId, request.id); return undefined; });
  }

  async linkPdfAnnotation(request: import('@abnt/protocol').WorkspacePdfAnnotationRequest): Promise<ProtocolResult<import('@abnt/protocol').WorkspacePdfAnnotationLinkDto>> {
    return this.#run(async () => {
      const storage = this.#requireStorage();
      const annotation = (await readPdfAnnotations(storage)).find((entry) => entry.referenceId === request.referenceId && entry.id === request.id);
      if (annotation === undefined) throw new WorkspaceFileNotFoundError(asWorkspaceFileId(request.id));
      const note = await this.#ensureLiteratureNote(request.referenceId);
      const current = await storage.read(asWorkspaceFileId(note.fileId));
      const marker = `<!-- folio-pdf-annotation:${annotation.id} -->`;
      if (!current.content.includes(marker)) {
        const block = `\n\n${marker}\n### PDF, p. ${annotation.page}\n\n> ${annotation.quote.replace(/\n+/gu, '\n> ')}\n${annotation.comment === undefined ? '' : `\n${annotation.comment}\n`}`;
        await storage.write({ fileId: current.file.id, expectedRevision: current.file.revision, content: `${current.content.trimEnd()}${block}\n` });
      }
      const linked = { ...annotation, literatureNoteFileId: note.fileId };
      await updatePdfAnnotation(storage, linked);
      return { annotation: linked, literatureNote: note };
    });
  }

  async referenceAttachmentLocalPath(request: import('@abnt/protocol').WorkspaceReferenceAttachmentRequest): Promise<ProtocolResult<string | undefined>> {
    return this.#run(async () => {
      const attachment = (await readReferenceAttachments(this.#requireStorage())).find((entry) => entry.referenceId === request.referenceId);
      return attachment === undefined || this.#rootPath === undefined ? undefined : join(this.#rootPath, attachment.path);
    });
  }

  /**
   * F13–F15: somente o host do vault recebe os bytes selecionados pelo Main.
   * O renderer recebe uma URI relativa autoral, nunca um path do sistema.
   */
  async importAsset(request: WorkspaceImportAssetRequest): Promise<ProtocolResult<WorkspaceAssetDto>> {
    return this.#run(async () => {
      const storage = this.#requireStorage();
      if (storage.createBinary === undefined) throw new Error('O backend do vault não suporta recursos binários.');
      const source = await storage.read(asWorkspaceFileId(request.sourceFileId));
      const cleanName = basename(request.name).replace(/[^a-zA-Z0-9._-]/gu, '-').replace(/^-+|[-]+$/gu, '') || 'recurso';
      const directory = (request.directory ?? 'assets').replace(/^\/+|\/+$/gu, '');
      if (directory === '' || directory.split('/').some((part) => part === '.' || part === '..' || part === '')) {
        throw new Error('Pasta de recursos inválida.');
      }
      const dot = cleanName.lastIndexOf('.');
      const stem = dot > 0 ? cleanName.slice(0, dot) : cleanName;
      const extension = dot > 0 ? cleanName.slice(dot) : '';
      const files = await storage.list();
      let suffix = 0;
      let path = `${directory}/${cleanName}`;
      while (files.some((file) => String(file.path) === path)) path = `${directory}/${stem}-${++suffix}${extension}`;
      const file = await storage.createBinary({ path: asWorkspacePath(path), bytes: Buffer.from(request.base64, 'base64') });
      const sourceParts = String(source.file.path).split('/').slice(0, -1);
      const targetParts = path.split('/');
      let shared = 0;
      while (sourceParts[shared] !== undefined && sourceParts[shared] === targetParts[shared]) shared += 1;
      const authoredUri = [...sourceParts.slice(shared).map(() => '..'), ...targetParts.slice(shared)].join('/') || './';
      return { file: workspaceFileDto(file), authoredUri };
    });
  }

  async createDocument(request: WorkspaceCreateDocumentRequest): Promise<ProtocolResult<WorkspaceFileDto>> {
    return this.#run(async () => workspaceFileDto(await this.#requireStorage().create({ path: asWorkspacePath(request.path), content: request.content })));
  }

  async renameDocument(request: WorkspaceRenameRequest): Promise<ProtocolResult<WorkspaceFileDto>> {
    return this.#run(async () => {
      const storage = this.#requireStorage();
      const fileId = asWorkspaceFileId(request.fileId);
      const current = await storage.read(fileId);
      if (current.file.revision !== request.expectedRevision) throw new WorkspaceConflictError(fileId, request.expectedRevision, current.file.revision);
      const previousPath = String(current.file.path);
      const renamed = await storage.rename({ fileId, path: asWorkspacePath(request.path), expectedRevision: request.expectedRevision });
      const nextPath = String(renamed.path);
      // Reescreve somente destinos que o mesmo resolvedor semântico reconhece
      // como o arquivo renomeado; URL externa e texto comum permanecem intactos.
      for (const candidate of await storage.list()) {
        if (!/\.md$/iu.test(String(candidate.path)) || candidate.id === fileId) continue;
        const source = await storage.read(candidate.id);
        const sourcePath = String(source.file.path);
        const authoredPath = (): string => {
          const value = relative(dirname(sourcePath), nextPath).replace(/\\/gu, '/');
          return value === '' ? `./${basename(nextPath)}` : value.startsWith('.') ? value : `./${value}`;
        };
        const rewrite = (target: string): string => documentTarget(source.file.path, target) === previousPath ? authoredPath() : target;
        const content = source.content
          .replace(/\]\(([^)\s]+)\)/gu, (_whole, target: string) => `](${rewrite(target)})`)
          .replace(/\[\[([^\]]+)\]\]/gu, (_whole, target: string) => `[[${rewrite(target)}]]`);
        if (content !== source.content) await storage.write({ fileId: candidate.id, expectedRevision: source.file.revision, content });
      }
      return workspaceFileDto(renamed);
    });
  }

  /** Resolve recursos somente na projeção de publicação; a AST preserva a URI autoral. */
  async #publicationWithResolvedResources(publication: PublicationDocument, fileId: import('@abnt/workspace-core').WorkspaceFileId): Promise<PublicationDocument> {
    const storage = this.#requireStorage();
    if (storage.readBinary === undefined) return publication;
    const source = await storage.read(fileId);
    const files = await storage.list();
    const dataUriFor = async (uri: string): Promise<string> => {
      const targetPath = documentTarget(source.file.path, uri);
      const target = targetPath === undefined ? undefined : files.find((file) => String(file.path) === targetPath);
      if (target === undefined || target.mediaType === undefined || !target.mediaType.startsWith('image/')) return uri;
      const binary = await storage.readBinary?.(target.id);
      return binary === undefined ? uri : `data:${target.mediaType};base64,${Buffer.from(binary.bytes).toString('base64')}`;
    };
    const block = async (value: PublicationBlock): Promise<PublicationBlock> => {
      switch (value.type) {
        case 'figure': return { ...value, src: await dataUriFor(value.src) };
        case 'quote': return { ...value, children: await Promise.all(value.children.map(block)) };
        case 'list': return { ...value, items: await Promise.all(value.items.map(async (item) => ({ ...item, children: await Promise.all(item.children.map(block)) }))) };
        case 'table': return { ...value, head: await Promise.all(value.head.map(async (row) => ({ ...row, cells: await Promise.all(row.cells.map(async (cell) => ({ ...cell, children: await Promise.all(cell.children.map(block)) }))) }))), body: await Promise.all(value.body.map(async (row) => ({ ...row, cells: await Promise.all(row.cells.map(async (cell) => ({ ...cell, children: await Promise.all(cell.children.map(block)) }))) }))) };
        case 'front-matter': return { ...value, children: await Promise.all(value.children.map(block)) };
        default: return value;
      }
    };
    return { ...publication, children: await Promise.all(publication.children.map(block)), notes: await Promise.all(publication.notes.map(async (note) => ({ ...note, children: await Promise.all(note.children.map(block)) }))) };
  }

  /**
   * Grafo (F5) é sempre derivado on-the-fly de `links()/citations()/resources()`
   * já carregados pelo `better-sqlite3` — nenhuma tabela nova de grafo
   * materializado. `buildWorkspaceGraph` reaproveita `documentTarget` do
   * language service; o host só busca as fontes e monta DTOs.
   *
   * `includePeople` (F33) enfia o catálogo bibliográfico vault-wide que
   * `citationExplorer()` já precisou construir — nós person/organization e
   * arestas `authored-by` a partir de `BibliographicEntity.author/editor` —
   * sem nenhuma indexação nova. Opt-in porque resolver bibliografia de vários
   * documentos é o passo mais caro de toda a Onda B.
   */
  async graph(request: WorkspaceGraphRequest): Promise<ProtocolResult<WorkspaceGraphDto>> {
    return this.#run(async () => {
      const index = this.#requireIndex();
      const storage = this.#requireStorage();
      const files = await storage.list();
      const titles = new Map(index.documentTitles().map((entry) => [entry.fileId, entry.title] as const));
      const bibliography = request.includePeople === true
        ? new Map(
            [...(await this.#resolveVaultBibliography()).entries()].map(([id, entry]) => [
              id,
              { entity: entry.entity, ...(entry.sourceFileId !== undefined ? { sourceFileId: entry.sourceFileId } : {}) },
            ] as const),
          )
        : undefined;
      const tags = request.includeTags === true
        ? (await scanQueryMetadata(storage, files)).map((entry) => ({ fileId: entry.fileId, tags: entry.tags }))
        : undefined;
      const graph = buildWorkspaceGraph({
        files,
        links: index.links(),
        citations: index.citations(),
        resources: index.resources(),
        titles,
        ...(bibliography !== undefined ? { bibliography } : {}),
        ...(tags !== undefined ? { tags } : {}),
      });
      const projected: WorkspaceGraphDto = {
        nodes: graph.nodes.map((node) => ({
          id: node.id,
          kind: node.kind,
          label: node.label,
          ...(node.fileId !== undefined ? { fileId: String(node.fileId) } : {}),
          ...(node.path !== undefined ? { path: String(node.path) } : {}),
          ...(node.referenceId !== undefined ? { referenceId: node.referenceId } : {}),
          ...(node.resolved !== undefined ? { resolved: node.resolved } : {}),
          ...(node.identityState !== undefined ? { identityState: node.identityState } : {}),
        })),
        edges: graph.edges.map((edge) => ({
          kind: edge.kind,
          from: edge.from,
          to: edge.to,
          ...(edge.sourceFileId !== undefined ? { sourceFileId: String(edge.sourceFileId) } : {}),
        })),
      };
      if (request.focusFileId === undefined) return projected;

      // F57: a redução é uma projeção de apresentação do mesmo grafo derivado;
      // não cria índice ou estado paralelo. A direção de links/citações não
      // importa para responder "o que está conectado a este documento?".
      const focus = `document:${request.focusFileId}`;
      if (!projected.nodes.some((node) => node.id === focus)) return projected;
      const neighbours = new Map<string, Set<string>>();
      for (const edge of projected.edges) {
        const from = neighbours.get(edge.from) ?? new Set<string>();
        from.add(edge.to); neighbours.set(edge.from, from);
        const to = neighbours.get(edge.to) ?? new Set<string>();
        to.add(edge.from); neighbours.set(edge.to, to);
      }
      const included = new Set<string>([focus]);
      let frontier = new Set<string>([focus]);
      for (let level = 0; level < (request.depth ?? 1); level += 1) {
        const next = new Set<string>();
        for (const nodeId of frontier) {
          for (const neighbour of neighbours.get(nodeId) ?? []) {
            if (!included.has(neighbour)) { included.add(neighbour); next.add(neighbour); }
          }
        }
        frontier = next;
      }
      return {
        nodes: projected.nodes.filter((node) => included.has(node.id)),
        edges: projected.edges.filter((edge) => included.has(edge.from) && included.has(edge.to)),
      };
    });
  }

  async history(request: WorkspaceHistoryRequest): Promise<ProtocolResult<WorkspaceHistoryDto>> {
    return this.#run(async () => {
      const file = await this.#historyFile(request.fileId);
      return this.#requireHistory().revisions(request.fileId, String(file.path));
    });
  }

  async historyCreateSnapshot(request: WorkspaceHistorySnapshotRequest): Promise<ProtocolResult<WorkspaceHistoryRevisionDto>> {
    return this.#run(async () => {
      const file = await this.#historyFile(request.fileId);
      const controller = this.#requireEditors().controller(asWorkspaceFileId(request.fileId));
      const content = controller?.snapshot().session.content ?? (await this.#requireStorage().read(file.id)).content;
      return this.#requireHistory().createSnapshot(request.fileId, request.label, content);
    });
  }

  async historyDiff(request: WorkspaceHistoryDiffRequest): Promise<ProtocolResult<WorkspaceHistoryDiffDto>> {
    return this.#run(async () => {
      const file = await this.#historyFile(request.fileId);
      const controller = this.#requireEditors().controller(asWorkspaceFileId(request.fileId));
      const current = controller?.snapshot().session.content ?? (await this.#requireStorage().read(file.id)).content;
      const history = this.#requireHistory();
      const from = await history.content(request.fileId, String(file.path), request.fromRevisionId, current);
      const to = request.toRevisionId === undefined ? current : await history.content(request.fileId, String(file.path), request.toRevisionId, current);
      if (from === undefined || to === undefined) throw new WorkspaceFileNotFoundError(asWorkspaceFileId(request.fileId));
      return { lines: lineDiff(from, to) };
    });
  }

  /**
   * F70: mesmo par from/to de `historyDiff`, projetado em linguagem editorial
   * em vez de linhas — complementa o diff textual, não o substitui (ADR 0055).
   */
  async historyStructuralDiff(request: WorkspaceHistoryDiffRequest): Promise<ProtocolResult<WorkspaceHistoryStructuralDiffDto>> {
    return this.#run(async () => {
      const file = await this.#historyFile(request.fileId);
      const controller = this.#requireEditors().controller(asWorkspaceFileId(request.fileId));
      const current = controller?.snapshot().session.content ?? (await this.#requireStorage().read(file.id)).content;
      const history = this.#requireHistory();
      const from = await history.content(request.fileId, String(file.path), request.fromRevisionId, current);
      const to = request.toRevisionId === undefined ? current : await history.content(request.fileId, String(file.path), request.toRevisionId, current);
      if (from === undefined || to === undefined) throw new WorkspaceFileNotFoundError(asWorkspaceFileId(request.fileId));
      return { changes: structuralDiff(from, to) };
    });
  }

  /** F89: a comparação usa conteúdo autoral/sessões no host e envia só diffs DTO ao renderer. */
  async compareDocuments(request: WorkspaceDocumentComparisonRequest): Promise<ProtocolResult<WorkspaceDocumentComparisonDto>> {
    return this.#run(async () => {
      const left = await this.#historyFile(request.leftFileId);
      const right = await this.#historyFile(request.rightFileId);
      const editors = this.#requireEditors(); const storage = this.#requireStorage();
      const leftContent = editors.controller(left.id)?.snapshot().session.content ?? (await storage.read(left.id)).content;
      const rightContent = editors.controller(right.id)?.snapshot().session.content ?? (await storage.read(right.id)).content;
      return { text: { lines: lineDiff(leftContent, rightContent) }, structural: { changes: structuralDiff(leftContent, rightContent) } };
    });
  }

  /**
   * F34: idempotente — se `papers/{referenceId}.md` já existe, reabre em vez de
   * falhar ou sufixar (`-2.md` seria ruído; uma referência tem uma nota). Título
   * vem da bibliografia já resolvida do documento ativo — não resolve
   * bibliografia vault-wide só para isso.
   */
  async createLiteratureNote(request: WorkspaceCreateLiteratureNoteRequest): Promise<ProtocolResult<WorkspaceFileDto>> {
    return this.#run(async () => this.#ensureLiteratureNote(request.referenceId, request.activeFileId));
  }

  /** Reaproveita a resolução de link do language service — não reimplementa aqui. */
  async backlinks(request: WorkspaceBacklinksRequest): Promise<ProtocolResult<readonly WorkspaceBacklinkDto[]>> {
    return this.#run(async () => {
      const fileId = asWorkspaceFileId(request.fileId);
      const backlinks = await this.#requireLanguage().backlinks(fileId);
      return backlinks.map((backlink) => ({
        fileId: String(backlink.fileId),
        path: String(backlink.path),
        label: backlink.label,
        range: backlink.range,
      }));
    });
  }

  async completions(request: LanguageCompletionRequest): Promise<ProtocolResult<LanguageCompletionDto | undefined>> {
    return this.#languageQuery(request, async (fileId) => this.#requireLanguage().completions({
      fileId,
      offset: request.offset,
    }, request.limit));
  }

  async hover(request: LanguageHoverRequest): Promise<ProtocolResult<LanguageHoverDto | undefined>> {
    return this.#languageQuery(request, async (fileId) => this.#requireLanguage().hover({ fileId, offset: request.offset }));
  }

  async definition(request: LanguageDefinitionRequest): Promise<ProtocolResult<readonly LanguageLocationDto[]>> {
    return this.#languageQuery(request, async (fileId) => this.#locationsDto(
      await this.#requireLanguage().definition({ fileId, offset: request.offset }),
    ));
  }

  async languageReferences(request: LanguageReferencesRequest): Promise<ProtocolResult<readonly LanguageLocationDto[]>> {
    return this.#languageQuery(request, async (fileId) => this.#locationsDto(
      await this.#requireLanguage().references({ fileId, offset: request.offset }),
    ));
  }

  async crossReferenceTargets(request: import('@abnt/protocol').LanguageCrossReferenceTargetsRequest): Promise<ProtocolResult<readonly import('@abnt/protocol').LanguageCrossReferenceTargetDto[]>> {
    return this.#languageQuery(request, async (fileId) => (await this.#requireLanguage().crossReferenceTargets(fileId)).map((target) => ({ identifier: target.identifier, kind: target.kind, label: target.label, range: target.range })));
  }

  async unlinkedMentions(request: import('@abnt/protocol').LanguageUnlinkedMentionsRequest): Promise<ProtocolResult<readonly import('@abnt/protocol').LanguageUnlinkedMentionDto[]>> {
    return this.#languageQuery(request, async (fileId) =>
      (await this.#requireLanguage().unlinkedMentions(fileId)).map((mention) => mention.kind === 'document'
        ? { kind: 'document' as const, range: mention.range, text: mention.text, targetFileId: String(mention.targetFileId), targetPath: String(mention.targetPath) }
        : { kind: 'reference' as const, range: mention.range, text: mention.text, referenceId: mention.referenceId }),
    );
  }

  async writingStatistics(request: LanguageWritingStatisticsRequest): Promise<ProtocolResult<LanguageWritingStatisticsDto>> {
    return this.#languageQuery(request, async (fileId) => this.#requireLanguage().writingStatistics(fileId));
  }

  async renameSymbol(request: LanguageRenameRequest): Promise<ProtocolResult<LanguageRenameResultDto | undefined>> {
    return this.#run(async () => {
      const fileId = asWorkspaceFileId(request.fileId);
      const active = this.#requireEditors().controller(fileId);
      if (active === undefined) throw new WorkspaceFileNotFoundError(fileId);
      if (active.snapshot().session.revision !== request.expectedRevision) throw new WorkspaceConflictError(fileId, request.expectedRevision, active.snapshot().session.revision);
      const workspaceEdit = await this.#requireLanguage().rename({ fileId, offset: request.offset }, request.newName);
      if (workspaceEdit === undefined) return undefined;
      return { label: workspaceEdit.label, changedFiles: await this.#applyWorkspaceEdit(workspaceEdit) };
    });
  }

  async moveSection(request: LanguageMoveSectionRequest): Promise<ProtocolResult<LanguageRenameResultDto | undefined>> {
    return this.#run(async () => {
      const fileId = asWorkspaceFileId(request.fileId);
      const controller = this.#requireEditors().controller(fileId);
      if (controller === undefined) throw new WorkspaceFileNotFoundError(fileId);
      if (controller.snapshot().session.revision !== request.expectedRevision) throw new WorkspaceConflictError(fileId, request.expectedRevision, controller.snapshot().session.revision);
      const edit = await this.#requireLanguage().moveSection({ fileId, offset: request.offset }, request.direction);
      if (edit === undefined) return undefined;
      const change = edit.changes[0]!;
      controller.dispatch({ edits: change.edits });
      return { label: edit.label, changedFiles: [String(change.path)] };
    });
  }

  async dispose(): Promise<void> {
    await this.#disposeWorkspace();
    this.#listeners.clear();
  }

  #editorSnapshotFor(fileId: string): EditorSnapshotDto {
    const controller = this.#requireEditors().controller(asWorkspaceFileId(fileId));
    if (controller === undefined) throw new WorkspaceFileNotFoundError(asWorkspaceFileId(fileId));
    return this.#editorSnapshotDto(controller.snapshot());
  }

  #editorSnapshotDto(snapshot: import('@abnt/editor-core').EditorSnapshot): EditorSnapshotDto {
    return {
      fileId: String(snapshot.fileId),
      version: snapshot.version,
      session: {
        file: workspaceFileDto(snapshot.session.file),
        revision: snapshot.session.revision,
        content: snapshot.session.content,
        ...(snapshot.session.contentHash !== undefined ? { contentHash: snapshot.session.contentHash } : {}),
        dirty: snapshot.session.dirty,
        status: snapshot.session.status,
        diagnostics: snapshot.session.diagnostics,
        ...(snapshot.session.externalChange !== undefined
          ? { externalChange: workspaceFileDto(snapshot.session.externalChange) }
          : {}),
      },
      selection: snapshot.selection,
      outline: snapshot.outline.map((item) => ({
        nodeId: item.nodeId,
        title: item.title,
        depth: item.depth,
        ...(item.role !== undefined ? { role: item.role } : {}),
        range: item.range,
      })),
      diagnostics: snapshot.diagnostics.map((diagnostic) => ({
        id: diagnostic.id,
        severity: diagnostic.severity,
        message: diagnostic.message,
        ...(diagnostic.source !== undefined ? { source: sourceRangeDto(diagnostic.source) } : {}),
      })),
      ...(snapshot.preview !== undefined
        ? { previewRevision: snapshot.preview.revision, previewProfileId: snapshot.preview.profileId }
        : {}),
    };
  }

  #workspaceEventDto(event: WorkspaceEvent): import('@abnt/protocol').WorkspaceEvent | undefined {
    switch (event.type) {
      case 'workspace:file-created':
      case 'workspace:file-changed':
        return { type: event.type, file: workspaceFileDto(event.file) };
      case 'workspace:file-renamed':
        return { type: event.type, file: workspaceFileDto(event.file), previousPath: String(event.previousPath) };
      case 'workspace:file-removed':
        return { type: event.type, fileId: String(event.fileId), path: String(event.path) };
      case 'workspace:recovery-conflict':
        return undefined;
    }
  }

  async #run<T>(operation: () => Promise<T>): Promise<ProtocolResult<T>> {
    try {
      return protocolOk(await operation());
    } catch (error) {
      const protocol = errorFor(error);
      this.#emit({ type: 'desktop:operational-error', operation: 'workspace', error: protocol });
      return protocolError(protocol.code, protocol.message);
    }
  }

  /**
   * A sessão é a autoridade do rascunho. Uma resposta de linguagem só cruza a
   * fronteira se pertence exatamente à revisão enviada pelo adapter visual.
   */
  async #languageQuery<T extends LanguageCompletionDto | LanguageHoverDto | LanguageWritingStatisticsDto | readonly LanguageLocationDto[] | readonly import('@abnt/protocol').LanguageCrossReferenceTargetDto[] | readonly import('@abnt/protocol').LanguageUnlinkedMentionDto[] | undefined>(
    request: { readonly fileId: string; readonly expectedRevision: number },
    operation: (fileId: import('@abnt/workspace-core').WorkspaceFileId) => Promise<T>,
  ): Promise<ProtocolResult<T>> {
    return this.#run(async () => {
      const fileId = asWorkspaceFileId(request.fileId);
      const controller = this.#requireEditors().controller(fileId);
      if (controller === undefined) throw new WorkspaceFileNotFoundError(fileId);
      if (controller.snapshot().session.revision !== request.expectedRevision) {
        throw new WorkspaceConflictError(fileId, request.expectedRevision, controller.snapshot().session.revision);
      }
      const result = await operation(fileId);
      const current = this.#requireEditors().controller(fileId);
      if (current === undefined) throw new WorkspaceFileNotFoundError(fileId);
      if (current.snapshot().session.revision !== request.expectedRevision) {
        throw new WorkspaceConflictError(fileId, request.expectedRevision, current.snapshot().session.revision);
      }
      return result;
    });
  }

  #locationsDto(locations: readonly import('@abnt/language-service').LanguageLocation[]): readonly LanguageLocationDto[] {
    return locations.map((location) => ({
      fileId: String(location.fileId),
      path: String(location.path),
      range: location.range,
    }));
  }

  async #referenceCatalog(fileId: import('@abnt/workspace-core').WorkspaceFileId): Promise<LanguageReferenceCatalog | undefined> {
    const bibliography = this.#editors?.controller(fileId)?.snapshot().bibliography;
    if (bibliography === undefined) return undefined;
    const files = await this.#requireStorage().list();
    const references = Object.entries(bibliography.entries).map(([id, entry]) => this.#languageReference(id, entry, bibliography, files));
    return {
      async search(query, limit) {
        const normalized = query.toLocaleLowerCase();
        return references
          .filter((reference) => reference.id.toLocaleLowerCase().includes(normalized) || reference.title?.toLocaleLowerCase().includes(normalized))
          .slice(0, limit);
      },
      async find(id) {
        return references.find((reference) => reference.id === id);
      },
      async all() { return references; },
    };
  }

  #languageReference(
    id: string,
    entry: unknown,
    bibliography: NonNullable<import('@abnt/editor-core').EditorSnapshot['bibliography']>,
    files: readonly WorkspaceFile[],
  ): LanguageReference {
    const value = entry as { readonly title?: unknown; readonly author?: unknown };
    const authors = Array.isArray(value.author)
      ? value.author.flatMap((author) => {
          if (typeof author !== 'object' || author === null) return [];
          const person = author as { readonly literal?: unknown; readonly family?: unknown; readonly given?: unknown };
          if (typeof person.literal === 'string' && person.literal.trim() !== '') return [person.literal];
          const name = [person.given, person.family].filter((part): part is string => typeof part === 'string' && part.trim() !== '').join(' ');
          return name === '' ? [] : [name];
        })
      : [];
    const provenance = bibliography.provenanceByReference[id]?.[0];
    const source = bibliography.sources.find((candidate) => candidate.id === provenance?.sourceId);
    const sourceFile = source?.resolvedUri === undefined
      ? undefined
      : files.find((file) => String(file.path) === source.resolvedUri);
    return {
      id,
      ...(typeof value.title === 'string' ? { title: value.title } : {}),
      ...(authors.length === 0 ? {} : { authors }),
      ...(sourceFile === undefined
        ? {}
        : { definition: { fileId: sourceFile.id, path: sourceFile.path, range: { start: 0, end: 0 } } }),
    };
  }

  #requireStorage(): LocalFilesystemStorage {
    if (this.#storage === undefined) throw new Error('Nenhum vault está aberto.');
    return this.#storage;
  }

  #requireEditors(): EditorWorkspaceService {
    if (this.#editors === undefined) throw new Error('Nenhum vault está aberto.');
    return this.#editors;
  }

  #requireIndex(): SqliteWorkspaceIndex {
    if (this.#index === undefined) throw new Error('Nenhum vault está aberto.');
    return this.#index;
  }

  #requireLanguage(): WorkspaceLanguageService {
    if (this.#language === undefined) throw new Error('Nenhum vault está aberto.');
    return this.#language;
  }

  #requireSessions(): DocumentSessionsService {
    if (this.#sessions === undefined) throw new Error('Nenhum vault está aberto.');
    return this.#sessions;
  }

  #requireHistory(): WorkspaceHistory {
    if (this.#history === undefined) throw new Error('Nenhum vault está aberto.');
    return this.#history;
  }
  #requirePlugins(): WorkspacePluginCatalog { if (this.#plugins === undefined) throw new Error('Nenhum vault está aberto.'); return this.#plugins; }

  async #historyFile(fileId: string): Promise<WorkspaceFile> {
    const file = (await this.#requireStorage().list()).find((candidate) => String(candidate.id) === fileId);
    if (file === undefined) throw new WorkspaceFileNotFoundError(asWorkspaceFileId(fileId));
    return file;
  }

  #emit(event: DesktopEventDto): void {
    for (const listener of this.#listeners) listener(event);
  }

  async #disposeWorkspace(): Promise<void> {
    this.#unsubscribeWorkspace?.();
    this.#unsubscribeWorkspace = undefined;
    for (const unsubscribe of this.#unsubscribeEditor.values()) unsubscribe();
    this.#unsubscribeEditor.clear();
    this.#editors?.dispose();
    this.#editors = undefined;
    this.#language = undefined;
    this.#history = undefined;
    this.#plugins = undefined;
    await this.#sessions?.dispose();
    this.#sessions = undefined;
    await this.#index?.close();
    this.#index = undefined;
    await this.#storage?.close();
    this.#storage = undefined;
    this.#rootPath = undefined;
    this.#openResponse = undefined;
  }

  /** Aplica um WorkspaceEdit calculado pelo language service sem expor arquivos ao renderer. */
  async #applyWorkspaceEdit(workspaceEdit: LanguageWorkspaceEdit): Promise<readonly string[]> {
    const storage = this.#requireStorage();
    for (const change of workspaceEdit.changes) {
      const controller = this.#requireEditors().controller(change.fileId);
      if (controller !== undefined) {
        const current = controller.snapshot().session.revision;
        if (current !== change.expectedRevision) throw new WorkspaceConflictError(change.fileId, change.expectedRevision, current);
        controller.dispatch({ edits: change.edits });
        continue;
      }
      const current = await storage.read(change.fileId);
      if (current.file.revision !== change.expectedRevision) throw new WorkspaceConflictError(change.fileId, change.expectedRevision, current.file.revision);
      const content = [...change.edits].reverse().reduce((text, edit) => `${text.slice(0, edit.range.start)}${edit.text}${text.slice(edit.range.end)}`, current.content);
      await storage.write({ fileId: change.fileId, expectedRevision: change.expectedRevision, content });
    }
    return workspaceEdit.changes.map((change) => String(change.path));
  }

  /** Linguagem é a autoridade de ranges de citação; frontmatter da note é atualizado junto. */
  async #renameReferenceKey(fromId: string, toId: string): Promise<readonly string[]> {
    const storage = this.#requireStorage();
    const files = (await storage.list()).filter((file) => /\.md$/iu.test(String(file.path)));
    let edit: LanguageWorkspaceEdit | undefined;
    const citationPattern = new RegExp(`@${fromId.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}(?![\\p{L}\\p{N}_:-])`, 'u');
    for (const file of files) {
      const document = await storage.read(file.id);
      const found = citationPattern.exec(document.content);
      if (found === null || found.index === undefined) continue;
      edit = await this.#requireLanguage().rename({ fileId: file.id, offset: found.index + 1 }, toId);
      break;
    }
    const changed = new Set(edit === undefined ? [] : await this.#applyWorkspaceEdit(edit));
    const sourceReference = new RegExp(`^(sourceReference:\\s*)${fromId.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}(\\s*)$`, 'mu');
    for (const file of files) {
      const controller = this.#requireEditors().controller(file.id);
      const current = controller === undefined ? await storage.read(file.id) : { file: controller.snapshot().session.file, content: controller.snapshot().session.content };
      const match = sourceReference.exec(current.content);
      if (match === null || match.index === undefined) continue;
      const start = match.index + match[1]!.length;
      const end = start + fromId.length;
      if (controller !== undefined) controller.dispatch({ edits: [{ range: { start, end }, text: toId }] });
      else await storage.write({ fileId: file.id, expectedRevision: current.file.revision, content: `${current.content.slice(0, start)}${toId}${current.content.slice(end)}` });
      changed.add(String(file.path));
    }
    return [...changed];
  }

  async #ensureLiteratureNote(referenceId: string, activeFileId?: string): Promise<WorkspaceFileDto> {
    const catalogEntry = (await this.#resolveVaultBibliography()).get(referenceId);
    let title = catalogEntry?.entity.title ?? referenceId;
    const entity = catalogEntry?.entity;
    if (activeFileId !== undefined) {
      const controller = this.#requireEditors().controller(asWorkspaceFileId(activeFileId));
      if (controller === undefined) throw new WorkspaceFileNotFoundError(asWorkspaceFileId(activeFileId));
      const entry = controller.snapshot().bibliography?.entries[referenceId] as { readonly title?: unknown } | undefined;
      if (typeof entry?.title === 'string') title = entry.title;
    }
    const path = asWorkspacePath(`papers/${sanitizeReferenceFileName(referenceId)}.md`);
    const storage = this.#requireStorage();
    const files = await storage.list();
    const existing = files.find((file) => String(file.path) === String(path));
    if (existing !== undefined) return workspaceFileDto(existing);
    const template = files.find((file) => String(file.path) === 'templates/literature-note.md');
    const content = template === undefined
      ? literatureNoteContent(referenceId, title)
      : renderLiteratureTemplate((await storage.read(template.id)).content, {
          referenceId: templateValue(referenceId),
          title: templateValue(title),
          authors: templateValue((entity?.author ?? entity?.editor ?? []).map(authorLabel).filter(Boolean).join('; ')),
          year: entity === undefined || !hasYear(entity) ? '' : String(entity.issued?.['date-parts']?.[0]?.[0] ?? entity.issued?.literal ?? entity.issued?.raw ?? ''),
          doi: templateValue(entity?.DOI ?? ''),
        });
    return workspaceFileDto(await storage.create({ path, content }));
  }
}
