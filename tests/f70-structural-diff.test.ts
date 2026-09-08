import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MessageChannel } from 'node:worker_threads';

import { describe, expect, it } from 'vitest';

import { criarServicoDeCompiler } from '@abnt/compiler';
import { createInProcessCompilerClient, createWorkspaceMessagePortClient, serveWorkspaceOverMessagePort } from '@abnt/protocol';
import { structuralDiff } from '@abnt/structural-diff';

import { DesktopWorkspaceServiceHost } from '../apps/desktop/src/workspace/workspace-service.js';

describe('F70 — Structural Diff (fatos editoriais, não AST serializada)', () => {
  it('detecta seção renomeada só quando há identificador estável', () => {
    const from = '## Método {#sec:metodo}\n\nTexto.\n';
    const to = '## Metodologia {#sec:metodo}\n\nTexto.\n';
    expect(structuralDiff(from, to)).toEqual([
      { kind: 'section-renamed', description: 'Seção "Método" renomeada para "Metodologia".' },
    ]);
  });

  it('sem identificador, título diferente vira remoção + adição honestas (não inventa "renomeado")', () => {
    const from = '## Método\n\nTexto.\n';
    const to = '## Metodologia\n\nTexto.\n';
    const changes = structuralDiff(from, to);
    expect(changes).toContainEqual({ kind: 'section-added', description: 'Seção "Metodologia" adicionada.' });
    expect(changes).toContainEqual({ kind: 'section-removed', description: 'Seção "Método" removida.' });
    expect(changes.some((change) => change.kind === 'section-renamed')).toBe(false);
  });

  it('detecta citação e figura adicionadas', () => {
    const from = '# Trabalho\n\nTexto sem citação.\n';
    const to = '# Trabalho\n\nVer @silva2024.\n\n![Arquitetura](a.png) {#fig:arq}\n';
    const changes = structuralDiff(from, to);
    expect(changes).toContainEqual({ kind: 'citation-added', description: 'Citação "silva2024" adicionada.' });
    expect(changes).toContainEqual({ kind: 'figure-added', description: 'Figura "Arquitetura" adicionada.' });
  });

  it('detecta figura removida', () => {
    const from = '# Trabalho\n\n![Arquitetura](a.png) {#fig:arq}\n';
    const to = '# Trabalho\n\nSem figura.\n';
    expect(structuralDiff(from, to)).toContainEqual({ kind: 'figure-removed', description: 'Figura "Arquitetura" removida.' });
  });

  it('detecta alvo de link alterado sem confundir com adição/remoção', () => {
    const from = '# Trabalho\n\nVeja [as notas](antigo.md).\n';
    const to = '# Trabalho\n\nVeja [as notas](novo.md).\n';
    expect(structuralDiff(from, to)).toEqual([
      { kind: 'reference-target-changed', description: 'Link "as notas" agora aponta para "novo.md" (era "antigo.md").' },
    ]);
  });

  it('detecta metadado de título alterado', () => {
    const from = '---\ntitle: Rascunho\n---\n\n# Corpo\n';
    const to = '---\ntitle: Versão final\n---\n\n# Corpo\n';
    expect(structuralDiff(from, to)).toContainEqual({ kind: 'metadata-changed', description: 'Título alterado de "Rascunho" para "Versão final".' });
  });

  it('documentos idênticos não produzem fatos', () => {
    const content = '# Trabalho\n\nVer @silva2024.\n';
    expect(structuralDiff(content, content)).toEqual([]);
  });
});

describe('F70 — historyStructuralDiff sobre o protocolo do desktop', () => {
  it('complementa o diff por linha sem substituí-lo', async () => {
    const root = await mkdtemp(join(tmpdir(), 'folio-f70-'));
    const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
    const channel = new MessageChannel();
    const stop = serveWorkspaceOverMessagePort(channel.port1, host);
    const client = createWorkspaceMessagePortClient(channel.port2);
    try {
      await writeFile(join(root, 'nota.md'), '## Método {#sec:metodo}\n\nTexto original.\n', 'utf8');
      const opened = await client.open({ rootPath: root });
      if (!opened.ok) throw new Error('Vault deveria abrir.');
      const file = opened.value.files[0];
      if (file === undefined) throw new Error('Arquivo ausente.');

      const snapshot = await client.historyCreateSnapshot({ fileId: file.fileId, label: 'Antes' });
      if (!snapshot.ok) throw new Error('Snapshot deveria ser criado.');

      const original = '## Método {#sec:metodo}\n\nTexto original.\n';
      const editor = await client.openEditor({ fileId: file.fileId });
      if (!editor.ok) throw new Error('Editor deveria abrir.');
      const changed = await client.dispatchEditor({
        fileId: file.fileId,
        expectedRevision: editor.value.session.revision,
        transaction: { edits: [{ range: { start: 0, end: original.length }, text: '## Metodologia {#sec:metodo}\n\nTexto revisado.\n' }] },
      });
      if (!changed.ok) throw new Error('Edição deveria ser aceita.');
      const saved = await client.saveEditor({ fileId: file.fileId, expectedRevision: changed.value.session.revision });
      if (!saved.ok) throw new Error('Salvar deveria ser aceito.');

      const textDiff = await client.historyDiff({ fileId: file.fileId, fromRevisionId: snapshot.value.id });
      expect(textDiff).toMatchObject({ ok: true, value: { lines: expect.any(Array) } });

      const structural = await client.historyStructuralDiff({ fileId: file.fileId, fromRevisionId: snapshot.value.id });
      expect(structural).toMatchObject({
        ok: true,
        value: { changes: expect.arrayContaining([{ kind: 'section-renamed', description: 'Seção "Método" renomeada para "Metodologia".' }]) },
      });
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
