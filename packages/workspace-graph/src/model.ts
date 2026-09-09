import type { WorkspaceFileId, WorkspacePath } from '@abnt/workspace-core';

export type WorkspaceNodeKind = 'document' | 'reference' | 'resource' | 'person' | 'organization' | 'tag';

export interface WorkspaceGraphNode {
  readonly id: string;
  readonly kind: WorkspaceNodeKind;
  readonly label: string;
  readonly fileId?: WorkspaceFileId;
  readonly path?: WorkspacePath;
  readonly referenceId?: string;
  /** F80: projeção operacional, nunca uma afirmação gravada no CSL-JSON. */
  readonly identityState?: 'resolved' | 'possible-match' | 'ambiguous';
  /** `false` para uma referência citada mas sem entrada bibliográfica resolvida. */
  readonly resolved?: boolean;
}

export type WorkspaceEdgeKind = 'links-to' | 'cites' | 'embeds' | 'authored-by' | 'tagged-with';

export interface WorkspaceGraphEdge {
  readonly kind: WorkspaceEdgeKind;
  readonly from: string;
  readonly to: string;
  readonly sourceFileId?: WorkspaceFileId;
  readonly sourceStart?: number;
  readonly sourceEnd?: number;
}

export interface WorkspaceGraph {
  readonly nodes: readonly WorkspaceGraphNode[];
  readonly edges: readonly WorkspaceGraphEdge[];
}

export const documentNodeId = (fileId: WorkspaceFileId): string => `document:${fileId}`;
export const referenceNodeId = (referenceId: string): string => `reference:${referenceId}`;
export const resourceNodeId = (resourceId: string): string => `resource:${resourceId}`;
export const personNodeId = (slug: string): string => `person:${slug}`;
export const organizationNodeId = (slug: string): string => `organization:${slug}`;
/** Tags são identificadores autorais, normalizados apenas para identidade do nó. */
export const tagNodeId = (tag: string): string => `tag:${tag.toLocaleLowerCase()}`;
