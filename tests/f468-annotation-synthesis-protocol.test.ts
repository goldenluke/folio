import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MessageChannel } from 'node:worker_threads';

import { describe, expect, it } from 'vitest';

import { criarServicoDeCompiler } from '@abnt/compiler';
import { createInProcessCompilerClient, createWorkspaceMessagePortClient, serveWorkspaceOverMessagePort } from '@abnt/protocol';

import { DesktopWorkspaceServiceHost } from '../apps/desktop/src/workspace/workspace-service.js';

describe('F468–F475 — Annotation Synthesis (integração de protocolo)', () => {
  it('sintetiza anotações de múltiplas fontes num documento existente, com cor, template e idempotência', async () => {
    const root = await mkdtemp(join(tmpdir(), 'abnt-f468-'));
    const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
    const channel = new MessageChannel();
    const stop = serveWorkspaceOverMessagePort(channel.port1, host);
    const client = createWorkspaceMessagePortClient(channel.port2);
    try {
      expect(await client.open({ rootPath: root })).toMatchObject({ ok: true });
      expect(await client.libraryUpsert({ entry: { id: 'silva2020', type: 'article-journal', title: 'Estudo original' } })).toMatchObject({ ok: true });
      expect(await client.libraryUpsert({ entry: { id: 'costa2021', type: 'article-journal', title: 'Estudo relacionado' } })).toMatchObject({ ok: true });

      const colorSet = await client.setAnnotationColorSemantics({ colors: { '#fde047': 'Evidência' } });
      expect(colorSet).toMatchObject({ ok: true, value: { '#fde047': 'Evidência' } });
      expect(await client.annotationColorSemantics()).toMatchObject({ ok: true, value: { '#fde047': 'Evidência' } });

      const a1 = await client.createPdfAnnotation({ referenceId: 'silva2020', page: 3, quote: 'trecho do estudo original', color: '#fde047' });
      const a2 = await client.createPdfAnnotation({ referenceId: 'costa2021', page: 7, quote: 'trecho do estudo relacionado' });
      expect(a1).toMatchObject({ ok: true, value: { color: '#fde047' } });
      expect(a2).toMatchObject({ ok: true });
      if (!a1.ok || !a2.ok) return;

      const allAnnotations = await client.annotations({});
      expect(allAnnotations).toMatchObject({ ok: true });
      if (allAnnotations.ok) expect(allAnnotations.value.map((item) => item.id).sort()).toEqual([a1.value.id, a2.value.id].sort());
      const filtered = await client.annotations({ referenceId: 'silva2020' });
      expect(filtered).toMatchObject({ ok: true, value: [expect.objectContaining({ id: a1.value.id })] });

      const target = await client.createDocument({ path: 'notas/sintese.md', content: '# Síntese\n' });
      expect(target).toMatchObject({ ok: true });
      if (!target.ok) return;

      const synthesized = await client.synthesizeAnnotations({
        annotationIds: [a1.value.id, a2.value.id], template: 'grouped-by-source', target: { kind: 'file', fileId: target.value.fileId },
      });
      expect(synthesized).toMatchObject({ ok: true });
      if (!synthesized.ok) return;
      expect(synthesized.value.insertedIds.sort()).toEqual([a1.value.id, a2.value.id].sort());
      expect(synthesized.value.skippedIds).toEqual([]);

      const written = await client.read({ fileId: target.value.fileId });
      expect(written).toMatchObject({ ok: true });
      if (!written.ok) return;
      expect(written.value.content).toContain('### Estudo original');
      expect(written.value.content).toContain('### Estudo relacionado');
      expect(written.value.content).toContain('[@silva2020, p. 3]');
      expect(written.value.content).toContain('[@costa2021, p. 7]');
      expect(written.value.content).toContain(`<!-- folio-pdf-annotation:${a1.value.id} -->`);

      // Idempotência: repetir não duplica nenhum bloco.
      const repeated = await client.synthesizeAnnotations({ annotationIds: [a1.value.id, a2.value.id], template: 'grouped-by-source', target: { kind: 'file', fileId: target.value.fileId } });
      expect(repeated).toMatchObject({ ok: true, value: { insertedIds: [], skippedIds: expect.arrayContaining([a1.value.id, a2.value.id]) } });
      const rewritten = await client.read({ fileId: target.value.fileId });
      if (rewritten.ok) expect(rewritten.value.content.match(new RegExp(`folio-pdf-annotation:${a1.value.id}`, 'gu'))).toHaveLength(1);

      // Destino "referência": cria/usa a literature note da fonte, igual ao F36.4.
      const bySource = await client.synthesizeAnnotations({ annotationIds: [a1.value.id], template: 'quote-list', target: { kind: 'reference', referenceId: 'silva2020' } });
      expect(bySource).toMatchObject({ ok: true, value: { file: { path: 'papers/silva2020.md' } } });

      // Alvo/anotação inexistente é erro, não sucesso silencioso.
      const missingTarget = await client.synthesizeAnnotations({ annotationIds: [a1.value.id], template: 'quote-list', target: { kind: 'file', fileId: 'file_inexistente' } });
      expect(missingTarget.ok).toBe(false);
      const missingAnnotation = await client.synthesizeAnnotations({ annotationIds: ['anotacao_inexistente'], template: 'quote-list', target: { kind: 'file', fileId: target.value.fileId } });
      expect(missingAnnotation.ok).toBe(false);
    } finally {
      client.dispose(); stop(); channel.port1.close(); channel.port2.close(); await host.dispose(); await rm(root, { recursive: true, force: true });
    }
  });
});
