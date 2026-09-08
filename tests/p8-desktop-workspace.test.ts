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
} from '@abnt/protocol';

import { DesktopWorkspaceServiceHost } from '../apps/desktop/src/workspace/workspace-service.js';

const ARTICLE = '# Introdução\n\nTexto inicial.\n';

const withVault = async (run: (root: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), 'abnt-p8-'));
  try {
    await writeFile(join(root, 'artigo.md'), ARTICLE, 'utf8');
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

describe('P8 — workspace desktop via MessagePort', () => {
  it('reabrir o mesmo vault não descarta a sessão autoritativa usada por outra janela', async () => {
    await withVault(async (root) => {
      const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
      const channel = new MessageChannel(); const stop = serveWorkspaceOverMessagePort(channel.port1, host); const client = createWorkspaceMessagePortClient(channel.port2);
      try {
        const first = await client.open({ rootPath: root });
        if (!first.ok) throw new Error('Vault deveria abrir.');
        const article = first.value.files[0]; if (article === undefined) throw new Error('Arquivo ausente.');
        const editor = await client.openEditor({ fileId: article.fileId }); if (!editor.ok) throw new Error('Editor deveria abrir.');
        const reopened = await client.open({ rootPath: root });
        expect(reopened).toMatchObject({ ok: true, value: { workspaceId: first.value.workspaceId } });
        expect(await client.editorSnapshot({ fileId: article.fileId })).toMatchObject({ ok: true, value: { session: { revision: editor.value.session.revision } } });
      } finally { client.dispose(); stop(); channel.port1.close(); channel.port2.close(); await host.dispose(); }
    });
  });

  it('abre vault, edita por revisão, compila e persiste sem expor filesystem ao cliente', async () => {
    await withVault(async (root) => {
      const host = DesktopWorkspaceServiceHost.create({
        compiler: createInProcessCompilerClient(criarServicoDeCompiler()),
      });
      const channel = new MessageChannel();
      const stop = serveWorkspaceOverMessagePort(channel.port1, host);
      const client = createWorkspaceMessagePortClient(channel.port2);

      try {
        const opened = await client.open({ rootPath: root });
        expect(opened).toMatchObject({ ok: true, value: { files: [{ path: 'artigo.md' }] } });
        if (!opened.ok) throw new Error('Vault deveria abrir.');
        const article = opened.value.files[0];
        if (article === undefined) throw new Error('Arquivo inicial ausente.');

        const editor = await client.openEditor({ fileId: article.fileId });
        expect(editor).toMatchObject({ ok: true, value: { session: { content: ARTICLE, dirty: false } } });
        if (!editor.ok) throw new Error('Editor deveria abrir.');

        const changed = await client.dispatchEditor({
          fileId: article.fileId,
          expectedRevision: editor.value.session.revision,
          transaction: {
            edits: [{ range: { start: ARTICLE.length, end: ARTICLE.length }, text: '\n# Resultados\n\nDados.\n' }],
          },
        });
        expect(changed).toMatchObject({
          ok: true,
          value: { session: { dirty: true, content: expect.stringContaining('# Resultados') } },
        });
        if (!changed.ok) throw new Error('Edição deveria ser aceita.');

        const current = await client.editorSnapshot({ fileId: article.fileId });
        if (!current.ok) throw new Error('Snapshot deveria estar disponível.');
        const saved = await client.saveEditor({ fileId: article.fileId, expectedRevision: current.value.session.revision });
        expect(saved).toMatchObject({ ok: true, value: { session: { dirty: false } } });

        const persisted = await client.read({ fileId: article.fileId });
        expect(persisted).toMatchObject({ ok: true, value: { content: expect.stringContaining('# Resultados') } });

        const invalid = await client.open({ rootPath: '' });
        expect(invalid).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
      } finally {
        client.dispose();
        stop();
        channel.port1.close();
        channel.port2.close();
        await host.dispose();
      }
    });
  });
});
