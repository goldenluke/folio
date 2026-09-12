import { useEffect, useMemo, useRef, useState, type JSX, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react';

import type {
  ProtocolResult,
  SystemInformationDto,
  WorkspaceFileDto,
  WorkspaceGraphDto,
  WorkspaceGraphNodeDto,
  BibliographicEntityDto,
  WorkspaceReferenceHealthDto,
  AttachmentDto,
  AttachmentRoleDto,
  AttachmentHealthIssueDto,
  ReferenceRelationDto,
  ReferenceRelationKindDto,
  WorkspaceOpenResponse,
  WorkspaceSearchResultDto,
  WorkspacePluginDto,
  LanguageWritingStatisticsDto,
  WorkspaceSyncStatusDto,
  WorkspaceCollaborationDto,
  WorkspaceCaptureInboxItemDto,
} from '@abnt/protocol';
import { captureInboxItem } from '@abnt/workspace-navigation';
import type { LanguageLocation } from '@abnt/language-service';
import type { EditorController } from '@abnt/editor-core';
import { PAGE_TYPES } from '@abnt/page-workspace';

import { EditorPane, type EditorPaneHandle } from './editor-pane.js';
import { requestConfirmation, requestText, TextPromptHost } from './text-prompt.js';
import { PerformanceObservatoryDialog } from './performance-observatory-dialog.js';
import { VirtualizedList } from './virtualized-list.js';
import { recordPerformanceSample, timePerformance } from './shell/performance.js';
import { FolioIcon, type FolioIconName } from './icons.js';
import { FolioLogo } from './folio-logo.js';
import { PdfReaderDialog } from './pdf-reader.js';
import { AnnotationSynthesisDialog } from './annotation-synthesis.js';
import { LiteratureMonitoringDialog } from './literature-monitoring.js';
import { ResearchWorkflowDialog } from './research-workflow.js';
import { readResearchProjects, ResearchProjectsDialog } from './research-projects.js';
import { ResearchIntakeDialog } from './research-intake.js';
import { CaptureInboxDialog } from './capture-inbox.js';
import { ResearchCanvasDialog } from './research-canvas.js';
import { AcademicFormsDialog } from './academic-forms.js';
import { AcademicViewsDialog } from './academic-views.js';
import { StructuredResearchDialog } from './structured-research.js';
import { WorkspaceNavigationDialog } from './workspace-navigation.js';
import { WorkspaceHome } from './workspace-home.js';
import { useGlobalDialogAccessibility } from './dialog-accessibility.js';
import { SubmissionIntegrationsDialog } from './submission-integrations-dialog.js';
import { WorkspaceFileExplorer } from './file-explorer.js';
import { WritingWorkflowDialog } from './writing-workflow.js';
import { ReferenceMaintenanceDialog } from './reference-maintenance.js';
import { LibraryMaintenanceCenterDialog } from './library-maintenance-center.js';
import { HistoryDialog } from './history-dialog.js';
import { DocumentComparisonDialog } from './document-comparison.js';
import { PluginManagerDialog } from './plugin-manager.js';
import { ProfileInspectorDialog } from './profile-inspector.js';
import { AutomationDialog } from './automation-dialog.js';
import { ReviewWorkspaceDialog, readReviewComments } from './review-workflow.js';
import { openWorkspaceProblem } from './workspace-problem-navigation.js';
import { RemoteEditorController } from './remote-editor-controller.js';
import { createCommandRegistry, type CommandRegistry } from './shell/commands.js';
import { executeAutomation, parseWorkspaceMacros, planAutomation, type WorkspaceMacro } from './shell/automation.js';
import { mergeKeybindings, registerKeybindings, type CustomKeybindings, type KeyBindingMap } from './shell/keybindings.js';
import { rankCommands, rankQuickOpenFiles, type QuickOpenFile } from './shell/palette.js';
import { citationPreviewText, citationSource, editableCitationAt, parseLocatorSuffix, type CitationDraft, type CitationEditMode, type CitationItemDraft, type CitationLocatorKind } from './shell/citation-source.js';
import { applyMetadata, metadataFromSource, type MetadataDraft } from './shell/frontmatter.js';
import { equationSource, figureSource, markdownTableSource, modularTccTemplate, parseMarkdownTable, templateSource, type MarkdownTableDraft, type TemplateKind } from './shell/authoring-source.js';
import { blockReference, previewExtractSelection, previewMergeModule } from '@abnt/block-composition';
import { backlinksPanel, citationExplorerPanel, diagnosticsPanel, outlinePanel, referencesPanel } from './shell/panel-views.js';
import { createPanelRegistry } from './shell/panels.js';
import { forceDirectedLayout } from './shell/graph-layout.js';
import {
  createViewsModel,
  type PreviewViewState,
  type ViewId,
  type ViewState,
  type ViewsEvent,
} from './shell/views.js';
import {
  appendWorkspaceActivity,
  defaultLayouts,
  focusLayout,
  parseWorkspaceActivity,
  parseWorkspaceLayouts,
  type FocusMode,
  type WorkspaceActivity,
  type WorkspaceLayout,
} from './shell/workspace-cohesion.js';

const markdownFiles = (files: readonly WorkspaceFileDto[]) => files.filter((file) => file.path.toLowerCase().endsWith('.md'));

const defaultKeybindings: KeyBindingMap = new Map([
  ['mod+s', 'document.save'], ['mod+w', 'document.closeActiveTab'],
  ['mod+p', 'palette.quickOpen'], ['mod+shift+p', 'palette.commands'],
  ['mod+shift+f', 'search.openView'], ['mod+shift+r', 'review.open'],
  ['mod+shift+d', 'document.compare'], ['mod+shift+c', 'citation.openPicker'],
  ['mod+shift+i', 'figure.insert'], ['mod+shift+n', 'application.newWindow'],
  ['alt+arrowleft', 'navigation.back'], ['alt+arrowright', 'navigation.forward'],
]);

const customKeybindingsStorageKey = (workspaceId: string): string => `folio.keybindings:${workspaceId}`;
const macroStorageKey = (workspaceId: string): string => `folio.automation:${workspaceId}`;
const layoutsStorageKey = (workspaceId: string): string => `folio.workspace-layouts:${workspaceId}`;
const activityStorageKey = (workspaceId: string): string => `folio.workspace-activity:${workspaceId}`;
const recentCommandsStorageKey = (workspaceId: string): string => `folio.recent-commands:${workspaceId}`;
const onboardingStorageKey = (workspaceId: string): string => `folio.onboarding:${workspaceId}`;
const loadLayouts = (workspaceId: string): readonly WorkspaceLayout[] => {
  try { const parsed = parseWorkspaceLayouts(JSON.parse(window.localStorage.getItem(layoutsStorageKey(workspaceId)) ?? '[]')); return parsed.length === 0 ? defaultLayouts : parsed; } catch { return defaultLayouts; }
};
const loadActivity = (workspaceId: string): readonly WorkspaceActivity[] => {
  try { return parseWorkspaceActivity(JSON.parse(window.localStorage.getItem(activityStorageKey(workspaceId)) ?? '[]')); } catch { return []; }
};
const loadRecentCommands = (workspaceId: string): readonly string[] => {
  try { const value: unknown = JSON.parse(window.localStorage.getItem(recentCommandsStorageKey(workspaceId)) ?? '[]'); return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(0, 12) : []; } catch { return []; }
};
const loadCustomKeybindings = (workspaceId: string): CustomKeybindings => {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(customKeybindingsStorageKey(workspaceId)) ?? '{}');
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([chord, commandId]) => typeof commandId === 'string' && chord.trim() !== ''));
  } catch { return {}; }
};
const loadWorkspaceMacros = (workspaceId: string): readonly WorkspaceMacro[] => {
  try { return parseWorkspaceMacros(JSON.parse(window.localStorage.getItem(macroStorageKey(workspaceId)) ?? '[]')); } catch { return []; }
};

const collectionArguments = {
  safeParse(value: unknown) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value) && typeof (value as { collectionId?: unknown }).collectionId === 'string' && (value as { collectionId: string }).collectionId !== '') return { success: true as const, data: value };
    return { success: false as const, message: 'A operação em lote exige collectionId.' };
  },
};

const documentOpenArguments = {
  safeParse(value: unknown) {
    if (value === undefined) return { success: true as const, data: undefined };
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const candidate = value as { fileId?: unknown; path?: unknown };
      if (typeof candidate.fileId === 'string' && candidate.fileId !== '' && typeof candidate.path === 'string' && candidate.path !== '') return { success: true as const, data: { fileId: candidate.fileId, path: candidate.path } };
    }
    return { success: false as const, message: 'document.open exige { fileId, path }.' };
  },
};

const withTimeout = async <T,>(operation: Promise<T>, timeoutMs: number): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('A solicitação excedeu o tempo de resposta.')), timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
};

/**
 * `snippet()` do FTS5 marca ocorrências com `<mark>` literal, não HTML seguro
 * — o resto do texto é conteúdo cru do vault. Dividir na marcação e renderizar
 * cada pedaço como filho de string do React evita `dangerouslySetInnerHTML`
 * sem perder o destaque.
 */
const renderSnippet = (snippet: string): JSX.Element => {
  const parts = snippet.split(/(<mark>|<\/mark>)/);
  let marking = false;
  return (
    <>
      {parts.map((part, index) => {
        if (part === '<mark>') {
          marking = true;
          return null;
        }
        if (part === '</mark>') {
          marking = false;
          return null;
        }
        return marking ? (
          <mark key={index} className="bg-amber-400/40 text-amber-100 rounded-sm">
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        );
      })}
    </>
  );
};

function ToolbarIcon({ name }: { readonly name: 'back' | 'forward' | 'split' | 'preview' }): JSX.Element {
  return <FolioIcon name={name} />;
}

function FileMenuItem({ icon, children, disabled = false, danger = false, onClick }: {
  readonly icon: FolioIconName;
  readonly children: ReactNode;
  readonly disabled?: boolean;
  readonly danger?: boolean;
  readonly onClick: () => void;
}): JSX.Element {
  return <button type="button" role="menuitem" disabled={disabled} className={`folio-file-menu-item ${danger ? 'folio-file-menu-item-danger' : ''}`} onClick={onClick}><span className="folio-file-menu-icon"><FolioIcon name={icon} className="h-4 w-4" /></span><span className="min-w-0 flex-1 truncate">{children}</span></button>;
}

function PreviewPane({ view, split = false }: { readonly view: PreviewViewState; readonly split?: boolean }): JSX.Element {
  const frameHost = useRef<HTMLDivElement>(null);
  const [frameScale, setFrameScale] = useState(1);

  useEffect(() => {
    if (!split || view.preview === undefined || frameHost.current === null) {
      setFrameScale(1);
      return undefined;
    }
    const host = frameHost.current;
    // A4 (21 cm a 96 dpi) + 1rem de respiro em cada lado dentro do srcDoc.
    const previewWidth = (21 / 2.54) * 96 + 32;
    const resize = new ResizeObserver(([entry]) => {
      if (entry === undefined) return;
      if (entry.contentRect.width <= 0) return;
      setFrameScale(Math.min(1, entry.contentRect.width / previewWidth));
    });
    resize.observe(host);
    return () => resize.disconnect();
  }, [split, view.preview]);

  const frameStyle =
    split && frameScale < 1
      ? {
          width: `${100 / frameScale}%`,
          height: `${100 / frameScale}%`,
          transform: `scale(${frameScale})`,
          transformOrigin: 'top left',
        }
      : undefined;

  const content =
    view.preview === undefined ? (
      <div className="grid h-full place-items-center px-6 text-center text-slate-400">
        {view.loading ? 'Compilando preview…' : 'Preview indisponível — corrija os erros de compilação.'}
      </div>
    ) : (
      <div ref={frameHost} className="h-full min-h-0 overflow-hidden bg-slate-100 p-5">
        <iframe
          key={`${view.id}-${view.preview.revision}`}
          sandbox=""
          srcDoc={view.preview.html}
          title={`Preview de ${view.path}`}
          className="w-full h-full border-0 rounded bg-white"
          style={frameStyle}
        />
      </div>
    );

  if (!split) return <div className="min-h-0 h-full">{content}</div>;
  return (
    <section className="grid min-h-0 min-w-0 flex-1 grid-rows-[auto_minmax(0,1fr)] border-l border-slate-200 bg-white" aria-label={`Preview ao lado de ${view.path}`}>
      <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
        Preview
      </div>
      {content}
    </section>
  );
}

function ResizableSplit({ left, right, label }: { readonly left: ReactNode; readonly right: ReactNode; readonly label: string }): JSX.Element {
  const host = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState(50);
  const [dragging, setDragging] = useState(false);
  const updateRatio = (clientX: number): void => {
    const bounds = host.current?.getBoundingClientRect();
    if (bounds === undefined || bounds.width <= 0) return;
    setRatio(Math.max(24, Math.min(76, ((clientX - bounds.left) / bounds.width) * 100)));
  };
  const nudge = (amount: number): void => setRatio((current) => Math.max(24, Math.min(76, current + amount)));
  return (
    <div ref={host} className="grid min-h-0 min-w-0 flex-1" style={{ gridTemplateColumns: `minmax(0, ${ratio}fr) 9px minmax(0, ${100 - ratio}fr)` }}>
      <div className="flex min-h-0 min-w-0 overflow-hidden">{left}</div>
      <div
        role="separator"
        aria-label={label}
        aria-orientation="vertical"
        aria-valuemin={24}
        aria-valuemax={76}
        aria-valuenow={Math.round(ratio)}
        tabIndex={0}
        className={`group relative z-10 cursor-col-resize touch-none outline-none ${dragging ? 'bg-indigo-100' : 'bg-slate-100 hover:bg-indigo-50 focus:bg-indigo-50'}`}
        onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setDragging(true); updateRatio(event.clientX); }}
        onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) updateRatio(event.clientX); }}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
        onKeyDown={(event) => { if (event.key === 'ArrowLeft') { event.preventDefault(); nudge(-3); } if (event.key === 'ArrowRight') { event.preventDefault(); nudge(3); } }}
      >
        <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-slate-200 group-hover:bg-indigo-300" />
        <span className="absolute left-1/2 top-1/2 h-9 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-300 group-hover:bg-indigo-400" />
      </div>
      <div className="flex min-h-0 min-w-0 overflow-hidden">{right}</div>
    </div>
  );
}

/**
 * F326–F330: alvo estritamente "inserir no documento atual" — por isso
 * `template.createDocument` (troca de aba) e `journal.capture` (escreve em
 * outro arquivo) ficam de fora, mesmo raciocínio que já exclui
 * `journal.openToday`. `slashCommands()` de `@abnt/workspace-navigation`
 * continua deliberadamente sem uso aqui: seus rótulos fixos divergiriam do
 * título/`isEnabled` reais assim que qualquer um mudasse.
 */
const SLASH_COMMAND_IDS = new Set(['citation.openPicker', 'figure.insert', 'table.insert', 'math.insertEquation', 'xref.insert', 'transclusion.insert']);
const slashCommandList = (registry: CommandRegistry, query: string): readonly { readonly id: string; readonly label: string }[] =>
  rankCommands(registry, {}, query).filter((item) => SLASH_COMMAND_IDS.has(item.id)).map(({ id, label }) => ({ id, label }));

const editorToolbarGroups: readonly (readonly { readonly commandId: string; readonly icon: FolioIconName; readonly title: string }[])[] = [
  [
    { commandId: 'editor.paragraph.heading1', icon: 'heading1', title: 'Título 1' },
    { commandId: 'editor.paragraph.heading2', icon: 'heading2', title: 'Título 2' },
  ],
  [
    { commandId: 'editor.format.bold', icon: 'bold', title: 'Negrito' },
    { commandId: 'editor.format.italic', icon: 'italic', title: 'Itálico' },
    { commandId: 'editor.format.strike', icon: 'strike', title: 'Tachado' },
    { commandId: 'editor.format.code', icon: 'code', title: 'Código em linha' },
  ],
  [
    { commandId: 'editor.paragraph.quote', icon: 'quote', title: 'Citação em bloco' },
    { commandId: 'editor.paragraph.list', icon: 'list', title: 'Lista' },
  ],
  [
    { commandId: 'link.insert', icon: 'link', title: 'Link do vault' },
    { commandId: 'citation.openPicker', icon: 'citation', title: 'Citação bibliográfica' },
    { commandId: 'figure.insert', icon: 'image', title: 'Figura' },
    { commandId: 'table.insert', icon: 'table', title: 'Tabela' },
    { commandId: 'math.insertEquation', icon: 'equation', title: 'Equação' },
  ],
];

function EditorToolbar({ onCommand }: { readonly onCommand: (commandId: string) => void }): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-100 bg-white/60 px-2 py-1" role="toolbar" aria-label="Formatação do documento">
      {editorToolbarGroups.map((group, index) => (
        <div key={index} className="flex items-center gap-0.5 border-r border-slate-100 pr-1.5 last:border-r-0">
          {group.map((button) => (
            <button
              key={button.commandId}
              type="button"
              title={button.title}
              aria-label={button.title}
              className="grid h-7 w-7 place-items-center rounded text-slate-500 hover:bg-slate-100 hover:text-indigo-700"
              onClick={() => onCommand(button.commandId)}
            >
              <FolioIcon name={button.icon} className="h-4 w-4" />
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

function EditorDocumentPane({
  view,
  statistics,
  onError,
  onDefinition,
  onReferences,
  onContextMenu,
  onAssetDropped,
  onKeepLocal,
  onReloadExternal,
  onCommand,
  slashCommands,
  paneHandleRef,
}: {
  readonly view: Extract<ViewState, { readonly type: 'editor' }>;
  readonly statistics?: LanguageWritingStatisticsDto;
  readonly onError: (message: string) => void;
  readonly onDefinition: (locations: readonly LanguageLocation[]) => void;
  readonly onReferences: (locations: readonly LanguageLocation[]) => void;
  readonly onContextMenu: (input: { readonly offset: number; readonly x: number; readonly y: number; readonly selection: { readonly anchor: number; readonly head: number } }) => void;
  readonly onAssetDropped: (uri: string, name: string) => void;
  readonly onKeepLocal: () => void;
  readonly onReloadExternal: () => void;
  readonly onCommand: (commandId: string) => void;
  readonly slashCommands: { readonly list: (query: string) => readonly { readonly id: string; readonly label: string }[]; readonly execute: (id: string) => void };
  readonly paneHandleRef: (handle: EditorPaneHandle | null) => void;
}): JSX.Element {
  const slash = view.path.lastIndexOf('/');
  const fileTitle = slash === -1 ? view.path : view.path.slice(slash + 1);
  const fileFolder = slash === -1 ? '' : view.path.slice(0, slash);
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {view.snapshot.externalChange !== undefined && (
        <div role="alert" className="flex flex-wrap items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          <span className="mr-auto">{view.path} mudou fora do aplicativo. Escolha qual versão preservar.</span>
          <button type="button" className="rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-semibold text-amber-950 hover:bg-amber-400" onClick={onKeepLocal}>Manter minha versão</button>
          <button type="button" className="rounded-lg border border-amber-300 px-2.5 py-1 text-xs hover:bg-amber-100" onClick={onReloadExternal}>Recarregar externa</button>
        </div>
      )}
      <div className="flex items-center gap-2.5 border-b border-slate-100 bg-white/70 px-4 py-2.5">
        <FolioIcon name={fileTitle.toLowerCase().endsWith('.pdf') ? 'pdf' : 'file'} className="h-4 w-4 shrink-0 text-slate-400" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-slate-900">{fileTitle}{view.snapshot.session.dirty && <span className="ml-1.5 align-middle text-[10px] text-indigo-500">●</span>}</div>
          {fileFolder !== '' && <div className="truncate text-[11px] text-slate-400">{fileFolder}</div>}
        </div>
      </div>
      <EditorToolbar onCommand={onCommand} />
      <EditorPane
        key={view.id}
        ref={paneHandleRef}
        controller={view.controller}
        api={window.academic}
        onError={onError}
        onDefinition={onDefinition}
        onReferences={onReferences}
        onContextMenu={onContextMenu}
        onAssetDropped={onAssetDropped}
        slashCommands={slashCommands}
      />
      {statistics !== undefined && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-slate-100 bg-slate-50/70 px-3 py-2 text-xs text-slate-500" aria-label="Estatísticas de escrita">
          <span>{statistics.words.toLocaleString('pt-BR')} palavras</span><span>{statistics.characters.toLocaleString('pt-BR')} caracteres</span><span>{statistics.paragraphs} parágrafos</span><span>{statistics.citations} citações</span><span>{statistics.figures} figuras</span><span>{statistics.tables} tabelas</span><span>{statistics.estimatedReadingMinutes} min de leitura</span>
        </div>
      )}
    </div>
  );
}

const PAGE_TYPE_LABEL: Readonly<Record<typeof PAGE_TYPES[number], string>> = { document: 'Documento', note: 'Nota', project: 'Projeto', dataset: 'Dataset', evidence: 'Evidência' };
const PAGE_STATUS_OPTIONS = ['Ideia', 'Em andamento', 'Em revisão', 'Concluído', 'Arquivado'] as const;
const listFromText = (value: string): readonly string[] => [...new Set(value.split(',').map((item) => item.trim()).filter((item) => item !== ''))];

function PagePropertiesDialog({ fileId, revision, onError, onCommand, onClose }: { readonly fileId: string; readonly revision: number; readonly onError: (message: string) => void; readonly onCommand: (id: string) => void; readonly onClose: () => void }): JSX.Element {
  const [page, setPage] = useState<import('@abnt/protocol').WorkspacePageDto>();
  const [status, setStatus] = useState(''); const [tags, setTags] = useState(''); const [tagDraft, setTagDraft] = useState(''); const [due, setDue] = useState(''); const [type, setType] = useState(''); const [project, setProject] = useState(''); const [aliases, setAliases] = useState('');
  const [projects, setProjects] = useState<readonly { readonly id: string; readonly title: string }[]>([]);
  useEffect(() => { let cancelled = false; void Promise.all([window.academic.workspace.pages(), window.academic.workspace.researchProjects()]).then(([pageList, projectList]) => { if (cancelled) return; if (pageList.ok) { const current = pageList.value.pages.find((item) => item.file.fileId === fileId); setPage(current); setStatus(current?.properties.status ?? ''); setTags(current?.properties.tags.join(', ') ?? ''); setDue(current?.properties.due ?? ''); setType(current?.properties.type ?? ''); setProject(current?.properties.project ?? ''); setAliases(current?.properties.aliases.join(', ') ?? ''); } else onError(pageList.error.message); if (projectList.ok) setProjects(projectList.value.projects.flatMap((item) => typeof item.id === 'string' && typeof item.title === 'string' ? [{ id: item.id, title: item.title }] : [])); else onError(projectList.error.message); }); return () => { cancelled = true; }; }, [fileId, revision, onError]);
  const save = (next: Partial<{ readonly status: string; readonly tags: string; readonly due: string; readonly type: string; readonly project: string; readonly aliases: string }> = {}): void => {
    if (page === undefined || page.properties.id === undefined) return;
    const nextStatus = next.status ?? status; const nextTags = next.tags ?? tags; const nextDue = next.due ?? due; const nextType = next.type ?? type; const nextProject = next.project ?? project; const nextAliases = next.aliases ?? aliases;
    const { status: _oldStatus, due: _oldDue, type: _oldType, project: _oldProject, ...rest } = page.properties;
    const properties = { ...rest, ...(nextStatus.trim() === '' ? {} : { status: nextStatus.trim() }), ...(nextDue.trim() === '' ? {} : { due: nextDue.trim() }), ...(nextType === '' ? {} : { type: nextType as typeof PAGE_TYPES[number] }), ...(nextProject.trim() === '' ? {} : { project: nextProject.trim() }), tags: listFromText(nextTags), aliases: listFromText(nextAliases) };
    void window.academic.workspace.setPageProperties({ fileId, expectedRevision: revision, properties }).then((result) => { if (!result.ok) onError(result.error.message); else setPage(result.value); });
  };
  const tagItems = listFromText(tags);
  const addTag = (): void => { const tag = tagDraft.trim().replace(/,$/u, ''); if (tag === '' || tagItems.includes(tag)) { setTagDraft(''); return; } const nextTags = [...tagItems, tag].join(', '); setTags(nextTags); setTagDraft(''); save({ tags: nextTags }); };
  const removeTag = (tag: string): void => { const nextTags = tagItems.filter((item) => item !== tag).join(', '); setTags(nextTags); save({ tags: nextTags }); };
  if (page === undefined) return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-5" role="presentation"><section role="dialog" aria-modal="true" aria-label="Propriedades da página" className="folio-page-properties-dialog">Carregando propriedades…</section></div>;
  if (page.properties.id === undefined) return <></>;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-labelledby="page-properties-title" className="folio-page-properties-dialog"><header><div><div className="folio-page-dialog-kicker"><FolioIcon name="metadata" className="h-3.5 w-3.5" /> Página</div><h2 id="page-properties-title">Propriedades do documento</h2><p>Organize este documento sem alterar o texto Markdown.</p></div><button type="button" className="folio-dialog-close" aria-label="Fechar propriedades da página" onClick={onClose}><FolioIcon name="close" /></button></header><div className="folio-page-properties" aria-label="Propriedades da página"><label className="folio-page-property">Tipo<select value={type} onChange={(event) => { setType(event.target.value); save({ type: event.target.value }); }}><option value="">Página</option>{PAGE_TYPES.map((item) => <option key={item} value={item}>{PAGE_TYPE_LABEL[item]}</option>)}</select></label><label className="folio-page-property">Status<select value={status} onChange={(event) => { setStatus(event.target.value); save({ status: event.target.value }); }}><option value="">Sem status</option>{PAGE_STATUS_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label className="folio-page-property folio-page-property-project">Projeto<select value={project} onChange={(event) => { setProject(event.target.value); save({ project: event.target.value }); }}><option value="">Sem projeto</option>{project !== '' && !projects.some((item) => item.id === project) && <option value={project}>Projeto removido ({project})</option>}{projects.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><label className="folio-page-property">Prazo<input type="date" value={due} onChange={(event) => setDue(event.target.value)} onBlur={() => save()} /></label><div className="folio-page-property folio-page-property-tags"><span>Tags</span><div className="folio-page-tags">{tagItems.map((tag) => <span key={tag} className="folio-page-tag">{tag}<button type="button" aria-label={`Remover tag ${tag}`} onClick={() => removeTag(tag)}><FolioIcon name="close" className="h-3 w-3" /></button></span>)}<input value={tagDraft} onChange={(event) => setTagDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); addTag(); } }} onBlur={addTag} placeholder={tagItems.length === 0 ? 'Adicionar tag' : '+'} aria-label="Adicionar tag" /></div></div><details className="folio-page-advanced"><summary>Mais propriedades</summary><label className="folio-page-property">Aliases<input value={aliases} onChange={(event) => setAliases(event.target.value)} onBlur={() => save()} placeholder="nome alternativo, sigla" /></label><div className="folio-page-context">{page.tasks.length > 0 && <span>{page.tasks.filter((task) => task.completed).length}/{page.tasks.length} tarefas</span>}<button type="button" onClick={() => onCommand('document.backlinks')}>Backlinks</button>{page.properties.relations.length > 0 && <button type="button" onClick={() => onCommand('graph.open')}>Relações ({page.properties.relations.length})</button>}</div></details></div><footer><span>As alterações são salvas no frontmatter do documento.</span><button type="button" onClick={onClose}>Concluir</button></footer></section></div>;
}

function SystemInformationDialog({ information, onClose }: {
  readonly information: SystemInformationDto;
  readonly onClose: () => void;
}): JSX.Element {
  const fields: readonly [string, string | number][] = [
    ['Produto', information.product],
    ['Versão', information.appVersion],
    ['Canal', information.channel],
    ['Commit', information.commit],
    ['Plataforma', `${information.platform} (${information.architecture})`],
    ['Electron', information.electronVersion],
    ['Protocolo', information.protocolVersion],
    ['Configuração do workspace', information.workspaceConfigSchemaVersion],
    ['Estado do workspace', information.workspaceStateSchemaVersion],
    ['Índice do workspace', information.workspaceIndexSchemaVersion],
    ['API de plugins', information.pluginApiVersion],
  ];
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-5" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="system-information-title"
        className="w-full max-w-lg rounded-lg border border-slate-600 bg-slate-900 p-5 shadow-2xl"
      >
        <div className="flex items-start gap-4">
          <div>
            <h2 id="system-information-title" className="text-lg font-semibold">Informações do sistema</h2>
            <p className="mt-1 text-sm text-slate-400">Identidade desta build do Folio. Nenhum dado do vault é exibido.</p>
          </div>
          <button type="button" aria-label="Fechar informações do sistema" onClick={onClose} className="ml-auto px-2 text-xl text-slate-400 hover:text-white">×</button>
        </div>
        <dl className="mt-5 grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-x-5 gap-y-2 text-sm">
          {fields.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-slate-400">{label}</dt>
              <dd className="break-all font-mono text-slate-100">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-6 flex justify-end">
          <button type="button" onClick={onClose} className="rounded-md bg-slate-700 px-3 py-1.5 text-sm hover:bg-slate-600">Fechar</button>
        </div>
      </section>
    </div>
  );
}

function LocationsDialog({ locations, onNavigate, onClose }: {
  readonly locations: readonly LanguageLocation[];
  readonly onNavigate: (location: LanguageLocation) => void;
  readonly onClose: () => void;
}): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-5" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="references-title" className="w-full max-w-xl rounded-lg border border-slate-600 bg-slate-900 p-5 shadow-2xl">
        <div className="flex items-start gap-4">
          <div>
            <h2 id="references-title" className="text-lg font-semibold">Referências encontradas</h2>
            <p className="mt-1 text-sm text-slate-400">{locations.length} ocorrência(s). Selecione uma para navegar.</p>
          </div>
          <button type="button" aria-label="Fechar referências" onClick={onClose} className="ml-auto px-2 text-xl text-slate-400 hover:text-white">×</button>
        </div>
        <ul className="mt-4 max-h-72 overflow-auto divide-y divide-slate-800">
          {locations.map((location, index) => (
            <li key={`${location.fileId}:${location.range.start}:${index}`}>
              <button type="button" className="w-full px-2 py-3 text-left hover:bg-slate-800" onClick={() => onNavigate(location)}>
                <span className="block font-mono text-sm text-slate-100">{location.path}</span>
                <span className="text-xs text-slate-400">posição {location.range.start}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex justify-end"><button type="button" onClick={onClose} className="rounded-md bg-slate-700 px-3 py-1.5 text-sm hover:bg-slate-600">Fechar</button></div>
      </section>
    </div>
  );
}

function SettingsDialog({ onClose, onOpen }: { readonly onClose: () => void; readonly onOpen: (command: string) => void }): JSX.Element {
  const items: readonly { readonly title: string; readonly description: string; readonly icon: FolioIconName; readonly command: string }[] = [
    { title: 'Plugins locais', description: 'Instale, ative e revise permissões dos plugins.', icon: 'plugins', command: 'plugins.manage' },
    { title: 'Automações e atalhos', description: 'Personalize teclas e comandos repetitivos.', icon: 'command', command: 'automation.open' },
    { title: 'Qualidade da biblioteca', description: 'Revise referências duplicadas e chaves.', icon: 'citation', command: 'library.maintenance' },
    { title: 'Centro de manutenção da biblioteca', description: 'Painel único de saúde, duplicatas, anexos e relações, com ações em lote.', icon: 'citation', command: 'library.maintenanceCenter' },
    { title: 'Desempenho', description: 'Consulte medições locais do workspace.', icon: 'gauge', command: 'performance.open' },
    { title: 'Sincronização local', description: 'Use uma pasta espelho sem enviar dados a nenhum serviço.', icon: 'folder', command: 'workspace.sync' },
    { title: 'Colaboração', description: 'Defina colaboradores e papéis; o estado acompanha a pasta espelho.', icon: 'profile', command: 'collaboration.manage' },
    { title: 'Informações do sistema', description: 'Versão, build e compatibilidade do Folio.', icon: 'profile', command: 'application.systemInformation' },
  ];
  return <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/45 p-5" role="presentation" onClick={onClose}><section role="dialog" aria-modal="true" aria-labelledby="settings-title" className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}><header className="flex items-start gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">Folio</p><h2 id="settings-title" className="mt-1 text-xl font-bold text-slate-900">Configurações</h2><p className="mt-1 text-sm text-slate-500">Preferências e ferramentas do ambiente de trabalho.</p></div><button type="button" aria-label="Fechar configurações" className="folio-control ml-auto grid h-9 w-9 place-items-center rounded-lg text-xl" onClick={onClose}>×</button></header><div className="mt-6 grid gap-2 sm:grid-cols-2">{items.map((item) => <button key={item.command} type="button" className="group flex gap-3 rounded-xl border border-slate-200 p-4 text-left hover:border-indigo-200 hover:bg-indigo-50" onClick={() => { onClose(); onOpen(item.command); }}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-white group-hover:text-indigo-600"><FolioIcon name={item.icon} /></span><span><strong className="block text-sm text-slate-800">{item.title}</strong><span className="mt-0.5 block text-xs leading-5 text-slate-500">{item.description}</span></span></button>)}</div></section></div>;
}

function SyncDialog({ onClose, onMessage }: { readonly onClose: () => void; readonly onMessage: (message: string) => void }): JSX.Element {
  const [status, setStatus] = useState<WorkspaceSyncStatusDto | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const refresh = async () => {
    const result = await window.academic.workspace.syncStatus();
    if (result.ok) setStatus(result.value); else onMessage(result.error.message);
  };
  useEffect(() => { void refresh(); }, []);
  const run = async (action: 'choose' | 'sync' | 'recover') => {
    setBusy(true);
    try {
      const result = action === 'choose' ? await window.academic.workspace.chooseSyncMirror() : action === 'sync' ? await window.academic.workspace.syncNow() : await window.academic.workspace.recoverFromSync();
      if (result.ok) { setStatus(result.value); onMessage(action === 'choose' ? 'Pasta espelho configurada. Sincronize quando estiver pronto.' : action === 'sync' ? 'Pasta espelho sincronizada.' : 'Vault recuperado a partir da pasta espelho.'); }
      else if (result.error.code !== 'CANCELLED') onMessage(result.error.message);
    } finally { setBusy(false); }
  };
  const resolveConflict = async (conflictId: string, resolution: 'keep-local' | 'use-mirror') => {
    setBusy(true);
    try {
      const result = await window.academic.workspace.resolveSyncConflict({ conflictId, resolution });
      if (result.ok) { setStatus(result.value); onMessage(resolution === 'keep-local' ? 'A versão local foi mantida na pasta espelho.' : 'A versão da pasta espelho foi aplicada ao vault.'); }
      else onMessage(result.error.message);
    } finally { setBusy(false); }
  };
  const label = status?.status === 'conflict' ? 'Conflitos exigem revisão' : status?.status === 'offline' ? 'Pasta espelho indisponível' : status?.configured ? 'Pasta espelho local configurada' : 'Nenhuma pasta espelho configurada';
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/45 p-5" role="presentation" onClick={onClose}><section role="dialog" aria-modal="true" aria-labelledby="sync-title" className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}><header className="flex items-start gap-4"><span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-100 text-indigo-700"><FolioIcon name="folder" /></span><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">Local-first</p><h2 id="sync-title" className="mt-1 text-xl font-bold text-slate-900">Pasta espelho</h2><p className="mt-1 text-sm text-slate-500">O Folio mantém seus arquivos em uma segunda pasta escolhida por você.</p></div><button type="button" aria-label="Fechar sincronização" className="folio-control ml-auto grid h-9 w-9 place-items-center rounded-lg text-xl" onClick={onClose}>×</button></header><div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="font-semibold text-slate-800">{status === undefined ? 'Verificando sincronização…' : label}</p><p className="mt-1 text-sm text-slate-500">{status?.configured ? `${status.pending} alteração(ões) pendente(s) · ${status.conflicts.length} conflito(s)` : 'Nenhum dado sai do computador. O caminho da pasta permanece privado.'}</p>{(status?.conflicts.length ?? 0) > 0 && <ul className="mt-3 max-h-40 space-y-2 overflow-auto rounded-lg bg-white p-2 text-xs text-amber-800">{status!.conflicts.map((conflict) => <li key={conflict.id} className="rounded border border-amber-100 p-2"><p className="truncate font-medium">{conflict.key}</p><div className="mt-2 flex gap-2"><button type="button" disabled={busy} className="rounded bg-indigo-600 px-2 py-1 text-white disabled:opacity-50" onClick={() => void resolveConflict(conflict.id, 'keep-local')}>Manter local</button><button type="button" disabled={busy} className="rounded border border-slate-200 px-2 py-1 text-slate-700 disabled:opacity-50" onClick={() => void resolveConflict(conflict.id, 'use-mirror')}>Usar espelho</button></div></li>)}</ul>}</div><div className="mt-6 flex flex-wrap justify-end gap-2"><button type="button" disabled={busy} className="folio-control rounded-lg px-3 py-2 text-sm font-semibold" onClick={() => void run('recover')}>Recuperar do espelho</button><button type="button" disabled={busy} className="folio-control rounded-lg px-3 py-2 text-sm font-semibold" onClick={() => void run('choose')}>{status?.configured ? 'Trocar pasta' : 'Escolher pasta'}</button><button type="button" disabled={busy || status?.configured !== true} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50" onClick={() => void run('sync')}>Sincronizar agora</button></div></section></div>;
}

function CollaborationDialog({ onClose, onMessage }: { readonly onClose: () => void; readonly onMessage: (message: string) => void }): JSX.Element {
  const [state, setState] = useState<WorkspaceCollaborationDto | undefined>(); const [busy, setBusy] = useState(false); const [section, setSection] = useState<'people' | 'review'>('people');
  useEffect(() => { void window.academic.workspace.collaboration().then((result) => result.ok ? setState(result.value) : onMessage(result.error.message)); }, []);
  const update = (index: number, field: 'name' | 'role', value: string): void => setState((current) => current === undefined ? current : { ...current, collaborators: current.collaborators.map((person, candidate) => candidate === index ? { ...person, [field]: value } : person) });
  const add = (): void => setState((current) => current === undefined ? current : { ...current, collaborators: [...current.collaborators, { id: crypto.randomUUID(), name: '', role: 'reviewer' }] });
  const remove = (index: number): void => setState((current) => current === undefined ? current : { ...current, collaborators: current.collaborators.filter((_, candidate) => candidate !== index) });
  const addMilestone = (): void => setState((current) => current === undefined ? current : { ...current, milestones: [...(current.milestones ?? []), { id: crypto.randomUUID(), title: 'Novo marco' }] });
  const addAssignment = (): void => setState((current) => { if (current === undefined) return current; const reviewerId = current.collaborators.find((item) => item.role === 'reviewer' || item.role === 'owner')?.id; return reviewerId === undefined ? current : { ...current, assignments: [...(current.assignments ?? []), { id: crypto.randomUUID(), target: { kind: 'document', id: 'Documento a revisar' }, reviewerIds: [reviewerId] }] }; });
  const addMention = (): void => setState((current) => { if (current === undefined || current.collaborators.length < 2) return current; const authorId = current.collaborators.find((item) => item.role === 'owner')?.id ?? current.collaborators[0]!.id; const collaboratorId = current.collaborators.find((item) => item.id !== authorId)?.id; return collaboratorId === undefined ? current : { ...current, mentions: [...(current.mentions ?? []), { id: crypto.randomUUID(), authorId, collaboratorId, context: 'Revisar este item na próxima rodada.', createdAt: new Date().toISOString() }] }; });
  const save = async (): Promise<void> => { if (state === undefined) return; setBusy(true); try { const result = await window.academic.workspace.setCollaboration(state); if (result.ok) { setState(result.value); onMessage('Colaboradores atualizados. Sincronize a pasta espelho para compartilhar o estado.'); } else onMessage(result.error.message); } finally { setBusy(false); } };
  if (state === undefined) return <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/45 p-5"><div className="rounded-xl bg-white p-6 text-sm text-slate-600 shadow-xl">Carregando colaboração…</div></div>;
  const people = new Map(state.collaborators.map((item) => [item.id, item.name || 'Sem nome']));
  const decisions = state.screening?.decisions ?? []; const compared = new Map<string, Set<string>>(); for (const decision of decisions) compared.set(decision.itemId, new Set([...(compared.get(decision.itemId) ?? []), decision.decision])); const conflicts = [...compared.values()].filter((item) => item.size > 1).length;
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/45 p-5" role="presentation" onClick={onClose}><section role="dialog" aria-modal="true" aria-labelledby="collaboration-title" className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}><header className="flex gap-4"><span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-100 text-indigo-700"><FolioIcon name="profile" /></span><div><p className="text-xs font-bold uppercase tracking-[.16em] text-indigo-600">Colaboração distribuída</p><h2 id="collaboration-title" className="mt-1 text-xl font-bold text-slate-900">Projeto compartilhado</h2><p className="mt-1 text-sm text-slate-500">Estado portátil para a pasta espelho, sem conta nem servidor.</p></div><button type="button" className="folio-control ml-auto grid h-9 w-9 place-items-center rounded-lg text-xl" aria-label="Fechar colaboração" onClick={onClose}>×</button></header><div className="mt-5 flex gap-1 rounded-xl bg-slate-100 p-1 text-sm font-semibold"><button type="button" className={`flex-1 rounded-lg px-3 py-2 ${section === 'people' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'}`} onClick={() => setSection('people')}>Pessoas</button><button type="button" className={`flex-1 rounded-lg px-3 py-2 ${section === 'review' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'}`} onClick={() => setSection('review')}>Revisão e triagem</button></div>{section === 'people' ? <><label className="mt-5 block text-sm font-medium text-slate-700">Nome do projeto<input value={state.title} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" onChange={(event) => setState({ ...state, title: event.target.value })} /></label><div className="mt-5 space-y-2"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-800">Colaboradores</h3><button type="button" className="text-sm font-semibold text-indigo-600" onClick={add}>Adicionar pessoa</button></div>{state.collaborators.map((person, index) => <div key={person.id} className="flex gap-2 rounded-lg border border-slate-200 p-2"><input value={person.name} placeholder="Nome" className="min-w-0 flex-1 rounded border border-slate-200 px-2 py-1.5 text-sm" onChange={(event) => update(index, 'name', event.target.value)} /><select value={person.role} className="rounded border border-slate-200 px-2 py-1.5 text-sm" onChange={(event) => update(index, 'role', event.target.value)}><option value="owner">Proprietário</option><option value="editor">Editor</option><option value="reviewer">Revisor</option><option value="viewer">Leitor</option></select><button type="button" aria-label="Remover colaborador" className="px-2 text-slate-400 hover:text-rose-600" onClick={() => remove(index)}>×</button></div>)}</div></> : <div className="mt-5 grid gap-4 md:grid-cols-2"><div className="rounded-xl border border-slate-200 p-4"><div className="flex justify-between gap-2"><h3 className="font-semibold text-slate-800">Marcos</h3><button type="button" className="text-sm font-semibold text-indigo-600" onClick={addMilestone}>Adicionar</button></div><div className="mt-3 space-y-2">{(state.milestones ?? []).map((item) => <label key={item.id} className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={item.completedAt !== undefined} onChange={(event) => setState({ ...state, milestones: (state.milestones ?? []).map((candidate) => candidate.id === item.id ? { ...candidate, ...(event.target.checked ? { completedAt: new Date().toISOString() } : { completedAt: undefined }) } : candidate) })} /><input className="min-w-0 flex-1 rounded border border-slate-200 px-2 py-1" value={item.title} onChange={(event) => setState({ ...state, milestones: (state.milestones ?? []).map((candidate) => candidate.id === item.id ? { ...candidate, title: event.target.value } : candidate) })} /></label>)}{(state.milestones ?? []).length === 0 && <p className="text-sm text-slate-500">Ainda não há marcos compartilhados.</p>}</div></div><div className="rounded-xl border border-slate-200 p-4"><div className="flex justify-between gap-2"><h3 className="font-semibold text-slate-800">Atribuições</h3><button type="button" className="text-sm font-semibold text-indigo-600" onClick={addAssignment}>Adicionar</button></div><div className="mt-3 space-y-2 text-sm text-slate-600">{(state.assignments ?? []).map((item) => <p key={item.id} className="rounded bg-slate-50 p-2">{item.target.id} · {item.reviewerIds.map((id) => people.get(id)).join(', ')}</p>)}{(state.assignments ?? []).length === 0 && <p className="text-slate-500">Distribua documentos, referências ou itens de triagem.</p>}</div></div><div className="rounded-xl border border-slate-200 p-4"><h3 className="font-semibold text-slate-800">Triagem cega</h3><p className="mt-2 text-sm text-slate-600">Fase: <select className="rounded border border-slate-200 px-2 py-1" value={state.screening?.phase ?? 'independent'} onChange={(event) => setState({ ...state, screening: { phase: event.target.value as 'independent' | 'reconciliation', decisions } })}><option value="independent">Independente</option><option value="reconciliation">Reconciliação</option></select></p><p className="mt-2 text-sm text-slate-500">{compared.size} item(ns) comparado(s), {conflicts} divergência(s). Decisões individuais só ficam visíveis na reconciliação.</p></div><div className="rounded-xl border border-slate-200 p-4"><div className="flex justify-between gap-2"><h3 className="font-semibold text-slate-800">Menções e presença</h3><button type="button" className="text-sm font-semibold text-indigo-600" onClick={addMention}>@ Mencionar</button></div><p className="mt-2 text-sm text-slate-500">{(state.mentions ?? []).length} menção(ões) · {(state.presence ?? []).length} presença(s) registrada(s).</p><p className="mt-2 text-xs text-slate-500">Edição concorrente: deliberadamente não habilitada; a pasta espelho continua a resolver conflitos explícitos.</p></div></div>}<footer className="mt-6 flex justify-end gap-2"><button type="button" className="folio-control rounded-lg px-3 py-2 text-sm font-semibold" onClick={onClose}>Cancelar</button><button type="button" disabled={busy} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={() => void save()}>Salvar colaboração</button></footer></section></div>;
}

type PaletteMode = 'commands' | 'files';
type SavedSearch = { readonly id: string; readonly name: string; readonly query: string };
type WorkspaceCollection = { readonly id: string; readonly name: string; readonly fileIds: readonly string[]; readonly referenceIds: readonly string[] };
type KnowledgeWorkspaceState = { readonly searches: readonly SavedSearch[]; readonly collections: readonly WorkspaceCollection[] };
const emptyKnowledgeWorkspace = (): KnowledgeWorkspaceState => ({ searches: [], collections: [] });
const knowledgeStorageKey = (workspaceId: string): string => `folio.knowledge:${workspaceId}`;
const loadKnowledgeWorkspace = (workspaceId: string): KnowledgeWorkspaceState => {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(knowledgeStorageKey(workspaceId)) ?? '{}');
    if (typeof value !== 'object' || value === null) return emptyKnowledgeWorkspace();
    const data = value as Partial<KnowledgeWorkspaceState>;
    const searches = Array.isArray(data.searches) ? data.searches.filter((item): item is SavedSearch => typeof item === 'object' && item !== null && typeof item.id === 'string' && typeof item.name === 'string' && typeof item.query === 'string') : [];
    const collections = Array.isArray(data.collections) ? data.collections.filter((item): item is WorkspaceCollection => typeof item === 'object' && item !== null && typeof item.id === 'string' && typeof item.name === 'string' && Array.isArray(item.fileIds) && Array.isArray(item.referenceIds)) : [];
    return { searches, collections };
  } catch { return emptyKnowledgeWorkspace(); }
};

