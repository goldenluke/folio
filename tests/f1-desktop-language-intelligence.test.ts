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

const ARTICLE = `---
title: Linguagem no desktop
bibliography: referencias.bib
---

# Introdução

Veja [as notas](notas.md), cite @tanenbaum2017 e comece outra citação @tan.
`;
const NOTES = '# Notas\n\nRetorno para [o artigo](artigo.md).\n';
const BIB = '@book{tanenbaum2017, title={Distributed Systems}, author={Tanenbaum, Andrew S.}, year={2017}}\n';

const waitForCompletion = async (client: MessagePortWorkspaceClient, fileId: string, expectedRevision: number) => {
  const offset = ARTICLE.lastIndexOf('@tan') + '@tan'.length;
  const deadline = Date.now() + 2_000;
  for (;;) {
    const result = await client.completions({ fileId, offset, expectedRevision });
    if (!result.ok || result.value?.items.some((item) => item.label === '@tanenbaum2017' && item.detail?.includes('Distributed') === true)) return result;
    if (Date.now() > deadline) return result;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

describe('F1 — inteligência de linguagem no desktop', () => {
  it('atravessa protocolo para completion, hover, definição e referências na revisão atual', async () => {
    const root = await mkdtemp(join(tmpdir(), 'folio-f1-'));
    const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
    const channel = new MessageChannel();
    const stop = serveWorkspaceOverMessagePort(channel.port1, host);
    const client = createWorkspaceMessagePortClient(channel.port2);
    try {
      await writeFile(join(root, 'artigo.md'), ARTICLE, 'utf8');
      await writeFile(join(root, 'notas.md'), NOTES, 'utf8');
      await writeFile(join(root, 'referencias.bib'), BIB, 'utf8');
      const opened = await client.open({ rootPath: root });
      if (!opened.ok) throw new Error('Vault deveria abrir.');
      const article = opened.value.files.find((file) => file.path === 'artigo.md');
      const notes = opened.value.files.find((file) => file.path === 'notas.md');
      const bibliography = opened.value.files.find((file) => file.path === 'referencias.bib');
      if (article === undefined || notes === undefined || bibliography === undefined) throw new Error('Fixture incompleta.');

      const editor = await client.openEditor({ fileId: article.fileId });
      if (!editor.ok) throw new Error('Editor deveria abrir.');
      const revision = editor.value.session.revision;

      await expect(waitForCompletion(client, article.fileId, revision)).resolves.toMatchObject({
        ok: true,
        value: { items: expect.arrayContaining([expect.objectContaining({ label: '@tanenbaum2017', kind: 'citation' })]) },
      });

      const citationOffset = ARTICLE.indexOf('@tanenbaum2017') + 2;
      await expect(client.hover({ fileId: article.fileId, offset: citationOffset, expectedRevision: revision })).resolves.toMatchObject({
        ok: true,
        value: { contents: [expect.stringContaining('Distributed systems')] },
      });
      await expect(client.definition({ fileId: article.fileId, offset: citationOffset, expectedRevision: revision })).resolves.toMatchObject({
        ok: true,
        value: [expect.objectContaining({ fileId: bibliography.fileId, path: 'referencias.bib' })],
      });

      const linkOffset = ARTICLE.indexOf('notas.md') + 2;
      await expect(client.definition({ fileId: article.fileId, offset: linkOffset, expectedRevision: revision })).resolves.toEqual({
        ok: true,
        value: [{ fileId: notes.fileId, path: 'notas.md', range: { start: 0, end: 0 } }],
      });
      await expect(client.languageReferences({ fileId: article.fileId, offset: linkOffset, expectedRevision: revision })).resolves.toMatchObject({
        ok: true,
        value: [expect.objectContaining({ fileId: article.fileId })],
      });

      const changed = await client.dispatchEditor({
        fileId: article.fileId,
        expectedRevision: revision,
        transaction: { edits: [{ range: { start: ARTICLE.length, end: ARTICLE.length }, text: '\nNovo texto.\n' }] },
      });
      if (!changed.ok) throw new Error('Edição deveria ser aceita.');
      await expect(client.hover({ fileId: article.fileId, offset: citationOffset, expectedRevision: revision })).resolves.toMatchObject({
        ok: false,
        error: { code: 'CONFLICT' },
      });
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
