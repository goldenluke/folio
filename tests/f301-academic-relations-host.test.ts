import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MessageChannel } from 'node:worker_threads';

import { describe, expect, it } from 'vitest';

import { criarServicoDeCompiler } from '@abnt/compiler';
import { createInProcessCompilerClient, createWorkspaceMessagePortClient, serveWorkspaceOverMessagePort } from '@abnt/protocol';

import { DesktopWorkspaceServiceHost } from '../apps/desktop/src/workspace/workspace-service.js';

const ARTIGO = `---
bibliography: referencias.bib
---

# Introdução

Sistemas distribuídos exigem coordenação [@tanenbaum2017, p. 10].
`;

const BIB = `@book{tanenbaum2017,
  author    = {Tanenbaum, Andrew S.},
  title     = {Distributed Systems},
  publisher = {Pearson},
  year      = {2017}
}
`;

describe('F301–F306 — academicRelations() deriva relações reais sem materializar nada', () => {
  it('resolve cites/annotates a partir do índice e das anotações, e declara as demais vazias', async () => {
    const root = await mkdtemp(join(tmpdir(), 'folio-academic-relations-'));
    const vault = join(root, 'vault');
    await mkdir(vault);
    await mkdir(join(vault, '.academic', 'relations'), { recursive: true });
    await writeFile(join(vault, 'artigo.md'), ARTIGO, 'utf8');
    await writeFile(join(vault, 'referencias.bib'), BIB, 'utf8');
    await writeFile(join(vault, '.academic', 'relations', 'academic-relations-relations.json'), JSON.stringify({ version: 1, projects: [{ id: 'tcc', documentIds: ['1'], referenceIds: ['tanenbaum2017'] }], datasets: [{ id: 'dados', documentIds: ['1'], referenceIds: [] }], evidence: [{ id: 'review-1', documentIds: [], referenceIds: ['tanenbaum2017'] }] }), 'utf8');
    const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
    const channel = new MessageChannel();
    const stop = serveWorkspaceOverMessagePort(channel.port1, host);
    const client = createWorkspaceMessagePortClient(channel.port2);
    try {
      await client.open({ rootPath: vault });
      await expect(client.libraryUpsert({ entry: { id: 'tanenbaum2017', type: 'book', title: 'Distributed Systems' } })).resolves.toMatchObject({ ok: true });
      await expect(client.createPdfAnnotation({ referenceId: 'tanenbaum2017', page: 3, quote: 'Coordenação explícita' })).resolves.toMatchObject({ ok: true });

      const result = await client.academicRelations();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const { relations } = result.value;

      const cites = relations.filter((relation) => relation.kind === 'cites');
      expect(cites).toEqual(expect.arrayContaining([
        expect.objectContaining({ to: { kind: 'reference', id: 'tanenbaum2017' } }),
        expect.objectContaining({ from: { kind: 'reference', id: 'tanenbaum2017' } }),
      ]));
      for (const relation of cites) {
        expect(relation.from.kind === 'document' || relation.from.kind === 'reference').toBe(true);
        expect(relation.to.kind === 'document' || relation.to.kind === 'reference').toBe(true);
      }

      const annotates = relations.filter((relation) => relation.kind === 'annotates');
      expect(annotates).toEqual(expect.arrayContaining([
        expect.objectContaining({ from: { kind: 'annotation', id: expect.any(String) }, to: { kind: 'reference', id: 'tanenbaum2017' } }),
        expect.objectContaining({ from: { kind: 'reference', id: 'tanenbaum2017' }, to: { kind: 'annotation', id: expect.any(String) } }),
      ]));

      expect(relations).toEqual(expect.arrayContaining([
        expect.objectContaining({ from: { kind: 'reference', id: 'tanenbaum2017' }, to: { kind: 'project', id: 'tcc' }, kind: 'belongs-to-project' }),
        expect.objectContaining({ from: { kind: 'document', id: expect.any(String) }, to: { kind: 'dataset', id: 'dados' }, kind: 'uses-dataset' }),
        expect.objectContaining({ from: { kind: 'evidence', id: 'review-1' }, to: { kind: 'reference', id: 'tanenbaum2017' }, kind: 'evidence-for' }),
      ]));
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
