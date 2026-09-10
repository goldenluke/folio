export type CollaborationRole = 'owner' | 'editor' | 'reviewer' | 'viewer';
export interface Collaborator { readonly id: string; readonly name: string; readonly role: CollaborationRole; }
/** Identidade local: estável no dispositivo, sem conta, rede ou e-mail. */
export interface LocalCollaborationIdentity { readonly id: string; readonly name: string; }
export function localCollaborator(identity: LocalCollaborationIdentity, role: CollaborationRole = 'owner'): Collaborator {
  const id = identity.id.trim(); const name = identity.name.trim();
  if (id === '' || name === '') throw new Error('Identidade local exige UUID e nome.');
  return { id, name, role };
}
export interface SharedProject { readonly id: string; readonly title: string; readonly collaborators: readonly Collaborator[]; readonly milestones: readonly SharedMilestone[]; }
export interface SharedMilestone { readonly id: string; readonly title: string; readonly dueDate?: string; readonly completedAt?: string; }
export interface ReviewComment { readonly id: string; readonly fileId: string; readonly authorId: string; readonly body: string; readonly createdAt: string; readonly resolvedAt?: string; readonly replies: readonly ReviewReply[]; }
export interface ReviewReply { readonly id: string; readonly authorId: string; readonly body: string; readonly createdAt: string; }
export interface ReviewAssignment { readonly id: string; readonly target: { readonly kind: 'document' | 'reference' | 'screening-item'; readonly id: string }; readonly reviewerIds: readonly string[]; }
export interface ScreeningDecision { readonly reviewerId: string; readonly itemId: string; readonly decision: 'include' | 'exclude' | 'maybe'; readonly at: string; }
export interface Presence { readonly collaboratorId: string; readonly location: string; readonly observedAt: string; }
export type ConcurrentEditingDecision = 'undecided' | 'locking' | 'ot' | 'crdt';

/** Sinais locais e agregados: nunca guardam conteúdo, seleção, path ou identidade pessoal. */
export type ConcurrentEditingEventKind = 'lock-acquired' | 'lock-denied' | 'lock-expired' | 'sync-conflict' | 'manual-merge';
export interface ConcurrentEditingTelemetryEvent { readonly kind: ConcurrentEditingEventKind; readonly documentId: string; readonly at: number; }
export interface ConcurrentEditingTelemetrySummary { readonly events: number; readonly lockDenied: number; readonly expired: number; readonly syncConflicts: number; readonly manualMerges: number; }
export function summarizeConcurrentEditingTelemetry(events: readonly ConcurrentEditingTelemetryEvent[]): ConcurrentEditingTelemetrySummary {
  const count = (kind: ConcurrentEditingEventKind): number => events.filter((event) => event.kind === kind).length;
  return { events: events.length, lockDenied: count('lock-denied'), expired: count('lock-expired'), syncConflicts: count('sync-conflict'), manualMerges: count('manual-merge') };
}

/** Protótipo de lease: uma política opcional, sem alterar CRDT/OT/editor. */
export interface DocumentLease { readonly documentId: string; readonly holderId: string; readonly acquiredAt: number; readonly expiresAt: number; }
export class DocumentLeaseLocks {
  #leases = new Map<string, DocumentLease>();
  acquire(documentId: string, holderId: string, now: number, durationMs = 30_000): DocumentLease | undefined {
    if (documentId.trim() === '' || holderId.trim() === '' || durationMs <= 0) throw new Error('Lease exige documento, titular e duração positiva.');
    const current = this.#leases.get(documentId);
    if (current !== undefined && current.expiresAt > now && current.holderId !== holderId) return undefined;
    const lease = { documentId, holderId, acquiredAt: now, expiresAt: now + durationMs };
    this.#leases.set(documentId, lease);
    return lease;
  }
  renew(documentId: string, holderId: string, now: number, durationMs = 30_000): DocumentLease | undefined {
    const current = this.#leases.get(documentId);
    if (current === undefined || current.holderId !== holderId || current.expiresAt <= now) return undefined;
    const lease = { ...current, expiresAt: now + durationMs };
    this.#leases.set(documentId, lease);
    return lease;
  }
  release(documentId: string, holderId: string): boolean {
    const current = this.#leases.get(documentId);
    if (current === undefined || current.holderId !== holderId) return false;
    this.#leases.delete(documentId);
    return true;
  }
  active(documentId: string, now: number): DocumentLease | undefined {
    const current = this.#leases.get(documentId);
    if (current === undefined || current.expiresAt <= now) { this.#leases.delete(documentId); return undefined; }
    return current;
  }
}

const may = (role: CollaborationRole, action: 'edit' | 'review' | 'manage'): boolean => role === 'owner' || (role === 'editor' && action !== 'manage') || (role === 'reviewer' && action === 'review');
export const canEdit = (role: CollaborationRole): boolean => may(role, 'edit');
export const canReview = (role: CollaborationRole): boolean => may(role, 'review');
export const canManage = (role: CollaborationRole): boolean => may(role, 'manage');
export function addComment(project: SharedProject, author: Collaborator, comment: Omit<ReviewComment, 'authorId' | 'replies'>): ReviewComment { if (!canReview(author.role)) throw new Error('Colaborador não pode comentar.'); if (!project.collaborators.some((item) => item.id === author.id)) throw new Error('Colaborador não pertence ao projeto.'); return { ...comment, authorId: author.id, replies: [] }; }
export function replyToComment(comment: ReviewComment, author: Collaborator, reply: Omit<ReviewReply, 'authorId'>): ReviewComment { if (!canReview(author.role)) throw new Error('Colaborador não pode responder.'); return { ...comment, replies: [...comment.replies, { ...reply, authorId: author.id }] }; }
export function setCommentResolved(comment: ReviewComment, actor: Collaborator, resolved: boolean, at: string): ReviewComment { if (!canEdit(actor.role)) throw new Error('Colaborador não pode resolver comentários.'); if (resolved) return { ...comment, resolvedAt: at }; const { resolvedAt: _resolvedAt, ...open } = comment; return open; }
export function independentScreening(itemId: string, viewerId: string, decisions: readonly ScreeningDecision[], phase: 'independent' | 'reconciliation'): readonly ScreeningDecision[] { return phase === 'independent' ? decisions.filter((decision) => decision.itemId === itemId && decision.reviewerId === viewerId) : decisions.filter((decision) => decision.itemId === itemId); }
export function screeningAgreement(decisions: readonly ScreeningDecision[]): { readonly compared: number; readonly agreement: number; readonly conflicts: readonly string[] } { const grouped = new Map<string, ScreeningDecision[]>(); for (const decision of decisions) grouped.set(decision.itemId, [...(grouped.get(decision.itemId) ?? []), decision]); const groups = [...grouped.entries()].filter(([, entries]) => entries.length >= 2); const conflicts = groups.filter(([, entries]) => new Set(entries.map((item) => item.decision)).size > 1).map(([id]) => id); return { compared: groups.length, agreement: groups.length - conflicts.length, conflicts }; }
export function assignmentsFor(assigneeId: string, assignments: readonly ReviewAssignment[]): readonly ReviewAssignment[] { return assignments.filter((assignment) => assignment.reviewerIds.includes(assigneeId)); }
export function currentPresence(items: readonly Presence[], now: number, maxAgeMs = 60_000): readonly Presence[] { return items.filter((item) => now - new Date(item.observedAt).getTime() <= maxAgeMs); }
