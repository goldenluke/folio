import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import type { BookmarkTargetDto, WorkspaceAcademicViewDto, WorkspaceBookmarkDto, WorkspaceFileDto } from '@abnt/protocol';
import { auditSurface, navigationTree, peekSummary, recordRecent, type PeekEntity, type RecentEntity } from '@abnt/workspace-polish';
import type { CommandRegistry } from './shell/commands.js';
import { readResearchProjects, type ResearchProject } from './research-projects.js';
import { useDialogAccessibility } from './dialog-accessibility.js';

const key = (workspaceId: string) => `folio.recent-entities:${workspaceId}`;
const readRecents = (workspaceId: string): readonly RecentEntity[] => { try { const value: unknown = JSON.parse(window.localStorage.getItem(key(workspaceId)) ?? '[]'); return Array.isArray(value) ? value.filter((item): item is RecentEntity => typeof item === 'object' && item !== null && typeof (item as { id?: unknown }).id === 'string' && typeof (item as { kind?: unknown }).kind === 'string' && typeof (item as { visitedAt?: unknown }).visitedAt === 'number') : []; } catch { return []; } };

type SavedSearchRow = { readonly id: string; readonly name: string; readonly query: string };

const bookmarkKinds: readonly { readonly value: BookmarkTargetDto['kind']; readonly label: string }[] = [
  { value: 'document', label: 'Documento' }, { value: 'section', label: 'Seção' }, { value: 'reference', label: 'Referência' }, { value: 'annotation', label: 'Anotação' },
  { value: 'project', label: 'Projeto' }, { value: 'view', label: 'View' }, { value: 'search', label: 'Busca salva' }, { value: 'dataset', label: 'Dataset' },
];
interface BookmarkDraft { readonly kind: BookmarkTargetDto['kind']; readonly label: string; readonly fileId: string; readonly path: string; readonly offset: string; readonly referenceId: string; readonly annotationId: string; readonly projectId: string; readonly viewId: string; readonly query: string; readonly datasetId: string; }
const emptyBookmarkDraft = (): BookmarkDraft => ({ kind: 'document', label: '', fileId: '', path: '', offset: '', referenceId: '', annotationId: '', projectId: '', viewId: '', query: '', datasetId: '' });
const draftTarget = (draft: BookmarkDraft): BookmarkTargetDto | undefined => {
  if (draft.kind === 'document') return draft.fileId.trim() === '' || draft.path.trim() === '' ? undefined : { kind: 'document', fileId: draft.fileId.trim(), path: draft.path.trim() };
  if (draft.kind === 'section') { const offset = Number(draft.offset); return draft.fileId.trim() === '' || draft.path.trim() === '' || !Number.isFinite(offset) ? undefined : { kind: 'section', fileId: draft.fileId.trim(), path: draft.path.trim(), offset }; }
  if (draft.kind === 'reference') return draft.referenceId.trim() === '' ? undefined : { kind: 'reference', referenceId: draft.referenceId.trim() };
  if (draft.kind === 'annotation') return draft.referenceId.trim() === '' || draft.annotationId.trim() === '' ? undefined : { kind: 'annotation', referenceId: draft.referenceId.trim(), annotationId: draft.annotationId.trim() };
  if (draft.kind === 'project') return draft.projectId.trim() === '' ? undefined : { kind: 'project', projectId: draft.projectId.trim() };
  if (draft.kind === 'view') return draft.viewId.trim() === '' ? undefined : { kind: 'view', viewId: draft.viewId.trim() };
  if (draft.kind === 'search') return draft.query.trim() === '' ? undefined : { kind: 'search', query: draft.query.trim() };
  return draft.datasetId.trim() === '' ? undefined : { kind: 'dataset', datasetId: draft.datasetId.trim() };
};
const describeBookmarkTarget = (target: BookmarkTargetDto): string => target.kind === 'document' ? target.path : target.kind === 'section' ? `${target.path} @ ${target.offset}` : target.kind === 'reference' ? target.referenceId : target.kind === 'annotation' ? `${target.referenceId} · anotação` : target.kind === 'project' ? target.projectId : target.kind === 'view' ? target.viewId : target.kind === 'search' ? target.query : target.datasetId;

