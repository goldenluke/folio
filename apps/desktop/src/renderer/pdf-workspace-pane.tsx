import { useCallback, useEffect, useRef, useState, type JSX, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { GlobalWorkerOptions, getDocument, TextLayer, type PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { WorkspacePdfAnnotationDto } from '@abnt/protocol';
import { exportAnnotatedPdf } from './pdf-annotation-export.js';
import { requestConfirmation } from './text-prompt.js';

GlobalWorkerOptions.workerPort = new Worker(new URL('pdfjs-dist/legacy/build/pdf.worker.mjs', import.meta.url), { type: 'module' });

type Rect = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
const ANNOTATION_SEMANTIC_TYPES = ['population', 'intervention', 'method', 'outcome', 'finding', 'limitation', 'risk', 'quote', 'context'] as const;
type AnnotationSemanticType = typeof ANNOTATION_SEMANTIC_TYPES[number];
type PdfReadingProgress = { readonly lastPage: number; readonly furthestPage: number; readonly lastOpenedAt: string; readonly status: 'unread' | 'reading' | 'read' };
const readingProgressKey = (fileId: string): string => `folio.pdf-reading-progress:${fileId}`;
const readReadingProgress = (fileId: string): PdfReadingProgress => {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(readingProgressKey(fileId)) ?? '');
    if (typeof value === 'object' && value !== null) {
      const item = value as Partial<PdfReadingProgress>;
      if (typeof item.lastPage === 'number' && typeof item.furthestPage === 'number' && (item.status === 'unread' || item.status === 'reading' || item.status === 'read')) return { lastPage: item.lastPage, furthestPage: item.furthestPage, lastOpenedAt: typeof item.lastOpenedAt === 'string' ? item.lastOpenedAt : new Date().toISOString(), status: item.status };
    }
  } catch { /* preferência local ausente ou inválida */ }
  return { lastPage: 1, furthestPage: 1, lastOpenedAt: new Date().toISOString(), status: 'unread' };
};
const markdownPdfLink = (path: string, page: number, annotationId?: string): string => annotationId === undefined ? `[[${path}#page=${page}]]` : `[[pdf-annotation:${annotationId}]]`;
const decode = (dataUrl: string): Uint8Array => {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};
const encode = (bytes: Uint8Array): string => { let value = ''; for (let index = 0; index < bytes.length; index += 0x8000) value += String.fromCharCode(...bytes.subarray(index, index + 0x8000)); return btoa(value); };
const messageFor = (error: unknown): string => error instanceof Error ? error.message : String(error);
const pdfFailureMessage = (error: unknown): string => {
  const name = error !== null && typeof error === 'object' && 'name' in error ? String(error.name) : '';
  if (name === 'PasswordException') return 'Este PDF é protegido por senha e não pode ser aberto no leitor.';
  if (name === 'InvalidPDFException') return 'Este arquivo está corrompido ou não é um PDF válido.';
  if (name === 'MissingPDFException') return 'O arquivo PDF não está mais disponível no vault.';
  return 'Não foi possível abrir este PDF: ' + messageFor(error);
};
const INITIAL_EMBEDDED_SCAN_PAGES = 48;
const INITIAL_CONTINUOUS_PAGES = 8;
type EmbeddedAnnotation = { readonly externalId: string; readonly page: number; readonly kind: 'highlight' | 'underline' | 'strikeout' | 'comment' | 'ink'; readonly quote: string; readonly comment?: string; readonly rects?: readonly Rect[]; readonly color?: string };
const embeddedKind = (type: unknown): EmbeddedAnnotation['kind'] | undefined => type === 9 ? 'highlight' : type === 10 ? 'underline' : type === 12 ? 'strikeout' : type === 15 ? 'ink' : type === 1 ? 'comment' : undefined;

