import { useEffect, useState, type JSX } from 'react';

import type { WorkspaceLibraryMaintenanceOverviewDto, WorkspaceLibraryMaintenanceRowDto } from '@abnt/protocol';

import { requestConfirmation } from './text-prompt.js';

const AUDIT_LABEL: Record<string, string> = {
  'invalid-doi': 'DOI inválido', 'invalid-isbn': 'ISBN inválido', 'missing-url': 'sem URL', 'missing-access-date': 'sem data de acesso',
  'incomplete-author': 'autor incompleto', 'missing-year': 'sem ano', 'possible-duplicate': 'possível duplicata',
  'inconsistent-key': 'chave inconsistente', 'missing-pdf': 'sem PDF', 'missing-literature-note': 'sem literature note',
};
const ATTACHMENT_ISSUE_LABEL: Record<string, string> = { 'missing-file': 'arquivo ausente', 'broken-link': 'link inacessível', 'orphan-reference': 'referência órfã' };

/** Onda BO (F496–F504). Painel único de triagem: só compõe sinais já existentes, nunca recalcula algoritmo próprio. */
export function LibraryMaintenanceCenterDialog({ onClose, onMessage }: {
  readonly onClose: () => void;
  readonly onMessage: (message: string) => void;
}): JSX.Element {
  const [rows, setRows] = useState<readonly WorkspaceLibraryMaintenanceRowDto[]>([]);
  const [totals, setTotals] = useState<WorkspaceLibraryMaintenanceOverviewDto['totals'] | undefined>(undefined);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const load = (): void => {
    void window.academic.workspace.libraryMaintenanceOverview({}).then((result) => {
      if (result.ok) { setRows(result.value.rows); setTotals(result.value.totals); }
      else setError(result.error.message);
    });
  };
  useEffect(load, []);

  const toggle = (referenceId: string): void => setSelected((current) => {
    const next = new Set(current);
    if (next.has(referenceId)) next.delete(referenceId); else next.add(referenceId);
    return next;
  });
  const toggleAll = (): void => setSelected((current) => current.size === rows.length ? new Set() : new Set(rows.map((row) => row.referenceId)));

  const removeSelected = async (): Promise<void> => {
    if (selected.size === 0) return;
    const count = selected.size;
    if (!await requestConfirmation({ title: 'Remover referências selecionadas?', description: `${count} referência(s) serão removidas da biblioteca. Os documentos do vault não serão alterados.`, confirmLabel: 'Remover referências' })) return;
    setBusy(true);
    for (const referenceId of selected) {
      const result = await window.academic.library.remove({ id: referenceId });
      if (!result.ok) onMessage(result.error.message);
    }
    setBusy(false);
    setSelected(new Set());
    onMessage(`${count} referência(s) removida(s).`);
    load();
  };

  const cleanBrokenAttachments = async (): Promise<void> => {
    if (selected.size === 0) { onMessage('Selecione ao menos uma referência.'); return; }
    const issues = await window.academic.workspace.attachmentHealth();
    if (!issues.ok) { onMessage(issues.error.message); return; }
    const broken = issues.value.filter((issue) => selected.has(issue.referenceId) && (issue.code === 'missing-file' || issue.code === 'broken-link'));
    if (broken.length === 0) { onMessage('Nenhum anexo quebrado nas referências selecionadas.'); return; }
    if (!await requestConfirmation({ title: 'Remover anexos quebrados?', description: `${broken.length} anexo(s) com arquivo ausente ou link inacessível serão removidos.`, confirmLabel: 'Remover anexos' })) return;
    setBusy(true);
    for (const issue of broken) {
      const result = await window.academic.workspace.removeAttachment({ attachmentId: issue.attachmentId });
      if (!result.ok) onMessage(result.error.message);
    }
    setBusy(false);
    onMessage(`${broken.length} anexo(s) quebrado(s) removido(s).`);
    load();
  };

  if (error !== undefined) return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-5" role="dialog" aria-modal="true" aria-label="Erro no centro de manutenção"><section className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-5 shadow-2xl"><h2 className="text-lg font-bold text-slate-900">Não foi possível carregar o painel</h2><p className="mt-2 text-sm text-rose-700">{error}</p><div className="mt-5 flex justify-end"><button type="button" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold" onClick={onClose}>Fechar</button></div></section></div>;

  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-5" role="dialog" aria-modal="true" aria-labelledby="library-maintenance-title"><section className="flex h-[min(86vh,58rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"><header className="flex items-start border-b border-slate-200 px-6 py-5"><div><h2 id="library-maintenance-title" className="text-lg font-bold text-slate-900">Centro de manutenção da biblioteca</h2><p className="mt-0.5 text-sm text-slate-500">Composição de saúde, duplicatas, anexos e relações — nenhuma ação em lote acontece sem confirmação.</p></div><button type="button" aria-label="Fechar" className="folio-control ml-auto grid h-9 w-9 place-items-center rounded-lg text-xl" onClick={onClose}>×</button></header>
    {totals === undefined ? <p className="p-8 text-center text-sm text-slate-500">Calculando…</p> : <>
      <div className="grid grid-cols-3 gap-2 px-6 pt-4 text-center text-sm sm:grid-cols-6">
        <div className="rounded-lg bg-slate-100 p-2">Total<br /><strong>{totals.total}</strong></div>
        <div className="rounded-lg bg-cyan-50 p-2">Citadas<br /><strong>{totals.cited}</strong></div>
        <div className="rounded-lg bg-amber-50 p-2">Não usadas<br /><strong>{totals.unused}</strong></div>
        <div className="rounded-lg bg-slate-100 p-2">Sem DOI<br /><strong>{totals.withoutDoi}</strong></div>
        <div className="rounded-lg bg-rose-50 p-2">Pares duplicados<br /><strong>{totals.duplicatePairs}</strong></div>
        <div className="rounded-lg bg-rose-50 p-2">Anexos quebrados<br /><strong>{totals.attachmentIssues}</strong></div>
      </div>
      {totals.missing.length > 0 && <p className="mx-6 mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">Citações sem referência correspondente: {totals.missing.join(', ')}.</p>}
      <div className="mt-4 flex items-center gap-2 border-b border-slate-200 px-6 pb-3"><button type="button" className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold" onClick={toggleAll}>{selected.size === rows.length && rows.length > 0 ? 'Limpar seleção' : 'Selecionar tudo'}</button><span className="text-xs text-slate-500">{selected.size} selecionada(s)</span><div className="ml-auto flex gap-2"><button type="button" disabled={busy || selected.size === 0} className="rounded border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700 disabled:opacity-40" onClick={() => void cleanBrokenAttachments()}>Limpar anexos quebrados</button><button type="button" disabled={busy || selected.size === 0} className="rounded bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40" onClick={() => void removeSelected()}>Remover selecionadas</button></div></div>
      <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-auto px-6">
        {rows.length === 0 && <li className="py-8 text-center text-sm text-slate-500">Biblioteca vazia.</li>}
        {rows.map((row) => <li key={row.referenceId} className="flex items-start gap-3 py-3">
          <input type="checkbox" className="mt-1" checked={selected.has(row.referenceId)} onChange={() => toggle(row.referenceId)} aria-label={`Selecionar ${row.referenceId}`} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2"><code className="text-xs text-indigo-700">{row.referenceId}</code><strong className="truncate text-sm text-slate-800">{row.title}</strong></div>
            <div className="mt-1 flex flex-wrap gap-1 text-xs">
              <span className={`rounded-full px-2 py-0.5 ${row.cited ? 'bg-cyan-100 text-cyan-800' : 'bg-amber-100 text-amber-800'}`}>{row.cited ? `citada (${row.citationCount})` : 'não usada'}</span>
              {row.withoutDoi && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">sem DOI</span>}
              {row.duplicateOf.length > 0 && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-800">duplicata de {row.duplicateOf.join(', ')}</span>}
              {row.attachmentCount > 0 && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{row.attachmentCount} anexo(s)</span>}
              {row.attachmentIssueCodes.map((code, index) => <span key={`${code}-${index}`} className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-800">{ATTACHMENT_ISSUE_LABEL[code] ?? code}</span>)}
              {row.relationCount > 0 && <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-indigo-800">{row.relationCount} relação(ões)</span>}
              {row.auditCodes.map((code, index) => <span key={`${code}-${index}`} className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{AUDIT_LABEL[code] ?? code}</span>)}
            </div>
          </div>
        </li>)}
      </ul>
    </>}
  </section></div>;
}
