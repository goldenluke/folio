import { useEffect, useMemo, useRef, useState, type JSX, type ReactNode } from 'react';

import type {
  ProtocolResult,
  SystemInformationDto,
  WorkspaceFileDto,
  WorkspaceGraphDto,
  WorkspaceGraphNodeDto,
  BibliographicEntityDto,
  WorkspaceReferenceHealthDto,
  WorkspaceReferenceAttachmentDto,
  WorkspaceOpenResponse,
  WorkspaceSearchResultDto,
  WorkspacePluginDto,
  LanguageWritingStatisticsDto,
} from '@abnt/protocol';
import type { LanguageLocation } from '@abnt/language-service';
import type { EditorController } from '@abnt/editor-core';

import { EditorPane } from './editor-pane.js';
import { PdfReaderDialog } from './pdf-reader.js';
import { ResearchWorkflowDialog } from './research-workflow.js';
import { WritingWorkflowDialog } from './writing-workflow.js';
import { ReferenceMaintenanceDialog } from './reference-maintenance.js';
import { HistoryDialog } from './history-dialog.js';
import { DocumentComparisonDialog } from './document-comparison.js';
import { PluginManagerDialog } from './plugin-manager.js';
import { ReviewWorkspaceDialog, readReviewComments } from './review-workflow.js';
import { RemoteEditorController } from './remote-editor-controller.js';
import { createCommandRegistry } from './shell/commands.js';
import { registerKeybindings } from './shell/keybindings.js';
import { rankCommands, rankQuickOpenFiles, type QuickOpenFile } from './shell/palette.js';
import { citationSource, editableCitationAt, type CitationDraft, type CitationEditMode, type CitationItemDraft, type CitationLocatorKind } from './shell/citation-source.js';
import { applyMetadata, metadataFromSource, type MetadataDraft } from './shell/frontmatter.js';
import { equationSource, figureSource, markdownTableSource, modularTccTemplate, parseMarkdownTable, templateSource, type MarkdownTableDraft, type TemplateKind } from './shell/authoring-source.js';
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

const markdownFiles = (files: readonly WorkspaceFileDto[]) => files.filter((file) => file.path.toLowerCase().endsWith('.md'));

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
  const paths: Record<typeof name, JSX.Element> = {
    back: <path d="m15 18-6-6 6-6" />,
    forward: <path d="m9 6 6 6-6 6" />,
    split: <><path d="M11 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h6" /><path d="M13 4h6a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-6" /><path d="M12 4v16" /></>,
    preview: <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.6" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-4 w-4">{paths[name]}</svg>;
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

function EditorDocumentPane({
  view,
  statistics,
  onError,
  onDefinition,
  onReferences,
  onCitationEdit,
  onAssetDropped,
  onKeepLocal,
  onReloadExternal,
}: {
  readonly view: Extract<ViewState, { readonly type: 'editor' }>;
  readonly statistics?: LanguageWritingStatisticsDto;
  readonly onError: (message: string) => void;
  readonly onDefinition: (locations: readonly LanguageLocation[]) => void;
  readonly onReferences: (locations: readonly LanguageLocation[]) => void;
  readonly onCitationEdit: (offset: number) => void;
  readonly onAssetDropped: (uri: string, name: string) => void;
  readonly onKeepLocal: () => void;
  readonly onReloadExternal: () => void;
}): JSX.Element {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {view.snapshot.externalChange !== undefined && (
        <div role="alert" className="flex flex-wrap items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          <span className="mr-auto">{view.path} mudou fora do aplicativo. Escolha qual versão preservar.</span>
          <button type="button" className="rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-semibold text-amber-950 hover:bg-amber-400" onClick={onKeepLocal}>Manter minha versão</button>
          <button type="button" className="rounded-lg border border-amber-300 px-2.5 py-1 text-xs hover:bg-amber-100" onClick={onReloadExternal}>Recarregar externa</button>
        </div>
      )}
      <EditorPane
        key={view.id}
        controller={view.controller}
        api={window.academic}
        onError={onError}
        onDefinition={onDefinition}
        onReferences={onReferences}
        onCitationClick={onCitationEdit}
        onAssetDropped={onAssetDropped}
      />
      {statistics !== undefined && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-slate-100 bg-slate-50/70 px-3 py-2 text-xs text-slate-500" aria-label="Estatísticas de escrita">
          <span>{statistics.words.toLocaleString('pt-BR')} palavras</span><span>{statistics.characters.toLocaleString('pt-BR')} caracteres</span><span>{statistics.paragraphs} parágrafos</span><span>{statistics.citations} citações</span><span>{statistics.figures} figuras</span><span>{statistics.tables} tabelas</span><span>{statistics.estimatedReadingMinutes} min de leitura</span>
        </div>
      )}
    </div>
  );
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
  onClose,
  onCommand,
  onOpenFile,
}: {
  readonly mode: PaletteMode;
  readonly files: readonly WorkspaceFileDto[];
  readonly recentFileIds: readonly string[];
  readonly commandRegistry: ReturnType<typeof createCommandRegistry>;
  readonly commandContext: ReturnType<typeof commandContextForPalette>;
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
      void window.academic.workspace.search({ query: query.trim(), limit: 40 }).then((result) => {
        if (version === request.current && result.ok) setIndexed(result.value);
      });
    }, 120);
    return () => clearTimeout(timer);
  }, [mode, query]);

  const items = useMemo(() => {
    if (mode === 'commands') return rankCommands(commandRegistry, commandContext, query);
    const candidates = new Map<string, QuickOpenFile>(files.map((file) => [file.fileId, { fileId: file.fileId, path: file.path }]));
    for (const result of indexed) {
      candidates.set(result.fileId, { fileId: result.fileId, path: result.path, title: result.title });
    }
    return rankQuickOpenFiles([...candidates.values()], query, recentFileIds);
  }, [commandContext, commandRegistry, files, indexed, mode, query, recentFileIds]);

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
                  {item.detail !== undefined && <span className="truncate font-mono text-xs text-slate-500">{item.detail}</span>}
                </button>
              </li>
            ))
          )}
        </ul>
        <footer className="border-t border-slate-700 px-4 py-2 text-xs text-slate-500">
          {mode === 'commands' ? 'Enter executa o comando · Esc fecha' : 'Busca conteúdo pelo índice FTS5 · Enter abre o primeiro resultado'}
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

