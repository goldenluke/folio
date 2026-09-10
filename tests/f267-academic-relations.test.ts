import { describe, expect, it } from 'vitest';
import { chartSeries, createDashboardBlock, evaluateFormula, groupRows, related, rollup, type RelationRow } from '../packages/academic-relations/src/index.js';
describe('F267–F273 — relações e rollups acadêmicos', () => {
  const rows: readonly RelationRow[] = [{ id: 'paper', kind: 'reference', values: { year: 2025, state: 'lendo' } }, { id: 'project', kind: 'project', values: { year: 2025, state: 'ativo' } }]; const relations = [{ from: { kind: 'reference', id: 'paper' }, to: { kind: 'project', id: 'project' }, kind: 'belongs-to-project' as const }];
  it('projeta relações e rollups sem gravar contadores na entidade', () => { expect(related(rows, relations, rows[0]!, { field: 'project', targetKind: 'project' })).toEqual([rows[1]]); expect(rollup(relations, rows[0]!, { field: 'projects', relationKind: 'belongs-to-project', operation: 'unique-count' })).toBe(1); });
  it('avalia apenas fórmula numérica determinística', () => { expect(evaluateFormula('(citations + notes) / 2', { citations: 4, notes: 2 })).toBe(3); expect(() => evaluateFormula('process.exit()', {})).toThrow('não permitida'); });
  it('reutiliza agrupamento para gráficos e dashboard declarativo', () => { expect(groupRows(rows, 'year')['2025']).toHaveLength(2); expect(chartSeries(rows, 'state')).toHaveLength(2); expect(createDashboardBlock({ id: 'b', viewId: 'v', kind: 'chart', title: 'Por estado' }).kind).toBe('chart'); });
});