/**
 * A UI da palette é propositalmente uma casca: comandos vêm do registro
 * headless; arquivos vêm da listagem e da busca FTS já servidas pelo host.
 */
function PaletteDialog({
  mode,
  files,
  recentFileIds,
  commandRegistry,
  commandContext,
  shortcuts,
  recentCommandIds,
  onClose,
  onCommand,
  onOpenFile,
}: {
  readonly mode: PaletteMode;
  readonly files: readonly WorkspaceFileDto[];
  readonly recentFileIds: readonly string[];
  readonly commandRegistry: ReturnType<typeof createCommandRegistry>;
  readonly commandContext: ReturnType<typeof commandContextForPalette>;
  readonly shortcuts: ReadonlyMap<string, string>;
  readonly recentCommandIds: readonly string[];
  readonly onClose: () => void;
  readonly onCommand: (id: string) => void;
  readonly onOpenFile: (fileId: string, path: string) => void;
}): JSX.Element {
  const [query, setQuery] = useState('');
  const [indexed, setIndexed] = useState<readonly WorkspaceSearchResultDto[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const request = useRef(0);

  useEffect(() => {
    input.current?.focus();
  }, []);

  useEffect(() => {
    if (mode !== 'files' || query.trim() === '') {
      setIndexed([]);
      return undefined;
    }
    const version = (request.current += 1);
    const timer = setTimeout(() => {
      void timePerformance('search', () => window.academic.workspace.search({ query: query.trim(), limit: 40 })).then((result) => {
        if (version === request.current && result.ok) setIndexed(result.value);
      });
    }, 120);
    return () => clearTimeout(timer);
  }, [mode, query]);

  const items = useMemo(() => {
    if (mode === 'commands') return rankCommands(commandRegistry, commandContext, query, shortcuts, recentCommandIds);
    const candidates = new Map<string, QuickOpenFile>(files.map((file) => [file.fileId, { fileId: file.fileId, path: file.path }]));
    for (const result of indexed) {
      candidates.set(result.fileId, { fileId: result.fileId, path: result.path, title: result.title });
    }
    return rankQuickOpenFiles([...candidates.values()], query, recentFileIds);
  }, [commandContext, commandRegistry, files, indexed, mode, query, recentCommandIds, recentFileIds, shortcuts]);

  const title = mode === 'commands' ? 'Command Palette' : 'Abrir arquivo rapidamente';
  const placeholder = mode === 'commands' ? 'Digite um comando…' : 'Digite nome, título ou conteúdo…';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/75 px-5 pt-[12vh]" role="presentation" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="palette-title"
        className="w-full max-w-2xl overflow-hidden rounded-lg border border-slate-600 bg-slate-900 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="palette-title" className="sr-only">{title}</h2>
        <input
          ref={input}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') onClose();
            if (event.key === 'Enter' && items[0] !== undefined) {
              event.preventDefault();
              if (mode === 'commands') onCommand(items[0].id);
              else {
                const file = files.find((candidate) => candidate.fileId === items[0]?.id) ?? indexed.find((candidate) => candidate.fileId === items[0]?.id);
                if (file !== undefined) onOpenFile(file.fileId, file.path);
              }
            }
          }}
          placeholder={placeholder}
          aria-label={title}
          className="w-full border-0 border-b border-slate-700 bg-slate-800 px-4 py-3 text-base text-slate-100 placeholder:text-slate-500 outline-none"
        />
        <ul className="max-h-[55vh] overflow-auto py-1" aria-label={`Resultados: ${title}`}>
          {items.length === 0 ? (
            <li className="px-4 py-6 text-sm text-slate-500">Nenhum resultado.</li>
          ) : (
            items.slice(0, 40).map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="flex w-full items-baseline gap-4 px-4 py-2.5 text-left hover:bg-slate-800"
                  onClick={() => {
                    if (mode === 'commands') onCommand(item.id);
                    else {
                      const file = files.find((candidate) => candidate.fileId === item.id) ?? indexed.find((candidate) => candidate.fileId === item.id);
                      if (file !== undefined) onOpenFile(file.fileId, file.path);
                    }
                  }}
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-100">{item.label}</span>
                  {item.category !== undefined && <span className="hidden rounded bg-slate-700 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300 sm:block">{item.category}</span>}
                  {item.shortcut !== undefined && <kbd className="rounded border border-slate-600 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">{item.shortcut}</kbd>}
                  {item.detail !== undefined && <span className="truncate font-mono text-xs text-slate-500">{item.detail}</span>}
                </button>
              </li>
            ))
          )}
        </ul>
        <footer className="border-t border-slate-700 px-4 py-2 text-xs text-slate-500">
          {mode === 'commands' ? 'Categorias, aliases e atalhos refletem o único Command Registry · Enter executa' : 'Busca conteúdo pelo índice FTS5 · Enter abre o primeiro resultado'}
        </footer>
      </section>
    </div>
  );
}

/**
 * F72/F73 — superfície acadêmica dedicada, distinta do Quick Open. Ela só
 * recebe DTOs de busca já calculados pelo Workspace Service; filtros, seções
 * e snippets nunca são reconstruídos a partir de Markdown no renderer.
 */
function SearchViewDialog({
  query,
  results,
  commandRegistry,
  commandContext,
  onQueryChange,
  onClose,
}: {
  readonly query: string;
  readonly results: readonly WorkspaceSearchResultDto[];
  readonly commandRegistry: ReturnType<typeof createCommandRegistry>;
  readonly commandContext: ReturnType<typeof commandContextForPalette>;
  readonly onQueryChange: (query: string) => void;
  readonly onClose: () => void;
}): JSX.Element {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);
  const groups = useMemo(() => {
    const grouped = new Map<string, WorkspaceSearchResultDto[]>();
    for (const result of results) {
      const label = result.section?.title ?? 'Documento';
      const current = grouped.get(label) ?? [];
      current.push(result);
      grouped.set(label, current);
    }
    return [...grouped.entries()];
  }, [results]);
  const contextFor = (result: WorkspaceSearchResultDto) => ({
    ...commandContext,
    targetSearchResult: {
      fileId: result.fileId,
      path: result.path,
      title: result.title,
      ...(result.section === undefined ? {} : { section: result.section }),
    },
  });
  const run = (id: string, result?: WorkspaceSearchResultDto): void => {
    void commandRegistry.execute(id, result === undefined
      ? { ...commandContext, targetSearchQuery: query }
      : contextFor(result));
  };
  const appendFilter = (filter: string): void => onQueryChange(`${query.trim()}${query.trim() === '' ? '' : ' '}${filter}`);
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 p-5" role="presentation" onMouseDown={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="search-view-title" className="mx-auto grid h-full max-h-[52rem] w-full max-w-5xl grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <header className="flex items-start gap-4 border-b border-slate-200 px-5 py-4"><div><h2 id="search-view-title" className="text-lg font-bold text-slate-900">Busca acadêmica</h2><p className="text-sm text-slate-500">Operadores, seções e ações sobre a mesma projeção do vault.</p></div><button type="button" aria-label="Fechar busca" className="folio-control ml-auto grid h-8 w-8 place-items-center rounded-lg text-lg" onClick={onClose}>×</button></header>
        <div className="border-b border-slate-200 px-5 py-3"><div className="flex gap-2"><input ref={input} value={query} type="search" onChange={(event) => onQueryChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') onClose(); }} placeholder={'tag:metodologia OR tag:qualitativa · has:citation NOT has:figure'} aria-label="Consulta acadêmica" className="folio-input min-w-0 flex-1 rounded-lg px-3 py-2 text-sm" /><button type="button" className="folio-primary rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-40" disabled={query.trim() === ''} onClick={() => run('search.createSaved')}>Salvar busca</button></div><div className="mt-2 flex flex-wrap items-center gap-2 text-xs"><span className="font-semibold text-slate-500">Filtros:</span>{['tag:metodologia', 'has:citation', 'NOT has:figure', 'year:2024', '(author:"Silva" OR author:"Souza")'].map((filter) => <button key={filter} type="button" onClick={() => appendFilter(filter)} className="rounded-full bg-indigo-50 px-2.5 py-1 font-medium text-indigo-700 hover:bg-indigo-100">{filter}</button>)}<span className="ml-auto text-slate-500">{results.length} resultado(s)</span></div></div>
        <div className="min-h-0 overflow-auto p-5">{query.trim() === '' ? <p className="rounded-lg bg-slate-50 p-5 text-sm text-slate-500">Digite texto livre ou combine filtros com <code>OR</code>, <code>NOT</code> e parênteses.</p> : results.length === 0 ? <p className="rounded-lg bg-slate-50 p-5 text-sm text-slate-500">Nenhum documento corresponde à consulta.</p> : <div className="grid gap-5">{groups.map(([section, entries]) => <section key={section}><h3 className="border-b border-slate-100 pb-1 text-xs font-bold uppercase tracking-[0.13em] text-slate-500">{section}</h3><ul className="mt-2 grid gap-2">{entries.map((result) => <li key={`${result.fileId}:${result.section?.range.start ?? 0}`} className="rounded-lg border border-slate-200 p-3"><div className="flex min-w-0 items-start gap-3"><button type="button" className="min-w-0 flex-1 text-left" onClick={() => run('search.open', result)}><strong className="block truncate text-sm text-slate-800">{result.title}</strong><span className="block truncate font-mono text-xs text-slate-500">{result.path}{result.section === undefined ? '' : ` · ${result.section.title}`}</span><span className="mt-1 block text-sm text-slate-600">{result.snippet === '' ? 'Correspondência estrutural.' : renderSnippet(result.snippet)}</span></button><div className="flex shrink-0 flex-wrap justify-end gap-1"><button type="button" className="folio-control rounded px-2 py-1 text-xs" title="Abrir" onClick={() => run('search.open', result)}>Abrir</button><button type="button" disabled={!commandRegistry.isEnabled('search.openSide', contextFor(result))} className="folio-control rounded px-2 py-1 text-xs disabled:opacity-40" title="Abrir ao lado" onClick={() => run('search.openSide', result)}>Ao lado</button><button type="button" className="folio-control rounded px-2 py-1 text-xs" onClick={() => run('search.addToCollection', result)}>Collection</button><button type="button" className="folio-control rounded px-2 py-1 text-xs" onClick={() => run('search.copyLink', result)}>Copiar link</button></div></div></li>)}</ul></section>)}</div>}</div>
      </section>
    </div>
  );
}

function WorkspaceSearchSidebar({
  query,
  results,
  onQueryChange,
  onClose,
  onOpenFile,
}: {
  readonly query: string;
  readonly results: readonly WorkspaceSearchResultDto[];
  readonly onQueryChange: (query: string) => void;
  readonly onClose: () => void;
  readonly onOpenFile: (result: WorkspaceSearchResultDto) => void;
}): JSX.Element {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);
  const hasQuery = query.trim() !== '';
  return (
    <aside className="folio-sidebar flex min-h-0 flex-col border-r p-4" aria-label="Busca no vault">
      <header className="flex items-start gap-3 border-b border-slate-200 pb-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-700"><FolioIcon name="search" className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1"><h2 className="text-sm font-bold text-slate-800">Buscar no vault</h2><p className="mt-0.5 text-xs leading-5 text-slate-500">Títulos e conteúdo dos documentos.</p></div>
        <button type="button" aria-label="Fechar busca no vault" title="Fechar busca" className="folio-control grid h-8 w-8 place-items-center rounded-lg text-lg" onClick={onClose}>×</button>
      </header>
      <div className="pt-4">
        <label className="sr-only" htmlFor="vault-search-input">Consulta</label>
        <input ref={input} id="vault-search-input" type="search" value={query} onChange={(event) => onQueryChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') onClose(); }} placeholder="Digite para buscar…" className="folio-input w-full rounded-xl px-3 py-2.5 text-sm" />
        <p className="mt-2 text-xs text-slate-400">Pesquisa local no índice do vault.</p>
      </div>
      <div className="mt-4 min-h-0 flex-1">
        {!hasQuery ? <p className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-500">Digite uma palavra, título ou trecho para encontrar documentos.</p>
          : results.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-500">Nenhum documento corresponde à busca.</p>
            : <VirtualizedList
                ariaLabel="Resultados da busca no vault"
                className="m-0 h-full p-0"
                height="100%"
                viewportHeight={520}
                itemHeight={92}
                items={results}
                getKey={(result) => `${result.fileId}:${result.section?.range.start ?? 0}`}
                renderItem={(result) => <button type="button" className="w-full rounded-xl px-3 py-2.5 text-left hover:bg-indigo-50" onClick={() => onOpenFile(result)}><div className="truncate text-sm font-semibold text-slate-800">{result.title}</div><div className="mt-0.5 truncate font-mono text-[11px] text-slate-400">{result.path}</div><div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{result.snippet === '' ? 'Correspondência estrutural.' : renderSnippet(result.snippet)}</div></button>}
              />}
      </div>
    </aside>
  );
}

function SplitEditorDialog({ files, onClose, onOpen }: {
  readonly files: readonly WorkspaceFileDto[];
  readonly onClose: () => void;
  readonly onOpen: (file: WorkspaceFileDto) => void;
}): JSX.Element {
  const [query, setQuery] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);
  const matches = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('pt-BR');
    return needle === '' ? files : files.filter((file) => file.path.toLocaleLowerCase('pt-BR').includes(needle));
  }, [files, query]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/75 px-5 pt-[12vh]" role="presentation" onMouseDown={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="split-editor-title" className="w-full max-w-xl overflow-hidden rounded-lg border border-slate-600 bg-slate-900 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <h2 id="split-editor-title" className="px-4 pt-3 text-sm font-semibold">Abrir arquivo ao lado</h2>
        <input ref={input} type="search" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') onClose(); if (event.key === 'Enter' && matches[0] !== undefined) onOpen(matches[0]); }} placeholder="Filtrar arquivos…" className="m-3 w-[calc(100%-1.5rem)] rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none" />
        <ul className="max-h-[45vh] overflow-auto py-1" aria-label="Arquivos para dividir o editor">
          {matches.slice(0, 60).map((file) => <li key={file.fileId}><button type="button" className="w-full px-4 py-2 text-left text-sm hover:bg-slate-800" onClick={() => onOpen(file)}>{file.path}</button></li>)}
          {matches.length === 0 && <li className="px-4 py-5 text-sm text-slate-500">Nenhum arquivo encontrado.</li>}
        </ul>
      </section>
    </div>
  );
}

function commandContextForPalette(active: ViewState | undefined): { activeViewId?: ViewId; activeFileId?: string } {
  return active === undefined ? {} : { activeViewId: active.id, activeFileId: active.fileId };
}

function CitationDialog({ fileId, workspaceId, initial, replaceRange, onClose, onApply }: {
  readonly fileId: string;
  readonly workspaceId: string | undefined;
  readonly initial: CitationDraft | undefined;
  readonly replaceRange: { readonly start: number; readonly end: number } | undefined;
  readonly onClose: () => void;
  readonly onApply: (range: { readonly start: number; readonly end: number }, text: string) => void;
}): JSX.Element {
  const [references, setReferences] = useState<readonly import('@abnt/protocol').WorkspaceReferenceDto[]>([]);
  const [filter, setFilter] = useState('');
  const [quickAdd, setQuickAdd] = useState('');
  const [items, setItems] = useState<readonly CitationItemDraft[]>(initial?.items ?? []);
  const [mode, setMode] = useState<CitationEditMode>(initial?.mode ?? 'parenthetical');
  useEffect(() => { void window.academic.documents.references({ fileId }).then((result) => { if (result.ok) setReferences(result.value); }); }, [fileId]);
  const referenceById = useMemo(() => new Map(references.map((reference) => [reference.id, reference])), [references]);
  /** Onda BP (F505): referências já citadas neste documento, ou do mesmo projeto do documento, sobem no picker. */
  const boostedIds = useMemo(() => {
    if (workspaceId === undefined) return new Set<string>();
    const projects = readResearchProjects(workspaceId).filter((project) => project.documentIds.includes(fileId));
    return new Set(projects.flatMap((project) => project.referenceIds));
  }, [workspaceId, fileId]);
  const rankScore = (reference: import('@abnt/protocol').WorkspaceReferenceDto): number => reference.citationCount * 2 + (boostedIds.has(reference.id) ? 1 : 0);
  const filtered = references
    .filter((reference) => `${reference.id} ${reference.formatted}`.toLocaleLowerCase().includes(filter.toLocaleLowerCase()))
    .slice()
    .sort((left, right) => rankScore(right) - rankScore(left) || left.id.localeCompare(right.id));
  const range = replaceRange;
  const updateItem = (index: number, patch: Partial<CitationItemDraft>): void => setItems((current) => current.map((item, candidate) => candidate === index ? { ...item, ...patch } : item));
  const moveItem = (index: number, direction: -1 | 1): void => setItems((current) => {
    const next = index + direction; if (next < 0 || next >= current.length) return current;
    const copy = [...current]; [copy[index], copy[next]] = [copy[next]!, copy[index]!]; return copy;
  });
  const addItem = (referenceId: string, patch: Partial<CitationItemDraft> = {}): void => { if (referenceId !== '' && !items.some((item) => item.referenceId === referenceId)) setItems((current) => [...current, { referenceId, ...patch }]); };
  /** Onda BP (F507): "chave, p. 12" em um campo só, reaproveitando o mesmo parser de locator do editor inline. */
  const applyQuickAdd = (): void => {
    const value = quickAdd.trim();
    if (value === '') return;
    const [keyPart, ...restParts] = value.split(',');
    const key = (keyPart ?? '').trim();
    const rest = restParts.join(',').trim();
    const candidate = referenceById.get(key) ?? filtered.find((reference) => reference.id.toLocaleLowerCase().includes(key.toLocaleLowerCase()));
    if (candidate === undefined) return;
    addItem(candidate.id, rest === '' ? {} : parseLocatorSuffix(rest));
    setQuickAdd('');
  };
  const editableItems = mode === 'narrative' ? items.slice(0, 1) : items;
  const draft: CitationDraft = { mode, items: editableItems };
  const preview = citationPreviewText(draft, referenceById);
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-5" role="presentation">
    <section role="dialog" aria-modal="true" aria-labelledby="citation-editor-title" className="folio-citation-dialog w-full max-w-2xl rounded-lg border border-slate-600 bg-slate-900 p-5 shadow-2xl">
      <div className="flex items-start gap-3"><div><h2 id="citation-editor-title" className="text-lg font-semibold">{initial === undefined ? 'Inserir citação' : 'Editar citação'}</h2><p className="text-sm text-slate-400">O resultado continua sendo Markdown no documento.</p></div><button type="button" className="ml-auto text-xl text-slate-400 hover:text-white" onClick={onClose}>×</button></div>
      <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Pesquisar referência…" className="mt-4 w-full rounded bg-slate-800 px-3 py-2 text-sm outline-none" />
      <select value="" onChange={(event) => { addItem(event.target.value); event.currentTarget.value = ''; }} className="mt-2 w-full rounded bg-slate-800 px-3 py-2 text-sm"><option value="">Adicionar referência ao grupo…</option>{filtered.filter((reference) => !items.some((item) => item.referenceId === reference.id)).map((reference) => <option key={reference.id} value={reference.id}>{reference.id} — {reference.formatted}</option>)}</select>
      <div className="mt-2 flex gap-2"><input value={quickAdd} onChange={(event) => setQuickAdd(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); applyQuickAdd(); } }} placeholder="Adição rápida: chave, p. 12" className="min-w-0 flex-1 rounded bg-slate-800 px-3 py-2 text-sm outline-none" /><button type="button" className="rounded bg-slate-700 px-3 py-1.5 text-xs" onClick={applyQuickAdd}>Adicionar</button></div>
      <div className="mt-3 grid grid-cols-3 gap-2">{([['parenthetical', 'Parentética'], ['narrative', 'Narrativa'], ['suppress-author', 'Suprimir autor']] as const).map(([value, label]) => <button type="button" key={value} onClick={() => setMode(value)} className={`rounded px-2 py-1.5 text-xs ${mode === value ? 'bg-cyan-700' : 'bg-slate-800 hover:bg-slate-700'}`}>{label}</button>)}</div>
      {mode === 'narrative' && items.length > 1 && <p className="mt-3 rounded bg-amber-950/60 px-3 py-2 text-xs text-amber-200">A forma narrativa representa uma fonte por vez; os itens adicionais serão preservados ao voltar ao grupo parentético.</p>}
      <ol className="mt-3 grid gap-2">{editableItems.map((item, index) => <li key={`${item.referenceId}:${index}`} className="rounded border border-slate-700 bg-slate-800/60 p-3"><div className="flex items-center gap-2"><strong className="min-w-0 flex-1 truncate text-sm">{item.referenceId}</strong><button type="button" aria-label="Mover acima" disabled={index === 0} className="rounded bg-slate-700 px-2 py-1 text-xs disabled:opacity-40" onClick={() => moveItem(index, -1)}>↑</button><button type="button" aria-label="Mover abaixo" disabled={index === editableItems.length - 1} className="rounded bg-slate-700 px-2 py-1 text-xs disabled:opacity-40" onClick={() => moveItem(index, 1)}>↓</button><button type="button" aria-label="Remover" className="rounded bg-red-900/70 px-2 py-1 text-xs" onClick={() => setItems((current) => current.filter((_, candidate) => candidate !== index))}>×</button></div><div className="mt-2 grid gap-2 sm:grid-cols-2"><select value={item.locatorKind ?? 'page'} onChange={(event) => updateItem(index, { locatorKind: event.target.value as CitationLocatorKind })} className="rounded bg-slate-900 px-2 py-1.5 text-sm"><option value="page">Página</option><option value="chapter">Capítulo</option><option value="section">Seção</option><option value="paragraph">Parágrafo</option><option value="volume">Volume</option><option value="issue">Número</option><option value="figure">Figura</option><option value="table">Tabela</option></select><input value={item.locator ?? ''} onChange={(event) => updateItem(index, { locator: event.target.value })} placeholder="Locator (42, 3, Método…)" className="rounded bg-slate-900 px-2 py-1.5 text-sm" /><input value={item.prefix ?? ''} onChange={(event) => updateItem(index, { prefix: event.target.value })} placeholder="Prefixo do item" className="rounded bg-slate-900 px-2 py-1.5 text-sm" /><input value={item.suffix ?? ''} onChange={(event) => updateItem(index, { suffix: event.target.value })} placeholder="Sufixo do item" className="rounded bg-slate-900 px-2 py-1.5 text-sm" /></div></li>)}</ol>
      {preview !== undefined && <p className="mt-3 rounded bg-cyan-950/40 p-2 text-sm text-cyan-100"><span className="mr-2 text-xs font-semibold uppercase tracking-wide text-cyan-400">Prévia aproximada</span>{preview}</p>}
      <p className="mt-2 rounded bg-slate-950 p-2 font-mono text-sm text-slate-300">{items.length === 0 ? 'Adicione uma referência' : citationSource(draft)}</p>
      <div className="mt-5 flex justify-end gap-2"><button type="button" className="rounded bg-slate-700 px-3 py-1.5 text-sm" onClick={onClose}>Cancelar</button><button type="button" disabled={editableItems.length === 0 || range === undefined} onClick={() => range !== undefined && onApply(range, citationSource(draft))} className="rounded bg-cyan-700 px-3 py-1.5 text-sm disabled:opacity-40">Aplicar</button></div>
    </section></div>;
}