function CitationDialog({ fileId, initial, replaceRange, onClose, onApply }: {
  readonly fileId: string;
  readonly initial: CitationDraft | undefined;
  readonly replaceRange: { readonly start: number; readonly end: number } | undefined;
  readonly onClose: () => void;
  readonly onApply: (range: { readonly start: number; readonly end: number }, text: string) => void;
}): JSX.Element {
  const [references, setReferences] = useState<readonly import('@abnt/protocol').WorkspaceReferenceDto[]>([]);
  const [filter, setFilter] = useState('');
  const [items, setItems] = useState<readonly CitationItemDraft[]>(initial?.items ?? []);
  const [mode, setMode] = useState<CitationEditMode>(initial?.mode ?? 'parenthetical');
  useEffect(() => { void window.academic.documents.references({ fileId }).then((result) => { if (result.ok) setReferences(result.value); }); }, [fileId]);
  const filtered = references.filter((reference) => `${reference.id} ${reference.formatted}`.toLocaleLowerCase().includes(filter.toLocaleLowerCase()));
  const range = replaceRange;
  const updateItem = (index: number, patch: Partial<CitationItemDraft>): void => setItems((current) => current.map((item, candidate) => candidate === index ? { ...item, ...patch } : item));
  const moveItem = (index: number, direction: -1 | 1): void => setItems((current) => {
    const next = index + direction; if (next < 0 || next >= current.length) return current;
    const copy = [...current]; [copy[index], copy[next]] = [copy[next]!, copy[index]!]; return copy;
  });
  const addItem = (referenceId: string): void => { if (referenceId !== '' && !items.some((item) => item.referenceId === referenceId)) setItems((current) => [...current, { referenceId }]); };
  const editableItems = mode === 'narrative' ? items.slice(0, 1) : items;
  const draft: CitationDraft = { mode, items: editableItems };
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-5" role="presentation">
    <section role="dialog" aria-modal="true" aria-labelledby="citation-editor-title" className="w-full max-w-2xl rounded-lg border border-slate-600 bg-slate-900 p-5 shadow-2xl">
      <div className="flex items-start gap-3"><div><h2 id="citation-editor-title" className="text-lg font-semibold">{initial === undefined ? 'Inserir citação' : 'Editar citação'}</h2><p className="text-sm text-slate-400">O resultado continua sendo Markdown no documento.</p></div><button type="button" className="ml-auto text-xl text-slate-400 hover:text-white" onClick={onClose}>×</button></div>
      <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Pesquisar referência…" className="mt-4 w-full rounded bg-slate-800 px-3 py-2 text-sm outline-none" />
      <select value="" onChange={(event) => { addItem(event.target.value); event.currentTarget.value = ''; }} className="mt-2 w-full rounded bg-slate-800 px-3 py-2 text-sm"><option value="">Adicionar referência ao grupo…</option>{filtered.filter((reference) => !items.some((item) => item.referenceId === reference.id)).map((reference) => <option key={reference.id} value={reference.id}>{reference.id} — {reference.formatted}</option>)}</select>
      <div className="mt-3 grid grid-cols-3 gap-2">{([['parenthetical', 'Parentética'], ['narrative', 'Narrativa'], ['suppress-author', 'Suprimir autor']] as const).map(([value, label]) => <button type="button" key={value} onClick={() => setMode(value)} className={`rounded px-2 py-1.5 text-xs ${mode === value ? 'bg-cyan-700' : 'bg-slate-800 hover:bg-slate-700'}`}>{label}</button>)}</div>
      {mode === 'narrative' && items.length > 1 && <p className="mt-3 rounded bg-amber-950/60 px-3 py-2 text-xs text-amber-200">A forma narrativa representa uma fonte por vez; os itens adicionais serão preservados ao voltar ao grupo parentético.</p>}
      <ol className="mt-3 grid gap-2">{editableItems.map((item, index) => <li key={`${item.referenceId}:${index}`} className="rounded border border-slate-700 bg-slate-800/60 p-3"><div className="flex items-center gap-2"><strong className="min-w-0 flex-1 truncate text-sm">{item.referenceId}</strong><button type="button" aria-label="Mover acima" disabled={index === 0} className="rounded bg-slate-700 px-2 py-1 text-xs disabled:opacity-40" onClick={() => moveItem(index, -1)}>↑</button><button type="button" aria-label="Mover abaixo" disabled={index === editableItems.length - 1} className="rounded bg-slate-700 px-2 py-1 text-xs disabled:opacity-40" onClick={() => moveItem(index, 1)}>↓</button><button type="button" aria-label="Remover" className="rounded bg-red-900/70 px-2 py-1 text-xs" onClick={() => setItems((current) => current.filter((_, candidate) => candidate !== index))}>×</button></div><div className="mt-2 grid gap-2 sm:grid-cols-2"><select value={item.locatorKind ?? 'page'} onChange={(event) => updateItem(index, { locatorKind: event.target.value as CitationLocatorKind })} className="rounded bg-slate-900 px-2 py-1.5 text-sm"><option value="page">Página</option><option value="chapter">Capítulo</option><option value="section">Seção</option><option value="paragraph">Parágrafo</option><option value="volume">Volume</option><option value="issue">Número</option><option value="figure">Figura</option><option value="table">Tabela</option></select><input value={item.locator ?? ''} onChange={(event) => updateItem(index, { locator: event.target.value })} placeholder="Locator (42, 3, Método…)" className="rounded bg-slate-900 px-2 py-1.5 text-sm" /><input value={item.prefix ?? ''} onChange={(event) => updateItem(index, { prefix: event.target.value })} placeholder="Prefixo do item" className="rounded bg-slate-900 px-2 py-1.5 text-sm" /><input value={item.suffix ?? ''} onChange={(event) => updateItem(index, { suffix: event.target.value })} placeholder="Sufixo do item" className="rounded bg-slate-900 px-2 py-1.5 text-sm" /></div></li>)}</ol>
      <p className="mt-3 rounded bg-slate-950 p-2 font-mono text-sm text-slate-300">{items.length === 0 ? 'Adicione uma referência' : citationSource(draft)}</p>
      <div className="mt-5 flex justify-end gap-2"><button type="button" className="rounded bg-slate-700 px-3 py-1.5 text-sm" onClick={onClose}>Cancelar</button><button type="button" disabled={editableItems.length === 0 || range === undefined} onClick={() => range !== undefined && onApply(range, citationSource(draft))} className="rounded bg-cyan-700 px-3 py-1.5 text-sm disabled:opacity-40">Aplicar</button></div>
    </section></div>;
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
  const [attachments, setAttachments] = useState<readonly WorkspaceReferenceAttachmentDto[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [draft, setDraft] = useState<ReferenceDraft>(emptyReferenceDraft);
  const [preview, setPreview] = useState('Preencha a chave e o tipo para ver a referência ABNT.');
  const [pdfReaderReferenceId, setPdfReaderReferenceId] = useState<string | undefined>(undefined);
  const selected = entries.find((entry) => entry.id === selectedId);
  const attachment = attachments.find((entry) => entry.referenceId === selectedId);

  const load = (): void => { void window.academic.library.list({}).then((result) => { if (result.ok) setEntries(result.value); }); void window.academic.workspace.referenceAttachments({}).then((result) => { if (result.ok) setAttachments(result.value); }); };
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
    if (selectedId === undefined) return;
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
  const field = (key: keyof ReferenceDraft, label: string, placeholder?: string): JSX.Element => <label className="grid gap-1 text-sm text-slate-300"><span>{label}</span><input value={draft[key] as string} placeholder={placeholder} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} className="rounded bg-slate-800 p-2" /></label>;

  const attachmentControls = selectedId === undefined ? null : <div className="mt-4 rounded bg-slate-800 p-3"><h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">PDF de pesquisa</h3><p className="mt-1 truncate text-sm text-slate-300">{attachment?.file.path ?? 'Nenhum PDF anexado.'}</p><div className="mt-2 flex flex-wrap gap-2">{attachment === undefined ? <button type="button" className="rounded bg-cyan-800 px-2 py-1 text-xs" onClick={() => void window.academic.library.attachPdf({referenceId:selectedId}).then((result)=>{if(result.ok)load();else setPreview(result.error.message);})}>Anexar PDF</button> : <><button type="button" className="rounded bg-cyan-800 px-2 py-1 text-xs" onClick={() => setPdfReaderReferenceId(selectedId)}>Ler no Folio</button><button type="button" className="rounded bg-slate-700 px-2 py-1 text-xs" onClick={() => void window.academic.library.openAttachment({referenceId:selectedId}).then((result)=>{if(!result.ok)setPreview(result.error.message);})}>Abrir externo</button><button type="button" className="rounded bg-slate-700 px-2 py-1 text-xs" onClick={() => void window.academic.library.revealAttachment({referenceId:selectedId}).then((result)=>{if(!result.ok)setPreview(result.error.message);})}>Revelar</button><button type="button" className="rounded bg-red-800 px-2 py-1 text-xs" onClick={() => void window.academic.library.removeAttachment({referenceId:selectedId}).then((result)=>{if(result.ok)load();else setPreview(result.error.message);})}>Desvincular</button></>}</div></div>;
  return <><div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-5" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="reference-library-title" className="grid h-[min(78vh,48rem)] w-full max-w-5xl grid-cols-[13rem_1fr] overflow-hidden rounded-lg border border-slate-600 bg-slate-900 shadow-2xl"><aside className="border-r border-slate-700 p-3"><div className="flex items-center justify-between"><h2 id="reference-library-title" className="font-semibold">Biblioteca</h2><button type="button" className="rounded bg-slate-700 px-2 py-1 text-xs" onClick={() => { setSelectedId(undefined); setDraft(emptyReferenceDraft()); }}>Nova</button></div><ul className="mt-3 grid max-h-[65vh] gap-1 overflow-auto">{entries.map((entry) => <li key={entry.id}><button type="button" onClick={() => choose(entry)} className={`w-full rounded px-2 py-1.5 text-left text-sm hover:bg-slate-800 ${entry.id === selectedId ? 'bg-slate-700' : ''}`}><span className="block truncate">{entry.title ?? entry.id}</span><span className="block font-mono text-xs text-slate-400">{entry.id}</span></button></li>)}</ul></aside><div className="overflow-auto p-5"><div className="flex"><div><h2 className="text-lg font-semibold">{selectedId === undefined ? 'Nova referência' : 'Editar referência'}</h2><p className="text-sm text-slate-400">CSL-JSON no vault; preview gerado pelo motor ABNT.</p></div><button type="button" className="ml-auto text-xl text-slate-400 hover:text-white" onClick={onClose}>×</button></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{field('id', 'Chave de citação', 'silva2024')}<label className="grid gap-1 text-sm text-slate-300"><span>Tipo</span><select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as ReferenceDraft['type'] })} className="rounded bg-slate-800 p-2">{REFERENCE_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{field('title', 'Título')}{field('authors', 'Autores (um por linha: Sobrenome, Nome)')} {field('containerTitle', draft.type === 'article-journal' ? 'Periódico' : 'Obra / evento')} {field('publisher', 'Editora')} {field('year', 'Ano', '2024')} {field('doi', 'DOI')} {field('url', 'URL')}</div><div className="mt-2 flex justify-end"><button type="button" disabled={draft.doi.trim() === ''} onClick={() => void importDoi()} className="rounded bg-slate-700 px-3 py-1.5 text-sm disabled:opacity-40">Resolver DOI e revisar</button></div>{attachmentControls}<div className="mt-4 rounded bg-slate-950 p-3"><h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Preview ABNT</h3><p className="mt-1 text-sm text-slate-200">{preview}</p></div><div className="mt-5 flex justify-end gap-2"><button type="button" disabled={selectedId === undefined} className="rounded bg-slate-700 px-3 py-1.5 text-sm disabled:opacity-40" onClick={duplicate}>Duplicar</button><button type="button" disabled={selectedId === undefined} className="rounded bg-red-800 px-3 py-1.5 text-sm disabled:opacity-40" onClick={() => void remove()}>Excluir</button><button type="button" className="rounded bg-slate-700 px-3 py-1.5 text-sm" onClick={onClose}>Fechar</button><button type="button" disabled={draft.id.trim() === ''} className="rounded bg-cyan-700 px-3 py-1.5 text-sm disabled:opacity-40" onClick={() => void save()}>Salvar</button></div></div></section></div>{pdfReaderReferenceId !== undefined && <PdfReaderDialog referenceId={pdfReaderReferenceId} onClose={() => setPdfReaderReferenceId(undefined)} onOpenLiteratureNote={onOpenLiteratureNote} />}</>;
}