function PdfPage({ document, pageNumber, zoom, annotations, onText, onError, onSelect }: { readonly document: PDFDocumentProxy; readonly pageNumber: number; readonly zoom: number; readonly annotations: readonly WorkspacePdfAnnotationDto[]; readonly onText: (page: number, text: string) => void; readonly onError: (message: string) => void; readonly onSelect: (page: number, quote: string, rects: readonly Rect[]) => void }): JSX.Element {
  const canvas = useRef<HTMLCanvasElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<unknown> } | undefined;
    void document.getPage(pageNumber).then(async (pdfPage) => {
      if (cancelled || canvas.current === null || layer.current === null) return;
      const viewport = pdfPage.getViewport({ scale: zoom });
      const renderViewport = pdfPage.getViewport({ scale: zoom * (window.devicePixelRatio || 1) });
      canvas.current.width = Math.floor(renderViewport.width); canvas.current.height = Math.floor(renderViewport.height);
      canvas.current.style.width = `${viewport.width}px`; canvas.current.style.height = `${viewport.height}px`;
      const context = canvas.current.getContext('2d');
      if (context === null) throw new Error('O navegador não disponibilizou um contexto 2D para o PDF.');
      renderTask = pdfPage.render({ canvasContext: context, viewport: renderViewport, intent: 'display' } as never);
      await renderTask.promise;
      if (cancelled || layer.current === null) return;
      const textContent = await pdfPage.getTextContent();
      layer.current.replaceChildren(); layer.current.style.width = `${viewport.width}px`; layer.current.style.height = `${viewport.height}px`;
      await new TextLayer({ textContentSource: textContent, container: layer.current, viewport }).render();
      onText(pageNumber, textContent.items.map((item) => 'str' in item ? item.str : '').join(' '));
    }).catch((error: unknown) => { console.error('[Folio PDF] falha ao renderizar página', { pageNumber, error }); if (!cancelled) onError(`Não foi possível renderizar a página ${pageNumber}: ${messageFor(error)}`); });
    return () => { cancelled = true; renderTask?.cancel(); };
  }, [document, onError, onText, pageNumber, zoom]);
  const capture = (): void => {
    const selection = window.getSelection(); const quote = selection?.toString().replace(/\s+/gu, ' ').trim() ?? '';
    const bounds = layer.current?.parentElement?.getBoundingClientRect();
    if (quote === '' || bounds === undefined || bounds.width === 0 || bounds.height === 0 || selection?.rangeCount !== 1) return;
    const rects = Array.from(selection.getRangeAt(0).getClientRects()).flatMap((rect) => rect.width === 0 || rect.height === 0 ? [] : [{ x: (rect.left - bounds.left) / bounds.width, y: (rect.top - bounds.top) / bounds.height, width: rect.width / bounds.width, height: rect.height / bounds.height }]);
    if (rects.length > 0) onSelect(pageNumber, quote, rects);
  };
  return <article id={`folio-pdf-page-${pageNumber}`} className="folio-pdf-page relative mx-auto mb-8 w-fit overflow-hidden rounded-sm bg-white shadow-xl ring-1 ring-slate-200" onMouseUp={capture}>
    <canvas ref={canvas} className="block" /><div ref={layer} className="textLayer folio-pdf-text-layer" />
    {annotations.flatMap((annotation) => (annotation.rects ?? []).map((rect, index) => <span key={`${annotation.id}:${index}`} title={annotation.comment ?? annotation.quote} className={`pointer-events-none absolute ${annotation.kind === 'underline' ? 'border-b-2' : annotation.kind === 'strikeout' ? 'border-t-2 translate-y-1/2' : annotation.kind === 'comment' ? 'border-2 border-dashed' : 'bg-opacity-25'}`} style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.width * 100}%`, height: `${rect.height * 100}%`, backgroundColor: annotation.kind === 'highlight' ? (annotation.color ?? '#facc15') : 'transparent', borderColor: annotation.color ?? '#f59e0b' }} />))}
  </article>;
}

function PdfAnnotationToolbar({ selection, comment, commentOpen, semanticType, onSemanticChange, onAnnotate, onCommentChange, onCopy, onExtract, onCite, onOpenComment, onCancel }: {
  readonly selection: { readonly page: number; readonly quote: string };
  readonly comment: string;
  readonly commentOpen: boolean;
  readonly semanticType: AnnotationSemanticType | '';
  readonly onSemanticChange: (value: AnnotationSemanticType | '') => void;
  readonly onAnnotate: (kind: 'highlight' | 'underline' | 'strikeout' | 'comment') => void;
  readonly onCommentChange: (value: string) => void;
  readonly onCopy: () => void;
  readonly onExtract: () => void;
  readonly onCite: () => void;
  readonly onOpenComment: () => void;
  readonly onCancel: () => void;
}): JSX.Element {
  return <div role="toolbar" aria-label="Ações para o texto selecionado" className="sticky top-3 z-20 mx-auto mb-4 flex w-fit max-w-[calc(100%-1rem)] flex-wrap items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
    <select aria-label="Tipo semântico da annotation" value={semanticType} onChange={(event) => onSemanticChange(event.target.value as AnnotationSemanticType | '')} className="rounded border border-slate-300 px-1.5 py-1 text-xs"><option value="">Sem semântica</option>{ANNOTATION_SEMANTIC_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}</select>
    <button type="button" className="folio-control px-2 py-1 text-xs" title="Alt+H" onClick={() => onAnnotate('highlight')}>Destacar</button>
    <button type="button" className="folio-control px-2 py-1 text-xs" title="Alt+U" onClick={() => onAnnotate('underline')}>Sublinhar</button>
    <button type="button" className="folio-control px-2 py-1 text-xs" title="Alt+S" onClick={() => onAnnotate('strikeout')}>Tachar</button>
    <button type="button" className="folio-control px-2 py-1 text-xs" title="Alt+M" onClick={onOpenComment}>Comentar</button>
    <button type="button" className="folio-control px-2 py-1 text-xs" title="Alt+E" onClick={onExtract}>Extrair</button>
    <button type="button" className="folio-control px-2 py-1 text-xs" title="Alt+C" onClick={onCite}>Citar</button>
    <button type="button" className="folio-control px-2 py-1 text-xs" title="Alt+X" onClick={onCopy}>Copiar</button>
    <button type="button" aria-label="Cancelar seleção" className="px-2 py-1 text-xs text-slate-500 hover:text-slate-900" onClick={onCancel}>×</button>
    {commentOpen && <div className="flex w-full items-center gap-2 border-t border-slate-100 pt-2"><input autoFocus value={comment} onChange={(event) => onCommentChange(event.target.value)} placeholder="Comentário sobre a seleção" className="min-w-40 flex-1 rounded border border-slate-300 px-2 py-1 text-xs" /><button type="button" className="folio-primary rounded px-2 py-1 text-xs" onClick={() => onAnnotate('comment')}>Salvar comentário</button></div>}
    <p className="sr-only">Texto selecionado na página {selection.page}: {selection.quote}</p>
  </div>;
}

function PdfThumbnail({ document, pageNumber, active, onOpen }: { readonly document: PDFDocumentProxy; readonly pageNumber: number; readonly active: boolean; readonly onOpen: () => void }): JSX.Element {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => { let cancelled = false; let renderTask: { cancel: () => void; promise: Promise<unknown> } | undefined; void document.getPage(pageNumber).then(async (pdfPage) => { if (cancelled || canvas.current === null) return; const viewport = pdfPage.getViewport({ scale: 0.16 }); canvas.current.width = Math.floor(viewport.width); canvas.current.height = Math.floor(viewport.height); const context = canvas.current.getContext('2d'); if (context === null) return; renderTask = pdfPage.render({ canvasContext: context, viewport, intent: 'display' } as never); await renderTask.promise; }).catch(() => undefined); return () => { cancelled = true; renderTask?.cancel(); }; }, [document, pageNumber]);
  return <button type="button" className={`folio-pdf-thumbnail rounded-lg border p-2 text-left text-xs transition ${active ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50'}`} onClick={onOpen}><canvas ref={canvas} className="block max-w-full rounded-sm bg-slate-100" /><span className="block pt-2 text-center font-medium text-slate-600">Página {pageNumber}</span></button>;
}

function PdfReferencePanel({ fileId, path, onOpenNote, onOpenLibrary, onStatus }: { readonly fileId: string; readonly path: string; readonly onOpenNote: (fileId: string, path: string, citation?: string) => void; readonly onOpenLibrary: () => void; readonly onStatus: (message: string) => void }): JSX.Element {
  const [references, setReferences] = useState<readonly { id: string; title?: string }[]>([]); const [choice, setChoice] = useState('');
  const [linked, setLinked] = useState<{ attachmentId: string; referenceId: string; title?: string; versions: number }>();
  const [backlinks, setBacklinks] = useState<readonly { path: string; label: string }[]>([]);
  const refresh = useCallback((): void => { void Promise.all([window.academic.library.list({}), window.academic.workspace.attachments({})]).then(([library, attachments]) => {
    if (!library.ok) { onStatus(library.error.message); return; }
    if (!attachments.ok) { onStatus(attachments.error.message); return; }
    setReferences(library.value.map((entry) => entry.title === undefined ? { id: entry.id } : { id: entry.id, title: entry.title }));
    const attachment = attachments.value.find((item) => item.mediaType === 'application/pdf' && item.versions.some((version) => version.file?.fileId === fileId));
    const title = attachment === undefined ? undefined : library.value.find((entry) => entry.id === attachment.referenceId)?.title;
    setLinked(attachment === undefined ? undefined : title === undefined ? { attachmentId: attachment.id, referenceId: attachment.referenceId, versions: attachment.versions.length } : { attachmentId: attachment.id, referenceId: attachment.referenceId, title, versions: attachment.versions.length });
  }); }, [fileId, onStatus]);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { void window.academic.documents.backlinks({ fileId }).then((result) => { if (result.ok) setBacklinks(result.value.map((item) => ({ path: item.path, label: item.label }))); }); }, [fileId]);
  const link = async (referenceId: string): Promise<void> => { if (referenceId === '') return; const title = path.split('/').pop(); const result = await window.academic.workspace.addAttachment({ referenceId, role: 'primary', kind: 'file', mediaType: 'application/pdf', existingFileId: fileId, ...(title === undefined ? {} : { displayTitle: title }) }); if (!result.ok) { onStatus(result.error.message); return; } setChoice(''); onStatus('PDF vinculado à referência.'); refresh(); };
  const discover = async (): Promise<void> => { const source = await window.academic.editor.assetPreview({ fileId }); if (!source.ok) { onStatus(source.error.message); return; } const reconciled = await window.academic.library.reconcilePdf({ base64: source.value.dataUrl.slice(source.value.dataUrl.indexOf(',') + 1) }); if (!reconciled.ok) { onStatus(reconciled.error.message); return; } const candidate = reconciled.value.reviews.find((review) => review.entry !== undefined)?.entry; if (candidate === undefined) { onStatus('Nenhuma metadata acadêmica foi encontrada no PDF.'); return; } const saved = await window.academic.library.upsert({ entry: candidate }); if (!saved.ok) { onStatus(saved.error.message); return; } await link(saved.value.id); };
  const openNote = async (): Promise<void> => { if (linked === undefined) return; const result = await window.academic.documents.createLiteratureNote({ referenceId: linked.referenceId }); if (!result.ok) { onStatus(result.error.message); return; } onOpenNote(result.value.fileId, result.value.path); };
  const unlink = async (): Promise<void> => { if (linked === undefined) return; const result = await window.academic.workspace.removeAttachment({ attachmentId: linked.attachmentId }); if (!result.ok) { onStatus(result.error.message); return; } onStatus('PDF desvinculado da referência.'); refresh(); };
  const exportCopy = async (mode: 'editable' | 'flatten'): Promise<void> => { const [source, stored] = await Promise.all([window.academic.editor.assetPreview({ fileId }), window.academic.library.pdfAnnotations({ fileId })]); if (!source.ok) { onStatus(source.error.message); return; } if (!stored.ok) { onStatus(stored.error.message); return; } try { const bytes = await exportAnnotatedPdf(decode(source.value.dataUrl), stored.value, mode); const copy = new Uint8Array(bytes.byteLength); copy.set(bytes); const blob = new Blob([copy.buffer], { type: 'application/pdf' }); const url = URL.createObjectURL(blob); const anchor = globalThis.document.createElement('a'); anchor.href = url; anchor.download = `${path.split('/').pop()?.replace(/\.pdf$/iu, '') ?? 'folio'}-anotado-${mode}.pdf`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); onStatus('Cópia anotada preparada para download.'); } catch (error) { onStatus(`Não foi possível exportar o PDF: ${messageFor(error)}`); } };
  const createVersion = async (mode: 'editable' | 'flatten'): Promise<void> => { if (linked === undefined) { onStatus('Vincule o PDF a uma referência antes de criar uma versão anotada.'); return; } const [source, stored] = await Promise.all([window.academic.editor.assetPreview({ fileId }), window.academic.library.pdfAnnotations({ fileId })]); if (!source.ok) { onStatus(source.error.message); return; } if (!stored.ok) { onStatus(stored.error.message); return; } try { const bytes = await exportAnnotatedPdf(decode(source.value.dataUrl), stored.value, mode); const base = path.split('/').pop()?.replace(/\.pdf$/iu, '') ?? 'folio'; const result = await window.academic.workspace.addAttachmentVersion({ attachmentId: linked.attachmentId, name: `${base}-anotado-${mode}.pdf`, base64: encode(bytes), note: `Versão anotada ${mode === 'editable' ? 'editável' : 'achatada'} criada no leitor PDF.` }); if (!result.ok) { onStatus(result.error.message); return; } onStatus('Nova versão anotada criada; o original foi preservado.'); refresh(); } catch (error) { onStatus(`Não foi possível criar a versão anotada: ${messageFor(error)}`); } };
  return <section className="border-b border-slate-200 pb-4"><h2 className="text-sm font-bold">PDF e referência</h2>{linked === undefined ? <><select aria-label="Vincular PDF a referência" value={choice} onChange={(event) => setChoice(event.target.value)} className="mt-2 w-full rounded border px-2 py-1 text-xs"><option value="">Escolha uma referência…</option>{references.map((entry) => <option key={entry.id} value={entry.id}>{entry.title ?? entry.id}</option>)}</select><div className="mt-2 flex flex-wrap gap-2"><button type="button" className="folio-primary rounded px-2 py-1 text-xs" disabled={choice === ''} onClick={() => void link(choice)}>Vincular</button><button type="button" className="text-xs font-semibold text-indigo-700" onClick={() => void discover()}>Encontrar metadata</button></div><button type="button" className="mt-2 text-xs text-slate-600 underline" onClick={onOpenLibrary}>Abrir Biblioteca</button></> : <><p className="mt-2 text-xs font-semibold text-slate-800">{linked.title ?? linked.referenceId}</p><p className="mt-1 text-[11px] text-emerald-700">Anexo vinculado · {linked.versions} versão(ões)</p><div className="mt-2 flex flex-wrap gap-2"><button type="button" className="text-xs font-semibold text-indigo-700" onClick={() => void openNote()}>Abrir nota</button><button type="button" className="text-xs font-semibold text-rose-600" onClick={() => void unlink()}>Desvincular</button></div><button type="button" className="mt-2 text-xs text-slate-600 underline" onClick={onOpenLibrary}>Abrir referência na Biblioteca</button></>}<h3 className="mt-4 text-xs font-bold uppercase text-slate-500">Exportar cópia</h3><div className="mt-2 flex flex-wrap gap-2"><button type="button" className="folio-control px-2 py-1 text-xs" onClick={() => void exportCopy('editable')}>PDF editável</button><button type="button" className="folio-control px-2 py-1 text-xs" onClick={() => void exportCopy('flatten')}>PDF achatado</button></div><h3 className="mt-4 text-xs font-bold uppercase text-slate-500">Nova versão do anexo</h3><div className="mt-2 flex flex-wrap gap-2"><button type="button" className="folio-control px-2 py-1 text-xs" disabled={linked === undefined} onClick={() => void createVersion('editable')}>Editável</button><button type="button" className="folio-control px-2 py-1 text-xs" disabled={linked === undefined} onClick={() => void createVersion('flatten')}>Achatada</button></div><section className="mt-4"><h3 className="text-xs font-bold uppercase text-slate-500">Backlinks</h3>{backlinks.length === 0 ? <p className="mt-2 text-xs text-slate-500">Nenhum uso encontrado.</p> : <ul className="mt-2 space-y-1">{backlinks.map((item, index) => <li key={index} className="rounded bg-slate-50 px-2 py-1 text-xs"><span className="block truncate font-medium text-slate-700">{item.path}</span><span className="block truncate text-slate-500">{item.label}</span></li>)}</ul>}</section></section>;
}

