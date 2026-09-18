import { describe, expect, it } from 'vitest';
import { evidenceMap, evidenceOverview, evidenceTable, exportEvidenceSynthesis, narrativeSynthesis, type EvidenceSynthesis } from '@abnt/evidence-synthesis';

const synthesis: EvidenceSynthesis = {
  version: 1, sources: [{ id: 'source', label: 'Base', kind: 'academic-database' }], strategies: [], runs: [], inbox: [],
  records: [{ id: 'record', title: 'Trabalho', workId: 'work', identifiers: [] }], works: [{ id: 'work', title: 'Trabalho', recordIds: ['record'], artifactIds: [], fullText: 'available' }],
  artifacts: [], evidenceItems: [{ id: 'evidence', workId: 'work', label: 'Trabalho', kind: 'study' }], stages: [], criteria: [], decisions: [],
  extractions: [{ id: 'x1', evidenceItemId: 'evidence', fieldId: 'resultado', value: 'positivo', reviewerId: 'ana', verifiedAt: '2026-09-12T00:00:00.000Z' }],
};

describe('F570 — BX.5 projeções e exportação', () => {
  it('deriva overview, narrativa, tabela e mapa sem persistir relatório paralelo', () => {
    expect(evidenceOverview(synthesis)).toMatchObject({ records: 1, fullTexts: 1, extractions: 1 });
    expect(narrativeSynthesis(synthesis)).toContain('1 registros');
    expect(evidenceTable(synthesis)[0]).toMatchObject({ evidenceItem: 'Trabalho', resultado: 'positivo' });
    expect(evidenceMap(synthesis)).toEqual([{ fieldId: 'resultado', count: 1 }]);
  });

  it('exporta dados tabulares e JSON para análise externa', () => {
    expect(exportEvidenceSynthesis(synthesis, 'csv')).toContain('resultado');
    expect(exportEvidenceSynthesis(synthesis, 'tsv')).toContain('\t');
    expect(JSON.parse(exportEvidenceSynthesis(synthesis, 'json'))).toMatchObject({ version: 1 });
  });
});
