export type SubmissionStatus = 'draft' | 'submitted' | 'under-review' | 'revision-requested' | 'accepted' | 'rejected';
export interface SubmissionAuthor { readonly name: string; readonly email?: string; readonly orcid?: string; readonly affiliation?: string; }
export interface SubmissionFile { readonly path: string; readonly role: 'manuscript' | 'figure' | 'supplementary' | 'metadata'; readonly sha256: string; }
export interface SubmissionPackage { readonly name: string; readonly files: readonly SubmissionFile[]; readonly metadata: Readonly<Record<string, string>>; }
export interface SubmissionAdapter { readonly id: string; readonly label: string; readonly capabilities: readonly ('package' | 'metadata-export' | 'status' | 'submit')[]; buildPackage(input: SubmissionPackage): Promise<SubmissionPackage>; metadata?(input: SubmissionPackage): Promise<Readonly<Record<string, string>>>; submit?(input: SubmissionPackage): Promise<{ readonly remoteId: string; readonly status: SubmissionStatus }>; status?(remoteId: string): Promise<SubmissionStatus>; checklist?(input: SubmissionPackage): readonly string[]; }
export interface SubmissionRecord { readonly id: string; readonly adapterId?: string; readonly status: SubmissionStatus; readonly package: SubmissionPackage; readonly rounds: readonly RevisionRound[]; }
export interface RevisionRound { readonly id: string; readonly createdAt: string; readonly commentIds: readonly string[]; readonly sourceRevision: string; readonly artifacts: readonly SubmissionFile[]; }
export const validOrcid = (value: string): boolean => /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/u.test(value.replace(/^https:\/\/orcid\.org\//u, ''));
export const normalizeOrcid = (value: string): string | undefined => {
  const id = value.trim().replace(/^https:\/\/orcid\.org\//u, '').toUpperCase();
  return validOrcid(id) ? `https://orcid.org/${id}` : undefined;
};
/** ORCID is identity metadata: it never writes a profile or calls a network API by itself. */
export const withOrcid = (author: SubmissionAuthor, value: string): SubmissionAuthor => {
  const orcid = normalizeOrcid(value);
  if (orcid === undefined) throw new Error('ORCID inválido.');
  return { ...author, orcid };
};
export function crossrefMetadata(input: { readonly title: string; readonly authors: readonly SubmissionAuthor[]; readonly abstract?: string; readonly keywords?: readonly string[]; readonly publicationDate?: string }): Readonly<Record<string, string>> { return { title: input.title, contributors: input.authors.map((author) => `${author.name}${author.orcid === undefined ? '' : ` [ORCID:${author.orcid.replace(/^https:\/\/orcid\.org\//u, '')}]`}`).join('; '), ...(input.abstract === undefined ? {} : { abstract: input.abstract }), ...(input.keywords === undefined ? {} : { keywords: input.keywords.join(', ') }), ...(input.publicationDate === undefined ? {} : { publication_date: input.publicationDate }) }; }
const xml = (value: string): string => value.replace(/[&<>"']/gu, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]!);
/** Artefato local para depósito/revisão; o transporte de registro DOI continua separado. */
export function crossrefDepositXml(input: { readonly title: string; readonly authors: readonly SubmissionAuthor[]; readonly abstract?: string; readonly publicationDate?: string }): string {
  const contributors = input.authors.filter((author) => author.name.trim() !== '').map((author) => `<person_name contributor_role="author" sequence="additional"><given_name>${xml(author.name)}</given_name>${author.orcid === undefined ? '' : `<ORCID>${xml(normalizeOrcid(author.orcid) ?? author.orcid)}</ORCID>`}</person_name>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<doi_batch version="5.3.1"><body><journal><journal_article publication_type="full_text"><titles><title>${xml(input.title)}</title></titles><contributors>${contributors}</contributors>${input.publicationDate === undefined ? '' : `<publication_date media_type="online"><year>${xml(input.publicationDate)}</year></publication_date>`}${input.abstract === undefined ? '' : `<abstract>${xml(input.abstract)}</abstract>`}</journal_article></journal></body></doi_batch>\n`;
}
/** Export-only adapter: Crossref registration stays behind a separately chosen transport. */
export const createCrossrefMetadataAdapter = (): SubmissionAdapter => ({
  id: 'crossref-metadata', label: 'Crossref metadata', capabilities: ['package', 'metadata-export'],
  async buildPackage(input) { return { ...input, metadata: { ...input.metadata, package_type: 'crossref-metadata' } }; },
  async metadata(input) { return { ...input.metadata, crossref_deposit: 'requires-provider' }; },
  checklist() { return ['Revise título, autores e ORCID.', 'Confirme o provider de depósito antes de registrar DOI.']; },
});
export interface OjsTransport {
  submit(input: SubmissionPackage): Promise<{ readonly remoteId: string; readonly status: SubmissionStatus }>;
  status(remoteId: string): Promise<SubmissionStatus>;
}
export interface OjsHttpResponse { readonly ok: boolean; readonly status: number; json(): Promise<unknown>; }
export type OjsFetch = (input: string, init?: { readonly method?: string; readonly headers?: Readonly<Record<string, string>>; readonly body?: string }) => Promise<OjsHttpResponse>;
export interface OjsHttpTransportOptions { readonly endpoint: string; readonly token: string; readonly fetch?: OjsFetch; }
/** Transporte REST mínimo para OJS; token vive somente no chamador, nunca no pacote ou vault. */
export function createOjsHttpTransport(options: OjsHttpTransportOptions): OjsTransport {
  const endpoint = options.endpoint.replace(/\/$/u, ''); const fetcher = options.fetch ?? (globalThis.fetch as unknown as OjsFetch);
  if (endpoint === '' || options.token.trim() === '' || fetcher === undefined) throw new Error('Conexão OJS exige endpoint, token e fetch.');
  const headers = { authorization: `Bearer ${options.token}`, 'content-type': 'application/json' };
  return {
    async submit(input) { const response = await fetcher(`${endpoint}/submissions`, { method: 'POST', headers, body: JSON.stringify(input) }); if (!response.ok) throw new Error(`OJS respondeu ${response.status}.`); const body = await response.json() as { readonly remoteId?: unknown; readonly status?: unknown }; if (typeof body.remoteId !== 'string' || !isSubmissionStatus(body.status)) throw new Error('Resposta de submissão OJS inválida.'); return { remoteId: body.remoteId, status: body.status }; },
    async status(remoteId) { const response = await fetcher(`${endpoint}/submissions/${encodeURIComponent(remoteId)}`, { headers }); if (!response.ok) throw new Error(`OJS respondeu ${response.status}.`); const body = await response.json() as { readonly status?: unknown }; if (!isSubmissionStatus(body.status)) throw new Error('Status OJS inválido.'); return body.status; },
  };
}
const isSubmissionStatus = (value: unknown): value is SubmissionStatus => value === 'draft' || value === 'submitted' || value === 'under-review' || value === 'revision-requested' || value === 'accepted' || value === 'rejected';
/** OJS only receives a caller-supplied transport, so auth and HTTP stay outside the domain. */
export const createOjsAdapter = (transport: OjsTransport): SubmissionAdapter => ({
  id: 'ojs', label: 'Open Journal Systems', capabilities: ['package', 'metadata-export', 'status', 'submit'],
  async buildPackage(input) { return { ...input, metadata: { ...input.metadata, package_type: 'ojs-submission' } }; },
  async metadata(input) { return { ...input.metadata, ojs_submission: 'ready' }; },
  submit: (input) => transport.submit(input),
  status: (remoteId) => transport.status(remoteId),
  checklist() { return ['Confirme os requisitos do periódico.', 'Revise os arquivos antes de enviar ao OJS.']; },
});
export const genericSubmissionZip = (name: string, files: readonly SubmissionFile[], metadata: Readonly<Record<string, string>>): SubmissionPackage => ({ name, files: [...files], metadata: { ...metadata } });
export const repositoryDepositPackage = (input: SubmissionPackage): SubmissionPackage => ({ ...input, metadata: { ...input.metadata, package_type: 'repository-deposit' } });
export const doiDepositPreparation = (metadata: Readonly<Record<string, string>>): Readonly<Record<string, string>> => ({ ...metadata, doi_registration: 'requires-provider' });
export function transitionSubmission(record: SubmissionRecord, status: SubmissionStatus): SubmissionRecord { const allowed: Readonly<Record<SubmissionStatus, readonly SubmissionStatus[]>> = { draft: ['submitted'], submitted: ['under-review', 'revision-requested', 'accepted', 'rejected'], 'under-review': ['revision-requested', 'accepted', 'rejected'], 'revision-requested': ['submitted'], accepted: [], rejected: [] }; if (!allowed[record.status].includes(status)) throw new Error(`Transição inválida: ${record.status} → ${status}.`); return { ...record, status }; }
export function addRevisionRound(record: SubmissionRecord, round: RevisionRound): SubmissionRecord { if (record.status !== 'revision-requested') throw new Error('Nova rodada só pode ser ligada a uma solicitação de revisão.'); return { ...record, rounds: [...record.rounds, round] }; }
