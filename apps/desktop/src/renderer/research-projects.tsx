import { useEffect, useRef, useState, type JSX } from 'react';

import type {
  WorkspaceFileDto,
  WorkspaceProfileManifestDto,
  WorkspaceProjectDashboardDto,
  WorkspaceResearchOverviewDto,
} from '@abnt/protocol';

export interface ProjectKnowledgeState {
  readonly searches: readonly { readonly id: string; readonly name: string; readonly query: string }[];
  readonly collections: readonly { readonly id: string; readonly name: string; readonly fileIds: readonly string[]; readonly referenceIds: readonly string[] }[];
}

type ProjectOutput = 'pdf' | 'docx';
type ReadingState = 'to-read' | 'reading' | 'read' | 'reviewed';
type ProjectMilestone = { readonly id: string; readonly title: string; readonly dueDate?: string | undefined; readonly completedAt?: string | undefined };
type ProjectChecklistItem = { readonly id: string; readonly label: string; readonly checked: boolean };
type ProjectSubmission = { readonly name: string; readonly profileId?: string | undefined; readonly deadline?: string | undefined; readonly outputs: readonly ProjectOutput[]; readonly checklist: readonly ProjectChecklistItem[] };

export interface ResearchProject {
  readonly id: string;
  readonly title: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly archivedAt?: string | undefined;
  readonly documentIds: readonly string[];
  readonly referenceIds: readonly string[];
  readonly collectionIds: readonly string[];
  readonly savedSearchIds: readonly string[];
  readonly literatureNoteFileIds: readonly string[];
  readonly milestones: readonly ProjectMilestone[];
  readonly goals: { readonly words?: number | undefined; readonly reviewedReferences?: number | undefined; readonly readPapers?: number | undefined; readonly zeroErrors?: boolean | undefined };
  readonly submission: ProjectSubmission;
}

const storageKey = (workspaceId: string): string => `folio.research-projects:${workspaceId}`;
const now = (): string => new Date().toISOString();
const strings = (value: unknown): readonly string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item !== '') : [];
const positiveNumber = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
const toggle = (values: readonly string[], value: string): readonly string[] => values.includes(value) ? values.filter((candidate) => candidate !== value) : [...values, value];
const date = (value: string | undefined): string => value === undefined || value === '' ? 'Sem prazo' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(`${value}T12:00:00`));

const defaultSubmission = (): ProjectSubmission => ({
  name: '', outputs: ['pdf'], checklist: [
    { id: crypto.randomUUID(), label: 'PDF gerado', checked: false },
    { id: crypto.randomUUID(), label: 'Metadados completos', checked: false },
    { id: crypto.randomUUID(), label: 'Sem diagnósticos de erro', checked: false },
  ],
});

