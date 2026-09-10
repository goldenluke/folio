/** Relações vêm das fontes já existentes; este pacote só compõe projeções. */
export interface Relation { readonly from: { readonly kind: string; readonly id: string }; readonly to: { readonly kind: string; readonly id: string }; readonly kind: 'cites' | 'annotates' | 'belongs-to-project' | 'uses-dataset' | 'evidence-for'; }
/** Vínculos portáteis que o host pode projetar sem tornar Views uma fonte de verdade. */
export interface AcademicRelationResource { readonly version: 1; readonly projects: readonly { readonly id: string; readonly documentIds: readonly string[]; readonly referenceIds: readonly string[] }[]; readonly datasets: readonly { readonly id: string; readonly documentIds: readonly string[]; readonly referenceIds: readonly string[] }[]; readonly evidence: readonly { readonly id: string; readonly documentIds: readonly string[]; readonly referenceIds: readonly string[] }[]; }
export function relationsFromResource(resource: AcademicRelationResource): readonly Relation[] {
  const relations: Relation[] = [];
  const add = (kind: Relation['kind'], entityKind: string, entity: { readonly id: string; readonly documentIds: readonly string[]; readonly referenceIds: readonly string[] }): void => {
    for (const id of entity.documentIds) { relations.push({ from: { kind: 'document', id }, to: { kind: entityKind, id: entity.id }, kind }); relations.push({ from: { kind: entityKind, id: entity.id }, to: { kind: 'document', id }, kind }); }
    for (const id of entity.referenceIds) { relations.push({ from: { kind: 'reference', id }, to: { kind: entityKind, id: entity.id }, kind }); relations.push({ from: { kind: entityKind, id: entity.id }, to: { kind: 'reference', id }, kind }); }
  };
  for (const project of resource.projects) add('belongs-to-project', 'project', project);
  for (const dataset of resource.datasets) add('uses-dataset', 'dataset', dataset);
  for (const evidence of resource.evidence) add('evidence-for', 'evidence', evidence);
  return relations;
}
export interface RelationColumn { readonly field: string; readonly targetKind?: string; }
export interface Rollup { readonly field: string; readonly relationKind: Relation['kind']; readonly operation: 'count' | 'unique-count'; }
export interface RelationRow { readonly id: string; readonly kind: string; readonly values: Readonly<Record<string, string | number | boolean | undefined>>; }
export function related(rows: readonly RelationRow[], relations: readonly Relation[], row: RelationRow, column: RelationColumn): readonly RelationRow[] { const ids = new Set(relations.filter((relation) => relation.from.id === row.id && (column.targetKind === undefined || relation.to.kind === column.targetKind)).map((relation) => relation.to.id)); return rows.filter((candidate) => ids.has(candidate.id)); }
export function rollup(relations: readonly Relation[], row: RelationRow, definition: Rollup): number { const matches = relations.filter((relation) => relation.from.id === row.id && relation.kind === definition.relationKind); return definition.operation === 'count' ? matches.length : new Set(matches.map((relation) => `${relation.to.kind}:${relation.to.id}`)).size; }
/** Linguagem mínima, determinística: literals, campos e operadores aritméticos. */
export function evaluateFormula(expression: string, values: Readonly<Record<string, number>>): number {
  const source = expression.trim(); if (!/^[\d\s+*/().A-Za-z_-]+$/u.test(source) || /[A-Za-z_][A-Za-z\d_]*\./u.test(source)) throw new Error('Fórmula contém sintaxe não permitida.');
  const substituted = source.replace(/[A-Za-z_][A-Za-z\d_]*/gu, (name) => { const value = values[name]; if (value === undefined || !Number.isFinite(value)) throw new Error(`Campo numérico ausente: ${name}.`); return String(value); });
  const tokens = substituted.match(/\d+(?:\.\d+)?|[()+*/-]/gu) ?? []; if (tokens.join('') !== substituted.replace(/\s+/gu, '')) throw new Error('Fórmula inválida.');
  let position = 0; const factor = (): number => { const token = tokens[position++]; if (token === '(') { const result = sum(); if (tokens[position++] !== ')') throw new Error('Parênteses inválidos.'); return result; } const value = Number(token); if (!Number.isFinite(value)) throw new Error('Fórmula inválida.'); return value; }; const product = (): number => { let value = factor(); while (tokens[position] === '*' || tokens[position] === '/') { const op = tokens[position++]!; const right = factor(); value = op === '*' ? value * right : value / right; } return value; }; const sum = (): number => { let value = product(); while (tokens[position] === '+' || tokens[position] === '-') { const op = tokens[position++]!; const right = product(); value = op === '+' ? value + right : value - right; } return value; }; const result = sum(); if (position !== tokens.length || !Number.isFinite(result)) throw new Error('Fórmula inválida.'); return result;
}
export function groupRows(rows: readonly RelationRow[], field: string): Readonly<Record<string, readonly RelationRow[]>> { const groups: Record<string, RelationRow[]> = {}; for (const row of rows) { const key = String(row.values[field] ?? '—'); (groups[key] ??= []).push(row); } return groups; }
export function chartSeries(rows: readonly RelationRow[], field: string): readonly { readonly label: string; readonly value: number }[] { return Object.entries(groupRows(rows, field)).map(([label, items]) => ({ label, value: items.length })).sort((a, b) => a.label.localeCompare(b.label)); }
export interface DashboardBlock { readonly id: string; readonly viewId: string; readonly kind: 'metric' | 'chart' | 'table'; readonly title: string; }
export function createDashboardBlock(block: DashboardBlock): DashboardBlock { if (block.id.trim() === '' || block.viewId.trim() === '' || block.title.trim() === '') throw new Error('Bloco de dashboard inválido.'); return block; }
