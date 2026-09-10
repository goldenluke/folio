import { chartSeries, evaluateFormula, related, rollup, type Relation, type RelationRow, type Rollup } from '@abnt/academic-relations';
import type { AcademicViewRow } from './adapters.js';
import type { AcademicViewColumn, DashboardViewBlock } from './model.js';

export type DerivedColumn =
  | { readonly kind: 'rollup'; readonly field: string; readonly definition: Rollup }
  | { readonly kind: 'formula'; readonly field: string; readonly expression: string; readonly inputs: Readonly<Record<string, string>> }
  | { readonly kind: 'relation'; readonly field: string; readonly definition: { readonly field: string; readonly targetKind?: string } };
const relationRow = (row: AcademicViewRow): RelationRow => ({ id: row.id, kind: 'academic-entity', values: row.fields });
export function applyDerivedColumns(rows: readonly AcademicViewRow[], relations: readonly Relation[], columns: readonly DerivedColumn[]): readonly AcademicViewRow[] {
  const relationRows = rows.map(relationRow);
  return rows.map((row, index) => {
    const values: Record<string, string | number | boolean | undefined> = { ...row.fields };
    for (const column of columns) {
      if (column.kind === 'rollup') values[column.field] = rollup(relations, relationRows[index]!, column.definition);
      else if (column.kind === 'formula') {
        const inputs = Object.fromEntries(Object.entries(column.inputs).map(([name, field]) => [name, Number(values[field] ?? 0)]));
        values[column.field] = evaluateFormula(column.expression, inputs);
      } else {
        const matches = related(relationRows, relations, relationRows[index]!, column.definition);
        values[column.field] = matches.map((match) => rows.find((candidate) => candidate.id === match.id)?.title ?? match.id).join(', ');
      }
    }
    return { ...row, fields: values };
  });
}
/** Ponto único que a UI chama: traduz colunas de uma view em `DerivedColumn` e aplica. */
export function applyViewColumns(rows: readonly AcademicViewRow[], relations: readonly Relation[], columns: readonly AcademicViewColumn[]): readonly AcademicViewRow[] {
  const derived: DerivedColumn[] = [];
  for (const column of columns) {
    if (column.derived === undefined) continue;
    if (column.derived.kind === 'rollup') derived.push({ kind: 'rollup', field: column.field, definition: { field: column.field, relationKind: column.derived.relationKind, operation: column.derived.operation } });
    else if (column.derived.kind === 'formula') derived.push({ kind: 'formula', field: column.field, expression: column.derived.expression, inputs: column.derived.inputs });
    else derived.push({ kind: 'relation', field: column.field, definition: { field: column.field, ...(column.derived.targetKind === undefined ? {} : { targetKind: column.derived.targetKind }) } });
  }
  return derived.length === 0 ? rows : applyDerivedColumns(rows, relations, derived);
}
export function groupedAcademicView(rows: readonly AcademicViewRow[], field: string): Readonly<Record<string, readonly AcademicViewRow[]>> { const groups: Record<string, AcademicViewRow[]> = {}; for (const row of rows) { const key = String(row.fields[field] ?? '—'); (groups[key] ??= []).push(row); } return groups; }
export function academicChartSeries(rows: readonly AcademicViewRow[], field: string): readonly { readonly label: string; readonly value: number }[] { return chartSeries(rows.map(relationRow), field); }
export function dashboardBlocks(blocks: readonly DashboardViewBlock[]): readonly DashboardViewBlock[] { const ids = new Set<string>(); for (const block of blocks) { if (block.id.trim() === '' || block.viewId.trim() === '' || block.title.trim() === '' || ids.has(block.id)) throw new Error('Bloco de dashboard inválido.'); ids.add(block.id); } return blocks; }
