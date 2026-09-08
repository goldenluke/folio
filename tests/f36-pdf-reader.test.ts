import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MessageChannel } from 'node:worker_threads';

import { describe, expect, it } from 'vitest';

import { criarServicoDeCompiler } from '@abnt/compiler';
import { createInProcessCompilerClient, createWorkspaceMessagePortClient, serveWorkspaceOverMessagePort } from '@abnt/protocol';

import { DesktopWorkspaceServiceHost } from '../apps/desktop/src/workspace/workspace-service.js';

describe('F36 — leitor PDF interno e anotações', () => {
  it('expõe bytes sem path, persiste destaque e o envia de modo idempotente para a literature note', async () => {
    const root = await mkdtemp(join(tmpdir(), 'folio-f36-'));
    const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
    const channel = new MessageChannel();
    const stop = serveWorkspaceOverMessagePort(channel.port1, host);
    const client = createWorkspaceMessagePortClient(channel.port2);
    try {
      expect(await client.open({ rootPath: root })).toMatchObject({ ok: true });
      expect(await client.libraryUpsert({ entry: { id: 'silva2024', type: 'article-journal', title: 'Pesquisa local' } })).toMatchObject({ ok: true });
      const bytes = Buffer.from('%PDF-1.4\nconteúdo de teste\n');
      expect(await client.attachReferencePdf({ referenceId: 'silva2024', name: 'pesquisa.pdf', base64: bytes.toString('base64') })).toMatchObject({ ok: true });

      const pdf = await client.referencePdf({ referenceId: 'silva2024' });
      expect(pdf).toMatchObject({ ok: true, value: { attachment: { referenceId: 'silva2024' }, base64: bytes.toString('base64') } });

      const annotation = await client.createPdfAnnotation({ referenceId: 'silva2024', page: 2, quote: 'Trecho importante', comment: 'Relacionar ao método.' });
      expect(annotation).toMatchObject({ ok: true, value: { referenceId: 'silva2024', page: 2, quote: 'Trecho importante' } });
      if (!annotation.ok) return;
      expect(await client.pdfAnnotations({ referenceId: 'silva2024' })).toMatchObject({ ok: true, value: [expect.objectContaining({ id: annotation.value.id })] });

      const linked = await client.linkPdfAnnotation({ referenceId: 'silva2024', id: annotation.value.id });
      expect(linked).toMatchObject({ ok: true, value: { annotation: { literatureNoteFileId: expect.any(String) }, literatureNote: { path: 'papers/silva2024.md' } } });
      if (!linked.ok) return;
      const note = await client.read({ fileId: linked.value.literatureNote.fileId });
      expect(note).toMatchObject({ ok: true, value: { content: expect.stringContaining('PDF, p. 2') } });
      const linkedAgain = await client.linkPdfAnnotation({ referenceId: 'silva2024', id: annotation.value.id });
      expect(linkedAgain).toMatchObject({ ok: true });
      const noteAgain = await client.read({ fileId: linked.value.literatureNote.fileId });
      if (noteAgain.ok) expect(noteAgain.value.content.match(/folio-pdf-annotation:/gu)).toHaveLength(1);

      expect(await client.removePdfAnnotation({ referenceId: 'silva2024', id: annotation.value.id })).toMatchObject({ ok: true });
      expect(await client.pdfAnnotations({ referenceId: 'silva2024' })).toMatchObject({ ok: true, value: [] });
    } finally {
      client.dispose(); stop(); channel.port1.close(); channel.port2.close(); await host.dispose(); await rm(root, { recursive: true, force: true });
    }
  });
});
