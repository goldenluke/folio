import { describe, expect, it } from 'vitest';

import { IdentifierResolverRegistry } from '../packages/scholarly-identifiers/src/index.js';
import { identifiersFromPdfText, reconcilePdfText } from '../packages/pdf-reconciliation/src/index.js';

describe('F429–F435 — reconciliação de PDF', () => {
  it('varre identificadores literais sem OCR e preserva tipos distintos', () => {
    const found = identifiersFromPdfText('DOI 10.1000/exemplo. PMID:12345678 arXiv:2601.12345v2 ISBN 978-85-12345-67-8');
    expect(found).toEqual(expect.arrayContaining([{ type: 'doi', value: '10.1000/exemplo' }, { type: 'pmid', value: '12345678' }, { type: 'arxiv', value: '2601.12345v2' }, { type: 'isbn', value: '9788512345678' }]));
  });

  it('produz candidato revisável e informa possível referência pai existente', async () => {
    const registry = new IdentifierResolverRegistry<{ id: string }>();
    registry.register({ type: 'doi', provider: 'crossref', async resolve(identifier) { return { identifier, entry: { id: 'silva2026' }, provenance: [{ field: 'title', provider: 'crossref', retrievedAt: '2026-09-10' }] }; } });
    const candidate = await reconcilePdfText('10.1000/exemplo', registry, (entry) => [entry.id]);
    expect(candidate.reviews[0]).toMatchObject({ duplicateIds: ['silva2026'], resolution: { provenance: [{ provider: 'crossref' }] } });
  });
});
