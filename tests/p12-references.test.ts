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
  const root = await mkdtemp(join(tmpdir(), 'abnt-p12-'));
  try {
    await writeFile(join(root, 'artigo.md'), ARTIGO, 'utf8');
    await writeFile(join(root, 'referencias.bib'), BIB, 'utf8');
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

/** `references` não é revisionado por push; sondar é o mesmo padrão de tests/p10-preview.test.ts. */
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

describe('P12 — reference manager: resolução real de bibliografia no desktop', () => {
  it('resolve o .bib declarado no frontmatter e formata com o motor ABNT do compilador', async () => {
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
        const bib = opened.value.files.find((file) => file.path === 'referencias.bib');
        if (artigo === undefined || bib === undefined) throw new Error('Fixture incompleta.');

        const editor = await client.openEditor({ fileId: artigo.fileId });
        if (!editor.ok) throw new Error('Editor deveria abrir.');

        const references = await waitForReferences(client, artigo.fileId);
        expect(references).toMatchObject({
          ok: true,
          value: [
            expect.objectContaining({
              id: 'tanenbaum2017',
              type: 'book',
              sourceLabel: 'referencias.bib',
              sourceFileId: bib.fileId,
            }),
          ],
        });
        if (!references.ok) throw new Error('Referências deveriam resolver.');
        // Motor ABNT (NBR 6023): sobrenome em maiúsculas, sem depender de citeproc.
        expect(references.value[0]?.formatted).toContain('TANENBAUM, Andrew S.');
        expect(references.value[0]?.formatted).toContain('Boston: Pearson, 2017');

        const missing = await client.references({ fileId: 'file_inexistente' });
        expect(missing).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
      } finally {
        client.dispose();
        stop();
        channel.port1.close();
        channel.port2.close();
        await host.dispose();
      }
    });
  });

  it('documento sem frontmatter "bibliography:" não resolve nenhuma referência', async () => {
    const root = await mkdtemp(join(tmpdir(), 'abnt-p12-empty-'));
    try {
      await writeFile(join(root, 'sem-bib.md'), '# Sem bibliografia\n\nTexto qualquer.\n', 'utf8');
      const host = DesktopWorkspaceServiceHost.create({
        compiler: createInProcessCompilerClient(criarServicoDeCompiler()),
      });
      const channel = new MessageChannel();
      const stop = serveWorkspaceOverMessagePort(channel.port1, host);
      const client = createWorkspaceMessagePortClient(channel.port2);
      try {
        const opened = await client.open({ rootPath: root });
        if (!opened.ok) throw new Error('Vault deveria abrir.');
        const file = opened.value.files[0];
        if (file === undefined) throw new Error('Arquivo ausente.');
        const editor = await client.openEditor({ fileId: file.fileId });
        if (!editor.ok) throw new Error('Editor deveria abrir.');
        await new Promise((resolve) => setTimeout(resolve, 100));
        await expect(client.references({ fileId: file.fileId })).resolves.toEqual({ ok: true, value: [] });
      } finally {
        client.dispose();
        stop();
        channel.port1.close();
        channel.port2.close();
        await host.dispose();
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
