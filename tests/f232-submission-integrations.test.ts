import { describe, expect, it } from 'vitest';
import { addRevisionRound, createCrossrefMetadataAdapter, createOjsAdapter, createOjsHttpTransport, crossrefDepositXml, crossrefMetadata, doiDepositPreparation, genericSubmissionZip, normalizeOrcid, repositoryDepositPackage, transitionSubmission, validOrcid, withOrcid } from '../packages/submission-integrations/src/index.js';

describe('F232–F242 — integrações de submissão', () => {
  const packageFile = { path: 'artigo.pdf', role: 'manuscript', sha256: 'abc' } as const;
  it('prepara metadata, ORCID e pacotes sem enviar nada a terceiros', () => {
    expect(validOrcid('0000-0002-1825-0097')).toBe(true);
    expect(crossrefMetadata({ title: 'Artigo', authors: [{ name: 'Ana', orcid: '0000-0002-1825-0097' }] }).contributors).toContain('ORCID');
    expect(repositoryDepositPackage(genericSubmissionZip('entrega', [packageFile], {})).metadata.package_type).toBe('repository-deposit');
    expect(doiDepositPreparation({ title: 'Artigo' }).doi_registration).toBe('requires-provider');
  });
  it('normaliza a identidade ORCID sem chamar um provider externo', () => {
    expect(normalizeOrcid('0000-0002-1825-0097')).toBe('https://orcid.org/0000-0002-1825-0097');
    expect(withOrcid({ name: 'Ana' }, 'https://orcid.org/0000-0002-1825-0097').orcid).toContain('orcid.org');
    expect(normalizeOrcid('inválido')).toBeUndefined();
  });
  it('expõe Crossref como exportação e OJS apenas com transporte injetado', async () => {
    const input = genericSubmissionZip('artigo', [packageFile], { title: 'Artigo' });
    await expect(createCrossrefMetadataAdapter().metadata?.(input)).resolves.toMatchObject({ crossref_deposit: 'requires-provider' });
    const ojs = createOjsAdapter({ submit: async () => ({ remoteId: 'ojs-1', status: 'submitted' }), status: async () => 'under-review' });
    await expect(ojs.submit?.(input)).resolves.toEqual({ remoteId: 'ojs-1', status: 'submitted' });
    await expect(ojs.status?.('ojs-1')).resolves.toBe('under-review');
  });
  it('gera XML Crossref local e conecta OJS somente com token fornecido pelo usuário', async () => {
    expect(crossrefDepositXml({ title: 'A & B', authors: [{ name: 'Ana', orcid: '0000-0002-1825-0097' }] })).toContain('<title>A &amp; B</title>');
    const transport = createOjsHttpTransport({ endpoint: 'https://ojs.example/api', token: 'secret', fetch: async () => ({ ok: true, status: 200, json: async () => ({ remoteId: '42', status: 'submitted' }) }) });
    await expect(transport.submit(genericSubmissionZip('artigo', [packageFile], {}))).resolves.toEqual({ remoteId: '42', status: 'submitted' });
  });
  it('modela status e rounds sem inventar uma API externa', () => {
    const submitted = transitionSubmission({ id: 's', status: 'draft', package: genericSubmissionZip('x', [packageFile], {}), rounds: [] }, 'submitted');
    const requested = transitionSubmission(submitted, 'revision-requested');
    expect(addRevisionRound(requested, { id: 'r', createdAt: '2026-01-01', commentIds: ['c'], sourceRevision: 'rev', artifacts: [packageFile] }).rounds).toHaveLength(1);
  });
});
