import { useEffect, useState, type JSX } from 'react';

import { createHomeBlock, HOME_BLOCK_KINDS, reorderHomeBlocks } from '@abnt/page-workspace';
import type { WorkspaceBookmarkDto, WorkspaceFileDto, WorkspaceHomeBlockDto, WorkspaceHomeLayoutDto, WorkspacePageDto } from '@abnt/protocol';

import { FolioLogo } from './folio-logo.js';
import { type ResearchProject } from './research-projects.js';
import { activityLabel, type WorkspaceActivity } from './shell/workspace-cohesion.js';

const date = (value: string): string => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
const dueDate = (value: string): string => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(`${value}T12:00:00`));
const span = (value: 1 | 2 | 3): string => value === 1 ? 'lg:col-span-1' : value === 2 ? 'lg:col-span-2' : 'lg:col-span-3';
const readQueue = (workspaceId: string): Readonly<Record<string, 'to-read' | 'reading' | 'read' | 'reviewed'>> => { try { const raw: unknown = JSON.parse(window.localStorage.getItem(`folio.reading-queue:${workspaceId}`) ?? '{}'); if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return {}; return Object.fromEntries(Object.entries(raw).flatMap(([id, value]) => { const state = typeof value === 'object' && value !== null ? (value as { state?: unknown }).state : value; return state === 'to-read' || state === 'reading' || state === 'read' || state === 'reviewed' ? [[id, state]] : []; })); } catch { return {}; } };