const documentTemplateOptions: readonly { readonly kind: TemplateKind; readonly label: string; readonly description: string; readonly path: string }[] = [
  { kind: 'article', label: 'Artigo', description: 'Estrutura de artigo acadêmico com referências.', path: 'artigo.md' },
  { kind: 'institutional-article', label: 'Artigo institucional', description: 'Artigo com campos de instituição e curso.', path: 'artigo-institucional.md' },
  { kind: 'tcc', label: 'TCC', description: 'Elementos e seções iniciais para trabalho de conclusão.', path: 'tcc.md' },
  { kind: 'institutional-tcc', label: 'TCC institucional', description: 'Modelo institucional com orientação e folha de rosto.', path: 'tcc-institucional.md' },
  { kind: 'dissertation', label: 'Dissertação', description: 'Estrutura genérica de dissertação de mestrado.', path: 'dissertacao.md' },
  { kind: 'thesis', label: 'Tese', description: 'Estrutura genérica de tese de doutorado.', path: 'tese.md' },
  { kind: 'abstract', label: 'Resumo', description: 'Resumo independente com palavras-chave.', path: 'resumo.md' },
  { kind: 'reading-note', label: 'Nota', description: 'Fichamento para registrar leitura e ideias.', path: 'notas/fichamento.md' },
  { kind: 'research-project', label: 'Projeto', description: 'Problema, objetivos, método e cronograma.', path: 'projeto-pesquisa.md' },
];

const availableDocumentPath = (desired: string, existingPaths: ReadonlySet<string>): string => {
  if (!existingPaths.has(desired)) return desired;
  const match = /^(.*?)(\.[^./]+)?$/u.exec(desired);
  const stem = match?.[1] ?? desired;
  const extension = match?.[2] ?? '';
  for (let suffix = 2; suffix < 10_000; suffix += 1) {
    const candidate = `${stem}-${suffix}${extension}`;
    if (!existingPaths.has(candidate)) return candidate;
  }
  return desired;
};

function DocumentCreatorDialog({ initialKind, existingPaths, onClose, onCreate }: {
  readonly initialKind: TemplateKind;
  readonly existingPaths: readonly string[];
  readonly onClose: () => void;
  readonly onCreate: (kind: TemplateKind, path: string) => Promise<string | undefined>;
}): JSX.Element {
  const initial = documentTemplateOptions.find((option) => option.kind === initialKind) ?? documentTemplateOptions[0]!;
  const [kind, setKind] = useState<TemplateKind>(initial.kind);
  const existing = useMemo(() => new Set(existingPaths), [existingPaths]);
  const [path, setPath] = useState(() => availableDocumentPath(initial.path, existing));
  const [error, setError] = useState<string>();
  const [creating, setCreating] = useState(false);
  const choose = (option: typeof documentTemplateOptions[number]): void => { setKind(option.kind); setPath(availableDocumentPath(option.path, existing)); setError(undefined); };
  const collision = existing.has(path.trim());
  const create = async (): Promise<void> => { setCreating(true); setError(undefined); const message = await onCreate(kind, path.trim()); if (message !== undefined) setError(message); setCreating(false); };
  return <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/55 p-5" role="presentation" onClick={onClose}><section role="dialog" aria-modal="true" aria-labelledby="document-creator-title" className="grid h-[min(82vh,48rem)] w-full max-w-4xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}><header className="flex items-start gap-4 border-b border-slate-200 px-6 py-5"><div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-100 text-xl font-semibold text-indigo-700">+</div><div><p className="text-xs font-bold uppercase tracking-[.16em] text-indigo-600">Novo arquivo</p><h2 id="document-creator-title" className="mt-1 text-xl font-bold text-slate-900">Criar documento</h2><p className="mt-1 text-sm text-slate-500">Escolha um ponto de partida; cada template gera Markdown normal no vault.</p></div><button type="button" aria-label="Fechar criação de documento" className="folio-control ml-auto grid h-9 w-9 place-items-center rounded-lg text-xl" onClick={onClose}>×</button></header><div className="overflow-auto p-6"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{documentTemplateOptions.map((option) => <button key={option.kind} type="button" className={`min-h-28 rounded-xl border p-4 text-left transition ${kind === option.kind ? 'border-indigo-400 bg-indigo-50 text-indigo-950 shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:bg-slate-50'}`} onClick={() => choose(option)}><strong className="block text-sm">{option.label}</strong><span className="mt-2 block text-xs leading-5 text-slate-500">{option.description}</span></button>)}</div><label className="mt-6 grid gap-1 text-sm font-medium text-slate-700"><span>Salvar como</span><input autoFocus value={path} onChange={(event) => { setPath(event.target.value); setError(undefined); }} placeholder="pasta/documento.md" className="rounded-lg border border-slate-300 px-3 py-2 text-slate-800" />{collision && <span className="text-xs text-amber-700">Esse arquivo já existe. Sugestão: {availableDocumentPath(path.trim(), existing)}</span>}</label>{error !== undefined && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}</div><footer className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4"><button type="button" className="folio-control rounded-lg px-3 py-2 text-sm font-semibold" onClick={onClose}>Cancelar</button><button type="button" disabled={path.trim() === '' || collision || creating} className="folio-primary rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-40" onClick={() => void create()}>{creating ? 'Criando…' : `Criar ${documentTemplateOptions.find((option) => option.kind === kind)?.label ?? 'documento'}`}</button></footer></section></div>;
}

const REFERENCE_TYPES = [
  ['article-journal', 'Artigo de periódico'],
  ['book', 'Livro'],
  ['chapter', 'Capítulo'],
  ['thesis', 'Tese / dissertação'],
  ['webpage', 'Página web'],
  ['paper-conference', 'Trabalho em evento'],
] as const;

interface ReferenceDraft {
  readonly id: string;
  readonly type: BibliographicEntityDto['type'];
  readonly title: string;
  readonly authors: string;
  readonly publisher: string;
  readonly containerTitle: string;
  readonly year: string;
  readonly doi: string;
  readonly url: string;
}

const emptyReferenceDraft = (): ReferenceDraft => ({
  id: '', type: 'article-journal', title: '', authors: '', publisher: '', containerTitle: '', year: '', doi: '', url: '',
});

const nameText = (name: NonNullable<BibliographicEntityDto['author']>[number]): string =>
  name.literal ?? [name.family, name.given].filter(Boolean).join(', ');

const draftFromReference = (entry: BibliographicEntityDto): ReferenceDraft => ({
  id: entry.id,
  type: entry.type,
  title: entry.title ?? '',
  authors: (entry.author ?? []).map(nameText).join('\n'),
  publisher: entry.publisher ?? '',
  containerTitle: entry['container-title'] ?? '',
  year: String(entry.issued?.['date-parts']?.[0]?.[0] ?? ''),
  doi: entry.DOI ?? '',
  url: entry.URL ?? '',
});

const entryFromDraft = (draft: ReferenceDraft, base: BibliographicEntityDto | undefined): BibliographicEntityDto => {
  const authors = draft.authors.split('\n').map((raw) => raw.trim()).filter(Boolean).map((raw) => {
    const [family, ...given] = raw.split(',').map((part) => part.trim());
    if (family === undefined || given.length === 0) return { literal: raw };
    return { family, ...(given.join(', ') === '' ? {} : { given: given.join(', ') }) };
  });
  const year = /^\d{4}$/u.test(draft.year.trim()) ? Number(draft.year.trim()) : undefined;
  return {
    ...(base ?? {}),
    id: draft.id.trim(),
    type: draft.type,
    ...(draft.title.trim() === '' ? {} : { title: draft.title.trim() }),
    ...(authors.length === 0 ? {} : { author: authors }),
    ...(draft.publisher.trim() === '' ? {} : { publisher: draft.publisher.trim() }),
    ...(draft.containerTitle.trim() === '' ? {} : { 'container-title': draft.containerTitle.trim() }),
    ...(year === undefined ? {} : { issued: { 'date-parts': [[year]] } }),
    ...(draft.doi.trim() === '' ? {} : { DOI: draft.doi.trim() }),
    ...(draft.url.trim() === '' ? {} : { URL: draft.url.trim() }),
  };
};

