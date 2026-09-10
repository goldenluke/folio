import type { Relation } from '@abnt/academic-relations';
import type { QueryAst } from '@abnt/language-service';

/** Entidades que já possuem uma fonte de verdade no workspace. */
export const ACADEMIC_VIEW_SOURCES = [
  'documents',
  'references',
  'literature-notes',
  'projects',
  'datasets',
  'review-studies',
  'annotations',
] as const;

export type AcademicViewSource = (typeof ACADEMIC_VIEW_SOURCES)[number];

/** Layout é apresentação; trocar o layout não altera entidade alguma. */
export const ACADEMIC_VIEW_LAYOUTS = ['table', 'list', 'cards', 'board', 'calendar', 'timeline', 'chart'] as const;
export type AcademicViewLayout = (typeof ACADEMIC_VIEW_LAYOUTS)[number];

/**
 * Colunas derivadas são projeções determinísticas sobre relações já
 * conhecidas — nunca gravam contador, total ou vínculo como campo canônico
 * da entidade. Ver ADR 0070.
 */
export type AcademicViewDerivedColumn =
  | { readonly kind: 'rollup'; readonly relationKind: Relation['kind']; readonly operation: 'count' | 'unique-count' }
  | { readonly kind: 'formula'; readonly expression: string; readonly inputs: Readonly<Record<string, string>> }
  | { readonly kind: 'relation'; readonly targetKind?: string };

export interface AcademicViewFilter {
  /** Texto preservado para reabrir e editar a busca exatamente como foi escrita. */
  readonly queryText: string;
  /** AST derivada do texto, persistida por ser JSON puro e sem executar código. */
  readonly query: QueryAst;
}

export interface AcademicViewSort {
  readonly field: string;
  readonly direction: 'ascending' | 'descending';
}

export interface AcademicViewGroup {
  readonly field: string;
  readonly direction?: 'ascending' | 'descending';
}

export interface AcademicViewColumn {
  readonly field: string;
  readonly label?: string;
  readonly width?: number;
  readonly visible?: boolean;
  /** Ausente = campo simples da fonte. Presente = projeção derivada de relações. */
  readonly derived?: AcademicViewDerivedColumn;
}

/**
 * Definição portátil de uma projection. Não contém entidades, linhas, totais,
 * seleção ou valores computados: todos estes são reconstruídos pelo host.
 */
export interface AcademicView {
  readonly version: 1;
  readonly id: string;
  readonly name: string;
  readonly source: AcademicViewSource;
  readonly layout: AcademicViewLayout;
  readonly filter?: AcademicViewFilter;
  readonly sort?: readonly AcademicViewSort[];
  readonly group?: AcademicViewGroup;
  readonly columns?: readonly AcademicViewColumn[];
}

/** Bloco declarativo de dashboard: aponta para uma view, nunca copia suas linhas. */
export interface DashboardViewBlock {
  readonly id: string;
  readonly viewId: string;
  readonly title: string;
  readonly kind: 'metric' | 'chart' | 'table';
}

/** Conteúdo inteiro de `.academic/views/*.json`, deliberadamente pequeno e versionado. */
export interface AcademicViewsDocument {
  readonly version: 1;
  readonly views: readonly AcademicView[];
  readonly dashboards?: readonly DashboardViewBlock[];
}

export interface AcademicViewSourceDescriptor {
  readonly source: AcademicViewSource;
  readonly label: string;
  readonly layouts: readonly AcademicViewLayout[];
}

export const ACADEMIC_VIEW_SOURCE_DESCRIPTORS: readonly AcademicViewSourceDescriptor[] = [
  { source: 'documents', label: 'Documentos', layouts: ACADEMIC_VIEW_LAYOUTS },
  { source: 'references', label: 'Referências', layouts: ACADEMIC_VIEW_LAYOUTS },
  { source: 'literature-notes', label: 'Notas de literatura', layouts: ACADEMIC_VIEW_LAYOUTS },
  { source: 'projects', label: 'Projetos', layouts: ACADEMIC_VIEW_LAYOUTS },
  { source: 'datasets', label: 'Datasets', layouts: ACADEMIC_VIEW_LAYOUTS },
  { source: 'review-studies', label: 'Estudos de revisão', layouts: ACADEMIC_VIEW_LAYOUTS },
  { source: 'annotations', label: 'Anotações', layouts: ['table', 'list', 'cards', 'chart'] },
];
