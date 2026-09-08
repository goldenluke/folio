import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MessageChannel } from 'node:worker_threads';

import { describe, expect, it } from 'vitest';

import { criarServicoDeCompiler } from '@abnt/compiler';
import { WorkspaceLanguageService, type LanguageReferenceCatalog } from '@abnt/language-service';
import { createInProcessCompilerClient, createWorkspaceMessagePortClient, serveWorkspaceOverMessagePort } from '@abnt/protocol';
import { SqliteWorkspaceIndex } from '@abnt/workspace-index';
import { LocalFilesystemStorage } from '@abnt/workspace-local';
import { criarResolvedorDeAmbienteVazio, DocumentSessionsService } from '@abnt/workspace-sessions';

import { DesktopWorkspaceServiceHost } from '../apps/desktop/src/workspace/workspace-service.js';

const withVault = async (files: Readonly<Record<string, string>>, run: (root: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), 'abnt-f74-'));
  try {
    for (const [path, content] of Object.entries(files)) await writeFile(join(root, path), content, 'utf8');
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

describe('F74 — menções não linkadas: diacríticos, word boundary e título de seção', () => {
  it('casa título com diacrítico diferente do texto mencionado', async () => {
    await withVault(
      {
        'artigo.md': '# Contexto\n\nA análise segue a metodologia descrita alhures.\n',
        'outro.md': '---\ntitle: Metodología\n---\n\n# Corpo\n\nTexto.\n',
      },
      async (root) => {
        const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
        const channel = new MessageChannel();
        const stop = serveWorkspaceOverMessagePort(channel.port1, host);
        const client = createWorkspaceMessagePortClient(channel.port2);
        try {
          const opened = await client.open({ rootPath: root });
          if (!opened.ok) throw new Error('Vault deveria abrir.');
          const arquivo = opened.value.files.find((file) => file.path === 'artigo.md');
          const outro = opened.value.files.find((file) => file.path === 'outro.md');
          if (arquivo === undefined || outro === undefined) throw new Error('Fixture incompleta.');
          const editor = await client.openEditor({ fileId: arquivo.fileId });
          if (!editor.ok) throw new Error('Editor deveria abrir.');
          const mentions = await client.unlinkedMentions({ fileId: arquivo.fileId, expectedRevision: editor.value.session.revision });
          if (!mentions.ok) throw new Error('unlinkedMentions deveria funcionar.');
          expect(mentions.value).toContainEqual(expect.objectContaining({ targetFileId: outro.fileId, text: 'metodologia' }));
        } finally {
          client.dispose();
          stop();
          channel.port1.close();
          channel.port2.close();
          await host.dispose();
        }
      },
    );
  });

  it('não casa dentro de outra palavra (word boundary)', async () => {
    await withVault(
      {
        'artigo.md': '# Contexto\n\nAs metodologias variam conforme o campo.\n',
        'outro.md': '---\ntitle: Metodologia\n---\n\n# Corpo\n\nTexto.\n',
      },
      async (root) => {
        const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
        const channel = new MessageChannel();
        const stop = serveWorkspaceOverMessagePort(channel.port1, host);
        const client = createWorkspaceMessagePortClient(channel.port2);
        try {
          const opened = await client.open({ rootPath: root });
          if (!opened.ok) throw new Error('Vault deveria abrir.');
          const arquivo = opened.value.files.find((file) => file.path === 'artigo.md');
          if (arquivo === undefined) throw new Error('Fixture incompleta.');
          const editor = await client.openEditor({ fileId: arquivo.fileId });
          if (!editor.ok) throw new Error('Editor deveria abrir.');
          const mentions = await client.unlinkedMentions({ fileId: arquivo.fileId, expectedRevision: editor.value.session.revision });
          if (!mentions.ok) throw new Error('unlinkedMentions deveria funcionar.');
          // "metodologia" está DENTRO de "metodologias" — não é uma menção standalone.
          expect(mentions.value).toEqual([]);
        } finally {
          client.dispose();
          stop();
          channel.port1.close();
          channel.port2.close();
          await host.dispose();
        }
      },
    );
  });

  it('sinaliza menção a um título de SEÇÃO de outro documento, não só título de documento', async () => {
    await withVault(
      {
        'artigo.md': '# Contexto\n\nOs resultados preliminares indicam avanço.\n',
        'outro.md': '# Trabalho geral\n\nTexto introdutório.\n\n## Resultados preliminares\n\nDetalhe da seção.\n',
      },
      async (root) => {
        const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
        const channel = new MessageChannel();
        const stop = serveWorkspaceOverMessagePort(channel.port1, host);
        const client = createWorkspaceMessagePortClient(channel.port2);
        try {
          const opened = await client.open({ rootPath: root });
          if (!opened.ok) throw new Error('Vault deveria abrir.');
          const arquivo = opened.value.files.find((file) => file.path === 'artigo.md');
          const outro = opened.value.files.find((file) => file.path === 'outro.md');
          if (arquivo === undefined || outro === undefined) throw new Error('Fixture incompleta.');
          const editor = await client.openEditor({ fileId: arquivo.fileId });
          if (!editor.ok) throw new Error('Editor deveria abrir.');
          const mentions = await client.unlinkedMentions({ fileId: arquivo.fileId, expectedRevision: editor.value.session.revision });
          if (!mentions.ok) throw new Error('unlinkedMentions deveria funcionar.');
          expect(mentions.value).toContainEqual(
            expect.objectContaining({ targetFileId: outro.fileId, targetPath: 'outro.md', text: 'resultados preliminares' }),
          );
        } finally {
          client.dispose();
          stop();
          channel.port1.close();
          channel.port2.close();
          await host.dispose();
        }
      },
    );
  });

  it('sugere citação para título e pessoa bibliográficos, sem transformar a autoria automaticamente', async () => {
    const root = await mkdtemp(join(tmpdir(), 'abnt-f74-reference-'));
    try {
      await writeFile(join(root, 'artigo.md'), '# Contexto\n\nAna Silva fundamenta o Estudo de Campo.\n', 'utf8');
      const storage = LocalFilesystemStorage.create(root);
      const index = SqliteWorkspaceIndex.create({ storage, databasePath: join(root, '.academic', 'index.sqlite') });
      await index.open();
      const article = (await storage.list()).find((file) => file.path === 'artigo.md');
      if (article === undefined) throw new Error('Arquivo ausente.');
      const catalog: LanguageReferenceCatalog = {
        async search() { return []; },
        async find() { return undefined; },
        async all() { return [{ id: 'silva2024', title: 'Estudo de Campo', authors: ['Ana Silva'] }]; },
      };
      const sessions = DocumentSessionsService.create({
        storage,
        compiler: criarServicoDeCompiler(),
        environment: criarResolvedorDeAmbienteVazio(),
        hashContent: (content) => `sha256:${createHash('sha256').update(content).digest('hex')}`,
        autoCompile: false,
      });
      const language = WorkspaceLanguageService.create({ storage, index, sessions, references: catalog });
      try {
        await sessions.open(article.id);
        const mentions = await language.unlinkedMentions(article.id);
        expect(mentions).toEqual(expect.arrayContaining([
          expect.objectContaining({ kind: 'reference', referenceId: 'silva2024', text: 'Ana Silva' }),
          expect.objectContaining({ kind: 'reference', referenceId: 'silva2024', text: 'Estudo de Campo' }),
        ]));
      } finally {
        await sessions.dispose();
        await index.close();
        await storage.close();
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
