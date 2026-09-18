const clean = (value) => value.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//iu, '').replace(/^doi:\s*/iu, '');
export function detectScholarlyIdentifier(input) {
    const value = clean(input);
    if (/^10\.\d{4,9}\/\S+$/iu.test(value))
        return { type: 'doi', value };
    const isbn = value.replace(/^(?:isbn(?:-1[03])?:?\s*)/iu, '').replace(/[\s-]/gu, '');
    if (/^(?:\d{9}[\dX]|\d{13})$/iu.test(isbn))
        return { type: 'isbn', value: isbn };
    const pmid = value.replace(/^pmid:\s*/iu, '');
    if (/^\d{5,9}$/u.test(pmid) && /^pmid:/iu.test(value))
        return { type: 'pmid', value: pmid };
    const arxiv = value.replace(/^arxiv:\s*/iu, '');
    if (/^(?:\d{4}\.\d{4,5}|[a-z-]+\/\d{7})(?:v\d+)?$/iu.test(arxiv) && /^arxiv:/iu.test(value))
        return { type: 'arxiv', value: arxiv };
    if (/^\d{4}[A-Za-z].{13}[A-Za-z]$/u.test(value))
        return { type: 'ads', value };
    return undefined;
}
export function detectScholarlyIdentifiers(input) {
    const seen = new Set();
    return input.split(/[\n,;]/u).flatMap((item) => { const identifier = detectScholarlyIdentifier(item); if (identifier === undefined || seen.has(`${identifier.type}:${identifier.value}`))
        return []; seen.add(`${identifier.type}:${identifier.value}`); return [identifier]; });
}
export class IdentifierResolverRegistry {
    #resolvers = new Map();
    register(resolver) { this.#resolvers.set(resolver.type, resolver); }
    async resolve(identifier) { const resolver = this.#resolvers.get(identifier.type); if (resolver === undefined)
        throw new Error(`Nenhum resolver configurado para ${identifier.type.toUpperCase()}.`); return resolver.resolve(identifier); }
    async review(input, duplicateIds) { const identifier = detectScholarlyIdentifier(input); return identifier === undefined ? { input, duplicateIds: [], error: 'Identificador acadêmico não reconhecido.' } : this.#review(input, identifier, duplicateIds); }
    async reviewBatch(input, duplicateIds) { return Promise.all(detectScholarlyIdentifiers(input).map((identifier) => this.#review(identifier.value, identifier, duplicateIds))); }
    async #review(input, identifier, duplicateIds) { try {
        const resolution = await this.resolve(identifier);
        return { input, identifier, resolution, duplicateIds: duplicateIds(resolution.entry) };
    }
    catch (error) {
        return { input, identifier, duplicateIds: [], error: error instanceof Error ? error.message : 'Não foi possível resolver o identificador.' };
    } }
}
//# sourceMappingURL=index.js.map