const parseProject = (value: unknown): ResearchProject | undefined => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const data = value as Partial<ResearchProject>;
  if (typeof data.id !== 'string' || typeof data.title !== 'string' || typeof data.createdAt !== 'string' || typeof data.updatedAt !== 'string') return undefined;
  const milestones: readonly ProjectMilestone[] = Array.isArray(data.milestones) ? data.milestones.flatMap((item) => {
    if (typeof item !== 'object' || item === null) return [];
    const milestone = item as Partial<ProjectMilestone>;
    return typeof milestone.id === 'string' && typeof milestone.title === 'string' ? [{ id: milestone.id, title: milestone.title, ...(typeof milestone.dueDate === 'string' ? { dueDate: milestone.dueDate } : {}), ...(typeof milestone.completedAt === 'string' ? { completedAt: milestone.completedAt } : {}) }] : [];
  }) : [];
  const goals = typeof data.goals === 'object' && data.goals !== null ? data.goals : {};
  const rawSubmission = typeof data.submission === 'object' && data.submission !== null ? data.submission : defaultSubmission();
  const checklist = Array.isArray(rawSubmission.checklist) ? rawSubmission.checklist.flatMap((item) => {
    if (typeof item !== 'object' || item === null) return [];
    const entry = item as Partial<ProjectChecklistItem>;
    return typeof entry.id === 'string' && typeof entry.label === 'string' && typeof entry.checked === 'boolean' ? [{ id: entry.id, label: entry.label, checked: entry.checked }] : [];
  }) : [];
  return {
    id: data.id, title: data.title, createdAt: data.createdAt, updatedAt: data.updatedAt,
    ...(typeof data.archivedAt === 'string' ? { archivedAt: data.archivedAt } : {}),
    documentIds: strings(data.documentIds), referenceIds: strings(data.referenceIds), collectionIds: strings(data.collectionIds), savedSearchIds: strings(data.savedSearchIds), literatureNoteFileIds: strings(data.literatureNoteFileIds), milestones,
    goals: { ...(positiveNumber(goals.words) === undefined ? {} : { words: positiveNumber(goals.words) }), ...(positiveNumber(goals.reviewedReferences) === undefined ? {} : { reviewedReferences: positiveNumber(goals.reviewedReferences) }), ...(positiveNumber(goals.readPapers) === undefined ? {} : { readPapers: positiveNumber(goals.readPapers) }), ...(goals.zeroErrors === true ? { zeroErrors: true } : {}) },
    submission: { name: typeof rawSubmission.name === 'string' ? rawSubmission.name : '', ...(typeof rawSubmission.profileId === 'string' ? { profileId: rawSubmission.profileId } : {}), ...(typeof rawSubmission.deadline === 'string' ? { deadline: rawSubmission.deadline } : {}), outputs: strings(rawSubmission.outputs).filter((output): output is ProjectOutput => output === 'pdf' || output === 'docx'), checklist },
  };
};

export const readResearchProjects = (workspaceId: string): readonly ResearchProject[] => {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(storageKey(workspaceId)) ?? '[]');
    return Array.isArray(parsed) ? parsed.flatMap((item) => { const project = parseProject(item); return project === undefined ? [] : [project]; }) : [];
  } catch { return []; }
};

export const createResearchProject = (title: string): ResearchProject => {
  const timestamp = now();
  return { id: crypto.randomUUID(), title, createdAt: timestamp, updatedAt: timestamp, documentIds: [], referenceIds: [], collectionIds: [], savedSearchIds: [], literatureNoteFileIds: [], milestones: [], goals: {}, submission: defaultSubmission() };
};

const readQueue = (workspaceId: string): Readonly<Record<string, ReadingState>> => {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(`folio.reading-queue:${workspaceId}`) ?? '{}');
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).flatMap(([id, entry]) => {
      const state = typeof entry === 'object' && entry !== null ? (entry as { state?: unknown }).state : undefined;
      return state === 'to-read' || state === 'reading' || state === 'read' || state === 'reviewed' ? [[id, state]] : [];
    }));
  } catch { return {}; }
};

function Metric({ label, value }: { readonly label: string; readonly value: number }): JSX.Element {
  return <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span><strong className="mt-1 block text-2xl text-slate-800">{value.toLocaleString('pt-BR')}</strong></div>;
}

