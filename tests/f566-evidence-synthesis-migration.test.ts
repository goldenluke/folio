import { describe, expect, it } from 'vitest';
import { migrateSystematicReview } from '@abnt/evidence-synthesis';

describe('BX.1 — migração para evidence synthesis', () => {
  const legacy = { version: 1 as const, protocol: { id: 'review-1', title: 'IA e educação', question: 'Qual o efeito?', databases: ['PubMed', 'Scopus'], searchStrategy: 'machine learning AND education', inclusionCriteria: ['Adultos'], exclusionCriteria: ['Resumo apenas'] }, searches: [{ id: 'run-1', database: 'PubMed', query: 'machine learning', searchedAt: '2026-09-12T00:00:00.000Z', resultCount: 12 }], studies: [{ id: 'study-1', referenceId: 'silva2024', title: 'Estudo original', stage: 'full-text', decisions: [{ reviewerId: 'ana', decision: 'include' as const, at: '2026-09-12T00:00:00.000Z' }] }] };
  it('separa record, work e evidence item sem duplicar a referência', () => {
    const migrated = migrateSystematicReview(legacy);
    expect(migrated.records[0]).toMatchObject({ referenceId: 'silva2024', workId: 'legacy-work:study-1' });
    expect(migrated.works[0]).toMatchObject({ referenceId: 'silva2024', fullText: 'manual-needed' });
    expect(migrated.evidenceItems[0]).toMatchObject({ workId: 'legacy-work:study-1', kind: 'study' });
  });
  it('é determinística e portanto idempotente', () => { expect(migrateSystematicReview(legacy)).toEqual(migrateSystematicReview(legacy)); });
});
