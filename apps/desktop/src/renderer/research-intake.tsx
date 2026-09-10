import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type JSX } from 'react';

import type { BibliographicEntityDto } from '@abnt/protocol';

import { captureUrl, doiFromPdfText, inboxSummary, type IntakeItem, type IntakeSource } from './shell/research-intake.js';

type PendingPdf = { readonly name: string; readonly base64: string };
const storageKey = (workspaceId: string): string => `folio.reference-inbox:${workspaceId}`;
const sourceLabel: Record<IntakeSource, string> = { bibtex: 'BibTeX', ris: 'RIS', 'csl-json': 'CSL-JSON', doi: 'DOI', url: 'URL', pdf: 'PDF' };
const isItem = (value: unknown): value is IntakeItem => typeof value === 'object' && value !== null && typeof (value as IntakeItem).id === 'string' && typeof (value as IntakeItem).source === 'string' && Array.isArray((value as IntakeItem).provenance) && Array.isArray((value as IntakeItem).duplicates);
const loadInbox = (workspaceId: string): readonly IntakeItem[] => { try { const parsed: unknown = JSON.parse(window.localStorage.getItem(storageKey(workspaceId)) ?? '[]'); return Array.isArray(parsed) ? parsed.filter(isItem) : []; } catch { return []; } };
const updateReadingQueue = (workspaceId: string, referenceId: string): void => { try { const raw: unknown = JSON.parse(window.localStorage.getItem(`folio.reading-queue:${workspaceId}`) ?? '{}'); const queue = typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? raw : {}; window.localStorage.setItem(`folio.reading-queue:${workspaceId}`, JSON.stringify({ ...queue, [referenceId]: { state: 'to-read', updatedAt: new Date().toISOString() } })); } catch { /* preferências locais são opcionais */ } };
const fileAsBase64 = async (file: File): Promise<string> => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(reader.error); reader.onload = () => resolve(String(reader.result).replace(/^data:[^;]+;base64,/u, '')); reader.readAsDataURL(file); });
const fileHash = async (file: File): Promise<string> => { const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer()); return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join(''); };

