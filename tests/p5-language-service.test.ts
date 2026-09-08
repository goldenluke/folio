import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it } from 'vitest';

import { criarServicoDeCompiler } from '@abnt/compiler';
import {
  WorkspaceLanguageService,
  type LanguageReferenceCatalog,
} from '@abnt/language-service';
import { LocalFilesystemStorage } from '@abnt/workspace-local';
import { SqliteWorkspaceIndex } from '@abnt/workspace-index';
import { criarResolvedorDeAmbienteVazio, DocumentSessionsService } from '@abnt/workspace-sessions';

const ARTICLE = `# Introdução

Segundo @tanenbaum2017, sistemas distribuídos exigem coordenação.

Veja [as notas](notas.md).
`;

const hash = (content: string): string =>
  `sha256:${createHash('sha256').update(content).digest('hex')}`;

const withVault = async (run: (root: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), 'abnt-p5-'));
  try {
    await mkdir(join(root, 'referencias'), { recursive: true });
    await writeFile(join(root, 'artigo.md'), ARTICLE, 'utf8');
    await writeFile(join(root, 'notas.md'), '# Notas\n\nConhecimento relacionado em @tanenbaum2017.\n', 'utf8');
    await writeFile(join(root, 'referencias', 'referencias.bib'), '@book{tanenbaum2017, title={Distributed Systems}}\n', 'utf8');
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

describe('P5 — language service headless', () => {
  it('usa a AST atual para outline/hover/definição e o índice para referências globais', async () => {
    await withVault(async (root) => {
      const storage = LocalFilesystemStorage.create(root);
      const index = SqliteWorkspaceIndex.create({
        storage,
        databasePath: join(root, '.academic', 'index.sqlite'),
      });
      await index.open();
      const files = await storage.list();
      const article = files.find((file) => file.path === 'artigo.md');
      const notes = files.find((file) => file.path === 'notas.md');
      const bibliography = files.find((file) => file.path === 'referencias/referencias.bib');
      if (article === undefined || notes === undefined || bibliography === undefined) throw new Error('Fixture incompleta.');

      const catalog: LanguageReferenceCatalog = {
        async search(query) {
          return 'tanenbaum2017'.includes(query) ? [{ id: 'tanenbaum2017', title: 'Distributed Systems' }] : [];
        },
        async find(referenceId) {
          return referenceId === 'tanenbaum2017'
            ? {
                id: 'tanenbaum2017',
                title: 'Distributed Systems',
                authors: ['Andrew S. Tanenbaum'],
                issued: '2017',
                definition: {
                  fileId: bibliography.id,
                  path: bibliography.path,
                  range: { start: 0, end: 18 },
                },
              }
            : undefined;
        },
      };
      const sessions = DocumentSessionsService.create({
        storage,
        compiler: criarServicoDeCompiler(),
        environment: criarResolvedorDeAmbienteVazio(),
        hashContent: hash,
        autoCompile: false,
      });
      const language = WorkspaceLanguageService.create({ storage, index, sessions, references: catalog });

      try {
        await sessions.open(article.id);
        const citationOffset = ARTICLE.indexOf('@tanenbaum2017') + 4;
        const linkOffset = ARTICLE.indexOf('notas.md') + 2;

        await expect(language.outline(article.id)).resolves.toContainEqual(
          expect.objectContaining({ title: 'Introdução', depth: 1 }),
        );
        await expect(language.hover({ fileId: article.id, offset: citationOffset })).resolves.toMatchObject({
          contents: ['@tanenbaum2017 — Distributed Systems — Andrew S. Tanenbaum, 2017'],
        });
        await expect(language.definition({ fileId: article.id, offset: citationOffset })).resolves.toEqual([
          { fileId: bibliography.id, path: bibliography.path, range: { start: 0, end: 18 } },
        ]);
        await expect(language.definition({ fileId: article.id, offset: linkOffset })).resolves.toEqual([
          { fileId: notes.id, path: notes.path, range: { start: 0, end: 0 } },
        ]);
        await expect(language.references({ fileId: article.id, offset: citationOffset })).resolves.toContainEqual(
          expect.objectContaining({ fileId: article.id, path: article.path }),
        );
        await expect(language.references({ fileId: article.id, offset: citationOffset })).resolves.toContainEqual(
          expect.objectContaining({ fileId: notes.id, path: notes.path }),
        );
        await expect(language.references({ fileId: article.id, offset: linkOffset })).resolves.toContainEqual(
          expect.objectContaining({ fileId: article.id, path: article.path }),
        );
      } finally {
        await sessions.dispose();
        await index.close();
        await storage.close();
      }
    });
  });

  it('prioriza o rascunho aberto para autocomplete, outline e diagnósticos', async () => {
    await withVault(async (root) => {
      const storage = LocalFilesystemStorage.create(root);
      const index = SqliteWorkspaceIndex.create({
        storage,
        databasePath: join(root, '.academic', 'index.sqlite'),
      });
      await index.open();
      const article = (await storage.list()).find((file) => file.path === 'artigo.md');
      if (article === undefined) throw new Error('Artigo ausente.');
      const catalog: LanguageReferenceCatalog = {
        async search(query) {
          return 'tanenbaum2017'.includes(query) ? [{ id: 'tanenbaum2017', title: 'Distributed Systems' }] : [];
        },
        async find() {
          return undefined;
        },
      };
      const sessions = DocumentSessionsService.create({
        storage,
        compiler: criarServicoDeCompiler(),
        environment: criarResolvedorDeAmbienteVazio(),
        hashContent: hash,
        autoCompile: false,
      });
      const language = WorkspaceLanguageService.create({ storage, index, sessions, references: catalog });

      try {
        await sessions.open(article.id);
        const citationDraft = `${ARTICLE}\nCite @tan`;
        sessions.replaceContent(article.id, citationDraft);
        await expect(
          language.completions({ fileId: article.id, offset: citationDraft.length }),
        ).resolves.toMatchObject({
          range: { start: citationDraft.length - 3, end: citationDraft.length },
          items: [expect.objectContaining({ kind: 'citation', label: '@tanenbaum2017', insertText: 'tanenbaum2017' })],
        });

        const linkDraft = `${ARTICLE}\nVeja [nota](`;
        sessions.replaceContent(article.id, linkDraft);
        await expect(
          language.completions({ fileId: article.id, offset: linkDraft.length }),
        ).resolves.toMatchObject({
          items: [expect.objectContaining({ kind: 'document', label: 'notas.md', insertText: 'notas.md' })],
        });

        const updated = `${ARTICLE}\n# Resultados\n\nTexto.`;
        sessions.replaceContent(article.id, updated);
        await expect(language.outline(article.id)).resolves.toContainEqual(
          expect.objectContaining({ title: 'Resultados', depth: 1 }),
        );

        sessions.replaceContent(article.id, '---\ntitle: [\n---\n# Rascunho');
        await expect(language.diagnostics(article.id)).resolves.toContainEqual(
          expect.objectContaining({ id: 'MD-FRONTMATTER-INVALIDO', severity: 'warning' }),
        );
      } finally {
        await sessions.dispose();
        await index.close();
        await storage.close();
      }
    });
  });

  it('backlinks: projeta links indexados de outros documentos, não parse local', async () => {
    await withVault(async (root) => {
      const storage = LocalFilesystemStorage.create(root);
      const index = SqliteWorkspaceIndex.create({
        storage,
        databasePath: join(root, '.academic', 'index.sqlite'),
      });
      await index.open();
      const files = await storage.list();
      const article = files.find((file) => file.path === 'artigo.md');
      const notes = files.find((file) => file.path === 'notas.md');
      if (article === undefined || notes === undefined) throw new Error('Fixture incompleta.');

      const sessions = DocumentSessionsService.create({
        storage,
        compiler: criarServicoDeCompiler(),
        environment: criarResolvedorDeAmbienteVazio(),
        hashContent: hash,
        autoCompile: false,
      });
      const language = WorkspaceLanguageService.create({ storage, index, sessions });

      try {
        await expect(language.backlinks(notes.id)).resolves.toEqual([
          expect.objectContaining({ fileId: article.id, path: article.path, label: 'as notas' }),
        ]);
        // artigo.md não tem nada apontando para si dentro desta fixture.
        await expect(language.backlinks(article.id)).resolves.toEqual([]);
      } finally {
        await sessions.dispose();
        await index.close();
        await storage.close();
      }
    });
  });
});
