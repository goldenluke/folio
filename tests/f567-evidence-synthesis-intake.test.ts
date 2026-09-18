import { describe, expect, it } from 'vitest';
import { addCandidatesToInbox, compileSearchQuery, parseEvidenceCandidates, type EvidenceSynthesis } from '@abnt/evidence-synthesis';

const empty: EvidenceSynthesis = { version: 1, sources: [], strategies: [], runs: [], inbox: [], records: [], works: [], artifacts: [], evidenceItems: [], stages: [], criteria: [], decisions: [], extractions: [] };

describe('F567 — BX.2 busca reproduzível e inbox', () => {
  it('compila a AST somente dentro das capacidades declaradas pelo provider', () => {
    expect(compileSearchQuery({ operator: 'and', terms: ['academic writing', 'reproducibility'] }, { id: 'demo', supportsBoolean: true, supportsQuotedPhrases: true, supportedFields: ['title'] })).toBe('"academic writing" AND reproducibility');
    expect(compileSearchQuery({ operator: 'or', terms: ['one', 'two'] }, { id: 'limited', supportsBoolean: false, supportsQuotedPhrases: false, supportedFields: [] })).toBe('one two');
  });

  it('lê exportação RIS e mantém candidatos fora da biblioteca', () => {
    const candidates = parseEvidenceCandidates('TY  - JOUR\nTI  - Pesquisa reprodutível\nAU  - Silva, Ana\nPY  - 2026\nDO  - 10.1000/demo\nER  -', 'ris');
    const first = addCandidatesToInbox(empty, candidates, 'ris', '2026-09-12T12:00:00.000Z', 'run-1');
    const duplicate = addCandidatesToInbox(first, candidates, 'ris', '2026-09-12T12:00:00.000Z', 'run-1');
    expect(first.inbox).toHaveLength(1);
    expect(first.inbox[0]).toMatchObject({ title: 'Pesquisa reprodutível', identifiers: ['10.1000/demo'], runId: 'run-1' });
    expect(first.records).toHaveLength(0);
    expect(duplicate.inbox).toHaveLength(1);
  });
});