export function ResearchIntakeDialog({ workspaceId, onClose, onMessage }: { readonly workspaceId: string; readonly onClose: () => void; readonly onMessage: (message: string) => void }): JSX.Element {
  const [items, setItems] = useState<readonly IntakeItem[]>(() => loadInbox(workspaceId));
  const [format, setFormat] = useState<'bibtex' | 'ris' | 'csl-json'>('bibtex');
  const [content, setContent] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [message, setMessage] = useState<string>();
  const pendingPdfs = useRef(new Map<string, PendingPdf>());
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { setItems(loadInbox(workspaceId)); }, [workspaceId]);
  useEffect(() => { window.localStorage.setItem(storageKey(workspaceId), JSON.stringify(items)); }, [items, workspaceId]);
  const add = (source: IntakeSource, entry: BibliographicEntityDto | undefined, provenance: readonly string[], duplicates: IntakeItem['duplicates'] = [], pdf?: IntakeItem['pdf'], id: string = crypto.randomUUID()): void => setItems((current) => [...current, { id, source, ...(entry === undefined ? {} : { entry }), createdAt: new Date().toISOString(), provenance, duplicates, ...(pdf === undefined ? {} : { pdf }) }]);
  const preview = async (source: IntakeSource, request: { readonly format?: 'bibtex' | 'ris' | 'csl-json'; readonly content?: string; readonly entry?: BibliographicEntityDto }, provenance: readonly string[], pdf?: IntakeItem['pdf'], itemId?: string): Promise<void> => {
    const result = await window.academic.library.intakePreview(request); if (!result.ok) { setMessage(result.error.message); return; }
    result.value.imported.forEach((entry, index) => add(source, entry, provenance, (result.value.duplicates[entry.id] ?? []).map((duplicate) => ({ referenceId: duplicate.rightId, score: duplicate.score, reasons: duplicate.reasons })), pdf, index === 0 ? itemId : undefined));
    setMessage(result.value.imported.length === 0 ? (result.value.diagnostics[0]?.message ?? 'Nenhuma referência reconhecida.') : `${result.value.imported.length} item(ns) adicionados à inbox.`);
  };
  const importText = (): void => { if (content.trim() !== '') void preview(format, { format, content }, [`${sourceLabel[format]} importado`]); setContent(''); };
  const resolveIdentifier = async (): Promise<void> => {
    const value = identifier.trim(); if (value === '') return;
    if (/^https?:\/\//iu.test(value)) {
      const base = captureUrl(value); if (base === undefined) { setMessage('URL inválida; capture apenas HTTP(S).'); return; }
      const extracted = await window.academic.workspace.webCaptureExtract({ url: value });
      const best = extracted.ok ? extracted.value.candidates[0] : undefined;
      const entry = best === undefined ? base : { ...base, ...best.fields, type: best.fields.type ?? base.type };
      await preview('url', { entry }, best === undefined ? ['URL fornecida pelo usuário'] : [`URL fornecida pelo usuário, metadata pré-preenchida via ${best.extractorId} (revise antes de confirmar)`]);
      setIdentifier(''); return;
    }
    const result = await window.academic.library.resolveDoi({ doi: value }); if (!result.ok) { setMessage(result.error.message); return; }
    await preview('doi', { entry: result.value }, ['DOI resolvido pelo provider configurado']); setIdentifier('');
  };
  const importFile = async (file: File): Promise<void> => {
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.pdf') || file.type === 'application/pdf') {
      const bytes = await file.arrayBuffer(); const [base64, sha256] = await Promise.all([fileAsBase64(file), fileHash(file)]);
      const doi = doiFromPdfText(new TextDecoder('latin1').decode(bytes)); let entry: BibliographicEntityDto | undefined;
      if (doi !== undefined) { const result = await window.academic.library.resolveDoi({ doi }); if (result.ok) entry = result.value; else setMessage(result.error.message); }
      const id = crypto.randomUUID(); pendingPdfs.current.set(id, { name: file.name, base64 });
      if (entry === undefined) { add('pdf', undefined, ['PDF sem DOI legível; metadata não foi inventada'], [], { name: file.name, sha256 }, id); setMessage('PDF entrou na inbox sem metadata; revise ou informe um DOI.'); }
      else await preview('pdf', { entry }, [`DOI ${doi} encontrado literalmente no PDF`], { name: file.name, sha256 }, id);
      return;
    }
    const source = lower.endsWith('.ris') ? 'ris' : lower.endsWith('.json') ? 'csl-json' : 'bibtex';
    await preview(source, { format: source, content: await file.text() }, [`Arquivo ${file.name}`]);
  };
  const onFile = (event: ChangeEvent<HTMLInputElement>): void => { const file = event.target.files?.[0]; if (file !== undefined) void importFile(file).catch(() => setMessage('Não foi possível ler o arquivo.')); event.target.value = ''; };
  const onDrop = (event: DragEvent<HTMLDivElement>): void => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file !== undefined) void importFile(file).catch(() => setMessage('Não foi possível ler o arquivo.')); };
  const edit = (id: string, transform: (entry: BibliographicEntityDto) => BibliographicEntityDto): void => setItems((current) => current.map((item) => { if (item.id !== id || item.entry === undefined) return item; return { ...item, entry: transform(item.entry), duplicates: [] }; }));
  const setTitle = (id: string, title: string): void => edit(id, (entry) => { if (title !== '') return { ...entry, title }; const { title: _removed, ...withoutTitle } = entry; return withoutTitle; });
  const confirm = async (item: IntakeItem, existingId?: string): Promise<void> => {
    if (item.entry === undefined && existingId === undefined) { setMessage('Este PDF não tem metadata. Informe DOI ou dados bibliográficos antes de confirmar.'); return; }
    const referenceId = existingId ?? item.entry!.id;
    if (existingId === undefined) { const saved = await window.academic.library.upsert({ entry: item.entry! }); if (!saved.ok) { setMessage(saved.error.message); return; } }
    const pdf = pendingPdfs.current.get(item.id); if (pdf !== undefined) { const attached = await window.academic.library.attachPdfData({ referenceId, name: pdf.name, base64: pdf.base64 }); if (!attached.ok) { setMessage(attached.error.message); return; } }
    updateReadingQueue(workspaceId, referenceId); pendingPdfs.current.delete(item.id); setItems((current) => current.filter((candidate) => candidate.id !== item.id)); onMessage(`Referência ${referenceId} confirmada e adicionada à fila de leitura.`);
  };
  const summary = inboxSummary(items);

  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-5"><section role="dialog" aria-modal="true" aria-labelledby="intake-title" className="grid h-[min(86vh,58rem)] w-full max-w-6xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"><header className="flex items-start border-b border-slate-200 px-6 py-5"><div><h2 id="intake-title" className="text-lg font-bold text-slate-900">Importar pesquisa</h2><p className="mt-0.5 text-sm text-slate-500">A inbox é operacional: nada entra na bibliografia canônica sem sua confirmação.</p></div><button type="button" className="folio-control ml-auto grid h-9 w-9 place-items-center rounded-lg text-xl" onClick={onClose}>×</button></header><div className="grid min-h-0 gap-6 overflow-auto p-6 lg:grid-cols-[22rem_minmax(0,1fr)]"><aside className="grid content-start gap-4"><section className="rounded-xl border border-slate-200 p-4"><h3 className="font-semibold">Entrada universal</h3><div className="mt-3 flex gap-2"><select value={format} onChange={(event) => setFormat(event.target.value as typeof format)} className="rounded border border-slate-300 p-2 text-sm"><option value="bibtex">BibTeX</option><option value="ris">RIS</option><option value="csl-json">CSL-JSON</option></select><button type="button" className="rounded border border-indigo-200 px-3 text-sm font-semibold text-indigo-700" onClick={importText}>Revisar</button></div><textarea value={content} onChange={(event) => setContent(event.target.value)} className="mt-2 h-28 w-full rounded border border-slate-300 p-2 font-mono text-xs" placeholder="Cole BibTeX, RIS ou CSL-JSON…" /><div onDragOver={(event) => event.preventDefault()} onDrop={onDrop} className="mt-3 rounded-lg border border-dashed border-slate-300 p-3 text-center text-xs text-slate-500">Arraste BibTeX, RIS, CSL-JSON ou PDF aqui.<br /><button type="button" className="mt-1 font-semibold text-indigo-700" onClick={() => input.current?.click()}>Escolher arquivo</button><input ref={input} type="file" accept=".bib,.ris,.json,.pdf,application/pdf" className="hidden" onChange={onFile} /></div></section><section className="rounded-xl border border-slate-200 p-4"><h3 className="font-semibold">DOI ou URL</h3><div className="mt-2 flex gap-2"><input value={identifier} onChange={(event) => setIdentifier(event.target.value)} className="min-w-0 flex-1 rounded border border-slate-300 p-2 text-sm" placeholder="10.1234/exemplo ou https://…" /><button type="button" className="rounded border border-indigo-200 px-3 text-sm font-semibold text-indigo-700" onClick={() => void resolveIdentifier()}>Adicionar</button></div><p className="mt-2 text-xs text-slate-500">URLs criam referência web sem scraping; DOI usa o adapter existente.</p></section><section className="grid grid-cols-2 gap-2 text-center text-sm"><div className="rounded-lg bg-slate-100 p-2">Inbox<br /><strong>{summary.total}</strong></div><div className="rounded-lg bg-amber-50 p-2">Duplicatas<br /><strong>{summary.duplicates}</strong></div><div className="rounded-lg bg-slate-100 p-2">Sem autores<br /><strong>{summary.missingAuthors}</strong></div><div className="rounded-lg bg-slate-100 p-2">Sem ano<br /><strong>{summary.missingYear}</strong></div></section></aside><section><h3 className="font-semibold">Fila de revisão</h3><ul className="mt-3 grid gap-3">{items.map((item) => <li key={item.id} className="rounded-xl border border-slate-200 p-4"><div className="flex gap-3"><div className="min-w-0 flex-1"><strong className="block truncate text-slate-800">{item.entry?.title ?? item.pdf?.name ?? 'Metadata pendente'}</strong><span className="text-xs text-slate-500">{sourceLabel[item.source]} · {item.provenance.join(' · ')}</span></div><button type="button" className="text-sm text-rose-600" onClick={() => { pendingPdfs.current.delete(item.id); setItems((current) => current.filter((candidate) => candidate.id !== item.id)); }}>Descartar</button></div>{item.entry !== undefined && <div className="mt-3 grid gap-2 sm:grid-cols-2"><label className="grid gap-1 text-xs">Chave<input value={item.entry.id} onChange={(event) => edit(item.id, (entry) => ({ ...entry, id: event.target.value }))} className="rounded border border-slate-300 p-2 text-sm" /></label><label className="grid gap-1 text-xs">Título<input value={item.entry.title ?? ''} onChange={(event) => setTitle(item.id, event.target.value)} className="rounded border border-slate-300 p-2 text-sm" /></label></div>}{item.duplicates.length > 0 && <p className="mt-3 rounded bg-amber-50 p-2 text-sm text-amber-800">Possível duplicata: {item.duplicates.map((duplicate) => `${duplicate.referenceId} (${duplicate.reasons.join(', ')})`).join('; ')}.</p>}<div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={item.entry === undefined || item.entry.id.trim() === ''} className="rounded bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40" onClick={() => void confirm(item)}>Criar referência</button>{item.duplicates.map((duplicate) => <button key={duplicate.referenceId} type="button" className="rounded border border-indigo-200 px-3 py-2 text-sm font-semibold text-indigo-700" onClick={() => void confirm(item, duplicate.referenceId)}>Anexar a {duplicate.referenceId}</button>)}</div></li>)}</ul>{items.length === 0 && <p className="mt-3 rounded-xl bg-slate-50 p-6 text-sm text-slate-500">A inbox está vazia. Importe uma referência, DOI, URL ou PDF para começar.</p>}{message !== undefined && <p className="mt-3 rounded bg-amber-50 p-3 text-sm text-amber-800">{message}</p>}</section></div></section></div>;
}
