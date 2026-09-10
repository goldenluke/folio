import { useEffect, useMemo, useState, type JSX } from 'react';

import type {
  WorkspaceFileDto,
  WorkspaceProblemDto,
  WorkspaceReferenceAttachmentDto,
  WorkspaceResearchOverviewDto,
} from '@abnt/protocol';

import { readResearchProjects } from './research-projects.js';
import { activityLabel, type WorkspaceActivity } from './shell/workspace-cohesion.js';
import { timePerformance } from './shell/performance.js';
import { FolioLogo } from './folio-logo.js';

type ReadingState = 'to-read' | 'reading' | 'read' | 'reviewed';

const readQueue = (workspaceId: string): Readonly<Record<string, ReadingState>> => {
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(`folio.reading-queue:${workspaceId}`) ?? '{}');
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
    return Object.fromEntries(Object.entries(raw).flatMap(([referenceId, value]) => {
      const state = typeof value === 'object' && value !== null ? (value as { state?: unknown }).state : undefined;
      return state === 'to-read' || state === 'reading' || state === 'read' || state === 'reviewed' ? [[referenceId, state]] : [];
    }));
  } catch { return {}; }
};

const date = (value: string): string => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));

export function WorkspaceHome({
  workspaceId,
  files,
  recentFileIds,
  activities,
  onboardingVisible,
  onOpenFile,
  onCommand,
  onDismissOnboarding,
}: {
  readonly workspaceId: string;
  readonly files: readonly WorkspaceFileDto[];
  readonly recentFileIds: readonly string[];
  readonly activities: readonly WorkspaceActivity[];
  readonly onboardingVisible: boolean;
  readonly onOpenFile: (fileId: string, path: string) => void;
  readonly onCommand: (id: string) => void;
  readonly onDismissOnboarding: () => void;
}): JSX.Element {
  const [overview, setOverview] = useState<WorkspaceResearchOverviewDto>();
  const [problems, setProblems] = useState<readonly WorkspaceProblemDto[]>([]);
  const [attachments, setAttachments] = useState<readonly WorkspaceReferenceAttachmentDto[]>([]);
  const [annotationCounts, setAnnotationCounts] = useState<Readonly<Record<string, number>>>({});
  const [message, setMessage] = useState<string>();
  const [loading, setLoading] = useState(true);
  const projects = useMemo(() => readResearchProjects(workspaceId).filter((project) => project.archivedAt === undefined), [workspaceId]);
  const queue = useMemo(() => readQueue(workspaceId), [workspaceId, activities]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setMessage(undefined);
    void timePerformance('home', () => Promise.all([window.academic.workspace.researchOverview({}), window.academic.workspace.problems({}), window.academic.workspace.referenceAttachments({})])).then(async ([research, currentProblems, currentAttachments]) => {
      if (cancelled) return;
      if (research.ok) setOverview(research.value); else setMessage(research.error.message);
      if (currentProblems.ok) setProblems(currentProblems.value); else setMessage(currentProblems.error.message);
      if (currentAttachments.ok) {
        setAttachments(currentAttachments.value);
        const counts = await Promise.all(currentAttachments.value.map(async (attachment) => {
          const result = await window.academic.library.pdfAnnotations({ referenceId: attachment.referenceId });
          return result.ok ? [attachment.referenceId, result.value.filter((annotation) => annotation.literatureNoteFileId === undefined).length] as const : undefined;
        }));
        if (!cancelled) setAnnotationCounts(Object.fromEntries(counts.flatMap((item) => item === undefined ? [] : [item])));
      } else setMessage(currentAttachments.error.message);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [workspaceId]);

  const recent = recentFileIds.map((id) => files.find((file) => file.fileId === id)).filter((file): file is WorkspaceFileDto => file !== undefined);
  const reading = Object.values(queue).filter((state) => state === 'to-read' || state === 'reading').length;
  const unresolvedAnnotations = Object.values(annotationCounts).reduce((sum, count) => sum + count, 0);
  const upcoming = projects.flatMap((project) => project.milestones.filter((milestone) => milestone.completedAt === undefined).map((milestone) => ({ project: project.title, title: milestone.title, dueDate: milestone.dueDate }))).sort((left, right) => (left.dueDate ?? '9999').localeCompare(right.dueDate ?? '9999')).slice(0, 5);
  const errors = problems.filter((problem) => problem.severity === 'error').length;
  const annotations = attachments.length === 0 ? '—' : unresolvedAnnotations;

  const primaryDocument = recent[0];
  const notes = overview?.references.filter((reference) => reference.literatureNote !== undefined).length ?? '—';
  const vaultFolders = new Set(files.map((file) => file.path.split('/').slice(0, -1).join('/')).filter(Boolean)).size;

  return <div className="h-full overflow-auto bg-[radial-gradient(circle_at_92%_0%,_#dbeafe,_transparent_30rem),linear-gradient(180deg,_#f8fafc,_#f1f5f9)] p-5 sm:p-8"><main className="mx-auto max-w-7xl">
    <header className="flex flex-wrap items-center justify-between gap-5 border-b border-slate-200 pb-6"><div><div className="flex items-center gap-3"><FolioLogo size={28} label={false} /><span className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">Workspace</span></div><h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">Seu espaço de pesquisa</h1><p className="mt-1 text-sm text-slate-500">Escolha onde continuar ou inicie uma nova frente de trabalho.</p></div><div className="flex flex-wrap gap-2"><button type="button" className="folio-control rounded-xl px-4 py-2.5 text-sm font-semibold" onClick={() => onCommand('research.intake')}>Importar pesquisa</button><button type="button" className="folio-primary rounded-xl px-4 py-2.5 text-sm font-bold" onClick={() => onCommand('template.createArticle')}>+ Novo documento</button></div></header>
    {onboardingVisible && <section className="mt-6 rounded-2xl border border-indigo-200 bg-indigo-50 p-5"><div className="flex items-start gap-4"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-600 font-bold text-white">1</div><div className="min-w-0 flex-1"><h2 className="font-bold text-indigo-950">Comece seu primeiro ciclo</h2><p className="mt-1 text-sm text-indigo-800">Crie um documento, importe referências ou abra os arquivos que já estão no vault.</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-indigo-700" onClick={() => onCommand('template.createArticle')}>Criar documento</button><button type="button" className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-indigo-700" onClick={() => onCommand('research.intake')}>Importar referências</button></div></div><button type="button" className="text-sm font-semibold text-indigo-700" onClick={onDismissOnboarding}>Dispensar</button></div></section>}
    {loading && <p role="status" className="mt-6 rounded-xl border border-indigo-100 bg-white px-4 py-3 text-sm text-indigo-800 shadow-sm">Atualizando o panorama do workspace…</p>}
    <section className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]"><div className="grid gap-6"><article className="folio-home-resume overflow-hidden rounded-3xl text-white shadow-xl shadow-slate-900/10"><div className="p-6 sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-300">Último arquivo aberto</p>{primaryDocument === undefined ? <div className="mt-4"><h2 className="text-2xl font-bold">Crie o primeiro documento</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">A partir daqui, você poderá estruturar, pesquisar, revisar e publicar no mesmo workspace.</p><button type="button" className="mt-5 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-900 hover:bg-indigo-50" onClick={() => onCommand('template.createArticle')}>Escolher modelo</button></div> : <button type="button" className="mt-4 w-full text-left text-white" onClick={() => onOpenFile(primaryDocument.fileId, primaryDocument.path)}><span className="block text-2xl font-bold tracking-tight text-white sm:text-3xl">{primaryDocument.path}</span><span className="mt-3 inline-flex rounded-lg bg-indigo-500 px-3 py-2 text-sm font-bold text-white">Continuar no editor →</span></button>}</div>{recent.length > 1 && <div className="border-t border-slate-800 px-6 py-4 sm:px-8"><div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Abertos recentemente</span><button type="button" className="text-xs font-bold text-indigo-300 hover:text-white" onClick={() => onCommand('palette.quickOpen')}>Todos os arquivos</button></div><div className="mt-3 grid gap-1 sm:grid-cols-2">{recent.slice(1, 5).map((file) => <button key={file.fileId} type="button" className="truncate rounded-lg px-2 py-2 text-left text-sm text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => onOpenFile(file.fileId, file.path)}>{file.path}</button>)}</div></div>}</article>
      <section className="grid gap-4 md:grid-cols-3"><button type="button" className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md" onClick={() => onCommand('research.open')}><span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Pesquisar</span><strong className="mt-3 block text-lg text-slate-900">Ler e reunir evidências</strong><span className="mt-2 block text-sm text-slate-500">{reading} referência(s) na fila</span></button><button type="button" className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md" onClick={() => onCommand('writing.open')}><span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Escrever</span><strong className="mt-3 block text-lg text-slate-900">Voltar ao manuscrito</strong><span className="mt-2 block text-sm text-slate-500">Metas, estrutura e editor</span></button><button type="button" className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md" onClick={() => onCommand('review.open')}><span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Revisar</span><strong className="mt-3 block text-lg text-slate-900">Resolver pendências</strong><span className="mt-2 block text-sm text-slate-500">{errors} erro(s) aberto(s)</span></button></section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-baseline justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Histórico</p><h2 className="mt-1 font-bold text-slate-900">Atividade recente</h2></div></div><ul className="mt-4 grid gap-2 md:grid-cols-2">{activities.length === 0 ? <li className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">As ações do workspace aparecerão aqui.</li> : activities.slice(0, 6).map((activity) => { const file = activity.fileId === undefined ? undefined : files.find((candidate) => candidate.fileId === activity.fileId); return <li key={activity.id} className="rounded-xl bg-slate-50 p-3"><strong className="block truncate text-sm text-slate-700">{activity.kind === 'document-edited' && file !== undefined ? <>Documento editado: <button type="button" className="font-semibold text-indigo-700 underline decoration-indigo-300 underline-offset-2 hover:text-indigo-900" onClick={() => onOpenFile(file.fileId, file.path)}>{file.path}</button></> : activityLabel(activity, file?.path)}</strong><span className="mt-1 block text-xs text-slate-500">{date(activity.createdAt)}</span></li>; })}</ul></section></div>
      <aside className="grid content-start gap-4"><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Panorama</p><dl className="mt-4 divide-y divide-slate-100">{[[files.length, 'arquivos no vault'], [overview?.references.length ?? '—', 'referências'], [projects.length, 'projetos ativos'], [vaultFolders, 'pastas organizadas']].map(([value, label]) => <div key={String(label)} className="flex items-center justify-between py-3 first:pt-0 last:pb-0"><dt className="text-sm text-slate-500">{label}</dt><dd className="text-lg font-bold text-slate-900">{value}</dd></div>)}</dl></section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="font-bold text-slate-900">Atenção agora</h2><button type="button" className="text-xs font-bold text-indigo-700" onClick={() => onCommand('review.open')}>Revisar</button></div><div className={`mt-4 rounded-xl p-4 ${errors > 0 ? 'bg-rose-50 text-rose-900' : 'bg-emerald-50 text-emerald-900'}`}><strong className="block text-2xl">{errors}</strong><span className="text-sm">erro(s) de validação</span></div><div className="mt-2 rounded-xl bg-amber-50 p-4 text-amber-900"><strong className="block text-2xl">{annotations}</strong><span className="text-sm">anotações sem literature note</span></div></section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="font-bold text-slate-900">Próximos prazos</h2><button type="button" className="text-xs font-bold text-indigo-700" onClick={() => onCommand('projects.open')}>Projetos</button></div><ul className="mt-4 grid gap-2">{upcoming.length === 0 ? <li className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">Nenhum marco pendente.</li> : upcoming.slice(0, 3).map((milestone, index) => <li key={`${milestone.project}:${milestone.title}:${index}`} className="rounded-xl bg-slate-50 p-3"><strong className="block truncate text-sm text-slate-800">{milestone.title}</strong><span className="text-xs text-slate-500">{milestone.project} · {milestone.dueDate ?? 'sem prazo'}</span></li>)}</ul></section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="font-bold text-slate-900">Pesquisa</h2><button type="button" className="text-xs font-bold text-indigo-700" onClick={() => onCommand('research.open')}>Abrir</button></div><dl className="mt-4 grid gap-3 text-sm"><div className="flex justify-between"><dt className="text-slate-500">PDFs anexados</dt><dd className="font-bold text-slate-800">{attachments.length}</dd></div><div className="flex justify-between"><dt className="text-slate-500">Literature notes</dt><dd className="font-bold text-slate-800">{notes}</dd></div><div className="flex justify-between"><dt className="text-slate-500">Para ler</dt><dd className="font-bold text-slate-800">{reading}</dd></div></dl></section></aside></section>
    {message !== undefined && <p role="alert" className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">{message}</p>}
  </main></div>;
}
