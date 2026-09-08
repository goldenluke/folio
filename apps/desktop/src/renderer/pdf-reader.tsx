import { useEffect, useMemo, useRef, useState, type JSX } from 'react';

import { GlobalWorkerOptions, getDocument, TextLayer, type PDFDocumentProxy } from 'pdfjs-dist';
import type { WorkspacePdfAnnotationDto } from '@abnt/protocol';

// Vite transforma esta URL em um asset local do renderer; nenhum worker/CDN é
// carregado fora do desktop.
GlobalWorkerOptions.workerPort = new Worker(new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url), { type: 'module' });

const decodeBase64 = (value: string): Uint8Array => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
};

const normalize = (value: string): string => value.replace(/\s+/gu, ' ').trim().toLocaleLowerCase();

function PdfThumbnail({ document, pageNumber, active, onOpen }: { readonly document: PDFDocumentProxy; readonly pageNumber: number; readonly active: boolean; readonly onOpen: () => void }): JSX.Element {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    void document.getPage(pageNumber).then(async (page) => {
      if (cancelled || canvas.current === null) return;
      const viewport = page.getViewport({ scale: 0.18 });
      const target = canvas.current;
      target.width = Math.max(1, Math.floor(viewport.width));
      target.height = Math.max(1, Math.floor(viewport.height));
      const context = target.getContext('2d');
      if (context === null) return;
      await page.render({ canvas: target, canvasContext: context, viewport }).promise;
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [document, pageNumber]);
  return <button type="button" title={`Ir para página ${pageNumber}`} aria-label={`Ir para página ${pageNumber}`} onClick={onOpen} className={`rounded-lg border p-1 text-left ${active ? 'border-indigo-400 bg-indigo-50 ring-1 ring-indigo-200' : 'border-slate-200 bg-white hover:border-indigo-200'}`}><canvas ref={canvas} className="block max-w-full" /><span className="block px-1 pt-1 text-center text-[10px] font-semibold text-slate-500">{pageNumber}</span></button>;
}

export function PdfReaderDialog({ referenceId, onClose, onOpenLiteratureNote }: { readonly referenceId: string; readonly onClose: () => void; readonly onOpenLiteratureNote: (fileId: string, path: string) => void }): JSX.Element {
  const [document, setDocument] = useState<PDFDocumentProxy>();
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(1.2);
  const [annotations, setAnnotations] = useState<readonly WorkspacePdfAnnotationDto[]>([]);
  const [pageTexts, setPageTexts] = useState<readonly string[]>([]);
  const [query, setQuery] = useState('');
  const [selectedQuote, setSelectedQuote] = useState('');
  const [status, setStatus] = useState('Carregando PDF…');
  const canvas = useRef<HTMLCanvasElement>(null);
  const textLayer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const task = (async (): Promise<void> => {
      const [pdf, stored] = await Promise.all([
        window.academic.library.pdf({ referenceId }),
        window.academic.library.pdfAnnotations({ referenceId }),
      ]);
      if (cancelled) return;
      if (!pdf.ok) { setStatus(pdf.error.message); return; }
      if (stored.ok) setAnnotations(stored.value);
      const loading = getDocument({ data: decodeBase64(pdf.value.base64) });
      const loaded = await loading.promise;
      if (cancelled) { await loaded.destroy(); return; }
      setDocument(loaded);
      setStatus(`${loaded.numPages} páginas`);
      const texts = await Promise.all(Array.from({ length: loaded.numPages }, async (_unused, index) => {
        const content = await (await loaded.getPage(index + 1)).getTextContent();
        return content.items.map((item) => 'str' in item ? item.str : '').join(' ');
      }));
      if (!cancelled) setPageTexts(texts);
    })().catch(() => { if (!cancelled) setStatus('Não foi possível abrir este PDF.'); });
    return () => { cancelled = true; void task; };
  }, [referenceId]);

  useEffect(() => () => { void document?.destroy(); }, [document]);

  useEffect(() => {
    if (document === undefined || canvas.current === null || textLayer.current === null) return undefined;
    let cancelled = false;
    const render = async (): Promise<void> => {
      const page = await document.getPage(pageNumber);
      if (cancelled || canvas.current === null || textLayer.current === null) return;
      const viewport = page.getViewport({ scale: zoom });
      const target = canvas.current;
      const density = window.devicePixelRatio || 1;
      target.width = Math.floor(viewport.width * density);
      target.height = Math.floor(viewport.height * density);
      target.style.width = `${viewport.width}px`;
      target.style.height = `${viewport.height}px`;
      const context = target.getContext('2d');
      if (context === null) return;
      context.setTransform(density, 0, 0, density, 0, 0);
      await page.render({ canvas: target, canvasContext: context, viewport }).promise;
      if (cancelled || textLayer.current === null) return;
      const layer = textLayer.current;
      layer.replaceChildren();
      layer.style.width = `${viewport.width}px`;
      layer.style.height = `${viewport.height}px`;
      const text = new TextLayer({ textContentSource: await page.getTextContent(), container: layer, viewport });
      await text.render();
      const spans = text.textDivs;
      const source = spans.map((span) => span.textContent ?? '').join(' ');
      for (const annotation of annotations.filter((item) => item.page === pageNumber)) {
        const expected = normalize(annotation.quote);
        const at = normalize(source).indexOf(expected);
        if (at < 0) continue;
        let offset = 0;
        for (const span of spans) {
          const value = normalize(span.textContent ?? '');
          const end = offset + value.length;
          if (end > at && offset < at + expected.length) span.classList.add('folio-pdf-highlight');
          offset = end + 1;
        }
      }
    };
    void render().catch(() => setStatus('Não foi possível renderizar esta página.'));
    return () => { cancelled = true; };
  }, [annotations, document, pageNumber, zoom]);

  const matches = useMemo(() => query.trim() === '' ? [] : pageTexts.flatMap((text, index) => normalize(text).includes(normalize(query)) ? [index + 1] : []), [pageTexts, query]);
  const currentAnnotations = annotations.filter((annotation) => annotation.page === pageNumber);

  const captureSelection = (): void => {
    const quote = window.getSelection()?.toString().replace(/\s+/gu, ' ').trim() ?? '';
    if (quote !== '') setSelectedQuote(quote);
  };
  const createAnnotation = async (): Promise<void> => {
    if (selectedQuote === '') return;
    const comment = window.prompt('Comentário sobre o destaque (opcional):', '') ?? undefined;
    const result = await window.academic.library.createPdfAnnotation({ referenceId, page: pageNumber, quote: selectedQuote, ...(comment?.trim() === '' || comment === undefined ? {} : { comment }) });
    if (!result.ok) { setStatus(result.error.message); return; }
    setAnnotations((current) => [...current, result.value]);
    setSelectedQuote('');
  };
  const linkToNote = async (annotation: WorkspacePdfAnnotationDto): Promise<void> => {
    const result = await window.academic.library.linkPdfAnnotation({ referenceId, id: annotation.id });
    if (!result.ok) { setStatus(result.error.message); return; }
    setAnnotations((current) => current.map((item) => item.id === annotation.id ? result.value.annotation : item));
    onOpenLiteratureNote(result.value.literatureNote.fileId, result.value.literatureNote.path);
  };
  const removeAnnotation = async (annotation: WorkspacePdfAnnotationDto): Promise<void> => {
    const result = await window.academic.library.removePdfAnnotation({ referenceId, id: annotation.id });
    if (!result.ok) { setStatus(result.error.message); return; }
    setAnnotations((current) => current.filter((item) => item.id !== annotation.id));
  };

  return <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/75 p-4"><section role="dialog" aria-modal="true" aria-labelledby="pdf-reader-title" className="grid h-[min(92vh,64rem)] w-full max-w-[88rem] grid-cols-[10rem_minmax(0,1fr)_19rem] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"><aside className="overflow-auto border-r border-slate-200 bg-slate-50 p-3"><h2 id="pdf-reader-title" className="text-sm font-bold text-slate-800">PDF de pesquisa</h2><p className="mt-1 text-xs text-slate-500">{status}</p><div className="mt-3 grid gap-2">{document !== undefined && Array.from({ length: document.numPages }, (_unused, index) => <PdfThumbnail key={index} document={document} pageNumber={index + 1} active={pageNumber === index + 1} onOpen={() => setPageNumber(index + 1)} />)}</div></aside><main className="grid min-w-0 grid-rows-[auto_minmax(0,1fr)]"><header className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2"><button type="button" className="folio-control px-2 py-1 text-xs" disabled={pageNumber <= 1} onClick={() => setPageNumber((page) => page - 1)}>←</button><span className="text-xs font-semibold text-slate-600">Página <input aria-label="Ir para página" type="number" min={1} max={document?.numPages ?? 1} value={pageNumber} onChange={(event) => setPageNumber(Math.max(1, Math.min(document?.numPages ?? 1, Number(event.target.value) || 1)))} className="mx-1 w-12 rounded border border-slate-200 px-1 py-0.5 text-center" /> de {document?.numPages ?? '—'}</span><button type="button" className="folio-control px-2 py-1 text-xs" disabled={document === undefined || pageNumber >= document.numPages} onClick={() => setPageNumber((page) => page + 1)}>→</button><span className="mx-1 h-5 w-px bg-slate-200" /><button type="button" className="folio-control px-2 py-1 text-xs" onClick={() => setZoom((value) => Math.max(0.65, value - 0.15))}>−</button><span className="text-xs text-slate-500">{Math.round(zoom * 100)}%</span><button type="button" className="folio-control px-2 py-1 text-xs" onClick={() => setZoom((value) => Math.min(2.4, value + 0.15))}>+</button><label className="ml-auto flex items-center gap-2 text-xs text-slate-500">Buscar <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="texto no PDF" className="w-40 rounded border border-slate-200 px-2 py-1" /></label>{matches.length > 0 && <span className="text-xs text-indigo-600">{matches.length} página(s)</span>}<button type="button" className="folio-control ml-2 grid h-8 w-8 place-items-center text-lg" aria-label="Fechar leitor PDF" onClick={onClose}>×</button></header><div className="relative min-h-0 overflow-auto bg-slate-100 p-8"><div className="relative mx-auto w-fit bg-white shadow-xl" onMouseUp={captureSelection}><canvas ref={canvas} className="block" /><div ref={textLayer} className="textLayer folio-pdf-text-layer" /></div></div></main><aside className="overflow-auto border-l border-slate-200 bg-slate-50 p-4"><h3 className="text-sm font-bold text-slate-800">Anotações</h3>{selectedQuote !== '' && <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50 p-3"><p className="line-clamp-5 text-xs leading-5 text-indigo-950">“{selectedQuote}”</p><button type="button" className="folio-primary mt-2 rounded-lg px-2 py-1 text-xs font-semibold" onClick={() => void createAnnotation()}>Criar destaque</button></div>}{matches.length > 0 && <div className="mt-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Busca</p><div className="mt-1 flex flex-wrap gap-1">{matches.map((page) => <button key={page} type="button" className="rounded bg-white px-2 py-1 text-xs text-indigo-700 ring-1 ring-slate-200" onClick={() => setPageNumber(page)}>p. {page}</button>)}</div></div>}<div className="mt-4 grid gap-2">{currentAnnotations.length === 0 ? <p className="text-sm text-slate-500">Selecione um trecho da página para criar um destaque.</p> : currentAnnotations.map((annotation) => <article key={annotation.id} className="rounded-lg border border-slate-200 bg-white p-3"><p className="text-xs leading-5 text-slate-700">“{annotation.quote}”</p>{annotation.comment !== undefined && <p className="mt-2 text-xs text-slate-500">{annotation.comment}</p>}<div className="mt-2 flex flex-wrap gap-2"><button type="button" className="text-xs font-semibold text-indigo-700" onClick={() => void linkToNote(annotation)}>{annotation.literatureNoteFileId === undefined ? 'Enviar para nota' : 'Abrir nota'}</button><button type="button" className="text-xs font-semibold text-rose-600" onClick={() => void removeAnnotation(annotation)}>Remover</button></div></article>)}</div></aside></section></div>;
}
