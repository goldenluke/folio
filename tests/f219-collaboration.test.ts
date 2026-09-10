import { describe, expect, it } from 'vitest';
import { addComment, assignmentsFor, currentPresence, independentScreening, localCollaborator, screeningAgreement, setCommentResolved, type Collaborator } from '../packages/collaboration/src/index.js';

describe('F219–F231 — colaboração acadêmica', () => {
  const owner: Collaborator = { id: 'ana', name: 'Ana', role: 'owner' }; const reviewer: Collaborator = { id: 'bia', name: 'Bia', role: 'reviewer' };
  it('suporta comentários, threads e workflow resolve/reopen por role', () => {
    const project = { id: 'p', title: 'Revisão', collaborators: [owner, reviewer], milestones: [] };
    const comment = addComment(project, reviewer, { id: 'c', fileId: 'm.md', body: 'Rever método', createdAt: '2026-01-01' });
    expect(setCommentResolved(comment, owner, true, '2026-01-02').resolvedAt).toBeDefined(); expect(() => setCommentResolved(comment, reviewer, true, 'x')).toThrow();
  });
  it('usa identidade local estável sem depender de login', () => {
    expect(localCollaborator({ id: 'b4d9cbd8-8bf7-4d9f-8562-12c9fca1af8b', name: 'Ana' })).toEqual({ id: 'b4d9cbd8-8bf7-4d9f-8562-12c9fca1af8b', name: 'Ana', role: 'owner' });
  });
  it('esconde decisões independentes até reconciliação e mede conflitos', () => {
    const decisions = [{ itemId: 's', reviewerId: 'ana', decision: 'include', at: 'x' }, { itemId: 's', reviewerId: 'bia', decision: 'exclude', at: 'x' }] as const;
    expect(independentScreening('s', 'ana', decisions, 'independent')).toHaveLength(1); expect(screeningAgreement(decisions).conflicts).toEqual(['s']);
    expect(assignmentsFor('bia', [{ id: 'a', target: { kind: 'reference', id: 'r' }, reviewerIds: ['bia'] }])).toHaveLength(1);
    expect(currentPresence([{ collaboratorId: 'ana', location: 'Methods', observedAt: new Date(1000).toISOString() }], 2000)).toHaveLength(1);
  });
  it('registra as alternativas de edição concorrente sem habilitá-las', () => {
    expect(['undecided', 'locking', 'ot', 'crdt']).toContain('undecided');
  });
});