function ReferenceLibraryDialog({ onClose, onOpenLiteratureNote }: { readonly onClose: () => void; readonly onOpenLiteratureNote: (fileId: string, path: string) => void }): JSX.Element {
  const [entries, setEntries] = useState<readonly BibliographicEntityDto[]>([]);
  const [attachmentItems, setAttachmentItems] = useState<readonly AttachmentDto[]>([]);
  const [attachmentRole, setAttachmentRole] = useState<AttachmentRoleDto>('primary');
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<ReferenceDraft>(emptyReferenceDraft);
  const [preview, setPreview] = useState('Preencha a chave e o tipo para ver a referência ABNT.');
  const [pdfReaderReferenceId, setPdfReaderReferenceId] = useState<string | undefined>(undefined);
  const [relations, setRelations] = useState<readonly ReferenceRelationDto[]>([]);
  const [relationKind, setRelationKind] = useState<ReferenceRelationKindDto>('version-of');
  const [relationTargetId, setRelationTargetId] = useState<string | undefined>(undefined);
  const [fullTextCandidates, setFullTextCandidates] = useState<readonly import('@abnt/protocol').FullTextCandidateDto[]>([]);
  const selected = entries.find((entry) => entry.id === selectedId);
  const visibleEntries = entries.filter((entry) => `${entry.id} ${entry.title ?? ''} ${entry.author?.map((author) => author.literal ?? [author.family, author.given].filter(Boolean).join(' ')).join(' ') ?? ''}`.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR')));
  const attachmentsForSelected = selectedId === undefined ? [] : attachmentItems.filter((item) => item.referenceId === selectedId);
  const relationsForSelected = selectedId === undefined ? [] : relations.filter((relation) => relation.fromId === selectedId || relation.toId === selectedId);

  const load = (): void => {
    void window.academic.library.list({}).then((result) => { if (result.ok) setEntries(result.value); });
    void window.academic.workspace.attachments({}).then((result) => { if (result.ok) setAttachmentItems(result.value); });
    void window.academic.workspace.referenceRelations({}).then((result) => { if (result.ok) setRelations(result.value.relations); });
  };
  useEffect(load, []);
  useEffect(() => {
    const entry = entryFromDraft(draft, selected);
    if (entry.id === '') { setPreview('Preencha a chave e o tipo para ver a referência ABNT.'); return undefined; }
    let cancelled = false;
    const timer = setTimeout(() => {
      void window.academic.library.format({ entry }).then((result) => {
        if (!cancelled) setPreview(result.ok ? result.value : result.error.message);
      });
    }, 160);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [draft, selected]);

  const choose = (entry: BibliographicEntityDto): void => { setSelectedId(entry.id); setDraft(draftFromReference(entry)); };
  const save = async (): Promise<void> => {
    const entry = entryFromDraft(draft, selected);
    if (entry.id === '') return;
    const result = await window.academic.library.upsert({ entry });
    if (!result.ok) { setPreview(result.error.message); return; }
    setSelectedId(result.value.id);
    setDraft(draftFromReference(result.value));
    load();
  };
  const remove = async (): Promise<void> => {
    if (selectedId === undefined || !await requestConfirmation({ title: 'Excluir referência?', description: `A referência “${selectedId}” será removida da biblioteca. Os documentos do vault não serão alterados.`, confirmLabel: 'Excluir referência' })) return;
    const result = await window.academic.library.remove({ id: selectedId });
    if (!result.ok) { setPreview(result.error.message); return; }
    setSelectedId(undefined); setDraft(emptyReferenceDraft()); load();
  };
  const duplicate = (): void => {
    const suffix = draft.id === '' ? 'ref' : `${draft.id}-copia`;
    setSelectedId(undefined); setDraft({ ...draft, id: suffix });
  };
  const importDoi = async (): Promise<void> => {
    const result = await window.academic.library.resolveDoi({ doi: draft.doi });
    if (!result.ok) { setPreview(result.error.message); return; }
    setSelectedId(undefined);
    setDraft(draftFromReference(result.value));
  };
  const field = (key: keyof ReferenceDraft, label: string, placeholder?: string): JSX.Element => <label className="grid gap-1.5 text-sm font-medium text-slate-700"><span>{label}</span><input value={draft[key] as string} placeholder={placeholder} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100" /></label>;

  const attachmentRoleLabel: Record<AttachmentRoleDto, string> = { primary: 'Principal', supplementary: 'Suplementar', dataset: 'Dataset', snapshot: 'Snapshot' };
  const attachFile = async (): Promise<void> => {
    if (selectedId === undefined) return;
    const result = await window.academic.workspace.pickAndAddAttachment({ referenceId: selectedId, role: attachmentRole });
    if (result.ok) load(); else setPreview(result.error.message);
  };
  const attachLink = async (): Promise<void> => {
    if (selectedId === undefined) return;
    const uri = await requestText('URL do link ou snapshot', 'https://');
    if (uri === null || uri.trim() === '') return;
    const result = await window.academic.workspace.addAttachment({ referenceId: selectedId, role: attachmentRole, kind: 'link', mediaType: 'text/html', uri: uri.trim() });
    if (result.ok) load(); else setPreview(result.error.message);
  };
  const addAttachmentVersion = async (attachmentId: string): Promise<void> => {
    const result = await window.academic.workspace.pickAndAddAttachmentVersion({ attachmentId });
    if (result.ok) load(); else setPreview(result.error.message);
  };
  const removeAttachmentItem = async (attachmentId: string): Promise<void> => {
    const result = await window.academic.workspace.removeAttachment({ attachmentId });
    if (result.ok) load(); else setPreview(result.error.message);
  };
  const applyRenameSuggestion = async (attachmentId: string, filename: string): Promise<void> => {
    const result = await window.academic.workspace.renameAttachmentFile({ attachmentId, filename });
    if (result.ok) load(); else setPreview(result.error.message);
  };
  const openAttachmentFile = async (attachmentId: string): Promise<void> => {
    const result = await window.academic.workspace.openAttachmentFile({ attachmentId });
    if (!result.ok) setPreview(result.error.message);
  };
  const revealAttachmentFile = async (attachmentId: string): Promise<void> => {
    const result = await window.academic.workspace.revealAttachmentFile({ attachmentId });
    if (!result.ok) setPreview(result.error.message);
  };
  const relationKindLabel: Record<ReferenceRelationKindDto, string> = { 'version-of': 'Versão de', 'extension-of': 'Extensão de', 'replica-of': 'Réplica de', 'revision-of': 'Revisão de', 'correction-of': 'Correção de' };
  const createRelation = async (): Promise<void> => {
    if (selectedId === undefined || relationTargetId === undefined) return;
    const result = await window.academic.workspace.addReferenceRelation({ kind: relationKind, fromId: selectedId, toId: relationTargetId });
    if (result.ok) load(); else setPreview(result.error.message);
  };
  const removeRelation = async (id: string): Promise<void> => {
    const result = await window.academic.workspace.removeReferenceRelation({ id });
    if (result.ok) load(); else setPreview(result.error.message);
  };
  const findFullText = async (): Promise<void> => {
    if (selectedId === undefined) return;
    const result = await window.academic.library.discoverFullText({ referenceId: selectedId });
    if (!result.ok) { setPreview(result.error.message); return; }
    setFullTextCandidates(result.value.candidates);
    if (result.value.failures.length > 0) setPreview(result.value.failures.map((failure) => `${failure.provider}: ${failure.message}`).join(' · '));
  };
  const downloadCandidate = async (url: string): Promise<void> => {
    if (selectedId === undefined) return;
    const result = await window.academic.library.downloadFullText({ referenceId: selectedId, url, ...(selected?.title === undefined ? {} : { displayTitle: selected.title }) });
    if (!result.ok) { setPreview(result.error.message); return; }
    setFullTextCandidates([]); load();
  };
  const fullTextControls = selectedId === undefined ? null : <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50/50 p-4"><div className="flex items-center gap-3"><div><h3 className="text-xs font-bold uppercase tracking-[0.14em] text-sky-800">Texto completo</h3><p className="mt-1 text-xs text-slate-600">Descoberta revisável; o download só começa após sua confirmação.</p></div><button type="button" className="ml-auto rounded-lg border border-sky-200 bg-white px-3 py-2 text-xs font-semibold text-sky-800" onClick={() => void findFullText()}>Buscar</button></div>{fullTextCandidates.length > 0 && <ul className="mt-3 grid gap-2">{fullTextCandidates.map((candidate) => <li key={candidate.url} className="flex flex-wrap items-center gap-2 rounded-xl border border-sky-100 bg-white p-2.5 text-xs"><span className="font-semibold text-slate-800">{candidate.provider}</span><span className="rounded bg-sky-100 px-1.5 py-0.5 text-sky-800">{candidate.license}</span><span className="text-slate-500">{Math.round(candidate.confidence * 100)}%</span><span className="min-w-0 flex-1 truncate text-slate-600">{candidate.url}</span><button type="button" className="rounded bg-sky-700 px-2.5 py-1.5 font-semibold text-white" onClick={() => void downloadCandidate(candidate.url)}>Baixar e anexar</button></li>)}</ul>}</div>;
  const relationControls = selectedId === undefined ? null : <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
    <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-600">Relações</h3>
    <ul className="mt-3 grid gap-2">{relationsForSelected.length === 0 ? <li className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-500">Nenhuma relação registrada.</li> : relationsForSelected.map((relation) => {
      const outgoing = relation.fromId === selectedId;
      const counterpartId = outgoing ? relation.toId : relation.fromId;
      const counterpart = entries.find((entry) => entry.id === counterpartId);
      return <li key={relation.id} className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-xs">
        <span className="rounded-full bg-indigo-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">{relationKindLabel[relation.kind]}</span>
        <span className="text-slate-500">{outgoing ? '→' : '←'}</span>
        <span className="min-w-0 flex-1 truncate font-medium text-slate-700">{counterpart?.title ?? counterpartId}</span>
        <button type="button" className="rounded-lg px-2 py-1 text-rose-700 hover:bg-rose-50" onClick={() => void removeRelation(relation.id)}>Remover</button>
      </li>;
    })}</ul>
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <select aria-label="Papel da nova relação" value={relationKind} onChange={(event) => setRelationKind(event.target.value as ReferenceRelationKindDto)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs">{(Object.keys(relationKindLabel) as ReferenceRelationKindDto[]).map((kind) => <option key={kind} value={kind}>{relationKindLabel[kind]}</option>)}</select>
      <select aria-label="Referência relacionada" value={relationTargetId ?? ''} onChange={(event) => setRelationTargetId(event.target.value === '' ? undefined : event.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"><option value="">Escolha a referência…</option>{entries.filter((entry) => entry.id !== selectedId).map((entry) => <option key={entry.id} value={entry.id}>{entry.title ?? entry.id}</option>)}</select>
      <button type="button" disabled={relationTargetId === undefined} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40" onClick={() => void createRelation()}>Criar relação</button>
    </div>
  </div>;
  const attachmentControls = selectedId === undefined ? null : <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
    <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-600">Anexos</h3>
    <ul className="mt-3 grid gap-2">{attachmentsForSelected.length === 0 ? <li className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-500">Nenhum anexo.</li> : attachmentsForSelected.map((item) => {
      const latest = item.versions[item.versions.length - 1];
      const label = item.displayTitle ?? latest?.path ?? latest?.uri ?? item.id;
      const currentFileName = latest?.path?.split('/').pop();
      return <li key={item.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs">
        <div className="flex items-center gap-2"><span className="rounded-full bg-slate-200 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700">{attachmentRoleLabel[item.role]}</span><span className="min-w-0 flex-1 truncate font-medium text-slate-700">{label}</span><span className="whitespace-nowrap text-slate-500">{item.versions.length} versão(ões)</span></div>
        {item.suggestedFilename !== undefined && currentFileName !== item.suggestedFilename && <button type="button" className="mt-1 block text-indigo-300 hover:text-indigo-200" onClick={() => void applyRenameSuggestion(item.id, item.suggestedFilename!)}>Renomear para “{item.suggestedFilename}”</button>}
        <div className="mt-2 flex flex-wrap gap-2">
          {item.role === 'primary' && item.mediaType === 'application/pdf' && <button type="button" className="rounded bg-cyan-800 px-2 py-1" onClick={() => setPdfReaderReferenceId(selectedId)}>Ler no Folio</button>}
          {item.kind === 'file' && <button type="button" className="rounded bg-slate-700 px-2 py-1" onClick={() => void openAttachmentFile(item.id)}>Abrir externo</button>}
          {item.kind === 'file' && <button type="button" className="rounded bg-slate-700 px-2 py-1" onClick={() => void revealAttachmentFile(item.id)}>Revelar</button>}
          {item.kind === 'file' && <button type="button" className="rounded bg-slate-700 px-2 py-1" onClick={() => void addAttachmentVersion(item.id)}>Nova versão</button>}
          {item.kind === 'link' && latest?.uri !== undefined && <button type="button" className="rounded bg-slate-700 px-2 py-1" onClick={() => void navigator.clipboard.writeText(latest.uri!)}>Copiar link</button>}
          <button type="button" className="rounded bg-red-800 px-2 py-1" onClick={() => void removeAttachmentItem(item.id)}>Remover</button>
        </div>
      </li>;
    })}</ul>
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <select aria-label="Papel do novo anexo" value={attachmentRole} onChange={(event) => setAttachmentRole(event.target.value as AttachmentRoleDto)} className="rounded bg-slate-900 px-2 py-1 text-xs">{(['primary', 'supplementary', 'dataset', 'snapshot'] as const).map((role) => <option key={role} value={role}>{attachmentRoleLabel[role]}</option>)}</select>
      <button type="button" className="rounded bg-cyan-800 px-2 py-1 text-xs" onClick={() => void attachFile()}>Anexar arquivo</button>
      <button type="button" className="rounded bg-slate-700 px-2 py-1 text-xs" onClick={() => void attachLink()}>Adicionar link</button>
    </div>
  </div>;
  return <>
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="reference-library-title" className="grid h-[min(88vh,56rem)] w-full max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl md:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-b border-slate-200 bg-slate-50 md:border-b-0 md:border-r">
          <header className="border-b border-slate-200 px-4 py-4">
            <div className="flex items-center justify-between gap-3"><div><h2 id="reference-library-title" className="text-base font-bold tracking-tight">Biblioteca</h2><p className="mt-0.5 text-xs text-slate-500">{entries.length} referência{entries.length === 1 ? '' : 's'}</p></div><button type="button" className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700" onClick={() => { setSelectedId(undefined); setDraft(emptyReferenceDraft()); }}>Nova</button></div>
            <label className="relative mt-3 block"><span className="sr-only">Buscar na biblioteca</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar título ou chave…" className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100" /><span aria-hidden="true" className="pointer-events-none absolute right-3 top-2 text-slate-400">⌕</span></label>
          </header>
          <VirtualizedList ariaLabel="Referências da biblioteca" className="min-h-0 flex-1 p-2" height="100%" viewportHeight={520} itemHeight={68} items={visibleEntries} getKey={(entry) => entry.id} renderItem={(entry) => <button type="button" onClick={() => choose(entry)} className={`h-full w-full rounded-xl border px-3 py-2.5 text-left transition ${entry.id === selectedId ? 'border-indigo-200 bg-indigo-50 shadow-sm' : 'border-transparent hover:border-slate-200 hover:bg-white'}`}><span className="block truncate text-sm font-semibold text-slate-800">{entry.title ?? entry.id}</span><span className="mt-1 block truncate font-mono text-[11px] text-slate-500">{entry.id}</span></button>} />
          {visibleEntries.length === 0 && <p className="px-5 py-8 text-center text-sm text-slate-500">Nenhuma referência encontrada.</p>}
        </aside>
        <div className="min-w-0 overflow-auto">
          <header className="sticky top-0 z-10 flex items-start border-b border-slate-200 bg-white/95 px-5 py-5 backdrop-blur md:px-7">
            <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">Referência bibliográfica</p><h2 className="mt-1 text-xl font-bold tracking-tight">{selectedId === undefined ? 'Adicionar referência' : 'Editar referência'}</h2><p className="mt-1 text-sm text-slate-500">Dados CSL-JSON canônicos, com formatação ABNT em tempo real.</p></div>
            <button type="button" aria-label="Fechar biblioteca" className="folio-control ml-auto grid h-9 w-9 place-items-center rounded-lg text-xl text-slate-500" onClick={onClose}>×</button>
          </header>
          <div className="mx-auto max-w-4xl p-5 md:p-7">
            <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 md:p-5"><div className="grid gap-4 sm:grid-cols-2">{field('id', 'Chave de citação', 'silva2024')}<label className="grid gap-1.5 text-sm font-medium text-slate-700"><span>Tipo</span><select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as ReferenceDraft['type'] })} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100">{REFERENCE_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{field('title', 'Título')}{field('authors', 'Autores (um por linha: Sobrenome, Nome)')}{field('containerTitle', draft.type === 'article-journal' ? 'Periódico' : 'Obra / evento')}{field('publisher', 'Editora')}{field('year', 'Ano', '2024')}{field('doi', 'DOI')}{field('url', 'URL')}</div><div className="mt-4 flex justify-end"><button type="button" disabled={draft.doi.trim() === ''} onClick={() => void importDoi()} className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40">Resolver DOI e revisar</button></div></section>
            {fullTextControls}{attachmentControls}{relationControls}
            <section className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4"><h3 className="text-xs font-bold uppercase tracking-[0.14em] text-indigo-700">Preview ABNT</h3><p className="mt-2 text-sm leading-6 text-slate-700">{preview}</p></section>
            <footer className="mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-5"><button type="button" disabled={selectedId === undefined} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40" onClick={duplicate}>Duplicar</button><button type="button" disabled={selectedId === undefined} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 disabled:opacity-40" onClick={() => void remove()}>Excluir</button><button type="button" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100" onClick={onClose}>Cancelar</button><button type="button" disabled={draft.id.trim() === ''} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40" onClick={() => void save()}>Salvar referência</button></footer>
          </div>
        </div>
      </section>
    </div>
    {pdfReaderReferenceId !== undefined && <PdfReaderDialog referenceId={pdfReaderReferenceId} onClose={() => setPdfReaderReferenceId(undefined)} onOpenLiteratureNote={onOpenLiteratureNote} />}
  </>;
}

function ReferenceHealthDialog({ onClose }: { readonly onClose: () => void }): JSX.Element {
  const [health, setHealth] = useState<WorkspaceReferenceHealthDto | undefined>(undefined);
  const [attachmentIssues, setAttachmentIssues] = useState<readonly AttachmentHealthIssueDto[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);
  useEffect(() => {
    void window.academic.workspace.referenceHealth({}).then((result) => { if (result.ok) setHealth(result.value); else setError(result.error.message); });
    void window.academic.workspace.attachmentHealth().then((result) => { if (result.ok) setAttachmentIssues(result.value); });
  }, []);
  if (error !== undefined) return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-5"><section role="dialog" aria-modal="true" aria-labelledby="reference-health-error-title" className="w-full max-w-md rounded-lg border border-rose-200 bg-white p-5 shadow-2xl"><h2 id="reference-health-error-title" className="text-lg font-semibold text-slate-900">Não foi possível carregar a saúde das referências</h2><p role="alert" className="mt-2 text-sm text-rose-700">{error}</p><div className="mt-5 flex justify-end"><button type="button" className="folio-control rounded-lg px-3 py-2 text-sm font-semibold" onClick={onClose}>Fechar</button></div></section></div>;
  if (health === undefined) return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-5"><section role="dialog" aria-modal="true" aria-labelledby="reference-health-loading-title" className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 text-center shadow-2xl"><h2 id="reference-health-loading-title" className="text-lg font-semibold text-slate-900">Saúde das referências</h2><p role="status" className="mt-3 text-sm text-slate-500">Calculando auditoria bibliográfica…</p><button type="button" className="folio-control mt-5 rounded-lg px-3 py-2 text-sm font-semibold" onClick={onClose}>Cancelar</button></section></div>;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-5"><section role="dialog" aria-modal="true" className="flex h-[min(82vh,48rem)] w-full max-w-2xl flex-col rounded-lg border border-slate-600 bg-slate-900 p-5 shadow-2xl"><div className="flex"><div><h2 className="text-lg font-semibold">Saúde das referências</h2><p className="text-sm text-slate-400">Projeção bibliográfica do catálogo, anexos, notas e citações — não é validação normativa.</p></div><button type="button" className="ml-auto text-xl text-slate-400" onClick={onClose}>×</button></div>{health === undefined ? <p className="py-8 text-center text-slate-400">Calculando…</p> : <><div className="mt-4 grid grid-cols-2 gap-2 text-center text-sm"><div className="rounded bg-slate-800 p-3">Referências<br /><strong>{health.total}</strong></div><div className="rounded bg-cyan-950/60 p-3">Citadas<br /><strong>{health.cited}</strong></div><div className="rounded bg-amber-950/60 p-3">Não usadas<br /><strong>{health.unused}</strong></div><div className="rounded bg-slate-800 p-3">Sem DOI<br /><strong>{health.withoutDoi}</strong></div></div><div className="mt-4"><h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Chaves citadas e não encontradas</h3>{health.missing.length === 0 ? <p className="mt-1 text-sm text-slate-300">Nenhuma.</p> : <ul className="mt-1 list-disc pl-5 font-mono text-sm text-red-300">{health.missing.map((id) => <li key={id}>{id}</li>)}</ul>}</div><div className="mt-4 min-h-0 flex flex-1 flex-col"><h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Auditoria bibliográfica ({health.audit.length})</h3>{health.audit.length === 0 ? <p className="mt-1 text-sm text-emerald-300">Nenhuma lacuna encontrada.</p> : <VirtualizedList ariaLabel="Auditoria bibliográfica" className="mt-1 flex-1 divide-y divide-slate-800" height="100%" viewportHeight={340} itemHeight={52} items={health.audit} getKey={(issue) => `${issue.referenceId}:${issue.code}`} renderItem={(issue) => <div className="px-1 py-2 text-sm"><code className="mr-2 text-cyan-300">{issue.referenceId}</code><span className="text-slate-200">{issue.message}</span></div>} />}</div><div className="mt-4"><h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Saúde dos anexos ({attachmentIssues.length})</h3>{attachmentIssues.length === 0 ? <p className="mt-1 text-sm text-emerald-300">Nenhum anexo com problema.</p> : <ul className="mt-1 grid gap-1 text-sm">{attachmentIssues.map((issue) => <li key={`${issue.attachmentId}:${issue.code}`}><code className="mr-2 text-cyan-300">{issue.referenceId}</code><span className="text-slate-200">{issue.message}</span></li>)}</ul>}</div></>}</section></div>;
}

function DiagnosticsCenter({ view, onClose, onCreateMissingReference }: { readonly view: Extract<ViewState, { type: 'editor' }>; readonly onClose: () => void; readonly onCreateMissingReference: (id: string) => void }): JSX.Element {
  const diagnostics = view.snapshot.diagnostics;
  const counts = { error: diagnostics.filter((item) => item.severity === 'error').length, warning: diagnostics.filter((item) => item.severity === 'warning').length, info: diagnostics.filter((item) => item.severity === 'info').length };
  const category = (id: string): string => id.startsWith('CIT') ? 'Citações' : id.startsWith('REF') ? 'Referências' : id.startsWith('TCC') || id.startsWith('ABNT') ? 'ABNT e metadata' : id.startsWith('FIG') || id.startsWith('TAB') ? 'Figuras e tabelas' : 'Estrutura';
  const groups = new Map<string, typeof diagnostics>();
  for (const diagnostic of diagnostics) groups.set(category(diagnostic.id), [...(groups.get(category(diagnostic.id)) ?? []), diagnostic]);
  const applyFigureFix = (item: typeof diagnostics[number], kind: 'caption' | 'source'): void => { const start=item.source?.start.offset; const end=item.source?.end.offset; if(start===undefined||end===undefined)return; const content=view.snapshot.session.content; const lineStart=content.lastIndexOf('\n',start)+1; const lineEnd=content.indexOf('\n',end); if(kind==='caption') view.controller.dispatch({edits:[{range:{start:lineStart,end:lineStart},text:'Figura: [Preencher legenda]\n'}]}); else view.controller.dispatch({edits:[{range:{start:lineEnd<0?content.length:lineEnd,end:lineEnd<0?content.length:lineEnd},text:'\nFonte: [Preencher fonte]'}]}); };
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-5" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="diagnostics-center-title" className="w-full max-w-3xl rounded-lg border border-slate-600 bg-slate-900 p-5 shadow-2xl"><div className="flex"><div><h2 id="diagnostics-center-title" className="text-lg font-semibold">Diagnósticos acadêmicos</h2><p className="text-sm text-slate-400">{view.path}</p></div><button type="button" className="ml-auto text-xl text-slate-400 hover:text-white" onClick={onClose}>×</button></div><div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm"><div className="rounded bg-red-950/60 p-2 text-red-200">Erros<br /><strong>{counts.error}</strong></div><div className="rounded bg-amber-950/60 p-2 text-amber-200">Avisos<br /><strong>{counts.warning}</strong></div><div className="rounded bg-slate-800 p-2 text-slate-300">Informações<br /><strong>{counts.info}</strong></div></div><div className="mt-4 max-h-[55vh] overflow-auto">{diagnostics.length === 0 ? <p className="py-6 text-center text-slate-400">Nenhum diagnóstico neste documento.</p> : [...groups].map(([name, entries]) => <section key={name} className="mb-4"><h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{name}</h3><ul className="mt-1 divide-y divide-slate-800">{entries.map((item) => { const missing=item.id==='CIT-REF-AUSENTE'?/"([^"]+)"/u.exec(item.message)?.[1]:undefined; return <li key={`${item.id}:${item.source?.start.offset ?? -1}`} className="px-2 py-2"><button type="button" className="w-full text-left hover:bg-slate-800" onClick={() => { const offset = item.source?.start.offset ?? 0; view.controller.dispatch({ selection: { anchor: offset, head: item.source?.end.offset ?? offset } }); }}><span className="mr-2 text-xs uppercase text-slate-400">{item.severity}</span>{item.message}<span className="ml-2 font-mono text-xs text-slate-500">{item.id}</span></button>{missing !== undefined && <button type="button" className="mt-2 rounded bg-cyan-800 px-2 py-1 text-xs hover:bg-cyan-700" onClick={() => onCreateMissingReference(missing)}>Criar referência “{missing}”</button>}{item.id==='ABNT-6022-FIG-001' && <button type="button" className="mt-2 ml-2 rounded bg-cyan-800 px-2 py-1 text-xs hover:bg-cyan-700" onClick={() => applyFigureFix(item,'caption')}>Adicionar legenda</button>}{item.id==='ABNT-6022-FIG-002' && <button type="button" className="mt-2 ml-2 rounded bg-cyan-800 px-2 py-1 text-xs hover:bg-cyan-700" onClick={() => applyFigureFix(item,'source')}>Adicionar fonte</button>}</li>; })}</ul></section>)}</div></section></div>;
}
function TableDialog({ initial, onClose, onApply }: { readonly initial?: MarkdownTableDraft; readonly onClose: () => void; readonly onApply: (text: string) => void }): JSX.Element {
  const [columns, setColumns] = useState(initial?.headers.length ?? 3); const [rows, setRows] = useState(initial?.rows.length ?? 3); const [alignment, setAlignment] = useState<'left' | 'center' | 'right'>(initial?.alignment[0] ?? 'left');
  const [headers, setHeaders] = useState<string[]>(() => initial?.headers.slice() ?? ['Coluna 1', 'Coluna 2', 'Coluna 3']);
  const [body, setBody] = useState<string[][]>(() => initial?.rows.map((row) => row.slice()) ?? Array.from({ length: 3 }, () => ['', '', '']));
  const resize = (nextColumns: number, nextRows: number): void => { setColumns(nextColumns); setRows(nextRows); setHeaders((current) => Array.from({length:nextColumns},(_,index)=>current[index] ?? `Coluna ${index+1}`)); setBody((current) => Array.from({length:nextRows},(_,row)=>Array.from({length:nextColumns},(_,column)=>current[row]?.[column] ?? ''))); };
  const source = markdownTableSource({ headers, rows: body, alignment: Array.from({ length: columns }, () => alignment) });
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-5"><section role="dialog" aria-modal="true" aria-labelledby="table-title" className="w-full max-w-4xl rounded-lg border border-slate-600 bg-slate-900 p-5 shadow-2xl"><div className="flex"><div><h2 id="table-title" className="text-lg font-semibold">{initial === undefined ? 'Inserir tabela' : 'Editar tabela'}</h2><p className="text-sm text-slate-400">Gera Markdown GFM normal.</p></div><button type="button" className="ml-auto text-xl" onClick={onClose}>×</button></div><div className="mt-5 grid grid-cols-2 gap-4"><div className="rounded bg-slate-800 p-3"><span className="text-sm">Colunas</span><div className="mt-2 flex items-center gap-3"><button type="button" onClick={() => resize(Math.max(1,columns-1),rows)} className="rounded bg-slate-700 px-3 py-1">−</button><strong>{columns}</strong><button type="button" onClick={() => resize(Math.min(12,columns+1),rows)} className="rounded bg-slate-700 px-3 py-1">+</button></div></div><div className="rounded bg-slate-800 p-3"><span className="text-sm">Linhas</span><div className="mt-2 flex items-center gap-3"><button type="button" onClick={() => resize(columns,Math.max(1,rows-1))} className="rounded bg-slate-700 px-3 py-1">−</button><strong>{rows}</strong><button type="button" onClick={() => resize(columns,Math.min(100,rows+1))} className="rounded bg-slate-700 px-3 py-1">+</button></div></div></div><label className="mt-4 grid gap-1 text-sm">Alinhamento<select value={alignment} onChange={(event) => setAlignment(event.target.value as 'left' | 'center' | 'right')} className="rounded bg-slate-800 p-2"><option value="left">À esquerda</option><option value="center">Centralizado</option><option value="right">À direita</option></select></label><div className="mt-4 max-h-64 overflow-auto"><table className="w-full border-collapse text-sm"><thead><tr>{headers.map((header,index)=><th className="border border-slate-600 p-1" key={index}><input className="w-full bg-slate-800 p-1" value={header} onChange={(event)=>setHeaders(current=>current.map((cell,at)=>at===index?event.target.value:cell))}/></th>)}</tr></thead><tbody>{body.map((row,rowIndex)=><tr key={rowIndex}>{row.map((cell,columnIndex)=><td className="border border-slate-700 p-1" key={columnIndex}><input className="w-full bg-slate-800 p-1" value={cell} onChange={(event)=>setBody(current=>current.map((candidate,at)=>at===rowIndex?candidate.map((value,col)=>col===columnIndex?event.target.value:value):candidate))}/></td>)}</tr>)}</tbody></table></div><pre className="mt-4 max-h-32 overflow-auto rounded bg-slate-950 p-3 text-xs text-slate-300">{source}</pre><div className="mt-5 flex justify-end gap-2"><button type="button" className="rounded bg-slate-700 px-3 py-1.5" onClick={onClose}>Cancelar</button><button type="button" className="rounded bg-cyan-700 px-3 py-1.5" onClick={() => onApply(source)}>{initial === undefined ? 'Inserir' : 'Aplicar'}</button></div></section></div>;
}

const relativeAssetUri = (sourcePath: string, assetPath: string): string => {
  const from = sourcePath.split('/').slice(0, -1).filter(Boolean);
  const target = assetPath.split('/').filter(Boolean);
  let shared = 0;
  while (from[shared] === target[shared] && from[shared] !== undefined) shared += 1;
  return [...from.slice(shared).map(() => '..'), ...target.slice(shared)].join('/') || './';
};

function ImageViewerDialog({ image, onClose }: { readonly image: { readonly path: string; readonly dataUrl: string }; readonly onClose: () => void }): JSX.Element {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent): void => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/80 p-5" role="presentation" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-labelledby="image-viewer-title" className="grid h-[min(88vh,56rem)] w-full max-w-6xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
      <header className="flex items-center gap-4 border-b border-slate-200 px-5 py-3"><div className="min-w-0"><h2 id="image-viewer-title" className="truncate text-base font-bold text-slate-900">{image.path.split('/').at(-1)}</h2><p className="truncate text-xs text-slate-500">{image.path}</p></div><button type="button" className="folio-control ml-auto grid h-8 w-8 place-items-center rounded-lg text-xl" onClick={onClose} aria-label="Fechar imagem">×</button></header>
      <div className="grid min-h-0 place-items-center overflow-auto bg-slate-100 p-5"><img src={image.dataUrl} alt={image.path.split('/').at(-1) ?? 'Imagem do vault'} className="max-h-full max-w-full object-contain shadow-lg" /></div>
    </section>
  </div>;
}

function FigureDialog({ fileId, sourcePath, assets, onClose, onApply, onError }: {
  readonly fileId: string;
  readonly sourcePath: string;
  readonly assets: readonly WorkspaceFileDto[];
  readonly onClose: () => void;
  readonly onApply: (input: { readonly uri: string; readonly alt: string; readonly caption: string; readonly source: string; readonly identifier: string; readonly width: number }) => void;
  readonly onError: (message: string) => void;
}): JSX.Element {
  const [selectedPath, setSelectedPath] = useState<string | undefined>(assets[0]?.path);
  const [importedUri, setImportedUri] = useState<string | undefined>(undefined);
  const [alt, setAlt] = useState(() => assets[0]?.path.split('/').at(-1)?.replace(/\.[^.]+$/u, '') ?? '');
  const [caption, setCaption] = useState(''); const [source, setSource] = useState(''); const [identifier, setIdentifier] = useState(''); const [width, setWidth] = useState(100); const [importing, setImporting] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<Readonly<Record<string, string>>>({});
  useEffect(() => {
    let cancelled = false;
    void Promise.all(assets.map(async (asset) => ({ asset, result: await window.academic.editor.assetPreview({ fileId: asset.fileId }) }))).then((previews) => {
      if (cancelled) return;
      setPreviewUrls(Object.fromEntries(previews.flatMap((preview) => preview.result.ok ? [[preview.asset.fileId, preview.result.value.dataUrl]] : [])));
    });
    return () => { cancelled = true; };
  }, [assets]);
  const uri = importedUri ?? (selectedPath === undefined ? undefined : relativeAssetUri(sourcePath, selectedPath));
  const chooseAsset = (path: string): void => { setSelectedPath(path); setImportedUri(undefined); setAlt(path.split('/').at(-1)?.replace(/\.[^.]+$/u, '') ?? ''); };
  const importFile = async (): Promise<void> => {
    setImporting(true);
    try {
      const result = await window.academic.editor.importAsset({ fileId });
      if (!result.ok) { if (result.error.code !== 'CANCELLED') onError(result.error.message); return; }
      setImportedUri(result.value.authoredUri); setSelectedPath(undefined); setAlt(result.value.file.path.split('/').at(-1)?.replace(/\.[^.]+$/u, '') ?? '');
    } finally { setImporting(false); }
  };
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-5" role="presentation" onClick={onClose}><section role="dialog" aria-modal="true" aria-labelledby="figure-title" className="grid w-full max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl" onClick={(event) => event.stopPropagation()}><header className="flex items-start border-b border-slate-700 px-5 py-4"><div><h2 id="figure-title" className="text-lg font-semibold">Inserir figura</h2><p className="text-sm text-slate-400">Reutilize um recurso do vault ou importe uma imagem nova.</p></div><button type="button" className="ml-auto text-xl text-slate-400 hover:text-white" onClick={onClose} aria-label="Fechar">×</button></header><div className="grid min-h-0 gap-5 overflow-auto p-5 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]"><section><div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Imagens em assets</h3><button type="button" disabled={importing} className="rounded bg-cyan-700 px-3 py-1.5 text-sm font-semibold hover:bg-cyan-600 disabled:opacity-50" onClick={() => void importFile()}>{importing ? 'Importando…' : 'Importar imagem…'}</button></div>{assets.length === 0 ? <p className="mt-3 rounded border border-dashed border-slate-600 p-4 text-sm text-slate-400">Ainda não há imagens em <code>assets/</code>. Importe a primeira.</p> : <ul aria-label="Imagens disponíveis" className="mt-3 grid max-h-80 grid-cols-2 gap-2 overflow-auto rounded border border-slate-700 p-2 sm:grid-cols-3">{assets.map((asset) => { const selected = selectedPath === asset.path && importedUri === undefined; const previewUrl = previewUrls[asset.fileId]; return <li key={asset.fileId}><button type="button" aria-pressed={selected} className={`group w-full overflow-hidden rounded-lg border text-left ${selected ? 'border-cyan-400 bg-indigo-950 ring-2 ring-cyan-500/50' : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800'}`} onClick={() => chooseAsset(asset.path)}><div className="relative grid aspect-[4/3] place-items-center overflow-hidden bg-slate-950">{previewUrl === undefined ? <span className="text-xs text-slate-500">Carregando…</span> : <img src={previewUrl} alt="" className="h-full w-full object-cover" />} </div><span className="block truncate px-2 pt-1.5 text-xs font-medium">{asset.path.split('/').at(-1)}</span><span className="block truncate px-2 pb-1.5 font-mono text-[10px] text-slate-500">{asset.path}</span></button></li>; })}</ul>}{importedUri !== undefined && <p className="mt-3 rounded bg-emerald-950/60 p-3 text-sm text-emerald-200">Imagem nova selecionada: <code>{importedUri}</code></p>}</section><section className="grid content-start gap-3"><label className="grid gap-1 text-sm"><span>Texto alternativo</span><input autoFocus value={alt} onChange={(event) => setAlt(event.target.value)} className="rounded bg-slate-800 p-2" /></label><label className="grid gap-1 text-sm"><span>Legenda</span><input value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Descrição exibida da figura" className="rounded bg-slate-800 p-2" /></label><label className="grid gap-1 text-sm"><span className="flex justify-between">Largura <strong>{width}%</strong></span><input type="range" min="10" max="100" step="5" value={width} onChange={(event) => setWidth(Number(event.target.value))} className="accent-indigo-600" /></label><label className="grid gap-1 text-sm"><span>Fonte <span className="text-slate-500">(opcional)</span></span><input value={source} onChange={(event) => setSource(event.target.value)} placeholder="Autoria própria" className="rounded bg-slate-800 p-2" /></label><label className="grid gap-1 text-sm"><span>Identificador <span className="text-slate-500">(opcional)</span></span><input value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="fig-metodo" className="rounded bg-slate-800 p-2 font-mono" /></label></section></div><footer className="flex justify-end gap-2 border-t border-slate-700 px-5 py-4"><button type="button" className="rounded bg-slate-700 px-3 py-1.5 text-sm" onClick={onClose}>Cancelar</button><button type="button" disabled={uri === undefined} className="rounded bg-cyan-700 px-3 py-1.5 text-sm font-semibold disabled:opacity-40" onClick={() => { if (uri !== undefined) onApply({ uri, alt, caption, source, identifier, width }); }}>Inserir figura</button></footer></section></div>;
}

const markdownTableAt = (content: string, offset: number): { readonly range: { readonly start: number; readonly end: number }; readonly table: MarkdownTableDraft } | undefined => {
  const lines = content.split(/(?<=\n)/u); let start = 0;
  const located = lines.findIndex((line) => { const end = start + line.length; const found = start <= offset && offset <= end; start = end; return found; });
  if (located < 0 || !/^\s*\|/u.test(lines[located] ?? '')) return undefined;
  let first = located; let last = located;
  while (first > 0 && /^\s*\|/u.test(lines[first - 1] ?? '')) first -= 1;
  while (last + 1 < lines.length && /^\s*\|/u.test(lines[last + 1] ?? '')) last += 1;
  const rangeStart = lines.slice(0, first).join('').length;
  const source = lines.slice(first, last + 1).join('').replace(/\n$/u, '');
  const table = parseMarkdownTable(source);
  return table === undefined ? undefined : { range: { start: rangeStart, end: rangeStart + source.length }, table };
};
function MetadataDialog({ view, assets, onClose }: { readonly view: Extract<ViewState, { type: 'editor' }>; readonly assets: readonly WorkspaceFileDto[]; readonly onClose: () => void }): JSX.Element {
  const [draft, setDraft] = useState(() => metadataFromSource(view.snapshot.session.content));
  const [logoLoading, setLogoLoading] = useState(false);
  const fields: readonly [keyof MetadataDraft, string, boolean?][] = [['title','Título'],['subtitle','Subtítulo'],['authors','Autores (um por linha)',true],['advisor','Orientador'],['institution','Instituição'],['course','Curso'],['city','Cidade'],['year','Ano'],['keywords','Palavras-chave (vírgulas)'],['language','Idioma'],['profile','Perfil'],['bibliography','Bibliografia (vírgulas)']];
  const images = assets.filter((asset) => asset.mediaType?.startsWith('image/') === true || /\.(?:png|jpe?g|gif|webp|svg)$/iu.test(asset.path));
  const chooseCoverLogo = async (fileId: string): Promise<void> => {
    if (fileId === '') { setDraft((current) => ({ ...current, coverLogo: '' })); return; }
    setLogoLoading(true);
    try {
      const result = await window.academic.editor.assetPreview({ fileId });
      if (result.ok) setDraft((current) => ({ ...current, coverLogo: result.value.dataUrl }));
    } finally { setLogoLoading(false); }
  };
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-5"><section role="dialog" aria-modal="true" aria-labelledby="metadata-title" className="w-full max-w-2xl rounded-lg border border-slate-600 bg-slate-900 p-5 shadow-2xl"><h2 id="metadata-title" className="text-lg font-semibold">Metadados do documento</h2><p className="text-sm text-slate-400">Edita o frontmatter YAML deste Markdown.</p><div className="mt-4 grid max-h-[48vh] gap-2 overflow-auto sm:grid-cols-2">{fields.map(([key,label,multi]) => <label key={key} className="grid gap-1 text-sm text-slate-300"><span>{label}</span>{multi ? <textarea value={draft[key]} onChange={(e) => setDraft({...draft,[key]:e.target.value})} className="min-h-20 rounded bg-slate-800 p-2" /> : <input value={draft[key]} onChange={(e) => setDraft({...draft,[key]:e.target.value})} className="rounded bg-slate-800 p-2" />}</label>)}</div><section className="mt-4 rounded-lg border border-indigo-300/50 bg-indigo-950/30 p-3"><div className="flex items-center gap-3"><div className="min-w-0 flex-1"><h3 className="text-sm font-semibold text-slate-100">Logotipo institucional na capa</h3><p className="mt-0.5 text-xs text-slate-400">Opcional para TCC, dissertação e tese. A imagem fica incorporada no frontmatter para o PDF ser portátil.</p></div>{draft.coverLogo !== '' && <img src={draft.coverLogo} alt="Prévia do logotipo selecionado" className="h-11 w-16 rounded bg-white object-contain p-1" />}</div><select aria-label="Logotipo institucional" disabled={logoLoading} value="" className="mt-3 w-full rounded bg-slate-800 p-2 text-sm" onChange={(event) => void chooseCoverLogo(event.target.value)}><option value="">{draft.coverLogo === '' ? 'Sem logotipo na capa' : 'Trocar ou remover logotipo…'}</option>{images.map((asset) => <option key={asset.fileId} value={asset.fileId}>{asset.path}</option>)}</select>{draft.coverLogo !== '' && <button type="button" className="mt-2 text-xs font-semibold text-indigo-300 hover:text-white" onClick={() => void chooseCoverLogo('')}>Remover logotipo</button>}</section><div className="mt-5 flex justify-end gap-2"><button type="button" className="rounded bg-slate-700 px-3 py-1.5" onClick={onClose}>Cancelar</button><button type="button" className="rounded bg-cyan-700 px-3 py-1.5" onClick={() => { const text=applyMetadata(view.snapshot.session.content,draft); view.controller.dispatch({edits:[{range:{start:0,end:view.snapshot.session.content.length},text}]}); onClose(); }}>Aplicar YAML</button></div></section></div>;
}
function ProblemsDialog({ view, onClose }: { readonly view: Extract<ViewState, { type: 'editor' }>; readonly onClose: () => void }): JSX.Element {
  const [severity, setSeverity] = useState<'all' | 'error' | 'warning' | 'info'>('all');
  const label: Record<'error' | 'warning' | 'info', string> = { error: 'Erro', warning: 'Aviso', info: 'Info' };
  const shown = view.snapshot.diagnostics.filter((item) => severity === 'all' || item.severity === severity);
  const line = (offset: number): number => view.snapshot.session.content.slice(0, offset).split('\n').length;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-5"><section role="dialog" aria-modal="true" aria-labelledby="problems-title" className="grid h-[min(72vh,42rem)] w-full max-w-4xl grid-rows-[auto_auto_minmax(0,1fr)] rounded-lg border border-slate-200 bg-white p-5 shadow-2xl"><div className="flex"><div><h2 id="problems-title" className="text-lg font-semibold text-slate-900">Problemas</h2><p className="text-sm text-slate-500">Diagnósticos revisionados de {view.path}.</p></div><button type="button" aria-label="Fechar problemas" className="ml-auto text-xl text-slate-500" onClick={onClose}>×</button></div><div className="mt-4 flex gap-2">{(['all','error','warning','info'] as const).map((value)=><button key={value} type="button" onClick={()=>setSeverity(value)} className={`rounded-lg px-2.5 py-1 text-xs font-medium ${severity===value?'bg-indigo-600 text-white':'bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'}`}>{value==='all'?'Todos':label[value]}</button>)}</div><div className="mt-4 overflow-auto rounded-lg border border-slate-100"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-2">Severidade</th><th className="p-2">Documento</th><th className="p-2">Linha</th><th className="p-2">Regra</th><th className="p-2">Mensagem</th></tr></thead><tbody>{shown.map((item,index)=>{const offset=item.source?.start.offset??0;return <tr key={`${item.id}-${index}`} className="border-t border-slate-100 text-slate-700 hover:bg-indigo-50"><td className="p-2">{label[item.severity]}</td><td className="p-2">{view.path}</td><td className="p-2 font-mono">{line(offset)}</td><td className="p-2 font-mono text-xs">{item.id}</td><td className="p-2"><button type="button" className="text-left hover:text-indigo-700" onClick={()=>view.controller.dispatch({selection:{anchor:offset,head:item.source?.end.offset??offset}})}>{item.message}</button></td></tr>;})}</tbody></table>{shown.length===0&&<p className="py-8 text-center text-slate-400">Nenhum problema neste filtro.</p>}</div></section></div>;
}
function CrossReferenceDialog({ view, onClose, onInsert }: { readonly view: Extract<ViewState,{type:'editor'}>; readonly onClose:()=>void; readonly onInsert:(identifier:string)=>void }): JSX.Element {
 const [targets,setTargets]=useState<readonly import('@abnt/protocol').LanguageCrossReferenceTargetDto[]>([]); const [query,setQuery]=useState('');
 useEffect(()=>{void window.academic.language.crossReferenceTargets({fileId:view.fileId,expectedRevision:view.snapshot.session.revision}).then(r=>{if(r.ok)setTargets(r.value);});},[view.fileId,view.snapshot.session.revision]);
 const shown=targets.filter(t=>`${t.identifier} ${t.label} ${t.kind}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
 return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-5"><section role="dialog" aria-modal="true" className="w-full max-w-xl rounded-lg border border-slate-600 bg-slate-900 p-5"><div className="flex"><div><h2 className="text-lg font-semibold">Inserir referência cruzada</h2><p className="text-sm text-slate-400">Alvos declarados no Markdown.</p></div><button className="ml-auto" onClick={onClose}>×</button></div><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar seção, figura, tabela ou equação…" className="mt-4 w-full rounded bg-slate-800 p-2"/><ul className="mt-3 max-h-72 overflow-auto">{shown.map(t=><li key={t.identifier}><button className="w-full px-2 py-2 text-left hover:bg-slate-800" onClick={()=>onInsert(t.identifier)}><span className="mr-2 text-xs uppercase text-slate-400">{t.kind}</span>{t.label}<span className="ml-2 font-mono text-xs text-slate-500">{t.identifier}</span></button></li>)}</ul></section></div>;
}

const GRAPH_NODE_COLOR: Record<WorkspaceGraphNodeDto['kind'], string> = {
  document: '#4f46e5',
  reference: '#d97706',
  resource: '#7c3aed',
  person: '#059669',
  organization: '#ea580c',
  tag: '#db2777',
};

const GRAPH_NODE_LABEL: Record<WorkspaceGraphNodeDto['kind'], string> = {
  document: 'Documentos', reference: 'Referências', resource: 'Recursos', person: 'Pessoas', organization: 'Organizações', tag: 'Tags',
};

const GRAPH_EDGE_LABEL: Record<WorkspaceGraphDto['edges'][number]['kind'], string> = {
  'links-to': 'Links', cites: 'Citações', embeds: 'Recursos embutidos', 'authored-by': 'Autoria', 'tagged-with': 'Tags',
  'version-of': 'Versão de', 'extension-of': 'Extensão de', 'replica-of': 'Réplica de', 'revision-of': 'Revisão de', 'correction-of': 'Correção de',
};

/** F56–F59: filtros e layout são apresentação de um grafo que continua sendo
 * derivado no Workspace Service. A view não lê Markdown, filesystem ou SQLite. */
function GraphDialog({ onClose, onOpenDocument, activeFileId }: {
  readonly onClose: () => void;
  readonly onOpenDocument: (fileId: string, path: string) => void;
  readonly activeFileId?: string;
}): JSX.Element {
  const [graph, setGraph] = useState<WorkspaceGraphDto | undefined>(undefined);
  const [includePeople, setIncludePeople] = useState(false);
  const [includeTags, setIncludeTags] = useState(true);
  const [scope, setScope] = useState<'all' | 'local-1' | 'local-2'>('all');
  const [nodeKinds, setNodeKinds] = useState<ReadonlySet<WorkspaceGraphNodeDto['kind']>>(
    () => new Set(Object.keys(GRAPH_NODE_COLOR) as WorkspaceGraphNodeDto['kind'][]),
  );
  const [edgeKinds, setEdgeKinds] = useState<ReadonlySet<WorkspaceGraphDto['edges'][number]['kind']>>(
    () => new Set(Object.keys(GRAPH_EDGE_LABEL) as WorkspaceGraphDto['edges'][number]['kind'][]),
  );
  const [query, setQuery] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>(undefined);
  useEffect(() => {
    setGraph(undefined);
    const request = scope === 'all' || activeFileId === undefined
      ? { includePeople, includeTags }
      : { includePeople, includeTags, focusFileId: activeFileId, depth: scope === 'local-1' ? 1 as const : 2 as const };
    void timePerformance('graph', () => window.academic.workspace.graph(request)).then((result) => { if (result.ok) setGraph(result.value); });
  }, [activeFileId, includePeople, includeTags, scope]);

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filtered = useMemo(() => {
    const source = graph ?? { nodes: [], edges: [] };
    const nodes = source.nodes.filter((node) => nodeKinds.has(node.kind));
    const ids = new Set(nodes.map((node) => node.id));
    return { nodes, edges: source.edges.filter((edge) => edgeKinds.has(edge.kind) && ids.has(edge.from) && ids.has(edge.to)) };
  }, [edgeKinds, graph, nodeKinds]);
  const graphForLayout = useMemo(() => {
    const nodes = filtered.nodes.slice(0, 180);
    const ids = new Set(nodes.map((node) => node.id));
    return { nodes, edges: filtered.edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to)) };
  }, [filtered]);
  const positions = useMemo(() => forceDirectedLayout(graphForLayout, 920, 520), [graphForLayout]);
  const matchedIds = useMemo(() => new Set(
    normalizedQuery === '' ? [] : graphForLayout.nodes
      .filter((node) => `${node.label} ${node.path ?? ''} ${node.referenceId ?? ''}`.toLocaleLowerCase().includes(normalizedQuery))
      .map((node) => node.id),
  ), [graphForLayout.nodes, normalizedQuery]);
  const connectedIds = useMemo(() => {
    if (selectedNodeId === undefined) return new Set<string>();
    return new Set(filtered.edges.filter((edge) => edge.from === selectedNodeId || edge.to === selectedNodeId).flatMap((edge) => [edge.from, edge.to]));
  }, [filtered.edges, selectedNodeId]);
  const toggleNodeKind = (kind: WorkspaceGraphNodeDto['kind']): void => setNodeKinds((current) => {
    const next = new Set(current); if (next.has(kind)) next.delete(kind); else next.add(kind); return next;
  });
  const toggleEdgeKind = (kind: WorkspaceGraphDto['edges'][number]['kind']): void => setEdgeKinds((current) => {
    const next = new Set(current); if (next.has(kind)) next.delete(kind); else next.add(kind); return next;
  });
  const matchedNodes = normalizedQuery === '' ? [] : graphForLayout.nodes.filter((node) => matchedIds.has(node.id)).slice(0, 6);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/30 p-5" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="graph-title" className="max-h-[92vh] w-full max-w-6xl overflow-auto rounded-xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <div>
            <h2 id="graph-title" className="text-lg font-bold text-slate-900">Grafo do workspace</h2>
            <p className="text-sm text-slate-500">Relações derivadas de documentos, citações, recursos, pessoas e tags do vault.</p>
          </div>
          <button type="button" className="folio-control ml-auto grid h-9 w-9 place-items-center rounded-lg text-xl" aria-label="Fechar grafo" onClick={onClose}>×</button>
        </div>
        <div className="mt-4 grid gap-3 border-y border-slate-100 py-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600">
            <span className="font-semibold text-slate-700">Escopo</span>
            <label><input className="mr-1.5" type="radio" checked={scope === 'all'} onChange={() => setScope('all')} />Workspace</label>
            <label className={activeFileId === undefined ? 'opacity-40' : undefined}><input className="mr-1.5" type="radio" disabled={activeFileId === undefined} checked={scope === 'local-1'} onChange={() => setScope('local-1')} />Documento ativo · 1 salto</label>
            <label className={activeFileId === undefined ? 'opacity-40' : undefined}><input className="mr-1.5" type="radio" disabled={activeFileId === undefined} checked={scope === 'local-2'} onChange={() => setScope('local-2')} />2 saltos</label>
            <label><input className="mr-1.5" type="checkbox" checked={includePeople} onChange={(event) => setIncludePeople(event.target.checked)} />Pessoas</label>
            <label><input className="mr-1.5" type="checkbox" checked={includeTags} onChange={(event) => setIncludeTags(event.target.checked)} />Tags</label>
          </div>
          <input className="folio-input w-full min-w-56 rounded-lg px-3 py-2 text-sm lg:w-64" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Localizar no grafo…" aria-label="Localizar nó no grafo" />
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-600">
          <span className="font-semibold text-slate-700">Nós</span>
          {(Object.entries(GRAPH_NODE_LABEL) as [WorkspaceGraphNodeDto['kind'], string][]).map(([kind, label]) => <label key={kind} className="flex items-center gap-1"><input type="checkbox" checked={nodeKinds.has(kind)} onChange={() => toggleNodeKind(kind)} /><span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: GRAPH_NODE_COLOR[kind] }} />{label}</label>)}
          <span className="font-semibold text-slate-700">Arestas</span>
          {(Object.entries(GRAPH_EDGE_LABEL) as [WorkspaceGraphDto['edges'][number]['kind'], string][]).map(([kind, label]) => <label key={kind}><input className="mr-1" type="checkbox" checked={edgeKinds.has(kind)} onChange={() => toggleEdgeKind(kind)} />{label}</label>)}
        </div>
        {graph === undefined ? (
          <p className="mt-6 text-center text-slate-500">Carregando…</p>
        ) : graphForLayout.nodes.length === 0 ? (
          <p className="mt-6 text-center text-slate-500">Nenhum nó corresponde aos filtros atuais.</p>
        ) : (
          <>
            {matchedNodes.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{matchedNodes.map((node) => <button key={node.id} type="button" onClick={() => setSelectedNodeId(node.id)} className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100">{node.label}</button>)}</div>}
            <svg viewBox="0 0 920 520" className="mt-4 h-[min(58vh,520px)] w-full rounded-lg border border-slate-100 bg-slate-50">
            {graphForLayout.edges.map((edge, index) => {
              const from = positions.get(edge.from);
              const to = positions.get(edge.to);
              if (from === undefined || to === undefined) return null;
              const active = selectedNodeId !== undefined && (edge.from === selectedNodeId || edge.to === selectedNodeId);
              return <line key={`${edge.kind}:${edge.from}:${edge.to}:${index}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={active ? '#6366f1' : '#cbd5e1'} strokeWidth={active ? 2.2 : 1} opacity={selectedNodeId === undefined || active ? 1 : 0.28} />;
            })}
            {graphForLayout.nodes.map((node) => {
              const position = positions.get(node.id);
              if (position === undefined) return null;
              const clickable = node.kind === 'document' && node.fileId !== undefined && node.path !== undefined;
              const matches = matchedIds.has(node.id);
              const connected = connectedIds.has(node.id);
              const subdued = normalizedQuery !== '' && !matches && !connected;
              return (
                <g
                  key={node.id}
                  transform={`translate(${position.x}, ${position.y})`}
                  className="cursor-pointer"
                  opacity={subdued ? 0.2 : 1}
                  onClick={() => setSelectedNodeId(node.id)}
                  onDoubleClick={() => {
                    if (clickable && node.fileId !== undefined && node.path !== undefined) {
                      onOpenDocument(node.fileId, node.path);
                      onClose();
                    }
                  }}
                >
                  <title>{node.label}{clickable ? ' — clique duas vezes para abrir' : ''}</title>
                  <circle r={node.id === selectedNodeId ? 9 : node.kind === 'document' ? 7 : 5} fill={GRAPH_NODE_COLOR[node.kind]} stroke={matches || node.id === selectedNodeId ? '#0f172a' : 'none'} strokeWidth={matches || node.id === selectedNodeId ? 1.5 : 0} />
                  {(graphForLayout.nodes.length <= 65 || matches || node.id === selectedNodeId) && <text x={10} y={4} fontSize={11} fill="#334155">{node.label}</text>}
                </g>
              );
            })}
          </svg>
            <p className="mt-2 text-xs text-slate-500">{filtered.nodes.length > 180 ? 'Exibindo os primeiros 180 nós filtrados. ' : ''}Clique para destacar relações; clique duas vezes em um documento para abri-lo.</p>
          </>
        )}
      </section>
    </div>
  );
}

