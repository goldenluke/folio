import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MessageChannel } from 'node:worker_threads';

import { describe, expect, it } from 'vitest';

import { criarServicoDeCompiler } from '@abnt/compiler';
import { createInProcessCompilerClient, createWorkspaceMessagePortClient, serveWorkspaceOverMessagePort } from '@abnt/protocol';
import { asWorkspaceFileId, asWorkspacePath, type WorkspaceFile } from '@abnt/workspace-core';
import { buildWorkspaceGraph } from '@abnt/workspace-graph';

import { DesktopWorkspaceServiceHost } from '../apps/desktop/src/workspace/workspace-service.js';

describe('F5 — buildWorkspaceGraph (puro, sem I/O)', () => {
  it('monta nodes/edges a partir de projeções já buscadas do índice', () => {
    const artigo: WorkspaceFile = {
      id: asWorkspaceFileId('file_artigo'),
      path: asWorkspacePath('artigo.md'),
      revision: 1,
      contentHash: 'sha256:a' as never,
    };
    const notas: WorkspaceFile = {
      id: asWorkspaceFileId('file_notas'),
      path: asWorkspacePath('notas.md'),
      revision: 1,
      contentHash: 'sha256:b' as never,
    };

    const graph = buildWorkspaceGraph({
      files: [artigo, notas],
      links: [
        {
          fileId: artigo.id,
          nodeId: 'n1',
          path: artigo.path,
          target: 'notas.md',
          kind: 'document',
          label: 'as notas',
          sourceStart: 0,
          sourceEnd: 10,
        },
      ],
      citations: [
        {
          fileId: artigo.id,
          nodeId: 'n2',
          path: artigo.path,
          referenceId: 'silva2024',
          mode: 'parenthetical',
          sourceStart: 20,
          sourceEnd: 30,
        },
      ],
      resources: [
        { fileId: artigo.id, path: artigo.path, resourceId: 'r1', uri: 'figuras/modelo.svg' },
      ],
      tags: [{ fileId: artigo.id, tags: ['metodologia'] }],
    });

    expect(graph.nodes).toContainEqual(expect.objectContaining({ id: `document:${artigo.id}`, kind: 'document' }));
    expect(graph.nodes).toContainEqual(expect.objectContaining({ id: `document:${notas.id}`, kind: 'document' }));
    expect(graph.nodes).toContainEqual(
      expect.objectContaining({ id: 'reference:silva2024', kind: 'reference', resolved: false }),
    );
    expect(graph.nodes).toContainEqual(expect.objectContaining({ id: 'resource:r1', kind: 'resource' }));
    expect(graph.nodes).toContainEqual(expect.objectContaining({ id: 'tag:metodologia', kind: 'tag', label: '#metodologia' }));

    expect(graph.edges).toContainEqual(
      expect.objectContaining({ kind: 'links-to', from: `document:${artigo.id}`, to: `document:${notas.id}` }),
    );
    expect(graph.edges).toContainEqual(
      expect.objectContaining({ kind: 'cites', from: `document:${artigo.id}`, to: 'reference:silva2024' }),
    );
    expect(graph.edges).toContainEqual(
      expect.objectContaining({ kind: 'embeds', from: `document:${artigo.id}`, to: 'resource:r1' }),
    );
    expect(graph.edges).toContainEqual(
      expect.objectContaining({ kind: 'tagged-with', from: `document:${artigo.id}`, to: 'tag:metodologia' }),
    );
  });

  it('link para arquivo inexistente não gera aresta órfã', () => {
    const artigo: WorkspaceFile = {
      id: asWorkspaceFileId('file_artigo'),
      path: asWorkspacePath('artigo.md'),
      revision: 1,
      contentHash: 'sha256:a' as never,
    };
    const graph = buildWorkspaceGraph({
      files: [artigo],
      links: [{ fileId: artigo.id, nodeId: 'n1', path: artigo.path, target: 'inexistente.md', kind: 'document', label: 'x' }],
      citations: [],
      resources: [],
    });
    expect(graph.edges).toHaveLength(0);
  });
});

const ARTIGO = [
  '---',
  'tags: [metodologia]',
  '---',
  '',
  '# Introdução',
  '',
  'Cita [@silva2024] e linka para [as notas](notas.md).',
  '',
  '![Modelo](figuras/modelo.svg)',
  '',
].join('\n');

const withVault = async (run: (root: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), 'abnt-f5-'));
  try {
    await mkdir(join(root, 'figuras'), { recursive: true });
    await writeFile(join(root, 'artigo.md'), ARTIGO, 'utf8');
    await writeFile(join(root, 'notas.md'), '# Notas\n\nConhecimento relacionado.\n', 'utf8');
    await writeFile(join(root, 'figuras', 'modelo.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>', 'utf8');
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

describe('F5 — workspace/graph sobre o protocolo do desktop', () => {
  it('agrega links, citações e recursos do índice num único grafo', async () => {
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
        const notas = opened.value.files.find((file) => file.path === 'notas.md');
        if (artigo === undefined || notas === undefined) throw new Error('Fixture incompleta.');

        const graph = await client.graph({});
        expect(graph.ok).toBe(true);
        if (!graph.ok) return;

        expect(graph.value.nodes).toContainEqual(
          expect.objectContaining({ kind: 'document', fileId: artigo.fileId, path: 'artigo.md' }),
        );
        expect(graph.value.nodes).toContainEqual(
          expect.objectContaining({ kind: 'document', fileId: notas.fileId, path: 'notas.md' }),
        );
        expect(graph.value.nodes).toContainEqual(
          expect.objectContaining({ kind: 'reference', referenceId: 'silva2024', resolved: false }),
        );
        expect(graph.value.nodes).toContainEqual(expect.objectContaining({ kind: 'resource' }));

        expect(graph.value.edges).toContainEqual(
          expect.objectContaining({ kind: 'links-to', from: `document:${artigo.fileId}`, to: `document:${notas.fileId}` }),
        );
        expect(graph.value.edges).toContainEqual(
          expect.objectContaining({ kind: 'cites', from: `document:${artigo.fileId}`, to: 'reference:silva2024' }),
        );
        expect(graph.value.edges).toContainEqual(
          expect.objectContaining({ kind: 'embeds', from: `document:${artigo.fileId}` }),
        );

        const tagged = await client.graph({ includeTags: true, focusFileId: artigo.fileId, depth: 1 });
        expect(tagged.ok).toBe(true);
        if (!tagged.ok) return;
        expect(tagged.value.nodes).toContainEqual(expect.objectContaining({ kind: 'tag', label: '#metodologia' }));
        expect(tagged.value.nodes).toContainEqual(expect.objectContaining({ kind: 'document', fileId: artigo.fileId }));
        expect(tagged.value.nodes).toContainEqual(expect.objectContaining({ kind: 'document', fileId: notas.fileId }));
        expect(tagged.value.edges.every((edge) => edge.from === `document:${artigo.fileId}` || edge.to === `document:${artigo.fileId}`)).toBe(true);
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
