/**
 * @abnt/workspace-graph — projeção de grafo (nodes/edges) sobre o vault.
 *
 * Fatia própria reservada pelo P11 (docs/adr/0016, "Não decidido aqui"):
 * grafo é derivado de `workspace-index` + bibliografia resolvida, nunca uma
 * segunda fonte de verdade. Não conhece UI, Electron, protocolo ou SQLite —
 * o host monta as fontes e chama `buildWorkspaceGraph`.
 */

export { buildWorkspaceGraph } from './build.js';
export type { WorkspaceBibliographyEntry, WorkspaceGraphSources } from './build.js';
export {
  documentNodeId,
  personNodeId,
  referenceNodeId,
  resourceNodeId,
  tagNodeId,
} from './model.js';
export type {
  WorkspaceEdgeKind,
  WorkspaceGraph,
  WorkspaceGraphEdge,
  WorkspaceGraphNode,
  WorkspaceNodeKind,
} from './model.js';