function KnowledgeWorkspaceDialog({ state, query, activeFile, onClose, onRunSearch, onSaveSearch, onRemoveSearch, onCreateCollection, onAddFile, onAddReference, onRemoveCollection }: { readonly state: KnowledgeWorkspaceState; readonly query: string; readonly activeFile: WorkspaceFileDto | undefined; readonly onClose: () => void; readonly onRunSearch: (query: string) => void; readonly onSaveSearch: (name: string, query: string) => void; readonly onRemoveSearch: (id: string) => void; readonly onCreateCollection: (name: string) => void; readonly onAddFile: (collectionId: string, fileId: string) => void; readonly onAddReference: (collectionId: string, referenceId: string) => void; readonly onRemoveCollection: (id: string) => void }): JSX.Element {
  const [tab, setTab] = useState<'searches' | 'collections'>('searches');
  const saveCurrent = async (): Promise<void> => {
    const value = query.trim(); if (value === '') return;
    const name = await requestText('Nome da busca salva', value); if (name !== null && name.trim() !== '') onSaveSearch(name.trim(), value);
  };
  const createCollection = async (): Promise<void> => { const name = await requestText('Nome da collection', 'Projeto de pesquisa'); if (name !== null && name.trim() !== '') onCreateCollection(name.trim()); };
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-5"><section role="dialog" aria-modal="true" aria-labelledby="knowledge-title" className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-5 shadow-2xl"><div className="flex items-start"><div><h2 id="knowledge-title" className="text-lg font-bold text-slate-900">Knowledge Workspace</h2><p className="text-sm text-slate-500">Buscas e collections são preferências locais deste vault.</p></div><button type="button" className="folio-control ml-auto grid h-8 w-8 place-items-center rounded-lg text-lg" onClick={onClose}>×</button></div><div className="mt-4 flex gap-2 border-b border-slate-200"><button type="button" className={`px-3 py-2 text-sm font-semibold ${tab === 'searches' ? 'border-b-2 border-indigo-500 text-indigo-700' : 'text-slate-500'}`} onClick={() => setTab('searches')}>Buscas salvas</button><button type="button" className={`px-3 py-2 text-sm font-semibold ${tab === 'collections' ? 'border-b-2 border-indigo-500 text-indigo-700' : 'text-slate-500'}`} onClick={() => setTab('collections')}>Collections</button></div>{tab === 'searches' ? <div className="mt-4"><div className="flex items-center justify-between"><p className="text-sm text-slate-600">Consulta atual: <code className="rounded bg-slate-100 px-1">{query || '—'}</code></p><button type="button" disabled={query.trim() === ''} className="folio-primary rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-40" onClick={saveCurrent}>Salvar busca</button></div><ul className="mt-4 grid gap-2">{state.searches.length === 0 ? <li className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Salve consultas como <code>tag:metodologia</code> ou <code>year:2024 has:figure</code>.</li> : state.searches.map((search) => <li key={search.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3"><button type="button" className="min-w-0 flex-1 text-left" onClick={() => onRunSearch(search.query)}><strong className="block text-sm text-slate-800">{search.name}</strong><code className="block truncate text-xs text-slate-500">{search.query}</code></button><button type="button" className="text-xs font-semibold text-rose-600" onClick={() => onRemoveSearch(search.id)}>Remover</button></li>)}</ul></div> : <div className="mt-4"><button type="button" className="folio-primary rounded-lg px-3 py-1.5 text-sm font-semibold" onClick={createCollection}>Nova collection</button><ul className="mt-4 grid gap-2">{state.collections.length === 0 ? <li className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Collections agrupam documentos e referências sem mover arquivos.</li> : state.collections.map((collection) => <li key={collection.id} className="rounded-lg border border-slate-200 p-3"><div className="flex"><strong className="text-sm text-slate-800">{collection.name}</strong><button type="button" className="ml-auto text-xs font-semibold text-rose-600" onClick={() => onRemoveCollection(collection.id)}>Remover</button></div><p className="mt-1 text-xs text-slate-500">{collection.fileIds.length} documento(s) · {collection.referenceIds.length} referência(s)</p><div className="mt-2 flex gap-2">{activeFile !== undefined && <button type="button" className="text-xs font-semibold text-indigo-700" onClick={() => onAddFile(collection.id, activeFile.fileId)}>Adicionar documento ativo</button>}<button type="button" className="text-xs font-semibold text-indigo-700" onClick={() => { void requestText('Chave da referência para adicionar').then((id) => { if (id !== null && id.trim() !== '') onAddReference(collection.id, id.trim()); }); }}>Adicionar referência</button></div>{collection.referenceIds.length > 0 && <p className="mt-1 truncate font-mono text-xs text-slate-500">{collection.referenceIds.join(', ')}</p>}</li>)}</ul></div>}</section></div>;
}

export function App(): JSX.Element {
  useGlobalDialogAccessibility();
  const [files, setFiles] = useState<readonly WorkspaceFileDto[]>([]);
  const [workspaceFiles, setWorkspaceFiles] = useState<readonly WorkspaceFileDto[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (workspaceId === undefined) return;
    let cancelled = false;
    void window.academic.workspace.themes().then((result) => {
      if (cancelled || !result.ok) return;
      // A infraestrutura de temas continua portável, mas a superfície escura
      // fica temporariamente fora do produto até a revisão visual completa.
      const theme = result.value.themes.find((item) => item.id === result.value.activeId && item.mode === 'light')
        ?? result.value.themes.find((item) => item.mode === 'light');
      if (theme === undefined) return;
      const root = document.documentElement;
      for (const [key, value] of Object.entries(theme.tokens)) root.style.setProperty(`--folio-${key.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`)}`, value);
      root.dataset.folioTheme = theme.mode;
    });
    return () => { cancelled = true; };
  }, [workspaceId]);
  const [message, setMessage] = useState('Abra um vault para começar.');
  const [views, setViews] = useState<readonly ViewState[]>([]);
  const [activeId, setActiveId] = useState<ViewId | undefined>(undefined);
  const [activePanelId, setActivePanelId] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<readonly WorkspaceSearchResultDto[]>([]);
  const [searchViewOpen, setSearchViewOpen] = useState(false);
  const [openingVault, setOpeningVault] = useState(false);
  const [splitPreview, setSplitPreview] = useState(false);
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  const [editorSplit, setEditorSplit] = useState<{ readonly primaryId: ViewId; readonly secondaryId: ViewId } | undefined>(undefined);
  const [splitEditorPicker, setSplitEditorPicker] = useState(false);
  const [systemInformation, setSystemInformation] = useState<SystemInformationDto | undefined>(undefined);
  const [referenceLocations, setReferenceLocations] = useState<readonly LanguageLocation[] | undefined>(undefined);
  const [paletteMode, setPaletteMode] = useState<PaletteMode | undefined>(undefined);
  const [recentFileIds, setRecentFileIds] = useState<readonly string[]>([]);
  const [homeOpen, setHomeOpen] = useState(true);
  useEffect(() => { if (homeOpen) setMoreActionsOpen(false); }, [homeOpen]);
  const [focusMode] = useState<FocusMode>('research');
  const [activeLayoutId, setActiveLayoutId] = useState<string | undefined>(undefined);
  const [workspaceLayouts, setWorkspaceLayouts] = useState<readonly WorkspaceLayout[]>(defaultLayouts);
  const [layoutVisibilityOverride, setLayoutVisibilityOverride] = useState<Partial<Pick<WorkspaceLayout, 'showNavigation' | 'showContext'>>>({});
  // O shell abre como um workspace de escrita: trilho compacto, explorador
  // persistente e contexto à direita. Cada área continua recolhível quando a
  // escrita pedir mais espaço, mas o vault não fica escondido por padrão.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [fileExplorerExpanded, setFileExplorerExpanded] = useState(true);
  const [searchSidebarOpen, setSearchSidebarOpen] = useState(false);
  const [contextCollapsed, setContextCollapsed] = useState(false);
  const [panelWidths, setPanelWidths] = useState({ explorer: 296, context: 272 });
  const [draggedTabId, setDraggedTabId] = useState<ViewId | undefined>(undefined);
  const [workspaceActivity, setWorkspaceActivity] = useState<readonly WorkspaceActivity[]>([]);
  const [recentCommandIds, setRecentCommandIds] = useState<readonly string[]>([]);
  const [onboardingVisible, setOnboardingVisible] = useState(false);
  const [documentCreator, setDocumentCreator] = useState<TemplateKind | undefined>(undefined);
  const [citationEditor, setCitationEditor] = useState<{ readonly initial: CitationDraft | undefined; readonly range: { readonly start: number; readonly end: number } } | undefined>(undefined);
  const [editorContextMenu, setEditorContextMenu] = useState<{ readonly viewId: ViewId; readonly offset: number; readonly x: number; readonly y: number; readonly selection: { readonly anchor: number; readonly head: number }; readonly submenu?: 'format' | 'paragraph' | 'insert' } | undefined>(undefined);
  const [diagnosticsCenter, setDiagnosticsCenter] = useState(false);
  const [metadataEditor, setMetadataEditor] = useState(false);
  const [pagePropertiesOpen, setPagePropertiesOpen] = useState(false);
  const [profileSelector, setProfileSelector] = useState(false);
  const [problemsPanel, setProblemsPanel] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [crossReferencePicker, setCrossReferencePicker] = useState(false);
  const [graphView, setGraphView] = useState(false);
  const [referenceLibraryEditor, setReferenceLibraryEditor] = useState(false);
  const [referenceHealth, setReferenceHealth] = useState(false);
  const [annotationSynthesisOpen, setAnnotationSynthesisOpen] = useState(false);
  const [literatureMonitoringOpen, setLiteratureMonitoringOpen] = useState(false);
  const [tableEditor, setTableEditor] = useState<{ readonly range: { readonly start: number; readonly end: number }; readonly initial?: MarkdownTableDraft } | undefined>(undefined);
  const [figureEditor, setFigureEditor] = useState<{ readonly fileId: string; readonly path: string; readonly range: { readonly start: number; readonly end: number } } | undefined>(undefined);
  const [imageViewer, setImageViewer] = useState<{ readonly path: string; readonly dataUrl: string } | undefined>(undefined);
  const [writingStatistics, setWritingStatistics] = useState<LanguageWritingStatisticsDto | undefined>(undefined);
  const [knowledgeWorkspace, setKnowledgeWorkspace] = useState<KnowledgeWorkspaceState>(emptyKnowledgeWorkspace);
  const [knowledgeWorkspaceOpen, setKnowledgeWorkspaceOpen] = useState(false);
  const [researchWorkflowOpen, setResearchWorkflowOpen] = useState(false);
  const [researchProjectsOpen, setResearchProjectsOpen] = useState(false);
  const [submissionIntegrationsOpen, setSubmissionIntegrationsOpen] = useState(false);
  const [researchIntakeOpen, setResearchIntakeOpen] = useState(false);
  const [captureInboxOpen, setCaptureInboxOpen] = useState(false);
  const [researchCanvasOpen, setResearchCanvasOpen] = useState(false);
  const [academicFormsOpen, setAcademicFormsOpen] = useState(false);
  const [pendingCapture, setPendingCapture] = useState<WorkspaceCaptureInboxItemDto | undefined>(undefined);
  const [academicViewsOpen, setAcademicViewsOpen] = useState(false);
  const [structuredResearchOpen, setStructuredResearchOpen] = useState(false);
  const [workspaceNavigationOpen, setWorkspaceNavigationOpen] = useState(false);
  const [automationOpen, setAutomationOpen] = useState(false);
  const [customKeybindings, setCustomKeybindings] = useState<CustomKeybindings>({});
  const [customKeybindingsWorkspace, setCustomKeybindingsWorkspace] = useState<string | undefined>(undefined);
  const [workspaceMacros, setWorkspaceMacros] = useState<readonly WorkspaceMacro[]>([]);
  const [workspaceMacrosWorkspace, setWorkspaceMacrosWorkspace] = useState<string | undefined>(undefined);
  const [writingWorkflowOpen, setWritingWorkflowOpen] = useState(false);
  const [referenceMaintenanceOpen, setReferenceMaintenanceOpen] = useState(false);
  const [libraryMaintenanceCenterOpen, setLibraryMaintenanceCenterOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [performanceOpen, setPerformanceOpen] = useState(false);
  const [documentComparisonOpen, setDocumentComparisonOpen] = useState(false);
  const [pluginManagerOpen, setPluginManagerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [collaborationOpen, setCollaborationOpen] = useState(false);
  const [pluginContributions, setPluginContributions] = useState<readonly WorkspacePluginDto[]>([]);
  const [, setNavigationVersion] = useState(0);

  const viewsModel = useRef(createViewsModel()).current;
  const commandRegistry = useRef(createCommandRegistry()).current;
  const paneHandles = useRef(new Map<string, EditorPaneHandle>()).current;
  const panelRegistry = useRef(createPanelRegistry()).current;
  const moreActionsButton = useRef<HTMLButtonElement>(null);
  const moreActionsMenu = useRef<HTMLDivElement>(null);
  const editorContextMenuHost = useRef<HTMLDivElement>(null);
  /** Mantém tabs em segundo plano com snapshot vivo mesmo sem CodeMirror montado. */
  const controllerSubscriptions = useRef(new Map<ViewId, () => void>()).current;
  /** Última revisão de preview pedida por fileId — resposta atrasada de uma revisão antiga é descartada. */
  const previewRequestedRevision = useRef(new Map<string, number>()).current;
  /** F72: uma resposta de busca de consulta anterior nunca substitui a atual. */
  const searchRequest = useRef(0);
  /** O command registry é registrado uma vez; o ref evita capturar um toggle antigo. */
  const splitPreviewEnabled = useRef(false);
  const lastVaultRestoreAttempted = useRef(false);
  const navigationHistory = useRef<readonly { readonly fileId: string; readonly path: string; readonly selection?: { readonly anchor: number; readonly head: number } }[]>([]);
  const navigationIndex = useRef(-1);
  const knowledgeWorkspaceRef = useRef<KnowledgeWorkspaceState>(knowledgeWorkspace);
  knowledgeWorkspaceRef.current = knowledgeWorkspace;

  const activeView = views.find((view) => view.id === activeId);
  const paletteContext = commandContextForPalette(activeView);
  const keybindings = useMemo(() => mergeKeybindings(defaultKeybindings, customKeybindings), [customKeybindings]);
  const shortcutByCommand = useMemo(() => new Map([...keybindings.entries()].map(([chord, command]) => [command, chord.replace('mod', 'Ctrl')])), [keybindings]);
  const selectedLayout = workspaceLayouts.find((layout) => layout.id === activeLayoutId) ?? focusLayout(workspaceLayouts, focusMode);
  // Os antigos modos de workspace foram ocultados: navegação e Contexto são
  // partes estáveis do shell. A densidade visual é controlada apenas pelos
  // botões de comprimir/expandir de cada barra, nunca por um estado invisível.
  const activeLayout: WorkspaceLayout = { ...selectedLayout, ...layoutVisibilityOverride, showNavigation: true, showContext: true };
  const hasLayoutCustomization = Object.keys(layoutVisibilityOverride).length > 0;
  const activeEditorView = activeView?.type === 'editor' ? activeView : undefined;
  const contextualEditorView = homeOpen ? undefined : activeEditorView;
  const splitEditorViews = editorSplit === undefined
    ? []
    : [editorSplit.primaryId, editorSplit.secondaryId]
        .map((id) => views.find((view): view is Extract<ViewState, { type: 'editor' }> => view.id === id && view.type === 'editor'))
        .filter((view): view is Extract<ViewState, { type: 'editor' }> => view !== undefined);
  const splitPreviewView =
    editorSplit === undefined && splitPreview && activeEditorView !== undefined
      ? views.find(
          (view): view is PreviewViewState =>
            view.type === 'preview' && view.fileId === activeEditorView.fileId,
        )
      : undefined;
  const activePanel = panelRegistry.list().find((panel) => panel.id === activePanelId);
  const sidebarWidth = sidebarCollapsed ? '56px' : '220px';
  const explorerColumnWidth = `${panelWidths.explorer}px`;
  const contextWidth = contextCollapsed ? '56px' : `${panelWidths.context}px`;
  // O trilho e o explorador são áreas independentes: comprimir o trilho não
  // deve esconder a árvore do vault.
  const explorerExpandedVisible = activeLayout.showNavigation && fileExplorerExpanded;
  const searchSidebarVisible = activeLayout.showNavigation && searchSidebarOpen && !sidebarCollapsed;
  const shellGridColumns = [
    ...(activeLayout.showNavigation ? [sidebarWidth] : []),
    ...(explorerExpandedVisible || searchSidebarVisible ? [explorerColumnWidth, '4px'] : []),
    'minmax(0, 1fr)',
    ...(activeLayout.showContext ? ['4px', contextWidth] : []),
  ].join(' ');

  const persistPanelWidths = (next: { readonly explorer: number; readonly context: number }): void => {
    setPanelWidths(next);
    if (workspaceId === undefined) return;
    void window.academic.workspace.homeLayout().then((result) => {
      if (!result.ok) { setMessage(result.error.message); return; }
      return window.academic.workspace.setHomeLayout({ ...result.value, panels: { explorerWidth: next.explorer, contextWidth: next.context } }).then((saved) => { if (!saved.ok) setMessage(saved.error.message); });
    });
  };
  const beginPanelResize = (panel: 'explorer' | 'context', event: ReactPointerEvent<HTMLDivElement>): void => {
    event.preventDefault();
    const startX = event.clientX; const initial = panelWidths[panel]; let finalWidth = initial;
    const move = (next: PointerEvent): void => { const delta = panel === 'explorer' ? next.clientX - startX : startX - next.clientX; finalWidth = Math.max(panel === 'explorer' ? 280 : 220, Math.min(440, initial + delta)); setPanelWidths((current) => ({ ...current, [panel]: finalWidth })); };
    const end = (): void => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', end); persistPanelWidths({ ...panelWidths, [panel]: finalWidth }); };
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', end);
  };

  const createWorkspaceFolder = async (): Promise<void> => {
    const folder = await requestText('Caminho da nova pasta no vault:', 'notas');
    if (folder === null || folder.trim() === '') return;
    const path = `${folder.trim().replace(/\/+$/u, '')}/.gitkeep`;
    void window.academic.workspace.createDocument({ path, content: '' }).then((result) => {
      if (!result.ok) setMessage(result.error.message);
      else setMessage(`Pasta “${folder.trim()}” criada.`);
    });
  };

  const moveWorkspaceFile = (file: WorkspaceFileDto, targetDirectory: string): void => {
    const name = file.path.includes('/') ? file.path.slice(file.path.lastIndexOf('/') + 1) : file.path;
    const path = targetDirectory === '' ? name : `${targetDirectory}/${name}`;
    if (path === file.path) return;
    const sourceDirectory = file.path.includes('/') ? file.path.slice(0, file.path.lastIndexOf('/')) : '';
    void window.academic.workspace.renameDocument({ fileId: file.fileId, path, expectedRevision: file.revision }).then((result) => {
      if (!result.ok) { setMessage(result.error.message); return; }
      setMessage(`Documento movido para ${result.value.path}.`);
      // Pastas são só um prefixo de path: se o último arquivo sair, a pasta
      // some da árvore. Um .gitkeep a mantém visível, igual à criação manual.
      const sourceEmptied = sourceDirectory !== '' && !workspaceFiles.some((candidate) =>
        candidate.fileId !== file.fileId && (candidate.path === sourceDirectory || candidate.path.startsWith(`${sourceDirectory}/`)));
      if (sourceEmptied) void window.academic.workspace.createDocument({ path: `${sourceDirectory}/.gitkeep`, content: '' });
    });
  };

  const renameWorkspaceFile = async (file: WorkspaceFileDto): Promise<void> => {
    const directory = file.path.includes('/') ? file.path.slice(0, file.path.lastIndexOf('/')) : '';
    const currentName = file.path.includes('/') ? file.path.slice(file.path.lastIndexOf('/') + 1) : file.path;
    const name = await requestText('Renomear documento', currentName, { placeholder: 'Novo nome do arquivo' });
    if (name === null || name.trim() === '' || name.trim() === currentName) return;
    const path = directory === '' ? name.trim() : `${directory}/${name.trim()}`;
    const result = await window.academic.workspace.renameDocument({ fileId: file.fileId, path, expectedRevision: file.revision });
    setMessage(result.ok ? `Documento renomeado para ${result.value.path}.` : result.error.message);
  };

  const moveWorkspaceFilePrompt = async (file: WorkspaceFileDto): Promise<void> => {
    const currentDirectory = file.path.includes('/') ? file.path.slice(0, file.path.lastIndexOf('/')) : '';
    const target = await requestText('Mover para pasta', currentDirectory, { description: 'Deixe em branco para mover para a raiz do vault.', placeholder: 'pasta/subpasta' });
    if (target === null) return;
    moveWorkspaceFile(file, target.trim().replace(/^\/+|\/+$/gu, ''));
  };

  const duplicateWorkspaceFile = async (file: WorkspaceFileDto): Promise<void> => {
    const suggested = file.path.includes('.')
      ? `${file.path.slice(0, file.path.lastIndexOf('.'))}-copia${file.path.slice(file.path.lastIndexOf('.'))}`
      : `${file.path}-copia`;
    const path = await requestText('Duplicar documento', suggested, { placeholder: 'Caminho da cópia' });
    if (path === null || path.trim() === '' || path.trim() === file.path) return;
    const read = await window.academic.documents.read({ fileId: file.fileId });
    if (!read.ok) { setMessage(read.error.message); return; }
    const created = await window.academic.workspace.createDocument({ path: path.trim(), content: read.value.content });
    setMessage(created.ok ? `Cópia criada em ${created.value.path}.` : created.error.message);
  };

  const wrapActiveSelection = (prefix: string, suffix: string): void => {
    const active = viewsModel.active();
    if (active?.type !== 'editor') return;
    const snapshot = active.controller.snapshot();
    const start = Math.min(snapshot.selection.anchor, snapshot.selection.head);
    const end = Math.max(snapshot.selection.anchor, snapshot.selection.head);
    const selected = snapshot.session.content.slice(start, end);
    const text = `${prefix}${selected}${suffix}`;
    const caret = selected === '' ? start + prefix.length : start + text.length;
    active.controller.dispatch({ edits: [{ range: { start, end }, text }], selection: { anchor: caret, head: caret } });
  };

  const prefixActiveLines = (prefix: string, fallback: string): void => {
    const active = viewsModel.active();
    if (active?.type !== 'editor') return;
    const snapshot = active.controller.snapshot();
    const start = Math.min(snapshot.selection.anchor, snapshot.selection.head);
    const end = Math.max(snapshot.selection.anchor, snapshot.selection.head);
    const selected = snapshot.session.content.slice(start, end) || fallback;
    const text = selected.split('\n').map((line) => `${prefix}${line}`).join('\n');
    active.controller.dispatch({ edits: [{ range: { start, end }, text }], selection: { anchor: start + text.length, head: start + text.length } });
  };

  const insertLinkAtSelection = async (external: boolean): Promise<void> => {
    const active = viewsModel.active();
    if (active?.type !== 'editor') return;
    const snapshot = active.controller.snapshot();
    const start = Math.min(snapshot.selection.anchor, snapshot.selection.head);
    const end = Math.max(snapshot.selection.anchor, snapshot.selection.head);
    const selected = snapshot.session.content.slice(start, end);
    const label = selected || (await requestText('Texto do link')) || '';
    if (label.trim() === '') return;
    const target = await requestText(external ? 'URL externa' : 'Destino no vault', external ? 'https://' : 'notas/documento.md');
    if (target === null || target.trim() === '') return;
    const text = `[${label}](${target.trim()})`;
    active.controller.dispatch({ edits: [{ range: { start, end }, text }], selection: { anchor: start + text.length, head: start + text.length } });
  };

  const copyActiveSelection = async (cut = false): Promise<void> => {
    const active = viewsModel.active();
    if (active?.type !== 'editor') return;
    const snapshot = active.controller.snapshot();
    const start = Math.min(snapshot.selection.anchor, snapshot.selection.head);
    const end = Math.max(snapshot.selection.anchor, snapshot.selection.head);
    const text = snapshot.session.content.slice(start, end);
    if (text === '') return;
    try {
      await navigator.clipboard.writeText(text);
      if (cut) active.controller.dispatch({ edits: [{ range: { start, end }, text: '' }], selection: { anchor: start, head: start } });
      setMessage(cut ? 'Seleção recortada.' : 'Seleção copiada.');
    } catch { setMessage('Não foi possível acessar a área de transferência.'); }
  };

  const pasteAtSelection = async (): Promise<void> => {
    const active = viewsModel.active();
    if (active?.type !== 'editor') return;
    try {
      const text = await navigator.clipboard.readText();
      if (text === '') return;
      const snapshot = active.controller.snapshot();
      const start = Math.min(snapshot.selection.anchor, snapshot.selection.head);
      const end = Math.max(snapshot.selection.anchor, snapshot.selection.head);
      active.controller.dispatch({ edits: [{ range: { start, end }, text }], selection: { anchor: start + text.length, head: start + text.length } });
    } catch { setMessage('Não foi possível ler a área de transferência.'); }
  };

  useEffect(() => {
    if (!moreActionsOpen) return undefined;
    const closeWhenClickingElsewhere = (event: PointerEvent): void => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (moreActionsButton.current?.contains(target) || moreActionsMenu.current?.contains(target)) return;
      setMoreActionsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setMoreActionsOpen(false);
    };
    document.addEventListener('pointerdown', closeWhenClickingElsewhere, true);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeWhenClickingElsewhere, true);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [moreActionsOpen]);

  useEffect(() => {
    if (editorContextMenu === undefined) return undefined;
    const closeWhenClickingElsewhere = (event: PointerEvent): void => {
      const target = event.target;
      if (!(target instanceof Node) || !editorContextMenuHost.current?.contains(target)) setEditorContextMenu(undefined);
    };
    const closeOnEscape = (event: KeyboardEvent): void => { if (event.key === 'Escape') setEditorContextMenu(undefined); };
    // Captura vem antes dos handlers internos do CodeMirror, que podem
    // interromper a propagação na fase normal.
    document.addEventListener('pointerdown', closeWhenClickingElsewhere, true);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeWhenClickingElsewhere, true);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [editorContextMenu]);

  useEffect(() => {
    if (workspaceId === undefined) return;
    try { window.localStorage.setItem(`folio.recent:${workspaceId}`, JSON.stringify(recentFileIds)); } catch { /* armazenamento de UI é opcional */ }
  }, [recentFileIds, workspaceId]);

  useEffect(() => {
    if (workspaceId === undefined) {
      setWorkspaceLayouts(defaultLayouts); setWorkspaceActivity([]); setRecentCommandIds([]); setOnboardingVisible(false); setActiveLayoutId(undefined); setLayoutVisibilityOverride({}); setSidebarCollapsed(true); setFileExplorerExpanded(true); setSearchSidebarOpen(false); setContextCollapsed(false); setPanelWidths({ explorer: 296, context: 272 }); setWorkspaceFiles([]);
      return;
    }
    setWorkspaceLayouts(loadLayouts(workspaceId));
    setActiveLayoutId(undefined);
    setLayoutVisibilityOverride({});
    setSidebarCollapsed(true);
    setFileExplorerExpanded(true);
    setSearchSidebarOpen(false);
    setContextCollapsed(false);
    void window.academic.workspace.homeLayout().then((result) => { if (result.ok) setPanelWidths({ explorer: Math.max(280, result.value.panels.explorerWidth), context: result.value.panels.contextWidth }); });
    setWorkspaceActivity(loadActivity(workspaceId));
    setRecentCommandIds(loadRecentCommands(workspaceId));
    setOnboardingVisible(window.localStorage.getItem(onboardingStorageKey(workspaceId)) !== 'done');
    setHomeOpen(true);
  }, [workspaceId]);

  useEffect(() => {
    if (workspaceId === undefined) return;
    window.localStorage.setItem(layoutsStorageKey(workspaceId), JSON.stringify(workspaceLayouts));
  }, [workspaceId, workspaceLayouts]);

  useEffect(() => {
    if (workspaceId === undefined) return;
    window.localStorage.setItem(activityStorageKey(workspaceId), JSON.stringify(workspaceActivity));
  }, [workspaceActivity, workspaceId]);

  useEffect(() => {
    if (workspaceId === undefined) return;
    window.localStorage.setItem(recentCommandsStorageKey(workspaceId), JSON.stringify(recentCommandIds));
  }, [recentCommandIds, workspaceId]);

  const recordActivity = (activity: Omit<WorkspaceActivity, 'id' | 'createdAt'>): void => {
    if (workspaceId === undefined) return;
    setWorkspaceActivity((current) => appendWorkspaceActivity(current, activity, crypto.randomUUID(), new Date().toISOString()));
  };

  useEffect(() => {
    setCustomKeybindings(workspaceId === undefined ? {} : loadCustomKeybindings(workspaceId));
    setCustomKeybindingsWorkspace(workspaceId);
  }, [workspaceId]);

  useEffect(() => {
    if (workspaceId === undefined || customKeybindingsWorkspace !== workspaceId) return;
    window.localStorage.setItem(customKeybindingsStorageKey(workspaceId), JSON.stringify(customKeybindings));
  }, [customKeybindings, customKeybindingsWorkspace, workspaceId]);

  useEffect(() => {
    setWorkspaceMacros(workspaceId === undefined ? [] : loadWorkspaceMacros(workspaceId));
    setWorkspaceMacrosWorkspace(workspaceId);
  }, [workspaceId]);

  useEffect(() => {
    if (workspaceId === undefined || workspaceMacrosWorkspace !== workspaceId) return;
    window.localStorage.setItem(macroStorageKey(workspaceId), JSON.stringify(workspaceMacros));
  }, [workspaceId, workspaceMacros, workspaceMacrosWorkspace]);

  useEffect(() => {
    if (workspaceId === undefined) { setPluginContributions([]); return; }
    let cancelled = false;
    void window.academic.workspace.plugins().then((result) => { if (!cancelled && result.ok) setPluginContributions(result.value); });
    return () => { cancelled = true; };
  }, [workspaceId]);

  useEffect(() => {
    if (editorSplit !== undefined && splitEditorViews.length !== 2) setEditorSplit(undefined);
  }, [editorSplit, splitEditorViews.length]);

  useEffect(() => {
    if (activeEditorView === undefined) { setWritingStatistics(undefined); return undefined; }
    let cancelled = false;
    void window.academic.language.writingStatistics({ fileId: activeEditorView.fileId, expectedRevision: activeEditorView.snapshot.session.revision }).then((result) => {
      if (!cancelled && result.ok) setWritingStatistics(result.value);
    });
    return () => { cancelled = true; };
  }, [activeEditorView?.fileId, activeEditorView?.snapshot.session.revision]);

  useEffect(
    () => viewsModel.subscribe((event: ViewsEvent) => {
      setViews(event.views);
      setActiveId(event.activeId);
    }),
    [viewsModel],
  );

  useEffect(() => window.academic.onEvent((event) => {
    if (event.type === 'desktop:operational-error') setMessage(event.error.message);
    if (event.type === 'desktop:browser-capture') {
      setPendingCapture(captureInboxItem(event.capture));
      setCaptureInboxOpen(true);
    }
    if (event.type === 'desktop:workspace-event') {
      void window.academic.workspace.list({}).then((result) => {
        if (result.ok) { setWorkspaceFiles(result.value); setFiles(markdownFiles(result.value)); }
      });
    }
    // O DTO cru carrega previewRevision; o EditorSnapshot de domínio reconstruído
    // pelo RemoteEditorController não — ele guarda a Publication AST inteira
    // sempre que existe preview, sem precisar de um marcador de novidade à parte.
    if (event.type === 'desktop:editor-updated' && event.snapshot.previewRevision !== undefined) {
      const fileId = event.snapshot.fileId;
      const previewRevision = event.snapshot.previewRevision;
      const previewView = viewsModel.list().find((view) => view.type === 'preview' && view.fileId === fileId);
      if (previewView !== undefined && previewView.type === 'preview' && previewRevision !== previewView.preview?.revision) {
        void fetchPreview(fileId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  useEffect(() => {
    const unregisterOutline = panelRegistry.register(outlinePanel);
    const unregisterDiagnostics = panelRegistry.register(diagnosticsPanel);
    const unregisterBacklinks = panelRegistry.register(backlinksPanel);
    const unregisterReferences = panelRegistry.register(referencesPanel);
    const unregisterCitationExplorer = panelRegistry.register(citationExplorerPanel);
    setActivePanelId(outlinePanel.id);
    return () => {
      unregisterOutline();
      unregisterDiagnostics();
      unregisterBacklinks();
      unregisterReferences();
      unregisterCitationExplorer();
    };
  }, [panelRegistry]);

  // Plugins só entregam título e texto já validados pelo manifesto. O painel
  // continua um componente do Folio: não há React, HTML ou callback remoto.
  useEffect(() => {
    const unregister = pluginContributions
      .filter((plugin) => plugin.enabled)
      .flatMap((plugin) => plugin.panels.map((panel) => panelRegistry.register({
        id: `plugin:${plugin.id}:${panel.id}`,
        title: panel.title,
        render: () => <article className="rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-indigo-600">Extensão · {plugin.id}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{panel.body}</p></article>,
      })));
    setNavigationVersion((version) => version + 1);
    return () => { unregister.forEach((dispose) => dispose()); setNavigationVersion((version) => version + 1); };
  }, [panelRegistry, pluginContributions]);

  /** FTS5 é rápido, mas debounce evita uma consulta a cada tecla enquanto o usuário digita. */
  useEffect(() => {
    const query = searchQuery.trim();
    if (query === '') {
      searchRequest.current += 1;
      setSearchResults([]);
      return undefined;
    }
    const request = (searchRequest.current += 1);
    const timer = setTimeout(() => {
      void timePerformance('search', () => window.academic.workspace.search({ query })).then((result) => {
        if (request === searchRequest.current && result.ok) setSearchResults(result.value);
      });
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  /**
   * HTML "rápido" sob demanda; nunca aplica uma resposta mais velha que a
   * última pedida para o mesmo arquivo. Ver ADR 0015.
   */
  const fetchPreview = async (fileId: string): Promise<void> => {
    const requested = (previewRequestedRevision.get(fileId) ?? 0) + 1;
    previewRequestedRevision.set(fileId, requested);
    const result = await timePerformance('preview', () => window.academic.editor.preview({ fileId }));
    if (previewRequestedRevision.get(fileId) !== requested) return; // superado por um pedido mais novo
    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }
    viewsModel.updatePreview(fileId, result.value);
  };

  const setSplitPreviewMode = (enabled: boolean): void => {
    splitPreviewEnabled.current = enabled;
    setSplitPreview(enabled);
  };

  /**
   * Split é estado visual; a tab de preview continua sendo a projeção que
   * recebe HTML revisionado. Criá-la em segundo plano não muda a view ativa.
   */
  useEffect(() => {
    if (!splitPreview || activeView?.type !== 'editor') return;
    const existing = viewsModel
      .list()
      .find((view) => view.type === 'preview' && view.fileId === activeView.fileId);
    viewsModel.openPreview({ fileId: activeView.fileId, path: activeView.path, activate: false });
    if (existing === undefined) void fetchPreview(activeView.fileId);
    // O id muda ao trocar de editor; updates do preview chegam pelo evento revisionado já existente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splitPreview, activeId]);

  const subscribeController = (viewId: ViewId, controller: RemoteEditorController): void => {
    const unsubscribe = controller.subscribe((event) => {
      if (event.type === 'editor:closed') {
        controllerSubscriptions.delete(viewId);
        if (viewsModel.list().some((candidate) => candidate.id === viewId)) viewsModel.close(viewId);
        return;
      }
      if (event.type === 'editor:changed') recordActivity({ kind: 'document-edited', fileId: String(event.snapshot.fileId) });
      viewsModel.updateSnapshot(String(controller.fileId), event.snapshot);
    });
    controllerSubscriptions.set(viewId, unsubscribe);
  };

  const rememberNavigation = (entry: { readonly fileId: string; readonly path: string; readonly selection?: { readonly anchor: number; readonly head: number } }): void => {
    const current = navigationHistory.current[navigationIndex.current];
    if (current?.fileId === entry.fileId && current.selection?.anchor === entry.selection?.anchor && current.selection?.head === entry.selection?.head) return;
    navigationHistory.current = [...navigationHistory.current.slice(0, navigationIndex.current + 1), entry].slice(-100);
    navigationIndex.current = navigationHistory.current.length - 1;
    setNavigationVersion((value) => value + 1);
  };

  /** A Home sempre retoma o documento que o usuário abriu ou ativou por último. */
  const markFileAsRecent = (fileId: string): void => {
    setRecentFileIds((current) => [fileId, ...current.filter((candidate) => candidate !== fileId)].slice(0, 12));
  };

  const openDocument = async (fileId: string, path: string, options: { readonly remember?: boolean } = {}): Promise<EditorController | undefined> => {
    setHomeOpen(false);
    const shouldRemember = options.remember ?? true;
    const existing = viewsModel.list().find((view) => view.type === 'editor' && view.fileId === fileId);
    if (existing !== undefined && existing.type === 'editor') {
      viewsModel.activate(existing.id);
      markFileAsRecent(fileId);
      if (shouldRemember) rememberNavigation({ fileId, path, selection: existing.snapshot.selection });
      return existing.controller;
    }
    const result = await timePerformance('editor-open', () => window.academic.editor.open({ fileId }));
    if (!result.ok) {
      setMessage(result.error.message);
      return undefined;
    }
    const controller = new RemoteEditorController({ api: window.academic, snapshot: result.value, onError: setMessage });
    const viewId = viewsModel.openEditor({ fileId, path, controller, snapshot: controller.snapshot() });
    subscribeController(viewId, controller);
    markFileAsRecent(fileId);
    if (shouldRemember) rememberNavigation({ fileId, path, selection: controller.snapshot().selection });
    setMessage(path);
    return controller;
  };

  const openWorkspaceFile = async (file: WorkspaceFileDto): Promise<void> => {
    const isImage = file.mediaType?.startsWith('image/') === true || /\.(png|jpe?g|gif|webp|svg)$/iu.test(file.path);
    if (!isImage) { await openDocument(file.fileId, file.path); return; }
    const preview = await window.academic.editor.assetPreview({ fileId: file.fileId });
    if (!preview.ok) { setMessage(preview.error.message); return; }
    setImageViewer({ path: file.path, dataUrl: preview.value.dataUrl });
  };

  /**
   * Cada lado ganha sua própria view/controller (e, portanto, seleção e
   * histórico local próprios), mas ambos apontam para a mesma sessão remota
   * identificada por fileId. View nunca vira uma segunda autoridade do texto.
   */
  const openDocumentInSplit = async (fileId: string, path: string): Promise<EditorController | undefined> => {
    const primary = viewsModel.active();
    if (primary?.type !== 'editor') return undefined;
    const result = await timePerformance('editor-open', () => window.academic.editor.open({ fileId }));
    if (!result.ok) {
      setMessage(result.error.message);
      return undefined;
    }
    const controller = new RemoteEditorController({ api: window.academic, snapshot: result.value, onError: setMessage });
    const viewId = viewsModel.openEditor({ fileId, path, controller, snapshot: controller.snapshot(), duplicate: true });
    subscribeController(viewId, controller);
    markFileAsRecent(fileId);
    setSplitPreviewMode(false);
    setEditorSplit({ primaryId: primary.id, secondaryId: viewId });
    setMessage(`${primary.path} | ${path}`);
    return controller;
  };

  const navigateToLocation = async (location: LanguageLocation): Promise<void> => {
    const controller = await openDocument(String(location.fileId), String(location.path), { remember: false });
    if (controller === undefined) return;
    controller.dispatch({ selection: { anchor: location.range.start, head: location.range.end } });
    rememberNavigation({ fileId: String(location.fileId), path: String(location.path), selection: { anchor: location.range.start, head: location.range.end } });
    setReferenceLocations(undefined);
  };

  const navigateToSearchResult = async (result: NonNullable<import('./shell/commands.js').CommandContext['targetSearchResult']>): Promise<void> => {
    const controller = await openDocument(result.fileId, result.path, { remember: false });
    if (controller === undefined) return;
    const range = result.section?.range;
    if (range !== undefined) controller.dispatch({ selection: { anchor: range.start, head: range.end } });
    rememberNavigation({ fileId: result.fileId, path: result.path, ...(range === undefined ? {} : { selection: { anchor: range.start, head: range.end } }) });
  };

  const navigateHistory = async (direction: -1 | 1): Promise<void> => {
    const targetIndex = navigationIndex.current + direction;
    const target = navigationHistory.current[targetIndex];
    if (target === undefined) return;
    navigationIndex.current = targetIndex;
    const controller = await openDocument(target.fileId, target.path, { remember: false });
    if (controller !== undefined && target.selection !== undefined) controller.dispatch({ selection: target.selection });
    setNavigationVersion((value) => value + 1);
  };

  const showDefinition = (locations: readonly LanguageLocation[]): void => {
    if (locations.length === 0) {
      setMessage('Nenhuma definição encontrada nesta posição.');
      return;
    }
    if (locations.length === 1) {
      void navigateToLocation(locations[0]!);
      return;
    }
    setReferenceLocations(locations);
  };

  const openPreview = async (fileId: string, path: string): Promise<void> => {
    const alreadyOpen = viewsModel.list().some((view) => view.type === 'preview' && view.fileId === fileId);
    viewsModel.openPreview({ fileId, path });
    if (!alreadyOpen) await fetchPreview(fileId);
  };

  /** Funciona tanto com a aba de edição quanto com a de preview — as duas guardam o mesmo `fileId`. */
  const exportActiveDocument = async (format: 'pdf' | 'docx'): Promise<void> => {
    const active = viewsModel.active();
    if (active === undefined) return;
    // A duração inclui o diálogo nativo de salvar (tempo de resposta do
    // usuário), não só compilação/render — não há hoje uma fronteira de IPC
    // que separe as duas coisas. Ver rótulo em performance-observatory-dialog.tsx.
    const result = await timePerformance(`export-${format}`, () => window.academic.editor.export({ fileId: active.fileId, format }));
    if (!result.ok) {
      if (result.error.code !== 'CANCELLED') setMessage(result.error.message);
      return;
    }
    setMessage(`Exportado: ${result.value.path}`);
  };

  const closeTab = async (id: ViewId): Promise<void> => {
    const removed = viewsModel.close(id);
    if (removed === undefined) return;
    setEditorSplit((current) => current !== undefined && (current.primaryId === id || current.secondaryId === id) ? undefined : current);
    if (removed.type !== 'editor') {
      if (splitPreviewEnabled.current) setSplitPreviewMode(false);
      return;
    }
    controllerSubscriptions.get(removed.id)?.();
    controllerSubscriptions.delete(removed.id);
    removed.controller.dispose();
    if (viewsModel.list().some((view) => view.type === 'editor' && view.fileId === removed.fileId)) return;
    const result = await window.academic.editor.close({ fileId: removed.fileId });
    if (!result.ok) setMessage(result.error.message);
  };

  /** Sem chamar editor.close: o Workspace Service já derruba as sessões antigas ao abrir outro vault. */
  const closeAllTabsLocally = (): void => {
    for (const view of viewsModel.list()) {
      if (view.type !== 'editor') continue;
      controllerSubscriptions.get(view.id)?.();
      controllerSubscriptions.delete(view.id);
      view.controller.dispose();
    }
    setSplitPreviewMode(false);
    setEditorSplit(undefined);
    viewsModel.closeAll();
  };

  const acceptOpenedWorkspace = (result: ProtocolResult<WorkspaceOpenResponse>): void => {
    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }
    closeAllTabsLocally();
    const markdown = markdownFiles(result.value.files);
    setWorkspaceId(result.value.workspaceId);
    setKnowledgeWorkspace(loadKnowledgeWorkspace(result.value.workspaceId));
    try {
      const stored = JSON.parse(window.localStorage.getItem(`folio.recent:${result.value.workspaceId}`) ?? '[]');
      setRecentFileIds(Array.isArray(stored) ? stored.filter((fileId): fileId is string => typeof fileId === 'string' && markdown.some((file) => file.fileId === fileId)).slice(0, 12) : []);
    } catch {
      setRecentFileIds([]);
    }
    navigationHistory.current = [];
    navigationIndex.current = -1;
    setNavigationVersion((value) => value + 1);
    setWorkspaceFiles(result.value.files);
    setFiles(markdown);
    setMessage(`${result.value.files.length} arquivos no vault.`);
  };

  useEffect(() => {
    if (lastVaultRestoreAttempted.current) return;
    lastVaultRestoreAttempted.current = true;
    recordPerformanceSample('startup', performance.now() - performance.timeOrigin);
    let cancelled = false;
    void timePerformance('vault-open', () => window.academic.workspace.restoreLast()).then((result) => {
      if (!cancelled && result.ok) acceptOpenedWorkspace(result);
    });
    return () => { cancelled = true; };
    // A operação é uma tentativa única no boot; resultado de ausência é normal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (workspaceId !== undefined) window.localStorage.setItem(knowledgeStorageKey(workspaceId), JSON.stringify(knowledgeWorkspace));
  }, [knowledgeWorkspace, workspaceId]);

  useEffect(() => {
    const unregister = [
      commandRegistry.register({
        id: 'workspace.navigation', title: 'Abrir navegação do workspace',
        isEnabled: () => workspaceId !== undefined,
        run() { setWorkspaceNavigationOpen(true); },
      }),
      commandRegistry.register({
        id: 'bookmark.create', title: 'Adicionar bookmark do arquivo atual',
        isEnabled: (context) => context.targetFile !== undefined || viewsModel.active()?.type === 'editor',
        async run(context) {
          const active = viewsModel.active();
          const target = context.targetFile ?? (active?.type === 'editor' ? { fileId: active.fileId, path: active.path } : undefined);
          if (target === undefined) return;
          const label = await requestText('Nome do bookmark', target.path);
          if (label === null || label.trim() === '') return;
          const current = await window.academic.workspace.bookmarks();
          if (!current.ok) { setMessage(current.error.message); return; }
          const bookmark = { version: 1 as const, id: crypto.randomUUID(), label: label.trim(), target: { kind: 'document' as const, fileId: target.fileId, path: target.path }, createdAt: new Date().toISOString() };
          const result = await window.academic.workspace.setBookmarks({ version: 1, bookmarks: [...current.value.bookmarks, bookmark] });
          setMessage(result.ok ? `Bookmark “${bookmark.label}” criado.` : result.error.message);
        },
      }),
      commandRegistry.register({
        id: 'bookmark.remove', title: 'Remover bookmark',
        isEnabled: (context) => context.targetBookmark !== undefined,
        async run(context) {
          if (context.targetBookmark === undefined) return;
          const current = await window.academic.workspace.bookmarks();
          if (!current.ok) { setMessage(current.error.message); return; }
          const result = await window.academic.workspace.setBookmarks({ version: 1, bookmarks: current.value.bookmarks.filter((item) => item.id !== context.targetBookmark!.id) });
          if (!result.ok) setMessage(result.error.message);
        },
      }),
      commandRegistry.register({
        id: 'journal.openToday', title: 'Abrir diário de pesquisa de hoje',
        isEnabled: () => workspaceId !== undefined,
        async run() {
          const result = await window.academic.workspace.journalOpen({});
          if (!result.ok) { setMessage(result.error.message); return; }
          await openDocument(result.value.fileId, result.value.path);
        },
      }),
      commandRegistry.register({
        id: 'journal.capture', title: 'Captura rápida no diário de pesquisa',
        isEnabled: () => workspaceId !== undefined,
        async run() {
          const text = await requestText('Nota rápida para o diário de hoje');
          if (text === null || text.trim() === '') return;
          const result = await window.academic.workspace.journalCapture({ text: text.trim() });
          setMessage(result.ok ? `Capturado em ${result.value.path}.` : result.error.message);
        },
      }),
      commandRegistry.register({
        id: 'academicViews.open', title: 'Abrir Views acadêmicas',
        isEnabled: () => workspaceId !== undefined,
        run() { setAcademicViewsOpen(true); },
      }),
      commandRegistry.register({
        id: 'knowledge.open',
        title: 'Abrir Knowledge Workspace',
        isEnabled: () => workspaceId !== undefined && hasLayoutCustomization,
        run() { setKnowledgeWorkspaceOpen(true); },
      }),
      commandRegistry.register({
        id: 'search.openView',
        title: 'Abrir busca acadêmica',
        isEnabled: () => workspaceId !== undefined,
        run() { setSearchViewOpen(true); },
      }),
      commandRegistry.register({
        id: 'search.openSidebar',
        title: 'Abrir ou fechar busca no vault',
        category: 'Workspace',
        aliases: ['buscar no vault', 'pesquisa local', 'buscar documentos'],
        isEnabled: () => workspaceId !== undefined,
        run() { setSidebarCollapsed(false); setFileExplorerExpanded(false); setSearchSidebarOpen((current) => !current); },
      }),
      commandRegistry.register({
        id: 'search.open',
        title: 'Abrir resultado da busca',
        isEnabled: (context) => context.targetSearchResult !== undefined,
        async run(context) {
          if (context.targetSearchResult === undefined) return;
          await navigateToSearchResult(context.targetSearchResult);
          setSearchViewOpen(false);
        },
      }),
      commandRegistry.register({
        id: 'search.openSide',
        title: 'Abrir resultado da busca ao lado',
        isEnabled: (context) => context.targetSearchResult !== undefined && viewsModel.active()?.type === 'editor',
        async run(context) {
          if (context.targetSearchResult === undefined) return;
          const controller = await openDocumentInSplit(context.targetSearchResult.fileId, context.targetSearchResult.path);
          const range = context.targetSearchResult.section?.range;
          if (controller !== undefined && range !== undefined) controller.dispatch({ selection: { anchor: range.start, head: range.end } });
        },
      }),
      commandRegistry.register({
        id: 'search.addToCollection',
        title: 'Adicionar resultado da busca à collection',
        isEnabled: (context) => context.targetSearchResult !== undefined && knowledgeWorkspaceRef.current.collections.length > 0,
        async run(context) {
          if (context.targetSearchResult === undefined) return;
          const collections = knowledgeWorkspaceRef.current.collections;
          const choices = collections.map((collection, index) => `${index + 1}. ${collection.name}`).join('\n');
          const selection = await requestText('Adicionar à collection', collections[0]?.name ?? '', choices === '' ? {} : { description: `Opções: ${choices}` });
          if (selection === null) return;
          const normalized = selection.trim();
          const collection = collections.find((item, index) => item.name === normalized || String(index + 1) === normalized || item.id === normalized);
          if (collection === undefined) { setMessage('Collection não encontrada.'); return; }
          setKnowledgeWorkspace((current) => ({
            ...current,
            collections: current.collections.map((item) => item.id !== collection.id || item.fileIds.includes(context.targetSearchResult!.fileId)
              ? item
              : { ...item, fileIds: [...item.fileIds, context.targetSearchResult!.fileId] }),
          }));
          setMessage(`${context.targetSearchResult.path} adicionada a ${collection.name}.`);
        },
      }),
      commandRegistry.register({
        id: 'search.createSaved',
        title: 'Salvar consulta acadêmica',
        isEnabled: (context) => context.targetSearchQuery?.trim() !== '',
        async run(context) {
          const query = context.targetSearchQuery?.trim();
          if (query === undefined || query === '') return;
          const name = await requestText('Nome da busca salva', query);
          if (name === null || name.trim() === '') return;
          setKnowledgeWorkspace((current) => ({ ...current, searches: [...current.searches, { id: crypto.randomUUID(), name: name.trim(), query }] }));
          setMessage(`Busca "${name.trim()}" salva.`);
        },
      }),
      commandRegistry.register({
        id: 'search.copyLink',
        title: 'Copiar link do resultado da busca',
        isEnabled: (context) => context.targetSearchResult !== undefined,
        async run(context) {
          const result = context.targetSearchResult;
          if (result === undefined) return;
          const link = result.section === undefined ? `[[${result.path}]]` : `[[${result.path}#${result.section.title}]]`;
          try {
            await navigator.clipboard.writeText(link);
            setMessage('Link copiado.');
          } catch {
            setMessage('Não foi possível copiar o link.');
          }
        },
      }),
      commandRegistry.register({
        id: 'workspace.home',
        title: 'Abrir Home do workspace',
        category: 'Workspace',
        aliases: ['início', 'painel inicial', 'dashboard diário'],
        isEnabled: () => workspaceId !== undefined,
        run() { setHomeOpen(true); },
      }),
      commandRegistry.register({
        id: 'explorer.toggleExpanded',
        title: 'Abrir ou fechar explorador de arquivos',
        category: 'Workspace',
        aliases: ['arquivos', 'file explorer', 'sidebar de arquivos'],
        isEnabled: () => workspaceId !== undefined,
        run() { setSidebarCollapsed(false); setSearchSidebarOpen(false); setFileExplorerExpanded((current) => !current); },
      }),
      commandRegistry.register({
        id: 'layout.saveCurrent',
        title: 'Salvar layout atual do workspace',
        category: 'Layout',
        aliases: ['salvar visualização', 'layout customizado'],
        isEnabled: () => workspaceId !== undefined,
        async run() {
          const name = await requestText('Nome do layout', `Layout ${focusMode}`);
          if (name === null || name.trim() === '') return;
          const id = crypto.randomUUID();
          setWorkspaceLayouts((current) => [...current, { id, name: name.trim(), focus: focusMode, showNavigation: activeLayout.showNavigation, showContext: activeLayout.showContext }]);
          setActiveLayoutId(id);
          setLayoutVisibilityOverride({});
          setMessage(`Layout “${name.trim()}” salvo neste vault.`);
        },
      }),
      commandRegistry.register({
        id: 'research.open',
        title: 'Abrir fluxo de pesquisa',
        category: 'Pesquisa',
        aliases: ['fila de leitura', 'literature review', 'matriz'],
        isEnabled: () => workspaceId !== undefined,
        run() { setResearchWorkflowOpen(true); },
      }),
      commandRegistry.register({
        id: 'research.intake',
        title: 'Importar pesquisa para a inbox',
        category: 'Pesquisa',
        aliases: ['doi', 'bibtex', 'ris', 'pdf'],
        isEnabled: () => workspaceId !== undefined,
        run() { setResearchIntakeOpen(true); },
      }),
      commandRegistry.register({
        id: 'capture.inbox',
        title: 'Abrir inbox de capturas',
        category: 'Pesquisa',
        aliases: ['captura rápida', 'url', 'web clipper', 'seleção'],
        isEnabled: () => workspaceId !== undefined,
        run() { setPendingCapture(undefined); setCaptureInboxOpen(true); },
      }),
      commandRegistry.register({
        id: 'capture.selection',
        title: 'Capturar seleção na inbox',
        category: 'Pesquisa',
        aliases: ['anotar seleção', 'captura do editor'],
        isEnabled: () => { const active = viewsModel.active(); return active?.type === 'editor' && active.snapshot.selection.anchor !== active.snapshot.selection.head; },
        run() {
          const active = viewsModel.active();
          if (active?.type !== 'editor') return;
          const start = Math.min(active.snapshot.selection.anchor, active.snapshot.selection.head);
          const end = Math.max(active.snapshot.selection.anchor, active.snapshot.selection.head);
          setPendingCapture({ id: crypto.randomUUID(), capturedAt: new Date().toISOString(), title: active.path, selection: active.snapshot.session.content.slice(start, end) });
          setCaptureInboxOpen(true);
        },
      }),
      commandRegistry.register({
        id: 'projects.open',
        title: 'Abrir projetos de pesquisa',
        category: 'Projetos',
        aliases: ['tcc', 'marcos', 'submissão'],
        isEnabled: () => workspaceId !== undefined,
        run() { setResearchProjectsOpen(true); },
      }),
      commandRegistry.register({
        id: 'research.canvas',
        title: 'Abrir canvas de pesquisa',
        category: 'Pesquisa',
        aliases: ['mapa de argumentos', 'evidências', 'canvas'],
        isEnabled: () => workspaceId !== undefined,
        run() { setResearchCanvasOpen(true); },
      }),
      commandRegistry.register({ id: 'forms.open', title: 'Abrir formulários acadêmicos', category: 'Pesquisa', aliases: ['extração', 'dataset', 'revisar referência'], isEnabled: () => workspaceId !== undefined, run() { setAcademicFormsOpen(true); } }),
      commandRegistry.register({ id: 'research.structured', title: 'Abrir pesquisa estruturada', category: 'Pesquisa', aliases: ['revisão sistemática', 'datasets', 'prisma'], isEnabled: () => workspaceId !== undefined, run() { setStructuredResearchOpen(true); } }),
      commandRegistry.register({ id: 'submission.integrations', title: 'Abrir integrações de submissão', category: 'Submissão', aliases: ['orcid', 'crossref', 'ojs', 'revisão'], isEnabled: () => workspaceId !== undefined, run() { setSubmissionIntegrationsOpen(true); } }),
      commandRegistry.register({ id: 'forms.applyReferenceType', title: 'Aplicar tipo de referência em lote', category: 'Pesquisa', async run(_context, args) { const input = args as { ids?: unknown; type?: unknown }; const ids = Array.isArray(input.ids) ? input.ids.filter((id): id is string => typeof id === 'string') : []; const type = typeof input.type === 'string' ? input.type : ''; if (ids.length === 0 || type === '') return; if (!await requestConfirmation({ title: 'Atualizar referências', description: `${ids.length} referência(s) receberão o tipo “${type}”.`, confirmLabel: 'Aplicar tipo', destructive: false })) return; const listed = await window.academic.library.list({}); if (!listed.ok) { setMessage(listed.error.message); return; } for (const id of ids) { const entry = listed.value.find((item) => item.id === id); if (entry === undefined) continue; const result = await window.academic.library.upsert({ entry: { ...entry, type: type as BibliographicEntityDto['type'] } }); if (!result.ok) { setMessage(result.error.message); return; } } setMessage(`${ids.length} referência(s) atualizada(s).`); } }),
      commandRegistry.register({
        id: 'automation.open',
        title: 'Abrir automação e atalhos',
        isEnabled: () => workspaceId !== undefined,
        run() { setAutomationOpen(true); },
      }),
      ...workspaceMacros.map((macro) => commandRegistry.register({
        id: `macro.${macro.id}`,
        title: `Macro: ${macro.name}`,
        isEnabled: (context) => {
          try { planAutomation(commandRegistry, context, macro.commands); return true; } catch { return false; }
        },
        automationPreview(context) {
          const plan = planAutomation(commandRegistry, context, macro.commands);
          return { summary: `Executar macro “${macro.name}” (${plan.steps.length} comando(s)).`, requiresConfirmation: plan.requiresConfirmation };
        },
        async run(context) {
          const plan = planAutomation(commandRegistry, context, macro.commands);
          if (plan.requiresConfirmation && !await requestConfirmation({ title: `Executar macro “${macro.name}”?`, description: plan.steps.map((step) => `• ${step.preview.summary}`).join('\n'), confirmLabel: 'Executar', destructive: false })) return;
          await executeAutomation(commandRegistry, context, plan);
        },
      })),
      commandRegistry.register({
        id: 'batch.addToCollection',
        title: 'Adicionar documentos selecionados à collection',
        arguments: collectionArguments,
        isEnabled: (context, args) => context.selectedFiles !== undefined && context.selectedFiles.length > 0 && typeof (args as { collectionId?: unknown }).collectionId === 'string',
        automationPreview(context, args) {
          const collectionId = (args as { collectionId: string }).collectionId;
          const collection = knowledgeWorkspaceRef.current.collections.find((item) => item.id === collectionId);
          return { summary: `Adicionar ${context.selectedFiles?.length ?? 0} documento(s) à collection ${collection?.name ?? collectionId}.` };
        },
        run(context, args) {
          const collectionId = (args as { collectionId: string }).collectionId;
          const selected = context.selectedFiles ?? [];
          const collection = knowledgeWorkspaceRef.current.collections.find((item) => item.id === collectionId);
          if (collection === undefined) { setMessage('Collection não encontrada.'); return; }
          setKnowledgeWorkspace((current) => ({
            ...current,
            collections: current.collections.map((item) => item.id !== collectionId ? item : { ...item, fileIds: [...new Set([...item.fileIds, ...selected.map((file) => file.fileId)])] }),
          }));
          setMessage(`${selected.length} documento(s) adicionados a ${collection.name}.`);
        },
      }),
      commandRegistry.register({
        id: 'batch.validateDocuments',
        title: 'Validar documentos selecionados',
        isEnabled: (context) => (context.selectedFiles?.length ?? 0) > 0,
        automationPreview(context) { return { summary: `Atualizar diagnósticos de ${context.selectedFiles?.length ?? 0} documento(s) no Workspace Service.` }; },
        async run(context) {
          const selected = context.selectedFiles ?? [];
          const result = await window.academic.workspace.projectDashboard({ fileIds: selected.map((file) => file.fileId) });
          if (!result.ok) { setMessage(result.error.message); return; }
          const errors = result.value.documents.reduce((total, document) => total + document.errors, 0);
          const warnings = result.value.documents.reduce((total, document) => total + document.warnings, 0);
          setMessage(`Validação: ${errors} erro(s) e ${warnings} aviso(s) em ${result.value.documents.length} documento(s).`);
          setReviewMode(true);
        },
      }),
      commandRegistry.register({
        id: 'writing.open',
        title: 'Abrir ferramentas de escrita acadêmica',
        isEnabled: () => activeEditorView !== undefined && writingStatistics !== undefined,
        run() { setWritingWorkflowOpen(true); },
      }),
      commandRegistry.register({
        id: 'library.maintenance',
        title: 'Revisar duplicatas e chaves de referências',
        isEnabled: () => workspaceId !== undefined,
        run() { setReferenceMaintenanceOpen(true); },
      }),
      commandRegistry.register({
        id: 'library.maintenanceCenter',
        title: 'Abrir centro de manutenção da biblioteca',
        isEnabled: () => workspaceId !== undefined,
        run() { setLibraryMaintenanceCenterOpen(true); },
      }),
      commandRegistry.register({
        id: 'application.systemInformation',
        title: 'Ajuda: informações do sistema',
        async run() {
          const result = await window.academic.application.systemInformation();
          if (result.ok) setSystemInformation(result.value);
          else setMessage(result.error.message);
        },
      }),
      commandRegistry.register({
        id: 'palette.commands',
        title: 'Mostrar Command Palette',
        run() {
          setPaletteMode('commands');
        },
      }),
      commandRegistry.register({
        id: 'palette.quickOpen',
        title: 'Abrir arquivo rapidamente',
        isEnabled: () => files.length > 0,
        run() {
          setPaletteMode('files');
        },
      }),
      commandRegistry.register({
        id: 'workspace.openGraph',
        title: 'Mostrar grafo do workspace',
        isEnabled: () => files.length > 0,
        run() {
          setGraphView(true);
        },
      }),
      commandRegistry.register({ id: 'document.history', title: 'Mostrar histórico do documento', isEnabled: () => viewsModel.active()?.type === 'editor', run() { setHistoryOpen(true); } }),
      commandRegistry.register({ id: 'document.backlinks', title: 'Mostrar backlinks do documento', isEnabled: () => viewsModel.active()?.type === 'editor', run() { setContextCollapsed(false); setLayoutVisibilityOverride((current) => ({ ...current, showContext: true })); setActivePanelId(backlinksPanel.id); } }),
      commandRegistry.register({ id: 'page.enable', title: 'Usar documento como página', category: 'Documento', isEnabled: () => viewsModel.active()?.type === 'editor', async run() { const active = viewsModel.active(); if (active?.type !== 'editor') return; const result = await window.academic.workspace.enablePage({ fileId: active.fileId, expectedRevision: active.snapshot.session.revision, id: crypto.randomUUID() }); if (!result.ok) { setMessage(result.error.message); return; } setPagePropertiesOpen(true); setMessage('Propriedades da página abertas.'); } }),
      commandRegistry.register({ id: 'document.compare', title: 'Comparar documentos', isEnabled: () => files.length > 1, run() { setDocumentComparisonOpen(true); } }),
      commandRegistry.register({ id: 'plugins.manage', title: 'Gerenciar plugins locais', isEnabled: () => workspaceId !== undefined, run() { setPluginManagerOpen(true); } }),
      commandRegistry.register({ id: 'application.settings', title: 'Abrir configurações', run() { setSettingsOpen(true); } }),
      commandRegistry.register({ id: 'workspace.sync', title: 'Configurar pasta espelho local', category: 'Workspace', isEnabled: () => workspaceId !== undefined, run() { setSyncOpen(true); } }),
      commandRegistry.register({ id: 'collaboration.manage', title: 'Gerenciar colaboradores', category: 'Workspace', isEnabled: () => workspaceId !== undefined, run() { setCollaborationOpen(true); } }),
      commandRegistry.register({ id: 'performance.open', title: 'Abrir Performance Observatory', category: 'Workspace', aliases: ['perf', 'desempenho', 'benchmark'], run() { setPerformanceOpen(true); } }),
      ...pluginContributions.flatMap((plugin) => plugin.commands.map((command) => commandRegistry.register({ id: `plugin.${plugin.id}.${command.id}`, title: `${plugin.id}: ${command.title}`, isEnabled: () => plugin.enabled, async run() { const active = viewsModel.active(); const result = await window.academic.workspace.runPluginCommand({ pluginId: plugin.id, commandId: command.id, ...(active?.type === 'editor' ? { activeFileId: active.fileId, activeRevision: active.snapshot.session.revision } : {}) }); if (!result.ok) { setMessage(result.error.message); return; } setMessage(result.value.message ?? `Comando ${command.title} executado.`); if (result.value.kind === 'open-view') setPluginManagerOpen(true); } }))),
      ...pluginContributions.flatMap((plugin) => plugin.exports.map((output) => commandRegistry.register({ id: `plugin.${plugin.id}.export.${output.id}`, title: `${plugin.id}: Exportar ${output.title}`, isEnabled: () => plugin.enabled && viewsModel.active()?.type === 'editor', async run() { const active = viewsModel.active(); if (active?.type !== 'editor') return; const result = await window.academic.editor.exportPlugin({ fileId: active.fileId, expectedRevision: active.snapshot.session.revision, pluginId: plugin.id, exportId: output.id }); setMessage(result.ok ? `Exportado em ${result.value.path}.` : result.error.message); } }))),
      commandRegistry.register({
        id: 'library.manage',
        title: 'Gerenciar biblioteca de referências',
        run() { setReferenceLibraryEditor(true); },
      }),
      commandRegistry.register({
        id: 'references.health',
        title: 'Mostrar saúde das referências',
        run() { setReferenceHealth(true); },
      }),
      commandRegistry.register({
        id: 'annotations.synthesize',
        title: 'Sintetizar anotações em nota',
        run() { setAnnotationSynthesisOpen(true); },
      }),
      commandRegistry.register({
        id: 'literature.monitoring',
        title: 'Monitoramento de literatura (feeds)',
        run() { setLiteratureMonitoringOpen(true); },
      }),
      commandRegistry.register({
        id: 'workspace.open',
        title: 'Abrir vault',
        async run() {
          setOpeningVault(true);
          setMessage('Escolha a pasta do vault no diálogo do sistema…');
          try {
            acceptOpenedWorkspace(await withTimeout(window.academic.workspace.chooseAndOpen(), 15_000));
          } catch {
            setMessage('O seletor não respondeu. Informe o caminho do vault abaixo.');
          } finally {
            setOpeningVault(false);
          }
        },
      }),
      commandRegistry.register({
        id: 'application.newWindow',
        title: 'Abrir nova janela',
        async run() {
          const result = await window.academic.application.newWindow();
          if (!result.ok) setMessage(result.error.message);
        },
      }),
      commandRegistry.register({
        id: 'document.open',
        title: 'Abrir documento',
        arguments: documentOpenArguments,
        isEnabled: (context, args) => context.targetFile !== undefined || args !== undefined,
        async run(context, args) {
          const target = (args as { fileId: string; path: string } | undefined) ?? context.targetFile;
          if (target === undefined) return;
          await openDocument(target.fileId, target.path);
        },
      }),
      commandRegistry.register({
        id: 'navigation.back',
        title: 'Navegar para trás',
        isEnabled: () => navigationIndex.current > 0,
        run() { void navigateHistory(-1); },
      }),
      commandRegistry.register({
        id: 'navigation.forward',
        title: 'Navegar para frente',
        isEnabled: () => navigationIndex.current >= 0 && navigationIndex.current < navigationHistory.current.length - 1,
        run() { void navigateHistory(1); },
      }),
      commandRegistry.register({
        id: 'view.splitEditor',
        title: 'Abrir editor ao lado',
        isEnabled: () => viewsModel.active()?.type === 'editor',
        run() {
          const active = viewsModel.active();
          if (active?.type === 'editor') void openDocumentInSplit(active.fileId, active.path);
        },
      }),
      commandRegistry.register({
        id: 'view.splitEditorWithFile',
        title: 'Abrir arquivo ao lado',
        isEnabled: () => viewsModel.active()?.type === 'editor' && files.length > 0,
        run() { setSplitEditorPicker(true); },
      }),
      commandRegistry.register({
        id: 'document.save',
        title: 'Salvar documento',
        isEnabled: (context) => context.activeViewId !== undefined,
        automationPreview() { return { summary: 'Salvar o rascunho atual no vault.', requiresConfirmation: true }; },
        async run() {
          const active = viewsModel.active();
          if (active === undefined || active.type !== 'editor') return;
          try {
            await active.controller.save();
            setMessage('Salvo no vault.');
          } catch {
            setMessage('Não foi possível salvar o documento.');
          }
        },
      }),
      commandRegistry.register({
        id: 'document.resolveExternalConflict.keepLocal',
        title: 'Manter rascunho local',
        isEnabled: () => {
          const active = viewsModel.active();
          return active?.type === 'editor' && active.snapshot.externalChange !== undefined;
        },
        async run() {
          const active = viewsModel.active();
          if (active === undefined || active.type !== 'editor') return;
          try {
            await active.controller.resolveExternalConflict('keep-local');
            setMessage('Rascunho local mantido. Salve para aplicá-lo ao arquivo.');
          } catch {
            setMessage('Não foi possível manter o rascunho local.');
          }
        },
      }),
      commandRegistry.register({
        id: 'document.resolveExternalConflict.reloadExternal',
        title: 'Recarregar versão externa',
        isEnabled: () => {
          const active = viewsModel.active();
          return active?.type === 'editor' && active.snapshot.externalChange !== undefined;
        },
        async run() {
          const active = viewsModel.active();
          if (active === undefined || active.type !== 'editor') return;
          try {
            await active.controller.resolveExternalConflict('reload-external');
            setMessage('Rascunho local descartado; versão externa recarregada.');
          } catch {
            setMessage('Não foi possível recarregar a versão externa.');
          }
        },
      }),
      commandRegistry.register({
        id: 'document.closeActiveTab',
        title: 'Fechar aba',
        isEnabled: (context) => context.activeViewId !== undefined,
        async run() {
          const active = viewsModel.active();
          if (active !== undefined) await closeTab(active.id);
        },
      }),
      commandRegistry.register({
        id: 'publication.preview',
        title: 'Visualizar publicação',
        isEnabled: (context) => context.targetFile !== undefined || viewsModel.active()?.type === 'editor',
        automationPreview() { return { summary: 'Atualizar a visualização da publicação atual.' }; },
        async run(context) {
          const active = viewsModel.active();
          const target = context.targetFile ?? (active?.type === 'editor' ? { fileId: active.fileId, path: active.path } : undefined);
          if (target === undefined) return;
          await openPreview(target.fileId, target.path);
        },
      }),
      commandRegistry.register({
        id: 'view.toggleSplitPreview',
        title: 'Alternar editor e preview lado a lado',
        isEnabled: () => viewsModel.active()?.type === 'editor',
        run() {
          const active = viewsModel.active();
          if (active?.type !== 'editor') return;
          setSplitPreviewMode(!splitPreviewEnabled.current);
        },
      }),
      commandRegistry.register({
        id: 'document.exportPdf',
        title: 'Exportar como PDF',
        isEnabled: (context) => context.activeViewId !== undefined,
        automationPreview() { return { summary: 'Gerar PDF e pedir o destino no diálogo nativo.', requiresConfirmation: true }; },
        async run() {
          await exportActiveDocument('pdf');
        },
      }),
      commandRegistry.register({
        id: 'document.exportDocx',
        title: 'Exportar como DOCX',
        isEnabled: (context) => context.activeViewId !== undefined,
        automationPreview() { return { summary: 'Gerar DOCX e pedir o destino no diálogo nativo.', requiresConfirmation: true }; },
        async run() {
          await exportActiveDocument('docx');
        },
      }),
      commandRegistry.register({
        id: 'citation.insert',
        title: 'Inserir citação',
        isEnabled: (context) => context.targetReference !== undefined || context.targetCitation !== undefined,
        run(context) {
          const active = viewsModel.active();
          if (active === undefined || active.type !== 'editor') return;
          const { anchor, head } = active.snapshot.selection;
          const start = context.targetCitation?.range.start ?? Math.min(anchor, head);
          const end = context.targetCitation?.range.end ?? Math.max(anchor, head);
          const text = context.targetCitation?.text ?? `[@${context.targetReference?.id ?? ''}]`;
          active.controller.dispatch({
            edits: [{ range: { start, end }, text }],
            selection: { anchor: start + text.length, head: start + text.length },
          });
        },
      }),
      commandRegistry.register({
        id: 'mention.linkify',
        title: 'Transformar menção em link',
        isEnabled: (context) => context.targetMention !== undefined,
        run(context) {
          const active = viewsModel.active();
          if (active === undefined || active.type !== 'editor' || context.targetMention === undefined) return;
          const { range, text, targetPath } = context.targetMention;
          const linkText = `[${text}](${targetPath})`;
          active.controller.dispatch({
            edits: [{ range, text: linkText }],
            selection: { anchor: range.start + linkText.length, head: range.start + linkText.length },
          });
        },
      }),
      commandRegistry.register({
        id: 'reference.createLiteratureNote',
        title: 'Criar nota de leitura a partir da referência',
        isEnabled: (context) => context.targetReference !== undefined && context.activeFileId !== undefined,
        async run(context) {
          if (context.targetReference === undefined || context.activeFileId === undefined) return;
          const result = await window.academic.documents.createLiteratureNote({
            referenceId: context.targetReference.id,
            activeFileId: context.activeFileId,
          });
          if (result.ok) await openDocument(result.value.fileId, result.value.path);
          else setMessage(result.error.message);
        },
      }),
      commandRegistry.register({
        id: 'citation.openPicker',
        title: 'Inserir citação avançada',
        isEnabled: () => viewsModel.active()?.type === 'editor',
        run() {
          const active = viewsModel.active();
          if (active?.type !== 'editor') return;
          const { anchor, head } = active.snapshot.selection;
          setCitationEditor({ initial: undefined, range: { start: Math.min(anchor, head), end: Math.max(anchor, head) } });
        },
      }),
      commandRegistry.register({ id: 'link.insert', title: 'Inserir link do vault', isEnabled: () => viewsModel.active()?.type === 'editor', run() { insertLinkAtSelection(false); } }),
      commandRegistry.register({ id: 'link.insertExternal', title: 'Inserir link externo', isEnabled: () => viewsModel.active()?.type === 'editor', run() { insertLinkAtSelection(true); } }),
      commandRegistry.register({ id: 'editor.format.bold', title: 'Formatar seleção: negrito', isEnabled: () => viewsModel.active()?.type === 'editor', run() { wrapActiveSelection('**', '**'); } }),
      commandRegistry.register({ id: 'editor.format.italic', title: 'Formatar seleção: itálico', isEnabled: () => viewsModel.active()?.type === 'editor', run() { wrapActiveSelection('*', '*'); } }),
      commandRegistry.register({ id: 'editor.format.code', title: 'Formatar seleção: código', isEnabled: () => viewsModel.active()?.type === 'editor', run() { wrapActiveSelection('`', '`'); } }),
      commandRegistry.register({ id: 'editor.format.strike', title: 'Formatar seleção: tachado', isEnabled: () => viewsModel.active()?.type === 'editor', run() { wrapActiveSelection('~~', '~~'); } }),
      commandRegistry.register({ id: 'editor.paragraph.heading1', title: 'Transformar em título 1', isEnabled: () => viewsModel.active()?.type === 'editor', run() { prefixActiveLines('# ', 'Título'); } }),
      commandRegistry.register({ id: 'editor.paragraph.heading2', title: 'Transformar em título 2', isEnabled: () => viewsModel.active()?.type === 'editor', run() { prefixActiveLines('## ', 'Subtítulo'); } }),
      commandRegistry.register({ id: 'editor.paragraph.quote', title: 'Transformar em citação em bloco', isEnabled: () => viewsModel.active()?.type === 'editor', run() { prefixActiveLines('> ', 'Citação'); } }),
      commandRegistry.register({ id: 'editor.paragraph.list', title: 'Transformar em lista', isEnabled: () => viewsModel.active()?.type === 'editor', run() { prefixActiveLines('- ', 'Item'); } }),
      commandRegistry.register({ id: 'editor.copy', title: 'Copiar seleção', isEnabled: () => { const active = viewsModel.active(); return active?.type === 'editor' && active.controller.snapshot().selection.anchor !== active.controller.snapshot().selection.head; }, run() { void copyActiveSelection(); } }),
      commandRegistry.register({ id: 'editor.cut', title: 'Recortar seleção', isEnabled: () => { const active = viewsModel.active(); return active?.type === 'editor' && active.controller.snapshot().selection.anchor !== active.controller.snapshot().selection.head; }, run() { void copyActiveSelection(true); } }),
      commandRegistry.register({ id: 'editor.paste', title: 'Colar texto', isEnabled: () => viewsModel.active()?.type === 'editor', run() { void pasteAtSelection(); } }),
      commandRegistry.register({ id: 'editor.selectAll', title: 'Selecionar todo o documento', isEnabled: () => viewsModel.active()?.type === 'editor', run() { const active = viewsModel.active(); if (active?.type !== 'editor') return; const length = active.controller.snapshot().session.content.length; active.controller.dispatch({ selection: { anchor: 0, head: length } }); } }),
      commandRegistry.register({
        id: 'diagnostics.openCenter',
        title: 'Mostrar diagnósticos acadêmicos',
        isEnabled: () => viewsModel.active()?.type === 'editor',
        run() { setDiagnosticsCenter(true); },
      }),
      commandRegistry.register({ id: 'metadata.edit', title: 'Editar metadados do documento', isEnabled: () => viewsModel.active()?.type === 'editor', run() { setMetadataEditor(true); } }),
      commandRegistry.register({ id: 'profile.select', title: 'Selecionar perfil de publicação', isEnabled: () => viewsModel.active()?.type === 'editor', run() { setProfileSelector(true); } }),
      commandRegistry.register({ id: 'problems.open', title: 'Mostrar Problemas', isEnabled: () => viewsModel.active()?.type === 'editor', run() { setProblemsPanel(true); } }),
      commandRegistry.register({ id: 'review.open', title: 'Abrir modo de revisão', isEnabled: () => workspaceId !== undefined, run() { setReviewMode(true); } }),
      commandRegistry.register({
        id: 'review.nextDiagnostic', title: 'Próximo diagnóstico', isEnabled: () => viewsModel.active()?.type === 'editor',
        run() { const active=viewsModel.active(); if(active?.type!=='editor') return; const entries=active.snapshot.diagnostics.filter((item)=>item.source!==undefined).sort((a,b)=>a.source!.start.offset-b.source!.start.offset); const next=entries.find((item)=>item.source!.start.offset>active.snapshot.selection.head) ?? entries[0]; if(next?.source!==undefined) active.controller.dispatch({selection:{anchor:next.source.start.offset,head:next.source.end.offset}}); },
      }),
      commandRegistry.register({
        id: 'review.previousDiagnostic', title: 'Diagnóstico anterior', isEnabled: () => viewsModel.active()?.type === 'editor',
        run() { const active=viewsModel.active(); if(active?.type!=='editor') return; const entries=active.snapshot.diagnostics.filter((item)=>item.source!==undefined).sort((a,b)=>b.source!.start.offset-a.source!.start.offset); const previous=entries.find((item)=>item.source!.start.offset<active.snapshot.selection.head) ?? entries[0]; if(previous?.source!==undefined) active.controller.dispatch({selection:{anchor:previous.source.start.offset,head:previous.source.end.offset}}); },
      }),
      commandRegistry.register({
        id: 'review.nextComment', title: 'Próximo comentário', isEnabled: () => workspaceId !== undefined,
        async run() { if(workspaceId===undefined) return; const comments=[...readReviewComments(workspaceId)].sort((a,b)=>a.path.localeCompare(b.path)||a.range.start-b.range.start); const active=viewsModel.active(); const next=comments.find((comment)=>comment.fileId===active?.fileId&&comment.range.start>(active?.type==='editor'?active.snapshot.selection.head:-1)) ?? comments[0]; if(next===undefined)return; const controller=await openDocument(next.fileId,next.path); if(controller!==undefined)controller.dispatch({selection:{anchor:next.range.start,head:next.range.end}}); },
      }),
      commandRegistry.register({
        id: 'figure.insert', title: 'Inserir figura', isEnabled: () => viewsModel.active()?.type === 'editor',
        run() {
          const active = viewsModel.active(); if (active?.type !== 'editor') return;
          const { anchor, head } = active.snapshot.selection; const start = Math.min(anchor, head);
          setFigureEditor({ fileId: active.fileId, path: active.path, range: { start, end: Math.max(anchor, head) } });
        },
      }),
      commandRegistry.register({
        id: 'table.insert', title: 'Inserir tabela', isEnabled: () => viewsModel.active()?.type === 'editor',
        run() { const active=viewsModel.active(); if(active?.type!=='editor') return; const { anchor, head }=active.snapshot.selection; const found=markdownTableAt(active.snapshot.session.content,head); setTableEditor(found === undefined ? { range: { start: Math.min(anchor,head), end: Math.max(anchor,head) } } : { range: found.range, initial: found.table }); },
      }),
      commandRegistry.register({
        id: 'math.insertEquation', title: 'Inserir equação', isEnabled: () => viewsModel.active()?.type === 'editor',
        async run() { const active=viewsModel.active(); if(active?.type!=='editor') return; const tex=(await requestText('Expressão TeX', 'x = y')) ?? ''; const identifier=(await requestText('Identificador da equação (opcional)')) ?? ''; const text=equationSource(tex, identifier); const {anchor,head}=active.snapshot.selection; const start=Math.min(anchor,head); active.controller.dispatch({edits:[{range:{start,end:Math.max(anchor,head)},text}],selection:{anchor:start+text.length,head:start+text.length}}); },
      }),
      commandRegistry.register({
        id: 'editor.findReplace', title: 'Localizar e substituir',
        isEnabled: () => viewsModel.active()?.type === 'editor',
        run() { const active = viewsModel.active(); if (active?.type !== 'editor') return; paneHandles.get(active.id)?.openSearchPanel(); },
      }),
      commandRegistry.register({
        id: 'template.createDocument', title: 'Criar documento por template',
        isEnabled: () => workspaceId !== undefined,
        run() { setDocumentCreator('article'); },
      }),
      commandRegistry.register({
        id: 'template.createArticle', title: 'Criar artigo', category: 'Autoria', aliases: ['novo artigo', 'artigo acadêmico'],
        isEnabled: () => workspaceId !== undefined,
        run() { setDocumentCreator('article'); },
      }),
      commandRegistry.register({
        id: 'template.createTcc', title: 'Criar TCC', category: 'Autoria', aliases: ['novo tcc', 'trabalho de conclusão'],
        isEnabled: () => workspaceId !== undefined,
        run() { setDocumentCreator('tcc'); },
      }),
      commandRegistry.register({
        id: 'template.createNote', title: 'Criar nota de leitura', category: 'Autoria', aliases: ['nova nota', 'fichamento'],
        isEnabled: () => workspaceId !== undefined,
        run() { setDocumentCreator('reading-note'); },
      }),
      commandRegistry.register({
        id: 'symbol.rename', title: 'Renomear símbolo', isEnabled: () => viewsModel.active()?.type === 'editor',
        async run() { const active=viewsModel.active(); if(active?.type!=='editor')return; const newName=await requestText('Novo identificador/chave'); if(newName===null||newName.trim()==='')return; const result=await window.academic.language.renameSymbol({fileId:active.fileId,offset:active.snapshot.selection.head,newName,expectedRevision:active.snapshot.session.revision}); if(!result.ok) setMessage(result.error.message); else setMessage(result.value === undefined ? 'Nenhum símbolo renomeável nesta posição.' : `${result.value.label} (${result.value.changedFiles.length} documento(s)).`); },
      }),
      commandRegistry.register({
        id: 'document.rename', title: 'Renomear documento', isEnabled: () => viewsModel.active()?.type === 'editor',
        async run() { const active=viewsModel.active(); if(active?.type!=='editor')return; const path=await requestText('Novo caminho no vault', active.path); if(path===null||path.trim()===''||path.trim()===active.path)return; const result=await window.academic.workspace.renameDocument({fileId:active.fileId,path:path.trim(),expectedRevision:active.snapshot.session.revision}); if(!result.ok){setMessage(result.error.message);return;} setMessage(`Documento renomeado para ${result.value.path}.`); },
      }),
      commandRegistry.register({
        id: 'document.copyPath', title: 'Copiar caminho do documento', isEnabled: () => viewsModel.active()?.type === 'editor',
        async run() { const active = viewsModel.active(); if (active?.type !== 'editor') return; try { await navigator.clipboard.writeText(active.path); setMessage('Caminho copiado.'); } catch { setMessage('Não foi possível copiar o caminho.'); } },
      }),
      commandRegistry.register({ id: 'xref.insert', title: 'Inserir referência cruzada', isEnabled: (context) => viewsModel.active()?.type === 'editor' && (context.targetCrossReference !== undefined || true), run(context) { const active=viewsModel.active(); if(active?.type!=='editor')return; if(context.targetCrossReference===undefined){setCrossReferencePicker(true);return;} const {anchor,head}=active.snapshot.selection; const text=`[[ref:${context.targetCrossReference.identifier}]]`; active.controller.dispatch({edits:[{range:{start:Math.min(anchor,head),end:Math.max(anchor,head)},text}],selection:{anchor:Math.min(anchor,head)+text.length,head:Math.min(anchor,head)+text.length}}); } }),
      commandRegistry.register({
        id: 'transclusion.insert', title: 'Inserir referência de bloco', category: 'Autoria', aliases: ['transclusão', 'bloco reutilizável'], isEnabled: () => viewsModel.active()?.type === 'editor',
        async run() { const active = viewsModel.active(); if (active?.type !== 'editor') return; const path = await requestText('Arquivo do bloco', '', { placeholder: 'notes/resultado.md' }); if (path === null || path.trim() === '') return; const id = await requestText('Identificador do bloco', '', { placeholder: 'resultado-principal' }); if (id === null || id.trim() === '') return; let text: string; try { text = blockReference(path.trim(), id.trim()); } catch (error) { setMessage(error instanceof Error ? error.message : 'Referência de bloco inválida.'); return; } const { anchor, head } = active.snapshot.selection; const start = Math.min(anchor, head); active.controller.dispatch({ edits: [{ range: { start, end: Math.max(anchor, head) }, text }], selection: { anchor: start + text.length, head: start + text.length } }); },
      }),
      commandRegistry.register({
        id: 'block.extractSelection', title: 'Extrair seleção para bloco', category: 'Autoria', aliases: ['modularizar', 'nota reutilizável'],
        isEnabled: () => { const active = viewsModel.active(); return active?.type === 'editor' && active.snapshot.selection.anchor !== active.snapshot.selection.head; },
        async run() { const active = viewsModel.active(); if (active?.type !== 'editor') return; const { anchor, head } = active.snapshot.selection; const start = Math.min(anchor, head); const end = Math.max(anchor, head); const destinationPath = await requestText('Novo arquivo do bloco', 'notes/bloco.md'); if (destinationPath === null || destinationPath.trim() === '') return; const title = await requestText('Título do bloco', 'Bloco reutilizável'); if (title === null) return; const blockId = await requestText('Identificador do bloco', 'bloco'); if (blockId === null || blockId.trim() === '') return; let preview; try { preview = previewExtractSelection({ source: active.snapshot.session.content, start, end, destinationPath: destinationPath.trim(), title, blockId: blockId.trim() }); } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível extrair o bloco.'); return; } if (!await requestConfirmation({ title: 'Extrair bloco', description: `Será criado ${preview.destinationPath} e a seleção será substituída por ${preview.replacement}.`, confirmLabel: 'Criar bloco', destructive: false })) return; const created = await window.academic.workspace.createDocument({ path: preview.destinationPath, content: preview.newDocument }); if (!created.ok) { setMessage(created.error.message); return; } active.controller.dispatch({ edits: [{ range: { start, end }, text: preview.replacement }], selection: { anchor: start + preview.replacement.length, head: start + preview.replacement.length } }); setMessage(`Bloco criado em ${created.value.path}.`); },
      }),
      commandRegistry.register({
        id: 'block.mergeModule', title: 'Mesclar módulo no documento', category: 'Autoria', aliases: ['inserir módulo', 'composição'], isEnabled: () => viewsModel.active()?.type === 'editor',
        async run() { const active = viewsModel.active(); if (active?.type !== 'editor') return; const path = await requestText('Arquivo do módulo', '', { placeholder: 'notes/bloco.md' }); if (path === null || path.trim() === '') return; const module = workspaceFiles.find((file) => file.path === path.trim()); if (module === undefined) { setMessage('Arquivo do módulo não encontrado no vault.'); return; } const read = await window.academic.documents.read({ fileId: module.fileId }); if (!read.ok) { setMessage(read.error.message); return; } const offset = active.snapshot.selection.head; let merged: string; try { merged = previewMergeModule(active.snapshot.session.content, read.value.content, offset); } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível preparar a mesclagem.'); return; } const inserted = merged.slice(offset, merged.length - (active.snapshot.session.content.length - offset)); if (!await requestConfirmation({ title: 'Mesclar módulo', description: `Prévia: ${inserted.slice(0, 180)}${inserted.length > 180 ? '…' : ''}`, confirmLabel: 'Inserir módulo', destructive: false })) return; active.controller.dispatch({ edits: [{ range: { start: offset, end: offset }, text: inserted }], selection: { anchor: offset + inserted.length, head: offset + inserted.length } }); },
      }),
      commandRegistry.register({
        id: 'template.createModularTcc', title: 'Criar TCC modular',
        async run() {
          const directory = await requestText('Pasta do TCC modular no vault', 'tcc'); if (directory === null || directory.trim() === '') return;
          const templates = modularTccTemplate(directory.trim()); const existing = new Set(files.map((file) => file.path));
          const collision = templates.find((file) => existing.has(file.path)); if (collision !== undefined) { setMessage(`Já existe um arquivo em ${collision.path}; escolha outra pasta.`); return; }
          let root: WorkspaceFileDto | undefined;
          for (const file of templates) { const created = await window.academic.workspace.createDocument(file); if (!created.ok) { setMessage(created.error.message); return; } if (file.path.endsWith('/index.md')) root = created.value; }
          if (root !== undefined) await openDocument(root.fileId, root.path);
        },
      }),
      commandRegistry.register({
        id: 'citation.editAtSelection',
        title: 'Editar citação na seleção',
        isEnabled: () => {
          const active = viewsModel.active();
          return active?.type === 'editor' && editableCitationAt(active.snapshot.session.content, active.snapshot.selection.head) !== undefined;
        },
        run() {
          const active = viewsModel.active();
          if (active?.type !== 'editor') return;
          const current = editableCitationAt(active.snapshot.session.content, active.snapshot.selection.head);
          if (current === undefined) return;
          setCitationEditor({ initial: current.draft, range: current.range });
        },
      }),
    ];
    return () => unregister.forEach((off) => off());
    // `files` só participa da disponibilidade do Quick Open; registrar de novo
    // quando o vault muda preserva o mesmo registry usado por menus/atalhos.
  }, [activeLayout, commandRegistry, files, focusMode, hasLayoutCustomization, pluginContributions, workspaceId, workspaceMacros]);

  useEffect(
    () =>
      registerKeybindings({
        registry: commandRegistry,
        bindings: keybindings,
        context: () => commandContextForPalette(viewsModel.active()),
        target: window,
      }),
    [commandRegistry, keybindings, viewsModel],
  );

  const renderEditorDocument = (view: Extract<ViewState, { type: 'editor' }>): JSX.Element => {
    const handleCommand = (commandId: string): void => { viewsModel.activate(view.id); void commandRegistry.execute(commandId, {}).catch(() => setMessage('Não foi possível executar a ação de formatação.')); };
    return (
      <EditorDocumentPane
        key={view.id}
        view={view}
        {...(view.id === activeEditorView?.id && writingStatistics !== undefined ? { statistics: writingStatistics } : {})}
        onError={setMessage}
        onDefinition={showDefinition}
        onReferences={(locations) => { if (locations.length === 0) setMessage('Nenhuma referência encontrada nesta posição.'); else setReferenceLocations(locations); }}
        onContextMenu={({ offset, x, y, selection }) => { viewsModel.activate(view.id); view.controller.dispatch({ selection }); viewsModel.updateSnapshot(view.fileId, view.controller.snapshot()); setEditorContextMenu({ viewId: view.id, offset, x, y, selection }); }}
        onAssetDropped={(uri, name) => { const offset = view.controller.snapshot().selection.head; const text = `\n\n${figureSource({ uri, alt: name.replace(/\.[^.]+$/u, ''), caption: '', source: '' })}\n\n`; view.controller.dispatch({ edits: [{ range: { start: offset, end: offset }, text }], selection: { anchor: offset + text.length, head: offset + text.length } }); }}
        onKeepLocal={() => { void view.controller.resolveExternalConflict('keep-local').then(() => setMessage('Rascunho local mantido. Salve para aplicá-lo ao arquivo.')).catch(() => setMessage('Não foi possível manter o rascunho local.')); }}
        onReloadExternal={() => { void view.controller.resolveExternalConflict('reload-external').then(() => setMessage('Rascunho local descartado; versão externa recarregada.')).catch(() => setMessage('Não foi possível recarregar a versão externa.')); }}
        onCommand={handleCommand}
        slashCommands={{ list: (query) => slashCommandList(commandRegistry, query), execute: handleCommand }}
        paneHandleRef={(handle) => { if (handle === null) paneHandles.delete(view.id); else paneHandles.set(view.id, handle); }}
      />
    );
  };

  return (
    <main className="folio-shell grid h-screen overflow-hidden text-[14px]" style={{ gridTemplateColumns: shellGridColumns }}>
      {activeLayout.showNavigation && <aside className={`folio-sidebar flex min-h-0 flex-col border-r ${sidebarCollapsed ? 'items-center gap-3 px-2 py-4' : 'p-4'}`}>
        {sidebarCollapsed ? <>
          <button type="button" aria-label="Expandir sidebar" title="Expandir sidebar" className="folio-control grid h-9 w-9 place-items-center rounded-xl" onClick={() => setSidebarCollapsed(false)}><FolioIcon name="forward" /></button>
          <button type="button" disabled={workspaceId === undefined} aria-label="Abrir Home" title="Home" className="folio-control grid h-9 w-9 place-items-center rounded-xl disabled:opacity-40" onClick={() => setHomeOpen(true)}><FolioIcon name="home" /></button>
          <button type="button" disabled={workspaceId === undefined} aria-label="Criar documento" title="Criar documento" className="folio-primary grid h-9 w-9 place-items-center rounded-xl disabled:opacity-40" onClick={() => void commandRegistry.execute('template.createDocument', {})}><FolioIcon name="add" /></button>
          <button type="button" disabled={workspaceId === undefined} aria-label="Expandir explorador de arquivos" title="Expandir explorador de arquivos" className="folio-control grid h-9 w-9 place-items-center rounded-xl disabled:opacity-40" onClick={() => void commandRegistry.execute('explorer.toggleExpanded', {})}><FolioIcon name="folder" /></button>
          <button type="button" disabled={workspaceId === undefined} aria-label="Buscar no vault" title="Buscar no vault" className={`folio-control grid h-9 w-9 place-items-center rounded-xl disabled:opacity-40 ${searchSidebarOpen ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : ''}`} onClick={() => void commandRegistry.execute('search.openSidebar', {})}><FolioIcon name="search" /></button>
          <button type="button" disabled={workspaceId === undefined} aria-label="Importar pesquisa" title="Importar pesquisa" className="folio-control grid h-9 w-9 place-items-center rounded-xl disabled:opacity-40" onClick={() => void commandRegistry.execute('research.intake', {})}><FolioIcon name="add" /></button>
          <button type="button" disabled={workspaceId === undefined} aria-label="Abrir biblioteca de referências" title="Biblioteca" className="folio-control grid h-9 w-9 place-items-center rounded-xl disabled:opacity-40" onClick={() => void commandRegistry.execute('library.manage', {})}><FolioIcon name="citation" /></button>
          <button type="button" disabled={workspaceId === undefined} aria-label="Abrir projetos de pesquisa" title="Projetos" className="folio-control grid h-9 w-9 place-items-center rounded-xl disabled:opacity-40" onClick={() => void commandRegistry.execute('projects.open', {})}><FolioIcon name="review" /></button>
          <button type="button" disabled={workspaceId === undefined} aria-label="Abrir inbox de capturas" title="Capturas" className="folio-control grid h-9 w-9 place-items-center rounded-xl disabled:opacity-40" onClick={() => void commandRegistry.execute('capture.inbox', {})}><FolioIcon name="inbox" /></button>
          <button type="button" disabled={workspaceId === undefined} aria-label="Abrir canvas de pesquisa" title="Canvas de pesquisa" className="folio-control grid h-9 w-9 place-items-center rounded-xl disabled:opacity-40" onClick={() => void commandRegistry.execute('research.canvas', {})}><FolioIcon name="xref" /></button>
          <button type="button" disabled={workspaceId === undefined} aria-label="Abrir integrações de submissão" title="Submissão" className="folio-control grid h-9 w-9 place-items-center rounded-xl disabled:opacity-40" onClick={() => void commandRegistry.execute('submission.integrations', {})}><FolioIcon name="download" /></button>
          <div className="mt-auto grid gap-3">
            <button type="button" aria-label="Abrir configurações" title="Configurações" className="folio-control grid h-9 w-9 place-items-center rounded-xl" onClick={() => setSettingsOpen(true)}><FolioIcon name="settings" /></button>
            <button type="button" aria-label="Abrir vault" title="Abrir vault" className="folio-control grid h-9 w-9 place-items-center rounded-xl" onClick={() => void commandRegistry.execute('workspace.open', {})}><FolioIcon name="folder" /></button>
          </div>
        </> : <>
        <div className="mb-7 flex items-center gap-3 px-1">
          <div className="min-w-0 flex-1"><FolioLogo size={40} /></div>
          <button type="button" aria-label="Comprimir sidebar" title="Comprimir sidebar" className="folio-control grid h-8 w-8 place-items-center rounded-lg" onClick={() => { setFileExplorerExpanded(false); setSearchSidebarOpen(false); setSidebarCollapsed(true); }}><FolioIcon name="back" /></button>
        </div>
        <button
          type="button"
          className="folio-control mb-3 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium"
          onClick={() => void commandRegistry.execute('palette.commands', paletteContext)}
        >
          <span className="flex items-center gap-2"><FolioIcon name="command" className="h-4 w-4 text-indigo-600" /> Command Palette</span><kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">Ctrl Shift P</kbd>
        </button>
        <nav aria-label="Navegação principal" className="mb-2 grid gap-2">
          <button type="button" disabled={workspaceId === undefined} className="folio-control flex h-10 w-full items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold disabled:opacity-40" onClick={() => setHomeOpen(true)}><FolioIcon name="home" className="h-4 w-4 text-indigo-600" />Home</button>
        </nav>
        <div className="mb-5 grid gap-2">
          <button type="button" disabled={workspaceId === undefined} className="folio-primary flex h-10 w-full items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold disabled:opacity-40" onClick={() => void commandRegistry.execute('template.createDocument', {})}><FolioIcon name="add" className="h-4 w-4" />Criar documento</button>
          <button type="button" disabled={workspaceId === undefined} className={`folio-control flex h-10 w-full items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold disabled:opacity-40 ${fileExplorerExpanded ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : ''}`} onClick={() => void commandRegistry.execute('explorer.toggleExpanded', {})}><FolioIcon name="panel" className="h-4 w-4 text-indigo-600" />Arquivos</button>
          <button type="button" disabled={workspaceId === undefined} className={`folio-control flex h-10 w-full items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold disabled:opacity-40 ${searchSidebarOpen ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : ''}`} onClick={() => void commandRegistry.execute('search.openSidebar', {})}><FolioIcon name="search" className="h-4 w-4 text-indigo-600" />Buscar no vault</button>
          <button type="button" disabled={workspaceId === undefined} className="folio-control flex h-10 w-full items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold disabled:opacity-40" onClick={() => void commandRegistry.execute('research.intake', {})}><FolioIcon name="add" className="h-4 w-4 text-indigo-600" />Importar pesquisa</button>
        </div>
        <div className="mb-5 grid gap-2 border-t border-slate-200 pt-4">
          <p className="px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Pesquisa</p>
          <button type="button" disabled={workspaceId === undefined} className="folio-control flex h-10 w-full items-center gap-2 rounded-xl px-3 text-sm font-semibold disabled:opacity-40" onClick={() => void commandRegistry.execute('library.manage', {})}><FolioIcon name="citation" className="h-4 w-4 text-indigo-600" />Biblioteca</button>
          <button type="button" disabled={workspaceId === undefined} className="folio-control flex h-10 w-full items-center gap-2 rounded-xl px-3 text-sm font-semibold disabled:opacity-40" onClick={() => void commandRegistry.execute('projects.open', {})}><FolioIcon name="review" className="h-4 w-4 text-indigo-600" />Projetos</button>
          <button type="button" disabled={workspaceId === undefined} className="folio-control flex h-10 w-full items-center gap-2 rounded-xl px-3 text-sm font-semibold disabled:opacity-40" onClick={() => void commandRegistry.execute('capture.inbox', {})}><FolioIcon name="inbox" className="h-4 w-4 text-indigo-600" />Capturas</button>
          <button type="button" disabled={workspaceId === undefined} className="folio-control flex h-10 w-full items-center gap-2 rounded-xl px-3 text-sm font-semibold disabled:opacity-40" onClick={() => void commandRegistry.execute('research.canvas', {})}><FolioIcon name="xref" className="h-4 w-4 text-indigo-600" />Canvas</button>
          <button type="button" disabled={workspaceId === undefined} className="folio-control flex h-10 w-full items-center gap-2 rounded-xl px-3 text-sm font-semibold disabled:opacity-40" onClick={() => void commandRegistry.execute('submission.integrations', {})}><FolioIcon name="download" className="h-4 w-4 text-indigo-600" />Submissão</button>
        </div>
        <div className="mt-auto grid gap-2 border-t border-slate-200 pt-4">
          <button type="button" className="folio-control flex h-10 w-full items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold" onClick={() => setSettingsOpen(true)}><FolioIcon name="settings" className="h-4 w-4 text-indigo-600" />Configurações</button>
          <button type="button" className="folio-control flex h-10 w-full items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold disabled:cursor-wait disabled:opacity-60" disabled={openingVault} onClick={() => void commandRegistry.execute('workspace.open', {}).catch(() => setMessage('O comando de abrir vault ainda não está disponível.'))}><FolioIcon name="folder" className="h-4 w-4 text-indigo-600" />{openingVault ? 'Abrindo seletor…' : 'Abrir vault'}</button>
        </div>
      </>}</aside>}
      {explorerExpandedVisible && (
        <aside className="folio-sidebar flex min-h-0 flex-col border-r p-4">
          <WorkspaceFileExplorer
            files={workspaceFiles}
            {...(activeEditorView === undefined ? {} : { activeFileId: activeEditorView.fileId })}
            hasActiveEditor={activeEditorView !== undefined}
            onOpenFile={(file) => void openWorkspaceFile(file)}
            onOpenFileInSplit={(file) => void openDocumentInSplit(file.fileId, file.path)}
            onRenameFile={renameWorkspaceFile}
            onMoveFile={moveWorkspaceFile}
            onMoveFilePrompt={moveWorkspaceFilePrompt}
            onDuplicateFile={duplicateWorkspaceFile}
            expanded
            onToggleExpanded={() => void commandRegistry.execute('explorer.toggleExpanded', {})}
            onCreate={() => void commandRegistry.execute('template.createDocument', {})}
            onCreateFolder={createWorkspaceFolder}
          />
        </aside>
      )}
      {searchSidebarVisible && (
        <WorkspaceSearchSidebar
          query={searchQuery}
          results={searchResults}
          onQueryChange={setSearchQuery}
          onClose={() => setSearchSidebarOpen(false)}
          onOpenFile={(result) => {
            setSearchSidebarOpen(false);
            void commandRegistry.execute('document.open', { targetFile: { fileId: result.fileId, path: result.path } });
          }}
        />
      )}
      {(explorerExpandedVisible || searchSidebarVisible) && <div role="separator" aria-orientation="vertical" aria-label="Redimensionar explorador" tabIndex={0} className="folio-panel-resizer" onPointerDown={(event) => beginPanelResize('explorer', event)} />}
      <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] bg-white/50">
        <div className="folio-contextbar flex min-h-14 items-center gap-2 overflow-hidden border-b px-3" role="tablist" aria-label="Documentos abertos">
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-2">
          {views.map((view) => (
            <div
              draggable
              onDragStart={(event) => { setDraggedTabId(view.id); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', String(view.id)); }}
              onDragEnd={() => setDraggedTabId(undefined)}
              onDragOver={(event) => { if (draggedTabId !== undefined && draggedTabId !== view.id) event.preventDefault(); }}
              onDrop={(event) => { event.preventDefault(); if (draggedTabId !== undefined) viewsModel.reorder(draggedTabId, view.id); setDraggedTabId(undefined); }}
              className={`flex shrink-0 items-center rounded-lg ${draggedTabId === view.id ? 'opacity-45' : ''} ${view.id === activeId ? 'folio-tab-active' : 'text-slate-500 hover:bg-slate-100'}`}
              key={view.id}
            >
              <button
                type="button"
                className="rounded-none bg-transparent px-2.5 py-2 text-sm whitespace-nowrap"
                onClick={() => { setHomeOpen(false); viewsModel.activate(view.id); if (view.type === 'editor') markFileAsRecent(view.fileId); }}
              >
                {view.type === 'preview' ? `◎ ${view.path}` : view.path}
                {view.type === 'editor' && view.snapshot.session.dirty ? ' •' : ''}
              </button>
              <button
                type="button"
                className="rounded-r-lg bg-transparent px-2 py-2 text-slate-400 hover:bg-slate-100 hover:text-slate-900"
                aria-label={`Fechar ${view.path}`}
                onClick={() => void closeTab(view.id)}
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={workspaceId === undefined}
            aria-label="Criar documento"
            title="Criar documento"
            className="folio-control ml-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-lg font-medium disabled:opacity-40"
            onClick={() => void commandRegistry.execute('template.createDocument', {})}
          >
            +
          </button>
          </div>
          {!homeOpen && <div className="flex shrink-0 items-center gap-1.5 border-l border-slate-200 pl-3">
            <span className="mr-0.5 h-6 w-px bg-slate-200" aria-hidden="true" />
            <button
              type="button"
              className="folio-control inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-xs font-semibold disabled:cursor-default disabled:opacity-40"
              disabled={activeEditorView === undefined}
              onClick={() => activeEditorView !== undefined && void commandRegistry.execute('publication.preview', { targetFile: { fileId: activeEditorView.fileId, path: activeEditorView.path } })}
            >
              <ToolbarIcon name="preview" /> Preview
            </button>
            <button
              type="button"
              aria-pressed={splitPreview}
              className={`inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-xs font-semibold disabled:cursor-default disabled:opacity-40 ${
                splitPreview && activeEditorView !== undefined
                  ? 'border border-indigo-200 bg-indigo-100 text-indigo-700'
                  : 'folio-control'
              }`}
              disabled={activeEditorView === undefined}
              onClick={() =>
                activeEditorView !== undefined &&
                void commandRegistry.execute('view.toggleSplitPreview', { activeViewId: activeEditorView.id })
              }
            >
              <ToolbarIcon name="split" /> Lado a lado
            </button>
            <button
              type="button"
              ref={moreActionsButton}
              aria-expanded={moreActionsOpen}
              aria-label="Mais ações"
              title="Mais ações"
              className="folio-control grid h-8 w-8 place-items-center rounded-lg"
              onClick={() => setMoreActionsOpen((open) => !open)}
            >
              <FolioIcon name="more" className="h-4 w-4" />
            </button>
          </div>}
        </div>
        {homeOpen && workspaceId !== undefined ? (
          <WorkspaceHome
            workspaceId={workspaceId}
            files={files}
            recentFileIds={recentFileIds}
            activities={workspaceActivity}
            onboardingVisible={onboardingVisible}
            pluginHomeBlocks={pluginContributions.filter((plugin) => plugin.enabled).flatMap((plugin) => plugin.homeBlocks.map((block) => ({ pluginId: plugin.id, ...block })))}
            onOpenFile={(fileId, path) => void openDocument(fileId, path)}
            onCommand={(id) => {
              const next = id === 'writing.open' && activeEditorView === undefined ? 'template.createDocument' : id;
              void commandRegistry.execute(next, paletteContext).catch(() => setMessage('Não foi possível executar a ação.'));
            }}
            onDismissOnboarding={() => { window.localStorage.setItem(onboardingStorageKey(workspaceId), 'done'); setOnboardingVisible(false); }}
          />
        ) : activeView === undefined ? (
          <div className="grid place-items-center bg-[radial-gradient(circle_at_center,_#eef2ff,_transparent_55%)] px-8 text-center">
            <div className="max-w-md"><div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200"><FolioIcon name="command" className="h-6 w-6" /></div><h1 className="text-lg font-bold tracking-tight text-slate-900">Pronto para escrever</h1><p className="mt-2 text-sm leading-6 text-slate-500">Abra um documento do vault ou use a Command Palette para começar.</p></div>
          </div>
        ) : activeView.type === 'editor' ? (
          <div className="flex min-h-0 min-w-0 flex-1">
            {splitEditorViews.length === 2 ? (
              <ResizableSplit
                label="Redimensionar editores lado a lado"
                left={renderEditorDocument(splitEditorViews[0]!)}
                right={renderEditorDocument(splitEditorViews[1]!)}
              />
            ) : splitPreviewView !== undefined ? (
              <ResizableSplit
                label="Redimensionar editor e preview"
                left={renderEditorDocument(activeView)}
                right={<PreviewPane view={splitPreviewView} split />}
              />
            ) : renderEditorDocument(activeView)}
          </div>
        ) : (
          <PreviewPane view={activeView} />
        )}
      </section>
      {activeLayout.showContext && <div role="separator" aria-orientation="vertical" aria-label="Redimensionar contexto" tabIndex={0} className="folio-panel-resizer" onPointerDown={(event) => beginPanelResize('context', event)} />}
      {activeLayout.showContext && <aside className={`folio-panel folio-context-panel flex min-h-0 flex-col border-l ${contextCollapsed ? 'items-center gap-3 px-2 py-4' : 'gap-4 p-4'}`}>
        {contextCollapsed ? <>
          <button type="button" aria-label="Expandir contexto" title="Expandir contexto" className="folio-context-collapse folio-control grid h-9 w-9 place-items-center rounded-xl" onClick={() => setContextCollapsed(false)}><FolioIcon name="back" /></button>
          <div title="Contexto" className="folio-context-mark grid h-9 w-9 place-items-center rounded-xl"><FolioIcon name="panel" /></div>
        </> : <>
        <header className="folio-context-header">
          <div className="flex min-w-0 items-center gap-3">
            <div className="folio-context-mark grid h-10 w-10 shrink-0 place-items-center rounded-xl"><FolioIcon name="panel" className="h-5 w-5" /></div>
            <div className="min-w-0"><h2 className="truncate text-sm font-bold text-slate-900">Contexto</h2><p className="truncate text-[11px] text-slate-500">{homeOpen ? 'Visão geral do workspace' : activeEditorView === undefined ? 'Selecione um documento para detalhes' : activeEditorView.path}</p></div>
          </div>
          <button type="button" aria-label="Comprimir contexto" title="Comprimir contexto" className="folio-context-collapse folio-control grid h-8 w-8 shrink-0 place-items-center rounded-lg" onClick={() => setContextCollapsed(true)}><FolioIcon name="forward" /></button>
        </header>
        <div className="folio-context-tabs" role="tablist" aria-label="Painéis">
          {panelRegistry.list().map((panel) => (
            <button
              key={panel.id}
              type="button"
              className={`folio-context-tab ${
                panel.id === activePanelId ? 'folio-context-tab-active' : ''
              }`}
              onClick={() => setActivePanelId(panel.id)}
            >
              {panel.title}
            </button>
          ))}
        </div>
        <section className="folio-context-content min-h-0 flex-1 overflow-auto" aria-label={activePanel?.title ?? 'Conteúdo de contexto'}>
          {activePanel !== undefined && <div className="folio-context-content-label"><span>{activePanel.title}</span><span>{homeOpen ? 'Workspace' : 'Documento'}</span></div>}
          {activePanel && (
            <activePanel.render
              view={contextualEditorView}
              openDocument={(fileId, path) => void openDocument(fileId, path)}
              insertCitation={(id) => void commandRegistry.execute('citation.insert', { targetReference: { id } })}
              createLiteratureNote={(id) =>
                void commandRegistry.execute('reference.createLiteratureNote', {
                  targetReference: { id },
                  ...(activeEditorView !== undefined ? { activeFileId: activeEditorView.fileId } : {}),
                })
              }
              linkifyMention={(mention) => void commandRegistry.execute('mention.linkify', { targetMention: mention })}
              moveOutlineSection={(offset, direction) => { if (activeEditorView === undefined) return; void window.academic.language.moveSection({ fileId: activeEditorView.fileId, offset, direction, expectedRevision: activeEditorView.snapshot.session.revision }).then((result) => setMessage(result.ok ? (result.value?.label ?? 'Não há seção irmã nessa direção.') : result.error.message)); }}
              renameOutlineSection={(offset, title) => { if (activeEditorView === undefined) return; void window.academic.language.renameSymbol({ fileId: activeEditorView.fileId, offset, newName: title, expectedRevision: activeEditorView.snapshot.session.revision }).then((result) => setMessage(result.ok ? (result.value?.label ?? 'Não foi possível renomear a seção.') : result.error.message)); }}
            />
          )}
        </section>
        <div className={`folio-context-status ${message === undefined ? 'folio-context-status-idle' : ''}`} role="status"><span className="folio-context-status-dot" />{message ?? (activePanel === undefined ? 'Escolha um painel para começar.' : 'Contexto sincronizado.')}</div>
        </>}
      </aside>}
      {editorContextMenu !== undefined && (() => {
        const view = views.find((candidate) => candidate.id === editorContextMenu.viewId && candidate.type === 'editor');
        if (view === undefined || view.type !== 'editor') return null;
        const citation = editableCitationAt(view.snapshot.session.content, editorContextMenu.offset);
        const close = (): void => setEditorContextMenu(undefined);
        const run = (commandId: string): void => { close(); viewsModel.activate(view.id); void commandRegistry.execute(commandId, {}).catch(() => setMessage('Não foi possível executar a ação do editor.')); };
        const hasSelection = editorContextMenu.selection.anchor !== editorContextMenu.selection.head;
        const openSubmenu = (submenu: 'format' | 'paragraph' | 'insert'): void => setEditorContextMenu((current) => current === undefined ? undefined : { ...current, submenu });
        const backToRoot = (): void => setEditorContextMenu((current) => {
          if (current === undefined) return undefined;
          const { submenu: _submenu, ...root } = current;
          return root;
        });
        const menuStyle = { left: Math.max(8, Math.min(editorContextMenu.x, window.innerWidth - 252)), top: Math.max(8, Math.min(editorContextMenu.y, window.innerHeight - 350)) };
        if (editorContextMenu.submenu === 'format') return <div ref={editorContextMenuHost} className="folio-actions-menu folio-file-menu folio-editor-context-menu fixed z-50" role="menu" aria-label="Formatar seleção" style={menuStyle}>
          <FileMenuItem icon="back" onClick={backToRoot}>Voltar</FileMenuItem><div className="folio-file-menu-separator" />
          <FileMenuItem icon="bold" onClick={() => run('editor.format.bold')}>Negrito</FileMenuItem>
          <FileMenuItem icon="italic" onClick={() => run('editor.format.italic')}>Itálico</FileMenuItem>
          <FileMenuItem icon="code" onClick={() => run('editor.format.code')}>Código em linha</FileMenuItem>
          <FileMenuItem icon="strike" onClick={() => run('editor.format.strike')}>Tachado</FileMenuItem>
        </div>;
        if (editorContextMenu.submenu === 'paragraph') return <div ref={editorContextMenuHost} className="folio-actions-menu folio-file-menu folio-editor-context-menu fixed z-50" role="menu" aria-label="Formatar parágrafo" style={menuStyle}>
          <FileMenuItem icon="back" onClick={backToRoot}>Voltar</FileMenuItem><div className="folio-file-menu-separator" />
          <FileMenuItem icon="heading1" onClick={() => run('editor.paragraph.heading1')}>Título 1</FileMenuItem>
          <FileMenuItem icon="heading2" onClick={() => run('editor.paragraph.heading2')}>Título 2</FileMenuItem>
          <FileMenuItem icon="quote" onClick={() => run('editor.paragraph.quote')}>Citação em bloco</FileMenuItem>
          <FileMenuItem icon="list" onClick={() => run('editor.paragraph.list')}>Lista</FileMenuItem>
        </div>;
        if (editorContextMenu.submenu === 'insert') return <div ref={editorContextMenuHost} className="folio-actions-menu folio-file-menu folio-editor-context-menu fixed z-50" role="menu" aria-label="Inserir no documento" style={menuStyle}>
          <FileMenuItem icon="back" onClick={backToRoot}>Voltar</FileMenuItem><div className="folio-file-menu-separator" />
          {citation !== undefined && <FileMenuItem icon="edit" onClick={() => { close(); setCitationEditor({ initial: citation.draft, range: citation.range }); }}>Editar citação</FileMenuItem>}
          <FileMenuItem icon="citation" onClick={() => run('citation.openPicker')}>Citação</FileMenuItem>
          <FileMenuItem icon="xref" onClick={() => run('xref.insert')}>Referência cruzada</FileMenuItem>
          <FileMenuItem icon="image" onClick={() => run('figure.insert')}>Figura</FileMenuItem>
          <FileMenuItem icon="table" onClick={() => run('table.insert')}>Tabela</FileMenuItem>
          <FileMenuItem icon="equation" onClick={() => run('math.insertEquation')}>Equação</FileMenuItem>
          <FileMenuItem icon="embed" onClick={() => run('transclusion.insert')}>Documento ou seção</FileMenuItem>
        </div>;
        return <div ref={editorContextMenuHost} className="folio-actions-menu folio-file-menu folio-editor-context-menu fixed z-50" role="menu" aria-label="Ações do editor" style={menuStyle}>
          <FileMenuItem icon="link" onClick={() => run('link.insert')}>Adicionar link</FileMenuItem>
          <FileMenuItem icon="externalLink" onClick={() => run('link.insertExternal')}>Adicionar link externo</FileMenuItem>
          <div className="folio-file-menu-separator" />
          <FileMenuItem icon="format" onClick={() => openSubmenu('format')}>Formatar <span className="ml-auto">›</span></FileMenuItem>
          <FileMenuItem icon="paragraph" onClick={() => openSubmenu('paragraph')}>Parágrafo <span className="ml-auto">›</span></FileMenuItem>
          <FileMenuItem icon="insert" onClick={() => openSubmenu('insert')}>Inserir <span className="ml-auto">›</span></FileMenuItem>
          <div className="folio-file-menu-separator" />
          <FileMenuItem icon="cut" disabled={!hasSelection} onClick={() => run('editor.cut')}>Recortar</FileMenuItem>
          <FileMenuItem icon="copy" disabled={!hasSelection} onClick={() => run('editor.copy')}>Copiar</FileMenuItem>
          <FileMenuItem icon="paste" onClick={() => run('editor.paste')}>Colar</FileMenuItem>
          <FileMenuItem icon="paste" onClick={() => run('editor.paste')}>Colar como texto simples</FileMenuItem>
          <FileMenuItem icon="selectAll" onClick={() => run('editor.selectAll')}>Selecionar tudo</FileMenuItem>
          <div className="folio-file-menu-separator" />
          <FileMenuItem icon="edit" onClick={() => run('symbol.rename')}>Renomear símbolo</FileMenuItem>
        </div>;
      })()}
      {!homeOpen && moreActionsOpen && (() => {
        const anchor = moreActionsButton.current?.getBoundingClientRect();
        const menuWidth = 248;
        const moreActionsMenuStyle = anchor === undefined ? undefined : {
          left: Math.max(8, Math.min(anchor.right - menuWidth, window.innerWidth - menuWidth - 8)),
          top: Math.min(anchor.bottom + 6, window.innerHeight - 8),
        };
        return (
        <div ref={moreActionsMenu} className="folio-actions-menu folio-file-menu fixed z-40" style={moreActionsMenuStyle} role="menu" aria-label="Ações do documento">
          <div className="folio-file-menu-title"><span className="truncate">{activeEditorView?.path ?? 'Workspace'}</span></div>
          <FileMenuItem icon="citation" disabled={activeEditorView === undefined} onClick={() => { setMoreActionsOpen(false); void commandRegistry.execute('citation.insert', {}); }}>Inserir citação</FileMenuItem>
          <FileMenuItem icon="xref" disabled={activeEditorView === undefined} onClick={() => { setMoreActionsOpen(false); void commandRegistry.execute('xref.insert', {}); }}>Inserir referência cruzada</FileMenuItem>
          <FileMenuItem icon="inbox" disabled={activeEditorView === undefined} onClick={() => { setMoreActionsOpen(false); void commandRegistry.execute('capture.selection', {}); }}>Capturar seleção</FileMenuItem>
          <div className="folio-file-menu-separator" />
          <FileMenuItem icon="split" disabled={activeEditorView === undefined} onClick={() => { setMoreActionsOpen(false); void commandRegistry.execute('view.splitEditor', {}); }}>Abrir editor ao lado</FileMenuItem>
          <FileMenuItem icon="search" disabled={activeEditorView === undefined} onClick={() => { setMoreActionsOpen(false); void commandRegistry.execute('editor.findReplace', {}); }}>Localizar e substituir</FileMenuItem>
          <FileMenuItem icon="backlinks" disabled={activeEditorView === undefined} onClick={() => { setMoreActionsOpen(false); void commandRegistry.execute('document.backlinks', {}); }}>Backlinks do documento</FileMenuItem>
          <FileMenuItem icon="problem" disabled={activeEditorView === undefined} onClick={() => { setMoreActionsOpen(false); void commandRegistry.execute('diagnostics.openCenter', {}); }}>Diagnósticos acadêmicos</FileMenuItem>
          <FileMenuItem icon="format" disabled={activeEditorView === undefined} onClick={() => { setMoreActionsOpen(false); void commandRegistry.execute('writing.open', {}); }}>Ferramentas de escrita</FileMenuItem>
          <FileMenuItem icon="edit" disabled={activeEditorView === undefined} onClick={() => { setMoreActionsOpen(false); void commandRegistry.execute('document.rename', {}); }}>Renomear ou mover…</FileMenuItem>
          <FileMenuItem icon="metadata" disabled={activeEditorView === undefined} onClick={() => { setMoreActionsOpen(false); void commandRegistry.execute('metadata.edit', {}); }}>Editar metadados</FileMenuItem>
          <FileMenuItem icon="metadata" disabled={activeEditorView === undefined} onClick={() => { setMoreActionsOpen(false); void commandRegistry.execute('page.enable', {}); }}>Usar como página</FileMenuItem>
          <FileMenuItem icon="copy" disabled={activeEditorView === undefined} onClick={() => { setMoreActionsOpen(false); void commandRegistry.execute('document.copyPath', {}); }}>Copiar caminho</FileMenuItem>
          <div className="folio-file-menu-separator" />
          <FileMenuItem icon="history" disabled={activeEditorView === undefined} onClick={() => { setMoreActionsOpen(false); void commandRegistry.execute('document.history', {}); }}>Histórico do documento</FileMenuItem>
          <FileMenuItem icon="compare" disabled={files.length < 2} onClick={() => { setMoreActionsOpen(false); void commandRegistry.execute('document.compare', {}); }}>Comparar documentos</FileMenuItem>
          <FileMenuItem icon="review" disabled={workspaceId === undefined} onClick={() => { setMoreActionsOpen(false); void commandRegistry.execute('review.open', {}); }}>Revisar documento</FileMenuItem>
          <div className="folio-file-menu-separator" />
          <FileMenuItem icon="profile" disabled={activeEditorView === undefined} onClick={() => { setMoreActionsOpen(false); void commandRegistry.execute('profile.select', {}); }}>Perfil de publicação</FileMenuItem>
          <FileMenuItem icon="download" disabled={activeView === undefined} onClick={() => { setMoreActionsOpen(false); if (activeView !== undefined) void commandRegistry.execute('document.exportPdf', { activeViewId: activeView.id }); }}>Exportar PDF…</FileMenuItem>
          <FileMenuItem icon="download" disabled={activeView === undefined} onClick={() => { setMoreActionsOpen(false); if (activeView !== undefined) void commandRegistry.execute('document.exportDocx', { activeViewId: activeView.id }); }}>Exportar DOCX…</FileMenuItem>
          <div className="folio-file-menu-separator" />
          <FileMenuItem icon="command" onClick={() => { setMoreActionsOpen(false); void commandRegistry.execute('palette.commands', {}); }}>Todas as ações…</FileMenuItem>
        </div>
        );
      })()}
      {systemInformation !== undefined && <SystemInformationDialog information={systemInformation} onClose={() => setSystemInformation(undefined)} />}
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} onOpen={(command) => { void commandRegistry.execute(command, paletteContext).catch(() => setMessage('Não foi possível abrir esta configuração.')); }} />}
      {syncOpen && <SyncDialog onClose={() => setSyncOpen(false)} onMessage={setMessage} />}
      {submissionIntegrationsOpen && <SubmissionIntegrationsDialog onClose={() => setSubmissionIntegrationsOpen(false)} onMessage={setMessage} />}
      {collaborationOpen && <CollaborationDialog onClose={() => setCollaborationOpen(false)} onMessage={setMessage} />}
      {referenceLocations !== undefined && <LocationsDialog locations={referenceLocations} onNavigate={(location) => void navigateToLocation(location)} onClose={() => setReferenceLocations(undefined)} />}
      {paletteMode !== undefined && (
        <PaletteDialog
          mode={paletteMode}
          files={files}
          recentFileIds={recentFileIds}
          commandRegistry={commandRegistry}
          commandContext={paletteContext}
          shortcuts={shortcutByCommand}
          recentCommandIds={recentCommandIds}
          onClose={() => setPaletteMode(undefined)}
          onCommand={(id) => {
            setPaletteMode(undefined);
            setRecentCommandIds((current) => [id, ...current.filter((candidate) => candidate !== id)].slice(0, 12));
            void commandRegistry.execute(id, paletteContext).catch(() => setMessage('Não foi possível executar o comando.'));
          }}
          onOpenFile={(fileId, path) => {
            setPaletteMode(undefined);
            void commandRegistry.execute('document.open', { targetFile: { fileId, path } });
          }}
        />
      )}
      {splitEditorPicker && (
        <SplitEditorDialog
          files={files}
          onClose={() => setSplitEditorPicker(false)}
          onOpen={(file) => { setSplitEditorPicker(false); void openDocumentInSplit(file.fileId, file.path); }}
        />
      )}
      {searchViewOpen && <SearchViewDialog
        query={searchQuery}
        results={searchResults}
        commandRegistry={commandRegistry}
        commandContext={paletteContext}
        onQueryChange={setSearchQuery}
        onClose={() => setSearchViewOpen(false)}
      />}
      {reviewMode && workspaceId !== undefined && <ReviewWorkspaceDialog
        workspaceId={workspaceId}
        activeView={activeEditorView}
        onClose={() => setReviewMode(false)}
        onOpenProblem={(problem) => { void openWorkspaceProblem(problem, openDocument); }}
        onApplyEdit={(edit) => { const active = viewsModel.active(); if (active?.type !== 'editor' || active.fileId !== edit.fileId || active.snapshot.session.revision !== edit.expectedRevision) { setMessage('A correção ficou desatualizada; reabra o problema antes de aplicá-la.'); return; } active.controller.dispatch({ edits: edit.edits }); }}
      />}
      {citationEditor !== undefined && activeEditorView !== undefined && (
        <CitationDialog
          fileId={activeEditorView.fileId}
          workspaceId={workspaceId}
          initial={citationEditor.initial}
          replaceRange={citationEditor.range}
          onClose={() => setCitationEditor(undefined)}
          onApply={(range, text) => {
            setCitationEditor(undefined);
            void commandRegistry.execute('citation.insert', { targetCitation: { range, text } });
          }}
        />
      )}
      {documentCreator !== undefined && <DocumentCreatorDialog
        initialKind={documentCreator}
        existingPaths={files.map((file) => file.path)}
        onClose={() => setDocumentCreator(undefined)}
        onCreate={async (kind, path) => {
          const result = await window.academic.workspace.createDocument({ path, content: templateSource(kind) });
          if (!result.ok) return result.error.message;
          setDocumentCreator(undefined);
          try {
            await openDocument(result.value.fileId, result.value.path);
            return undefined;
          } catch {
            return 'O documento foi criado, mas não pôde ser aberto automaticamente.';
          }
        }}
      />}
      <TextPromptHost />
      {diagnosticsCenter && activeEditorView !== undefined && <DiagnosticsCenter view={activeEditorView} onClose={() => setDiagnosticsCenter(false)} onCreateMissingReference={(id) => { void window.academic.library.upsert({ entry: { id, type: 'article', title: '[Preencher título]' } }).then((result) => { setMessage(result.ok ? `Referência ${id} criada; complete seus dados na biblioteca.` : result.error.message); if (result.ok) setReferenceLibraryEditor(true); }); }} />}
      {metadataEditor && activeEditorView !== undefined && <MetadataDialog view={activeEditorView} assets={workspaceFiles} onClose={() => setMetadataEditor(false)} />}
      {pagePropertiesOpen && activeEditorView !== undefined && <PagePropertiesDialog fileId={activeEditorView.fileId} revision={activeEditorView.snapshot.session.revision} onError={setMessage} onCommand={(id) => { setPagePropertiesOpen(false); void commandRegistry.execute(id, {}); }} onClose={() => setPagePropertiesOpen(false)} />}
      {profileSelector && activeEditorView !== undefined && <ProfileInspectorDialog fileId={activeEditorView.fileId} expectedRevision={activeEditorView.snapshot.session.revision} activeProfileId={metadataFromSource(activeEditorView.snapshot.session.content).profile || 'abnt-artigo'} onApply={(profileId) => { const draft = { ...metadataFromSource(activeEditorView.snapshot.session.content), profile: profileId }; activeEditorView.controller.dispatch({ edits: [{ range: { start: 0, end: activeEditorView.snapshot.session.content.length }, text: applyMetadata(activeEditorView.snapshot.session.content, draft) }] }); setProfileSelector(false); }} onClose={() => setProfileSelector(false)} />}
      {problemsPanel && activeEditorView !== undefined && <ProblemsDialog view={activeEditorView} onClose={() => setProblemsPanel(false)} />}
      {crossReferencePicker && activeEditorView !== undefined && <CrossReferenceDialog view={activeEditorView} onClose={()=>setCrossReferencePicker(false)} onInsert={(identifier)=>{setCrossReferencePicker(false);void commandRegistry.execute('xref.insert',{targetCrossReference:{identifier}});}} />}
      {graphView && <GraphDialog {...(activeEditorView === undefined ? {} : { activeFileId: activeEditorView.fileId })} onClose={() => setGraphView(false)} onOpenDocument={(fileId, path) => void openDocument(fileId, path)} />}
      {historyOpen && activeEditorView !== undefined && <HistoryDialog fileId={activeEditorView.fileId} path={activeEditorView.path} onClose={() => setHistoryOpen(false)} />}
      {performanceOpen && <PerformanceObservatoryDialog onClose={() => setPerformanceOpen(false)} />}
      {documentComparisonOpen && <DocumentComparisonDialog files={files} {...(activeEditorView === undefined ? {} : { initialFileId: activeEditorView.fileId })} onClose={() => setDocumentComparisonOpen(false)} />}
      {pluginManagerOpen && <PluginManagerDialog onClose={() => setPluginManagerOpen(false)} onChanged={setPluginContributions} />}
      {automationOpen && workspaceId !== undefined && <AutomationDialog
        registry={commandRegistry}
        context={paletteContext}
        files={markdownFiles(files)}
        collections={knowledgeWorkspace.collections}
        macros={workspaceMacros}
        onMacrosChange={setWorkspaceMacros}
        defaultKeybindings={defaultKeybindings}
        customKeybindings={customKeybindings}
        onCustomKeybindingsChange={setCustomKeybindings}
        onClose={() => setAutomationOpen(false)}
        onMessage={setMessage}
      />}
      {knowledgeWorkspaceOpen && <KnowledgeWorkspaceDialog
        state={knowledgeWorkspace}
        query={searchQuery}
        activeFile={activeEditorView === undefined ? undefined : { fileId: activeEditorView.fileId, path: activeEditorView.path, revision: activeEditorView.snapshot.session.revision, contentHash: activeEditorView.snapshot.session.contentHash ?? '', mediaType: 'text/markdown' }}
        onClose={() => setKnowledgeWorkspaceOpen(false)}
        onRunSearch={(query) => { setSearchQuery(query); setKnowledgeWorkspaceOpen(false); }}
        onSaveSearch={(name, query) => setKnowledgeWorkspace((current) => ({ ...current, searches: [...current.searches, { id: crypto.randomUUID(), name, query }] }))}
        onRemoveSearch={(id) => setKnowledgeWorkspace((current) => ({ ...current, searches: current.searches.filter((search) => search.id !== id) }))}
        onCreateCollection={(name) => setKnowledgeWorkspace((current) => ({ ...current, collections: [...current.collections, { id: crypto.randomUUID(), name, fileIds: [], referenceIds: [] }] }))}
        onAddFile={(collectionId, fileId) => setKnowledgeWorkspace((current) => ({ ...current, collections: current.collections.map((collection) => collection.id !== collectionId || collection.fileIds.includes(fileId) ? collection : { ...collection, fileIds: [...collection.fileIds, fileId] }) }))}
        onAddReference={(collectionId, referenceId) => setKnowledgeWorkspace((current) => ({ ...current, collections: current.collections.map((collection) => collection.id !== collectionId || collection.referenceIds.includes(referenceId) ? collection : { ...collection, referenceIds: [...collection.referenceIds, referenceId] }) }))}
        onRemoveCollection={(id) => setKnowledgeWorkspace((current) => ({ ...current, collections: current.collections.filter((collection) => collection.id !== id) }))}
      />}
      {researchWorkflowOpen && workspaceId !== undefined && <ResearchWorkflowDialog workspaceId={workspaceId} onClose={() => setResearchWorkflowOpen(false)} onOpenDocument={(fileId, path) => { setResearchWorkflowOpen(false); void openDocument(fileId, path); }} />}
      {researchIntakeOpen && workspaceId !== undefined && <ResearchIntakeDialog workspaceId={workspaceId} onClose={() => setResearchIntakeOpen(false)} onMessage={setMessage} />}
      {captureInboxOpen && workspaceId !== undefined && <CaptureInboxDialog workspaceId={workspaceId} {...(pendingCapture === undefined ? {} : { pendingCapture })} onClose={() => { setCaptureInboxOpen(false); setPendingCapture(undefined); }} onOpenDocument={(fileId, path) => { setCaptureInboxOpen(false); setPendingCapture(undefined); void openDocument(fileId, path); }} onMessage={setMessage} />}
      {researchCanvasOpen && <ResearchCanvasDialog files={workspaceFiles} onClose={() => setResearchCanvasOpen(false)} onMessage={setMessage} onInsertWriting={(text) => { if (activeEditorView === undefined) { setMessage('Abra um documento para inserir a prévia do canvas.'); return; } const offset = activeEditorView.snapshot.selection.head; activeEditorView.controller.dispatch({ edits: [{ range: { start: offset, end: offset }, text: `\n${text}\n` }], selection: { anchor: offset + text.length + 2, head: offset + text.length + 2 } }); setResearchCanvasOpen(false); setMessage('Prévia do canvas inserida; revise o texto autoral.'); }} />}
      {academicFormsOpen && <AcademicFormsDialog onClose={() => setAcademicFormsOpen(false)} onMessage={setMessage} onBatchReferenceType={(ids, type) => commandRegistry.execute('forms.applyReferenceType', paletteContext, { ids, type })} />}
      {researchProjectsOpen && workspaceId !== undefined && <ResearchProjectsDialog workspaceId={workspaceId} files={files} knowledge={knowledgeWorkspace} {...(activeEditorView === undefined ? {} : { activeFile: { fileId: activeEditorView.fileId, path: activeEditorView.path, revision: activeEditorView.snapshot.session.revision, contentHash: activeEditorView.snapshot.session.contentHash ?? '', mediaType: 'text/markdown' } })} onClose={() => setResearchProjectsOpen(false)} />}
      {academicViewsOpen && workspaceId !== undefined && <AcademicViewsDialog files={workspaceFiles} workspaceId={workspaceId} onClose={() => setAcademicViewsOpen(false)} onMessage={setMessage} />}
      {structuredResearchOpen && <StructuredResearchDialog onClose={() => setStructuredResearchOpen(false)} onMessage={setMessage} onApplySuggestion={async (suggestion) => {
        const active = viewsModel.active();
        if (active?.type !== 'editor') { setMessage('Abra um documento para inserir a sugestão.'); return; }
        if (!await requestConfirmation({ title: 'Inserir sugestão?', description: 'A sugestão será acrescentada ao fim do documento ativo e continuará editável.', confirmLabel: 'Inserir sugestão', destructive: false })) return;
        const offset = active.snapshot.session.content.length;
        active.controller.dispatch({ edits: [{ range: { start: offset, end: offset }, text: `\n\n${suggestion.trim()}\n` }], selection: { anchor: offset + suggestion.trim().length + 2, head: offset + suggestion.trim().length + 2 } });
        await active.controller.save();
        setMessage('Sugestão inserida no documento ativo.');
      }} />}
      {workspaceNavigationOpen && workspaceId !== undefined && <WorkspaceNavigationDialog workspaceId={workspaceId} files={workspaceFiles} searches={knowledgeWorkspace.searches} commandRegistry={commandRegistry} onClose={() => setWorkspaceNavigationOpen(false)} onOpenFile={(file) => { setWorkspaceNavigationOpen(false); void openDocument(file.fileId, file.path); }} />}
      {writingWorkflowOpen && workspaceId !== undefined && activeEditorView !== undefined && writingStatistics !== undefined && <WritingWorkflowDialog workspaceId={workspaceId} fileId={activeEditorView.fileId} profileId={metadataFromSource(activeEditorView.snapshot.session.content).profile || 'abnt-artigo'} outline={activeEditorView.snapshot.outline} diagnostics={activeEditorView.snapshot.diagnostics} statistics={writingStatistics} onClose={() => setWritingWorkflowOpen(false)} onNavigate={(offset) => activeEditorView.controller.dispatch({ selection: { anchor: offset, head: offset } })} />}
      {referenceMaintenanceOpen && <ReferenceMaintenanceDialog onClose={() => setReferenceMaintenanceOpen(false)} />}
      {libraryMaintenanceCenterOpen && <LibraryMaintenanceCenterDialog onClose={() => setLibraryMaintenanceCenterOpen(false)} onMessage={setMessage} />}
      {referenceLibraryEditor && <ReferenceLibraryDialog onClose={() => setReferenceLibraryEditor(false)} onOpenLiteratureNote={(fileId, path) => { setReferenceLibraryEditor(false); void openDocument(fileId, path); }} />}
      {referenceHealth && <ReferenceHealthDialog onClose={() => setReferenceHealth(false)} />}
      {annotationSynthesisOpen && <AnnotationSynthesisDialog {...(activeEditorView === undefined ? {} : { activeFileId: activeEditorView.fileId })} onClose={() => setAnnotationSynthesisOpen(false)} onOpenDocument={(fileId, path) => void openDocument(fileId, path)} />}
      {literatureMonitoringOpen && workspaceId !== undefined && <LiteratureMonitoringDialog onClose={() => setLiteratureMonitoringOpen(false)} onMessage={setMessage} />}
      {tableEditor !== undefined && activeEditorView !== undefined && <TableDialog {...(tableEditor.initial === undefined ? {} : { initial: tableEditor.initial })} onClose={() => setTableEditor(undefined)} onApply={(text) => { const start = tableEditor.range.start; activeEditorView.controller.dispatch({ edits: [{ range: tableEditor.range, text }], selection: { anchor: start + text.length, head: start + text.length } }); setTableEditor(undefined); }} />}
      {figureEditor !== undefined && <FigureDialog fileId={figureEditor.fileId} sourcePath={figureEditor.path} assets={workspaceFiles.filter((file) => file.path.startsWith('assets/') && file.mediaType?.startsWith('image/') === true)} onClose={() => setFigureEditor(undefined)} onError={setMessage} onApply={(input) => { const view = viewsModel.active(); if (view?.type !== 'editor' || view.fileId !== figureEditor.fileId) { setMessage('O documento ativo mudou; abra a figura novamente.'); setFigureEditor(undefined); return; } const text = `\n\n${figureSource(input)}\n\n`; view.controller.dispatch({ edits: [{ range: figureEditor.range, text }], selection: { anchor: figureEditor.range.start + text.length, head: figureEditor.range.start + text.length } }); setFigureEditor(undefined); }} />}
      {imageViewer !== undefined && <ImageViewerDialog image={imageViewer} onClose={() => setImageViewer(undefined)} />}
    </main>
  );
}
