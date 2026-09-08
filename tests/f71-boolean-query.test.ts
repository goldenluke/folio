import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MessageChannel } from 'node:worker_threads';

import { describe, expect, it } from 'vitest';

import { criarServicoDeCompiler } from '@abnt/compiler';
import { parseStructuredQuery } from '@abnt/language-service';
import { createInProcessCompilerClient, createWorkspaceMessagePortClient, serveWorkspaceOverMessagePort } from '@abnt/protocol';

import { DesktopWorkspaceServiceHost } from '../apps/desktop/src/workspace/workspace-service.js';

describe('F71 — Boolean Query AST (parser)', () => {
  it('AND implícito entre termos vira um único nó "and" raso — forma de F4', () => {
    expect(parseStructuredQuery('has:figure has:table')).toEqual({
      root: {
        kind: 'and',
        nodes: [
          { kind: 'term', term: { kind: 'has', feature: 'figure' } },
          { kind: 'term', term: { kind: 'has', feature: 'table' } },
        ],
      },
    });
  });

  it('OR tem menor precedência que AND implícito', () => {
    // "a b OR c" == (a AND b) OR c
    const ast = parseStructuredQuery('has:figure has:table OR has:citation');
    expect(ast.root).toEqual({
      kind: 'or',
      nodes: [
        {
          kind: 'and',
          nodes: [
            { kind: 'term', term: { kind: 'has', feature: 'figure' } },
            { kind: 'term', term: { kind: 'has', feature: 'table' } },
          ],
        },
        { kind: 'term', term: { kind: 'has', feature: 'citation' } },
      ],
    });
  });

  it('NOT liga mais forte que AND', () => {
    const ast = parseStructuredQuery('has:citation NOT has:figure');
    expect(ast.root).toEqual({
      kind: 'and',
      nodes: [
        { kind: 'term', term: { kind: 'has', feature: 'citation' } },
        { kind: 'not', node: { kind: 'term', term: { kind: 'has', feature: 'figure' } } },
      ],
    });
  });

  it('parênteses agrupam OR antes do AND externo', () => {
    const ast = parseStructuredQuery('(author:"Silva" OR author:"Souza") year:2024');
    expect(ast.root).toEqual({
      kind: 'and',
      nodes: [
        {
          kind: 'or',
          nodes: [
            { kind: 'term', term: { kind: 'property', key: 'author', value: 'Silva' } },
            { kind: 'term', term: { kind: 'property', key: 'author', value: 'Souza' } },
          ],
        },
        { kind: 'term', term: { kind: 'property', key: 'year', value: '2024' } },
      ],
    });
  });

  it('"or"/"and"/"not" minúsculos são texto livre, não operadores', () => {
    const ast = parseStructuredQuery('risco or benefício');
    expect(ast.root).toEqual({
      kind: 'and',
      nodes: [
        { kind: 'term', term: { kind: 'text', value: 'risco' } },
        { kind: 'term', term: { kind: 'text', value: 'or' } },
        { kind: 'term', term: { kind: 'text', value: 'benefício' } },
      ],
    });
  });

  it('consulta vazia não produz nó', () => {
    expect(parseStructuredQuery('')).toEqual({ root: undefined });
    expect(parseStructuredQuery('   ')).toEqual({ root: undefined });
  });

  it('operador solto sem operando é descartado, não lança', () => {
    expect(() => parseStructuredQuery('OR has:figure')).not.toThrow();
    expect(parseStructuredQuery('OR has:figure').root).toEqual({ kind: 'term', term: { kind: 'has', feature: 'figure' } });
    expect(() => parseStructuredQuery(')(')).not.toThrow();
  });
});

const ARTIGO_COM_FIGURA = '---\nauthors: Ana Silva\nyear: 2023\n---\n\n# Introdução\n\n![Modelo](modelo.png)\n';
const ARTIGO_COM_TABELA = '---\nauthors: João Souza\nyear: 2024\n---\n\n# Dados\n\n| A |\n| - |\n| 1 |\n';
const ARTIGO_SEM_NADA = '---\nauthors: Maria Costa\nyear: 2024\n---\n\n# Sem elementos\n\nTexto simples.\n';

describe('F71 — busca booleana sobre o protocolo do desktop', () => {
  it('OR une conjuntos, NOT exclui, parênteses controlam a precedência', async () => {
    const root = await mkdtemp(join(tmpdir(), 'folio-f71-'));
    await mkdir(root, { recursive: true });
    await writeFile(join(root, 'figura.md'), ARTIGO_COM_FIGURA, 'utf8');
    await writeFile(join(root, 'tabela.md'), ARTIGO_COM_TABELA, 'utf8');
    await writeFile(join(root, 'nada.md'), ARTIGO_SEM_NADA, 'utf8');

    const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
    const channel = new MessageChannel();
    const stop = serveWorkspaceOverMessagePort(channel.port1, host);
    const client = createWorkspaceMessagePortClient(channel.port2);
    try {
      const opened = await client.open({ rootPath: root });
      if (!opened.ok) throw new Error('Vault deveria abrir.');

      const or = await client.search({ query: 'has:figure OR has:table' });
      expect(or).toMatchObject({
        ok: true,
        value: expect.arrayContaining([expect.objectContaining({ path: 'figura.md' }), expect.objectContaining({ path: 'tabela.md' })]),
      });
      if (or.ok) expect(or.value).toHaveLength(2);

      const not = await client.search({ query: 'type:markdown NOT has:figure' });
      expect(not).toMatchObject({
        ok: true,
        value: expect.arrayContaining([expect.objectContaining({ path: 'tabela.md' }), expect.objectContaining({ path: 'nada.md' })]),
      });
      if (not.ok) expect(not.value).toHaveLength(2);

      // figura.md: Ana Silva/2023. tabela.md: João Souza/2024. nada.md: Maria Costa/2024.
      const grouped = await client.search({ query: '(author:"Ana Silva" OR author:"João Souza") year:2024' });
      expect(grouped).toMatchObject({ ok: true, value: [expect.objectContaining({ path: 'tabela.md' })] });

      // Sem o parêntese, "year:2024" se aplica só ao segundo termo do OR
      // ("João Souza AND year:2024"), e o "Ana Silva" isolado passa mesmo
      // sendo de 2023 — resultado tem que ser DIFERENTE do agrupado, provando
      // que a precedência é real e não coincidência de fixture.
      const ungrouped = await client.search({ query: 'author:"Ana Silva" OR author:"João Souza" year:2024' });
      expect(ungrouped).toMatchObject({
        ok: true,
        value: expect.arrayContaining([expect.objectContaining({ path: 'figura.md' }), expect.objectContaining({ path: 'tabela.md' })]),
      });
      if (ungrouped.ok) expect(ungrouped.value).toHaveLength(2);
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
