import { createElement, useEffect, useRef, useState, type JSX } from 'react';

import { FolioIcon } from './icons.js';
import type { WebCaptureCandidateDto } from '@abnt/protocol';
import type { ResearchContext } from '@abnt/research-context';

interface ResearchWebview extends HTMLElement {
  getURL(): string;
  getTitle(): string;
  canGoBack(): boolean;
  canGoForward(): boolean;
  goBack(): void;
  goForward(): void;
  reload(): void;
  loadURL(url: string): Promise<void>;
  executeJavaScript(script: string): Promise<unknown>;
}

export interface BrowserCapture {
  readonly url: string;
  readonly title?: string;
  readonly selection?: string;
}

interface BrowserPageContext {
  readonly origin: string;
  readonly hostname: string;
  readonly title: string;
  readonly secure: boolean;
}

const normalizeUrl = (input: string): string | undefined => {
  const value = input.trim();
  if (value === '') return undefined;
  const candidate = /^https?:\/\//iu.test(value) ? value : 'https://' + value;
  try {
    const url = new URL(candidate);
    return /^https?:$/iu.test(url.protocol) ? url.toString() : undefined;
  } catch {
    return undefined;
  }
};

type AcademicSearchProvider = 'Google Scholar' | 'OpenAlex' | 'Crossref';

