import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { MessageChannel } from 'node:worker_threads';

import { describe, expect, it } from 'vitest';
import { InMemoryWorkspaceSyncAdapter, asWorkspacePath } from '@abnt/workspace-core';
import { LocalFilesystemStorage } from '@abnt/workspace-local';
import { criarServicoDeCompiler } from '@abnt/compiler';
import { createInProcessCompilerClient, createWorkspaceMessagePortClient, serveWorkspaceOverMessagePort } from '@abnt/protocol';
import { CompositeWorkspaceSyncAdapter, createDeviceIdentity, SyncEngine, WorkspaceStorageSyncAdapter } from '../packages/workspace-sync/src/index.js';
import { DesktopWorkspaceServiceHost } from '../apps/desktop/src/workspace/workspace-service.js';
import { JsonOperationalSyncAdapter } from '../apps/desktop/src/workspace/operational-sync.js';

describe('F205–F218 — sync local-first', () => {
  it('sincroniza conteúdo portável com provider injetado e identidade sem path', async () => {
    const local = new InMemoryWorkspaceSyncAdapter(); const remote = new InMemoryWorkspaceSyncAdapter();
    await local.write({ key: 'nota.md', resource: 'vault-content', contentHash: 'a', content: 'texto' });
    const engine = new SyncEngine({ id: 'memory', label: 'Teste', adapter: remote });
    await expect(engine.sync(local)).resolves.toMatchObject({ status: 'synced', applied: 1 });
    expect((await remote.read('nota.md'))?.content).toBe('texto'); expect(createDeviceIdentity('Notebook').label).toBe('Notebook');
  });
  it('mantém estado operacional de colaboração separado do conteúdo autoral', async () => {
    const vault = new InMemoryWorkspaceSyncAdapter(); const collaboration = new InMemoryWorkspaceSyncAdapter();
    await vault.write({ key: 'artigo.md', resource: 'vault-content', contentHash: 'a', content: '# Artigo' });
    await collaboration.write({ key: 'shared-project', resource: 'collaboration', contentHash: 'c', content: { roles: ['owner'] } });
    const adapter = new CompositeWorkspaceSyncAdapter([
      { accepts: (resource) => resource === 'vault-content', adapter: vault },
      { accepts: (resource) => resource === 'collaboration', adapter: collaboration },
    ]);
    expect(await adapter.list()).toHaveLength(2);
    expect((await adapter.read('shared-project'))?.resource).toBe('collaboration');
  });
  it('leva estado compartilhado de colaboração pelo espelho sem misturá-lo ao vault', async () => {
    const root = await mkdtemp(join(tmpdir(), 'folio-collaboration-sync-')); const source = join(root, 'source'); const mirror = join(root, 'mirror');
    await Promise.all([mkdir(source), mkdir(mirror)]);
    try {
      const local = new JsonOperationalSyncAdapter(source, 'collaboration', 'shared-project');
      const remote = new JsonOperationalSyncAdapter(mirror, 'collaboration', 'shared-project');
      await local.write({ key: 'shared-project', resource: 'collaboration', contentHash: 'ignored', content: { collaborators: [{ id: 'ana', role: 'owner' }], comments: [{ id: 'comment-1', fileId: 'metodo', path: 'metodo.md', revision: 1, range: { start: 0, end: 6 }, message: 'Detalhar método.', createdAt: 1 }] } });
      await expect(new SyncEngine({ id: 'folder', label: 'Pasta espelho', adapter: remote }).sync(local)).resolves.toMatchObject({ status: 'synced', applied: 1 });
      expect((await remote.read('shared-project'))?.content).toEqual({ collaborators: [{ id: 'ana', role: 'owner' }], comments: [{ id: 'comment-1', fileId: 'metodo', path: 'metodo.md', revision: 1, range: { start: 0, end: 6 }, message: 'Detalhar método.', createdAt: 1 }] });
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  it('mantém conflito em inbox e não escolhe um lado automaticamente', async () => {
    const local = new InMemoryWorkspaceSyncAdapter(); const remote = new InMemoryWorkspaceSyncAdapter();
    await local.write({ key: 'nota.md', resource: 'vault-content', contentHash: 'local', content: 'local' });
    await remote.write({ key: 'nota.md', resource: 'vault-content', contentHash: 'remote', content: 'remote' });
    const result = await new SyncEngine({ id: 'memory', label: 'Teste', adapter: remote }).sync(local);
    expect(result.status).toBe('conflict'); expect(result.conflicts).toHaveLength(1); expect((await remote.read('nota.md'))?.content).toBe('remote');
  });
  it('resolve conflito apenas após uma escolha explícita do usuário', async () => {
    const local = new InMemoryWorkspaceSyncAdapter(); const remote = new InMemoryWorkspaceSyncAdapter();
    await local.write({ key: 'nota.md', resource: 'vault-content', contentHash: 'local', content: 'local' });
    await remote.write({ key: 'nota.md', resource: 'vault-content', contentHash: 'remote', content: 'remoto' });
    const engine = new SyncEngine({ id: 'memory', label: 'Teste', adapter: remote });
    const conflicted = await engine.sync(local);
    await expect(engine.resolveConflict(local, conflicted.conflicts[0]!.id, 'use-mirror')).resolves.toMatchObject({ status: 'synced', conflicts: [] });
    expect((await local.read('nota.md'))?.content).toBe('remoto');
  });
  it('sincroniza texto e binários entre dois vaults locais sem corromper bytes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'folio-sync-'));
    const localRoot = join(root, 'local'); const remoteRoot = join(root, 'remote');
    await Promise.all([mkdir(localRoot), mkdir(remoteRoot)]);
    const local = LocalFilesystemStorage.create(localRoot); const remote = LocalFilesystemStorage.create(remoteRoot);
    try {
      await Promise.all([local.open(), remote.open()]);
      await local.create({ path: asWorkspacePath('nota.md'), content: '# Nota\n' });
      await local.createBinary?.({ path: asWorkspacePath('assets/dado.bin'), bytes: new Uint8Array([0, 255, 4, 128]) });
      const result = await new SyncEngine({ id: 'folder', label: 'Pasta espelho', adapter: new WorkspaceStorageSyncAdapter(remote) }).sync(new WorkspaceStorageSyncAdapter(local));
      expect(result).toMatchObject({ status: 'synced', applied: 2 });
      const mirrored = await remote.list();
      const binary = mirrored.find((file) => file.path === 'assets/dado.bin');
      expect(binary).toBeDefined();
      expect(Array.from((await remote.readBinary!(binary!.id)).bytes)).toEqual([0, 255, 4, 128]);
    } finally { await Promise.all([local.close(), remote.close()]); await rm(root, { recursive: true, force: true }); }
  });
  it('reconstrói um vault vazio a partir da pasta espelho sem deletes automáticos', async () => {
    const root = await mkdtemp(join(tmpdir(), 'folio-sync-recovery-'));
    const sourceRoot = join(root, 'source'); const restoredRoot = join(root, 'restored');
    await Promise.all([mkdir(sourceRoot), mkdir(restoredRoot)]);
    const source = LocalFilesystemStorage.create(sourceRoot); const restored = LocalFilesystemStorage.create(restoredRoot);
    try {
      await Promise.all([source.open(), restored.open()]);
      await source.create({ path: asWorkspacePath('capitulo.md'), content: '# Capítulo\n' });
      const engine = new SyncEngine({ id: 'folder', label: 'Pasta espelho', adapter: new WorkspaceStorageSyncAdapter(source) });
      await expect(engine.recover(new WorkspaceStorageSyncAdapter(restored))).resolves.toBe(1);
      expect((await restored.read((await restored.list())[0]!.id)).content).toBe('# Capítulo\n');
      expect((await source.list()).map((file) => file.path)).toEqual(['capitulo.md']);
    } finally { await Promise.all([source.close(), restored.close()]); await rm(root, { recursive: true, force: true }); }
  });
  it('configura uma pasta espelho pelo protocolo sem expor seu caminho e sincroniza por ação explícita', async () => {
    const root = await mkdtemp(join(tmpdir(), 'folio-sync-desktop-'));
    const vault = join(root, 'vault'); const mirror = join(root, 'mirror');
    await Promise.all([mkdir(vault), mkdir(mirror), writeFile(join(vault, 'nota.md'), '# Nota espelhada\n', 'utf8')]);
    const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
    const channel = new MessageChannel(); const stop = serveWorkspaceOverMessagePort(channel.port1, host); const client = createWorkspaceMessagePortClient(channel.port2);
    try {
      await expect(client.open({ rootPath: vault })).resolves.toMatchObject({ ok: true });
      await expect(client.syncStatus()).resolves.toEqual({ ok: true, value: { configured: false, status: 'synced', pending: 0, conflicts: [] } });
      const configured = await client.configureSync({ mirrorRootPath: mirror });
      expect(configured).toMatchObject({ ok: true, value: { configured: true, provider: { id: 'local-mirror' } } });
      expect(JSON.stringify(configured)).not.toContain(mirror);
      await expect(client.syncNow()).resolves.toMatchObject({ ok: true, value: { status: 'synced' } });
      const remote = LocalFilesystemStorage.create(mirror); await remote.open();
      try { expect((await remote.read((await remote.list()).find((file) => file.path === 'nota.md')!.id)).content).toBe('# Nota espelhada\n'); }
      finally { await remote.close(); }
    } finally {
      client.dispose(); stop(); channel.port1.close(); channel.port2.close(); await host.dispose(); await rm(root, { recursive: true, force: true });
    }
  });
  it('persiste colaboradores e papéis como estado operacional pelo protocolo', async () => {
    const root = await mkdtemp(join(tmpdir(), 'folio-collaboration-desktop-')); const vault = join(root, 'vault'); await mkdir(vault);
    const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
    const channel = new MessageChannel(); const stop = serveWorkspaceOverMessagePort(channel.port1, host); const client = createWorkspaceMessagePortClient(channel.port2);
    try {
      await client.open({ rootPath: vault });
      await expect(client.setCollaboration({ projectId: 'revisao-1', title: 'Revisão de métodos', collaborators: [{ id: 'device-ana', name: 'Ana', role: 'owner' }, { id: 'bruno', name: 'Bruno', role: 'reviewer' }], comments: [{ id: 'comment-1', fileId: 'doc-1', path: 'metodo.md', revision: 2, range: { start: 4, end: 9 }, message: 'Explicar a amostra.', authorId: 'bruno', createdAt: 1, resolvedAt: 3, replies: [{ id: 'reply-1', message: 'Vou detalhar.', authorId: 'device-ana', createdAt: 2 }] }] })).resolves.toMatchObject({ ok: true, value: { title: 'Revisão de métodos' } });
      await expect(client.collaboration()).resolves.toEqual({ ok: true, value: { projectId: 'revisao-1', title: 'Revisão de métodos', collaborators: [{ id: 'device-ana', name: 'Ana', role: 'owner' }, { id: 'bruno', name: 'Bruno', role: 'reviewer' }], comments: [{ id: 'comment-1', fileId: 'doc-1', path: 'metodo.md', revision: 2, range: { start: 4, end: 9 }, message: 'Explicar a amostra.', authorId: 'bruno', createdAt: 1, resolvedAt: 3, replies: [{ id: 'reply-1', message: 'Vou detalhar.', authorId: 'device-ana', createdAt: 2 }] }] } });
      await expect(client.setCollaboration({ projectId: 'x', title: 'Inválido', collaborators: [{ id: 'a', name: 'A', role: 'editor' }] })).resolves.toMatchObject({ ok: false });
    } finally { client.dispose(); stop(); channel.port1.close(); channel.port2.close(); await host.dispose(); await rm(root, { recursive: true, force: true }); }
  });
});
