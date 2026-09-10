/**
 * F140/F142/F143: preferências e eventos de produto são operacionais e locais.
 * Nenhum item aqui é autoria, AST ou uma projeção persistida do SQLite.
 */
export type FocusMode = 'writing' | 'reading' | 'review' | 'research';

export interface WorkspaceLayout {
  readonly id: string;
  readonly name: string;
  readonly focus: FocusMode;
  readonly showNavigation: boolean;
  readonly showContext: boolean;
}

export interface WorkspaceActivity {
  readonly id: string;
  readonly kind: 'document-edited' | 'reference-imported' | 'pdf-annotated' | 'snapshot-created' | 'milestone-completed';
  readonly createdAt: string;
  readonly fileId?: string;
  readonly referenceId?: string;
  readonly projectId?: string;
}

const focusModes: readonly FocusMode[] = ['writing', 'reading', 'review', 'research'];
const activityKinds: readonly WorkspaceActivity['kind'][] = ['document-edited', 'reference-imported', 'pdf-annotated', 'snapshot-created', 'milestone-completed'];

export const defaultLayouts: readonly WorkspaceLayout[] = [
  { id: 'writing', name: 'Escrita', focus: 'writing', showNavigation: false, showContext: false },
  { id: 'reading', name: 'Leitura', focus: 'reading', showNavigation: true, showContext: false },
  { id: 'review', name: 'Revisão', focus: 'review', showNavigation: true, showContext: true },
  { id: 'research', name: 'Pesquisa', focus: 'research', showNavigation: true, showContext: true },
];

const records = (value: unknown): readonly Record<string, unknown>[] =>
  Array.isArray(value) ? value.flatMap((item) => typeof item === 'object' && item !== null && !Array.isArray(item) ? [item as Record<string, unknown>] : []) : [];

export const parseWorkspaceLayouts = (value: unknown): readonly WorkspaceLayout[] =>
  records(value).flatMap((item) =>
    typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    focusModes.includes(item.focus as FocusMode) &&
    typeof item.showNavigation === 'boolean' &&
    typeof item.showContext === 'boolean'
      ? [{ id: item.id, name: item.name, focus: item.focus as FocusMode, showNavigation: item.showNavigation, showContext: item.showContext }]
      : []);

export const parseWorkspaceActivity = (value: unknown): readonly WorkspaceActivity[] =>
  records(value).flatMap((item) =>
    typeof item.id === 'string' && typeof item.createdAt === 'string' && activityKinds.includes(item.kind as WorkspaceActivity['kind'])
      ? [{
        id: item.id,
        kind: item.kind as WorkspaceActivity['kind'],
        createdAt: item.createdAt,
        ...(typeof item.fileId === 'string' ? { fileId: item.fileId } : {}),
        ...(typeof item.referenceId === 'string' ? { referenceId: item.referenceId } : {}),
        ...(typeof item.projectId === 'string' ? { projectId: item.projectId } : {}),
      }]
      : []);

/** Limita o log e nunca aceita título, texto ou conteúdo de documento. */
export const appendWorkspaceActivity = (
  activities: readonly WorkspaceActivity[],
  activity: Omit<WorkspaceActivity, 'id' | 'createdAt'>,
  id: string,
  createdAt: string,
): readonly WorkspaceActivity[] => [
  { ...activity, id, createdAt },
  ...activities.filter((candidate) => candidate.kind !== activity.kind || candidate.fileId !== activity.fileId).slice(0, 79),
];

export const focusLayout = (layouts: readonly WorkspaceLayout[], focus: FocusMode): WorkspaceLayout =>
  layouts.find((layout) => layout.focus === focus) ?? defaultLayouts.find((layout) => layout.focus === focus)!;

export const activityLabel = (activity: WorkspaceActivity, filePath?: string): string => ({
  'document-edited': filePath === undefined ? 'Documento editado' : `Documento editado: ${filePath}`,
  'reference-imported': 'Referência importada',
  'pdf-annotated': 'PDF anotado',
  'snapshot-created': 'Snapshot criado',
  'milestone-completed': 'Marco concluído',
})[activity.kind];