export function WorkspaceHome({ workspaceId, files, recentFileIds, activities, onboardingVisible, pluginHomeBlocks = [], onOpenFile, onCommand, onDismissOnboarding }: {
  readonly workspaceId: string; readonly files: readonly WorkspaceFileDto[]; readonly recentFileIds: readonly string[]; readonly activities: readonly WorkspaceActivity[]; readonly onboardingVisible: boolean;
  readonly pluginHomeBlocks?: readonly { readonly pluginId: string; readonly id: string; readonly title: string; readonly body: string }[];
  readonly onOpenFile: (fileId: string, path: string) => void; readonly onCommand: (id: string) => void; readonly onDismissOnboarding: () => void;
}): JSX.Element {
  const [layout, setLayout] = useState<WorkspaceHomeLayoutDto>();
  const [pages, setPages] = useState<readonly WorkspacePageDto[]>([]);
  const [projects, setProjects] = useState<readonly ResearchProject[]>([]);
  const [bookmarks, setBookmarks] = useState<readonly WorkspaceBookmarkDto[]>([]);
  const [editing, setEditing] = useState(false);
  const [draggedBlockId, setDraggedBlockId] = useState<string>();
  const [dropTargetId, setDropTargetId] = useState<string>();
  const [message, setMessage] = useState<string>();
  const recent = recentFileIds.map((id) => files.find((file) => file.fileId === id)).filter((file): file is WorkspaceFileDto => file !== undefined);
  const tasks = pages.flatMap((page) => page.tasks.filter((task) => !task.completed).map((task) => ({ page, task }))).sort((left, right) => (left.task.due ?? '9999-12-31').localeCompare(right.task.due ?? '9999-12-31'));

  useEffect(() => {
    let cancelled = false;
    void Promise.all([window.academic.workspace.homeLayout(), window.academic.workspace.pages(), window.academic.workspace.researchProjects(), window.academic.workspace.bookmarks()]).then(([home, pageList, loadedProjects, loadedBookmarks]) => {
      if (cancelled) return;
      if (home.ok) setLayout(home.value); else setMessage(home.error.message);
      if (pageList.ok) setPages(pageList.value.pages); else setMessage(pageList.error.message);
      if (loadedProjects.ok) setProjects(loadedProjects.value.projects.flatMap((project) => typeof project.id === 'string' && typeof project.title === 'string' && typeof project.createdAt === 'string' && typeof project.updatedAt === 'string' ? [project as unknown as ResearchProject] : []).filter((project) => project.archivedAt === undefined)); else setMessage(loadedProjects.error.message);
      if (loadedBookmarks.ok) setBookmarks(loadedBookmarks.value.bookmarks); else setMessage(loadedBookmarks.error.message);
    });
    return () => { cancelled = true; };
  }, [workspaceId]);

  const save = async (next: WorkspaceHomeLayoutDto): Promise<void> => {
    setLayout(next);
    const result = await window.academic.workspace.setHomeLayout(next);
    if (!result.ok) setMessage(result.error.message); else setLayout(result.value);
  };
  const move = (index: number, direction: -1 | 1): void => {
    if (layout === undefined || index + direction < 0 || index + direction >= layout.blocks.length) return;
    const blocks = [...layout.blocks]; const current = blocks[index]!; blocks[index] = blocks[index + direction]!; blocks[index + direction] = current;
    void save({ ...layout, blocks });
  };
  const reorder = (fromId: string, toId: string): void => {
    if (layout === undefined) return;
    void save(reorderHomeBlocks(layout, fromId, toId));
  };
  const patchBlock = (id: string, patch: Partial<WorkspaceHomeBlockDto>): void => {
    if (layout === undefined) return;
    void save({ ...layout, blocks: layout.blocks.map((block) => block.id === id ? { ...block, ...patch } : block) });
  };
  const addBlock = (kind: typeof HOME_BLOCK_KINDS[number]): void => {
    if (layout === undefined || layout.blocks.some((block) => block.kind === kind)) return;
    void save({ ...layout, blocks: [...layout.blocks, createHomeBlock(kind)] });
  };
  const openBookmark = (bookmark: WorkspaceBookmarkDto): void => {
    if (bookmark.target.kind === 'document' || bookmark.target.kind === 'section') {
      onOpenFile(bookmark.target.fileId, bookmark.target.path);
      return;
    }
    onCommand('workspace.navigation');
  };
  const importLegacyReadingQueue = (): void => {
    const entries = readQueue(workspaceId);
    if (Object.keys(entries).length === 0) { setMessage('Não há fila de leitura legada neste navegador para importar.'); return; }
    void window.academic.workspace.importLegacyReadingQueue({ entries }).then((result) => {
      if (!result.ok) { setMessage(result.error.message); return; }
      window.localStorage.removeItem(`folio.reading-queue:${workspaceId}`);
      setMessage(`${result.value.imported} item(ns) da fila importado(s); ${result.value.skipped} já existia(m).`);
    });
  };

  const blockContent = (block: WorkspaceHomeBlockDto): JSX.Element => {
    switch (block.kind) {
      case 'recent': return <ul className="grid gap-2">{recent.length === 0 ? <Empty text="Nenhum documento aberto recentemente." /> : recent.slice(0, 5).map((file) => <li key={file.fileId}><button type="button" className="folio-home-row" onClick={() => onOpenFile(file.fileId, file.path)}><strong>{file.path}</strong><span>Continuar escrevendo</span></button></li>)}</ul>;
      case 'favorites': return <ul className="grid gap-2">{bookmarks.length === 0 ? <Empty text="Marque um documento como favorito para mantê-lo por perto." /> : bookmarks.slice(0, 6).map((bookmark) => <li key={bookmark.id}><button type="button" className="folio-home-row" onClick={() => openBookmark(bookmark)}><strong>{bookmark.label}</strong><span>{bookmark.target.kind === 'document' || bookmark.target.kind === 'section' ? bookmark.target.path : bookmark.target.kind}</span></button></li>)}</ul>;
      case 'documents': return <ul className="grid gap-2">{pages.length === 0 ? <Empty text="Converta um Markdown em página para organizar propriedades e tarefas." /> : pages.slice(0, 6).map((page) => <li key={page.file.fileId}><button type="button" className="folio-home-row" onClick={() => onOpenFile(page.file.fileId, page.file.path)}><strong>{page.title}</strong><span>{page.properties.status ?? page.file.path}</span></button></li>)}</ul>;
      case 'tasks': return <ul className="grid gap-2">{tasks.length === 0 ? <Empty text="Nenhuma tarefa pendente nas páginas Markdown." /> : tasks.slice(0, 6).map(({ page, task }) => <li key={`${page.file.fileId}:${task.offset}`} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3"><button type="button" aria-label={`Concluir ${task.text}`} className="mt-0.5 h-4 w-4 rounded border border-indigo-400" onClick={() => void window.academic.workspace.togglePageTask({ fileId: page.file.fileId, expectedRevision: page.file.revision, offset: task.offset, completed: true }).then((result) => { if (!result.ok) setMessage(result.error.message); else void window.academic.workspace.pages().then((listed) => { if (listed.ok) setPages(listed.value.pages); }); })} /><button type="button" className="min-w-0 text-left" onClick={() => onOpenFile(page.file.fileId, page.file.path)}><strong className="block truncate text-sm text-slate-800">{task.text}</strong><span className="text-xs text-slate-500">{page.title}{task.due === undefined ? '' : ` · ${dueDate(task.due)}`}</span></button></li>)}</ul>;
      case 'projects': return <ul className="grid gap-2">{projects.length === 0 ? <Empty text="Crie um projeto para reunir documentos, fontes e prazos." /> : projects.slice(0, 5).map((project) => <li key={project.id}><button type="button" className="folio-home-row" onClick={() => onCommand('projects.open')}><strong>{project.title}</strong><span>{project.documentIds.length} documento(s) · {project.milestones.filter((milestone) => milestone.completedAt === undefined).length} prazo(s)</span></button></li>)}</ul>;
      case 'bases': return <Action text="Abrir bases acadêmicas" detail="Tabelas, listas, quadro, calendário e gráficos derivados." action="academicViews.open" onCommand={onCommand} />;
      case 'captures': return <Action text="Revisar capturas" detail="Pesquisas coletadas aguardando destino no workspace." action="research.intake" onCommand={onCommand} />;
      case 'calendar': return <ul className="grid gap-2">{tasks.filter((entry) => entry.task.due !== undefined).slice(0, 5).map(({ page, task }) => <li key={`${page.file.fileId}:${task.offset}`} className="rounded-xl bg-slate-50 p-3"><strong className="block text-sm text-slate-800">{task.text}</strong><span className="text-xs text-slate-500">{dueDate(task.due!)} · {page.title}</span></li>)}{tasks.every((entry) => entry.task.due === undefined) && <Empty text="Adicione folio.due às páginas para montar este calendário." />}</ul>;
      case 'graph': return <Action text="Explorar conexões" detail={`${pages.reduce((total, page) => total + page.properties.relations.length, 0)} relações declaradas entre páginas.`} action="graph.open" onCommand={onCommand} />;
      case 'shortcuts': return <div className="grid gap-2 sm:grid-cols-2"><Action text="Novo documento" detail="Começar a escrever" action="template.createArticle" onCommand={onCommand} /><Action text="Biblioteca" detail="Referências e anexos" action="library.open" onCommand={onCommand} /><Action text="Canvas" detail="Organizar argumentos" action="canvas.open" onCommand={onCommand} /><Action text="Submissão" detail="Preparar entrega" action="submission.open" onCommand={onCommand} /><button type="button" className="folio-home-row text-left" onClick={importLegacyReadingQueue}><strong>Importar fila de leitura</strong><span>Trazer o estado de leitura deste navegador.</span></button></div>;
    }
  };

  return <div className="h-full overflow-auto bg-[radial-gradient(circle_at_90%_0%,_#e0e7ff_0,_transparent_30rem),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] p-4 sm:p-8"><main className="mx-auto max-w-7xl"><header className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-7 text-white shadow-xl sm:px-8"><div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-indigo-500/30 blur-3xl" /><div className="relative flex flex-wrap items-end justify-between gap-6"><div className="flex items-start gap-4"><div className="rounded-2xl bg-white p-2 shadow-lg"><FolioLogo size={30} label={false} /></div><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-300">Seu workspace acadêmico</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Centro de trabalho</h1><p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">Retome sua pesquisa, organize páginas e acompanhe as próximas ações em um só lugar.</p></div></div><div className="flex flex-wrap gap-2"><button type="button" className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20" onClick={() => setEditing((value) => !value)} aria-pressed={editing}>{editing ? 'Concluir ajustes' : 'Personalizar Home'}</button><button type="button" className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-indigo-950/30 hover:bg-indigo-400" onClick={() => onCommand('template.createArticle')}>Novo documento</button></div></div></header>
    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><Stat label="Documentos" value={files.length} /><Stat label="Páginas" value={pages.length} /><Stat label="Tarefas abertas" value={tasks.length} /><Stat label="Favoritos" value={bookmarks.length} /></div>
    {onboardingVisible && <section className="mt-5 rounded-2xl border border-indigo-200 bg-indigo-50 p-5"><h2 className="font-bold text-indigo-950">Comece pelo que já existe no vault</h2><p className="mt-1 text-sm text-indigo-800">Crie um documento ou transforme um Markdown em página quando precisar de propriedades e tarefas.</p><button type="button" className="mt-3 text-sm font-bold text-indigo-700 underline" onClick={onDismissOnboarding}>Dispensar</button></section>}
    {editing && layout !== undefined && <div className="mt-5 flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white/70 p-4"><span className="text-sm font-semibold text-slate-700">Adicionar bloco</span>{HOME_BLOCK_KINDS.filter((kind) => !layout.blocks.some((block) => block.kind === kind)).map((kind) => <button key={kind} type="button" className="folio-control rounded-lg px-3 py-1.5 text-sm font-semibold" onClick={() => addBlock(kind)}>{createHomeBlock(kind).title}</button>)}</div>}
    <section className="mt-6 grid gap-4 lg:grid-cols-3">{layout === undefined ? <p role="status" className="rounded-2xl bg-white p-5 text-sm text-slate-500">Carregando a Home…</p> : layout.blocks.filter((block) => block.enabled || editing).map((block, index) => <article key={block.id} draggable={editing} aria-grabbed={editing ? draggedBlockId === block.id : undefined} onDragStart={(event) => { if (!editing) return; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', block.id); setDraggedBlockId(block.id); }} onDragOver={(event) => { if (!editing || draggedBlockId === undefined || draggedBlockId === block.id) return; event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDropTargetId(block.id); }} onDrop={(event) => { event.preventDefault(); const fromId = draggedBlockId ?? event.dataTransfer.getData('text/plain'); if (fromId !== '') reorder(fromId, block.id); setDraggedBlockId(undefined); setDropTargetId(undefined); }} onDragEnd={() => { setDraggedBlockId(undefined); setDropTargetId(undefined); }} className={`${span(block.span)} rounded-2xl border bg-white p-5 shadow-sm ${dropTargetId === block.id ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-slate-200'} ${editing ? 'cursor-grab active:cursor-grabbing' : ''}`}><div className="mb-4 flex items-center justify-between gap-3"><h2 className="font-bold text-slate-900">{block.title}</h2>{editing && <div className="flex items-center gap-1"><button type="button" className="folio-icon-button" aria-label={`Mover ${block.title} para cima`} onClick={() => move(index, -1)}>↑</button><button type="button" className="folio-icon-button" aria-label={`Mover ${block.title} para baixo`} onClick={() => move(index, 1)}>↓</button><select aria-label={`Largura de ${block.title}`} className="rounded-md border border-slate-200 bg-white p-1 text-xs" value={block.span} onChange={(event) => patchBlock(block.id, { span: Number(event.target.value) as 1 | 2 | 3 })}><option value="1">1 coluna</option><option value="2">2 colunas</option><option value="3">3 colunas</option></select><button type="button" className="folio-icon-button" aria-label={`${block.enabled ? 'Ocultar' : 'Mostrar'} ${block.title}`} onClick={() => patchBlock(block.id, { enabled: !block.enabled })}>{block.enabled ? '−' : '+'}</button></div>}</div>{block.enabled ? blockContent(block) : <p className="text-sm text-slate-400">Bloco oculto. Use + para voltar a mostrá-lo.</p>}</article>)}</section>
    {pluginHomeBlocks.length > 0 && <section aria-label="Blocos de extensões" className="mt-6 grid gap-4 lg:grid-cols-3">{pluginHomeBlocks.map((block) => <article key={`${block.pluginId}:${block.id}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-600">Extensão · {block.pluginId}</p><h2 className="mt-1 font-bold text-slate-900">{block.title}</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{block.body}</p></article>)}</section>}
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-bold text-slate-900">Atividade recente</h2><ul className="mt-3 grid gap-2 md:grid-cols-2">{activities.length === 0 ? <Empty text="As ações do workspace aparecerão aqui." /> : activities.slice(0, 6).map((activity) => { const file = activity.fileId === undefined ? undefined : files.find((candidate) => candidate.fileId === activity.fileId); return <li key={activity.id} className="rounded-xl bg-slate-50 p-3 text-sm"><strong className="block text-slate-700">{activity.kind === 'document-edited' && file !== undefined ? <>Documento editado: <button type="button" className="text-indigo-700 underline" onClick={() => onOpenFile(file.fileId, file.path)}>{file.path}</button></> : activityLabel(activity, file?.path)}</strong><span className="text-xs text-slate-500">{date(activity.createdAt)}</span></li>; })}</ul></section>
    {message !== undefined && <p role="alert" className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{message}</p>}</main></div>;
}

function Stat({ label, value }: { readonly label: string; readonly value: number }): JSX.Element { return <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-sm backdrop-blur"><p className="text-2xl font-bold tracking-tight text-slate-900">{value}</p><p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p></div>; }
function Empty({ text }: { readonly text: string }): JSX.Element { return <li className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-4 text-sm leading-5 text-slate-500">{text}</li>; }
function Action({ text, detail, action, onCommand }: { readonly text: string; readonly detail: string; readonly action: string; readonly onCommand: (id: string) => void }): JSX.Element { return <button type="button" className="folio-home-row" onClick={() => onCommand(action)}><strong>{text}</strong><span>{detail}</span></button>; }
