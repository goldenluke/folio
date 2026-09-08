import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MessageChannel } from 'node:worker_threads';

import { describe, expect, it } from 'vitest';

import { asReferenceId, type BibliographicEntity } from '@abnt/document-model';
import { criarServicoDeCompiler } from '@abnt/compiler';
import { createInProcessCompilerClient, createWorkspaceMessagePortClient, serveWorkspaceOverMessagePort } from '@abnt/protocol';
import { asWorkspaceFileId, asWorkspacePath, type WorkspaceFile } from '@abnt/workspace-core';
import { buildWorkspaceGraph } from '@abnt/workspace-graph';

import { DesktopWorkspaceServiceHost } from '../apps/desktop/src/workspace/workspace-service.js';

describe('F33 — buildWorkspaceGraph com bibliografia (person/organization)', () => {
  it('gera nó person e aresta authored-by a partir de author/editor da entrada .bib', () => {
    const artigo: WorkspaceFile = {
      id: asWorkspaceFileId('file_artigo'),
      path: asWorkspacePath('artigo.md'),
      revision: 1,
      contentHash: 'sha256:a' as never,
    };
    const entity: BibliographicEntity = {
      id: asReferenceId('tanenbaum2017'),
      type: 'book',
      title: 'Distributed Systems',
      author: [{ given: 'Andrew S.', family: 'Tanenbaum' }],
    };

    const graph = buildWorkspaceGraph({
      files: [artigo],
      links: [],
      citations: [
        { fileId: artigo.id, nodeId: 'n1', path: artigo.path, referenceId: 'tanenbaum2017', mode: 'parenthetical' },
      ],
      resources: [],
      bibliography: new Map([['tanenbaum2017', { entity }]]),
    });

    const personNode = graph.nodes.find((node) => node.kind === 'person');
    expect(personNode).toMatchObject({ label: 'Andrew S. Tanenbaum' });
    expect(graph.nodes.find((node) => node.id === 'reference:tanenbaum2017')).toMatchObject({ resolved: true });
    expect(graph.edges).toContainEqual(
      expect.objectContaining({ kind: 'authored-by', from: 'reference:tanenbaum2017', to: personNode?.id }),
    );
  });

  it('sem bibliography nenhum nó person aparece (F5 v1 continua funcionando)', () => {
    const artigo: WorkspaceFile = {
      id: asWorkspaceFileId('file_artigo'),
      path: asWorkspacePath('artigo.md'),
      revision: 1,
      contentHash: 'sha256:a' as never,
    };
    const graph = buildWorkspaceGraph({
      files: [artigo],
      links: [],
      citations: [{ fileId: artigo.id, nodeId: 'n1', path: artigo.path, referenceId: 'x', mode: 'parenthetical' }],
      resources: [],
    });
    expect(graph.nodes.some((node) => node.kind === 'person')).toBe(false);
    expect(graph.nodes.find((node) => node.id === 'reference:x')).toMatchObject({ resolved: false });
  });
});

const ARTIGO = `---
bibliography: referencias.bib
---

# Introdução

Sistemas distribuídos [@tanenbaum2017].
`;

const BIB = `@book{tanenbaum2017,
  author    = {Tanenbaum, Andrew S.},
  title     = {Distributed Systems},
  publisher = {Pearson},
  year      = {2017}
}
`;

const withVault = async (run: (root: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), 'abnt-f33-'));
  try {
    await writeFile(join(root, 'artigo.md'), ARTIGO, 'utf8');
    await writeFile(join(root, 'referencias.bib'), BIB, 'utf8');
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

describe('F33 — workspace/graph com includePeople sobre o protocolo do desktop', () => {
  it('inclui nó person só quando includePeople é pedido', async () => {
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

        const withoutPeople = await client.graph({});
        expect(withoutPeople.ok).toBe(true);
        if (withoutPeople.ok) expect(withoutPeople.value.nodes.some((node) => node.kind === 'person')).toBe(false);

        const withPeople = await client.graph({ includePeople: true });
        expect(withPeople.ok).toBe(true);
        if (withPeople.ok) {
          expect(withPeople.value.nodes).toContainEqual(
            expect.objectContaining({ kind: 'person', label: 'Andrew S. Tanenbaum' }),
          );
          expect(withPeople.value.edges).toContainEqual(
            expect.objectContaining({ kind: 'authored-by', from: 'reference:tanenbaum2017' }),
          );
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
