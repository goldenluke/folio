import { describe, expect, it } from 'vitest';
import { createProtocol, evidenceTable, prismaFlow, qualityScore, recordDecision, screeningAgreement, validateExtraction } from '../packages/systematic-review/src/index.js';

describe('F167–F179 — revisão sistemática operacional', () => {
  it('guarda protocolo, estratégia e decisões independentes', () => {
    const protocol = createProtocol({ id: 'r', title: ' Revisão ', question: 'Qual efeito?', framework: 'pico', databases: [' Scopus ', 'Scopus'], searchStrategy: 'x', inclusionCriteria: [], exclusionCriteria: [] });
    expect(protocol.frameworkFields).toHaveProperty('population'); expect(protocol.databases).toEqual(['Scopus']);
    const study = recordDecision({ id: 's', title: 'Estudo', stage: 'title-screened', decisions: [] }, { reviewerId: 'a', decision: 'include', at: '2026-01-01' });
    expect(screeningAgreement([{ ...study, decisions: [...study.decisions, { reviewerId: 'b', decision: 'exclude', at: '2026-01-01' }] }]).conflicts).toHaveLength(1);
  });
  it('projeta extração, qualidade e PRISMA sem números manuais', () => {
    const fields = [{ id: 'n', label: 'Amostra', type: 'number', required: true }] as const;
    expect(validateExtraction(fields, [{ fieldId: 'n', value: '40' }])).toEqual(['Amostra deve ser numérico.']);
    const studies = [{ id: 'a', title: 'Incluído', stage: 'included', decisions: [] }, { id: 'b', title: 'Excluído', stage: 'excluded', decisions: [] }] as const;
    expect(prismaFlow(studies)).toMatchObject({ included: 1, excluded: 1 });
    expect(evidenceTable(studies, fields, { a: [{ fieldId: 'n', value: 40 }] })).toEqual([{ studyId: 'a', title: 'Incluído', values: { n: 40 } }]);
    expect(qualityScore([{ id: 'q', label: 'Risco' }], { studyId: 'a', answers: [{ itemId: 'q', value: 'yes' }] })).toEqual({ answered: 1, favorable: 1, total: 1 });
  });
});
