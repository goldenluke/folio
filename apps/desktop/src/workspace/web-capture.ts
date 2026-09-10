import {
  BUILTIN_WEB_CAPTURE_EXTRACTORS,
  WebCaptureExtractorRegistry,
  type WebCaptureCandidate,
} from '@abnt/web-capture';

export type FetchLike = (input: string, init?: RequestInit) => Promise<{
  readonly ok: boolean;
  readonly status: number;
  text(): Promise<string>;
}>;

/** Mesmo teto de `MAX_CAPTURE_BYTES` (browser-bridge.ts): nunca guarda uma página inteira sem limite. */
const MAX_HTML_CHARS = 4_000_000;

/** Provider explícito, nunca rede silenciosa — mesma régua de `resolveDoi`/`fetchFeedItems`. */
export async function fetchPageHtml(url: string, fetcher: FetchLike = globalThis.fetch.bind(globalThis) as FetchLike): Promise<string> {
  const response = await fetcher(url);
  if (!response.ok) throw new Error(`Não foi possível buscar a página (HTTP ${response.status}).`);
  const html = await response.text();
  if (html.length > MAX_HTML_CHARS) throw new Error('Página muito grande para extrair metadados.');
  return html;
}

/**
 * Hoje o host registra só os 5 extractors embutidos (Schema.org, citation
 * meta, Dublin Core, JSON-LD, DOI); o `.register()` do registry é o ponto de
 * extensão para um extractor específico de plugin no futuro, sem mudar este
 * arquivo nem o pacote `@abnt/web-capture`.
 */
export function buildWebCaptureRegistry(): WebCaptureExtractorRegistry {
  const registry = new WebCaptureExtractorRegistry();
  for (const extractor of BUILTIN_WEB_CAPTURE_EXTRACTORS) registry.register(extractor);
  return registry;
}

export async function extractWebCaptureCandidates(url: string, fetcher?: FetchLike): Promise<readonly WebCaptureCandidate[]> {
  const html = await fetchPageHtml(url, fetcher);
  return buildWebCaptureRegistry().extract(html, url);
}
