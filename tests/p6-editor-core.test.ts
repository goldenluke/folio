import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it } from 'vitest';

import { criarServicoDeCompiler } from '@abnt/compiler';
import { EditorTransactionError, EditorWorkspaceService } from '@abnt/editor-core';
import type {
  LanguageCompletionResult,
  LanguageDiagnostic,
  LanguageHover,
  LanguageLocation,
  LanguageOutlineItem,
  LanguagePosition,
  LanguageService,
} from '@abnt/language-service';
import { WorkspaceLanguageService } from '@abnt/language-service';
import { LocalFilesystemStorage } from '@abnt/workspace-local';
import { SqliteWorkspaceIndex } from '@abnt/workspace-index';
import { criarResolvedorDeAmbienteVazio, DocumentSessionsService } from '@abnt/workspace-sessions';

const ARTICLE = '# Introdução\n\nTexto inicial.\n';

const hash = (content: string): string =>
  `sha256:${createHash('sha256').update(content).digest('hex')}`;

const withVault = async (run: (root: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), 'abnt-p6-'));
  try {
    await writeFile(join(root, 'artigo.md'), ARTICLE, 'utf8');
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

const deferred = <T = void>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
};

describe('P6 — editor-core headless', () => {
  it('aplica transações atômicas, mantém seleção e sincroniza o rascunho com a sessão', async () => {
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

      try {
        const controller = await editor.open(article.id);
        await controller.idle();
        expect(controller.snapshot().outline).toContainEqual(expect.objectContaining({ title: 'Introdução' }));

        const initial = controller.snapshot().session.content;
        const start = initial.indexOf('Texto inicial');
        controller.dispatch({
          edits: [
            { range: { start: 0, end: 0 }, text: 'Prefácio\n\n' },
            { range: { start, end: start + 'Texto inicial'.length }, text: 'Texto revisado' },
            { range: { start: initial.length, end: initial.length }, text: '\n# Resultados\n\nDados.\n' },
          ],
        });
        await controller.idle();

        expect(controller.snapshot()).toMatchObject({
          session: {
            content: 'Prefácio\n\n# Introdução\n\nTexto revisado.\n\n# Resultados\n\nDados.\n',
            dirty: true,
          },
          selection: { anchor: 'Prefácio\n\n'.length, head: 'Prefácio\n\n'.length },
        });
        expect(controller.snapshot().outline).toContainEqual(expect.objectContaining({ title: 'Resultados' }));
        expect(sessions.snapshot(article.id)?.content).toContain('Texto revisado');

        expect(() =>
          controller.dispatch({
            edits: [
              { range: { start: 0, end: 3 }, text: 'A' },
              { range: { start: 2, end: 4 }, text: 'B' },
            ],
          }),
        ).toThrow(EditorTransactionError);

        await controller.save();
        expect(controller.snapshot().session).toMatchObject({ dirty: false, file: { id: article.id } });
        await expect(storage.read(article.id)).resolves.toMatchObject({ content: expect.stringContaining('Resultados') });

        sessions.close(article.id);
        expect(editor.controller(article.id)).toBeUndefined();
        expect(() => controller.dispatch({ selection: { anchor: 0, head: 0 } })).toThrow(
          'controller do editor já foi descartado',
        );
      } finally {
        editor.dispose();
        await sessions.dispose();
        await index.close();
        await storage.close();
      }
    });
  });

  it('descarta projeção antiga quando uma edição nova chega antes da análise lenta', async () => {
    await withVault(async (root) => {
      const storage = LocalFilesystemStorage.create(root);
      const opened = await storage.open();
      const article = opened.files[0];
      if (article === undefined) throw new Error('Artigo inicial ausente.');
      const sessions = DocumentSessionsService.create({
        storage,
        compiler: criarServicoDeCompiler(),
        environment: criarResolvedorDeAmbienteVazio(),
        hashContent: hash,
        autoCompile: false,
      });
      const oldStarted = deferred();
      const releaseOld = deferred();
      const oldCompleted = deferred();
      const language: LanguageService = {
        async outline(fileId) {
          const content = sessions.snapshot(fileId)?.content ?? '';
          if (content.includes('VERSÃO ANTIGA')) {
            oldStarted.resolve();
            await releaseOld.promise;
            oldCompleted.resolve();
            return [{ nodeId: 'old', title: 'Antigo', depth: 1, range: { start: 0, end: 1 } }];
          }
          return [{ nodeId: 'new', title: 'Atual', depth: 1, range: { start: 0, end: 1 } }];
        },
        async diagnostics(): Promise<readonly LanguageDiagnostic[]> {
          return [];
        },
        async completions(): Promise<LanguageCompletionResult | undefined> {
          return undefined;
        },
        async hover(): Promise<LanguageHover | undefined> {
          return undefined;
        },
        async definition(): Promise<readonly LanguageLocation[]> {
          return [];
        },
        async references(): Promise<readonly LanguageLocation[]> {
          return [];
        },
      };
      const editor = EditorWorkspaceService.create({ sessions, language });

      try {
        const controller = await editor.open(article.id);
        controller.dispatch({ edits: [{ range: { start: 0, end: ARTICLE.length }, text: 'VERSÃO ANTIGA' }] });
        await oldStarted.promise;
        controller.dispatch({ edits: [{ range: { start: 0, end: 'VERSÃO ANTIGA'.length }, text: 'VERSÃO ATUAL' }] });
        await controller.idle();
        expect(controller.snapshot().outline).toEqual([
          { nodeId: 'new', title: 'Atual', depth: 1, range: { start: 0, end: 1 } },
        ]);

        releaseOld.resolve();
        await oldCompleted.promise;
        await Promise.resolve();
        expect(controller.snapshot().outline).toEqual([
          { nodeId: 'new', title: 'Atual', depth: 1, range: { start: 0, end: 1 } },
        ]);
      } finally {
        editor.dispose();
        await sessions.dispose();
        await storage.close();
      }
    });
  });
});
