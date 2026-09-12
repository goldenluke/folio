import { useEffect, useRef, useState, type JSX } from 'react';

import type {
  WorkspaceFileDto,
  WorkspaceProfileManifestDto,
  WorkspaceProjectDashboardDto,
  WorkspaceReferenceHealthDto,
  WorkspaceResearchOverviewDto,
} from '@abnt/protocol';

import {
  submissionIsReady,
  submissionOutputLabel,
  submissionPreflight,
  type SubmissionOutput,
  type SubmissionPreflightReport,
} from './submission-workflow.js';
import { requestConfirmation, requestText } from './text-prompt.js';
import { timePerformance } from './shell/performance.js';
import { VirtualizedList } from './virtualized-list.js';
import { crossrefMetadata, normalizeOrcid } from '@abnt/submission-integrations';

export interface ProjectKnowledgeState {
  readonly searches: readonly { readonly id: string; readonly name: string; readonly query: string }[];
  readonly collections: readonly { readonly id: string; readonly name: string; readonly fileIds: readonly string[]; readonly referenceIds: readonly string[] }[];
}

type ProjectMilestone = { readonly id: string; readonly title: string; readonly dueDate?: string | undefined; readonly completedAt?: string | undefined };
type ProjectChecklistItem = { readonly id: string; readonly label: string; readonly checked: boolean };
type ProjectExportPreset = { readonly id: string; readonly name: string; readonly outputs: readonly SubmissionOutput[] };
type SubmissionSource = { readonly fileId: string; readonly path: string; readonly revision: number; readonly contentHash: string };
type SubmissionSnapshot = { readonly fileId: string; readonly revisionId: string };
type SubmissionArtifact = {
  readonly fileId: string;
  readonly path: string;
  readonly format: string;
  readonly revision: number;
  readonly contentHash: string;
  readonly profileId: string;
  readonly sha256: string;
  readonly createdAt: string;
  readonly pages?: number | undefined;
};
type SubmissionRecord = {
  readonly id: string;
  readonly createdAt: string;
  readonly target: string;
  readonly profileId?: string | undefined;
  readonly profileVersion?: string | undefined;
  readonly sources: readonly SubmissionSource[];
  readonly snapshots: readonly SubmissionSnapshot[];
  readonly preflight: SubmissionPreflightReport;
  readonly artifacts: readonly SubmissionArtifact[];
};
type SubmissionAuthorDraft = { readonly id: string; readonly name: string; readonly orcid?: string | undefined };
type ProjectSubmission = {
  readonly name: string;
  readonly profileId?: string | undefined;
  readonly deadline?: string | undefined;
  readonly outputs: readonly SubmissionOutput[];
  readonly checklist: readonly ProjectChecklistItem[];
  readonly presets: readonly ProjectExportPreset[];
  readonly records: readonly SubmissionRecord[];
  readonly metadataTitle: string;
  readonly authors: readonly SubmissionAuthorDraft[];
};

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
const outputs = (value: unknown): readonly SubmissionOutput[] => strings(value).filter((value): value is SubmissionOutput => value === 'pdf' || value === 'docx' || value === 'html' || value === 'supplemental');
const objects = (value: unknown): readonly Record<string, unknown>[] => Array.isArray(value) ? value.flatMap((item) => typeof item === 'object' && item !== null && !Array.isArray(item) ? [item as Record<string, unknown>] : []) : [];
const number = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
const toggle = <T,>(values: readonly T[], value: T): readonly T[] => values.includes(value) ? values.filter((candidate) => candidate !== value) : [...values, value];
const date = (value: string | undefined): string => value === undefined || value === '' ? 'Sem prazo' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(`${value}T12:00:00`));

const defaultSubmission = (): ProjectSubmission => ({
  name: '',
  metadataTitle: '',
  authors: [],
  outputs: ['pdf'],
  presets: [
    { id: crypto.randomUUID(), name: 'PDF final', outputs: ['pdf'] },
    { id: crypto.randomUUID(), name: 'TCC final', outputs: ['pdf', 'docx'] },
  ],
  records: [],
  checklist: [
    { id: crypto.randomUUID(), label: 'PDF gerado', checked: false },
    { id: crypto.randomUUID(), label: 'Metadados completos', checked: false },
    { id: crypto.randomUUID(), label: 'Sem diagnósticos de erro', checked: false },
  ],
});

const parsePreflight = (value: unknown, fallback: string): SubmissionPreflightReport => {
  const raw = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
  const field = (name: keyof Omit<SubmissionPreflightReport, 'generatedAt'>): number => number(raw[name]) ?? 0;
  return {
    generatedAt: typeof raw.generatedAt === 'string' ? raw.generatedAt : fallback,
    documents: field('documents'), errors: field('errors'), warnings: field('warnings'), citations: field('citations'),
    figures: field('figures'), tables: field('tables'), unresolvedCrossReferences: field('unresolvedCrossReferences'),
    unresolvedCitations: field('unresolvedCitations'), bibliographyIssues: field('bibliographyIssues'),
  };
};