export function ResearchProjectsDialog({ workspaceId, files, knowledge, activeFile, onClose }: { readonly workspaceId: string; readonly files: readonly WorkspaceFileDto[]; readonly knowledge: ProjectKnowledgeState; readonly activeFile?: WorkspaceFileDto; readonly onClose: () => void }): JSX.Element {
  const [projects, setProjects] = useState<readonly ResearchProject[]>(() => readResearchProjects(workspaceId));
  const [selectedId, setSelectedId] = useState<string | undefined>(() => readResearchProjects(workspaceId).find((project) => project.archivedAt === undefined)?.id);
  const [showArchived, setShowArchived] = useState(false);
  const [tab, setTab] = useState<'dashboard' | 'members' | 'milestones' | 'submission'>('dashboard');
  const [metrics, setMetrics] = useState<WorkspaceProjectDashboardDto>();
  const [overview, setOverview] = useState<WorkspaceResearchOverviewDto>();
  const [profiles, setProfiles] = useState<readonly WorkspaceProfileManifestDto[]>([]);
  const [message, setMessage] = useState<string>();
  const [dashboardEpoch, setDashboardEpoch] = useState(0);
  const request = useRef(0);
  const persistedWorkspace = useRef(workspaceId);
  const skipPersist = useRef(false);

  useEffect(() => {
    if (persistedWorkspace.current === workspaceId) return;
    persistedWorkspace.current = workspaceId;
    skipPersist.current = true;
    const restored = readResearchProjects(workspaceId);
    setProjects(restored);
    setSelectedId(restored.find((project) => project.archivedAt === undefined)?.id);
  }, [workspaceId]);
  useEffect(() => {
    if (skipPersist.current) { skipPersist.current = false; return; }
    window.localStorage.setItem(storageKey(workspaceId), JSON.stringify(projects));
  }, [projects, workspaceId]);
  useEffect(() => { void window.academic.workspace.profiles().then((result) => { if (result.ok) setProfiles(result.value); }); }, []);

  const visible = projects.filter((project) => showArchived || project.archivedAt === undefined);
  const selected = projects.find((project) => project.id === selectedId) ?? visible[0];
  const documentMembership = selected?.documentIds.join('\u0000') ?? '';
  useEffect(() => window.academic.onEvent((event) => {
    if (event.type === 'desktop:editor-updated' && selected?.documentIds.includes(event.snapshot.fileId)) setDashboardEpoch((current) => current + 1);
    if (event.type === 'desktop:workspace-event') setDashboardEpoch((current) => current + 1);
  }), [documentMembership, selected]);
  useEffect(() => {
    if (selected === undefined) { setMetrics(undefined); setOverview(undefined); return; }
    const epoch = ++request.current;
    void Promise.all([window.academic.workspace.projectDashboard({ fileIds: selected.documentIds }), window.academic.workspace.researchOverview({})]).then(([dashboard, research]) => {
      if (epoch !== request.current) return;
      if (dashboard.ok) setMetrics(dashboard.value); else setMessage(dashboard.error.message);
      if (research.ok) setOverview(research.value); else setMessage(research.error.message);
    });
  }, [selected?.id, selected?.updatedAt, dashboardEpoch]);

  const update = (id: string, transform: (project: ResearchProject) => ResearchProject): void => setProjects((current) => current.map((project) => project.id === id ? { ...transform(project), updatedAt: now() } : project));
  const create = (): void => {
    const title = window.prompt('Título do projeto acadêmico:', 'TCC 2026');
    if (title === null || title.trim() === '') return;
    const project = createResearchProject(title.trim());
    setProjects((current) => [...current, project]); setSelectedId(project.id); setShowArchived(false);
  };
  const fileById = new Map(files.map((file) => [file.fileId, file]));
  const references = overview?.references.filter((reference) => selected?.referenceIds.includes(reference.referenceId)) ?? [];
  const queue = readQueue(workspaceId);
  const documents = metrics?.documents ?? [];
  const words = documents.reduce((total, document) => total + document.words, 0);
  const errors = documents.reduce((total, document) => total + document.errors, 0);
  const warnings = documents.reduce((total, document) => total + document.warnings, 0);
  const pendingReading = references.filter((reference) => (queue[reference.referenceId] ?? 'to-read') === 'to-read' || (queue[reference.referenceId] ?? 'to-read') === 'reading').length;

  const dashboard = selected === undefined ? null : <>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"><Metric label="Documentos" value={documents.length} /><Metric label="Palavras" value={words} /><Metric label="Referências" value={references.length} /><Metric label="Leituras pendentes" value={pendingReading} /><Metric label="Erros" value={errors} /><Metric label="Marcos restantes" value={selected.milestones.filter((milestone) => milestone.completedAt === undefined).length} /></div>
    {selected.goals.words !== undefined && <section className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50 p-4"><div className="flex justify-between text-sm text-indigo-950"><strong>Meta de palavras</strong><span>{words.toLocaleString('pt-BR')} / {selected.goals.words.toLocaleString('pt-BR')}</span></div><div className="mt-2 h-2 overflow-hidden rounded bg-indigo-100"><div className="h-full rounded bg-indigo-600" style={{ width: `${Math.min(100, Math.round(words / Math.max(1, selected.goals.words) * 100))}%` }} /></div></section>}
    <div className="mt-5 grid gap-4 md:grid-cols-2"><section className="rounded-xl border border-slate-200 p-4"><h4 className="font-semibold">Entrega</h4><p className="mt-2 text-sm text-slate-600">{selected.submission.name || 'Sem alvo de submissão'} · {date(selected.submission.deadline)}</p><p className="mt-1 text-xs text-slate-500">{selected.submission.profileId ?? 'Sem profile'} · {selected.submission.outputs.join(', ') || 'sem outputs'}</p></section><section className="rounded-xl border border-slate-200 p-4"><h4 className="font-semibold">Atividade recente</h4><p className="mt-2 text-sm text-slate-600">Atualizado em {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(selected.updatedAt))}.</p><p className="mt-1 text-xs text-slate-500">{warnings} avisos nas projeções atuais.</p></section></div>
  </>;

  const members = selected === undefined ? null : <div className="grid gap-6">
    <section><div className="flex items-center gap-3"><h4 className="font-semibold">Documentos</h4>{activeFile !== undefined && <button type="button" className="text-sm font-semibold text-indigo-700" onClick={() => update(selected.id, (project) => ({ ...project, documentIds: toggle(project.documentIds, activeFile.fileId) }))}>{selected.documentIds.includes(activeFile.fileId) ? 'Remover ativo' : 'Adicionar ativo'}</button>}</div><ul className="mt-2 grid gap-2">{selected.documentIds.map((fileId) => <li key={fileId} className="flex rounded-lg border border-slate-200 p-2 text-sm"><span className="min-w-0 flex-1 truncate">{fileById.get(fileId)?.path ?? fileId}</span><button type="button" className="text-rose-600" onClick={() => update(selected.id, (project) => ({ ...project, documentIds: project.documentIds.filter((id) => id !== fileId) }))}>Remover</button></li>)}</ul></section>
    <section><div className="flex items-center gap-3"><h4 className="font-semibold">Referências</h4><button type="button" className="text-sm font-semibold text-indigo-700" onClick={() => { const id = window.prompt('ID/chave da referência:'); if (id !== null && id.trim() !== '') update(selected.id, (project) => ({ ...project, referenceIds: toggle(project.referenceIds, id.trim()) })); }}>Adicionar</button></div><ul className="mt-2 grid gap-2">{selected.referenceIds.map((id) => <li key={id} className="flex rounded-lg border border-slate-200 p-2 text-sm"><span className="min-w-0 flex-1 truncate">{references.find((reference) => reference.referenceId === id)?.title ?? id}</span><button type="button" className="text-rose-600" onClick={() => update(selected.id, (project) => ({ ...project, referenceIds: project.referenceIds.filter((value) => value !== id) }))}>Remover</button></li>)}</ul></section>
    <section className="grid gap-4 md:grid-cols-2"><div><h4 className="font-semibold">Collections</h4>{knowledge.collections.map((collection) => <label key={collection.id} className="mt-2 flex gap-2 text-sm"><input type="checkbox" checked={selected.collectionIds.includes(collection.id)} onChange={() => update(selected.id, (project) => ({ ...project, collectionIds: toggle(project.collectionIds, collection.id) }))} />{collection.name}</label>)}</div><div><h4 className="font-semibold">Buscas salvas</h4>{knowledge.searches.map((search) => <label key={search.id} className="mt-2 flex gap-2 text-sm"><input type="checkbox" checked={selected.savedSearchIds.includes(search.id)} onChange={() => update(selected.id, (project) => ({ ...project, savedSearchIds: toggle(project.savedSearchIds, search.id) }))} />{search.name}</label>)}</div></section>
    <section><h4 className="font-semibold">Notas de literatura</h4>{activeFile !== undefined && <button type="button" className="mt-2 text-sm font-semibold text-indigo-700" onClick={() => update(selected.id, (project) => ({ ...project, literatureNoteFileIds: toggle(project.literatureNoteFileIds, activeFile.fileId) }))}>{selected.literatureNoteFileIds.includes(activeFile.fileId) ? 'Remover nota ativa' : 'Adicionar documento ativo como nota'}</button>}<p className="mt-1 text-xs text-slate-500">{selected.literatureNoteFileIds.length} nota(s) vinculada(s), sem duplicar arquivos.</p></section>
  </div>;

  const milestones = selected === undefined ? null : <div className="grid gap-5"><button type="button" className="folio-primary w-fit rounded-lg px-3 py-2 text-sm font-semibold" onClick={() => { const title = window.prompt('Nome do marco:', 'Primeira versão'); if (title === null || title.trim() === '') return; const dueDate = window.prompt('Prazo (AAAA-MM-DD, opcional):', '') ?? ''; update(selected.id, (project) => ({ ...project, milestones: [...project.milestones, { id: crypto.randomUUID(), title: title.trim(), ...(dueDate.trim() === '' ? {} : { dueDate: dueDate.trim() }) }] })); }}>Novo marco</button><ul className="grid gap-2">{selected.milestones.map((milestone) => <li key={milestone.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3"><input type="checkbox" checked={milestone.completedAt !== undefined} onChange={() => update(selected.id, (project) => ({ ...project, milestones: project.milestones.map((item) => item.id !== milestone.id ? item : item.completedAt === undefined ? { ...item, completedAt: now() } : { ...item, completedAt: undefined }) }))} /><div className="min-w-0 flex-1"><strong className="block text-sm">{milestone.title}</strong><span className="text-xs text-slate-500">{date(milestone.dueDate)} · {milestone.completedAt === undefined ? 'pendente' : 'concluído'}</span></div><button type="button" className="text-xs font-semibold text-rose-600" onClick={() => update(selected.id, (project) => ({ ...project, milestones: project.milestones.filter((item) => item.id !== milestone.id) }))}>Remover</button></li>)}</ul><section className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2">{([['words', 'Meta de palavras'], ['reviewedReferences', 'Referências revisadas'], ['readPapers', 'Papers lidos']] as const).map(([field, label]) => <label key={field} className="grid gap-1 text-sm">{label}<input type="number" min="0" value={selected.goals[field] ?? ''} onChange={(event) => update(selected.id, (project) => ({ ...project, goals: { ...project.goals, [field]: event.target.value === '' ? undefined : Math.max(0, Number(event.target.value) || 0) } }))} className="rounded border border-slate-300 p-2" /></label>)}<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selected.goals.zeroErrors === true} onChange={(event) => update(selected.id, (project) => ({ ...project, goals: { ...project.goals, zeroErrors: event.target.checked } }))} />Meta: zero erros</label></section></div>;

  const submission = selected === undefined ? null : <div className="grid gap-5"><section className="grid gap-3 rounded-xl border border-slate-200 p-4"><label className="grid gap-1 text-sm">Alvo de submissão<input value={selected.submission.name} onChange={(event) => update(selected.id, (project) => ({ ...project, submission: { ...project.submission, name: event.target.value } }))} className="rounded border border-slate-300 p-2" placeholder="TCC institucional, periódico ou congresso" /></label><label className="grid gap-1 text-sm">Profile<select value={selected.submission.profileId ?? ''} onChange={(event) => update(selected.id, (project) => ({ ...project, submission: { ...project.submission, ...(event.target.value === '' ? { profileId: undefined } : { profileId: event.target.value }) } }))} className="rounded border border-slate-300 p-2"><option value="">Sem profile</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label><label className="grid gap-1 text-sm">Deadline<input type="date" value={selected.submission.deadline ?? ''} onChange={(event) => update(selected.id, (project) => ({ ...project, submission: { ...project.submission, ...(event.target.value === '' ? { deadline: undefined } : { deadline: event.target.value }) } }))} className="rounded border border-slate-300 p-2" /></label><div><span className="text-sm font-medium">Outputs exigidos</span>{(['pdf', 'docx'] as const).map((output) => <label key={output} className="ml-4 text-sm"><input type="checkbox" checked={selected.submission.outputs.includes(output)} onChange={() => update(selected.id, (project) => ({ ...project, submission: { ...project.submission, outputs: toggle(project.submission.outputs, output) as readonly ProjectOutput[] } }))} /> {output.toUpperCase()}</label>)}</div></section><section><div className="flex items-center gap-3"><h4 className="font-semibold">Checklist de entrega</h4><button type="button" className="text-sm font-semibold text-indigo-700" onClick={() => { const label = window.prompt('Item do checklist:'); if (label !== null && label.trim() !== '') update(selected.id, (project) => ({ ...project, submission: { ...project.submission, checklist: [...project.submission.checklist, { id: crypto.randomUUID(), label: label.trim(), checked: false }] } })); }}>Adicionar item</button></div><ul className="mt-2 grid gap-2">{selected.submission.checklist.map((item) => <li key={item.id} className="flex gap-2 rounded border border-slate-200 p-2 text-sm"><input type="checkbox" checked={item.checked} onChange={() => update(selected.id, (project) => ({ ...project, submission: { ...project.submission, checklist: project.submission.checklist.map((candidate) => candidate.id === item.id ? { ...candidate, checked: !candidate.checked } : candidate) } }))} /><span className="flex-1">{item.label}</span><button type="button" className="text-rose-600" onClick={() => update(selected.id, (project) => ({ ...project, submission: { ...project.submission, checklist: project.submission.checklist.filter((candidate) => candidate.id !== item.id) } }))}>Remover</button></li>)}</ul></section><button type="button" className="w-fit rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700" onClick={() => { update(selected.id, (project) => ({ ...project, ...(project.archivedAt === undefined ? { archivedAt: now() } : { archivedAt: undefined }) })); setShowArchived(true); }}>{selected.archivedAt === undefined ? 'Arquivar projeto' : 'Reativar projeto'}</button></div>;

  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-5"><section role="dialog" aria-modal="true" aria-labelledby="projects-title" className="grid h-[min(84vh,54rem)] w-full max-w-6xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"><header className="flex items-start border-b border-slate-200 px-6 py-5"><div><h2 id="projects-title" className="text-lg font-bold text-slate-900">Projetos de pesquisa</h2><p className="mt-0.5 text-sm text-slate-500">Agrupamentos operacionais: não movem arquivos nem alteram o Markdown.</p></div><button type="button" className="folio-control ml-auto grid h-9 w-9 place-items-center rounded-lg text-xl" onClick={onClose}>×</button></header><div className="grid min-h-0 md:grid-cols-[17rem_minmax(0,1fr)]"><aside className="border-r border-slate-200 p-4"><button type="button" className="folio-primary w-full rounded-lg px-3 py-2 text-sm font-semibold" onClick={create}>Novo projeto</button><label className="mt-3 flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} /> Mostrar arquivados</label><ul className="mt-4 grid max-h-[60vh] gap-1 overflow-auto">{visible.map((project) => <li key={project.id}><button type="button" onClick={() => setSelectedId(project.id)} className={`w-full rounded-lg p-2 text-left ${selected?.id === project.id ? 'bg-indigo-100 text-indigo-950' : 'hover:bg-slate-100'}`}><strong className="block truncate text-sm">{project.title}</strong><span className="text-xs text-slate-500">{project.archivedAt === undefined ? 'Ativo' : 'Arquivado'}</span></button></li>)}</ul></aside><div className="flex min-h-0 flex-col">{selected === undefined ? <p className="grid flex-1 place-items-center p-8 text-center text-sm text-slate-500">Crie um projeto para reunir documentos, referências, metas e entrega.</p> : <><nav className="flex flex-wrap gap-5 border-b border-slate-200 px-6" aria-label="Seções do projeto">{([['dashboard', 'Painel'], ['members', 'Vínculos'], ['milestones', 'Marcos'], ['submission', 'Entrega']] as const).map(([id, label]) => <button key={id} type="button" onClick={() => setTab(id)} className={`border-b-2 py-3 text-sm font-semibold ${tab === id ? 'border-indigo-500 text-indigo-700' : 'border-transparent text-slate-500'}`}>{label}</button>)}</nav><div className="min-h-0 flex-1 overflow-auto p-6">{tab === 'dashboard' ? dashboard : tab === 'members' ? members : tab === 'milestones' ? milestones : submission}</div></>}{message !== undefined && <p className="border-t border-amber-200 bg-amber-50 px-6 py-2 text-sm text-amber-800">{message}</p>}</div></div></section></div>;
}