function Empty({ title, text }: { readonly title: string; readonly text: string }): JSX.Element { return <div className="grid h-64 place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center"><div><h3 className="font-bold text-slate-800">{title}</h3><p className="mt-1 text-sm text-slate-500">{text}</p></div></div>; }

const journalDateFromPath = (path: string): string | undefined => /^journal\/(\d{4}-\d{2}-\d{2})\.md$/u.exec(path)?.[1];

/** Só dias com entrada existente ficam clicáveis — criar para data arbitrária não tem UI nesta onda. */
function JournalCalendar({ year, month, entries, onPrev, onNext, onOpen }: { readonly year: number; readonly month: number; readonly entries: ReadonlyMap<string, WorkspaceFileDto>; readonly onPrev: () => void; readonly onNext: () => void; readonly onOpen: (file: WorkspaceFileDto) => void }): JSX.Element {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const label = new Date(year, month, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const cells: readonly (number | undefined)[] = [...(Array.from({ length: firstWeekday }, () => undefined) as undefined[]), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)];
  return <div className="rounded-xl border border-slate-200 p-3">
    <div className="flex items-center"><button type="button" aria-label="Mês anterior" className="rounded px-2 py-1 text-sm text-slate-500 hover:bg-slate-100" onClick={onPrev}>‹</button><span className="flex-1 text-center text-sm font-semibold capitalize text-slate-800">{label}</span><button type="button" aria-label="Próximo mês" className="rounded px-2 py-1 text-sm text-slate-500 hover:bg-slate-100" onClick={onNext}>›</button></div>
    <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-slate-400">{['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, index) => <span key={index}>{day}</span>)}</div>
    <div className="mt-1 grid grid-cols-7 gap-1">{cells.map((day, index) => {
      if (day === undefined) return <span key={index} />;
      const file = entries.get(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
      return file === undefined
        ? <span key={index} className="grid h-8 place-items-center rounded-lg text-sm text-slate-300">{day}</span>
        : <button type="button" key={index} className="grid h-8 place-items-center rounded-lg bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-500" onClick={() => onOpen(file)}>{day}</button>;
    })}</div>
  </div>;
}

export function WorkspaceNavigationDialog({ workspaceId, files, searches, commandRegistry, onOpenFile, onClose }: { readonly workspaceId: string; readonly files: readonly WorkspaceFileDto[]; readonly searches: readonly SavedSearchRow[]; readonly commandRegistry: CommandRegistry; readonly onOpenFile: (file: WorkspaceFileDto) => void; readonly onClose: () => void }): JSX.Element {
  const dialog = useRef<HTMLElement>(null);
  const [section, setSection] = useState('files');
  const [recents, setRecents] = useState(() => readRecents(workspaceId));
  const [peek, setPeek] = useState<PeekEntity | undefined>();
  const [views, setViews] = useState<readonly WorkspaceAcademicViewDto[]>([]);
  const [bookmarks, setBookmarks] = useState<readonly WorkspaceBookmarkDto[]>([]);
  const [bookmarkDraft, setBookmarkDraft] = useState<BookmarkDraft>(emptyBookmarkDraft);
  const peekCall = useRef(0);
  const [calendar, setCalendar] = useState(() => { const now = new Date(); return { year: now.getFullYear(), month: now.getMonth() }; });
  useDialogAccessibility(dialog, onClose);
  const projects = useMemo<readonly ResearchProject[]>(() => readResearchProjects(workspaceId), [workspaceId]);
  const journalEntries = useMemo(() => files.filter((file) => journalDateFromPath(file.path) !== undefined).sort((a, b) => b.path.localeCompare(a.path)), [files]);
  const journalByDate = useMemo(() => new Map(journalEntries.map((file) => [journalDateFromPath(file.path)!, file])), [journalEntries]);
  useEffect(() => {
    void window.academic.workspace.academicViews().then((result) => { if (result.ok) setViews(result.value.views); });
    void window.academic.workspace.bookmarks().then((result) => { if (result.ok) setBookmarks(result.value.bookmarks); });
  }, []);
  const items = useMemo(
    () => navigationTree({ files: files.length, projects: projects.length, views: views.length, bookmarks: bookmarks.length, 'saved-searches': searches.length, journal: journalEntries.length }),
    [files.length, projects.length, views.length, bookmarks.length, searches.length, journalEntries.length],
  );
  const open = (file: WorkspaceFileDto): void => { const item = { kind: 'document' as const, id: file.fileId, visitedAt: Date.now() }; const next = recordRecent(recents, item); setRecents(next); window.localStorage.setItem(key(workspaceId), JSON.stringify(next)); onOpenFile(file); };
  /**
   * F319–F325: document/section/reference/annotation resolvem de verdade no
   * host (Peek Service); project/view/search resolvem localmente com o que
   * o diálogo já mantém em memória; dataset não tem entidade nenhuma para
   * resumir (mesma nota da Onda AS sobre `uses-dataset`).
   */
  const peekForTarget = (target: BookmarkTargetDto): void => {
    if (target.kind === 'document' || target.kind === 'section' || target.kind === 'reference' || target.kind === 'annotation') {
      const id = ++peekCall.current;
      void window.academic.workspace.peek({ target }).then((result) => { if (id === peekCall.current) setPeek(result.ok ? result.value.entity : undefined); });
      return;
    }
    if (target.kind === 'project') { const project = projects.find((item) => item.id === target.projectId); setPeek(project === undefined ? undefined : { kind: 'project', id: project.id, title: project.title, excerpt: `${project.documentIds.length} documento(s)` }); return; }
    if (target.kind === 'view') { const view = views.find((item) => item.id === target.viewId); setPeek(view === undefined ? undefined : { kind: 'view', id: view.id, title: view.name, excerpt: `${view.source} · ${view.layout}` }); return; }
    if (target.kind === 'search') { const search = searches.find((item) => item.query === target.query); setPeek(search === undefined ? undefined : { kind: 'search', id: search.id, title: search.name, excerpt: search.query }); return; }
    setPeek(undefined);
  };
  const setDraftField = (field: keyof BookmarkDraft, value: string): void => setBookmarkDraft((current) => ({ ...current, [field]: value }));
  const addBookmark = async (): Promise<void> => {
    const target = draftTarget(bookmarkDraft);
    if (target === undefined || bookmarkDraft.label.trim() === '') return;
    const bookmark: WorkspaceBookmarkDto = { version: 1, id: crypto.randomUUID(), label: bookmarkDraft.label.trim(), target, createdAt: new Date().toISOString() };
    const result = await window.academic.workspace.setBookmarks({ version: 1, bookmarks: [...bookmarks, bookmark] });
    if (result.ok) { setBookmarks(result.value.bookmarks); setBookmarkDraft(emptyBookmarkDraft()); }
  };
  const removeBookmark = async (id: string): Promise<void> => {
    await commandRegistry.execute('bookmark.remove', { targetBookmark: { id } });
    const result = await window.academic.workspace.bookmarks();
    if (result.ok) setBookmarks(result.value.bookmarks);
  };
  const missing = auditSurface({ keyboard: true, focus: true, loading: true, error: true, empty: true, destructiveActions: true, dragDrop: true, contextMenu: true, peek: true });
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-5"><section ref={dialog} role="dialog" aria-modal="true" aria-labelledby="workspace-navigation-title" className="grid h-[min(78vh,44rem)] w-full max-w-4xl grid-cols-[12rem_minmax(0,1fr)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"><aside className="border-r border-slate-200 bg-slate-50 p-3"><div className="flex items-center"><h2 id="workspace-navigation-title" className="font-bold text-slate-900">Workspace</h2><button type="button" aria-label="Fechar navegação do workspace" className="ml-auto text-lg text-slate-500" onClick={onClose}>×</button></div><nav className="mt-4 grid gap-1" aria-label="Navegação do workspace">{items.map((item) => <button key={item.id} type="button" onClick={() => setSection(item.id)} className={`rounded-lg px-3 py-2 text-left text-sm ${section === item.id ? 'bg-indigo-600 font-semibold text-white' : 'text-slate-700 hover:bg-slate-200'}`}>{item.label}{item.count === undefined ? null : <span className="float-right opacity-70">{item.count}</span>}</button>)}</nav></aside><main className="min-w-0 overflow-auto p-6">
    {section === 'files' ? <><h3 className="text-lg font-bold text-slate-900">Arquivos</h3><p className="mt-1 text-sm text-slate-500">Passe o cursor para conferir o Peek; abra para registrar na recência.</p><div className="mt-4 grid gap-2">{files.filter((file) => file.path.endsWith('.md')).map((file) => <div key={file.fileId} className="flex items-center rounded-xl border border-slate-200 p-3"><button type="button" className="min-w-0 flex-1 text-left" onMouseEnter={() => peekForTarget({ kind: 'document', fileId: file.fileId, path: file.path })} onFocus={() => peekForTarget({ kind: 'document', fileId: file.fileId, path: file.path })} onClick={() => open(file)}><strong className="block truncate text-sm text-slate-800">{file.path}</strong><span className="text-xs text-slate-500">revisão {file.revision}</span></button></div>)}</div></>
    : section === 'projects' ? (projects.length === 0 ? <Empty title="Projetos" text="Crie um projeto de pesquisa para ele aparecer aqui." /> : <><h3 className="text-lg font-bold text-slate-900">Projetos</h3><div className="mt-4 grid gap-2">{projects.map((project) => <button type="button" key={project.id} className="w-full rounded-xl border border-slate-200 p-3 text-left" onMouseEnter={() => peekForTarget({ kind: 'project', projectId: project.id })} onFocus={() => peekForTarget({ kind: 'project', projectId: project.id })}><strong className="block truncate text-sm text-slate-800">{project.title}</strong><span className="text-xs text-slate-500">{project.documentIds.length} documento(s) · atualizado em {project.updatedAt.slice(0, 10)}</span></button>)}</div></>)
    : section === 'views' ? (views.length === 0 ? <Empty title="Views" text="Crie uma Academic View para ela aparecer aqui." /> : <><h3 className="text-lg font-bold text-slate-900">Views</h3><div className="mt-4 grid gap-2">{views.map((view) => <button type="button" key={view.id} className="w-full rounded-xl border border-slate-200 p-3 text-left" onMouseEnter={() => peekForTarget({ kind: 'view', viewId: view.id })} onFocus={() => peekForTarget({ kind: 'view', viewId: view.id })}><strong className="block truncate text-sm text-slate-800">{view.name}</strong><span className="text-xs text-slate-500">{view.source} · {view.layout}</span></button>)}</div></>)
    : section === 'bookmarks' ? <><h3 className="text-lg font-bold text-slate-900">Bookmarks</h3><p className="mt-1 text-sm text-slate-500">Apontam para entidades existentes; nada é copiado.</p><div className="mt-4 grid gap-2">{bookmarks.length === 0 ? <p className="text-sm text-slate-500">Nenhum bookmark ainda.</p> : bookmarks.map((bookmark) => <div key={bookmark.id} className="flex items-center gap-2 rounded-xl border border-slate-200 p-3" onMouseEnter={() => peekForTarget(bookmark.target)} onFocus={() => peekForTarget(bookmark.target)}><div className="min-w-0 flex-1"><strong className="block truncate text-sm text-slate-800">{bookmark.label}</strong><span className="block truncate text-xs text-slate-500">{bookmark.target.kind} · {describeBookmarkTarget(bookmark.target)}</span></div><button type="button" className="shrink-0 text-xs font-semibold text-rose-600" onClick={() => void removeBookmark(bookmark.id)}>Remover</button></div>)}</div><div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Novo bookmark</p><div className="mt-2 grid gap-2 sm:grid-cols-2"><input value={bookmarkDraft.label} placeholder="Nome do bookmark" onChange={(event) => setDraftField('label', event.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm" /><select value={bookmarkDraft.kind} onChange={(event) => setBookmarkDraft({ ...emptyBookmarkDraft(), kind: event.target.value as BookmarkTargetDto['kind'], label: bookmarkDraft.label })} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm">{bookmarkKinds.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>{(bookmarkDraft.kind === 'document' || bookmarkDraft.kind === 'section') && <><input value={bookmarkDraft.fileId} placeholder="fileId" onChange={(event) => setDraftField('fileId', event.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm" /><input value={bookmarkDraft.path} placeholder="caminho" onChange={(event) => setDraftField('path', event.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm" /></>}{bookmarkDraft.kind === 'section' && <input value={bookmarkDraft.offset} placeholder="offset" onChange={(event) => setDraftField('offset', event.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm" />}{(bookmarkDraft.kind === 'reference' || bookmarkDraft.kind === 'annotation') && <input value={bookmarkDraft.referenceId} placeholder="referenceId" onChange={(event) => setDraftField('referenceId', event.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm" />}{bookmarkDraft.kind === 'annotation' && <input value={bookmarkDraft.annotationId} placeholder="annotationId" onChange={(event) => setDraftField('annotationId', event.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm" />}{bookmarkDraft.kind === 'project' && <input value={bookmarkDraft.projectId} placeholder="projectId" onChange={(event) => setDraftField('projectId', event.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm" />}{bookmarkDraft.kind === 'view' && <input value={bookmarkDraft.viewId} placeholder="viewId" onChange={(event) => setDraftField('viewId', event.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm" />}{bookmarkDraft.kind === 'search' && <input value={bookmarkDraft.query} placeholder="query" onChange={(event) => setDraftField('query', event.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm" />}{bookmarkDraft.kind === 'dataset' && <input value={bookmarkDraft.datasetId} placeholder="datasetId" onChange={(event) => setDraftField('datasetId', event.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm" />}</div><button type="button" className="folio-primary mt-2 rounded-lg px-3 py-1.5 text-sm font-semibold" onClick={() => void addBookmark()}>Adicionar bookmark</button></div></>
    : section === 'saved-searches' ? (searches.length === 0 ? <Empty title="Buscas salvas" text="Salve uma busca acadêmica para ela aparecer aqui." /> : <><h3 className="text-lg font-bold text-slate-900">Buscas salvas</h3><div className="mt-4 grid gap-2">{searches.map((search) => <button type="button" key={search.id} className="w-full rounded-xl border border-slate-200 p-3 text-left" onMouseEnter={() => peekForTarget({ kind: 'search', query: search.query })} onFocus={() => peekForTarget({ kind: 'search', query: search.query })}><strong className="block truncate text-sm text-slate-800">{search.name}</strong><code className="block truncate text-xs text-slate-500">{search.query}</code></button>)}</div></>)
    : section === 'journal' ? <><h3 className="text-lg font-bold text-slate-900">Diário de pesquisa</h3><p className="mt-1 text-sm text-slate-500">Uma nota por dia; dias com entrada aparecem destacados.</p><div className="mt-4 grid gap-4 sm:grid-cols-[16rem_minmax(0,1fr)]"><JournalCalendar year={calendar.year} month={calendar.month} entries={journalByDate} onPrev={() => setCalendar((current) => current.month === 0 ? { year: current.year - 1, month: 11 } : { year: current.year, month: current.month - 1 })} onNext={() => setCalendar((current) => current.month === 11 ? { year: current.year + 1, month: 0 } : { year: current.year, month: current.month + 1 })} onOpen={open} />{journalEntries.length === 0 ? <p className="text-sm text-slate-500">Nenhuma entrada de diário ainda.</p> : <div className="grid gap-2 self-start">{journalEntries.map((file) => <button type="button" key={file.fileId} className="w-full rounded-xl border border-slate-200 p-3 text-left" onClick={() => open(file)}><strong className="block text-sm text-slate-800">{journalDateFromPath(file.path)}</strong></button>)}</div>}</div><button type="button" className="folio-primary mt-4 rounded-lg px-3 py-1.5 text-sm font-semibold" onClick={() => { onClose(); void commandRegistry.execute('journal.openToday', {}); }}>Abrir hoje</button></>
    : <Empty title="Canvases" text="Canvases acadêmicos chegam numa onda futura (Research Canvas Desktop); esta categoria já existe na navegação, mas ainda não tem conteúdo real." />}
    <section className="mt-6 rounded-xl border border-indigo-100 bg-indigo-50 p-4"><h4 className="text-xs font-bold uppercase tracking-wide text-indigo-700">Quick Peek</h4><p className="mt-1 text-sm text-indigo-950">{peek === undefined ? 'Selecione ou foque um item para pré-visualizar sem navegar.' : peekSummary(peek)}</p></section><section className="mt-4"><h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Recentes</h4><p className="mt-1 text-sm text-slate-600">{recents.length === 0 ? 'Nenhuma entidade recente.' : `${recents.length} entidade(s) recente(s).`}</p></section><p className="mt-5 text-xs text-slate-400">Auditoria de consistência: {missing.length === 0 ? 'todos os critérios ativos.' : `pendente: ${missing.join(', ')}.`}</p></main></section></div>;
}
