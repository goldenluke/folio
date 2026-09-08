import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MessageChannel } from 'node:worker_threads';

import { describe, expect, it } from 'vitest';

import { criarServicoDeCompiler } from '@abnt/compiler';
import {
  createInProcessCompilerClient,
  createWorkspaceMessagePortClient,
  serveWorkspaceOverMessagePort,
  type MessagePortWorkspaceClient,
} from '@abnt/protocol';

import { DesktopWorkspaceServiceHost } from '../apps/desktop/src/workspace/workspace-service.js';

const INITIAL = '# Introdução\n\nVersão inicial.\n';

const waitForConflict = async (client: MessagePortWorkspaceClient, fileId: string): Promise<void> => {
  const deadline = Date.now() + 3000;
  for (;;) {
    const snapshot = await client.editorSnapshot({ fileId });
    if (!snapshot.ok) throw new Error('Snapshot deveria estar disponível.');
    if (snapshot.value.session.externalChange !== undefined) return;
    if (Date.now() >= deadline) throw new Error('Watcher não projetou o conflito externo a tempo.');
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
};

describe('P16 — conflito de alteração externa pelo protocolo desktop', () => {
  it('mantém o rascunho local como escolha explícita antes de sobrescrever a base externa', async () => {
    const root = await mkdtemp(join(tmpdir(), 'abnt-p16-'));
    const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
    const channel = new MessageChannel();
    const stop = serveWorkspaceOverMessagePort(channel.port1, host);
    const client = createWorkspaceMessagePortClient(channel.port2);
    try {
      await writeFile(join(root, 'artigo.md'), INITIAL, 'utf8');
      const opened = await client.open({ rootPath: root });
      if (!opened.ok) throw new Error('Vault deveria abrir.');
      const file = opened.value.files[0];
      if (file === undefined) throw new Error('Arquivo inicial ausente.');
      const editor = await client.openEditor({ fileId: file.fileId });
      if (!editor.ok) throw new Error('Editor deveria abrir.');

      const local = await client.dispatchEditor({
        fileId: file.fileId,
        expectedRevision: editor.value.session.revision,
        transaction: { edits: [{ range: { start: INITIAL.length, end: INITIAL.length }, text: 'Rascunho local.\n' }] },
      });
      if (!local.ok) throw new Error('Rascunho local deveria ser aceito.');

      await writeFile(join(root, 'artigo.md'), '# Introdução\n\nVersão externa.\n', 'utf8');
      await waitForConflict(client, file.fileId);

      const resolved = await client.resolveEditorConflict({ fileId: file.fileId, resolution: 'keep-local' });
      expect(resolved).toMatchObject({ ok: true, value: { session: { dirty: true } } });
      if (!resolved.ok) throw new Error('Conflito deveria ser resolvido.');
      expect(resolved.value.session.externalChange).toBeUndefined();
      expect(resolved.value.session.content).toContain('Rascunho local.');

      const saved = await client.saveEditor({ fileId: file.fileId, expectedRevision: resolved.value.session.revision });
      expect(saved).toMatchObject({ ok: true, value: { session: { dirty: false } } });
      const persisted = await client.read({ fileId: file.fileId });
      expect(persisted).toMatchObject({ ok: true, value: { content: expect.stringContaining('Rascunho local.') } });
    } finally {
      client.dispose();
      stop();
      channel.port1.close();
      channel.port2.close();
      await host.dispose();
      await rm(root, { recursive: true, force: true });
    }
  });
});
