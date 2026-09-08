import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it } from 'vitest';

import { criarServicoDeCompiler } from '@abnt/compiler';
import type { CompilerService } from '@abnt/protocol';
import { LocalFilesystemStorage } from '@abnt/workspace-local';
import {
  criarResolvedorDeAmbienteVazio,
  DocumentSessionsService,
  type DocumentSessionEvent,
} from '@abnt/workspace-sessions';

const hash = (content: string): string =>
  `sha256:${createHash('sha256').update(content).digest('hex')}`;

const withVault = async (run: (root: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), 'abnt-p4-'));
  try {
    await writeFile(join(root, 'artigo.md'), '# Introdução\n\nVersão inicial.\n', 'utf8');
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

describe('P4 — sessões revisionadas e compilação cancelável', () => {
  it('descobre dependências, publica diagnósticos e gera preview por meio do protocolo', async () => {
    await withVault(async (root) => {
      const storage = LocalFilesystemStorage.create(root);
      const opened = await storage.open();
      const article = opened.files[0];
      if (article === undefined) throw new Error('Artigo inicial ausente.');
      const events: DocumentSessionEvent[] = [];
      const sessions = DocumentSessionsService.create({
        storage,
        compiler: criarServicoDeCompiler(),
        environment: criarResolvedorDeAmbienteVazio(),
        hashContent: hash,
      });
      const unsubscribe = sessions.subscribe((event) => events.push(event));

      try {
        await sessions.open(article.id);
        await sessions.idle(article.id);

        const session = sessions.snapshot(article.id);
        expect(session).toMatchObject({
          id: article.id,
          revision: article.revision,
          dirty: false,
          status: 'idle',
          preview: { profileId: 'abnt-artigo' },
        });
        expect(session?.contentHash).toBe(hash('# Introdução\n\nVersão inicial.\n'));
        expect(events.some((event) => event.type === 'session:dependencies-resolved')).toBe(true);
        expect(events.some((event) => event.type === 'session:diagnostics-updated')).toBe(true);
        expect(events.some((event) => event.type === 'session:preview-updated')).toBe(true);
      } finally {
        unsubscribe();
        await sessions.dispose();
        await storage.close();
      }
    });
  });

  it('separa revisão do rascunho da revisão persistida e salva sem perder identidade', async () => {
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

      try {
        await sessions.open(article.id);
        const edited = sessions.replaceContent(article.id, '# Introdução\n\nRascunho local.\n');
        expect(edited.revision).toBe(article.revision + 1);
        expect(edited.file.revision).toBe(article.revision);
        expect(edited.dirty).toBe(true);
        expect(edited.contentHash).toBeUndefined();

        const saved = await sessions.save(article.id);
        expect(saved.id).toBe(article.id);
        expect(saved.file.documentId).toBe(article.documentId);
        expect(saved.revision).toBe(edited.revision);
        expect(saved.file.revision).toBeGreaterThan(article.revision);
        expect(saved.dirty).toBe(false);
        expect(saved.contentHash).toBe(hash('# Introdução\n\nRascunho local.\n'));
        await expect(storage.read(article.id)).resolves.toMatchObject({ content: '# Introdução\n\nRascunho local.\n' });
      } finally {
        await sessions.dispose();
        await storage.close();
      }
    });
  });

  it('preserva o rascunho local e expõe conflito quando o vault muda externamente', async () => {
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
      const conflict = deferred<Extract<DocumentSessionEvent, { type: 'session:external-conflict' }>>();
      const unsubscribe = sessions.subscribe((event) => {
        if (event.type === 'session:external-conflict') conflict.resolve(event);
      });

      try {
        await sessions.open(article.id);
        sessions.replaceContent(article.id, '# Introdução\n\nRascunho que não pode sumir.\n');
        const external = await storage.write({
          fileId: article.id,
          content: '# Introdução\n\nMudança feita fora da sessão.\n',
          expectedRevision: article.revision,
        });
        const event = await conflict.promise;

        expect(event.externalFile).toEqual(external);
        expect(sessions.snapshot(article.id)).toMatchObject({
          content: '# Introdução\n\nRascunho que não pode sumir.\n',
          dirty: true,
          externalChange: { revision: external.revision },
        });
      } finally {
        unsubscribe();
        await sessions.dispose();
        await storage.close();
      }
    });
  });

  it('resolveExternalConflict("keep-local") preserva o rascunho e permite salvar por cima da mudança externa', async () => {
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

      try {
        await sessions.open(article.id);
        sessions.replaceContent(article.id, '# Introdução\n\nRascunho que não pode sumir.\n');
        const external = await storage.write({
          fileId: article.id,
          content: '# Introdução\n\nMudança feita fora da sessão.\n',
          expectedRevision: article.revision,
        });
        await sessions.idle(article.id);

        const resolved = await sessions.resolveExternalConflict(article.id, 'keep-local');
        expect(resolved.content).toBe('# Introdução\n\nRascunho que não pode sumir.\n');
        expect(resolved.dirty).toBe(true);
        expect(resolved.externalChange).toBeUndefined();
        expect(resolved.file.revision).toBe(external.revision);

        // O próximo save não pode falhar por expectedRevision desatualizado —
        // é exatamente o ponto de aceitar a revisão externa como nova base.
        const saved = await sessions.save(article.id);
        expect(saved.dirty).toBe(false);
        await expect(storage.read(article.id)).resolves.toMatchObject({
          content: '# Introdução\n\nRascunho que não pode sumir.\n',
        });
      } finally {
        await sessions.dispose();
        await storage.close();
      }
    });
  });

  it('resolveExternalConflict("reload-external") descarta o rascunho e recarrega o conteúdo do disco', async () => {
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

      try {
        await sessions.open(article.id);
        sessions.replaceContent(article.id, '# Introdução\n\nRascunho que será descartado.\n');
        const external = await storage.write({
          fileId: article.id,
          content: '# Introdução\n\nMudança feita fora da sessão.\n',
          expectedRevision: article.revision,
        });
        await sessions.idle(article.id);

        const resolved = await sessions.resolveExternalConflict(article.id, 'reload-external');
        expect(resolved.content).toBe('# Introdução\n\nMudança feita fora da sessão.\n');
        expect(resolved.dirty).toBe(false);
        expect(resolved.externalChange).toBeUndefined();
        expect(resolved.file.revision).toBe(external.revision);
      } finally {
        await sessions.dispose();
        await storage.close();
      }
    });
  });

  it('descarta resultado atrasado, mesmo quando uma implementação ignora AbortSignal', async () => {
    await withVault(async (root) => {
      const storage = LocalFilesystemStorage.create(root);
      const opened = await storage.open();
      const article = opened.files[0];
      if (article === undefined) throw new Error('Artigo inicial ausente.');
      const actual = criarServicoDeCompiler();
      const oldPrepareStarted = deferred();
      const releaseOldPrepare = deferred();
      const compiler: CompilerService = {
        async prepare(request) {
          // Produz um DTO válido, mas retarda a resposta da revisão antiga.
          const result = await actual.prepare(request);
          if (request.source.content.includes('Versão antiga')) {
            oldPrepareStarted.resolve();
            await releaseOldPrepare.promise;
          }
          return result;
        },
        compile: (request, signal) => actual.compile(request, signal),
      };
      const sessions = DocumentSessionsService.create({
        storage,
        compiler,
        environment: criarResolvedorDeAmbienteVazio(),
        hashContent: hash,
        autoCompile: false,
      });
      const events: DocumentSessionEvent[] = [];
      const unsubscribe = sessions.subscribe((event) => events.push(event));

      try {
        await sessions.open(article.id);
        const old = sessions.replaceContent(article.id, '# Introdução\n\nVersão antiga.\n');
        const oldCompilation = sessions.compile(article.id);
        await oldPrepareStarted.promise;

        const fresh = sessions.replaceContent(article.id, '# Introdução\n\nVersão nova.\n');
        await sessions.compile(article.id);
        releaseOldPrepare.resolve();
        await oldCompilation;
        await sessions.idle(article.id);

        const previewEvents = events.filter(
          (event): event is Extract<DocumentSessionEvent, { type: 'session:preview-updated' }> =>
            event.type === 'session:preview-updated',
        );
        expect(previewEvents).toHaveLength(1);
        expect(previewEvents[0]?.revision).toBe(fresh.revision);
        expect(events).toContainEqual(
          expect.objectContaining({
            type: 'session:compilation-discarded',
            revision: old.revision,
            reason: 'cancelled',
          }),
        );
        expect(sessions.snapshot(article.id)).toMatchObject({
          revision: fresh.revision,
          content: '# Introdução\n\nVersão nova.\n',
          status: 'idle',
          preview: { profileId: 'abnt-artigo' },
        });
      } finally {
        unsubscribe();
        await sessions.dispose();
        await storage.close();
      }
    });
  });
});
