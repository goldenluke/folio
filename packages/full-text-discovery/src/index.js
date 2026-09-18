/** Onda BI (F447–F453). Descoberta de texto completo é sempre revisável: nenhum candidato vira anexo sozinho. */
const isHttpUri = (value) => /^https?:\/\//iu.test(value);
/** Provider malformado é bug do adapter, não do usuário: falha alto e cedo. */
export function createFullTextCandidate(input) {
    if (input.provider.trim() === '')
        throw new Error('Candidato de texto completo exige provider.');
    if (!isHttpUri(input.url))
        throw new Error('Candidato de texto completo exige URL HTTP(S).');
    if (!Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1)
        throw new Error('Confiança do candidato deve estar entre 0 e 1.');
    if (input.retrievedAt.trim() === '')
        throw new Error('Candidato de texto completo exige data de recuperação.');
    return {
        provider: input.provider, url: input.url, license: input.license, confidence: input.confidence, retrievedAt: input.retrievedAt,
        ...(input.version === undefined ? {} : { version: input.version }),
    };
}
function dedupeByUrl(candidates) {
    const byUrl = new Map();
    for (const candidate of candidates) {
        const existing = byUrl.get(candidate.url);
        if (existing === undefined || candidate.confidence > existing.confidence)
            byUrl.set(candidate.url, candidate);
    }
    return [...byUrl.values()].sort((left, right) => right.confidence - left.confidence);
}
export class FullTextDiscoveryRegistry {
    #resolvers = new Map();
    register(resolver) { this.#resolvers.set(resolver.provider, resolver); }
    /** Um provider que falha ou devolve lixo nunca derruba os demais nem vira erro silencioso: aparece em `failures`. */
    async discover(query) {
        if ((query.doi === undefined || query.doi.trim() === '') && (query.title === undefined || query.title.trim() === '')) {
            throw new Error('Busca de texto completo exige DOI ou título.');
        }
        const resolvers = [...this.#resolvers.values()];
        const settled = await Promise.allSettled(resolvers.map((resolver) => resolver.resolve(query)));
        const candidates = [];
        const failures = [];
        settled.forEach((result, index) => {
            const provider = resolvers[index].provider;
            if (result.status === 'rejected') {
                failures.push({ provider, message: result.reason instanceof Error ? result.reason.message : 'Falha ao consultar provider.' });
                return;
            }
            for (const candidate of result.value) {
                try {
                    candidates.push(createFullTextCandidate(candidate));
                }
                catch { /* candidato malformado do adapter: descarta, não corrompe a revisão */ }
            }
        });
        return { query, candidates: dedupeByUrl(candidates), failures };
    }
}
//# sourceMappingURL=index.js.map