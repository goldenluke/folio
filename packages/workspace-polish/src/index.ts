export type NavigationItem = { readonly id: string; readonly label: string; readonly kind: 'files' | 'projects' | 'views' | 'bookmarks' | 'canvases' | 'saved-searches' | 'journal'; readonly count?: number; };
export const navigationTree = (counts: Readonly<Partial<Record<NavigationItem['kind'], number>>> = {}): readonly NavigationItem[] => {
  const item = (id: NavigationItem['kind'], label: string): NavigationItem => ({ id, label, kind: id, ...(counts[id] === undefined ? {} : { count: counts[id] }) });
  return [item('files', 'Arquivos'), item('projects', 'Projetos'), item('views', 'Views'), item('bookmarks', 'Bookmarks'), item('canvases', 'Canvases'), item('saved-searches', 'Buscas salvas'), item('journal', 'Diário de pesquisa')];
};
export interface ContextAction { readonly id: string; readonly commandId: string; readonly label: string; readonly targetKinds: readonly string[]; }
export function contextActions(actions: readonly ContextAction[], targetKind: string): readonly ContextAction[] { return actions.filter((action) => action.targetKinds.includes(targetKind)); }
export type SemanticDrop = { readonly source: 'reference' | 'document' | 'pdf-annotation'; readonly destination: 'project' | 'collection' | 'canvas' | 'literature-note'; };
const allowedDrops = new Set(['reference:project', 'document:collection', 'reference:canvas', 'pdf-annotation:literature-note']);
export function isSemanticDropAllowed(drop: SemanticDrop): boolean { return allowedDrops.has(`${drop.source}:${drop.destination}`); }
export type PeekEntity = { readonly kind: 'document'; readonly id: string; readonly title: string; readonly excerpt?: string } | { readonly kind: 'reference'; readonly id: string; readonly title: string; readonly authors?: string } | { readonly kind: 'annotation'; readonly id: string; readonly title: string; readonly excerpt: string } | { readonly kind: 'dataset' | 'project' | 'view' | 'search'; readonly id: string; readonly title: string; readonly excerpt?: string };
export function peekSummary(entity: PeekEntity): string { return entity.kind === 'reference' ? [entity.authors, entity.title].filter(Boolean).join(' — ') : entity.excerpt ?? entity.title; }
export interface RecentEntity { readonly kind: PeekEntity['kind'] | 'view' | 'canvas'; readonly id: string; readonly visitedAt: number; }
export function recordRecent(items: readonly RecentEntity[], item: RecentEntity, limit = 20): readonly RecentEntity[] { return [item, ...items.filter((current) => `${current.kind}:${current.id}` !== `${item.kind}:${item.id}`)].sort((a, b) => b.visitedAt - a.visitedAt).slice(0, limit); }
export interface HomeCustomization { readonly pinned: readonly ('views' | 'projects' | 'bookmarks' | 'saved-searches')[]; }
export function validateHomeCustomization(value: HomeCustomization): HomeCustomization { if (new Set(value.pinned).size !== value.pinned.length) throw new Error('Item da Home duplicado.'); return value; }
export interface SurfaceAudit { readonly keyboard: boolean; readonly focus: boolean; readonly loading: boolean; readonly error: boolean; readonly empty: boolean; readonly destructiveActions: boolean; readonly dragDrop: boolean; readonly contextMenu: boolean; readonly peek: boolean; }
export function auditSurface(value: SurfaceAudit): readonly (keyof SurfaceAudit)[] { return (Object.keys(value) as (keyof SurfaceAudit)[]).filter((key) => !value[key]); }
