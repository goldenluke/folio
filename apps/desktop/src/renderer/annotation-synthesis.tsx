import { useEffect, useState, type JSX } from 'react';

import type { AnnotationSynthesisTemplateDto, BibliographicEntityDto, WorkspacePdfAnnotationDto } from '@abnt/protocol';

/** Paleta fixa e pequena: cor sem rótulo não tem semântica (ver @abnt/annotation-synthesis). */
export const ANNOTATION_HIGHLIGHT_COLORS: readonly string[] = ['#fde047', '#86efac', '#93c5fd', '#fca5a5', '#d8b4fe'];
export const DEFAULT_ANNOTATION_COLOR_LABELS: Readonly<Record<string, string>> = {
  '#fde047': 'Destaque geral', '#86efac': 'Evidência', '#93c5fd': 'Método', '#fca5a5': 'Contradição', '#d8b4fe': 'Citar depois',
};

const templateLabel: Record<AnnotationSynthesisTemplateDto, string> = {
  'quote-list': 'Lista simples', 'grouped-by-source': 'Agrupado por fonte', 'grouped-by-color': 'Agrupado por cor',
};

export function AnnotationSynthesisDialog({ onClose, activeFileId, onOpenDocument }: {
  readonly onClose: () => void;
  readonly activeFileId?: string;
  readonly onOpenDocument: (fileId: string, path: string) => void;
}): JSX.Element {
  const [items, setItems] = useState<readonly WorkspacePdfAnnotationDto[]>([]);
  const [entries, setEntries] = useState<readonly BibliographicEntityDto[]>([]);
  const [colors, setColors] = useState<Readonly<Record<string, string>>>({});
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [template, setTemplate] = useState<AnnotationSynthesisTemplateDto>('quote-list');
  const [targetMode, setTargetMode] = useState<'reference' | 'active'>('reference');
  const [message, setMessage] = useState<string | undefined>(undefined);

  const load = (): void => {
    void window.academic.workspace.annotations({}).then((result) => { if (result.ok) setItems(result.value); });
    void window.academic.library.list({}).then((result) => { if (result.ok) setEntries(result.value); });
    void window.academic.workspace.annotationColorSemantics().then((result) => { if (result.ok) setColors(result.value); });
  };
  useEffect(load, []);

  const titleFor = (referenceId: string): string => entries.find((entry) => entry.id === referenceId)?.title ?? referenceId;
  const toggle = (id: string): void => setSelectedIds((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const selected = items.filter((item) => selectedIds.has(item.id));
  const distinctReferenceIds = new Set(selected.map((item) => item.referenceId));
  const singleReferenceId = distinctReferenceIds.size === 1 ? [...distinctReferenceIds][0] : undefined;

  const synthesize = async (): Promise<void> => {
    if (selected.length === 0) return;
    const target = targetMode === 'reference'
      ? (singleReferenceId === undefined ? undefined : { kind: 'reference' as const, referenceId: singleReferenceId })
      : (activeFileId === undefined ? undefined : { kind: 'file' as const, fileId: activeFileId });
    if (target === undefined) { setMessage('Escolha um alvo válido: as anotações selecionadas precisam ser todas da mesma referência, ou use o documento ativo.'); return; }
    const result = await window.academic.workspace.synthesizeAnnotations({ annotationIds: [...selectedIds], template, target });
    if (!result.ok) { setMessage(result.error.message); return; }
    setMessage(`${result.value.insertedIds.length} anotação(ões) inserida(s); ${result.value.skippedIds.length} já estavam na nota.`);
    setSelectedIds(new Set());
    onOpenDocument(result.value.file.fileId, result.value.file.path);
  };

  const saveColorLabel = async (color: string, label: string): Promise<void> => {
    const next = { ...colors, [color]: label };
    const result = await window.academic.workspace.setAnnotationColorSemantics({ colors: next });
    if (result.ok) setColors(result.value); else setMessage(result.error.message);
  };

  return <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/75 p-4"><section role="dialog" aria-modal="true" aria-labelledby="annotation-synthesis-title" className="grid h-[min(88vh,56rem)] w-full max-w-4xl grid-cols-[1fr_16rem] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
    <div className="overflow-auto p-5">
      <div className="flex items-start"><div><h2 id="annotation-synthesis-title" className="text-lg font-bold text-slate-900">Síntese de anotações</h2><p className="mt-0.5 text-sm text-slate-500">Selecione destaques de uma ou várias fontes e insira uma síntese numa nota existente.</p></div><button type="button" className="folio-control ml-auto grid h-9 w-9 place-items-center rounded-lg text-xl" onClick={onClose}>×</button></div>
      <ul className="mt-4 grid gap-2">{items.length === 0 ? <li className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Nenhuma anotação no vault ainda.</li> : items.map((item) => <li key={item.id} className={`rounded-lg border p-3 text-sm ${selectedIds.has(item.id) ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200'}`}><label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={selectedIds.has(item.id)} onChange={() => toggle(item.id)} /><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="truncate text-xs font-semibold text-slate-600">{titleFor(item.referenceId)} · p. {item.page}</span>{item.color !== undefined && <span className="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/10" style={{ backgroundColor: item.color }} title={colors[item.color] ?? item.color} />}</span><span className="mt-1 block text-slate-700">“{item.quote}”</span></span></label></li>)}</ul>
    </div>
    <aside className="overflow-auto border-l border-slate-200 bg-slate-50 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Modelo</h3>
      <select aria-label="Modelo de síntese" value={template} onChange={(event) => setTemplate(event.target.value as AnnotationSynthesisTemplateDto)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm">{(Object.keys(templateLabel) as AnnotationSynthesisTemplateDto[]).map((value) => <option key={value} value={value}>{templateLabel[value]}</option>)}</select>
      <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Destino</h3>
      <label className="mt-1 flex items-center gap-2 text-sm text-slate-700"><input type="radio" name="synthesis-target" checked={targetMode === 'reference'} onChange={() => setTargetMode('reference')} />Nota de leitura da fonte{singleReferenceId !== undefined && <span className="truncate text-xs text-slate-500">({titleFor(singleReferenceId)})</span>}</label>
      <label className="mt-1 flex items-center gap-2 text-sm text-slate-700"><input type="radio" name="synthesis-target" checked={targetMode === 'active'} onChange={() => setTargetMode('active')} disabled={activeFileId === undefined} />Documento ativo{activeFileId === undefined && <span className="text-xs text-slate-400">(nenhum aberto)</span>}</label>
      <button type="button" disabled={selected.length === 0} className="folio-primary mt-4 w-full rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-40" onClick={() => void synthesize()}>Sintetizar e inserir ({selected.length})</button>
      <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-slate-500">Semântica das cores</h3>
      <ul className="mt-2 grid gap-2">{ANNOTATION_HIGHLIGHT_COLORS.map((color) => <li key={color} className="flex items-center gap-2"><span className="h-4 w-4 shrink-0 rounded-full ring-1 ring-black/10" style={{ backgroundColor: color }} /><input value={colors[color] ?? ''} placeholder={DEFAULT_ANNOTATION_COLOR_LABELS[color]} onBlur={(event) => { const value = event.target.value.trim(); if (value !== '' && value !== colors[color]) void saveColorLabel(color, value); }} onChange={(event) => setColors((current) => ({ ...current, [color]: event.target.value }))} className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs" /></li>)}</ul>
      {message !== undefined && <p role="alert" className="mt-4 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">{message}</p>}
    </aside>
  </section></div>;
}