const parseRecord = (value: Record<string, unknown>): SubmissionRecord | undefined => {
  if (typeof value.id !== 'string' || typeof value.createdAt !== 'string' || typeof value.target !== 'string') return undefined;
  const sources = objects(value.sources).flatMap((source) => typeof source.fileId === 'string' && typeof source.path === 'string' && number(source.revision) !== undefined && typeof source.contentHash === 'string' ? [{ fileId: source.fileId, path: source.path, revision: number(source.revision)!, contentHash: source.contentHash }] : []);
  const snapshots = objects(value.snapshots).flatMap((snapshot) => typeof snapshot.fileId === 'string' && typeof snapshot.revisionId === 'string' ? [{ fileId: snapshot.fileId, revisionId: snapshot.revisionId }] : []);
  const artifacts = objects(value.artifacts).flatMap((artifact) => typeof artifact.fileId === 'string' && typeof artifact.path === 'string' && (artifact.format === 'pdf' || artifact.format === 'docx' || artifact.format === 'html') && number(artifact.revision) !== undefined && typeof artifact.contentHash === 'string' && typeof artifact.profileId === 'string' && typeof artifact.sha256 === 'string' && typeof artifact.createdAt === 'string' ? [{ fileId: artifact.fileId, path: artifact.path, format: artifact.format, revision: number(artifact.revision)!, contentHash: artifact.contentHash, profileId: artifact.profileId, sha256: artifact.sha256, createdAt: artifact.createdAt, ...(number(artifact.pages) === undefined ? {} : { pages: number(artifact.pages) }) }] : []);
  return {
    id: value.id, createdAt: value.createdAt, target: value.target,
    ...(typeof value.profileId === 'string' ? { profileId: value.profileId } : {}),
    ...(typeof value.profileVersion === 'string' ? { profileVersion: value.profileVersion } : {}),
    sources, snapshots, artifacts, preflight: parsePreflight(value.preflight, value.createdAt),
  };
};

const parseProject = (value: unknown): ResearchProject | undefined => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const data = value as Record<string, unknown>;
  if (typeof data.id !== 'string' || typeof data.title !== 'string' || typeof data.createdAt !== 'string' || typeof data.updatedAt !== 'string') return undefined;
  const rawSubmission = typeof data.submission === 'object' && data.submission !== null ? data.submission as Record<string, unknown> : {};
  const defaults = defaultSubmission();
  const checklist = objects(rawSubmission.checklist).flatMap((item) => typeof item.id === 'string' && typeof item.label === 'string' && typeof item.checked === 'boolean' ? [{ id: item.id, label: item.label, checked: item.checked }] : []);
  const presets = objects(rawSubmission.presets).flatMap((item) => typeof item.id === 'string' && typeof item.name === 'string' ? [{ id: item.id, name: item.name, outputs: outputs(item.outputs) }] : []);
  return {
    id: data.id, title: data.title, createdAt: data.createdAt, updatedAt: data.updatedAt,
    ...(typeof data.archivedAt === 'string' ? { archivedAt: data.archivedAt } : {}),
    documentIds: strings(data.documentIds), referenceIds: strings(data.referenceIds), collectionIds: strings(data.collectionIds),
    savedSearchIds: strings(data.savedSearchIds), literatureNoteFileIds: strings(data.literatureNoteFileIds),
    milestones: objects(data.milestones).flatMap((item) => typeof item.id === 'string' && typeof item.title === 'string' ? [{ id: item.id, title: item.title, ...(typeof item.dueDate === 'string' ? { dueDate: item.dueDate } : {}), ...(typeof item.completedAt === 'string' ? { completedAt: item.completedAt } : {}) }] : []),
    goals: typeof data.goals === 'object' && data.goals !== null ? { ...(number((data.goals as Record<string, unknown>).words) === undefined ? {} : { words: number((data.goals as Record<string, unknown>).words) }), ...(number((data.goals as Record<string, unknown>).reviewedReferences) === undefined ? {} : { reviewedReferences: number((data.goals as Record<string, unknown>).reviewedReferences) }), ...(number((data.goals as Record<string, unknown>).readPapers) === undefined ? {} : { readPapers: number((data.goals as Record<string, unknown>).readPapers) }), ...((data.goals as Record<string, unknown>).zeroErrors === true ? { zeroErrors: true } : {}) } : {},
    submission: { name: typeof rawSubmission.name === 'string' ? rawSubmission.name : '', metadataTitle: typeof rawSubmission.metadataTitle === 'string' ? rawSubmission.metadataTitle : '', authors: objects(rawSubmission.authors).flatMap((author) => typeof author.id === 'string' && typeof author.name === 'string' ? [{ id: author.id, name: author.name, ...(typeof author.orcid === 'string' ? { orcid: author.orcid } : {}) }] : []), ...(typeof rawSubmission.profileId === 'string' ? { profileId: rawSubmission.profileId } : {}), ...(typeof rawSubmission.deadline === 'string' ? { deadline: rawSubmission.deadline } : {}), outputs: outputs(rawSubmission.outputs).length === 0 ? defaults.outputs : outputs(rawSubmission.outputs), checklist: checklist.length === 0 ? defaults.checklist : checklist, presets: presets.length === 0 ? defaults.presets : presets, records: objects(rawSubmission.records).flatMap((item) => { const parsed = parseRecord(item); return parsed === undefined ? [] : [parsed]; }) },
  };
};

