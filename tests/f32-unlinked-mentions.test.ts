import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MessageChannel } from 'node:worker_threads';

import { describe, expect, it } from 'vitest';

import { criarServicoDeCompiler } from '@abnt/compiler';
import { createInProcessCompilerClient, createWorkspaceMessagePortClient, serveWorkspaceOverMessagePort } from '@abnt/protocol';

import { DesktopWorkspaceServiceHost } from '../apps/desktop/src/workspace/workspace-service.js';

const METODOLOGIA = `---
title: Metodologia qualitativa
---

# Metodologia

Descrição do método.
`;

const ARTIGO = [
  '# Introdução',
  '',
  'Este trabalho usa metodologia qualitativa para investigar o fenômeno.',
  '',
  'Como mostra [Metodologia qualitativa](metodologia.md), o desenho é adequado.',
  '',
].join('\n');

const withVault = async (run: (root: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), 'abnt-f32-'));
  try {
    await writeFile(join(root, 'artigo.md'), ARTIGO, 'utf8');
    await writeFile(join(root, 'metodologia.md'), METODOLOGIA, 'utf8');
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

describe('F32 — menções não linkadas (Backlinks 2.0)', () => {
  it('sinaliza título de outro documento mencionado em prosa, mas não a ocorrência já linkada', async () => {
    await withVault(async (root) => {
      const host = DesktopWorkspaceServiceHost.create({
        compiler: createInProcessCompilerClient(criarServicoDeCompiler()),
      });
      const channel = new MessageChannel();
      const stop = serveWorkspaceOverMessagePort(channel.port1, host);
      const client = createWorkspaceMessagePortClient(channel.port2);

      try {
        const opened = await client.open({ rootPath: root });
        if (!opened.ok) throw new Error('Vault deveria abrir.');
        const artigo = opened.value.files.find((file) => file.path === 'artigo.md');
        const metodologia = opened.value.files.find((file) => file.path === 'metodologia.md');
        if (artigo === undefined || metodologia === undefined) throw new Error('Fixture incompleta.');

        const editor = await client.openEditor({ fileId: artigo.fileId });
        if (!editor.ok) throw new Error('Editor deveria abrir.');
        const revision = editor.value.session.revision;

        const mentions = await client.unlinkedMentions({ fileId: artigo.fileId, expectedRevision: revision });
        expect(mentions.ok).toBe(true);
        if (!mentions.ok) return;

        // Só a ocorrência em prosa (fora do link) é sinalizada — uma só, não duas.
        expect(mentions.value).toHaveLength(1);
        expect(mentions.value[0]).toMatchObject({
          targetFileId: metodologia.fileId,
          targetPath: 'metodologia.md',
          text: 'metodologia qualitativa',
        });
        const expectedStart = ARTIGO.indexOf('metodologia qualitativa');
        expect(mentions.value[0]?.range).toEqual({ start: expectedStart, end: expectedStart + 'metodologia qualitativa'.length });

        const changed = await client.dispatchEditor({
          fileId: artigo.fileId,
          expectedRevision: revision,
          transaction: { edits: [{ range: { start: ARTIGO.length, end: ARTIGO.length }, text: '\nMais texto.\n' }] },
        });
        if (!changed.ok) throw new Error('Edição deveria ser aceita.');

        const stale = await client.unlinkedMentions({ fileId: artigo.fileId, expectedRevision: revision });
        expect(stale).toMatchObject({ ok: false, error: { code: 'CONFLICT' } });
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
