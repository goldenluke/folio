// @vitest-environment jsdom

import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { criarServicoDeCompiler } from '@abnt/compiler';
import { asDocumentId } from '@abnt/document-model';
import { CodeMirrorEditorAdapterService, toCodeMirrorDiagnostics } from '@abnt/editor-codemirror';
import { EditorWorkspaceService } from '@abnt/editor-core';
import { WorkspaceLanguageService } from '@abnt/language-service';
import { LocalFilesystemStorage } from '@abnt/workspace-local';
import { SqliteWorkspaceIndex } from '@abnt/workspace-index';
import { criarResolvedorDeAmbienteVazio, DocumentSessionsService } from '@abnt/workspace-sessions';

const ARTICLE = `---
title: [
---

# Introdução

Texto inicial.
`;

const hash = (content: string): string =>
  `sha256:${createHash('sha256').update(content).digest('hex')}`;

const withVault = async (run: (root: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), 'abnt-p7-'));
  try {
    await writeFile(join(root, 'artigo.md'), ARTICLE, 'utf8');
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

beforeAll(() => {
  // jsdom não mede Range; o CodeMirror consulta isto ao posicionar marcadores.
  if (typeof Range.prototype.getClientRects !== 'function') {
    Object.defineProperty(Range.prototype, 'getClientRects', { value: () => [] });
  }
});

describe('P7 — adaptador CodeMirror', () => {
  it('converte diagnósticos para intervalos válidos do editor', () => {
    expect(
      toCodeMirrorDiagnostics(
        [
          {
            id: 'ABNT-EXEMPLO',
            severity: 'error',
            message: 'Erro com intervalo fora dos limites.',
            source: {
              documentId: asDocumentId('document_example'),
              start: { offset: -2 },
              end: { offset: 99 },
            },
          },
          { id: 'SEM-FONTE', severity: 'warning', message: 'Aviso global.' },
        ],
        12,
      ),
    ).toEqual([
      {
        from: 0,
        to: 12,
        severity: 'error',
        message: 'Erro com intervalo fora dos limites.',
        source: 'ABNT-EXEMPLO',
      },
      { from: 0, to: 0, severity: 'warning', message: 'Aviso global.', source: 'SEM-FONTE' },
    ]);
  });

  it('sincroniza view, sessão, seleção e diagnósticos sem manter texto próprio', async () => {
    await withVault(async (root) => {
      const storage = LocalFilesystemStorage.create(root);
      const index = SqliteWorkspaceIndex.create({ storage, databasePath: join(root, '.academic', 'index.sqlite') });
      await index.open();
      const article = (await storage.list())[0];
      if (article === undefined) throw new Error('Artigo inicial ausente.');
      const sessions = DocumentSessionsService.create({
        storage,
        compiler: criarServicoDeCompiler(),
        environment: criarResolvedorDeAmbienteVazio(),
        hashContent: hash,
        autoCompile: false,
      });
      const language = WorkspaceLanguageService.create({ storage, index, sessions });
      const editor = EditorWorkspaceService.create({ sessions, language });
      const parent = document.createElement('div');
      document.body.append(parent);
      let adapter: CodeMirrorEditorAdapterService | undefined;
      const contextMenus: { readonly offset: number; readonly x: number; readonly y: number; readonly selection: { readonly anchor: number; readonly head: number } }[] = [];

      try {
        const controller = await editor.open(article.id);
        await controller.idle();
        adapter = CodeMirrorEditorAdapterService.create({
          controller,
          language,
          parent,
          onContextMenu: (input) => contextMenus.push(input),
        });
        expect(adapter.view.dom.querySelector('.cm-lintRange, .cm-lintPoint')).not.toBeNull();

        Object.defineProperty(adapter.view, 'posAtCoords', { configurable: true, value: () => 7 });
        const contextEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 31, clientY: 47 });
        adapter.view.contentDOM.dispatchEvent(contextEvent);
        expect(contextMenus).toEqual([{ offset: 7, x: 31, y: 47, selection: { anchor: 7, head: 7 } }]);
        expect(contextEvent.defaultPrevented).toBe(true);

        const original = adapter.view.state.doc.toString();
        const start = original.indexOf('Texto inicial');
        const replacement = 'Texto revisado';
        adapter.view.dispatch({
          changes: { from: start, to: start + 'Texto inicial'.length, insert: replacement },
          selection: { anchor: start + replacement.length, head: start + replacement.length },
        });
        await controller.idle();

        expect(controller.snapshot().session.content).toContain(replacement);
        expect(controller.snapshot().selection).toEqual({ anchor: start + replacement.length, head: start + replacement.length });
        expect(adapter.view.state.doc.toString()).toBe(controller.snapshot().session.content);

        controller.dispatch({ edits: [{ range: { start: 0, end: 0 }, text: 'Prefácio\n\n' }] });
        expect(adapter.view.state.doc.toString()).toBe(controller.snapshot().session.content);
        expect(adapter.view.state.doc.toString()).toMatch(/^Prefácio\n\n/);

        // A view é descartável: destruí-la não encerra a sessão/controlador.
        adapter.destroy();
        controller.dispatch({ edits: [{ range: { start: 0, end: 0 }, text: 'Rascunho\n\n' }] });
        expect(controller.snapshot().session.content).toMatch(/^Rascunho\n\nPrefácio/);

        await controller.save();
        await expect(storage.read(article.id)).resolves.toMatchObject({ content: expect.stringContaining(replacement) });

        sessions.close(article.id);
        expect(() => adapter?.focus()).toThrow('adaptador CodeMirror já foi descartado');
      } finally {
        adapter?.destroy();
        parent.remove();
        editor.dispose();
        await sessions.dispose();
        await index.close();
        await storage.close();
      }
    });
  });

  it('Ctrl+Z/Ctrl+Shift+Z desfazem/refazem via teclado, e Ctrl+F abre o painel de busca', async () => {
    await withVault(async (root) => {
      const storage = LocalFilesystemStorage.create(root);
      const index = SqliteWorkspaceIndex.create({ storage, databasePath: join(root, '.academic', 'index.sqlite') });
      await index.open();
      const article = (await storage.list())[0];
      if (article === undefined) throw new Error('Artigo inicial ausente.');
      const sessions = DocumentSessionsService.create({
        storage,
        compiler: criarServicoDeCompiler(),
        environment: criarResolvedorDeAmbienteVazio(),
        hashContent: hash,
        autoCompile: false,
      });
      const language = WorkspaceLanguageService.create({ storage, index, sessions });
      const editor = EditorWorkspaceService.create({ sessions, language });
      const parent = document.createElement('div');
      document.body.append(parent);
      let adapter: CodeMirrorEditorAdapterService | undefined;
      try {
        const controller = await editor.open(article.id);
        await controller.idle();
        adapter = CodeMirrorEditorAdapterService.create({ controller, language, parent });

        // Digitação real dispara pelo próprio keymap do editor, não por dispatch manual —
        // é exatamente o caminho que quebrava quando o menu padrão do Electron
        // interceptava Ctrl+Z antes de virar keydown no DOM (ver apps/desktop/src/main/index.ts).
        const end = adapter.view.state.doc.length;
        adapter.view.dispatch({ changes: { from: end, to: end, insert: 'X' } });
        await controller.idle();
        expect(adapter.view.state.doc.toString().endsWith('X')).toBe(true);

        const undone = adapter.view.contentDOM.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true }));
        await controller.idle();
        expect(undone).toBe(false); // false = preventDefault() foi chamado, ou seja, o keymap tratou a tecla
        expect(adapter.view.state.doc.toString().endsWith('X')).toBe(false);
        expect(controller.snapshot().session.content).toBe(adapter.view.state.doc.toString());

        // Mod-y é o chord-base de redo do historyKeymap (Ctrl-Shift-z só ativa
        // quando a plataforma é detectada como Linux, o que o jsdom não garante).
        const redone = adapter.view.contentDOM.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', ctrlKey: true, bubbles: true, cancelable: true }));
        await controller.idle();
        expect(redone).toBe(false);
        expect(adapter.view.state.doc.toString().endsWith('X')).toBe(true);
        expect(controller.snapshot().session.content).toBe(adapter.view.state.doc.toString());

        expect(adapter.view.dom.querySelector('.cm-search')).toBeNull();
        const opened = adapter.view.contentDOM.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, bubbles: true, cancelable: true }));
        expect(opened).toBe(false);
        expect(adapter.view.dom.querySelector('.cm-search')).not.toBeNull();
      } finally {
        adapter?.destroy();
        parent.remove();
        editor.dispose();
        await sessions.dispose();
        await index.close();
        await storage.close();
      }
    });
  });
});
