import { describe, expect, it } from 'vitest';
import { linkWorkReference, recordExtraction, type EvidenceSynthesis } from '@abnt/evidence-synthesis';

const synthesis: EvidenceSynthesis = {
  version: 1, sources: [], strategies: [], runs: [], inbox: [], records: [{ id: 'record', title: 'Texto', workId: 'work', identifiers: [] }],
  works: [{ id: 'work', title: 'Texto', recordIds: ['record'], artifactIds: ['artifact'], fullText: 'available' }],
  artifacts: [{ id: 'artifact', workId: 'work', attachmentId: 'attachment-1', kind: 'pdf' }],
  evidenceItems: [{ id: 'evidence', workId: 'work', label: 'Texto', kind: 'study' }], stages: [], criteria: [], decisions: [], extractions: [],
};

describe('F569 — BX.4 texto completo e extração auditável', () => {
  it('vincula uma obra à referência sem duplicar a biblioteca', () => {
    expect(linkWorkReference(synthesis, 'work', 'silva2026').works[0]).toMatchObject({ referenceId: 'silva2026' });
  });

  it('exige proveniência válida para uma extração ligada ao PDF', () => {
    const next = recordExtraction(synthesis, { id: 'extraction', evidenceItemId: 'evidence', fieldId: 'resultado', value: { kind: 'measure', value: 12, unit: '%' }, artifactId: 'artifact', page: 3, annotationId: 'annotation-1', reviewerId: 'ana', verifiedAt: '2026-09-12T00:00:00.000Z' });
    expect(next.extractions[0]).toMatchObject({ artifactId: 'artifact', page: 3, annotationId: 'annotation-1' });
    expect(() => recordExtraction(synthesis, { id: 'bad', evidenceItemId: 'evidence', fieldId: 'resultado', value: 'x', artifactId: 'missing', reviewerId: 'ana', verifiedAt: '2026-09-12T00:00:00.000Z' })).toThrow('Artefato');
  });
});
