import { useEffect, useMemo, useState, type JSX } from 'react';

import type { WorkspaceProblemDto } from '@abnt/protocol';

import { codeActionsForProblem, type DiagnosticWorkspaceEdit } from './shell/diagnostic-actions.js';
import type { EditorViewState } from './shell/views.js';

export interface ReviewComment {
  readonly id: string;
  readonly fileId: string;
  readonly path: string;
  readonly revision: number;
  readonly range: { readonly start: number; readonly end: number };
  readonly message: string;
  readonly createdAt: number;
}

type ReviewFilters = { readonly severity: 'all' | 'error' | 'warning' | 'info'; readonly category: 'all' | 'citations' | 'bibliography' | 'figures'; readonly scope: 'workspace' | 'document'; };
const filtersKey = (workspaceId: string): string => `folio.review.filters:${workspaceId}`;
const commentsKey = (workspaceId: string): string => `folio.review.comments:${workspaceId}`;
const defaults: ReviewFilters = { severity: 'all', category: 'all', scope: 'workspace' };

export const readReviewComments = (workspaceId: string): readonly ReviewComment[] => {
  try { const value: unknown = JSON.parse(window.localStorage.getItem(commentsKey(workspaceId)) ?? '[]'); return Array.isArray(value) ? value.filter((entry): entry is ReviewComment => typeof entry === 'object' && entry !== null && typeof entry.id === 'string' && typeof entry.fileId === 'string' && typeof entry.path === 'string' && typeof entry.revision === 'number' && typeof entry.message === 'string' && typeof entry.createdAt === 'number' && typeof (entry as { range?: unknown }).range === 'object') : []; } catch { return []; }
};
export const writeReviewComments = (workspaceId: string, comments: readonly ReviewComment[]): void => { try { window.localStorage.setItem(commentsKey(workspaceId), JSON.stringify(comments)); } catch { /* preferência local opcional */ } };

const categoryFor = (problem: WorkspaceProblemDto): ReviewFilters['category'] => problem.ruleId.startsWith('CIT') ? 'citations' : problem.ruleId.startsWith('REF') ? 'bibliography' : problem.ruleId.startsWith('FIG') || problem.ruleId.startsWith('TAB') ? 'figures' : 'all';