export function ResearchBrowserPane({ initialUrl, onCapture, onMessage, onPageChange, onOpenDestination, onCite, researchContext, onResearchContextChange }: {
  readonly initialUrl: string;
  readonly onCapture: (capture: BrowserCapture) => void;
  readonly onMessage: (message: string) => void;
  readonly onPageChange: (page: { readonly url: string; readonly title: string }) => void;
  readonly onOpenDestination: (destination: 'captures' | 'library' | 'projects' | 'review' | 'queue') => void;
  readonly onCite?: (referenceId: string) => void;
  readonly researchContext?: ResearchContext;
  readonly onResearchContextChange?: (context: ResearchContext) => void;
}): JSX.Element {
  const browser = useRef<ResearchWebview>(null);
  const [address, setAddress] = useState(initialUrl);
  const [loadedUrl, setLoadedUrl] = useState(initialUrl);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState({ back: false, forward: false });
  const [context, setContext] = useState<BrowserPageContext | undefined>(researchContext === undefined ? undefined : { origin: researchContext.browserOrigin ?? initialUrl, hostname: researchContext.browserOrigin ?? initialUrl, title: researchContext.browserTitle ?? 'Pesquisa', secure: true });
  const [intelligence, setIntelligence] = useState<readonly WebCaptureCandidateDto[]>();
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<WebCaptureCandidateDto>();
  const [possibleDuplicates, setPossibleDuplicates] = useState<readonly string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const searchProvider: AcademicSearchProvider = 'Google Scholar';
  const [searchRuns, setSearchRuns] = useState<readonly { readonly id: string; readonly query: string; readonly url: string; readonly at: string; readonly persisted: boolean }[]>([]);
  const [contextOpen, setContextOpen] = useState(false);
  const sessionStorageKey = `folio.research-session:${initialUrl}`;
  const [researchSession, setResearchSession] = useState<{ readonly title: string; readonly startedAt: string; readonly endedAt?: string; readonly analyses: number; readonly captures: number } | undefined>(() => {
    try { const raw: unknown = JSON.parse(window.localStorage.getItem(sessionStorageKey) ?? 'null'); return raw !== null && typeof raw === 'object' && typeof (raw as { title?: unknown }).title === 'string' ? raw as { title: string; startedAt: string; analyses: number; captures: number } : undefined; } catch { return undefined; }
  });
  useEffect(() => { if (researchSession === undefined) window.localStorage.removeItem(sessionStorageKey); else window.localStorage.setItem(sessionStorageKey, JSON.stringify(researchSession)); }, [researchSession, sessionStorageKey]);
  const [citationChasing, setCitationChasing] = useState<string>();

  const refresh = (): void => {
    const view = browser.current;
    if (view === null) return;
    setLoadedUrl(view.getURL() || loadedUrl);
    setAddress(view.getURL() || loadedUrl);
    setHistory({ back: view.canGoBack(), forward: view.canGoForward() });
    const url = view.getURL() || loadedUrl;
    const title = view.getTitle().trim() || 'Navegador';
    try {
      const parsed = new URL(url);
    setContext({ origin: parsed.origin, hostname: parsed.hostname, title, secure: parsed.protocol === 'https:' });
    } catch {
      setContext(undefined);
    }
    onPageChange({ url, title });
  };

  useEffect(() => { onResearchContextChange?.(context === undefined ? {} : { browserOrigin: context.origin, browserTitle: context.title }); }, [context, onResearchContextChange]);

  useEffect(() => {
    const view = browser.current;
    if (view === null) return;
    const didNavigate = (): void => { setLoading(false); void view.executeJavaScript('window.scrollTo(0, 0)').catch(() => undefined); refresh(); };
    const started = (): void => setLoading(true);
    const failed = (event: Event): void => {
      const detail = event as Event & { errorDescription?: string; errorCode?: number };
      if (detail.errorCode === -3) return;
      setLoading(false);
      onMessage('Não foi possível abrir a página: ' + (detail.errorDescription ?? 'falha de navegação') + '.');
    };
    const willNavigate = (event: Event): void => {
      const detail = event as Event & { url?: string; preventDefault?: () => void };
      if (detail.url !== undefined && !/^https?:\/\//iu.test(detail.url)) { detail.preventDefault?.(); onMessage('Navegação bloqueada: apenas URLs HTTP(S) são permitidas.'); }
    };
    const newWindow = (event: Event): void => {
      const detail = event as Event & { preventDefault?: () => void };
      detail.preventDefault?.();
      onMessage('Abertura de nova janela bloqueada; use uma nova aba do Folio.');
    };
    view.addEventListener('did-navigate', didNavigate);
    view.addEventListener('did-navigate-in-page', didNavigate);
    view.addEventListener('did-start-loading', started);
    view.addEventListener('did-stop-loading', didNavigate);
    view.addEventListener('did-fail-load', failed);
    view.addEventListener('will-navigate', willNavigate);
    view.addEventListener('new-window', newWindow);
    return () => {
      view.removeEventListener('did-navigate', didNavigate);
      view.removeEventListener('did-navigate-in-page', didNavigate);
      view.removeEventListener('did-start-loading', started);
      view.removeEventListener('did-stop-loading', didNavigate);
      view.removeEventListener('did-fail-load', failed);
      view.removeEventListener('will-navigate', willNavigate);
      view.removeEventListener('new-window', newWindow);
    };
  }, [loadedUrl, onMessage, onPageChange]);

  const navigate = (): void => {
    const url = normalizeUrl(address);
    if (url === undefined) { onMessage('Informe uma URL HTTP(S) válida.'); return; }
    setLoading(true); setLoadedUrl(url);
    void browser.current?.loadURL(url).catch(() => { setLoading(false); });
  };
  const capture = async (): Promise<void> => {
    const view = browser.current;
    if (view === null) return;
    try {
      const value = await view.executeJavaScript('({ title: document.title, selection: window.getSelection()?.toString().trim() || undefined })');
      const metadata = value !== null && typeof value === 'object' ? value as { title?: unknown; selection?: unknown } : {};
      onCapture({ url: view.getURL(), ...(typeof metadata.title === 'string' && metadata.title.trim() !== '' ? { title: metadata.title.trim() } : {}), ...(typeof metadata.selection === 'string' && metadata.selection.trim() !== '' ? { selection: metadata.selection.trim() } : {}) });
    } catch {
      onCapture({ url: view.getURL() });
    }
  };
  const analyzePage = async (): Promise<void> => {
    const view = browser.current;
    if (view === null || !context?.origin) return;
    setAnalyzing(true);
    try {
      const raw = await view.executeJavaScript('document.documentElement.outerHTML');
      const html = typeof raw === 'string' ? raw : '';
      const result = await window.academic.workspace.webCaptureExtract({ url: view.getURL(), html });
      if (!result.ok) { onMessage(result.error.message); setIntelligence([]); return; }
      setIntelligence(result.value.candidates); setSelectedCandidate(result.value.candidates[0]);
      const matchingRun = searchRuns.find((run) => run.url === view.getURL());
      if (matchingRun !== undefined) {
        const reviewResult = await window.academic.research.systematicReview();
        if (reviewResult.ok) {
          const updatedSearches = (reviewResult.value.searches ?? []).map((search) => search.id === matchingRun.id ? { ...search, resultCount: result.value.candidates.length } : search);
          await window.academic.research.setSystematicReview({ review: { ...reviewResult.value, searches: updatedSearches } });
        }
      }
      const library = await window.academic.library.list({});
      if (library.ok) {
        const duplicateIds = library.value.filter((entry) => result.value.candidates.some((candidate) => {
          const doi = candidate.fields.DOI?.trim().toLowerCase();
          const title = candidate.fields.title?.trim().toLowerCase();
          return (doi !== undefined && doi !== '' && doi === entry.DOI?.trim().toLowerCase()) ||
            (title !== undefined && title !== '' && title === entry.title?.trim().toLowerCase());
        })).map((entry) => String(entry.id));
        setPossibleDuplicates([...new Set(duplicateIds)]);
      } else setPossibleDuplicates([]);
      setResearchSession((session) => session === undefined ? session : { ...session, analyses: session.analyses + 1 });
    } catch { onMessage('Não foi possível analisar esta página.'); setIntelligence([]); }
    finally { setAnalyzing(false); }
  };

  const openDetectedPdf = async (url: string): Promise<void> => {
    const normalized = normalizeUrl(url);
    if (normalized === undefined) { onMessage('O PDF detectado não possui uma URL HTTP(S) válida.'); return; }
    setAddress(normalized);
    setLoadedUrl(normalized);
    setIntelligence(undefined);
    setSelectedCandidate(undefined);
    setPossibleDuplicates([]);
    setLoading(true);
    try {
      await browser.current?.loadURL(normalized);
      onMessage('PDF detectado aberto na aba nativa de pesquisa.');
    } catch {
      setLoading(false);
      onMessage('Não foi possível abrir o PDF detectado.');
    }
  };
  const handoffDetectedPdf = (url: string): void => {
    if (selectedCandidate === undefined) return;
    onCapture({ url, title: selectedCandidate.fields.title ?? context?.title ?? 'PDF acadêmico', selection: `PDF acadêmico detectado: ${url}` });
    onMessage('PDF enviado para revisão na Capture Inbox. O download só ocorre após confirmação.');
  };
  const persistSearchRun = async (query: string, url: string, database: AcademicSearchProvider): Promise<string> => {
    const id = crypto.randomUUID();
    const searchedAt = new Date().toISOString();
    const current = await window.academic.research.systematicReview();
    if (!current.ok) throw new Error(current.error.message);
    const review = current.value;
    const search = { id, database, query, searchedAt, resultCount: 0 };
    const saved = await window.academic.research.setSystematicReview({ review: { ...review, searches: [...(review.searches ?? []), search] } });
    if (!saved.ok) throw new Error(saved.error.message);
    setSearchRuns((runs) => [{ id, query, url, at: searchedAt, persisted: true }, ...runs.filter((run) => run.query !== query)].slice(0, 8));
    onResearchContextChange?.({ searchRunId: id });
    return id;
  };
  const searchAcademic = (): void => {
    const query = searchQuery.trim();
    if (query === '') { onMessage('Informe o tema ou título da pesquisa.'); return; }
    const urls: Record<AcademicSearchProvider, string> = { 'Google Scholar': `https://scholar.google.com/scholar?q=${encodeURIComponent(query)}`, OpenAlex: `https://openalex.org/works?page=1&filter=default.search:${encodeURIComponent(query)}`, Crossref: `https://search.crossref.org/?q=${encodeURIComponent(query)}` };
    const providerUrl = urls[searchProvider];
    void persistSearchRun(query, providerUrl, searchProvider).catch((error: unknown) => onMessage(error instanceof Error ? error.message : 'Não foi possível registrar a busca.'));
    setAddress(providerUrl); setLoadedUrl(providerUrl); setLoading(true); setIntelligence(undefined); setSelectedCandidate(undefined); setPossibleDuplicates([]);
    void browser.current?.loadURL(providerUrl).catch(() => { setLoading(false); onMessage('Não foi possível abrir a busca acadêmica.'); });
  };
  const chaseCitations = (): void => {
    const subject = selectedCandidate?.fields.DOI ?? selectedCandidate?.fields.title;
    if (subject === undefined || subject.trim() === '') { onMessage('Selecione um candidato antes de buscar trabalhos relacionados.'); return; }
    const url = `https://scholar.google.com/scholar?q=${encodeURIComponent(subject)}&as_sdt=0%2C5`;
    setCitationChasing(subject);
    void persistSearchRun(`Relacionados: ${subject}`, url, 'Google Scholar').catch((error: unknown) => onMessage(error instanceof Error ? error.message : 'Não foi possível registrar a busca.'));
    setAddress(url); setLoadedUrl(url); setLoading(true); setIntelligence(undefined); setSelectedCandidate(undefined); setPossibleDuplicates([]);
    void browser.current?.loadURL(url).catch(() => { setLoading(false); onMessage('Não foi possível abrir trabalhos relacionados.'); });
  };
  const sendToResearch = (kind: 'evidence' | 'note'): void => {
    if (selectedCandidate === undefined) { onMessage('Selecione um candidato analisado antes de continuar.'); return; }
    if (possibleDuplicates.length > 0) onMessage(`Possível duplicata encontrada na biblioteca (${possibleDuplicates.length}). Revise antes de persistir.`);
    const title = selectedCandidate.fields.title ?? 'Candidato sem título';
    const doi = selectedCandidate.fields.DOI;
    const source = selectedCandidate.fields['container-title'];
    const details = [kind === 'evidence' ? 'Evidência bibliográfica' : 'Nota de pesquisa', title, ...(doi === undefined ? [] : [`DOI: ${doi}`]), ...(source === undefined ? [] : [`Fonte: ${source}`]), `URL: ${loadedUrl}`].join('\n');
    onCapture({ url: loadedUrl, title, selection: details });
    setResearchSession((session) => session === undefined ? session : { ...session, captures: session.captures + 1 });
    onMessage(kind === 'evidence' ? 'Evidência enviada para a Capture Inbox.' : 'Nota enviada para a Capture Inbox.');
  };

  const view = browser.current;
  const tag = createElement('webview', {
    ref: browser,
    src: loadedUrl,
    partition: 'folio-research-browser',
    allowpopups: 'false',
    autosize: 'on',
    minheight: '320',
    maxheight: '10000',
    minwidth: '320',
    maxwidth: '10000',
    useragent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    webpreferences: 'contextIsolation=yes, sandbox=yes, nodeIntegration=no',
    className: 'block h-full min-h-0 w-full bg-white',
    style: { display: 'block', width: '100%', height: '100%', minWidth: 0, minHeight: 0, flex: '1 1 auto' },
    'aria-label': 'Página web de pesquisa',
  });

  useEffect(() => {
    const view = browser.current;
    const parent = view?.parentElement;
    if (view === null || view === undefined || parent === null || parent === undefined) return;
    const root = view.closest('section[aria-label="Navegador de pesquisa"]');
    const header = root?.querySelector('header');
    if (root !== null && root !== undefined && header !== null && header !== undefined) {
      (root as HTMLElement).style.height = '100%';
      (root as HTMLElement).style.minHeight = '100vh';
      const position = (): void => {
        const height = header.getBoundingClientRect().height;
        (root as HTMLElement).style.position = 'relative';
        const bounds = (root as HTMLElement).getBoundingClientRect();
        parent.style.position = 'static';
        parent.style.height = '100%';
        parent.style.overflow = 'visible';
        parent.style.width = `${bounds.width}px`;
        view.style.position = 'absolute';
        view.style.top = `${height}px`;
        view.style.right = '0';
        view.style.bottom = '0';
        view.style.left = '0';
        view.style.width = `${bounds.width}px`;
        view.style.height = `${Math.max(0, bounds.height - height)}px`;
      };
      position();
      const observer = new ResizeObserver(position);
      observer.observe(header);
      observer.observe(root);
      return () => observer.disconnect();
    }
    parent.style.display = 'flex';
    parent.style.flex = '1 1 auto';
    parent.style.flexDirection = 'column';
    parent.style.minHeight = '0';
    parent.style.height = '100%';
    view.style.display = 'block';
    view.style.flex = '1 1 auto';
    view.style.width = '100%';
    view.style.height = '100%';
    view.style.minHeight = '0';
  }, []);

  const activeSearchRun = searchRuns.find((run) => run.url === loadedUrl);
  const sessionActive = researchSession !== undefined && researchSession.endedAt === undefined;
  return <section aria-label="Navegador de pesquisa" className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-white" data-search-run-id={activeSearchRun?.id ?? ''} data-research-session={sessionActive ? 'active' : 'inactive'} data-citation-chasing={citationChasing ?? ''}>
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex gap-1"><button type="button" aria-label="Voltar" disabled={!history.back} className="folio-control grid h-8 w-8 place-items-center rounded disabled:opacity-40" onClick={() => { browser.current?.goBack(); }}><FolioIcon name="back" /></button><button type="button" aria-label="Avançar" disabled={!history.forward} className="folio-control grid h-8 w-8 place-items-center rounded disabled:opacity-40" onClick={() => { browser.current?.goForward(); }}><FolioIcon name="forward" /></button><button type="button" aria-label="Recarregar" className="folio-control grid h-8 w-8 place-items-center rounded" onClick={() => browser.current?.reload()}>↻</button></div>
        <form className="flex min-w-[16rem] flex-1 gap-2" onSubmit={(event) => { event.preventDefault(); navigate(); }}><input value={address} onChange={(event) => setAddress(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500" aria-label="Endereço web" /><button type="submit" className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white">Ir</button></form>
        <button type="button" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50" disabled={loading || analyzing} onClick={() => void analyzePage()}>{analyzing ? 'Analisando…' : 'Analisar página'}</button>{selectedCandidate?.attachments.filter((attachment) => /\.pdf(?:[?#]|$)/iu.test(attachment.url)).map((attachment) => <span key={attachment.url} className="inline-flex gap-1"><button type="button" className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm font-semibold text-indigo-700" onClick={() => void openDetectedPdf(attachment.url)}>Abrir PDF</button><button type="button" className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-700" onClick={() => handoffDetectedPdf(attachment.url)}>Enviar PDF</button></span>)}<button type="button" className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm font-semibold text-indigo-700" onClick={() => void capture()}>{loading ? 'Carregando…' : 'Capturar'}</button>
        <nav aria-label="Destinos de pesquisa" className="flex items-center gap-1"><button type="button" title="Abrir Capturas" className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs font-semibold text-slate-700" onClick={() => onOpenDestination('captures')}>Capturas</button><button type="button" title="Abrir Biblioteca" className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs font-semibold text-slate-700" onClick={() => onOpenDestination('library')}>Biblioteca</button><button type="button" title="Abrir Projetos" className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs font-semibold text-slate-700" onClick={() => onOpenDestination('projects')}>Projetos</button><button type="button" title="Abrir revisão" className="rounded-lg border border-indigo-200 bg-white px-2 py-2 text-xs font-semibold text-indigo-700" onClick={() => onOpenDestination('review')}>Revisão</button><button type="button" title="Abrir fila de leitura" className="rounded-lg border border-amber-200 bg-white px-2 py-2 text-xs font-semibold text-amber-700" onClick={() => onOpenDestination('queue')}>Fila</button></nav>
        <form aria-label="Busca acadêmica" className="flex min-w-[14rem] max-w-sm flex-1 gap-1" onSubmit={(event) => { event.preventDefault(); searchAcademic(); }}><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Buscar artigos…" aria-label="Tema da busca acadêmica" className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs outline-none focus:border-indigo-500" /><button type="submit" className="rounded-lg border border-indigo-200 bg-white px-2 py-2 text-xs font-semibold text-indigo-700">Buscar</button></form>{searchRuns.length > 0 && <details className="relative"><summary className="cursor-pointer list-none rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs font-semibold text-slate-700">Buscas ({searchRuns.length})</summary><div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-xl"><p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Search Runs desta sessão</p>{searchRuns.map((run) => <button type="button" key={run.at} className="block w-full truncate rounded-lg px-2 py-2 text-left text-xs text-slate-700 hover:bg-indigo-50" onClick={() => { setSearchQuery(run.query); setAddress(run.url); setLoadedUrl(run.url); setLoading(true); void browser.current?.loadURL(run.url); }}>{run.query}</button>)}</div></details>}
        <button type="button" disabled={selectedCandidate === undefined} className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40" onClick={chaseCitations}>Relacionados</button><button type="button" aria-expanded={contextOpen} className={`rounded-lg border px-2 py-2 text-xs font-semibold ${contextOpen ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-300 bg-white text-slate-700'}`} onClick={() => setContextOpen((open) => !open)}>Contexto</button>
        <button type="button" disabled={selectedCandidate === undefined} className="rounded-lg border border-emerald-200 bg-white px-2 py-2 text-xs font-semibold text-emerald-700 disabled:opacity-40" onClick={() => sendToResearch('evidence')}>Evidência</button><button type="button" disabled={selectedCandidate === undefined} className="rounded-lg border border-amber-200 bg-white px-2 py-2 text-xs font-semibold text-amber-700 disabled:opacity-40" onClick={() => sendToResearch('note')}>Nota</button>
        {researchSession !== undefined && <input aria-label="Título da sessão de pesquisa" value={researchSession.title} onChange={(event) => setResearchSession((session) => session === undefined ? session : { ...session, title: event.target.value })} className="min-w-32 max-w-48 rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs" />}
        <button type="button" className={`rounded-lg border px-2 py-2 text-xs font-semibold ${!sessionActive ? 'border-slate-300 bg-white text-slate-700' : 'border-emerald-300 bg-emerald-50 text-emerald-700'}`} onClick={() => { if (!sessionActive) { setResearchSession({ title: context?.title ?? 'Sessão de pesquisa', startedAt: new Date().toISOString(), analyses: 0, captures: 0 }); onMessage('Sessão de pesquisa iniciada.'); } else { setResearchSession((session) => session === undefined ? session : { ...session, endedAt: new Date().toISOString() }); onMessage('Sessão de pesquisa encerrada.'); } }}>{sessionActive ? 'Encerrar sessão' : researchSession === undefined ? 'Iniciar sessão' : 'Retomar sessão'}</button>
        <button type="button" disabled={selectedCandidate === undefined} className="rounded-lg border border-violet-200 bg-white px-2 py-2 text-xs font-semibold text-violet-700 disabled:opacity-40" onClick={() => { const candidate = selectedCandidate; if (candidate !== undefined) onCite?.(candidate.fields.DOI ?? candidate.fields.title ?? 'referencia'); }}>Citar</button>
      </header>
      {contextOpen && <aside aria-label="Sidebar de contexto da pesquisa" className="border-b border-indigo-100 bg-white px-4 py-3 text-xs shadow-sm"><div className="grid gap-3 sm:grid-cols-3"><div><p className="font-bold uppercase tracking-wide text-slate-400">Página</p><p className="mt-1 truncate font-semibold text-slate-800">{context?.title ?? 'Carregando'}</p><p className="truncate text-slate-500">{context?.origin ?? loadedUrl}</p></div><div><p className="font-bold uppercase tracking-wide text-slate-400">Candidato</p><p className="mt-1 truncate font-semibold text-slate-800">{selectedCandidate?.fields.title ?? 'Nenhum selecionado'}</p><p className="text-slate-500">{selectedCandidate === undefined ? 'Use Analisar página.' : `${selectedCandidate.attachments.length} anexo(s)`}</p></div><div><p className="font-bold uppercase tracking-wide text-slate-400">Destinos</p><div className="mt-1 flex flex-wrap gap-1"><button type="button" className="rounded border border-slate-200 px-2 py-1 text-indigo-700" onClick={() => onOpenDestination('captures')}>Capturas</button><button type="button" className="rounded border border-slate-200 px-2 py-1 text-indigo-700" onClick={() => onOpenDestination('library')}>Biblioteca</button><button type="button" className="rounded border border-slate-200 px-2 py-1 text-indigo-700" onClick={() => onOpenDestination('projects')}>Projetos</button></div></div></div></aside>}
      <div className="grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] bg-slate-100"><aside aria-label="Contexto da pesquisa" className="flex min-w-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-2 text-xs"><span className={`h-2 w-2 shrink-0 rounded-full ${context?.secure === true ? 'bg-emerald-500' : 'bg-slate-400'}`} aria-hidden="true" /><div className="min-w-0 flex-1"><strong className="block truncate text-slate-800">{context?.title ?? 'Página em carregamento'}</strong><span className="block truncate text-slate-500">{context?.hostname ?? 'Aguardando endereço'}{context?.origin === undefined ? '' : ` · ${context.origin}`}</span></div><span className="hidden shrink-0 rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-500 sm:inline">{context?.secure === true ? 'Conexão segura' : 'HTTP(S)'}</span></aside>{intelligence !== undefined && <section aria-label="Inteligência da página" className="max-h-72 overflow-auto border-b border-indigo-100 bg-indigo-50/80 px-4 py-3"><div className="flex items-center justify-between gap-3"><strong className="text-xs font-bold uppercase tracking-wide text-indigo-900">Inteligência da página</strong><span className="text-xs text-indigo-700">{intelligence.length} candidato(s)</span></div>{intelligence.length === 0 ? <p className="mt-2 text-sm text-indigo-800">Nenhuma metadata estruturada encontrada.</p> : <div className="mt-2 grid gap-2 md:grid-cols-2">{intelligence.slice(0, 4).map((candidate, index) => <button type="button" key={`${candidate.extractorId}-${index}`} onClick={() => setSelectedCandidate(candidate)} className={`min-w-0 rounded-lg border bg-white p-3 text-left ${selectedCandidate === candidate ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-indigo-100 hover:border-indigo-300'}`}><div className="flex items-center justify-between gap-2"><strong className="truncate text-sm text-slate-800">{candidate.fields.title ?? 'Candidato sem título'}</strong><span className="shrink-0 text-[10px] font-semibold text-indigo-600">{Math.round(candidate.quality * 100)}%</span></div>{candidate.fields.DOI !== undefined && <p className="mt-1 truncate text-xs text-slate-500">DOI: {candidate.fields.DOI}</p>}<p className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">{candidate.extractorId}</p></button>)}</div>}{selectedCandidate !== undefined && <article className="mt-3 rounded-xl border border-indigo-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wide text-indigo-600">Prévia estruturada</p><h3 className="mt-1 truncate font-bold text-slate-900">{selectedCandidate.fields.title ?? 'Sem título'}</h3></div><button type="button" className="text-xs text-slate-500" onClick={() => setSelectedCandidate(undefined)}>Fechar</button></div>{selectedCandidate.fields.author !== undefined && <p className="mt-2 text-sm text-slate-600">{selectedCandidate.fields.author.map((author) => author.literal ?? [author.given, author.family].filter(Boolean).join(' ')).join('; ')}</p>}{selectedCandidate.fields.DOI !== undefined && <p className="mt-1 text-xs text-slate-500">DOI: {selectedCandidate.fields.DOI}</p>}{selectedCandidate.fields['container-title'] !== undefined && <p className="mt-1 text-xs text-slate-500">{selectedCandidate.fields['container-title']}</p>}{selectedCandidate.attachments.length > 0 && <ul className="mt-2 grid gap-1 text-xs text-indigo-700">{selectedCandidate.attachments.map((attachment) => <li key={attachment.url} className="truncate">{attachment.label ?? 'Anexo'}: {attachment.url}</li>)}</ul>}<button type="button" className="mt-3 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white" onClick={() => { onCapture({ url: view?.getURL() ?? loadedUrl, ...(selectedCandidate.fields.title === undefined ? {} : { title: selectedCandidate.fields.title }) }); onMessage('Candidato enviado para revisão na inbox de capturas.'); }}>Enviar para revisão</button></article>}</section>}{tag}</div>
    </section>;
}