function ReferenceHealthDialog({ onClose }: { readonly onClose: () => void }): JSX.Element {
  const [health, setHealth] = useState<WorkspaceReferenceHealthDto | undefined>(undefined);
  useEffect(() => { void window.academic.workspace.referenceHealth({}).then((result) => { if (result.ok) setHealth(result.value); }); }, []);
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-5"><section role="dialog" aria-modal="true" className="flex max-h-[82vh] w-full max-w-2xl flex-col rounded-lg border border-slate-600 bg-slate-900 p-5 shadow-2xl"><div className="flex"><div><h2 className="text-lg font-semibold">Saúde das referências</h2><p className="text-sm text-slate-400">Projeção bibliográfica do catálogo, anexos, notas e citações — não é validação normativa.</p></div><button type="button" className="ml-auto text-xl text-slate-400" onClick={onClose}>×</button></div>{health === undefined ? <p className="py-8 text-center text-slate-400">Calculando…</p> : <><div className="mt-4 grid grid-cols-2 gap-2 text-center text-sm"><div className="rounded bg-slate-800 p-3">Referências<br /><strong>{health.total}</strong></div><div className="rounded bg-cyan-950/60 p-3">Citadas<br /><strong>{health.cited}</strong></div><div className="rounded bg-amber-950/60 p-3">Não usadas<br /><strong>{health.unused}</strong></div><div className="rounded bg-slate-800 p-3">Sem DOI<br /><strong>{health.withoutDoi}</strong></div></div><div className="mt-4"><h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Chaves citadas e não encontradas</h3>{health.missing.length === 0 ? <p className="mt-1 text-sm text-slate-300">Nenhuma.</p> : <ul className="mt-1 list-disc pl-5 font-mono text-sm text-red-300">{health.missing.map((id) => <li key={id}>{id}</li>)}</ul>}</div><div className="mt-4 min-h-0 overflow-auto"><h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Auditoria bibliográfica ({health.audit.length})</h3>{health.audit.length === 0 ? <p className="mt-1 text-sm text-emerald-300">Nenhuma lacuna encontrada.</p> : <ul className="mt-1 divide-y divide-slate-800">{health.audit.map((issue) => <li key={`${issue.referenceId}:${issue.code}`} className="py-2 text-sm"><code className="mr-2 text-cyan-300">{issue.referenceId}</code><span className="text-slate-200">{issue.message}</span></li>)}</ul>}</div></>}</section></div>;
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
function MetadataDialog({ view, onClose }: { readonly view: Extract<ViewState, { type: 'editor' }>; readonly onClose: () => void }): JSX.Element {
  const [draft, setDraft] = useState(() => metadataFromSource(view.snapshot.session.content));
  const fields: readonly [keyof MetadataDraft, string, boolean?][] = [['title','Título'],['subtitle','Subtítulo'],['authors','Autores (um por linha)',true],['advisor','Orientador'],['institution','Instituição'],['course','Curso'],['city','Cidade'],['year','Ano'],['keywords','Palavras-chave (vírgulas)'],['language','Idioma'],['profile','Perfil'],['bibliography','Bibliografia (vírgulas)']];
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-5"><section role="dialog" aria-modal="true" aria-labelledby="metadata-title" className="w-full max-w-2xl rounded-lg border border-slate-600 bg-slate-900 p-5 shadow-2xl"><h2 id="metadata-title" className="text-lg font-semibold">Metadados do documento</h2><p className="text-sm text-slate-400">Edita o frontmatter YAML deste Markdown.</p><div className="mt-4 grid max-h-[55vh] gap-2 overflow-auto sm:grid-cols-2">{fields.map(([key,label,multi]) => <label key={key} className="grid gap-1 text-sm text-slate-300"><span>{label}</span>{multi ? <textarea value={draft[key]} onChange={(e) => setDraft({...draft,[key]:e.target.value})} className="min-h-20 rounded bg-slate-800 p-2" /> : <input value={draft[key]} onChange={(e) => setDraft({...draft,[key]:e.target.value})} className="rounded bg-slate-800 p-2" />}</label>)}</div><div className="mt-5 flex justify-end gap-2"><button type="button" className="rounded bg-slate-700 px-3 py-1.5" onClick={onClose}>Cancelar</button><button type="button" className="rounded bg-cyan-700 px-3 py-1.5" onClick={() => { const text=applyMetadata(view.snapshot.session.content,draft); view.controller.dispatch({edits:[{range:{start:0,end:view.snapshot.session.content.length},text}]}); onClose(); }}>Aplicar YAML</button></div></section></div>;
}
const PROFILE_OPTIONS = [
  ['abnt-artigo', 'ABNT Artigo', 'Autor-data · validação de artigo'],
  ['abnt-artigo-numerico', 'ABNT Artigo numérico', 'Numérica · validação de artigo'],
  ['abnt-tcc', 'ABNT TCC', 'Autor-data · elementos acadêmicos'],
  ['web-article', 'Web Article', 'Sem validação ABNT'],
] as const;

function ProfileDialog({ view, onClose }: { readonly view: Extract<ViewState, { type: 'editor' }>; readonly onClose: () => void }): JSX.Element {
  const [selected, setSelected] = useState(() => metadataFromSource(view.snapshot.session.content).profile || 'abnt-artigo');
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-5"><section role="dialog" aria-modal="true" aria-labelledby="profile-title" className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-5 shadow-2xl"><div className="flex"><div><h2 id="profile-title" className="text-lg font-semibold text-slate-900">Perfil de publicação</h2><p className="text-sm text-slate-500">A seleção é escrita no frontmatter e recompila o documento.</p></div><button type="button" aria-label="Fechar perfil" className="ml-auto text-xl text-slate-500" onClick={onClose}>×</button></div><div className="mt-4 grid gap-2">{PROFILE_OPTIONS.map(([id,title,detail])=><button key={id} type="button" onClick={()=>setSelected(id)} className={`rounded-xl border p-3 text-left transition-colors ${selected===id?'border-indigo-300 bg-indigo-50 text-indigo-950 shadow-sm':'border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:bg-slate-50'}`}><strong className="block">{title}</strong><span className="text-sm text-slate-500">{detail}</span><span className="mt-1 block font-mono text-xs text-slate-400">{id}</span></button>)}</div><div className="mt-5 flex justify-end gap-2"><button type="button" className="rounded-lg bg-slate-100 px-3 py-1.5 text-slate-700 hover:bg-slate-200" onClick={onClose}>Cancelar</button><button type="button" className="rounded-lg bg-indigo-600 px-3 py-1.5 text-white hover:bg-indigo-700" onClick={()=>{const draft={...metadataFromSource(view.snapshot.session.content),profile:selected};view.controller.dispatch({edits:[{range:{start:0,end:view.snapshot.session.content.length},text:applyMetadata(view.snapshot.session.content,draft)}]});onClose();}}>Aplicar perfil</button></div></section></div>;
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
    void window.academic.workspace.graph(request).then((result) => { if (result.ok) setGraph(result.value); });
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
  const saveCurrent = (): void => {
    const value = query.trim(); if (value === '') return;
    const name = window.prompt('Nome da busca salva:', value); if (name !== null && name.trim() !== '') onSaveSearch(name.trim(), value);
  };
  const createCollection = (): void => { const name = window.prompt('Nome da collection:', 'Projeto de pesquisa'); if (name !== null && name.trim() !== '') onCreateCollection(name.trim()); };
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-5"><section role="dialog" aria-modal="true" aria-labelledby="knowledge-title" className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-5 shadow-2xl"><div className="flex items-start"><div><h2 id="knowledge-title" className="text-lg font-bold text-slate-900">Knowledge Workspace</h2><p className="text-sm text-slate-500">Buscas e collections são preferências locais deste vault.</p></div><button type="button" className="folio-control ml-auto grid h-8 w-8 place-items-center rounded-lg text-lg" onClick={onClose}>×</button></div><div className="mt-4 flex gap-2 border-b border-slate-200"><button type="button" className={`px-3 py-2 text-sm font-semibold ${tab === 'searches' ? 'border-b-2 border-indigo-500 text-indigo-700' : 'text-slate-500'}`} onClick={() => setTab('searches')}>Buscas salvas</button><button type="button" className={`px-3 py-2 text-sm font-semibold ${tab === 'collections' ? 'border-b-2 border-indigo-500 text-indigo-700' : 'text-slate-500'}`} onClick={() => setTab('collections')}>Collections</button></div>{tab === 'searches' ? <div className="mt-4"><div className="flex items-center justify-between"><p className="text-sm text-slate-600">Consulta atual: <code className="rounded bg-slate-100 px-1">{query || '—'}</code></p><button type="button" disabled={query.trim() === ''} className="folio-primary rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-40" onClick={saveCurrent}>Salvar busca</button></div><ul className="mt-4 grid gap-2">{state.searches.length === 0 ? <li className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Salve consultas como <code>tag:metodologia</code> ou <code>year:2024 has:figure</code>.</li> : state.searches.map((search) => <li key={search.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3"><button type="button" className="min-w-0 flex-1 text-left" onClick={() => onRunSearch(search.query)}><strong className="block text-sm text-slate-800">{search.name}</strong><code className="block truncate text-xs text-slate-500">{search.query}</code></button><button type="button" className="text-xs font-semibold text-rose-600" onClick={() => onRemoveSearch(search.id)}>Remover</button></li>)}</ul></div> : <div className="mt-4"><button type="button" className="folio-primary rounded-lg px-3 py-1.5 text-sm font-semibold" onClick={createCollection}>Nova collection</button><ul className="mt-4 grid gap-2">{state.collections.length === 0 ? <li className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Collections agrupam documentos e referências sem mover arquivos.</li> : state.collections.map((collection) => <li key={collection.id} className="rounded-lg border border-slate-200 p-3"><div className="flex"><strong className="text-sm text-slate-800">{collection.name}</strong><button type="button" className="ml-auto text-xs font-semibold text-rose-600" onClick={() => onRemoveCollection(collection.id)}>Remover</button></div><p className="mt-1 text-xs text-slate-500">{collection.fileIds.length} documento(s) · {collection.referenceIds.length} referência(s)</p><div className="mt-2 flex gap-2">{activeFile !== undefined && <button type="button" className="text-xs font-semibold text-indigo-700" onClick={() => onAddFile(collection.id, activeFile.fileId)}>Adicionar documento ativo</button>}<button type="button" className="text-xs font-semibold text-indigo-700" onClick={() => { const id = window.prompt('Chave da referência para adicionar:'); if (id !== null && id.trim() !== '') onAddReference(collection.id, id.trim()); }}>Adicionar referência</button></div>{collection.referenceIds.length > 0 && <p className="mt-1 truncate font-mono text-xs text-slate-500">{collection.referenceIds.join(', ')}</p>}</li>)}</ul></div>}</section></div>;
}

export function App(): JSX.Element {
  const [files, setFiles] = useState<readonly WorkspaceFileDto[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | undefined>(undefined);
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
  const [citationEditor, setCitationEditor] = useState<{ readonly initial: CitationDraft | undefined; readonly range: { readonly start: number; readonly end: number } } | undefined>(undefined);
  const [diagnosticsCenter, setDiagnosticsCenter] = useState(false);
  const [metadataEditor, setMetadataEditor] = useState(false);
  const [profileSelector, setProfileSelector] = useState(false);
  const [problemsPanel, setProblemsPanel] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [crossReferencePicker, setCrossReferencePicker] = useState(false);
  const [graphView, setGraphView] = useState(false);
  const [referenceLibraryEditor, setReferenceLibraryEditor] = useState(false);
  const [referenceHealth, setReferenceHealth] = useState(false);
  const [tableEditor, setTableEditor] = useState<{ readonly range: { readonly start: number; readonly end: number }; readonly initial?: MarkdownTableDraft } | undefined>(undefined);
  const [writingStatistics, setWritingStatistics] = useState<LanguageWritingStatisticsDto | undefined>(undefined);
  const [knowledgeWorkspace, setKnowledgeWorkspace] = useState<KnowledgeWorkspaceState>(emptyKnowledgeWorkspace);
  const [knowledgeWorkspaceOpen, setKnowledgeWorkspaceOpen] = useState(false);
  const [researchWorkflowOpen, setResearchWorkflowOpen] = useState(false);
  const [writingWorkflowOpen, setWritingWorkflowOpen] = useState(false);
  const [referenceMaintenanceOpen, setReferenceMaintenanceOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [documentComparisonOpen, setDocumentComparisonOpen] = useState(false);
  const [pluginManagerOpen, setPluginManagerOpen] = useState(false);
  const [pluginContributions, setPluginContributions] = useState<readonly WorkspacePluginDto[]>([]);
  const [, setNavigationVersion] = useState(0);

  const viewsModel = useRef(createViewsModel()).current;
  const commandRegistry = useRef(createCommandRegistry()).current;
  const panelRegistry = useRef(createPanelRegistry()).current;
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
  const activeEditorView = activeView?.type === 'editor' ? activeView : undefined;
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

  useEffect(() => {
    if (workspaceId === undefined) return;
    try { window.localStorage.setItem(`folio.recent:${workspaceId}`, JSON.stringify(recentFileIds)); } catch { /* armazenamento de UI é opcional */ }
  }, [recentFileIds, workspaceId]);

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
    if (event.type === 'desktop:workspace-event') {
      void window.academic.workspace.list({}).then((result) => {
        if (result.ok) setFiles(markdownFiles(result.value));
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
      void window.academic.workspace.search({ query }).then((result) => {
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
    const result = await window.academic.editor.preview({ fileId });
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

  const openDocument = async (fileId: string, path: string, options: { readonly remember?: boolean } = {}): Promise<EditorController | undefined> => {
    const shouldRemember = options.remember ?? true;
    const existing = viewsModel.list().find((view) => view.type === 'editor' && view.fileId === fileId);
    if (existing !== undefined && existing.type === 'editor') {
      viewsModel.activate(existing.id);
      setRecentFileIds((current) => [fileId, ...current.filter((candidate) => candidate !== fileId)].slice(0, 12));
      if (shouldRemember) rememberNavigation({ fileId, path, selection: existing.snapshot.selection });
      return existing.controller;
    }
    const result = await window.academic.editor.open({ fileId });
    if (!result.ok) {
      setMessage(result.error.message);
      return undefined;
    }
    const controller = new RemoteEditorController({ api: window.academic, snapshot: result.value, onError: setMessage });
    const viewId = viewsModel.openEditor({ fileId, path, controller, snapshot: controller.snapshot() });
    subscribeController(viewId, controller);
    setRecentFileIds((current) => [fileId, ...current.filter((candidate) => candidate !== fileId)].slice(0, 12));
    if (shouldRemember) rememberNavigation({ fileId, path, selection: controller.snapshot().selection });
    setMessage(path);
    return controller;
  };

  /**
   * Cada lado ganha sua própria view/controller (e, portanto, seleção e
   * histórico local próprios), mas ambos apontam para a mesma sessão remota
   * identificada por fileId. View nunca vira uma segunda autoridade do texto.
   */
  const openDocumentInSplit = async (fileId: string, path: string): Promise<EditorController | undefined> => {
    const primary = viewsModel.active();
    if (primary?.type !== 'editor') return undefined;
    const result = await window.academic.editor.open({ fileId });
    if (!result.ok) {
      setMessage(result.error.message);
      return undefined;
    }
    const controller = new RemoteEditorController({ api: window.academic, snapshot: result.value, onError: setMessage });
    const viewId = viewsModel.openEditor({ fileId, path, controller, snapshot: controller.snapshot(), duplicate: true });
    subscribeController(viewId, controller);
    setRecentFileIds((current) => [fileId, ...current.filter((candidate) => candidate !== fileId)].slice(0, 12));
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
    const result = await window.academic.editor.export({ fileId: active.fileId, format });
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
    setFiles(markdown);
    setMessage(`${result.value.files.length} arquivos no vault.`);
  };

  useEffect(() => {
    if (lastVaultRestoreAttempted.current) return;
    lastVaultRestoreAttempted.current = true;
    let cancelled = false;
    void window.academic.workspace.restoreLast().then((result) => {
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
        id: 'knowledge.open',
        title: 'Abrir Knowledge Workspace',
        isEnabled: () => workspaceId !== undefined,
        run() { setKnowledgeWorkspaceOpen(true); },
      }),
      commandRegistry.register({
        id: 'search.openView',
        title: 'Abrir busca acadêmica',
        isEnabled: () => workspaceId !== undefined,
        run() { setSearchViewOpen(true); },
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
        run(context) {
          if (context.targetSearchResult === undefined) return;
          const collections = knowledgeWorkspaceRef.current.collections;
          const choices = collections.map((collection, index) => `${index + 1}. ${collection.name}`).join('\n');
          const selection = window.prompt(`Adicionar a qual collection?\n${choices}`, collections[0]?.name ?? '');
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
        run(context) {
          const query = context.targetSearchQuery?.trim();
          if (query === undefined || query === '') return;
          const name = window.prompt('Nome da busca salva:', query);
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
        id: 'research.open',
        title: 'Abrir fluxo de pesquisa',
        isEnabled: () => workspaceId !== undefined,
        run() { setResearchWorkflowOpen(true); },
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
      commandRegistry.register({ id: 'document.compare', title: 'Comparar documentos', isEnabled: () => files.length > 1, run() { setDocumentComparisonOpen(true); } }),
      commandRegistry.register({ id: 'plugins.manage', title: 'Gerenciar plugins locais', isEnabled: () => workspaceId !== undefined, run() { setPluginManagerOpen(true); } }),
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
        isEnabled: (context) => context.targetFile !== undefined,
        async run(context) {
          if (context.targetFile === undefined) return;
          await openDocument(context.targetFile.fileId, context.targetFile.path);
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
        isEnabled: (context) => context.targetFile !== undefined,
        async run(context) {
          if (context.targetFile === undefined) return;
          await openPreview(context.targetFile.fileId, context.targetFile.path);
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
        async run() {
          await exportActiveDocument('pdf');
        },
      }),
      commandRegistry.register({
        id: 'document.exportDocx',
        title: 'Exportar como DOCX',
        isEnabled: (context) => context.activeViewId !== undefined,
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
        async run() {
          const active = viewsModel.active(); if (active?.type !== 'editor') return;
          const asset = await window.academic.editor.importAsset({ fileId: active.fileId });
          if (!asset.ok) { if (asset.error.code !== 'CANCELLED') setMessage(asset.error.message); return; }
          const alt = window.prompt('Texto alternativo da figura:', asset.value.file.path.split('/').at(-1)?.replace(/\.[^.]+$/u, '') ?? '') ?? '';
          const caption = window.prompt('Legenda da figura:', alt) ?? '';
          const source = window.prompt('Fonte (opcional):', '') ?? '';
          const identifier = window.prompt('Identificador para referência cruzada (opcional):', '') ?? '';
          const text = figureSource({ uri: asset.value.authoredUri, alt, caption, source, identifier });
          const { anchor, head } = active.snapshot.selection; const start = Math.min(anchor, head);
          active.controller.dispatch({ edits: [{ range: { start, end: Math.max(anchor, head) }, text }], selection: { anchor: start + text.length, head: start + text.length } });
        },
      }),
      commandRegistry.register({
        id: 'table.insert', title: 'Inserir tabela', isEnabled: () => viewsModel.active()?.type === 'editor',
        run() { const active=viewsModel.active(); if(active?.type!=='editor') return; const { anchor, head }=active.snapshot.selection; const found=markdownTableAt(active.snapshot.session.content,head); setTableEditor(found === undefined ? { range: { start: Math.min(anchor,head), end: Math.max(anchor,head) } } : { range: found.range, initial: found.table }); },
      }),
      commandRegistry.register({
        id: 'math.insertEquation', title: 'Inserir equação', isEnabled: () => viewsModel.active()?.type === 'editor',
        run() { const active=viewsModel.active(); if(active?.type!=='editor') return; const tex=window.prompt('Expressão TeX:', 'x = y') ?? ''; const identifier=window.prompt('Identificador da equação (opcional):', '') ?? ''; const text=equationSource(tex, identifier); const {anchor,head}=active.snapshot.selection; const start=Math.min(anchor,head); active.controller.dispatch({edits:[{range:{start,end:Math.max(anchor,head)},text}],selection:{anchor:start+text.length,head:start+text.length}}); },
      }),
      commandRegistry.register({
        id: 'template.createDocument', title: 'Criar documento por template',
        async run() { const kind=window.prompt('Template: article, reading-note, research-project, tcc, dissertation, thesis, abstract, institutional-article ou institutional-tcc', 'article') as TemplateKind | null; const known: readonly TemplateKind[]=['article','reading-note','research-project','tcc','dissertation','thesis','abstract','institutional-article','institutional-tcc']; if(kind===null)return; if(!known.includes(kind)) { setMessage('Template desconhecido.'); return; } const defaults:Record<TemplateKind,string>={article:'artigo.md','reading-note':'fichamento.md','research-project':'projeto-pesquisa.md',tcc:'tcc.md',dissertation:'dissertacao.md',thesis:'tese.md',abstract:'resumo.md','institutional-article':'artigo-institucional.md','institutional-tcc':'tcc-institucional.md'}; const path=window.prompt('Caminho do novo documento no vault:', defaults[kind]); if(path===null||path.trim()==='')return; const result=await window.academic.workspace.createDocument({path:path.trim(),content:templateSource(kind)}); if(!result.ok){setMessage(result.error.message);return;} await openDocument(result.value.fileId,result.value.path); },
      }),
      commandRegistry.register({
        id: 'symbol.rename', title: 'Renomear símbolo', isEnabled: () => viewsModel.active()?.type === 'editor',
        async run() { const active=viewsModel.active(); if(active?.type!=='editor')return; const newName=window.prompt('Novo identificador/chave:', ''); if(newName===null||newName.trim()==='')return; const result=await window.academic.language.renameSymbol({fileId:active.fileId,offset:active.snapshot.selection.head,newName,expectedRevision:active.snapshot.session.revision}); if(!result.ok) setMessage(result.error.message); else setMessage(result.value === undefined ? 'Nenhum símbolo renomeável nesta posição.' : `${result.value.label} (${result.value.changedFiles.length} documento(s)).`); },
      }),
      commandRegistry.register({
        id: 'document.rename', title: 'Renomear documento', isEnabled: () => viewsModel.active()?.type === 'editor',
        async run() { const active=viewsModel.active(); if(active?.type!=='editor')return; const path=window.prompt('Novo caminho no vault:',active.path); if(path===null||path.trim()===''||path.trim()===active.path)return; const result=await window.academic.workspace.renameDocument({fileId:active.fileId,path:path.trim(),expectedRevision:active.snapshot.session.revision}); if(!result.ok){setMessage(result.error.message);return;} setMessage(`Documento renomeado para ${result.value.path}.`); },
      }),
      commandRegistry.register({ id: 'xref.insert', title: 'Inserir referência cruzada', isEnabled: (context) => viewsModel.active()?.type === 'editor' && (context.targetCrossReference !== undefined || true), run(context) { const active=viewsModel.active(); if(active?.type!=='editor')return; if(context.targetCrossReference===undefined){setCrossReferencePicker(true);return;} const {anchor,head}=active.snapshot.selection; const text=`[[ref:${context.targetCrossReference.identifier}]]`; active.controller.dispatch({edits:[{range:{start:Math.min(anchor,head),end:Math.max(anchor,head)},text}],selection:{anchor:Math.min(anchor,head)+text.length,head:Math.min(anchor,head)+text.length}}); } }),
      commandRegistry.register({
        id: 'transclusion.insert', title: 'Incorporar documento ou seção', isEnabled: () => viewsModel.active()?.type === 'editor',
        run() { const active = viewsModel.active(); if (active?.type !== 'editor') return; const target = window.prompt('Módulo Markdown (ex.: chapters/metodo.md#Amostra):', ''); if (target === null || target.trim() === '') return; const { anchor, head } = active.snapshot.selection; const text = `![[${target.trim()}]]`; const start = Math.min(anchor, head); active.controller.dispatch({ edits: [{ range: { start, end: Math.max(anchor, head) }, text }], selection: { anchor: start + text.length, head: start + text.length } }); },
      }),
      commandRegistry.register({
        id: 'template.createModularTcc', title: 'Criar TCC modular',
        async run() {
          const directory = window.prompt('Pasta do TCC modular no vault:', 'tcc'); if (directory === null || directory.trim() === '') return;
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
  }, [commandRegistry, files, pluginContributions]);

  useEffect(
    () =>
      registerKeybindings({
        registry: commandRegistry,
        bindings: new Map([
          ['mod+s', 'document.save'],
          ['mod+w', 'document.closeActiveTab'],
          ['mod+p', 'palette.quickOpen'],
          ['mod+shift+p', 'palette.commands'],
          ['mod+shift+f', 'search.openView'],
          ['mod+shift+r', 'review.open'],
          ['mod+shift+d', 'document.compare'],
          ['mod+shift+c', 'citation.openPicker'],
          ['mod+shift+i', 'figure.insert'],
          ['mod+shift+n', 'application.newWindow'],
          ['alt+arrowleft', 'navigation.back'],
          ['alt+arrowright', 'navigation.forward'],
        ]),
        context: () => commandContextForPalette(viewsModel.active()),
        target: window,
      }),
    [commandRegistry, viewsModel],
  );

  const renderEditorDocument = (view: Extract<ViewState, { type: 'editor' }>): JSX.Element => (
    <EditorDocumentPane
      key={view.id}
      view={view}
      {...(view.id === activeEditorView?.id && writingStatistics !== undefined ? { statistics: writingStatistics } : {})}
      onError={setMessage}
      onDefinition={showDefinition}
      onReferences={(locations) => { if (locations.length === 0) setMessage('Nenhuma referência encontrada nesta posição.'); else setReferenceLocations(locations); }}
      onCitationEdit={(offset) => { viewsModel.activate(view.id); const current = editableCitationAt(view.snapshot.session.content, offset); if (current !== undefined) setCitationEditor({ initial: current.draft, range: current.range }); }}
      onAssetDropped={(uri, name) => { const offset = view.controller.snapshot().selection.head; const text = figureSource({ uri, alt: name.replace(/\.[^.]+$/u, ''), caption: '', source: '' }); view.controller.dispatch({ edits: [{ range: { start: offset, end: offset }, text: `\n${text}\n` }], selection: { anchor: offset + text.length + 2, head: offset + text.length + 2 } }); }}
      onKeepLocal={() => { void view.controller.resolveExternalConflict('keep-local').then(() => setMessage('Rascunho local mantido. Salve para aplicá-lo ao arquivo.')).catch(() => setMessage('Não foi possível manter o rascunho local.')); }}
      onReloadExternal={() => { void view.controller.resolveExternalConflict('reload-external').then(() => setMessage('Rascunho local descartado; versão externa recarregada.')).catch(() => setMessage('Não foi possível recarregar a versão externa.')); }}
    />
  );

  return (
    <main className="folio-shell grid h-screen grid-cols-[220px_minmax(0,1fr)_272px] overflow-hidden text-[14px]">
      <aside className="folio-sidebar flex min-h-0 flex-col border-r p-4">
        <div className="mb-7 flex items-center gap-3 px-1">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-600 text-base font-black text-white shadow-lg shadow-indigo-600/20">F</div>
          <div><div className="text-base font-extrabold tracking-tight text-slate-900">Folio</div><div className="text-[11px] font-medium tracking-wide text-slate-500">AMBIENTE ACADÊMICO</div></div>
        </div>
        <button
          type="button"
          className="folio-control mb-3 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium"
          onClick={() => void commandRegistry.execute('palette.commands', paletteContext)}
        >
          <span className="flex items-center gap-2"><span className="text-indigo-600">⌘</span> Command Palette</span><kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">Ctrl⇧P</kbd>
        </button>
        <button
          type="button"
          className="folio-primary mb-5 w-full rounded-xl px-3 py-2.5 text-center text-sm font-semibold disabled:cursor-wait disabled:opacity-60"
          disabled={openingVault}
          onClick={() => void commandRegistry.execute('workspace.open', {}).catch(() => setMessage('O comando de abrir vault ainda não está disponível.'))}
        >
          {openingVault ? 'Abrindo seletor…' : 'Abrir vault'}
        </button>
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Buscar no vault…"
          aria-label="Buscar no vault"
          className="mb-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 shadow-sm focus:border-indigo-400 focus:bg-white focus:outline-none"
        />
        <button type="button" disabled={workspaceId === undefined} className="folio-control mb-4 w-full rounded-xl px-3 py-2 text-left text-xs font-semibold disabled:opacity-40" onClick={() => void commandRegistry.execute('search.openView', paletteContext)}>
          Busca acadêmica avançada
        </button>
        {searchQuery.trim() !== '' ? (
          <ul aria-label="Resultados da busca" className="m-0 grid list-none gap-1 overflow-auto p-0">
            {searchResults.length === 0 ? (
              <li className="px-2 text-sm text-slate-500">Nada encontrado.</li>
            ) : (
              searchResults.map((result) => (
                <li key={result.fileId}>
                  <button
                    type="button"
                    className="w-full rounded-xl bg-transparent px-3 py-2.5 text-left hover:bg-indigo-50"
                    onClick={() => void commandRegistry.execute('document.open', { targetFile: { fileId: result.fileId, path: result.path } })}
                  >
                    <div className="text-sm truncate">{result.title}</div>
                    <div className="text-xs text-slate-400 truncate">{result.path}</div>
                    <div className="text-xs text-slate-400 mt-0.5 line-clamp-2">{renderSnippet(result.snippet)}</div>
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : (
          <>
            {recentFileIds.length > 0 && (
              <nav aria-label="Arquivos recentes" className="mb-3 grid gap-1">
                <div className="px-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Recentes</div>
                {recentFileIds.map((fileId) => files.find((file) => file.fileId === fileId)).filter((file): file is WorkspaceFileDto => file !== undefined).map((file) => (
                  <button type="button" key={file.fileId} className="w-full truncate rounded-lg bg-transparent px-3 py-1.5 text-left text-sm text-slate-600 hover:bg-indigo-50 hover:text-indigo-700" onClick={() => void commandRegistry.execute('document.open', { targetFile: { fileId: file.fileId, path: file.path } })}>{file.path}</button>
                ))}
              </nav>
            )}
            <nav aria-label="Arquivos do vault" className="grid gap-1 overflow-auto border-t border-slate-100 pt-3">
              <div className="px-2 pb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Documentos</div>
              {files.map((file) => (
              <button
                type="button"
                key={file.fileId}
                className={`w-full truncate rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                  views.some((view) => view.fileId === file.fileId) ? 'bg-indigo-50 font-medium text-indigo-700' : 'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
                onClick={() => void commandRegistry.execute('document.open', { targetFile: { fileId: file.fileId, path: file.path } })}
              >
                {file.path}
              </button>
            ))}
            </nav>
          </>
        )}
      </aside>
      <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] bg-white/50">
        <div className="folio-contextbar flex min-h-14 items-center gap-1 overflow-x-auto border-b px-3" role="tablist" aria-label="Documentos abertos">
          {views.map((view) => (
            <div className={`flex items-center rounded-lg ${view.id === activeId ? 'folio-tab-active' : 'text-slate-500 hover:bg-slate-100'}`} key={view.id}>
              <button
                type="button"
                className="rounded-none bg-transparent px-2.5 py-2 text-sm whitespace-nowrap"
                onClick={() => viewsModel.activate(view.id)}
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
          <span className="mx-1 h-5 w-px bg-slate-200" />
          <button type="button" aria-label="Voltar" title="Voltar (Alt+←)" className="folio-control grid h-8 w-8 place-items-center rounded-lg disabled:opacity-40" disabled={navigationIndex.current <= 0} onClick={() => void commandRegistry.execute('navigation.back', {})}><ToolbarIcon name="back" /></button>
          <button type="button" aria-label="Avançar" title="Avançar (Alt+→)" className="folio-control grid h-8 w-8 place-items-center rounded-lg disabled:opacity-40" disabled={navigationIndex.current < 0 || navigationIndex.current >= navigationHistory.current.length - 1} onClick={() => void commandRegistry.execute('navigation.forward', {})}><ToolbarIcon name="forward" /></button>
          <button type="button" title="Abrir editor ao lado" aria-label="Abrir editor ao lado" className="folio-control grid h-8 w-8 place-items-center rounded-lg disabled:opacity-40" disabled={activeEditorView === undefined} onClick={() => void commandRegistry.execute('view.splitEditorWithFile', {})}><ToolbarIcon name="split" /></button>
          <button
            type="button"
            className="folio-control ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold disabled:cursor-default disabled:opacity-40"
            disabled={activeEditorView === undefined}
            onClick={() => activeEditorView !== undefined && void commandRegistry.execute('publication.preview', { targetFile: { fileId: activeEditorView.fileId, path: activeEditorView.path } })}
          >
            <ToolbarIcon name="preview" /> Preview
          </button>
          <button
            type="button"
            aria-pressed={splitPreview}
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold disabled:cursor-default disabled:opacity-40 ${
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
            aria-expanded={moreActionsOpen}
            aria-label="Mais ações"
            title="Mais ações"
            className="folio-control ml-1 rounded-lg px-2.5 py-1 text-sm font-bold"
            onClick={() => setMoreActionsOpen((open) => !open)}
          >
            •••
          </button>
        </div>
        {activeView === undefined ? (
          <div className="grid place-items-center bg-[radial-gradient(circle_at_center,_#eef2ff,_transparent_55%)] px-8 text-center">
            <div className="max-w-md"><div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-white text-xl text-indigo-600 shadow-sm ring-1 ring-slate-200">⌘</div><h1 className="text-lg font-bold tracking-tight text-slate-900">Pronto para escrever</h1><p className="mt-2 text-sm leading-6 text-slate-500">Abra um documento do vault ou use a Command Palette para começar.</p></div>
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
      <aside className="folio-panel flex min-h-0 flex-col gap-4 border-l p-4">
        <div className="flex items-center justify-between"><div><div className="text-sm font-bold text-slate-900">Contexto</div><div className="text-[11px] text-slate-500">do documento ativo</div></div><span className="rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-indigo-600">Folio</span></div>
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Painéis">
          {panelRegistry.list().map((panel) => (
            <button
              key={panel.id}
              type="button"
              className={`min-w-0 rounded-lg px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-wide ${
                panel.id === activePanelId ? 'bg-white text-indigo-700 shadow-sm' : 'bg-transparent text-slate-500 hover:text-slate-800'
              }`}
              onClick={() => setActivePanelId(panel.id)}
            >
              {panel.title}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-100 bg-white/60 p-2">
          {activePanel && (
            <activePanel.render
              view={activeEditorView}
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
        </div>
        <p className="mt-auto rounded-xl border border-slate-100 bg-white px-3 py-2 text-xs leading-5 text-slate-500 shadow-sm">{message}</p>
      </aside>
      {moreActionsOpen && (
        <div className="folio-actions-menu fixed right-[18rem] top-14 z-40 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/12" role="menu" aria-label="Mais ações">
          <button type="button" role="menuitem" className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700" onClick={() => { setMoreActionsOpen(false); void commandRegistry.execute('application.newWindow', {}); }}>Nova janela</button>
          <button type="button" role="menuitem" disabled={workspaceId === undefined} className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-40" onClick={() => { setMoreActionsOpen(false); void commandRegistry.execute('knowledge.open', {}); }}>Knowledge Workspace</button>
          <button type="button" role="menuitem" disabled={workspaceId === undefined} className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-40" onClick={() => { setMoreActionsOpen(false); void commandRegistry.execute('research.open', {}); }}>Fluxo de pesquisa</button>
          <button type="button" role="menuitem" disabled={activeEditorView === undefined || writingStatistics === undefined} className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-40" onClick={() => { setMoreActionsOpen(false); void commandRegistry.execute('writing.open', {}); }}>Escrita acadêmica</button>
          <button type="button" role="menuitem" disabled={workspaceId === undefined} className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-40" onClick={() => { setMoreActionsOpen(false); void commandRegistry.execute('library.maintenance', {}); }}>Qualidade da biblioteca</button>
          <div className="my-1 border-t border-slate-100" />
          <button type="button" role="menuitem" disabled={activeEditorView === undefined} className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-40" onClick={() => { setMoreActionsOpen(false); void commandRegistry.execute('problems.open', {}); }}>Problemas</button>
          <button type="button" role="menuitem" disabled={workspaceId === undefined} className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-40" onClick={() => { setMoreActionsOpen(false); void commandRegistry.execute('review.open', {}); }}>Modo de revisão</button>
          <button type="button" role="menuitem" disabled={workspaceId === undefined} className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-40" onClick={() => { setMoreActionsOpen(false); void commandRegistry.execute('plugins.manage', {}); }}>Plugins locais</button>
          <button type="button" role="menuitem" disabled={files.length < 2} className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-40" onClick={() => { setMoreActionsOpen(false); void commandRegistry.execute('document.compare', {}); }}>Comparar documentos</button>
          <button type="button" role="menuitem" disabled={activeEditorView === undefined} className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-40" onClick={() => { setMoreActionsOpen(false); void commandRegistry.execute('profile.select', {}); }}>Perfil</button>
          <div className="my-1 border-t border-slate-100" />
          <button type="button" role="menuitem" disabled={activeView === undefined} className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-40" onClick={() => { setMoreActionsOpen(false); if (activeView !== undefined) void commandRegistry.execute('document.exportPdf', { activeViewId: activeView.id }); }}>Exportar PDF</button>
          <button type="button" role="menuitem" disabled={activeView === undefined} className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-40" onClick={() => { setMoreActionsOpen(false); if (activeView !== undefined) void commandRegistry.execute('document.exportDocx', { activeViewId: activeView.id }); }}>Exportar DOCX</button>
          <div className="my-1 border-t border-slate-100" />
          <button type="button" role="menuitem" className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700" onClick={() => { setMoreActionsOpen(false); void commandRegistry.execute('application.systemInformation', {}).catch(() => setMessage('Não foi possível ler as informações do sistema.')); }}>Ajuda e informações</button>
        </div>
      )}
      {systemInformation !== undefined && <SystemInformationDialog information={systemInformation} onClose={() => setSystemInformation(undefined)} />}
      {referenceLocations !== undefined && <LocationsDialog locations={referenceLocations} onNavigate={(location) => void navigateToLocation(location)} onClose={() => setReferenceLocations(undefined)} />}
      {paletteMode !== undefined && (
        <PaletteDialog
          mode={paletteMode}
          files={files}
          recentFileIds={recentFileIds}
          commandRegistry={commandRegistry}
          commandContext={paletteContext}
          onClose={() => setPaletteMode(undefined)}
          onCommand={(id) => {
            setPaletteMode(undefined);
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
        onOpenProblem={(problem) => { void openDocument(problem.fileId, problem.path, { remember: true }).then((controller) => { if (controller !== undefined && problem.range !== undefined) controller.dispatch({ selection: { anchor: problem.range.start, head: problem.range.end } }); }); }}
        onApplyEdit={(edit) => { const active = viewsModel.active(); if (active?.type !== 'editor' || active.fileId !== edit.fileId || active.snapshot.session.revision !== edit.expectedRevision) { setMessage('A correção ficou desatualizada; reabra o problema antes de aplicá-la.'); return; } active.controller.dispatch({ edits: edit.edits }); }}
      />}
      {citationEditor !== undefined && activeEditorView !== undefined && (
        <CitationDialog
          fileId={activeEditorView.fileId}
          initial={citationEditor.initial}
          replaceRange={citationEditor.range}
          onClose={() => setCitationEditor(undefined)}
          onApply={(range, text) => {
            setCitationEditor(undefined);
            void commandRegistry.execute('citation.insert', { targetCitation: { range, text } });
          }}
        />
      )}
      {diagnosticsCenter && activeEditorView !== undefined && <DiagnosticsCenter view={activeEditorView} onClose={() => setDiagnosticsCenter(false)} onCreateMissingReference={(id) => { void window.academic.library.upsert({ entry: { id, type: 'article', title: '[Preencher título]' } }).then((result) => { setMessage(result.ok ? `Referência ${id} criada; complete seus dados na biblioteca.` : result.error.message); if (result.ok) setReferenceLibraryEditor(true); }); }} />}
      {metadataEditor && activeEditorView !== undefined && <MetadataDialog view={activeEditorView} onClose={() => setMetadataEditor(false)} />}
      {profileSelector && activeEditorView !== undefined && <ProfileDialog view={activeEditorView} onClose={() => setProfileSelector(false)} />}
      {problemsPanel && activeEditorView !== undefined && <ProblemsDialog view={activeEditorView} onClose={() => setProblemsPanel(false)} />}
      {crossReferencePicker && activeEditorView !== undefined && <CrossReferenceDialog view={activeEditorView} onClose={()=>setCrossReferencePicker(false)} onInsert={(identifier)=>{setCrossReferencePicker(false);void commandRegistry.execute('xref.insert',{targetCrossReference:{identifier}});}} />}
      {graphView && <GraphDialog {...(activeEditorView === undefined ? {} : { activeFileId: activeEditorView.fileId })} onClose={() => setGraphView(false)} onOpenDocument={(fileId, path) => void openDocument(fileId, path)} />}
      {historyOpen && activeEditorView !== undefined && <HistoryDialog fileId={activeEditorView.fileId} path={activeEditorView.path} onClose={() => setHistoryOpen(false)} />}
      {documentComparisonOpen && <DocumentComparisonDialog files={files} {...(activeEditorView === undefined ? {} : { initialFileId: activeEditorView.fileId })} onClose={() => setDocumentComparisonOpen(false)} />}
      {pluginManagerOpen && <PluginManagerDialog onClose={() => setPluginManagerOpen(false)} onChanged={setPluginContributions} />}
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
      {writingWorkflowOpen && workspaceId !== undefined && activeEditorView !== undefined && writingStatistics !== undefined && <WritingWorkflowDialog workspaceId={workspaceId} fileId={activeEditorView.fileId} profileId={metadataFromSource(activeEditorView.snapshot.session.content).profile || 'abnt-artigo'} outline={activeEditorView.snapshot.outline} diagnostics={activeEditorView.snapshot.diagnostics} statistics={writingStatistics} onClose={() => setWritingWorkflowOpen(false)} onNavigate={(offset) => activeEditorView.controller.dispatch({ selection: { anchor: offset, head: offset } })} />}
      {referenceMaintenanceOpen && <ReferenceMaintenanceDialog onClose={() => setReferenceMaintenanceOpen(false)} />}
      {referenceLibraryEditor && <ReferenceLibraryDialog onClose={() => setReferenceLibraryEditor(false)} onOpenLiteratureNote={(fileId, path) => { setReferenceLibraryEditor(false); void openDocument(fileId, path); }} />}
      {referenceHealth && <ReferenceHealthDialog onClose={() => setReferenceHealth(false)} />}
      {tableEditor !== undefined && activeEditorView !== undefined && <TableDialog {...(tableEditor.initial === undefined ? {} : { initial: tableEditor.initial })} onClose={() => setTableEditor(undefined)} onApply={(text) => { const start = tableEditor.range.start; activeEditorView.controller.dispatch({ edits: [{ range: tableEditor.range, text }], selection: { anchor: start + text.length, head: start + text.length } }); setTableEditor(undefined); }} />}
    </main>
  );
}
