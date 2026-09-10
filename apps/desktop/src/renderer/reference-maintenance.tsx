import { useEffect, useMemo, useState, type JSX } from 'react';

import type { BibliographicEntityDto, WorkspaceLibraryDuplicateDto } from '@abnt/protocol';

import { requestConfirmation } from './text-prompt.js';

const reasonLabel: Record<WorkspaceLibraryDuplicateDto['reasons'][number], string> = { doi: 'mesmo DOI', isbn: 'mesmo ISBN', title: 'título semelhante', 'author-year': 'autor e ano' };

const mergeEntry = (canonical: BibliographicEntityDto, duplicate: BibliographicEntityDto, fields: ReadonlySet<'title' | 'authors' | 'doi' | 'url'>): BibliographicEntityDto => ({
  ...canonical,
  ...(fields.has('title') && duplicate.title !== undefined ? { title: duplicate.title } : {}),
  ...(fields.has('authors') && duplicate.author !== undefined ? { author: duplicate.author } : {}),
  ...(fields.has('doi') && duplicate.DOI !== undefined ? { DOI: duplicate.DOI } : {}),
  ...(fields.has('url') && duplicate.URL !== undefined ? { URL: duplicate.URL } : {}),
});

export function ReferenceMaintenanceDialog({ onClose }: { readonly onClose: () => void }): JSX.Element {
  const [entries, setEntries] = useState<readonly BibliographicEntityDto[]>([]);
  const [duplicates, setDuplicates] = useState<readonly WorkspaceLibraryDuplicateDto[]>([]);
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [selected, setSelected] = useState<WorkspaceLibraryDuplicateDto | undefined>(undefined);
  const [canonicalId, setCanonicalId] = useState<string | undefined>(undefined);
  const [fields, setFields] = useState<ReadonlySet<'title' | 'authors' | 'doi' | 'url'>>(new Set());
  const [policy, setPolicy] = useState<'author-year' | 'title-year'>('author-year');
  const [keyId, setKeyId] = useState<string | undefined>(undefined);
  const [suggestion, setSuggestion] = useState('');

  const load = (): void => {
    void Promise.all([window.academic.library.list({}), window.academic.library.duplicates()]).then(([library, found]) => {
      if (library.ok) { setEntries(library.value); setKeyId((current) => current ?? library.value[0]?.id); }
      if (found.ok) setDuplicates(found.value); else setMessage(found.error.message);
    });
  };
  useEffect(load, []);
  const entryById = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries]);
  const selectDuplicate = (duplicate: WorkspaceLibraryDuplicateDto): void => { setSelected(duplicate); setCanonicalId(duplicate.leftId); setFields(new Set()); };
  const canonical = canonicalId === undefined ? undefined : entryById.get(canonicalId);
  const duplicate = selected === undefined || canonicalId === undefined ? undefined : entryById.get(selected.leftId === canonicalId ? selected.rightId : selected.leftId);
  const reviewed = canonical === undefined || duplicate === undefined ? undefined : mergeEntry(canonical, duplicate, fields);
  const toggleField = (field: 'title' | 'authors' | 'doi' | 'url'): void => setFields((current) => { const next = new Set(current); if (next.has(field)) next.delete(field); else next.add(field); return next; });
  const merge = async (): Promise<void> => {
    if (canonical === undefined || duplicate === undefined || reviewed === undefined) return;
    const confirmed = await requestConfirmation({
      title: 'Mesclar referências?',
      description: `“${duplicate.id}” será incorporada a “${canonical.id}”. As citações em todo o vault serão atualizadas; esta operação não pode ser desfeita automaticamente.`,
      confirmLabel: 'Mesclar referências',
    });
    if (!confirmed) return;
    void window.academic.library.merge({ canonicalId: canonical.id, duplicateId: duplicate.id, entry: reviewed }).then((result) => {
      if (!result.ok) { setMessage(result.error.message); return; }
      setMessage(`Mesclagem concluída; ${result.value.changedFiles.length} arquivo(s) atualizado(s).`); setSelected(undefined); load();
    });
  };
  const preview = (): void => {
    if (keyId === undefined) return;
    void window.academic.library.keyPreview({ id: keyId, policy }).then((result) => result.ok ? setSuggestion(result.value.suggestion) : setMessage(result.error.message));
  };
  const rename = async (): Promise<void> => {
    if (keyId === undefined || suggestion.trim() === '') return;
    const confirmed = await requestConfirmation({
      title: 'Renomear chave de citação?',
      description: `A chave “${keyId}” será alterada para “${suggestion.trim()}” e todas as citações vinculadas no vault serão atualizadas.`,
      confirmLabel: 'Renomear chave',
      destructive: false,
    });
    if (!confirmed) return;
    void window.academic.library.renameKey({ id: keyId, nextId: suggestion.trim() }).then((result) => {
      if (!result.ok) { setMessage(result.error.message); return; }
      setMessage(`Chave atualizada; ${result.value.changedFiles.length} arquivo(s) atualizado(s).`); setKeyId(result.value.entry.id); setSuggestion(''); load();
    });
  };

  return <div className="fixed inset-0 z-[55] grid place-items-center bg-slate-950/35 p-5"><section role="dialog" aria-modal="true" aria-labelledby="reference-maintenance-title" className="flex h-[min(82vh,52rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20"><header className="flex items-start border-b border-slate-200 px-6 py-5"><div><h2 id="reference-maintenance-title" className="text-lg font-bold text-slate-900">Qualidade da biblioteca</h2><p className="mt-0.5 text-sm text-slate-500">Sugestões explicáveis; qualquer mesclagem ou rename exige confirmação.</p></div><button type="button" aria-label="Fechar" className="folio-control ml-auto grid h-9 w-9 place-items-center rounded-lg text-xl" onClick={onClose}>×</button></header><div className="grid min-h-0 flex-1 grid-cols-1 overflow-auto lg:grid-cols-[minmax(0,1.2fr)_minmax(19rem,0.8fr)]"><div className="border-b border-slate-200 p-6 lg:border-b-0 lg:border-r"><h3 className="text-sm font-bold text-slate-800">Possíveis duplicatas</h3><p className="mt-1 text-xs text-slate-500">DOI e ISBN são sinais fortes; título e autor/ano são apenas sugestões.</p><ul className="mt-4 grid gap-2">{duplicates.length === 0 ? <li className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">Nenhum par semelhante encontrado.</li> : duplicates.map((pair) => <li key={`${pair.leftId}:${pair.rightId}`}><button type="button" className={`w-full rounded-xl border p-3 text-left ${selected === pair ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 hover:border-indigo-200 hover:bg-slate-50'}`} onClick={() => selectDuplicate(pair)}><div className="flex gap-2"><strong className="min-w-0 flex-1 truncate text-sm text-slate-800">{pair.leftId} ↔ {pair.rightId}</strong><span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-600">{pair.score}%</span></div><span className="mt-1 block text-xs text-slate-500">{pair.reasons.map((reason) => reasonLabel[reason]).join(' · ')}</span></button></li>)}</ul>{selected !== undefined && canonical !== undefined && duplicate !== undefined && reviewed !== undefined && <div className="mt-5 rounded-xl border border-indigo-200 bg-indigo-50 p-4"><h4 className="font-semibold text-indigo-950">Revisar mesclagem</h4><p className="mt-1 text-xs text-indigo-800">Escolha a canônica e, opcionalmente, campos que devem vir da outra entrada.</p><label className="mt-3 grid gap-1 text-sm font-medium text-slate-700">Referência canônica<select value={canonical.id} onChange={(event) => setCanonicalId(event.target.value)} className="rounded-lg border border-indigo-200 bg-white px-2 py-1.5 font-normal"><option value={selected.leftId}>{selected.leftId}</option><option value={selected.rightId}>{selected.rightId}</option></select></label><div className="mt-3 grid gap-2 text-sm">{([['title', 'Título'], ['authors', 'Autores'], ['doi', 'DOI'], ['url', 'URL']] as const).map(([field, label]) => <label key={field} className="flex items-center gap-2"><input type="checkbox" checked={fields.has(field)} onChange={() => toggleField(field)} disabled={(field === 'title' && duplicate.title === undefined) || (field === 'authors' && duplicate.author === undefined) || (field === 'doi' && duplicate.DOI === undefined) || (field === 'url' && duplicate.URL === undefined)} />Usar {label.toLocaleLowerCase()} da duplicada</label>)}</div><p className="mt-3 rounded-lg bg-white/70 p-2 text-xs text-slate-600">Resultado: <strong>{reviewed.title ?? reviewed.id}</strong> · chave <code>{canonical.id}</code></p><button type="button" className="folio-primary mt-3 rounded-lg px-3 py-2 text-sm font-semibold" onClick={merge}>Mesclar e atualizar citações</button></div>}</div><aside className="bg-slate-50 p-6"><h3 className="text-sm font-bold text-slate-800">Gestão de chaves</h3><p className="mt-1 text-xs text-slate-500">Preview por política e rename revision-safe em todo o vault.</p><label className="mt-4 grid gap-1 text-sm font-medium text-slate-700">Referência<select value={keyId ?? ''} onChange={(event) => { setKeyId(event.target.value); setSuggestion(''); }} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-normal">{entries.map((entry) => <option key={entry.id} value={entry.id}>{entry.id} — {entry.title ?? 'Sem título'}</option>)}</select></label><label className="mt-3 grid gap-1 text-sm font-medium text-slate-700">Política<select value={policy} onChange={(event) => setPolicy(event.target.value as typeof policy)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-normal"><option value="author-year">autor + ano</option><option value="title-year">título + ano</option></select></label><button type="button" disabled={keyId === undefined} className="mt-3 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm font-semibold text-indigo-700 disabled:opacity-40" onClick={preview}>Gerar preview</button><label className="mt-4 grid gap-1 text-sm font-medium text-slate-700">Nova chave<input value={suggestion} onChange={(event) => setSuggestion(event.target.value)} placeholder="silva2024" className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm font-normal outline-none focus:border-indigo-400" /></label><button type="button" disabled={keyId === undefined || suggestion.trim() === '' || suggestion === keyId} className="folio-primary mt-3 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-40" onClick={rename}>Renomear no vault</button><p className="mt-5 text-xs leading-5 text-slate-500">Citações, notes vinculadas, PDF e destaques seguem a chave canônica. Não há merge automático.</p></aside></div>{message !== undefined && <p className="border-t border-slate-200 bg-amber-50 px-6 py-2 text-sm text-amber-800">{message}</p>}</section></div>;
}
