export type CanvasNode =
  | { readonly id: string; readonly type: 'document'; readonly fileId: string; readonly path: string; readonly x: number; readonly y: number }
  | { readonly id: string; readonly type: 'section'; readonly fileId: string; readonly path: string; readonly offset: number; readonly x: number; readonly y: number }
  | { readonly id: string; readonly type: 'reference'; readonly referenceId: string; readonly x: number; readonly y: number }
  | { readonly id: string; readonly type: 'literature-note'; readonly fileId: string; readonly path: string; readonly x: number; readonly y: number }
  | { readonly id: string; readonly type: 'pdf-annotation'; readonly referenceId: string; readonly annotationId: string; readonly x: number; readonly y: number }
  | { readonly id: string; readonly type: 'dataset'; readonly datasetId: string; readonly x: number; readonly y: number }
  | { readonly id: string; readonly type: 'project'; readonly projectId: string; readonly x: number; readonly y: number }
  | { readonly id: string; readonly type: 'text'; readonly text: string; readonly x: number; readonly y: number; readonly role?: 'claim' | 'evidence' | 'counterargument' };

export type CanvasEdgeKind = 'related-to' | 'supports' | 'contradicts' | 'derived-from';
export interface CanvasEdge { readonly id: string; readonly from: string; readonly to: string; readonly kind: CanvasEdgeKind; readonly label?: string; }
export interface CanvasGroup { readonly id: string; readonly label: string; readonly nodeIds: readonly string[]; }
/** JSON puro e interoperável; é artefato de workspace, nunca DocumentAst. */
export interface ResearchCanvas { readonly schema: 'folio-research-canvas'; readonly version: 1; readonly id: string; readonly title: string; readonly nodes: readonly CanvasNode[]; readonly edges: readonly CanvasEdge[]; readonly groups: readonly CanvasGroup[]; }

export function createResearchCanvas(input: Omit<ResearchCanvas, 'schema' | 'version'>): ResearchCanvas { const canvas: ResearchCanvas = { schema: 'folio-research-canvas', version: 1, ...input }; validateResearchCanvas(canvas); return canvas; }
export function validateResearchCanvas(canvas: ResearchCanvas): void {
  if (canvas.schema !== 'folio-research-canvas' || canvas.version !== 1 || canvas.id.trim() === '' || canvas.title.trim() === '') throw new Error('Canvas acadêmico inválido.');
  const ids = new Set<string>(); for (const node of canvas.nodes) { if (node.id.trim() === '' || ids.has(node.id) || !Number.isFinite(node.x) || !Number.isFinite(node.y)) throw new Error('Nó de canvas inválido ou duplicado.'); ids.add(node.id); }
  const edgeIds = new Set<string>(); for (const edge of canvas.edges) { if (edge.id.trim() === '' || edgeIds.has(edge.id) || !ids.has(edge.from) || !ids.has(edge.to) || edge.from === edge.to) throw new Error('Conexão de canvas inválida.'); edgeIds.add(edge.id); }
  for (const group of canvas.groups) { if (group.id.trim() === '' || group.label.trim() === '' || group.nodeIds.some((id) => !ids.has(id))) throw new Error('Grupo de canvas inválido.'); }
}
export function parseResearchCanvas(value: unknown): ResearchCanvas {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Canvas acadêmico inválido.');
  const canvas = value as ResearchCanvas;
  validateResearchCanvas(canvas);
  return canvas;
}
export function moveCanvasNode(canvas: ResearchCanvas, nodeId: string, x: number, y: number): ResearchCanvas {
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('Posição de canvas inválida.');
  const found = canvas.nodes.some((node) => node.id === nodeId); if (!found) throw new Error('Nó de canvas não encontrado.');
  return createResearchCanvas({ ...canvas, nodes: canvas.nodes.map((node) => node.id === nodeId ? { ...node, x, y } : node) });
}
/** Remove também relações e grupos órfãos; a UI não precisa reconstruir o grafo à mão. */
export function removeCanvasNode(canvas: ResearchCanvas, nodeId: string): ResearchCanvas {
  if (!canvas.nodes.some((node) => node.id === nodeId)) throw new Error('Nó de canvas não encontrado.');
  return createResearchCanvas({ ...canvas, nodes: canvas.nodes.filter((node) => node.id !== nodeId), edges: canvas.edges.filter((edge) => edge.from !== nodeId && edge.to !== nodeId), groups: canvas.groups.map((group) => ({ ...group, nodeIds: group.nodeIds.filter((id) => id !== nodeId) })).filter((group) => group.nodeIds.length > 0) });
}
export function canvasTextForWriting(canvas: ResearchCanvas): string {
  const claims = canvas.nodes.filter((node): node is Extract<CanvasNode, { type: 'text' }> => node.type === 'text');
  return claims.map((node) => `- ${node.text}`).join('\n');
}
export function argumentMap(canvas: ResearchCanvas): readonly CanvasEdge[] { return canvas.edges.filter((edge) => edge.kind === 'supports' || edge.kind === 'contradicts' || edge.kind === 'derived-from'); }
export function outlinePreview(canvas: ResearchCanvas): readonly { readonly id: string; readonly label: string; readonly kind: CanvasNode['type'] }[] { return canvas.nodes.map((node) => ({ id: node.id, kind: node.type, label: node.type === 'text' ? node.text : node.type === 'reference' ? node.referenceId : node.type === 'dataset' ? node.datasetId : node.type === 'project' ? node.projectId : node.type === 'pdf-annotation' ? node.annotationId : node.path })); }
export function canvasSearch(canvas: ResearchCanvas, query: string): readonly CanvasNode[] { const normalized = query.trim().toLocaleLowerCase(); return normalized === '' ? canvas.nodes : canvas.nodes.filter((node) => JSON.stringify(node).toLocaleLowerCase().includes(normalized)); }
