import { describe, expect, it } from 'vitest';
import { academicChartSeries, applyDerivedColumns, applyViewColumns, createAcademicView, createAcademicViewsDocument, dashboardBlocks, groupedAcademicView, parseAcademicViewsDocument } from '../packages/academic-views/src/index.js';
describe('F301–F306 — relações dentro de Academic Views', () => {
  const rows = [{ id: 'r1', title: 'Referência', fields: { year: 2025, notes: 2 } }]; const relations = [{ from: { kind: 'reference', id: 'r1' }, to: { kind: 'annotation', id: 'a1' }, kind: 'annotates' as const }];
  it('acrescenta relation/rollup/formula como projeção', () => { const result = applyDerivedColumns(rows, relations, [{ kind: 'rollup', field: 'annotations', definition: { field: 'annotations', relationKind: 'annotates', operation: 'count' } }, { kind: 'formula', field: 'score', expression: 'annotations + notes', inputs: { annotations: 'annotations', notes: 'notes' } }]); expect(result[0]?.fields).toMatchObject({ annotations: 1, score: 3 }); });
  it('coluna relation resolve para uma lista legível de títulos, não uma contagem', () => {
    const linkedRows = [{ id: 'r1', title: 'Referência', fields: {} }, { id: 'a1', title: 'Anotação X', fields: {} }];
    const result = applyDerivedColumns(linkedRows, relations, [{ kind: 'relation', field: 'linkedAnnotations', definition: { field: 'linkedAnnotations', targetKind: 'annotation' } }]);
    expect(result[0]?.fields.linkedAnnotations).toBe('Anotação X');
    expect(result[1]?.fields.linkedAnnotations).toBe('');
  });
  it('applyViewColumns ignora colunas simples e só deriva as marcadas', () => {
    const columns = [{ field: 'notes' }, { field: 'annotations', derived: { kind: 'rollup' as const, relationKind: 'annotates' as const, operation: 'count' as const } }];
    const result = applyViewColumns(rows, relations, columns);
    expect(result[0]?.fields).toMatchObject({ notes: 2, annotations: 1 });
  });
  it('reutiliza a mesma projeção para agrupamento, gráfico e dashboard', () => { expect(groupedAcademicView(rows, 'year')['2025']).toHaveLength(1); expect(academicChartSeries(rows, 'year')).toEqual([{ label: '2025', value: 1 }]); expect(dashboardBlocks([{ id: 'b', viewId: 'v', title: 'Visão geral', kind: 'chart' }])).toHaveLength(1); });
  it('documento de views persiste e revalida dashboards, com checagem referencial', () => {
    const view = createAcademicView({ id: 'v1', name: 'Referências', source: 'references', layout: 'table' });
    const dashboards = [{ id: 'b1', viewId: 'v1', title: 'Total', kind: 'metric' as const }];
    const document = createAcademicViewsDocument([view], dashboards);
    const roundTripped = parseAcademicViewsDocument(JSON.parse(JSON.stringify(document)));
    expect(roundTripped.dashboards).toEqual(dashboards);
    expect(() => createAcademicViewsDocument([view], [{ id: 'b2', viewId: 'inexistente', title: 'Total', kind: 'metric' }])).toThrow('view inexistente');
  });
});
