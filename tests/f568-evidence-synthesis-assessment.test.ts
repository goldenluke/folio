import { describe, expect, it } from 'vitest';
import { admitInboxItem, assessmentState, createAssessmentStage, recordEvidenceDecision, reconcileEvidenceItem, type EvidenceSynthesis } from '@abnt/evidence-synthesis';

const base: EvidenceSynthesis = {
  version: 1, sources: [], strategies: [], runs: [],
  inbox: [{ id: 'inbox:1', title: 'Candidato', identifiers: [], importedAt: '2026-09-12T00:00:00.000Z', format: 'manual', rawHash: 'a1' }],
  records: [], works: [], artifacts: [], evidenceItems: [], stages: [], criteria: [], decisions: [], extractions: [],
};

describe('F568 — BX.3 avaliação configurável', () => {
  it('admite explicitamente candidatos e exige motivo na exclusão', () => {
    const stage = createAssessmentStage({ label: 'Elegibilidade', decisions: ['include', 'exclude', 'maybe'], reviewersRequired: 2, blind: true, exclusionReasonRequired: true });
    const admitted = admitInboxItem({ ...base, stages: [stage] }, 'inbox:1');
    expect(admitted.inbox).toHaveLength(0);
    expect(admitted.evidenceItems).toHaveLength(1);
    expect(() => recordEvidenceDecision(admitted, { evidenceItemId: admitted.evidenceItems[0]!.id, stageId: stage.id, reviewerId: 'a', decision: 'exclude', at: '2026-09-12T00:00:00.000Z' })).toThrow('motivo');
  });

  it('não resolve divergência por maioria: exige reconciliação explícita', () => {
    const stage = createAssessmentStage({ label: 'Triagem', decisions: ['include', 'exclude', 'maybe'], reviewersRequired: 2, blind: true, exclusionReasonRequired: false });
    const admitted = admitInboxItem({ ...base, stages: [stage] }, 'inbox:1');
    const itemId = admitted.evidenceItems[0]!.id;
    const conflicted = recordEvidenceDecision(recordEvidenceDecision(admitted, { evidenceItemId: itemId, stageId: stage.id, reviewerId: 'a', decision: 'include', at: '2026-09-12T00:00:00.000Z' }), { evidenceItemId: itemId, stageId: stage.id, reviewerId: 'b', decision: 'exclude', at: '2026-09-12T00:00:00.000Z' });
    expect(assessmentState(conflicted, itemId, stage.id)).toBe('conflict');
    const reconciled = reconcileEvidenceItem(conflicted, { evidenceItemId: itemId, stageId: stage.id, decision: 'include', reconciledBy: 'editor', reconciledAt: '2026-09-12T00:00:00.000Z', note: 'Discussão registrada.' });
    expect(assessmentState(reconciled, itemId, stage.id)).toBe('reconciled');
  });
});
