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

const ARTIGO_SEM_BIBLIOGRAPHY = `# Introdução

Sistemas distribuídos exigem coordenação [@tanenbaum2017, p. 10].
`;

const METODOLOGIA_COM_BIB_PROPRIO = `---
bibliography: metodologia.bib
---

# Metodologia

Usa @tanenbaum2017 como referência metodológica.
`;

const BIB_LOCAL = `@book{tanenbaum2017,
  author    = {Tanenbaum, Andrew S.},
  title     = {Distributed Systems (edicao do curso)},
  publisher = {Apostila},
  year      = {2017}
}
`;

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

const withVault = async (run: (root: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), 'abnt-f37-'));
  try {
    await writeFile(join(root, 'artigo.md'), ARTIGO_SEM_BIBLIOGRAPHY, 'utf8');
    await writeFile(join(root, 'metodologia.md'), METODOLOGIA_COM_BIB_PROPRIO, 'utf8');
    await writeFile(join(root, 'metodologia.bib'), BIB_LOCAL, 'utf8');
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

describe('F37 — biblioteca vault-wide disponível para qualquer documento citar', () => {
  it('documento sem "bibliography:" no frontmatter resolve citação pela biblioteca do vault', async () => {
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

        const upserted = await client.libraryUpsert({
          entry: {
            id: 'tanenbaum2017',
            type: 'book',
            title: 'Distributed Systems',
            author: [{ family: 'Tanenbaum', given: 'Andrew S.' }],
            issued: { 'date-parts': [[2017]] },
            publisher: 'Pearson',
          },
        });
        expect(upserted.ok).toBe(true);

        // artigo.md NÃO declara bibliography: no frontmatter.
        const editorArtigo = await client.openEditor({ fileId: artigo.fileId });
        if (!editorArtigo.ok) throw new Error('Editor deveria abrir.');
        const referencesArtigo = await waitForReferences(client, artigo.fileId);
        expect(referencesArtigo).toMatchObject({
          ok: true,
          value: [expect.objectContaining({ id: 'tanenbaum2017' })],
        });
        if (referencesArtigo.ok) expect(referencesArtigo.value[0]?.formatted).toContain('TANENBAUM, Andrew S.');

        // metodologia.md declara seu PRÓPRIO .bib com a MESMA chave — o .bib
        // local é mais específico e vence sobre a biblioteca, sem conflito.
        const editorMetodologia = await client.openEditor({ fileId: metodologia.fileId });
        if (!editorMetodologia.ok) throw new Error('Editor deveria abrir.');
        const referencesMetodologia = await waitForReferences(client, metodologia.fileId);
        expect(referencesMetodologia).toMatchObject({
          ok: true,
          value: [expect.objectContaining({ id: 'tanenbaum2017', sourceLabel: 'metodologia.bib' })],
        });
        if (referencesMetodologia.ok) {
          expect(referencesMetodologia.value[0]?.formatted).toContain('edicao do curso');
        }
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
