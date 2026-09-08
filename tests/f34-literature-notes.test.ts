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
  type ProtocolResult,
  type WorkspaceReferenceDto,
} from '@abnt/protocol';

import { DesktopWorkspaceServiceHost } from '../apps/desktop/src/workspace/workspace-service.js';

const ARTIGO = `---
title: Artigo de teste
bibliography: referencias.bib
---

# Introdução

Texto citando @tanenbaum2017.
`;

const BIB = `@book{tanenbaum2017,
  author    = {Tanenbaum, Andrew S.},
  title     = {Distributed Systems},
  edition   = {3},
  address   = {Boston},
  publisher = {Pearson},
  year      = {2017}
}
`;

const withVault = async (run: (root: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), 'abnt-f34-'));
  try {
    await writeFile(join(root, 'artigo.md'), ARTIGO, 'utf8');
    await writeFile(join(root, 'referencias.bib'), BIB, 'utf8');
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

/** Bibliografia resolve de forma assíncrona após abrir o editor — mesmo padrão de tests/p12-references.test.ts. */
const waitForReferences = async (
  client: MessagePortWorkspaceClient,
  fileId: string,
  timeoutMs = 2000,
): Promise<ProtocolResult<readonly WorkspaceReferenceDto[]>> => {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const result = await client.references({ fileId });
    if (!result.ok || result.value.length > 0) return result;
    if (Date.now() > deadline) return result;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

describe('F34 — literature notes a partir de uma referência bibliográfica', () => {
  it('cria a nota, é idempotente e o arquivo aparece no índice sem sincronização manual', async () => {
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
        if (artigo === undefined) throw new Error('Fixture incompleta.');

        const editor = await client.openEditor({ fileId: artigo.fileId });
        if (!editor.ok) throw new Error('Editor deveria abrir.');
        const references = await waitForReferences(client, artigo.fileId);
        if (!references.ok || references.value.length === 0) throw new Error('Bibliografia deveria resolver.');

        const created = await client.createLiteratureNote({ referenceId: 'tanenbaum2017', activeFileId: artigo.fileId });
        expect(created).toMatchObject({ ok: true, value: { path: 'papers/tanenbaum2017.md' } });
        if (!created.ok) return;

        const content = await client.read({ fileId: created.value.fileId });
        expect(content).toMatchObject({
          ok: true,
          value: { content: expect.stringContaining('sourceReference: tanenbaum2017') },
        });
        if (content.ok) {
          expect(content.value.content).toMatch(/title: "Distributed [Ss]ystems"/u);
          expect(content.value.content).toContain('[@tanenbaum2017]');
        }

        const listed = await client.list({});
        expect(listed).toMatchObject({
          ok: true,
          value: expect.arrayContaining([expect.objectContaining({ path: 'papers/tanenbaum2017.md' })]),
        });

        const createdAgain = await client.createLiteratureNote({ referenceId: 'tanenbaum2017', activeFileId: artigo.fileId });
        expect(createdAgain).toMatchObject({ ok: true, value: { fileId: created.value.fileId, path: 'papers/tanenbaum2017.md' } });

        const missingActiveFile = await client.createLiteratureNote({ referenceId: 'tanenbaum2017', activeFileId: 'file_inexistente' });
        expect(missingActiveFile).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
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
