import { describe, expect, it } from 'vitest';

import {
  InMemoryWorkspaceSyncAdapter,
  WorkspaceSyncRevisionConflictError,
  classifyWorkspaceSyncConflicts,
  createPortableWorkspaceState,
  replicateWorkspaceSyncRecord,
  supportsWorkspaceStorageCapabilities,
  workspaceStatePolicy,
  asWorkspaceId,
} from '@abnt/workspace-core';

describe('Onda W — preparação de sync sem cloud', () => {
  it('F117/F118 — classifica estado e serializa somente o operacional portátil de forma determinística', () => {
    expect(workspaceStatePolicy('vault-content').classification).toBe('authorial');
    expect(workspaceStatePolicy('reading-queue').classification).toBe('portable-operational');
    expect(workspaceStatePolicy('window-layout').classification).toBe('machine-local');
    expect(workspaceStatePolicy('sqlite-index').classification).toBe('rebuildable');

    const state = createPortableWorkspaceState(asWorkspaceId('workspace_sync'), [
      { id: 'project-1', resource: 'research-projects', revision: '3', value: { title: 'TCC' } },
      { id: 'queue-1', resource: 'reading-queue', revision: '2', value: { referenceId: 'silva2024', state: 'reading' } },
    ]);

    expect(state).toMatchObject({ schema: 'folio-portable-workspace-state', version: 1 });
    expect(state.entries.map((entry) => entry.resource)).toEqual(['reading-queue', 'research-projects']);
    expect(() => createPortableWorkspaceState(asWorkspaceId('workspace_sync'), [
      { id: 'index', resource: 'sqlite-index' as 'reading-queue', revision: '1', value: {} },
    ])).toThrow('Estado não portátil');
  });

  it('F119/F121/F122 — capabilities e write condicional são contrato, não instanceof filesystem', async () => {
    const adapter = new InMemoryWorkspaceSyncAdapter();
    expect(supportsWorkspaceStorageCapabilities(adapter.capabilities, { atomicWrite: true, conditionalWrite: true, revisionCompare: true })).toBe(true);
    expect(supportsWorkspaceStorageCapabilities({ ...adapter.capabilities, watch: false }, { watch: true })).toBe(false);

    const first = await adapter.write({ key: 'documents/artigo.md', resource: 'vault-content', contentHash: 'sha256:first', content: '# Artigo' });
    await expect(adapter.write({ key: first.key, resource: first.resource, contentHash: 'sha256:second', content: '# Alterado', expectedRevision: 'stale' }))
      .rejects.toBeInstanceOf(WorkspaceSyncRevisionConflictError);
    expect(await adapter.compareRevision?.(first.key, first.revision)).toBe(true);
  });

  it('F120/F123 — dois devices em memória replicam estado e expõem conflitos explícitos por entidade', async () => {
    const deviceA = new InMemoryWorkspaceSyncAdapter();
    const deviceB = new InMemoryWorkspaceSyncAdapter();
    const authored = await deviceA.write({ key: 'documents/artigo.md', resource: 'vault-content', contentHash: 'sha256:base', content: '# Base' });
    await replicateWorkspaceSyncRecord(deviceA, deviceB, authored.key);
    expect(await deviceB.read(authored.key)).toMatchObject({ contentHash: 'sha256:base', content: '# Base' });

    const local = [
      { entity: { kind: 'text' as const, id: 'file-1' }, operation: 'upsert' as const, revision: '2', contentHash: 'sha256:a' },
      { entity: { kind: 'reference' as const, id: 'silva2024' }, operation: 'upsert' as const, revision: '2', contentHash: 'sha256:ref-a' },
      { entity: { kind: 'annotation' as const, id: 'annotation-1' }, operation: 'delete' as const, revision: '2' },
      { entity: { kind: 'project' as const, id: 'tcc' }, operation: 'rename' as const, revision: '2', path: 'TCC final' },
    ];
    const remote = [
      { entity: { kind: 'text' as const, id: 'file-1' }, operation: 'upsert' as const, revision: '2', contentHash: 'sha256:b' },
      { entity: { kind: 'reference' as const, id: 'silva2024' }, operation: 'upsert' as const, revision: '2', contentHash: 'sha256:ref-b' },
      { entity: { kind: 'annotation' as const, id: 'annotation-1' }, operation: 'upsert' as const, revision: '2', contentHash: 'sha256:note' },
      { entity: { kind: 'project' as const, id: 'tcc' }, operation: 'upsert' as const, revision: '2', contentHash: 'sha256:project' },
    ];
    const conflicts = classifyWorkspaceSyncConflicts(local, remote);

    expect(conflicts.map((conflict) => [conflict.kind, conflict.resolution])).toEqual([
      ['text-conflict', 'manual-text-merge'],
      ['reference-conflict', 'manual-entity-review'],
      ['delete-edit-conflict', 'manual-entity-review'],
      ['rename-edit-conflict', 'manual-entity-review'],
    ]);
    expect((await deviceA.poll()).events).toHaveLength(1);
  });
});
