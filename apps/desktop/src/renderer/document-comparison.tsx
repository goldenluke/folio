import { useEffect, useState, type JSX } from 'react';

import type { WorkspaceDocumentComparisonDto, WorkspaceFileDto } from '@abnt/protocol';

function DiffLines({ comparison }: { readonly comparison: WorkspaceDocumentComparisonDto }): JSX.Element {
  return <div className="min-h-80 overflow-auto rounded-lg border border-slate-200 bg-slate-950 font-mono text-xs">{comparison.text.lines.map((line, index) => <div key={index} className={line.kind === 'added' ? 'bg-emerald-950 text-emerald-100' : line.kind === 'removed' ? 'bg-rose-950 text-rose-100' : 'text-slate-300'}><span className="inline-block w-16 select-none px-2 text-right text-slate-500">{line.leftLine ?? ''} {line.rightLine ?? ''}</span><span className="inline-block w-5">{line.kind === 'added' ? '+' : line.kind === 'removed' ? '-' : ' '}</span>{line.text}</div>)}</div>;
}

function StructuralChanges({ comparison }: { readonly comparison: WorkspaceDocumentComparisonDto }): JSX.Element {
  return <div className="min-h-80 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3">{comparison.structural.changes.length === 0 ? <p className="p-2 text-sm text-slate-500">Nenhuma alteração estrutural reconhecida.</p> : <ul className="grid gap-2">{comparison.structural.changes.map((change, index) => <li key={`${change.kind}:${change.description}:${index}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"><span className="mr-2 text-xs font-bold uppercase text-slate-400">{change.kind}</span>{change.description}</li>)}</ul>}</div>;
}

/** F89: a tela só escolhe documentos e projeta os DTOs calculados pelo Workspace Service. */
export function DocumentComparisonDialog({ files, initialFileId, onClose }: { readonly files: readonly WorkspaceFileDto[]; readonly initialFileId?: string; readonly onClose: () => void }): JSX.Element {
  const initialLeft = initialFileId !== undefined && files.some((file) => file.fileId === initialFileId) ? initialFileId : files[0]?.fileId;
  const initialRight = files.find((file) => file.fileId !== initialLeft)?.fileId ?? initialLeft;
  const [leftFileId, setLeftFileId] = useState(initialLeft ?? '');
  const [rightFileId, setRightFileId] = useState(initialRight ?? '');
  const [comparison, setComparison] = useState<WorkspaceDocumentComparisonDto | undefined>();
  const [mode, setMode] = useState<'text' | 'structural'>('text');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (initialLeft !== undefined) setLeftFileId(initialLeft);
    if (initialRight !== undefined) setRightFileId(initialRight);
    setComparison(undefined); setMessage('');
  }, [initialLeft, initialRight]);

  const compare = (): void => {
    if (leftFileId === '' || rightFileId === '' || leftFileId === rightFileId) return;
    setMessage('Comparando documentos…'); setComparison(undefined);
    void window.academic.workspace.compareDocuments({ leftFileId, rightFileId }).then((result) => {
      if (result.ok) { setComparison(result.value); setMessage(''); }
      else setMessage(result.error.message);
    });
  };
  const select = (value: string, onChange: (fileId: string) => void, label: string): JSX.Element => <label className="grid gap-1 text-sm font-medium text-slate-700">{label}<select value={value} onChange={(event) => { onChange(event.target.value); setComparison(undefined); }} className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal text-slate-800">{files.map((file) => <option key={file.fileId} value={file.fileId}>{file.path}</option>)}</select></label>;
  return <div className="fixed inset-0 z-[58] grid place-items-center bg-slate-950/45 p-5"><section role="dialog" aria-modal="true" aria-labelledby="document-comparison-title" className="flex h-[min(84vh,54rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"><header className="flex border-b border-slate-200 px-6 py-4"><div><h2 id="document-comparison-title" className="text-lg font-bold text-slate-900">Comparar documentos</h2><p className="text-sm text-slate-500">O conteúdo continua nos arquivos; a comparação é uma projeção local.</p></div><button type="button" className="ml-auto text-xl text-slate-500" onClick={onClose}>×</button></header><div className="grid gap-3 border-b border-slate-100 p-5 md:grid-cols-[1fr_1fr_auto]">{select(leftFileId, setLeftFileId, 'Documento base')}{select(rightFileId, setRightFileId, 'Documento comparado')}<button type="button" disabled={leftFileId === '' || rightFileId === '' || leftFileId === rightFileId} onClick={compare} className="self-end rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Comparar</button></div>{message !== '' && <p className="px-5 pt-3 text-sm text-slate-600">{message}</p>}<div className="flex min-h-0 flex-1 flex-col p-5">{comparison === undefined ? <div className="grid min-h-0 flex-1 place-items-center rounded-lg bg-slate-50 p-6 text-center text-sm text-slate-500">Escolha dois documentos diferentes e execute a comparação.</div> : <><div className="mb-3 flex gap-2 border-b border-slate-200"><button type="button" onClick={() => setMode('text')} className={`px-3 py-2 text-sm font-semibold ${mode === 'text' ? 'border-b-2 border-indigo-600 text-indigo-700' : 'text-slate-500'}`}>Text Diff</button><button type="button" onClick={() => setMode('structural')} className={`px-3 py-2 text-sm font-semibold ${mode === 'structural' ? 'border-b-2 border-indigo-600 text-indigo-700' : 'text-slate-500'}`}>Structural Diff</button></div><div className="min-h-0 flex-1">{mode === 'text' ? <DiffLines comparison={comparison} /> : <StructuralChanges comparison={comparison} />}</div></>}</div></section></div>;
}