export function ReviewWorkspaceDialog({ workspaceId, activeView, onClose, onOpenProblem, onApplyEdit }: {
  readonly workspaceId: string;
  readonly activeView: EditorViewState | undefined;
  readonly onClose: () => void;
  readonly onOpenProblem: (problem: WorkspaceProblemDto) => void;
  readonly onApplyEdit: (edit: DiagnosticWorkspaceEdit) => void;
}): JSX.Element {
  const [problems, setProblems] = useState<readonly WorkspaceProblemDto[]>([]);
  const [comments, setComments] = useState<readonly ReviewComment[]>(() => readReviewComments(workspaceId));
  const [filters, setFilters] = useState<ReviewFilters>(() => { try { return { ...defaults, ...(JSON.parse(window.localStorage.getItem(filtersKey(workspaceId)) ?? '{}') as Partial<ReviewFilters>) }; } catch { return defaults; } });
  const [commentText, setCommentText] = useState('');
  useEffect(() => { let cancelled=false; void window.academic.workspace.problems({}).then((result) => { if (!cancelled && result.ok) setProblems(result.value); }); return () => { cancelled=true; }; }, [workspaceId]);
  useEffect(() => { try { window.localStorage.setItem(filtersKey(workspaceId), JSON.stringify(filters)); } catch { /* preferência local opcional */ } }, [filters, workspaceId]);
  const shown = useMemo(() => problems.filter((problem) => (filters.severity === 'all' || problem.severity === filters.severity) && (filters.category === 'all' || categoryFor(problem) === filters.category) && (filters.scope === 'workspace' || problem.fileId === activeView?.fileId)), [problems, filters, activeView?.fileId]);
  const addComment = (): void => {
    if (activeView === undefined || commentText.trim() === '') return;
    const range = { start: Math.min(activeView.snapshot.selection.anchor, activeView.snapshot.selection.head), end: Math.max(activeView.snapshot.selection.anchor, activeView.snapshot.selection.head) };
    const next = [...comments, { id: crypto.randomUUID(), fileId: activeView.fileId, path: activeView.path, revision: activeView.snapshot.session.revision, range, message: commentText.trim(), createdAt: Date.now() }];
    setComments(next); writeReviewComments(workspaceId, next); setCommentText('');
  };
  const activeProblem = (problem: WorkspaceProblemDto): ReturnType<typeof codeActionsForProblem> => problem.fileId === activeView?.fileId && problem.revision === activeView.snapshot.session.revision ? codeActionsForProblem(problem, activeView.snapshot.session.content) : [];
  return <div className="fixed inset-0 z-[56] grid place-items-center bg-slate-950/45 p-5"><section role="dialog" aria-modal="true" aria-labelledby="review-title" className="flex h-[min(84vh,54rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"><header className="flex border-b border-slate-200 px-6 py-4"><div><h2 id="review-title" className="text-lg font-bold text-slate-900">Modo de revisão</h2><p className="text-sm text-slate-500">Problemas, comentários e correções seguras na mesma superfície.</p></div><button type="button" className="ml-auto text-xl text-slate-500" onClick={onClose}>×</button></header><div className="flex flex-wrap gap-2 border-b border-slate-100 px-6 py-3 text-xs">{(['all','error','warning','info'] as const).map((value) => <button key={value} type="button" onClick={() => setFilters((current) => ({ ...current, severity: value }))} className={`rounded-full px-2 py-1 ${filters.severity === value ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{value === 'all' ? 'Todos' : value}</button>)}{(['all','citations','bibliography','figures'] as const).map((value) => <button key={value} type="button" onClick={() => setFilters((current) => ({ ...current, category: value }))} className={`rounded-full px-2 py-1 ${filters.category === value ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{value === 'all' ? 'Tudo' : value}</button>)}<button type="button" onClick={() => setFilters((current) => ({ ...current, scope: current.scope === 'workspace' ? 'document' : 'workspace' }))} className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">{filters.scope === 'workspace' ? 'Vault inteiro' : 'Documento atual'}</button></div><div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(19rem,.6fr)]"><div className="min-h-0 overflow-auto p-5"><h3 className="text-sm font-semibold text-slate-800">Problemas ({shown.length})</h3><ul className="mt-2 divide-y divide-slate-100">{shown.map((problem, index) => <li key={`${problem.fileId}:${problem.ruleId}:${problem.range?.start ?? index}`} className="py-3"><button type="button" className="w-full text-left hover:text-indigo-700" onClick={() => onOpenProblem(problem)}><span className="mr-2 text-xs uppercase text-slate-400">{problem.severity}</span><code className="mr-2 text-xs text-slate-500">{problem.ruleId}</code>{problem.message}<span className="ml-2 text-xs text-slate-400">{problem.path}{problem.section === undefined ? '' : ` · ${problem.section}`}</span></button>{activeProblem(problem).map((action) => <button key={action.id} type="button" className="mt-2 rounded bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700" onClick={() => onApplyEdit(action.edit)}>{action.title}</button>)}</li>)}</ul></div><aside className="min-h-0 overflow-auto border-l border-slate-100 bg-slate-50 p-5"><h3 className="text-sm font-semibold text-slate-800">Comentários editoriais</h3><p className="mt-1 text-xs text-slate-500">Estado operacional local; não entra no Markdown.</p><textarea value={commentText} onChange={(event) => setCommentText(event.target.value)} disabled={activeView === undefined} placeholder="Comentário sobre a seleção atual…" className="mt-3 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm" /><button type="button" disabled={activeView === undefined || commentText.trim() === ''} onClick={addComment} className="mt-2 rounded bg-indigo-600 px-3 py-1.5 text-sm text-white disabled:opacity-40">Adicionar comentário</button><ul className="mt-4 grid gap-2">{comments.map((comment) => <li key={comment.id} className="rounded-lg border border-slate-200 bg-white p-2 text-sm"><div className="text-xs text-slate-400">{comment.path} · rev. {comment.revision}</div><p className="mt-1 text-slate-700">{comment.message}</p><button type="button" className="mt-1 text-xs text-red-600" onClick={() => { const next=comments.filter((item) => item.id !== comment.id); setComments(next); writeReviewComments(workspaceId,next); }}>Remover</button></li>)}</ul></aside></div></section></div>;
}
