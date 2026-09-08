import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MessageChannel } from 'node:worker_threads';

import { describe, expect, it } from 'vitest';

import { criarServicoDeCompiler } from '@abnt/compiler';
import { createInProcessCompilerClient, createWorkspaceMessagePortClient, serveWorkspaceOverMessagePort } from '@abnt/protocol';

import { DesktopWorkspaceServiceHost } from '../apps/desktop/src/workspace/workspace-service.js';

const ARTIGO = [
  '---',
  'authors: Ana Silva',
  'year: 2024',
  'profile: abnt-tcc',
  'language: pt-BR',
  'tags: [metodologia, qualitativa]',
  '---',
  '',
  '# Introdução',
  '',
  'Este trabalho cita [@silva2024, p. 10] e depende da [metodologia](metodologia.md).',
  '',
  '![Modelo do sistema](figuras/modelo.svg)',
  '',
].join('\n');

const METODOLOGIA = [
  '# Metodologia',
  '',
  '| Método | Resultado |',
  '| --- | --- |',
  '| Survey | Positivo |',
  '',
].join('\n');

const withVault = async (run: (root: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), 'abnt-f4-'));
  try {
    await mkdir(join(root, 'figuras'), { recursive: true });
    await writeFile(join(root, 'artigo.md'), ARTIGO, 'utf8');
    await writeFile(join(root, 'metodologia.md'), METODOLOGIA, 'utf8');
    await writeFile(join(root, 'figuras', 'modelo.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>', 'utf8');
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

describe('F4 — busca estruturada (cites:, has:, linksto:, type:)', () => {
  it('cada predicado filtra pelo mesmo índice que já sustenta busca e backlinks', async () => {
    await withVault(async (root) => {
      const host = DesktopWorkspaceServiceHost.create({
        compiler: createInProcessCompilerClient(criarServicoDeCompiler()),
      });
      const channel = new MessageChannel();
      const stop = serveWorkspaceOverMessagePort(channel.port1, host);
      const client = createWorkspaceMessagePortClient(channel.port2);

      try {
        const opened = await client.open({ rootPath: root });
        if (!opened.ok) throw new Error('Vault deveria abrir.');
        const artigo = opened.value.files.find((file) => file.path === 'artigo.md');
        const metodologia = opened.value.files.find((file) => file.path === 'metodologia.md');
        if (artigo === undefined || metodologia === undefined) throw new Error('Fixture incompleta.');

        const hasFigure = await client.search({ query: 'has:figure' });
        expect(hasFigure).toMatchObject({ ok: true, value: [expect.objectContaining({ path: 'artigo.md' })] });

        const hasTable = await client.search({ query: 'has:table' });
        expect(hasTable).toMatchObject({ ok: true, value: [expect.objectContaining({ path: 'metodologia.md' })] });

        const hasCitation = await client.search({ query: 'has:citation' });
        expect(hasCitation).toMatchObject({ ok: true, value: [expect.objectContaining({ path: 'artigo.md' })] });

        const cites = await client.search({ query: 'cites:@silva2024' });
        expect(cites).toMatchObject({ ok: true, value: [expect.objectContaining({ path: 'artigo.md' })] });

        const citesUnknown = await client.search({ query: 'cites:naoexiste2099' });
        expect(citesUnknown).toEqual({ ok: true, value: [] });

        const linksTo = await client.search({ query: 'linksto:metodologia' });
        expect(linksTo).toMatchObject({ ok: true, value: [expect.objectContaining({ path: 'artigo.md' })] });

        const typeMarkdown = await client.search({ query: 'type:markdown' });
        expect(typeMarkdown).toMatchObject({
          ok: true,
          value: expect.arrayContaining([
            expect.objectContaining({ path: 'artigo.md' }),
            expect.objectContaining({ path: 'metodologia.md' }),
          ]),
        });
        if (typeMarkdown.ok) expect(typeMarkdown.value).toHaveLength(2);

        const combined = await client.search({ query: 'has:figure cites:@silva2024' });
        expect(combined).toMatchObject({ ok: true, value: [expect.objectContaining({ path: 'artigo.md' })] });

        const noMatch = await client.search({ query: 'has:table cites:@silva2024' });
        expect(noMatch).toEqual({ ok: true, value: [] });

        expect(await client.search({ query: 'tag:metodologia' })).toMatchObject({ ok: true, value: [expect.objectContaining({ path: 'artigo.md' })] });
        expect(await client.search({ query: 'tag:qualitativa year:2024 profile:abnt-tcc lang:pt-BR author:"Ana Silva"' })).toMatchObject({ ok: true, value: [expect.objectContaining({ path: 'artigo.md' })] });
        expect(await client.search({ query: 'tag:inexistente' })).toEqual({ ok: true, value: [] });

        // Sintaxe FTS inválida dentro de texto livre não deve quebrar a consulta.
        const malformed = await client.search({ query: '"aspas sem fechar' });
        expect(malformed.ok).toBe(true);
      } finally {
        client.dispose();
        stop();
        channel.port1.close();
        channel.port2.close();
        await host.dispose();
      }
    });
  });
});