export const readResearchProjects = (workspaceId: string): readonly ResearchProject[] => {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(storageKey(workspaceId)) ?? '[]');
    return Array.isArray(value) ? value.flatMap((item) => { const project = parseProject(item); return project === undefined ? [] : [project]; }) : [];
  } catch { return []; }
};

/** Salva a lista completa antes de qualquer atualização de UI que dela dependa. */
export const writeResearchProjects = (workspaceId: string, projects: readonly ResearchProject[]): void => {
  window.localStorage.setItem(storageKey(workspaceId), JSON.stringify(projects));
};

export const createResearchProject = (title: string): ResearchProject => {
  const timestamp = now();
  return { id: crypto.randomUUID(), title, createdAt: timestamp, updatedAt: timestamp, documentIds: [], referenceIds: [], collectionIds: [], savedSearchIds: [], literatureNoteFileIds: [], milestones: [], goals: {}, submission: defaultSubmission() };
};

/** Associação operacional do projeto; o documento continua sendo autoral no vault. */
export const addDocumentToResearchProject = (workspaceId: string, projectId: string, fileId: string): boolean => {
  const projects = readResearchProjects(workspaceId);
  let changed = false;
  const next = projects.map((project) => {
    if (project.id !== projectId) return project;
    changed = true;
    return project.documentIds.includes(fileId) ? project : { ...project, documentIds: [...project.documentIds, fileId], updatedAt: now() };
  });
  if (changed) writeResearchProjects(workspaceId, next);
  return changed;
};

function Metric({ label, value }: { readonly label: string; readonly value: number }): JSX.Element {
  return <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"><span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</span><strong className="mt-1 block text-2xl tracking-tight text-slate-800">{value.toLocaleString('pt-BR')}</strong></div>;
}

