import { useEffect, useState, type JSX } from 'react';

import type { BibliographicEntityDto, WebCaptureCandidateDto, WorkspaceCaptureInboxItemDto } from '@abnt/protocol';
import { captureNotePath, captureNoteSource } from '@abnt/workspace-navigation';

import { captureUrl } from './shell/research-intake.js';
import { addDocumentToResearchProject, readResearchProjects } from './research-projects.js';
import { requestConfirmation } from './text-prompt.js';

const candidateLabel = (candidate: WebCaptureCandidateDto): string => ({
  'json-ld': 'JSON-LD', 'citation-meta': 'Citation meta', 'dublin-core': 'Dublin Core', 'schema-org': 'Schema.org', doi: 'DOI no texto',
})[candidate.extractorId] ?? candidate.extractorId;

const captureText = (item: WorkspaceCaptureInboxItemDto): string => [item.title, item.url, item.selection ?? item.note].filter((value): value is string => value !== undefined && value.trim() !== '').join('\n');

export function CaptureInboxDialog({ workspaceId, pendingCapture, onClose, onOpenDocument, onMessage }: {
  readonly workspaceId: string;
  readonly pendingCapture?: WorkspaceCaptureInboxItemDto;
  readonly onClose: () => void;
  readonly onOpenDocument: (fileId: string, path: string) => void;
  readonly onMessage: (message: string) => void;
}): JSX.Element {
  const [items, setItems] = useState<readonly WorkspaceCaptureInboxItemDto[]>([]);
  const [draft, setDraft] = useState('');
  const [projects] = useState(() => readResearchProjects(workspaceId).filter((project) => project.archivedAt === undefined));
  const [projectId, setProjectId] = useState<string | undefined>(() => projects[0]?.id);
  const [webCapture, setWebCapture] = useState<{ readonly item: WorkspaceCaptureInboxItemDto; readonly candidates: readonly WebCaptureCandidateDto[] } | undefined>(undefined);
  const [webCaptureBusy, setWebCaptureBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>();

  const load = (): void => {
    setLoading(true); setLoadError(undefined);
    void window.academic.workspace.captureInbox().then((result) => {
      if (result.ok) setItems(result.value.items);
      else setLoadError(result.error.message);
    }, () => setLoadError('Não foi possível carregar a inbox de capturas.')).finally(() => setLoading(false));
  };
  useEffect(load, []);
  const save = async (next: readonly WorkspaceCaptureInboxItemDto[]): Promise<boolean> => {
    const result = await window.academic.workspace.setCaptureInbox({ version: 1, items: next });
    if (!result.ok) { onMessage(result.error.message); return false; }
    setItems(result.value.items);
    return true;
  };
  const remove = async (id: string): Promise<void> => { await save(items.filter((item) => item.id !== id)); };
  const discard = async (id: string): Promise<void> => {
    const item = items.find((entry) => entry.id === id);
    if (!await requestConfirmation({ title: 'Descartar captura?', description: `“${item?.title ?? item?.url ?? 'Esta captura'}” será removida da inbox. Nenhuma referência ou nota será criada.`, confirmLabel: 'Descartar captura' })) return;
    await remove(id);
  };
  const add = async (item: WorkspaceCaptureInboxItemDto): Promise<void> => { if (await save([...items, item])) onMessage('Captura adicionada à inbox para revisão.'); };
  const quickCapture = async (): Promise<void> => {
    const value = draft.trim();
    if (value === '') return;
    const url = captureUrl(value)?.URL;
    await add({ id: crypto.randomUUID(), capturedAt: new Date().toISOString(), ...(url === undefined ? { note: value } : { url }) });
    setDraft('');
  };
  const intakeReferenceFromEntry = async (item: WorkspaceCaptureInboxItemDto, entry: BibliographicEntityDto, attachments: readonly WebCaptureCandidateDto['attachments'][number][] = []): Promise<void> => {
    const preview = await window.academic.library.intakePreview({ entry });
    if (!preview.ok) { onMessage(preview.error.message); return; }
    const candidate = preview.value.imported[0];
    if (candidate === undefined) { onMessage(preview.value.diagnostics[0]?.message ?? 'Não foi possível preparar a referência.'); return; }
    const saved = await window.academic.library.upsert({ entry: candidate });
    if (!saved.ok) { onMessage(saved.error.message); return; }
    for (const attachment of attachments) {
      await window.academic.workspace.addAttachment({
        referenceId: saved.value.id, kind: 'link', role: attachment.role, uri: attachment.url,
        mediaType: attachment.url.toLocaleLowerCase().endsWith('.pdf') ? 'application/pdf' : 'text/html',
        ...(attachment.label === undefined ? {} : { displayTitle: attachment.label }),
      });
    }
    await remove(item.id);
    setWebCapture(undefined);
    onMessage(`Referência ${saved.value.id} criada após revisão.${attachments.length > 0 ? ` ${attachments.length} anexo(s) descoberto(s) adicionado(s).` : ''}`);
  };
  /** Onda BN: extrai candidatos da página antes de cair na captura simples (id do domínio, sem metadata). */
  const forwardReference = async (item: WorkspaceCaptureInboxItemDto): Promise<void> => {
    if (item.url === undefined) { onMessage('Uma referência precisa de URL; encaminhe esta captura para nota ou diário.'); return; }
    const base = captureUrl(item.url);
    if (base === undefined) { onMessage('A URL da captura não é válida.'); return; }
    const baseEntry = { ...base, ...(item.title === undefined ? {} : { title: item.title }) };
    setWebCaptureBusy(true);
    const extracted = await window.academic.workspace.webCaptureExtract({ url: item.url }).catch(() => undefined);
    setWebCaptureBusy(false);
    if (extracted === undefined) { onMessage('Não foi possível extrair metadados da página.'); return; }
    if (extracted.ok && extracted.value.candidates.length > 0) { setWebCapture({ item, candidates: extracted.value.candidates }); return; }
    await intakeReferenceFromEntry(item, baseEntry);
  };
  const useWebCaptureCandidate = async (candidate: WebCaptureCandidateDto): Promise<void> => {
    if (webCapture === undefined || webCapture.item.url === undefined) return;
    const base = captureUrl(webCapture.item.url);
    if (base === undefined) return;
    const entry: BibliographicEntityDto = { ...base, ...(webCapture.item.title === undefined ? {} : { title: webCapture.item.title }), ...candidate.fields, type: candidate.fields.type ?? base.type };
    await intakeReferenceFromEntry(webCapture.item, entry, candidate.attachments);
  };
  const useSimpleCapture = async (): Promise<void> => {
    if (webCapture === undefined || webCapture.item.url === undefined) return;
    const base = captureUrl(webCapture.item.url);
    if (base === undefined) return;
    await intakeReferenceFromEntry(webCapture.item, { ...base, ...(webCapture.item.title === undefined ? {} : { title: webCapture.item.title }) });
  };
  const createNote = async (item: WorkspaceCaptureInboxItemDto, project?: string): Promise<void> => {
    const path = captureNotePath(item);
    const created = await window.academic.workspace.createDocument({ path, content: captureNoteSource(item) });
    if (!created.ok) { onMessage(created.error.message); return; }
    if (project !== undefined) addDocumentToResearchProject(workspaceId, project, created.value.fileId);
    await remove(item.id); onOpenDocument(created.value.fileId, created.value.path);
    onMessage(project === undefined ? 'Captura transformada em nota.' : 'Nota criada e adicionada ao projeto.');
  };
  const forwardJournal = async (item: WorkspaceCaptureInboxItemDto): Promise<void> => {
    const result = await window.academic.workspace.journalCapture({ date: item.capturedAt.slice(0, 10), text: captureText(item) });
    if (!result.ok) { onMessage(result.error.message); return; }
    await remove(item.id); onMessage('Captura adicionada ao diário de pesquisa.');
  };
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-label="Inbox de capturas"><section className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-5 shadow-2xl"><header className="flex items-center justify-between gap-4"><div><h2 className="text-lg font-bold text-slate-900">Inbox de capturas</h2><p className="text-sm text-slate-500">Revise cada item antes de encaminhá-lo.</p></div><button type="button" aria-label="Fechar inbox de capturas" className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100" onClick={onClose}>×</button></header>{loading && <p role="status" className="mt-4 text-sm text-slate-500">Carregando capturas…</p>}{loadError !== undefined && <div role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><p>{loadError}</p><button type="button" className="mt-2 rounded border border-rose-300 px-2 py-1 font-medium" onClick={load}>Tentar novamente</button></div>}{pendingCapture !== undefined && <section className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4"><strong className="text-indigo-950">Captura recebida do navegador</strong><p className="mt-1 break-words text-sm text-indigo-900">{pendingCapture.title ?? pendingCapture.url}</p>{pendingCapture.selection !== undefined && <p className="mt-2 whitespace-pre-wrap text-sm text-indigo-800">{pendingCapture.selection}</p>}<div className="mt-3 flex gap-2"><button type="button" className="rounded bg-indigo-600 px-3 py-2 text-sm font-semibold text-white" onClick={() => void add(pendingCapture)}>Adicionar à inbox</button><button type="button" className="rounded border border-indigo-200 px-3 py-2 text-sm font-semibold text-indigo-700" onClick={onClose}>Descartar</button></div></section>}<section className="mt-4 rounded-xl border border-slate-200 p-3"><label className="block text-sm font-semibold text-slate-700" htmlFor="capture-quick">Captura rápida ou URL</label><div className="mt-2 flex gap-2"><input id="capture-quick" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void quickCapture(); }} placeholder="Cole uma URL ou escreva uma ideia" className="min-w-0 flex-1 rounded border border-slate-300 px-3 py-2 text-sm" /><button type="button" className="rounded bg-slate-800 px-3 py-2 text-sm font-semibold text-white" onClick={() => void quickCapture()}>Capturar</button></div></section><ul className="mt-4 grid gap-3">{items.map((item) => <li key={item.id} className="rounded-xl border border-slate-200 p-4"><div className="min-w-0"><strong className="block text-slate-800">{item.title ?? item.url ?? 'Nota rápida'}</strong>{item.url !== undefined && <a className="block truncate text-sm text-indigo-700" href={item.url}>{item.url}</a>}{(item.selection ?? item.note) !== undefined && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{item.selection ?? item.note}</p>}</div><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={webCaptureBusy} className="rounded bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40" onClick={() => void forwardReference(item)}>{webCaptureBusy ? 'Extraindo…' : 'Referência'}</button><button type="button" className="rounded border border-slate-300 px-3 py-2 text-sm font-semibold" onClick={() => void createNote(item)}>Nota</button><button type="button" className="rounded border border-slate-300 px-3 py-2 text-sm font-semibold" onClick={() => void forwardJournal(item)}>Diário</button>{projects.length > 0 && <><select aria-label="Projeto" value={projectId} onChange={(event) => setProjectId(event.target.value || undefined)} className="rounded border border-slate-300 px-2 text-sm">{projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select><button type="button" className="rounded border border-slate-300 px-3 py-2 text-sm font-semibold" onClick={() => void createNote(item, projectId)}>Projeto</button></>}<button type="button" className="px-2 py-2 text-sm text-rose-600" onClick={() => void discard(item.id)}>Descartar</button></div></li>)}</ul>{!loading && loadError === undefined && items.length === 0 && <p className="mt-4 rounded-xl bg-slate-50 p-5 text-sm text-slate-500">Nenhuma captura pendente.</p>}</section>{webCapture !== undefined && <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/60 p-5" role="dialog" aria-modal="true" aria-label="Candidatos extraídos da página"><section className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-5 shadow-2xl"><header className="flex items-center justify-between gap-4"><div><h3 className="text-lg font-bold text-slate-900">Metadados encontrados na página</h3><p className="text-sm text-slate-500">Escolha um resultado — nada é mesclado automaticamente.</p></div><button type="button" aria-label="Fechar candidatos extraídos" className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100" onClick={() => setWebCapture(undefined)}>×</button></header><ul className="mt-4 grid gap-3">{webCapture.candidates.map((candidate, index) => <li key={`${candidate.extractorId}-${index}`} className="rounded-xl border border-slate-200 p-4"><div className="flex items-center gap-2"><span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">{candidateLabel(candidate)}</span><span className="text-xs text-slate-500">qualidade {Math.round(candidate.quality * 100)}%</span></div><strong className="mt-2 block text-slate-800">{candidate.fields.title ?? '(sem título)'}</strong>{candidate.fields.author !== undefined && <p className="mt-1 text-sm text-slate-600">{candidate.fields.author.map((author) => author.literal ?? [author.given, author.family].filter((part) => part !== undefined).join(' ')).join('; ')}</p>}{candidate.fields.DOI !== undefined && <p className="mt-1 text-xs text-slate-500">DOI {candidate.fields.DOI}</p>}{candidate.attachments.length > 0 && <p className="mt-1 text-xs text-indigo-600">{candidate.attachments.length} anexo(s) descoberto(s)</p>}<button type="button" className="mt-3 rounded bg-indigo-600 px-3 py-2 text-sm font-semibold text-white" onClick={() => void useWebCaptureCandidate(candidate)}>Usar este resultado</button></li>)}</ul><button type="button" className="mt-4 w-full rounded border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600" onClick={() => void useSimpleCapture()}>Continuar sem extrair (só URL e título)</button></section></div>}</div>;
}
