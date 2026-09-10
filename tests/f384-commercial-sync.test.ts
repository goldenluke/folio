import { describe, expect, it } from 'vitest';
import { InMemoryWorkspaceSyncAdapter } from '@abnt/workspace-core';
import { HttpWorkspaceSyncAdapter, SyncEngine, mergeTextThreeWay } from '../packages/workspace-sync/src/index.js';

describe('F384–F390 — sync comercial', () => {
  it('oferece merge manual determinístico e conserva sobreposição como conflito visível', () => {
    expect(mergeTextThreeWay('base', 'base', 'remoto')).toEqual({ content: 'remoto', clean: true });
    expect(mergeTextThreeWay('base', 'local', 'remoto')).toEqual({ content: '<<<<<<< local\nlocal\n=======\nremoto\n>>>>>>> remoto\n', clean: false });
  });

  it('mantém tombstone e reporta delete/edit como conflito, sem ressuscitar arquivo', async () => {
    const local = new InMemoryWorkspaceSyncAdapter(); const remote = new InMemoryWorkspaceSyncAdapter();
    const record = await remote.write({ key: 'nota.md', resource: 'vault-content', contentHash: 'old', content: 'antigo' });
    await remote.delete?.({ key: record.key, expectedRevision: record.revision });
    await local.write({ key: 'nota.md', resource: 'vault-content', contentHash: 'new', content: 'novo' });
    const result = await new SyncEngine({ id: 'memory', label: 'Teste', adapter: remote }).sync(local);
    expect(await remote.listTombstones?.()).toHaveLength(1);
    expect(result.conflicts[0]?.conflict.kind).toBe('delete-edit-conflict');
    expect(await remote.read('nota.md')).toBeUndefined();
  });

  it('fala com o provider HTTP por contrato REST sem conhecer contas ou paths locais', async () => {
    const requests: string[] = [];
    const adapter = new HttpWorkspaceSyncAdapter({ endpoint: 'https://sync.example.test/v1', accessToken: 'token', fetch: async (input) => { requests.push(input); return { ok: true, status: 200, json: async () => [] }; } });
    await expect(adapter.list()).resolves.toEqual([]);
    expect(requests).toEqual(['https://sync.example.test/v1/records']);
  });

  it('preserva a autoria na fila offline e reaplica o snapshot mais recente quando o provider volta', async () => {
    const local = new InMemoryWorkspaceSyncAdapter();
    const remote = new InMemoryWorkspaceSyncAdapter();
    let online = false;
    const provider = {
      capabilities: remote.capabilities,
      list: async () => { if (!online) throw new Error('offline'); return remote.list(); },
      read: (key: string) => remote.read(key),
      write: async (request: Parameters<typeof remote.write>[0]) => { if (!online) throw new Error('offline'); return remote.write(request); },
      compareRevision: (key: string, revision: string) => remote.compareRevision(key, revision),
    };
    await local.write({ key: 'capitulo.md', resource: 'vault-content', contentHash: 'v1', content: 'rascunho local' });
    const engine = new SyncEngine({ id: 'flaky', label: 'Provider instável', adapter: provider });

    await expect(engine.sync(local)).resolves.toMatchObject({ status: 'offline' });
    expect(engine.queue.list()).toHaveLength(1);

    online = true;
    await expect(engine.sync(local)).resolves.toMatchObject({ status: 'synced' });
    expect(await remote.read('capitulo.md')).toMatchObject({ content: 'rascunho local' });
    expect(engine.queue.list()).toHaveLength(0);
  });
});
