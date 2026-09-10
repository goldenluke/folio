import type { Relation } from '@abnt/academic-relations';
import { parseStructuredQuery } from '@abnt/language-service';

import { dashboardBlocks } from './derived-columns.js';
import {
  ACADEMIC_VIEW_LAYOUTS,
  ACADEMIC_VIEW_SOURCES,
  ACADEMIC_VIEW_SOURCE_DESCRIPTORS,
  type AcademicView,
  type AcademicViewColumn,
  type AcademicViewLayout,
  type AcademicViewSource,
  type AcademicViewsDocument,
  type DashboardViewBlock,
} from './model.js';

const RELATION_KINDS: readonly Relation['kind'][] = ['cites', 'annotates', 'belongs-to-project', 'uses-dataset', 'evidence-for'];

const has = <Value extends string>(values: readonly Value[], value: string): value is Value => values.includes(value as Value);
const nonEmpty = (value: string): boolean => value.trim().length > 0;

export function viewSourceDescriptor(source: AcademicViewSource) {
  return ACADEMIC_VIEW_SOURCE_DESCRIPTORS.find((descriptor) => descriptor.source === source)!;
}

/** Construtor que deixa explícita a separação entre query legível e Query AST. */
export function createAcademicView(input: Omit<AcademicView, 'version' | 'filter'> & { readonly filterQuery?: string }): AcademicView {
  const queryText = input.filterQuery?.trim();
  const view: AcademicView = {
    version: 1,
    id: input.id.trim(),
    name: input.name.trim(),
    source: input.source,
    layout: input.layout,
    ...(queryText === undefined || queryText === '' ? {} : { filter: { queryText, query: parseStructuredQuery(queryText) } }),
    ...(input.sort === undefined ? {} : { sort: input.sort }),
    ...(input.group === undefined ? {} : { group: input.group }),
    ...(input.columns === undefined ? {} : { columns: input.columns }),
  };
  validateAcademicView(view);
  return view;
}

export function validateAcademicView(view: AcademicView): void {
  if (view.version !== 1) throw new Error(`Versão de view acadêmica não suportada: ${String(view.version)}.`);
  if (!nonEmpty(view.id)) throw new Error('View acadêmica exige id.');
  if (!nonEmpty(view.name)) throw new Error('View acadêmica exige nome.');
  if (!has(ACADEMIC_VIEW_SOURCES, view.source)) throw new Error(`Fonte de view inválida: ${view.source}.`);
  if (!has(ACADEMIC_VIEW_LAYOUTS, view.layout)) throw new Error(`Layout de view inválido: ${view.layout}.`);
  if (!viewSourceDescriptor(view.source).layouts.includes(view.layout)) throw new Error(`Layout ${view.layout} não está disponível para ${view.source}.`);
  if (view.filter !== undefined && view.filter.queryText.trim() === '') throw new Error('Filtro de view não pode estar vazio.');
  const seenColumns = new Set<string>();
  for (const column of view.columns ?? []) {
    if (!nonEmpty(column.field)) throw new Error('Coluna de view exige campo.');
    if (seenColumns.has(column.field)) throw new Error(`Coluna duplicada: ${column.field}.`);
    if (column.width !== undefined && (!Number.isFinite(column.width) || column.width <= 0)) throw new Error(`Largura inválida para coluna ${column.field}.`);
    if (column.derived !== undefined) validateDerivedColumn(column);
    seenColumns.add(column.field);
  }
  for (const sorting of view.sort ?? []) if (!nonEmpty(sorting.field)) throw new Error('Ordenação de view exige campo.');
  if (view.group !== undefined && !nonEmpty(view.group.field)) throw new Error('Agrupamento de view exige campo.');
}

/**
 * Não sintaxe-valida `expression` aqui: erros de fórmula aparecem ao aplicar
 * a coluna (mesmo tratamento que `filter.query` já recebe hoje). Checa só o
 * que decide se a definição é estruturalmente coerente.
 */
function validateDerivedColumn(column: AcademicViewColumn): void {
  const derived = column.derived!;
  if (derived.kind === 'formula') {
    if (!nonEmpty(derived.expression)) throw new Error(`Fórmula vazia na coluna ${column.field}.`);
  } else if (derived.kind === 'rollup') {
    if (!RELATION_KINDS.includes(derived.relationKind)) throw new Error(`Tipo de relação inválido na coluna ${column.field}: ${derived.relationKind}.`);
    if (derived.operation !== 'count' && derived.operation !== 'unique-count') throw new Error(`Operação de rollup inválida na coluna ${column.field}.`);
  }
}

export function createAcademicViewsDocument(views: readonly AcademicView[] = [], dashboards: readonly DashboardViewBlock[] = []): AcademicViewsDocument {
  const seen = new Set<string>();
  for (const view of views) {
    validateAcademicView(view);
    if (seen.has(view.id)) throw new Error(`View acadêmica duplicada: ${view.id}.`);
    seen.add(view.id);
  }
  dashboardBlocks(dashboards);
  for (const block of dashboards) if (!seen.has(block.viewId)) throw new Error(`Bloco de dashboard aponta para view inexistente: ${block.viewId}.`);
  return { version: 1, views, ...(dashboards.length === 0 ? {} : { dashboards }) };
}

/** Revalida conteúdo lido de disco antes de ele chegar a qualquer UI. */
export function parseAcademicViewsDocument(input: unknown): AcademicViewsDocument {
  if (typeof input !== 'object' || input === null || (input as { version?: unknown }).version !== 1 || !Array.isArray((input as { views?: unknown }).views)) {
    throw new Error('Arquivo de views acadêmicas inválido.');
  }
  const record = input as { views: readonly unknown[]; dashboards?: readonly unknown[] };
  const views = record.views.map((candidate) => candidate as AcademicView);
  const dashboards = (record.dashboards ?? []).map((candidate) => candidate as DashboardViewBlock);
  return createAcademicViewsDocument(views, dashboards);
}

/** Ordem e visibilidade da primeira tabela; dados chegam de uma projeção do host. */
export function tableColumns(view: AcademicView): readonly AcademicViewColumn[] {
  if (view.layout !== 'table') throw new Error('Colunas tabulares só podem ser obtidas de uma view em tabela.');
  return (view.columns ?? []).filter((column) => column.visible !== false);
}

export function isAcademicViewLayout(value: string): value is AcademicViewLayout { return has(ACADEMIC_VIEW_LAYOUTS, value); }
