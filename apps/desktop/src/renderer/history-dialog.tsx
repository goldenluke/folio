import { useEffect, useRef, useState, type JSX } from 'react';

import type { WorkspaceHistoryDiffDto, WorkspaceHistoryDto, WorkspaceHistoryStructuralDiffDto } from '@abnt/protocol';

import { useDialogAccessibility } from './dialog-accessibility.js';
import { requestText } from './text-prompt.js';

function TextDiff({ diff }: { readonly diff: WorkspaceHistoryDiffDto }): JSX.Element {
  return <div className="min-h-80 overflow-auto rounded-lg border border-slate-200 bg-slate-950 font-mono text-xs">{diff.lines.map((line, index) => <div key={index} className={line.kind === 'added' ? 'bg-emerald-950 text-emerald-100' : line.kind === 'removed' ? 'bg-rose-950 text-rose-100' : 'text-slate-300'}><span className="inline-block w-16 select-none px-2 text-right text-slate-500">{line.leftLine ?? ''} {line.rightLine ?? ''}</span><span className="inline-block w-5">{line.kind === 'added' ? '+' : line.kind === 'removed' ? '-' : ' '}</span>{line.text}</div>)}</div>;
}

function StructuralDiff({ diff }: { readonly diff: WorkspaceHistoryStructuralDiffDto }): JSX.Element {
  return <div className="min-h-80 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3">{diff.changes.length === 0 ? <p className="p-2 text-sm text-slate-500">Nenhuma alteração estrutural reconhecida.</p> : <ul className="grid gap-2">{diff.changes.map((change, index) => <li key={`${change.kind}:${change.description}:${index}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"><span className="mr-2 text-xs font-bold uppercase text-slate-400">{change.kind}</span>{change.description}</li>)}</ul>}</div>;
}

export function HistoryDialog({ fileId, path, onClose }: { readonly fileId: string; readonly path: string; readonly onClose: () => void }): JSX.Element {
  const dialog = useRef<HTMLElement>(null);
  useDialogAccessibility(dialog, onClose);
  const [history, setHistory] = useState<WorkspaceHistoryDto>();
  const [textDiff, setTextDiff] = useState<WorkspaceHistoryDiffDto>();
  const [structuralDiff, setStructuralDiff] = useState<WorkspaceHistoryStructuralDiffDto>();
  const [mode, setMode] = useState<'text' | 'structural'>('text');
  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState<string>();
  const requestEpoch = useRef(0);

  const load = (): void => {
    setLoadError(undefined);
    void window.academic.workspace.history({ fileId }).then((result) => {
      if (result.ok) setHistory(result.value);
      else setLoadError(result.error.message);
    }, () => setLoadError('Não foi possível carregar o histórico do documento.'));
  };

  useEffect(load, [fileId]);

  const snapshot = async (): Promise<void> => {
    const label = await requestText('Nome do snapshot', 'Snapshot manual');
    if (label === null) return;
    const result = await window.academic.workspace.historyCreateSnapshot({ fileId, label });
    if (result.ok) { setMessage('Snapshot criado.'); load(); }
    else setMessage(result.error.message);
  };

  const compare = (revisionId: string): void => {
    const epoch = ++requestEpoch.current;
    setTextDiff(undefined); setStructuralDiff(undefined); setMessage('Comparando revisão…');
    void Promise.all([
      window.academic.workspace.historyDiff({ fileId, fromRevisionId: revisionId }),
      window.academic.workspace.historyStructuralDiff({ fileId, fromRevisionId: revisionId }),
    ]).then(([text, structural]) => {
      if (epoch !== requestEpoch.current) return;
      if (!text.ok || !structural.ok) { setMessage('Não foi possível ler esta revisão.'); return; }
      setTextDiff(text.value); setStructuralDiff(structural.value); setMessage('');
    }, () => setMessage('Não foi possível ler esta revisão.'));
  };

  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/30 p-5">
    <section ref={dialog} role="dialog" aria-modal="true" aria-labelledby="history-title" aria-describedby="history-description" className="max-h-[92vh] w-full max-w-5xl overflow-auto rounded-xl border border-slate-200 bg-white p-5 shadow-2xl">
      <header className="flex">
        <div><h2 id="history-title" className="text-lg font-bold text-slate-900">Histórico: {path}</h2><p id="history-description" className="text-sm text-slate-500">Git é opcional; snapshots manuais ficam apenas neste vault.</p></div>
        <button type="button" aria-label="Fechar histórico" className="folio-control ml-auto grid h-9 w-9 place-items-center rounded-lg text-xl" onClick={onClose}>×</button>
      </header>
      <div className="mt-4 flex gap-2"><button type="button" className="folio-primary rounded-lg px-3 py-2 text-sm" onClick={() => void snapshot()}>Criar snapshot</button><span className="self-center text-xs text-slate-500">{history?.gitAvailable ? 'Repositório Git detectado' : 'Sem Git — use snapshots locais'}</span></div>
      {loadError !== undefined ? <div role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><p>{loadError}</p><button type="button" className="mt-2 rounded border border-rose-300 px-2 py-1 font-medium" onClick={load}>Tentar novamente</button></div> : <>
        {message !== '' && <p role={message === 'Comparando revisão…' ? 'status' : undefined} className="mt-2 text-sm text-slate-600">{message}</p>}
        <div className="mt-4 grid gap-4 lg:grid-cols-[260px_1fr]">
          <aside className="grid content-start gap-1 rounded-lg bg-slate-50 p-2" aria-label="Revisões disponíveis">
            {history === undefined ? <p role="status" className="p-2 text-sm text-slate-500">Carregando histórico…</p> : history.revisions.length === 0 ? <p className="p-2 text-sm text-slate-500">Nenhuma revisão ainda. Crie um snapshot manual para começar.</p> : history.revisions.map((revision) => <button key={revision.id} type="button" className="rounded-lg px-2 py-2 text-left hover:bg-white" onClick={() => compare(revision.id)}><strong className="block truncate text-sm text-slate-800">{revision.label}</strong><span className="text-xs text-slate-500">{revision.source === 'git' ? 'Git' : 'Snapshot'} · {new Date(revision.createdAt).toLocaleString()}</span></button>)}
          </aside>
          <div>{textDiff === undefined || structuralDiff === undefined ? <div className="min-h-80 rounded-lg border border-slate-200 bg-slate-950 p-4 font-mono text-xs text-slate-400">Escolha uma revisão para comparar com o documento atual.</div> : <><div className="mb-3 flex gap-2 border-b border-slate-200"><button type="button" onClick={() => setMode('text')} className={`px-3 py-2 text-sm font-semibold ${mode === 'text' ? 'border-b-2 border-indigo-600 text-indigo-700' : 'text-slate-500'}`}>Text Diff</button><button type="button" onClick={() => setMode('structural')} className={`px-3 py-2 text-sm font-semibold ${mode === 'structural' ? 'border-b-2 border-indigo-600 text-indigo-700' : 'text-slate-500'}`}>Structural Diff</button></div>{mode === 'text' ? <TextDiff diff={textDiff} /> : <StructuralDiff diff={structuralDiff} />}</>}</div>
        </div>
      </>}
    </section>
  </div>;
}
