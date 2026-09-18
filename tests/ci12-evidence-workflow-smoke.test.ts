import { describe, expect, it } from 'vitest';
import { claimManuscriptDraft, claimProvenance, createEvidenceClaim, linkClaimEvidence, recordExtraction, reproducibilityPackage, type EvidenceSynthesis } from '@abnt/evidence-synthesis';

describe('CI.12 evidence-to-writing smoke', () => {
  it('percorre evidência → claim → proveniência → pacote', () => {
    const initial: EvidenceSynthesis = { version: 1, sources: [], strategies: [], runs: [], inbox: [], records: [], works: [{ id: 'work', title: 'Estudo local', recordIds: [], artifactIds: ['pdf'], fullText: 'available' }], artifacts: [{ id: 'pdf', workId: 'work', kind: 'pdf' }], evidenceItems: [{ id: 'finding', workId: 'work', label: 'Efeito observado', kind: 'finding' }], stages: [], criteria: [], decisions: [], extractions: [] };
    const withClaim = createEvidenceClaim(initial, { id: 'claim', workId: 'work', label: 'A intervenção produz efeito' });
    const linked = linkClaimEvidence(withClaim, { claimId: 'claim', evidenceItemId: 'finding', relation: 'supports', reviewerId: 'local', createdAt: '2026-01-01' });
    const extracted = recordExtraction(linked, { id: 'extraction', evidenceItemId: 'finding', fieldId: 'result', value: 'confirmado', artifactId: 'pdf', page: 3, reviewerId: 'local', verifiedAt: '2026-01-01' });
    const provenance = claimProvenance(extracted, 'claim'); const pack = reproducibilityPackage(extracted, '2026-01-01T00:00:00Z');
    expect(claimManuscriptDraft(extracted, 'claim')).toContain('Suportada'); expect(provenance[0]?.pages).toEqual([3]); expect(pack.claimRelations).toHaveLength(1); expect(pack.excludedPdfArtifacts).toEqual(['pdf']);
  });
});
