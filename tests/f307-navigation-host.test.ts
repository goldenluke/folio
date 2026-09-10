import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MessageChannel } from 'node:worker_threads';

import { describe, expect, it } from 'vitest';

import { criarServicoDeCompiler } from '@abnt/compiler';
import { createInProcessCompilerClient, createWorkspaceMessagePortClient, serveWorkspaceOverMessagePort } from '@abnt/protocol';

import { DesktopWorkspaceServiceHost } from '../apps/desktop/src/workspace/workspace-service.js';

const ARTIGO = `---
title: Coordenação distribuída
---

# Introdução

Sistemas distribuídos exigem coordenação explícita entre os nós envolvidos.

# Metodologia

Estudo de caso conduzido em equipes remotas geograficamente dispersas.
`;

describe('F307–F325 — Onda AT: bookmarks store e Peek Service', () => {
  it('persiste bookmarks em .academic/bookmarks e resolve peek real para document/section/reference/annotation', async () => {
    const root = await mkdtemp(join(tmpdir(), 'folio-navigation-'));
    const vault = join(root, 'vault');
    await mkdir(vault);
    await writeFile(join(vault, 'artigo.md'), ARTIGO, 'utf8');
    const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
    const channel = new MessageChannel();
    const stop = serveWorkspaceOverMessagePort(channel.port1, host);
    const client = createWorkspaceMessagePortClient(channel.port2);
    try {
      await client.open({ rootPath: vault });
      const files = await client.list({});
      expect(files.ok).toBe(true);
      if (!files.ok) return;
      const artigo = files.value.find((file) => file.path === 'artigo.md');
      expect(artigo).toBeDefined();
      if (artigo === undefined) return;

      // Bookmarks: round-trip através de .academic/bookmarks/*.json
      const bookmark = { version: 1 as const, id: 'b1', label: 'Introdução do artigo', target: { kind: 'document' as const, fileId: artigo.fileId, path: artigo.path }, createdAt: '2026-09-09T00:00:00Z' };
      await expect(client.setBookmarks({ version: 1, bookmarks: [bookmark] })).resolves.toMatchObject({ ok: true, value: { bookmarks: [{ id: 'b1', label: 'Introdução do artigo' }] } });
      const raw = await readFile(join(vault, '.academic', 'bookmarks', 'bookmarks-bookmarks.json'), 'utf8');
      expect(raw).toContain('Introdução do artigo');
      expect(raw).not.toContain('sqlite');
      await expect(client.bookmarks()).resolves.toMatchObject({ ok: true, value: { bookmarks: [{ id: 'b1' }] } });

      // Peek: document — excerto real do corpo, não string hardcoded.
      const documentPeek = await client.peek({ target: { kind: 'document', fileId: artigo.fileId, path: artigo.path } });
      expect(documentPeek.ok).toBe(true);
      if (documentPeek.ok) {
        expect(documentPeek.value.entity?.kind).toBe('document');
        expect(documentPeek.value.entity?.excerpt).toContain('coordenação explícita');
      }

      // Peek: section — excerto ao redor do offset do segundo parágrafo.
      const sectionOffset = ARTIGO.indexOf('Estudo de caso');
      const sectionPeek = await client.peek({ target: { kind: 'section', fileId: artigo.fileId, path: artigo.path, offset: sectionOffset } });
      expect(sectionPeek.ok).toBe(true);
      if (sectionPeek.ok) expect(sectionPeek.value.entity?.excerpt).toContain('equipes remotas');

      // Peek: reference — via biblioteca real.
      await expect(client.libraryUpsert({ entry: { id: 'tanenbaum2017', type: 'book', title: 'Distributed Systems', author: [{ family: 'Tanenbaum', given: 'Andrew S.' }] } })).resolves.toMatchObject({ ok: true });
      const referencePeek = await client.peek({ target: { kind: 'reference', referenceId: 'tanenbaum2017' } });
      expect(referencePeek.ok).toBe(true);
      if (referencePeek.ok) expect(referencePeek.value.entity).toMatchObject({ kind: 'reference', title: 'Distributed Systems', authors: 'Tanenbaum, Andrew S.' });

      // Peek: annotation — via anotação de PDF real.
      const annotation = await client.createPdfAnnotation({ referenceId: 'tanenbaum2017', page: 3, quote: 'Coordenação explícita entre nós.' });
      expect(annotation.ok).toBe(true);
      if (annotation.ok) {
        const annotationPeek = await client.peek({ target: { kind: 'annotation', referenceId: 'tanenbaum2017', annotationId: annotation.value.id } });
        expect(annotationPeek.ok).toBe(true);
        if (annotationPeek.ok) expect(annotationPeek.value.entity).toMatchObject({ kind: 'annotation', excerpt: 'Coordenação explícita entre nós.' });
      }

      // Escopo honesto: project/view/search/dataset não resolvem no host; lookups inexistentes também não.
      for (const target of [{ kind: 'project' as const, projectId: 'p1' }, { kind: 'view' as const, viewId: 'v1' }, { kind: 'search' as const, query: 'year:2025' }, { kind: 'dataset' as const, datasetId: 'd1' }]) {
        const result = await client.peek({ target });
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value.entity).toBeUndefined();
      }
      const missingReference = await client.peek({ target: { kind: 'reference', referenceId: 'nao-existe' } });
      expect(missingReference.ok).toBe(true);
      if (missingReference.ok) expect(missingReference.value.entity).toBeUndefined();
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