export function ResearchProjectsDialog({ workspaceId, files, knowledge, activeFile, onClose }: { readonly workspaceId: string; readonly files: readonly WorkspaceFileDto[]; readonly knowledge: ProjectKnowledgeState; readonly activeFile?: WorkspaceFileDto; readonly onClose: () => void }): JSX.Element {
  const [projects, setProjects] = useState<readonly ResearchProject[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [showArchived, setShowArchived] = useState(false);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'dashboard' | 'members' | 'milestones' | 'submission'>('dashboard');
  const [dashboard, setDashboard] = useState<WorkspaceProjectDashboardDto>();
  const [overview, setOverview] = useState<WorkspaceResearchOverviewDto>();
  const [health, setHealth] = useState<WorkspaceReferenceHealthDto>();
  const [profiles, setProfiles] = useState<readonly WorkspaceProfileManifestDto[]>([]);
  const [message, setMessage] = useState<string>();
  const [epoch, setEpoch] = useState(0);
  const request = useRef(0);
  useEffect(() => {
    let cancelled = false;
    void window.academic.workspace.researchProjects().then((result) => {
      if (cancelled) return;
      if (!result.ok) { setMessage(result.error.message); return; }
      const restored = result.value.projects.flatMap((item) => { const project = parseProject(item); return project === undefined ? [] : [project]; });
      setProjects(restored);
      setSelectedId(restored.find((project) => project.archivedAt === undefined)?.id);
    });
    return () => { cancelled = true; };
  }, [workspaceId]);
  useEffect(() => { void window.academic.workspace.profiles().then((result) => { if (result.ok) setProfiles(result.value); }); }, []);

  const visible = projects.filter((project) => (showArchived || project.archivedAt === undefined) && project.title.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR')));
  const selected = visible.find((project) => project.id === selectedId) ?? visible[0];
  const membership = selected?.documentIds.join('\0') ?? '';
  useEffect(() => window.academic.onEvent((event) => { if ((event.type === 'desktop:editor-updated' && selected?.documentIds.includes(event.snapshot.fileId)) || event.type === 'desktop:workspace-event') setEpoch((value) => value + 1); }), [membership, selected]);
  useEffect(() => {
    if (selected === undefined) { setDashboard(undefined); setOverview(undefined); setHealth(undefined); return; }
    const token = ++request.current;
    void timePerformance('project-dashboard', () => Promise.all([window.academic.workspace.projectDashboard({ fileIds: selected.documentIds }), window.academic.workspace.researchOverview({}), window.academic.workspace.referenceHealth({})])).then(([metrics, research, referenceHealth]) => {
      if (token !== request.current) return;
      if (metrics.ok) setDashboard(metrics.value); else setMessage(metrics.error.message);
      if (research.ok) setOverview(research.value); else setMessage(research.error.message);
      if (referenceHealth.ok) setHealth(referenceHealth.value); else setMessage(referenceHealth.error.message);
    });
  }, [selected?.id, selected?.updatedAt, epoch]);

  const persist = (next: readonly ResearchProject[]): void => {
    setProjects(next);
    void window.academic.workspace.setResearchProjects({ version: 1, projects: next as unknown as readonly Readonly<Record<string, unknown>>[] }).then((result) => { if (!result.ok) setMessage(result.error.message); });
  };
  const update = (id: string, transform: (project: ResearchProject) => ResearchProject): void => {
    const next = projects.map((project) => project.id === id ? { ...transform(project), updatedAt: now() } : project);
    persist(next);
  };
  const create = async (): Promise<void> => { const title = await requestText('Título do projeto acadêmico', 'TCC 2026'); if (title === null || title.trim() === '') return; const project = createResearchProject(title.trim()); persist([...projects, project]); setSelectedId(project.id); setShowArchived(false); };
  const docs = dashboard?.documents ?? [];
  const references = overview?.references.filter((reference) => selected?.referenceIds.includes(reference.referenceId)) ?? [];
  const preflight = dashboard === undefined || health === undefined ? undefined : submissionPreflight(dashboard, health);
  const profile = profiles.find((candidate) => candidate.id === selected?.submission.profileId);
  const crossref = selected === undefined ? undefined : crossrefMetadata({ title: selected.submission.metadataTitle.trim() || selected.title, authors: selected.submission.authors.filter((author) => author.name.trim() !== '').flatMap((author) => {
    const orcid = author.orcid?.trim();
    return [{ name: author.name.trim(), ...(orcid === undefined || orcid === '' ? {} : { orcid: normalizeOrcid(orcid) ?? orcid }) }];
  }) });
  const createFinalSnapshot = async (): Promise<void> => {
    if (selected === undefined || preflight === undefined || dashboard === undefined) return;
    if (!submissionIsReady(preflight)) { setMessage('Resolva erros, citações ou referências cruzadas antes do snapshot final.'); return; }
    if (docs.length === 0) { setMessage('Adicione ao menos um documento ao projeto antes da submissão.'); return; }
    const label = `Submissão final: ${selected.submission.name || selected.title}`;
    const results = await Promise.all(docs.map(async (document) => ({ document, result: await window.academic.workspace.historyCreateSnapshot({ fileId: document.fileId, label }) })));
    const failed = results.find(({ result }) => !result.ok);
    if (failed !== undefined) { setMessage(failed.result.ok ? 'Não foi possível criar o snapshot.' : failed.result.error.message); return; }
    const record: SubmissionRecord = {
      id: crypto.randomUUID(), createdAt: now(), target: selected.submission.name || selected.title,
      ...(selected.submission.profileId === undefined ? {} : { profileId: selected.submission.profileId }),
      ...(profile === undefined ? {} : { profileVersion: profile.version }),
      sources: docs.map(({ fileId, path, revision, contentHash }) => ({ fileId, path, revision, contentHash })),
      snapshots: results.map(({ document, result }) => ({ fileId: document.fileId, revisionId: result.ok ? result.value.id : '' })),
      preflight, artifacts: [],
    };
    update(selected.id, (project) => ({ ...project, submission: { ...project.submission, records: [...project.submission.records, record] } }));
    setMessage(`Snapshot final criado para ${record.sources.length} documento(s). Agora gere os artefatos.`);
  };

  const generateArtifacts = async (record: SubmissionRecord, desired: readonly SubmissionOutput[]): Promise<void> => {
    if (selected === undefined) return;
    const formats = desired.filter((format): format is Exclude<SubmissionOutput, 'supplemental'> => format !== 'supplemental');
    if (formats.length === 0) { setMessage('Arquivos suplementares são autoria já vinculada ao projeto; confirme-os no checklist.'); return; }
    for (const source of record.sources) for (const format of formats) {
      const result = await window.academic.editor.export({ fileId: source.fileId, format });
      if (!result.ok) { if (result.error.code !== 'CANCELLED') setMessage(result.error.message); return; }
      const value = result.value;
      if (value.revision !== source.revision || value.contentHash !== source.contentHash || value.profileId === undefined || value.sha256 === undefined) {
        setMessage('O documento mudou desde o snapshot final. Rode o preflight e crie um novo snapshot antes de exportar.');
        return;
      }
      const artifact: SubmissionArtifact = { fileId: source.fileId, path: value.path, format, revision: value.revision, contentHash: value.contentHash, profileId: value.profileId, sha256: value.sha256, createdAt: now(), ...(value.pages === undefined ? {} : { pages: value.pages }) };
      update(selected.id, (project) => ({ ...project, submission: { ...project.submission, records: project.submission.records.map((candidate) => candidate.id === record.id ? { ...candidate, artifacts: [...candidate.artifacts, artifact] } : candidate) } }));
    }
    setMessage('Artefatos gerados e registrados com hash SHA-256.');
  };

  const dashboardView = selected === undefined ? null : <div className="grid gap-5">
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"><Metric label="Documentos" value={docs.length} /><Metric label="Palavras" value={docs.reduce((sum, document) => sum + document.words, 0)} /><Metric label="Referências" value={references.length} /><Metric label="Erros" value={docs.reduce((sum, document) => sum + document.errors, 0)} /><Metric label="Avisos" value={docs.reduce((sum, document) => sum + document.warnings, 0)} /><Metric label="Marcos" value={selected.milestones.filter((milestone) => milestone.completedAt === undefined).length} /></div>
    <section className="rounded-xl border border-slate-200 p-4"><h4 className="font-semibold">Entrega</h4><p className="mt-2 text-sm text-slate-600">{selected.submission.name || 'Sem alvo de submissão'} · {date(selected.submission.deadline)}</p><p className="mt-1 text-xs text-slate-500">{selected.submission.profileId ?? 'Sem profile'} · {selected.submission.outputs.map(submissionOutputLabel).join(', ')}</p></section>
  </div>;

  const members = selected === undefined ? null : <div className="grid gap-5">
    <section><div className="flex gap-3"><h4 className="font-semibold">Documentos</h4>{activeFile !== undefined && <button type="button" className="text-sm font-semibold text-indigo-700" onClick={() => update(selected.id, (project) => ({ ...project, documentIds: toggle(project.documentIds, activeFile.fileId) }))}>{selected.documentIds.includes(activeFile.fileId) ? 'Remover ativo' : 'Adicionar ativo'}</button>}</div><ul className="mt-2 grid gap-2">{selected.documentIds.map((fileId) => <li key={fileId} className="flex rounded border border-slate-200 p-2 text-sm"><span className="flex-1">{files.find((file) => file.fileId === fileId)?.path ?? fileId}</span><button type="button" className="text-rose-600" onClick={() => update(selected.id, (project) => ({ ...project, documentIds: project.documentIds.filter((id) => id !== fileId) }))}>Remover</button></li>)}</ul></section>
    <section><div className="flex gap-3"><h4 className="font-semibold">Referências</h4><button type="button" className="text-sm font-semibold text-indigo-700" onClick={() => { void requestText('ID/chave da referência').then((id) => { if (id !== null && id.trim() !== '') update(selected.id, (project) => ({ ...project, referenceIds: toggle(project.referenceIds, id.trim()) })); }); }}>Adicionar</button></div><ul className="mt-2 grid gap-2">{selected.referenceIds.map((id) => <li key={id} className="flex rounded border border-slate-200 p-2 text-sm"><span className="flex-1">{overview?.references.find((reference) => reference.referenceId === id)?.title ?? id}</span><button type="button" className="text-rose-600" onClick={() => update(selected.id, (project) => ({ ...project, referenceIds: project.referenceIds.filter((value) => value !== id) }))}>Remover</button></li>)}</ul></section>
    <section className="grid gap-3 md:grid-cols-2"><div><h4 className="font-semibold">Collections</h4>{knowledge.collections.map((collection) => <label key={collection.id} className="mt-2 flex gap-2 text-sm"><input type="checkbox" checked={selected.collectionIds.includes(collection.id)} onChange={() => update(selected.id, (project) => ({ ...project, collectionIds: toggle(project.collectionIds, collection.id) }))} />{collection.name}</label>)}</div><div><h4 className="font-semibold">Buscas salvas</h4>{knowledge.searches.map((search) => <label key={search.id} className="mt-2 flex gap-2 text-sm"><input type="checkbox" checked={selected.savedSearchIds.includes(search.id)} onChange={() => update(selected.id, (project) => ({ ...project, savedSearchIds: toggle(project.savedSearchIds, search.id) }))} />{search.name}</label>)}</div></section>
  </div>;

  const milestones = selected === undefined ? null : <div className="grid gap-4"><button type="button" className="folio-primary w-fit rounded-lg px-3 py-2 text-sm font-semibold" onClick={() => { void (async () => { const title = await requestText('Nome do marco', 'Primeira versão'); if (title === null || title.trim() === '') return; const dueDate = (await requestText('Prazo (AAAA-MM-DD, opcional)')) ?? ''; update(selected.id, (project) => ({ ...project, milestones: [...project.milestones, { id: crypto.randomUUID(), title: title.trim(), ...(dueDate.trim() === '' ? {} : { dueDate: dueDate.trim() }) }] })); })(); }}>Novo marco</button><ul className="grid gap-2">{selected.milestones.map((milestone) => <li key={milestone.id} className="flex gap-3 rounded border border-slate-200 p-3"><input type="checkbox" checked={milestone.completedAt !== undefined} onChange={() => update(selected.id, (project) => ({ ...project, milestones: project.milestones.map((item) => item.id !== milestone.id ? item : item.completedAt === undefined ? { ...item, completedAt: now() } : { ...item, completedAt: undefined }) }))} /><span className="flex-1 text-sm">{milestone.title} · {date(milestone.dueDate)}</span><button type="button" className="text-rose-600" onClick={() => update(selected.id, (project) => ({ ...project, milestones: project.milestones.filter((item) => item.id !== milestone.id) }))}>Remover</button></li>)}</ul></div>;

  const submission = selected === undefined ? null : <div className="grid gap-5">
    <section className="grid gap-3 rounded-xl border border-slate-200 p-4"><h4 className="font-semibold">Alvo de submissão</h4><label className="grid gap-1 text-sm">Nome<input value={selected.submission.name} onChange={(event) => update(selected.id, (project) => ({ ...project, submission: { ...project.submission, name: event.target.value } }))} className="rounded border border-slate-300 p-2" placeholder="TCC institucional, periódico ou congresso" /></label><label className="grid gap-1 text-sm">Profile<select value={selected.submission.profileId ?? ''} onChange={(event) => update(selected.id, (project) => ({ ...project, submission: { ...project.submission, ...(event.target.value === '' ? { profileId: undefined } : { profileId: event.target.value }) } }))} className="rounded border border-slate-300 p-2"><option value="">Sem profile</option>{profiles.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select></label><label className="grid gap-1 text-sm">Deadline<input type="date" value={selected.submission.deadline ?? ''} onChange={(event) => update(selected.id, (project) => ({ ...project, submission: { ...project.submission, ...(event.target.value === '' ? { deadline: undefined } : { deadline: event.target.value }) } }))} className="rounded border border-slate-300 p-2" /></label><div><span className="text-sm font-medium">Artefatos exigidos</span>{(['pdf', 'docx', 'html', 'supplemental'] as const).map((output) => <label key={output} className="ml-4 text-sm"><input type="checkbox" checked={selected.submission.outputs.includes(output)} onChange={() => update(selected.id, (project) => ({ ...project, submission: { ...project.submission, outputs: toggle(project.submission.outputs, output) } }))} /> {submissionOutputLabel(output)}</label>)}</div></section>
    <section className="rounded-xl border border-slate-200 p-4"><div className="flex items-center gap-3"><div><h4 className="font-semibold">Metadata para Crossref</h4><p className="mt-1 text-xs text-slate-500">Preparação local para revisão e exportação; não registra DOI nem envia dados.</p></div><span className="ml-auto rounded-full bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">Crossref</span></div><label className="mt-3 grid gap-1 text-sm">Título do depósito<input value={selected.submission.metadataTitle} placeholder={selected.title} className="rounded border border-slate-300 p-2" onChange={(event) => update(selected.id, (project) => ({ ...project, submission: { ...project.submission, metadataTitle: event.target.value } }))} /></label><div className="mt-4 space-y-2"><div className="flex items-center justify-between"><strong className="text-sm">Autores e ORCID</strong><button type="button" className="text-sm font-semibold text-indigo-700" onClick={() => update(selected.id, (project) => ({ ...project, submission: { ...project.submission, authors: [...project.submission.authors, { id: crypto.randomUUID(), name: '' }] } }))}>Adicionar autor</button></div>{selected.submission.authors.map((author, index) => { const valid = author.orcid === undefined || author.orcid.trim() === '' || normalizeOrcid(author.orcid) !== undefined; return <div key={author.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><input aria-label={`Nome do autor ${index + 1}`} value={author.name} placeholder="Nome do autor" className="rounded border border-slate-300 p-2 text-sm" onChange={(event) => update(selected.id, (project) => ({ ...project, submission: { ...project.submission, authors: project.submission.authors.map((candidate) => candidate.id === author.id ? { ...candidate, name: event.target.value } : candidate) } }))} /><div><input aria-label={`ORCID de ${author.name || `autor ${index + 1}`}`} value={author.orcid ?? ''} placeholder="0000-0000-0000-0000" className={`w-full rounded border p-2 text-sm ${valid ? 'border-slate-300' : 'border-rose-400'}`} onChange={(event) => update(selected.id, (project) => ({ ...project, submission: { ...project.submission, authors: project.submission.authors.map((candidate) => candidate.id === author.id ? { ...candidate, orcid: event.target.value } : candidate) } }))} />{!valid && <p className="mt-1 text-xs text-rose-600">ORCID inválido.</p>}</div><button type="button" className="text-sm text-rose-600" onClick={() => update(selected.id, (project) => ({ ...project, submission: { ...project.submission, authors: project.submission.authors.filter((candidate) => candidate.id !== author.id) } }))}>Remover</button></div>; })}</div><div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600"><p className="font-semibold text-slate-700">Prévia do depósito</p><p className="mt-1"><strong>Título:</strong> {crossref?.title}</p><p className="mt-1 break-words"><strong>Contribuidores:</strong> {crossref?.contributors || 'Adicione ao menos um autor.'}</p></div></section>
    <section className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap gap-3"><h4 className="font-semibold">Presets de exportação</h4><button type="button" className="text-sm font-semibold text-indigo-700" onClick={() => { void requestText('Nome do preset', 'Entrega final').then((name) => { if (name !== null && name.trim() !== '') update(selected.id, (project) => ({ ...project, submission: { ...project.submission, presets: [...project.submission.presets, { id: crypto.randomUUID(), name: name.trim(), outputs: project.submission.outputs }] } })); }); }}>Salvar preset atual</button></div><div className="mt-2 flex flex-wrap gap-2">{selected.submission.presets.map((preset) => <button key={preset.id} type="button" className="rounded border border-indigo-200 px-2 py-1 text-sm text-indigo-700" onClick={() => update(selected.id, (project) => ({ ...project, submission: { ...project.submission, outputs: preset.outputs } }))}>{preset.name}: {preset.outputs.map(submissionOutputLabel).join(', ')}</button>)}</div></section>
    <section className="rounded-xl border border-slate-200 p-4"><h4 className="font-semibold">Preflight</h4>{preflight === undefined ? <p className="mt-2 text-sm text-slate-500">Atualizando projeções revisionadas…</p> : <><p className={`mt-2 text-sm ${submissionIsReady(preflight) ? 'text-emerald-700' : 'text-rose-700'}`}>{submissionIsReady(preflight) ? 'Pronto para snapshot final.' : 'Há bloqueios de publicação para resolver.'}</p><div className="mt-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-4"><Metric label="Erros" value={preflight.errors} /><Metric label="Avisos" value={preflight.warnings} /><Metric label="Citações" value={preflight.citations} /><Metric label="Xrefs abertas" value={preflight.unresolvedCrossReferences} /><Metric label="Citações ausentes" value={preflight.unresolvedCitations} /><Metric label="Pendências bib." value={preflight.bibliographyIssues} /><Metric label="Figuras" value={preflight.figures} /><Metric label="Tabelas" value={preflight.tables} /></div><p className="mt-3 text-xs text-slate-500">Agrega diagnósticos, estatísticas, recursos e Reference Health existentes; não cria uma segunda validação.</p></>}</section>
    <section className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-center gap-3"><h4 className="font-semibold">Snapshot e artefatos</h4><button type="button" disabled={preflight === undefined || !submissionIsReady(preflight)} className="folio-primary rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50" onClick={() => void createFinalSnapshot()}>Criar snapshot final</button></div><p className="mt-2 text-xs text-slate-500">Cada artefato é aceito somente se a revisão e o hash autoral ainda forem os do snapshot.</p><ul className="mt-3 grid gap-3">{[...selected.submission.records].reverse().map((record) => <li key={record.id} className="rounded border border-slate-200 p-3"><div className="flex flex-wrap items-center gap-3"><strong className="text-sm">{record.target}</strong><span className="text-xs text-slate-500">{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(record.createdAt))} · {record.profileId ?? 'profile da compilação'}{record.profileVersion === undefined ? '' : ` v${record.profileVersion}`}</span><button type="button" className="ml-auto rounded border border-indigo-200 px-2 py-1 text-sm font-semibold text-indigo-700" onClick={() => void generateArtifacts(record, selected.submission.outputs)}>Gerar artefatos</button></div><p className="mt-2 text-xs text-slate-500">{record.sources.length} fontes / {record.snapshots.length} snapshots / {record.artifacts.length} artefatos</p><ul className="mt-2 grid gap-1">{record.artifacts.map((artifact) => <li key={`${artifact.path}:${artifact.createdAt}`} className="text-xs text-slate-600">{artifact.format.toUpperCase()} · {artifact.path} · {artifact.sha256}</li>)}</ul></li>)}</ul></section>
    <section><div className="flex gap-3"><h4 className="font-semibold">Requisitos de entrega</h4><button type="button" className="text-sm font-semibold text-indigo-700" onClick={() => { void requestText('Item do requisito').then((label) => { if (label !== null && label.trim() !== '') update(selected.id, (project) => ({ ...project, submission: { ...project.submission, checklist: [...project.submission.checklist, { id: crypto.randomUUID(), label: label.trim(), checked: false }] } })); }); }}>Adicionar</button></div><ul className="mt-2 grid gap-2">{selected.submission.checklist.map((item) => <li key={item.id} className="flex gap-2 rounded border border-slate-200 p-2 text-sm"><input type="checkbox" checked={item.checked} onChange={() => update(selected.id, (project) => ({ ...project, submission: { ...project.submission, checklist: project.submission.checklist.map((candidate) => candidate.id === item.id ? { ...candidate, checked: !candidate.checked } : candidate) } }))} /><span className="flex-1">{item.label}</span><button type="button" className="text-rose-600" onClick={() => update(selected.id, (project) => ({ ...project, submission: { ...project.submission, checklist: project.submission.checklist.filter((candidate) => candidate.id !== item.id) } }))}>Remover</button></li>)}</ul></section>
    <button type="button" className="w-fit rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700" onClick={() => { void (async () => { if (selected.archivedAt === undefined && !await requestConfirmation({ title: 'Arquivar projeto?', description: `O projeto “${selected.title}” será ocultado das listas ativas. Documentos e referências não serão removidos.`, confirmLabel: 'Arquivar projeto' })) return; update(selected.id, (project) => ({ ...project, ...(project.archivedAt === undefined ? { archivedAt: now() } : { archivedAt: undefined }) })); setShowArchived(true); })(); }}>{selected.archivedAt === undefined ? 'Arquivar projeto' : 'Reativar projeto'}</button>
  </div>;

  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm"><section role="dialog" aria-modal="true" aria-labelledby="projects-title" className="grid h-[min(88vh,58rem)] w-full max-w-6xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"><header className="flex items-start border-b border-slate-200 bg-white px-5 py-5 md:px-7"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">Organização acadêmica</p><h2 id="projects-title" className="mt-1 text-xl font-bold tracking-tight text-slate-900">Projetos de pesquisa</h2><p className="mt-1 text-sm text-slate-500">Reúna documentos, referências, metas e entrega sem mover arquivos nem alterar Markdown.</p></div><button type="button" aria-label="Fechar projetos" className="folio-control ml-auto grid h-9 w-9 place-items-center rounded-lg text-xl text-slate-500" onClick={onClose}>×</button></header><div className="grid min-h-0 md:grid-cols-[18rem_minmax(0,1fr)]"><aside className="flex min-h-0 flex-col border-b border-slate-200 bg-slate-50 p-3 md:border-b-0 md:border-r"><button type="button" className="w-full rounded-xl bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700" onClick={create}>Novo projeto</button><label className="relative mt-3 block"><span className="sr-only">Buscar projetos</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar projetos…" className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100" /><span aria-hidden="true" className="pointer-events-none absolute right-3 top-2 text-slate-400">⌕</span></label><label className="mt-3 flex items-center gap-2 px-1 text-xs font-medium text-slate-600"><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} /> Mostrar arquivados</label><p className="mt-4 px-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{visible.length} projeto{visible.length === 1 ? '' : 's'}</p><VirtualizedList ariaLabel="Projetos de pesquisa" className="mt-2 min-h-0 flex-1" height="100%" viewportHeight={520} itemHeight={68} items={visible} getKey={(project) => project.id} renderItem={(project) => <button type="button" onClick={() => setSelectedId(project.id)} className={`h-full w-full rounded-xl border px-3 py-2.5 text-left transition ${selected?.id === project.id ? 'border-indigo-200 bg-indigo-50 shadow-sm' : 'border-transparent hover:border-slate-200 hover:bg-white'}`}><strong className="block truncate text-sm text-slate-800">{project.title}</strong><span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${project.archivedAt === undefined ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{project.archivedAt === undefined ? 'Ativo' : 'Arquivado'}</span></button>} />{visible.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-500">Nenhum projeto encontrado.</p>}</aside><div className="flex min-h-0 flex-col bg-white">{selected === undefined ? <div className="grid flex-1 place-items-center p-8 text-center"><div><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-xl text-indigo-600">⌘</div><h3 className="mt-4 font-bold text-slate-800">Organize uma pesquisa</h3><p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">Crie um projeto para reunir seus documentos, referências, marcos e a preparação da entrega.</p></div></div> : <><nav className="flex shrink-0 flex-wrap gap-2 border-b border-slate-200 bg-white px-5 py-3 md:px-7" aria-label="Seções do projeto">{([['dashboard', 'Painel'], ['members', 'Vínculos'], ['milestones', 'Marcos'], ['submission', 'Entrega']] as const).map(([id, label]) => <button key={id} type="button" onClick={() => setTab(id)} className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${tab === id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}>{label}</button>)}</nav><div className="min-h-0 flex-1 overflow-auto bg-slate-50/60 p-5 md:p-7"><div className="mx-auto max-w-4xl">{tab === 'dashboard' ? dashboardView : tab === 'members' ? members : tab === 'milestones' ? milestones : submission}</div></div></>}{message !== undefined && <p className="border-t border-amber-200 bg-amber-50 px-6 py-2 text-sm text-amber-800">{message}</p>}</div></div></section></div>;
}
