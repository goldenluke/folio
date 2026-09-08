import { importarCslJson } from '@abnt/bibliography';
import type { BibliographicEntity } from '@abnt/document-model';

export type FetchLike = (input: string, init?: RequestInit) => Promise<{
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}>;

const DOI = /^10\.\d{4,9}\/.+$/iu;

export const normalizeDoi = (value: string): string | undefined => {
  const raw = value.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//iu, '').replace(/^doi:\s*/iu, '');
  return DOI.test(raw) ? raw : undefined;
};

/**
 * O DTO externo de doi.org/Crossref jamais atravessa esta fronteira. O
 * resolver aceita apenas um item CSL-JSON e o normaliza pelo importador
 * canônico antes de devolvê-lo ao produto.
 */
export function bibliographicEntityFromDoiPayload(payload: unknown, doi: string): BibliographicEntity {
  const normalized = normalizeDoi(doi);
  if (normalized === undefined) throw new Error('DOI inválido.');
  // Content negotiation de DOI devolve um único objeto CSL-JSON, enquanto o
  // intercâmbio canônico aceita array ou registry. Empacotar aqui adapta o
  // provider sem tornar seu DTO o modelo interno.
  const imported = importarCslJson(JSON.stringify([payload]));
  const entry = Object.values(imported.references)[0];
  if (entry === undefined) throw new Error('O provedor não devolveu um item CSL-JSON válido.');
  return { ...entry, id: entry.id, ...(entry.DOI === undefined ? { DOI: normalized } : {}) };
}

export async function resolveDoi(
  doi: string,
  fetcher: FetchLike = globalThis.fetch.bind(globalThis) as FetchLike,
): Promise<BibliographicEntity> {
  const normalized = normalizeDoi(doi);
  if (normalized === undefined) throw new Error('DOI inválido.');
  const response = await fetcher(`https://doi.org/${encodeURIComponent(normalized)}`, {
    headers: { Accept: 'application/vnd.citationstyles.csl+json' },
  });
  if (!response.ok) throw new Error(`Não foi possível resolver o DOI (HTTP ${response.status}).`);
  return bibliographicEntityFromDoiPayload(await response.json(), normalized);
}
