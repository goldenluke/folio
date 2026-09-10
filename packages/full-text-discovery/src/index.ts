/** Onda BI (F447–F453). Descoberta de texto completo é sempre revisável: nenhum candidato vira anexo sozinho. */

export type FullTextLicense = 'open-access' | 'restricted' | 'unknown';
export type FullTextVersion = 'submitted' | 'accepted' | 'published';

export interface FullTextQuery { readonly doi?: string; readonly title?: string; }

export interface FullTextCandidate {
  readonly provider: string;
  readonly url: string;
  readonly license: FullTextLicense;
  readonly version?: FullTextVersion;
  readonly confidence: number;
  readonly retrievedAt: string;
}

export interface CreateFullTextCandidateInput {
  readonly provider: string;
  readonly url: string;
  readonly license: FullTextLicense;
  readonly version?: FullTextVersion;
  readonly confidence: number;
  readonly retrievedAt: string;
}

const isHttpUri = (value: string): boolean => /^https?:\/\//iu.test(value);

/** Provider malformado é bug do adapter, não do usuário: falha alto e cedo. */
export function createFullTextCandidate(input: CreateFullTextCandidateInput): FullTextCandidate {
  if (input.provider.trim() === '') throw new Error('Candidato de texto completo exige provider.');
  if (!isHttpUri(input.url)) throw new Error('Candidato de texto completo exige URL HTTP(S).');
  if (!Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1) throw new Error('Confiança do candidato deve estar entre 0 e 1.');
  if (input.retrievedAt.trim() === '') throw new Error('Candidato de texto completo exige data de recuperação.');
  return {
    provider: input.provider, url: input.url, license: input.license, confidence: input.confidence, retrievedAt: input.retrievedAt,
    ...(input.version === undefined ? {} : { version: input.version }),
  };
}

/** Contrato explícito: cada provider é um adapter injetado, nunca uma chamada de rede embutida no pacote. */
export interface FullTextResolver {
  readonly provider: string;
  resolve(query: FullTextQuery): Promise<readonly FullTextCandidate[]>;
}

export interface FullTextResolverFailure { readonly provider: string; readonly message: string; }

/** Resultado é só para revisão humana: baixar/anexar um candidato é uma ação separada e explícita do host. */
export interface FullTextReview {
  readonly query: FullTextQuery;
  readonly candidates: readonly FullTextCandidate[];
  readonly failures: readonly FullTextResolverFailure[];
}

function dedupeByUrl(candidates: readonly FullTextCandidate[]): readonly FullTextCandidate[] {
  const byUrl = new Map<string, FullTextCandidate>();
  for (const candidate of candidates) {
    const existing = byUrl.get(candidate.url);
    if (existing === undefined || candidate.confidence > existing.confidence) byUrl.set(candidate.url, candidate);
  }
  return [...byUrl.values()].sort((left, right) => right.confidence - left.confidence);
}

export class FullTextDiscoveryRegistry {
  #resolvers = new Map<string, FullTextResolver>();

  register(resolver: FullTextResolver): void { this.#resolvers.set(resolver.provider, resolver); }

  /** Um provider que falha ou devolve lixo nunca derruba os demais nem vira erro silencioso: aparece em `failures`. */
  async discover(query: FullTextQuery): Promise<FullTextReview> {
    if ((query.doi === undefined || query.doi.trim() === '') && (query.title === undefined || query.title.trim() === '')) {
      throw new Error('Busca de texto completo exige DOI ou título.');
    }
    const resolvers = [...this.#resolvers.values()];
    const settled = await Promise.allSettled(resolvers.map((resolver) => resolver.resolve(query)));
    const candidates: FullTextCandidate[] = [];
    const failures: FullTextResolverFailure[] = [];
    settled.forEach((result, index) => {
      const provider = resolvers[index]!.provider;
      if (result.status === 'rejected') { failures.push({ provider, message: result.reason instanceof Error ? result.reason.message : 'Falha ao consultar provider.' }); return; }
      for (const candidate of result.value) {
        try { candidates.push(createFullTextCandidate(candidate)); } catch { /* candidato malformado do adapter: descarta, não corrompe a revisão */ }
      }
    });
    return { query, candidates: dedupeByUrl(candidates), failures };
  }
}
