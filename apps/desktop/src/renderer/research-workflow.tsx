import { useEffect, useState, type JSX } from 'react';

import type { WorkspaceResearchOverviewDto, WorkspaceResearchReferenceDto } from '@abnt/protocol';

type ReadingState = 'to-read' | 'reading' | 'read' | 'reviewed';
type ReadingQueue = Readonly<Record<string, { readonly state: ReadingState; readonly updatedAt: string }>>;

const labels: Record<ReadingState, string> = {
  'to-read': 'Para ler',
  reading: 'Lendo',
  read: 'Lido',
  reviewed: 'Revisado',
};

const formatDate = (value: string | undefined): string => value === undefined ? 'Ainda não iniciado' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(value));

function StatusSelect({ referenceId, queue, onChange }: { readonly referenceId: string; readonly queue: ReadingQueue; readonly onChange: (state: ReadingState) => void }): JSX.Element {
  return <select value={queue[referenceId]?.state ?? 'to-read'} onChange={(event) => onChange(event.target.value as ReadingState)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 outline-none focus:border-indigo-400">
    {(Object.entries(labels) as readonly [ReadingState, string][]).map(([state, label]) => <option key={state} value={state}>{label}</option>)}
  </select>;
}

function EmptyValue({ children }: { readonly children: string | undefined }): JSX.Element {
  return <span className={children === undefined ? 'text-slate-400' : 'text-slate-700'}>{children ?? '—'}</span>;
}

export function ResearchWorkflowDialog({ workspaceId, onClose, onOpenDocument }: { readonly workspaceId: string; readonly onClose: () => void; readonly onOpenDocument: (fileId: string, path: string) => void }): JSX.Element {
  const [tab, setTab] = useState<'queue' | 'dashboard' | 'matrix'>('queue');
  const [overview, setOverview] = useState<WorkspaceResearchOverviewDto | undefined>(undefined);
  const [queue, setQueue] = useState<ReadingQueue>({});
  const [message, setMessage] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setOverview(undefined);
    void Promise.all([window.academic.workspace.researchOverview({}), window.academic.workspace.readingQueue()]).then(([overviewResult, queueResult]) => {
      if (cancelled) return;
      if (overviewResult.ok) setOverview(overviewResult.value);
      else setMessage(overviewResult.error.message);
      if (queueResult.ok) setQueue(queueResult.value.entries);
      else setMessage(queueResult.error.message);
    });
    return () => { cancelled = true; };
  }, [workspaceId]);

  const updateReading = (referenceId: string, state: ReadingState): void => {
    const next = { ...queue, [referenceId]: { state, updatedAt: new Date().toISOString() } };
    setQueue(next);
    void window.academic.workspace.setReadingQueue({ version: 1, entries: next }).then((result) => { if (!result.ok) setMessage(result.error.message); });
  };
  const createNote = (reference: WorkspaceResearchReferenceDto): void => {
    void window.academic.documents.createLiteratureNote({ referenceId: reference.referenceId }).then((result) => {
      if (!result.ok) { setMessage(result.error.message); return; }
      onOpenDocument(result.value.fileId, result.value.path);
    });
  };
  const entries = overview?.references ?? [];
  const queueEntries = [...entries].sort((left, right) => {
    const rank = (entry: WorkspaceResearchReferenceDto): number => ['reading', 'to-read', 'read', 'reviewed'].indexOf(queue[entry.referenceId]?.state ?? 'to-read');
    return rank(left) - rank(right) || left.title.localeCompare(right.title, 'pt-BR');
  });
  const counts = (Object.keys(labels) as ReadingState[]).map((state) => [state, entries.filter((entry) => (queue[entry.referenceId]?.state ?? 'to-read') === state).length] as const);

  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-5"><section role="dialog" aria-modal="true" aria-labelledby="research-workflow-title" className="flex h-[min(82vh,52rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20"><header className="flex items-start border-b border-slate-200 px-6 py-5"><div><h2 id="research-workflow-title" className="text-lg font-bold text-slate-900">Fluxo de pesquisa</h2><p className="mt-0.5 text-sm text-slate-500">Fila local, painel de referências e matriz derivada das notas do vault.</p></div><button type="button" aria-label="Fechar" className="folio-control ml-auto grid h-9 w-9 place-items-center rounded-lg text-xl" onClick={onClose}>×</button></header><nav className="flex gap-5 border-b border-slate-200 px-6" aria-label="Seções do fluxo de pesquisa">{([['queue', 'Fila de leitura'], ['dashboard', 'Painel de referências'], ['matrix', 'Matriz de revisão']] as const).map(([id, label]) => <button key={id} type="button" className={`border-b-2 px-1 py-3 text-sm font-semibold ${tab === id ? 'border-indigo-500 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`} onClick={() => setTab(id)}>{label}</button>)}</nav><div className="min-h-0 flex-1 overflow-auto p-6">{overview === undefined ? <p className="py-16 text-center text-sm text-slate-500">Carregando dados de pesquisa…</p> : tab === 'queue' ? <><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{counts.map(([state, count]) => <div key={state} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">{labels[state]}</span><strong className="mt-1 block text-2xl text-slate-800">{count}</strong></div>)}</div><ul className="mt-5 grid gap-2">{queueEntries.length === 0 ? <li className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">A biblioteca do vault ainda não possui referências.</li> : queueEntries.map((reference) => <li key={reference.referenceId} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 p-3"><div className="min-w-0 flex-1"><strong className="block truncate text-sm text-slate-800">{reference.title}</strong><span className="block truncate text-xs text-slate-500">{reference.authors.join('; ') || reference.referenceId} · atualizado {formatDate(queue[reference.referenceId]?.updatedAt)}</span></div><span className={`rounded-full px-2 py-1 text-xs font-semibold ${reference.pdf === undefined ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'}`}>{reference.pdf === undefined ? 'Sem PDF' : 'PDF anexado'}</span><StatusSelect referenceId={reference.referenceId} queue={queue} onChange={(state) => updateReading(reference.referenceId, state)} /></li>)}</ul></> : tab === 'dashboard' ? <div className="grid gap-3 md:grid-cols-2">{entries.map((reference) => <article key={reference.referenceId} className="rounded-xl border border-slate-200 p-4"><div className="flex gap-3"><div className="min-w-0 flex-1"><h3 className="truncate font-semibold text-slate-800">{reference.title}</h3><p className="mt-1 truncate text-sm text-slate-500">{reference.authors.join('; ') || reference.referenceId}</p></div><StatusSelect referenceId={reference.referenceId} queue={queue} onChange={(state) => updateReading(reference.referenceId, state)} /></div><dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm"><div><dt className="text-xs text-slate-500">Citações</dt><dd className="font-semibold text-slate-800">{reference.citationCount}</dd></div><div><dt className="text-xs text-slate-500">Última leitura</dt><dd className="font-medium text-slate-700">{formatDate(queue[reference.referenceId]?.updatedAt)}</dd></div><div><dt className="text-xs text-slate-500">DOI</dt><dd className="truncate"><EmptyValue>{reference.doi}</EmptyValue></dd></div><div><dt className="text-xs text-slate-500">PDF / nota</dt><dd className="font-medium text-slate-700">{reference.pdf === undefined ? '—' : 'PDF'} · {reference.literatureNote === undefined ? 'sem nota' : 'nota'}</dd></div></dl><div className="mt-4 flex gap-3 text-xs font-semibold text-indigo-700">{reference.literatureNote === undefined ? <button type="button" onClick={() => createNote(reference)}>Criar nota</button> : <button type="button" onClick={() => onOpenDocument(reference.literatureNote!.fileId, reference.literatureNote!.path)}>Abrir nota</button>}</div></article>)}</div> : <div className="overflow-auto rounded-xl border border-slate-200"><table className="min-w-[54rem] w-full border-collapse text-left text-sm"><thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{['Referência', 'Tópico', 'Método', 'Amostra', 'Resultado', 'Nota'].map((heading) => <th key={heading} className="border-b border-slate-200 px-3 py-3 font-semibold">{heading}</th>)}</tr></thead><tbody>{entries.map((reference) => <tr key={reference.referenceId} className="border-b border-slate-100 align-top"><td className="px-3 py-3"><strong className="block text-slate-800">{reference.title}</strong><span className="text-xs text-slate-500">{reference.referenceId}</span></td><td className="px-3 py-3"><EmptyValue>{reference.review.topic}</EmptyValue></td><td className="px-3 py-3"><EmptyValue>{reference.review.method}</EmptyValue></td><td className="px-3 py-3"><EmptyValue>{reference.review.sample}</EmptyValue></td><td className="px-3 py-3"><EmptyValue>{reference.review.result}</EmptyValue></td><td className="px-3 py-3">{reference.literatureNote === undefined ? <button type="button" className="font-semibold text-indigo-700" onClick={() => createNote(reference)}>Criar</button> : <button type="button" className="font-semibold text-indigo-700" onClick={() => onOpenDocument(reference.literatureNote!.fileId, reference.literatureNote!.path)}>Abrir</button>}</td></tr>)}</tbody></table>{entries.length === 0 && <p className="p-5 text-sm text-slate-500">A matriz será preenchida pelas referências da biblioteca.</p>}</div>}</div>{message !== undefined && <p className="border-t border-slate-200 bg-amber-50 px-6 py-2 text-sm text-amber-800">{message}</p>}</section></div>;
}
