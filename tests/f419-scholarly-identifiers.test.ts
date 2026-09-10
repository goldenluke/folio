import { describe, expect, it } from 'vitest';

import { IdentifierResolverRegistry, detectScholarlyIdentifier, detectScholarlyIdentifiers } from '../packages/scholarly-identifiers/src/index.js';

describe('F419–F428 — identificadores acadêmicos universais', () => {
  it('detecta DOI, ISBN, PMID, arXiv e ADS sem confundir a identidade canônica', () => {
    expect(detectScholarlyIdentifier('https://doi.org/10.1000/ABC')).toEqual({ type: 'doi', value: '10.1000/ABC' });
    expect(detectScholarlyIdentifier('978-85-12345-67-8')).toEqual({ type: 'isbn', value: '9788512345678' });
    expect(detectScholarlyIdentifier('PMID:12345678')).toEqual({ type: 'pmid', value: '12345678' });
    expect(detectScholarlyIdentifier('arXiv:2601.12345v2')).toEqual({ type: 'arxiv', value: '2601.12345v2' });
    expect(detectScholarlyIdentifier('2024ApJ...123..456A')).toEqual({ type: 'ads', value: '2024ApJ...123..456A' });
  });

  it('revisa um lote por adapters e não confirma duplicatas silenciosamente', async () => {
    const registry = new IdentifierResolverRegistry<{ id: string; title: string }>();
    registry.register({ type: 'doi', provider: 'crossref', async resolve(identifier) { return { identifier, entry: { id: 'silva2026', title: 'Pesquisa' }, provenance: [{ field: 'title', provider: 'crossref', retrievedAt: '2026-09-10' }] }; } });
    const reviews = await registry.reviewBatch('10.1000/a\nPMID:12345678\n10.1000/a', (entry) => entry.id === 'silva2026' ? ['silva2025'] : []);
    expect(detectScholarlyIdentifiers('10.1000/a\nPMID:12345678\n10.1000/a')).toHaveLength(2);
    expect(reviews[0]).toMatchObject({ duplicateIds: ['silva2025'], resolution: { provenance: [{ provider: 'crossref' }] } });
    expect(reviews[1]?.error).toContain('PMID');
  });
});
