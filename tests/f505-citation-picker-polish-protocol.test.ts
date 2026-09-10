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

Texto citando @tanenbaum2017 e de novo @tanenbaum2017 mais adiante.
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

/** Mesmo padrão de sondagem de tests/p12-references.test.ts — `references` não é revisionado por push. */
const waitForReferences = async (
  client: MessagePortWorkspaceClient,
  fileId: string,
  timeoutMs = 2000,
): Promise<ProtocolResult<readonly WorkspaceReferenceDto[]>> => {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const result = await client.references({ fileId });
    if (!result.ok || (result.value.length > 0 && result.value[0]!.citationCount > 0)) return result;
    if (Date.now() > deadline) return result;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

describe('F505–F507 — Citation Picker Polish (integração de protocolo)', () => {
  it('references() expõe citationCount por documento e rótulos autor/ano prontos para prévia', async () => {
    const root = await mkdtemp(join(tmpdir(), 'abnt-f505-'));
    await writeFile(join(root, 'artigo.md'), ARTIGO, 'utf8');
    await writeFile(join(root, 'referencias.bib'), BIB, 'utf8');
    const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
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
      expect(references).toMatchObject({
        ok: true,
        value: [expect.objectContaining({
          id: 'tanenbaum2017',
          citationCount: 2,
          narrativeAuthor: 'Tanenbaum',
          parentheticalAuthor: 'Tanenbaum',
          year: '2017',
        })],
      });
    } finally {
      client.dispose(); stop(); channel.port1.close(); channel.port2.close(); await host.dispose(); await rm(root, { recursive: true, force: true });
    }
  });
});
