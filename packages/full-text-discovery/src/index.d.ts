/** Onda BI (F447–F453). Descoberta de texto completo é sempre revisável: nenhum candidato vira anexo sozinho. */
export type FullTextLicense = 'open-access' | 'restricted' | 'unknown';
export type FullTextVersion = 'submitted' | 'accepted' | 'published';
export interface FullTextQuery {
    readonly doi?: string;
    readonly title?: string;
}
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
/** Provider malformado é bug do adapter, não do usuário: falha alto e cedo. */
export declare function createFullTextCandidate(input: CreateFullTextCandidateInput): FullTextCandidate;
/** Contrato explícito: cada provider é um adapter injetado, nunca uma chamada de rede embutida no pacote. */
export interface FullTextResolver {
    readonly provider: string;
    resolve(query: FullTextQuery): Promise<readonly FullTextCandidate[]>;
}
export interface FullTextResolverFailure {
    readonly provider: string;
    readonly message: string;
}
/** Resultado é só para revisão humana: baixar/anexar um candidato é uma ação separada e explícita do host. */
export interface FullTextReview {
    readonly query: FullTextQuery;
    readonly candidates: readonly FullTextCandidate[];
    readonly failures: readonly FullTextResolverFailure[];
}
export declare class FullTextDiscoveryRegistry {
    #private;
    register(resolver: FullTextResolver): void;
    /** Um provider que falha ou devolve lixo nunca derruba os demais nem vira erro silencioso: aparece em `failures`. */
    discover(query: FullTextQuery): Promise<FullTextReview>;
}
//# sourceMappingURL=index.d.ts.map