export interface PdfResearchContext { readonly referenceId?: string; readonly reviewId?: string; readonly searchRunId?: string; readonly artifactId?: string; }

export function PdfWorkspacePane({ fileId, path, initialPage, researchContext, onOpenNote, onOpenLibrary, onUseInEvidence }: { readonly fileId: string; readonly path: string; readonly initialPage?: number; readonly researchContext?: PdfResearchContext; readonly onOpenNote: (fileId: string, path: string, citation?: string) => void; readonly onOpenLibrary: () => void; readonly onUseInEvidence: (annotation: WorkspacePdfAnnotationDto) => void }): JSX.Element {
  const [document, setDocument] = useState<PDFDocumentProxy>(); const [page, setPage] = useState(1); const [zoom, setZoom] = useState(1.15); const [status, setStatus] = useState('Carregando PDF…'); const [mode, setMode] = useState<'single' | 'continuous'>('single'); const [outline, setOutline] = useState<readonly { label: string; page: number }[]>([]); const [annotations, setAnnotations] = useState<readonly WorkspacePdfAnnotationDto[]>([]); const [selected, setSelected] = useState<{ page: number; quote: string; rects: readonly Rect[] }>(); const kind: NonNullable<WorkspacePdfAnnotationDto['kind']> = 'highlight'; const color = '#facc15'; const [comment, setComment] = useState(''); const [commentOpen, setCommentOpen] = useState(false); const [annotationFilter, setAnnotationFilter] = useState<'all' | NonNullable<WorkspacePdfAnnotationDto['kind']>>('all'); const [annotationQuery, setAnnotationQuery] = useState(''); const [annotationLinkFilter, setAnnotationLinkFilter] = useState<'all' | 'linked' | 'unlinked'>('all'); const [semanticType, setSemanticType] = useState<AnnotationSemanticType | ''>(''); const [semanticFilter, setSemanticFilter] = useState<AnnotationSemanticType | 'all'>('all'); const [embedded, setEmbedded] = useState<readonly EmbeddedAnnotation[]>([]); const [importOpen, setImportOpen] = useState(false); const [failure, setFailure] = useState<string>(); const [reloadVersion, setReloadVersion] = useState(0); const [embeddedScanPages, setEmbeddedScanPages] = useState(INITIAL_EMBEDDED_SCAN_PAGES); const [continuousLimit, setContinuousLimit] = useState(INITIAL_CONTINUOUS_PAGES); const [annotationConflict, setAnnotationConflict] = useState<string>(); const scroll = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    let task: ReturnType<typeof getDocument> | undefined;
    setDocument(undefined); setOutline([]); setEmbedded([]); setFailure(undefined); setStatus('Carregando PDF…');
    void window.academic.editor.assetPreview({ fileId }).then(async (result) => {
      if (!result.ok || result.value.mediaType !== 'application/pdf') {
        if (!cancelled) { const message = result.ok ? 'O arquivo selecionado não é um PDF.' : result.error.message; setFailure(message); setStatus(message); }
        return;
      }
      const bytes = decode(result.value.dataUrl);
      console.debug('[Folio PDF] assetPreview recebido', { fileId, path, mediaType: result.value.mediaType, bytes: bytes.byteLength });
      task = getDocument({ data: bytes, wasmUrl: new URL('./wasm/', import.meta.url).toString(), isOffscreenCanvasSupported: false, isImageDecoderSupported: false, useWorkerFetch: false });
      const loaded = await task.promise;
      console.debug('[Folio PDF] documento carregado', { fileId, path, pages: loaded.numPages });
      if (cancelled) { await loaded.destroy(); return; }
      setDocument(loaded);
      setStatus(String(loaded.numPages) + ' páginas · carregando outline e annotations…');
      void (async () => {
        const items = await loaded.getOutline() ?? [];
        const resolved = await Promise.all(items.slice(0, 40).flatMap((item) => typeof item.dest === 'string' ? [] : [item]).map(async (item) => {
          const destination = Array.isArray(item.dest) ? item.dest : await loaded.getDestination(item.dest as string);
          return destination?.[0] === undefined ? undefined : { label: item.title || 'Seção', page: (await loaded.getPageIndex(destination[0])) + 1 };
        }));
        const limit = Math.min(loaded.numPages, embeddedScanPages);
        const detected = (await Promise.all(Array.from({ length: limit }, async (_, index) => {
          const pdfPage = await loaded.getPage(index + 1);
          const viewport = pdfPage.getViewport({ scale: 1 });
          return (await pdfPage.getAnnotations()).flatMap((raw: Record<string, unknown>) => {
            const kind = embeddedKind(raw.annotationType); const id = typeof raw.id === 'string' ? raw.id : undefined;
            const rect = Array.isArray(raw.rect) && raw.rect.every((value) => typeof value === 'number') ? raw.rect as number[] : undefined;
            if (kind === undefined || id === undefined) return [];
            const view = rect === undefined ? undefined : viewport.convertToViewportRectangle(rect);
            const rects = view === undefined ? undefined : [{ x: Math.min(view[0]!, view[2]!) / viewport.width, y: Math.min(view[1]!, view[3]!) / viewport.height, width: Math.abs(view[2]! - view[0]!) / viewport.width, height: Math.abs(view[3]! - view[1]!) / viewport.height }];
            const contents = typeof raw.contents === 'string' ? raw.contents.trim() : '';
            return [{ externalId: id, page: index + 1, kind, quote: contents === '' ? '[Annotation externa, p. ' + String(index + 1) + ']' : contents, ...(contents === '' ? {} : { comment: contents }), ...(rects === undefined ? {} : { rects }) }];
          });
        }))).flat();
        if (!cancelled) {
          setOutline(resolved.filter((item): item is { label: string; page: number } => item !== undefined));
          setEmbedded(detected);
          setStatus(loaded.numPages > limit ? String(loaded.numPages) + ' páginas · annotations verificadas até a página ' + String(limit) : String(loaded.numPages) + ' páginas');
          if (detected.length > 0) setImportOpen(true);
        }
      })().catch((error: unknown) => { if (!cancelled) setStatus('PDF aberto, mas alguns recursos falharam: ' + messageFor(error)); });
    }).catch((error: unknown) => {
      console.error('[Folio PDF] falha ao abrir', { fileId, path, error });
      if (!cancelled) { const message = pdfFailureMessage(error); setFailure(message); setStatus(message); }
    });
    return () => { cancelled = true; void task?.destroy(); };
  }, [embeddedScanPages, fileId, reloadVersion]);
  useEffect(() => () => { void document?.destroy(); }, [document]);
  const refreshAnnotations = useCallback((): void => { void window.academic.library.pdfAnnotations({ fileId }).then((result) => { if (result.ok) { setAnnotations(result.value); setAnnotationConflict(undefined); } else setStatus(result.error.message); }); }, [fileId]);
  useEffect(() => { refreshAnnotations(); }, [refreshAnnotations]);
  useEffect(() => { if (!importOpen) return; setImportOpen(false); void requestConfirmation({ title: 'Importar annotations?', description: `${embedded.length} annotation(s) embutida(s) foram encontradas. Elas serão copiadas para o sidecar; o PDF original não será alterado.`, confirmLabel: 'Importar annotations' }).then((confirmed) => { if (!confirmed) return; return Promise.all(embedded.map((item) => window.academic.library.createPdfAnnotation({ fileId, page: item.page, quote: item.quote, kind: item.kind, externalId: item.externalId, ...(item.comment === undefined ? {} : { comment: item.comment }), ...(item.rects === undefined ? {} : { rects: item.rects }) }))).then((results) => { const failed = results.find((result) => !result.ok); if (failed !== undefined && !failed.ok) { setStatus(failed.error.message); return; } setStatus(`${embedded.length} annotation(s) importada(s) para o sidecar.`); refreshAnnotations(); }); }); }, [embedded, fileId, importOpen, refreshAnnotations]);
  const pages = mode === 'continuous' && document !== undefined ? Array.from({ length: Math.max(page, Math.min(document.numPages, continuousLimit)) }, (_, index) => index + 1) : [page];
  const openPage = (next: number): void => { setPage(next); globalThis.document.getElementById(`folio-pdf-page-${next}`)?.scrollIntoView({ block: 'center' }); };
  useEffect(() => {
    if (initialPage === undefined || document === undefined) return;
    const next = Math.max(1, Math.min(document.numPages, initialPage));
    setPage(next);
    globalThis.setTimeout(() => globalThis.document.getElementById(`folio-pdf-page-${next}`)?.scrollIntoView({ block: 'center' }), 0);
  }, [document, initialPage]);
  const onText = useCallback((_page: number, _text: string): void => undefined, []); const onRenderError = useCallback((next: string): void => setStatus(next), []);
  const isConflict = (result: { readonly ok: boolean; readonly error?: { readonly code?: string } }): boolean => !result.ok && result.error?.code === 'CONFLICT';
  const saveAnnotation = async (nextKind: NonNullable<WorkspacePdfAnnotationDto['kind']> = kind, extract = false): Promise<WorkspacePdfAnnotationDto | undefined> => { if (selected === undefined) return undefined; const result = await window.academic.library.createPdfAnnotation({ fileId, page: selected.page, quote: selected.quote, anchor: { quote: selected.quote }, rects: selected.rects, kind: nextKind, color, ...(semanticType === '' ? {} : { semanticType }), ...(comment.trim() === '' ? {} : { comment: comment.trim() }) }); if (!result.ok) { setStatus(result.error.message); if (isConflict(result)) setAnnotationConflict('O sidecar de annotations mudou fora desta tela. Recarregue-o antes de tentar novamente.'); return undefined; } setAnnotations((current) => [...current, result.value]); setSelected(undefined); setComment(''); setCommentOpen(false); if (extract) onUseInEvidence(result.value); return result.value; };
  const removeAnnotation = async (annotation: WorkspacePdfAnnotationDto): Promise<void> => { const result = await window.academic.library.removePdfAnnotation({ fileId, id: annotation.id }); if (!result.ok) { setStatus(result.error.message); if (isConflict(result)) setAnnotationConflict('O sidecar de annotations mudou fora desta tela. Recarregue-o antes de remover.'); return; } setAnnotations((current) => current.filter((item) => item.id !== annotation.id)); };
  const onFitWidth = (): void => { const width = scroll.current?.clientWidth ?? 900; setZoom(Math.max(0.65, Math.min(2.5, (width - 70) / 612))); };
  const copyLink = async (annotationId?: string): Promise<void> => { try { await navigator.clipboard.writeText(markdownPdfLink(path, page, annotationId)); setStatus(annotationId === undefined ? 'Link Markdown da página copiado.' : 'Link Markdown da annotation copiado.'); } catch { setStatus('Não foi possível copiar o link.'); } };
  const sendToNote = async (annotation: WorkspacePdfAnnotationDto): Promise<void> => { const result = await window.academic.library.linkPdfAnnotation({ fileId, id: annotation.id }); if (!result.ok) { setStatus(result.error.message); return; } setAnnotations((current) => current.map((item) => item.id === annotation.id ? result.value.annotation : item)); const citation = result.value.annotation.referenceId === undefined ? undefined : `[@${result.value.annotation.referenceId}, p. ${annotation.page}]`; onOpenNote(result.value.literatureNote.fileId, result.value.literatureNote.path, citation); };
  const copySelection = async (): Promise<void> => { if (selected === undefined) return; try { await navigator.clipboard.writeText(selected.quote); setStatus('Texto selecionado copiado.'); } catch { setStatus('Não foi possível copiar o texto selecionado.'); } };
  const citeSelection = async (): Promise<void> => { if (selected === undefined) return; const result = await window.academic.workspace.attachments({}); if (!result.ok) { setStatus(result.error.message); return; } const attachment = result.value.find((item) => item.mediaType === 'application/pdf' && item.versions.some((version) => version.file?.fileId === fileId)); if (attachment === undefined) { setStatus('Vincule o PDF a uma referência antes de copiar a citação.'); return; } try { await navigator.clipboard.writeText(`[@${attachment.referenceId}, p. ${selected.page}]`); setStatus('Citação copiada.'); } catch { setStatus('Não foi possível copiar a citação.'); } };
  const visibleAnnotations = annotations.filter((item) => (annotationFilter === 'all' || item.kind === annotationFilter) && (semanticFilter === 'all' || item.semanticType === semanticFilter) && (annotationLinkFilter === 'all' || (annotationLinkFilter === 'linked' ? item.literatureNoteFileId !== undefined : item.literatureNoteFileId === undefined)) && (annotationQuery.trim() === '' || item.quote.toLocaleLowerCase().includes(annotationQuery.trim().toLocaleLowerCase()) || item.comment?.toLocaleLowerCase().includes(annotationQuery.trim().toLocaleLowerCase())));
  const [readingNote, setReadingNote] = useState<{ readonly path: string; readonly content: string }>();
  const [readingProgress, setReadingProgress] = useState<PdfReadingProgress>(() => readReadingProgress(fileId));
  useEffect(() => {
    const header = globalThis.document.querySelector('main > header strong');
    if (!(header instanceof HTMLElement)) return;
    const link = markdownPdfLink(path, page);
    const onDragStart = (event: DragEvent): void => { event.dataTransfer?.setData('text/folio-markdown', link); event.dataTransfer?.setData('text/plain', link); if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy'; };
    header.draggable = true;
    header.addEventListener('dragstart', onDragStart);
    return () => { header.removeEventListener('dragstart', onDragStart); header.draggable = false; };
  }, [path, page]);
  useEffect(() => { const next = { ...readingProgress, lastPage: page, furthestPage: Math.max(readingProgress.furthestPage, page), lastOpenedAt: new Date().toISOString(), status: readingProgress.status === 'unread' ? 'reading' as const : readingProgress.status }; setReadingProgress(next); window.localStorage.setItem(readingProgressKey(fileId), JSON.stringify(next)); }, [fileId, page]);
  const openReadingNote = async (): Promise<void> => {
    const linked = annotations.find((item) => item.literatureNoteFileId !== undefined);
    if (linked?.literatureNoteFileId === undefined) { setStatus('Vincule uma annotation a uma nota para usar o modo de leitura.'); return; }
    const result = await window.academic.editor.open({ fileId: linked.literatureNoteFileId });
    if (!result.ok) { setStatus(result.error.message); return; }
    setReadingNote({ path: result.value.session.file.path, content: result.value.session.content });
  };
  const onKeyDown = (event: ReactKeyboardEvent<HTMLElement>): void => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
    if (selected !== undefined && event.altKey) {
      const key = event.key.toLowerCase();
      if (key === 'h') { event.preventDefault(); void saveAnnotation('highlight'); return; }
      if (key === 'u') { event.preventDefault(); void saveAnnotation('underline'); return; }
      if (key === 's') { event.preventDefault(); void saveAnnotation('strikeout'); return; }
      if (key === 'm') { event.preventDefault(); setCommentOpen(true); return; }
      if (key === 'e') { event.preventDefault(); void saveAnnotation('highlight', true); return; }
      if (key === 'c') { event.preventDefault(); void citeSelection(); return; }
      if (key === 'x') { event.preventDefault(); void copySelection(); return; }
    }
    if (event.key === 'ArrowLeft') { event.preventDefault(); openPage(Math.max(1, page - 1)); }
    if (event.key === 'ArrowRight' && document !== undefined) { event.preventDefault(); openPage(Math.min(document.numPages, page + 1)); }
    if (event.key === '+' || event.key === '=') { event.preventDefault(); setZoom((value) => Math.min(2.5, value + 0.15)); }
    if (event.key === '-') { event.preventDefault(); setZoom((value) => Math.max(0.65, value - 0.15)); }
    if (event.key.toLowerCase() === 'f') { event.preventDefault(); onFitWidth(); }
    if (event.key.toLowerCase() === 'a' && document !== undefined && embeddedScanPages < document.numPages) { event.preventDefault(); setEmbeddedScanPages((value) => value + INITIAL_EMBEDDED_SCAN_PAGES); }
    if (event.key === 'Escape') { setSelected(undefined); setComment(''); setCommentOpen(false); }
  };
  useEffect(() => {
    const listener = (event: KeyboardEvent): void => onKeyDown(event as unknown as ReactKeyboardEvent<HTMLElement>);
    globalThis.addEventListener('keydown', listener);
    return () => globalThis.removeEventListener('keydown', listener);
  });
  useEffect(() => {
    const node = scroll.current;
    if (node === null || mode !== 'continuous') return;
    const onScroll = (): void => {
      if (node.scrollTop + node.clientHeight >= node.scrollHeight - 120) setContinuousLimit((value) => value + INITIAL_CONTINUOUS_PAGES);
    };
    node.addEventListener('scroll', onScroll);
    return () => node.removeEventListener('scroll', onScroll);
  }, [mode]);
  useEffect(() => {
    const node = scroll.current;
    const main = node?.parentElement;
    const toolbar = main?.querySelector('header');
    const title = toolbar?.querySelector('strong');
    const inspector = main?.nextElementSibling;
    const workspace = main?.parentElement;
    const referenceButton = globalThis.document.createElement('button');
    const closeButton = globalThis.document.createElement('button');
    referenceButton.type = 'button'; referenceButton.className = 'folio-pdf-reference-trigger'; referenceButton.textContent = 'Referência'; referenceButton.setAttribute('aria-haspopup', 'dialog');
    closeButton.type = 'button'; closeButton.className = 'folio-pdf-inspector-close'; closeButton.textContent = '×'; closeButton.setAttribute('aria-label', 'Fechar PDF e referência');
    const toggleInspector = (): void => { inspector?.classList.toggle('is-open'); };
    const closeInspector = (): void => inspector?.classList.remove('is-open');
    node?.classList.add('folio-pdf-scroller');
    main?.classList.add('folio-pdf-reading-main');
    toolbar?.classList.add('folio-pdf-toolbar');
    inspector?.classList.add('folio-pdf-inspector');
    workspace?.classList.add('folio-pdf-workspace');
    toolbar?.append(referenceButton);
    inspector?.prepend(closeButton);
    referenceButton.addEventListener('click', toggleInspector);
    closeButton.addEventListener('click', closeInspector);
    if (title !== null && title !== undefined) title.textContent = path.split('/').filter(Boolean).at(-1) ?? path;
    return () => { referenceButton.removeEventListener('click', toggleInspector); closeButton.removeEventListener('click', closeInspector); referenceButton.remove(); closeButton.remove(); node?.classList.remove('folio-pdf-scroller'); main?.classList.remove('folio-pdf-reading-main'); toolbar?.classList.remove('folio-pdf-toolbar'); inspector?.classList.remove('folio-pdf-inspector'); workspace?.classList.remove('folio-pdf-workspace'); };
  }, [path]);
  useEffect(() => { if (annotationConflict !== undefined) setStatus(annotationConflict); }, [annotationConflict]);
  if (failure !== undefined) return <section className="grid h-full place-items-center bg-slate-100 p-8"><div role="alert" className="max-w-md rounded-xl border border-rose-200 bg-white p-5 shadow-sm"><h2 className="font-bold text-slate-900">PDF indisponível</h2><p className="mt-2 text-sm leading-6 text-slate-600">{failure}</p><p className="mt-2 text-xs text-slate-500">Se o arquivo foi alterado ou restaurado no vault, recarregue para tentar novamente.</p><button type="button" className="folio-primary mt-4 rounded px-3 py-2 text-sm" onClick={() => setReloadVersion((value) => value + 1)}>Recarregar PDF</button></div></section>;
  return <section data-research-reference={researchContext?.referenceId} data-research-review={researchContext?.reviewId} data-research-search-run={researchContext?.searchRunId} data-research-artifact={researchContext?.artifactId} className="relative grid h-full min-h-0 grid-cols-[10rem_minmax(0,1fr)_15rem] bg-slate-100">{readingNote !== undefined && <aside className="absolute inset-y-0 right-0 z-30 flex w-[min(42rem,48vw)] min-w-[20rem] flex-col border-l border-indigo-200 bg-white shadow-2xl"><header className="flex items-center gap-2 border-b border-slate-200 px-4 py-3"><strong className="min-w-0 flex-1 truncate text-sm">Nota de literatura</strong><button type="button" className="folio-control rounded px-2 py-1 text-xs" onClick={() => setReadingNote(undefined)}>Fechar</button></header><pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap p-5 font-sans text-sm leading-6 text-slate-700">{readingNote.content}</pre></aside>}<aside className="overflow-auto border-r border-slate-200 bg-white p-3"><h2 className="text-sm font-bold">Páginas</h2><div className="mt-3 grid gap-2">{document !== undefined && Array.from({ length: document.numPages }, (_, index) => <PdfThumbnail key={index} document={document} pageNumber={index + 1} active={page === index + 1} onOpen={() => openPage(index + 1)} />)}</div>{outline.length > 0 && <><h3 className="mt-5 text-xs font-bold uppercase text-slate-500">Outline</h3>{outline.map((item, index) => <button key={index} type="button" className="mt-1 block text-left text-xs text-indigo-700" onClick={() => openPage(item.page)}>{item.label}</button>)}</>}</aside><main className="grid min-w-0 grid-rows-[auto_minmax(0,1fr)]"><header className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2"><strong className="mr-auto text-sm text-slate-800">{path}</strong><button type="button" className="folio-control px-2 py-1 text-xs" disabled={page <= 1} onClick={() => openPage(page - 1)}>←</button><input aria-label="Ir para página" type="number" min={1} max={document?.numPages ?? 1} value={page} onChange={(event) => openPage(Math.max(1, Math.min(document?.numPages ?? 1, Number(event.target.value) || 1)))} className="w-12 rounded border px-1 text-center text-xs" /><span className="text-xs">/ {document?.numPages ?? '—'}</span><button type="button" className="folio-control px-2 py-1 text-xs" disabled={document === undefined || page >= document.numPages} onClick={() => openPage(page + 1)}>→</button><button type="button" className="folio-control px-2 py-1 text-xs" onClick={() => setZoom((value) => Math.max(0.65, value - 0.15))}>−</button><span className="text-xs">{Math.round(zoom * 100)}%</span><button type="button" className="folio-control px-2 py-1 text-xs" onClick={() => setZoom((value) => Math.min(2.5, value + 0.15))}>+</button><button type="button" className="folio-control px-2 py-1 text-xs" onClick={onFitWidth}>Ajustar largura</button><button type="button" className="folio-control px-2 py-1 text-xs" onClick={() => void openReadingNote()}>Modo de leitura</button><button type="button" className="folio-control px-2 py-1 text-xs" onClick={() => void copyLink()}>Copiar link</button><select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)} className="rounded border px-1 py-1 text-xs"><option value="single">Página única</option><option value="continuous">Contínuo</option></select></header><div ref={scroll} className="min-h-0 overflow-auto p-8"><p className="mb-3 text-center text-xs text-slate-500">{status}</p>{selected !== undefined && <PdfAnnotationToolbar selection={selected} comment={comment} commentOpen={commentOpen} semanticType={semanticType} onSemanticChange={setSemanticType} onAnnotate={(nextKind) => void saveAnnotation(nextKind)} onCommentChange={setComment} onCopy={() => void copySelection()} onExtract={() => void saveAnnotation('highlight', true)} onCite={() => void citeSelection()} onOpenComment={() => setCommentOpen(true)} onCancel={() => { setSelected(undefined); setComment(''); setCommentOpen(false); }} />}{document !== undefined && pages.map((number) => <PdfPage key={number} document={document} pageNumber={number} zoom={zoom} annotations={annotations.filter((item) => item.page === number)} onText={onText} onError={onRenderError} onSelect={(selectedPage, quote, rects) => { setSelected({ page: selectedPage, quote, rects }); setSemanticType(''); setCommentOpen(false); }} />)}</div></main><aside className="overflow-auto border-l border-slate-200 bg-white p-3"><PdfReferencePanel fileId={fileId} path={path} onStatus={setStatus} onOpenNote={onOpenNote} onOpenLibrary={onOpenLibrary} /><div className="mt-4 flex items-center justify-between"><h2 className="text-sm font-bold">Anotações</h2><span className="text-[11px] text-slate-500">{visibleAnnotations.length}</span></div><input type="search" value={annotationQuery} onChange={(event) => setAnnotationQuery(event.target.value)} placeholder="Buscar annotations…" aria-label="Buscar annotations" className="mt-2 w-full rounded border border-slate-300 px-2 py-1.5 text-xs" /><div className="mt-2 flex flex-wrap gap-1"><select value={annotationFilter} onChange={(event) => setAnnotationFilter(event.target.value as typeof annotationFilter)} aria-label="Filtrar tipo de annotation" className="min-w-0 flex-1 rounded border border-slate-300 px-1 py-1 text-xs"><option value="all">Todos os tipos</option><option value="highlight">Destaques</option><option value="underline">Sublinhados</option><option value="strikeout">Tachados</option><option value="comment">Comentários</option><option value="area">Áreas</option><option value="ink">Tinta</option></select><select value={semanticFilter} onChange={(event) => setSemanticFilter(event.target.value as typeof semanticFilter)} aria-label="Filtrar semântica" className="min-w-0 flex-1 rounded border border-slate-300 px-1 py-1 text-xs"><option value="all">Todas as semânticas</option>{ANNOTATION_SEMANTIC_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}</select><select value={annotationLinkFilter} onChange={(event) => setAnnotationLinkFilter(event.target.value as typeof annotationLinkFilter)} aria-label="Filtrar vínculo" className="min-w-0 flex-1 rounded border border-slate-300 px-1 py-1 text-xs"><option value="all">Todos os vínculos</option><option value="linked">Com nota</option><option value="unlinked">Sem nota</option></select></div><h3 className="mt-4 text-xs font-bold uppercase text-slate-500">Página {page}</h3>{visibleAnnotations.length === 0 ? <p className="mt-2 text-xs text-slate-500">Nenhuma annotation corresponde aos filtros.</p> : visibleAnnotations.map((item) => <article key={item.id} draggable onDragStart={(event) => { const link = markdownPdfLink(path, item.page, item.id); event.dataTransfer.effectAllowed = "copy"; event.dataTransfer.setData("text/folio-markdown", link); event.dataTransfer.setData("text/plain", link); }} className="mt-2 cursor-grab rounded border bg-white p-2 text-xs hover:border-indigo-300" onClick={() => openPage(item.page)}><p className="mb-1 text-[10px] font-semibold uppercase text-slate-400">Página {item.page}{item.semanticType === undefined ? "" : ` · ${item.semanticType}`}</p><p>{item.quote}</p>{item.comment !== undefined && <p className="mt-1 text-slate-500">{item.comment}</p>}<div className="mt-2 flex flex-wrap gap-2"><button type="button" className="text-indigo-700" onClick={() => void copyLink(item.id)}>Copiar link</button><button type="button" className="text-indigo-700" onClick={() => void sendToNote(item)}>Enviar para nota</button><button type="button" className="text-indigo-700" onClick={() => onUseInEvidence(item)}>Usar na síntese</button><button type="button" className="text-rose-600" onClick={() => void removeAnnotation(item)}>Remover</button></div></article>)}</aside></section>;
}
