import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { compilar } from '@abnt/cli';
import { percorrer } from '@abnt/document-model';
import { NUMERO_DA_SECAO } from '@abnt/semantics';

const AQUI = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(AQUI, '..', 'fixtures', 'artigo', 'artigo.md');

const lerFixture = async (): Promise<string> => readFile(FIXTURE, 'utf8');

/**
 * Golden tests do pipeline.
 *
 * Cada estágio é fixado separadamente de propósito: quando um snapshot quebra,
 * o estágio em que quebrou já localiza o defeito. Um único snapshot do HTML
 * final diria "algo mudou" sem dizer onde.
 */
describe('pipeline: artigo ABNT', () => {
  it('produz a Document AST esperada', async () => {
    const { ast } = await compilar(await lerFixture(), { documentId: 'artigo.md' });
    await expect(JSON.stringify(ast, null, 2)).toMatchFileSnapshot(
      './__snapshots__/artigo.ast.json',
    );
  });

  it('produz a Publication AST esperada', async () => {
    const { publicacao } = await compilar(await lerFixture(), { documentId: 'artigo.md' });
    await expect(JSON.stringify(publicacao, null, 2)).toMatchFileSnapshot(
      './__snapshots__/artigo.pub.json',
    );
  });

  it('produz o HTML esperado', async () => {
    const { html } = await compilar(await lerFixture(), { documentId: 'artigo.md' });
    await expect(html).toMatchFileSnapshot('./__snapshots__/artigo.html');
  });

  it('é determinístico: duas compilações da mesma fonte são idênticas', async () => {
    const fonte = await lerFixture();
    const a = await compilar(fonte, { documentId: 'artigo.md' });
    const b = await compilar(fonte, { documentId: 'artigo.md' });

    // Sem isso, snapshot de AST seria inutilizável e cache por hash de
    // conteúdo (previsto para o M2) nunca acertaria.
    expect(JSON.stringify(a.ast)).toBe(JSON.stringify(b.ast));
    expect(a.html).toBe(b.html);
  });
});

/**
 * Invariantes arquiteturais.
 *
 * Estes testes não verificam comportamento — verificam que a separação de
 * camadas continua valendo. São a versão executável do que docs/adr/0001
 * afirma em prosa, e é isso que impede a Document AST de virar, com o tempo,
 * "uma AST da ABNT fantasiada".
 */
describe('invariantes do modelo', () => {
  it('a Document AST não carrega número de seção', async () => {
    const { ast } = await compilar(await lerFixture(), { documentId: 'artigo.md' });
    const serializada = JSON.stringify(ast);

    // Número resolvido é dado derivado: mora nas anotações, nunca no nó.
    // Se este teste quebrar, alguém "otimizou" gravando o número na árvore e
    // quebrou a possibilidade de publicar o mesmo documento sob duas normas.
    expect(serializada).not.toContain('"number"');
    expect(serializada).not.toContain('"sectionNumber"');

    for (const no of percorrer(ast)) {
      expect(no).not.toHaveProperty('number');
    }
  });

  it('a numeração vive nas anotações, e está correta', async () => {
    const { ast, resolvido } = await compilar(await lerFixture(), { documentId: 'artigo.md' });

    const numeros: string[] = [];
    for (const no of percorrer(ast)) {
      const n = resolvido.annotations.getString(no.id, NUMERO_DA_SECAO);
      if (n !== undefined) numeros.push(n);
    }

    expect(numeros).toEqual(['1', '1.1', '1.2', '2', '2.1', '2.2', '3', '4']);
  });

  it('a Document AST não menciona nenhuma norma nem valor de layout', async () => {
    const { ast } = await compilar(await lerFixture(), { documentId: 'artigo.md' });
    const serializada = JSON.stringify(ast).toLowerCase();

    // A AST descreve significado. Norma e tipografia entram só na publicação.
    for (const proibido of ['abnt', 'nbr-', '12pt', 'times new roman', 'cm"', 'justify']) {
      expect(serializada).not.toContain(proibido);
    }
  });

  it('a Publication AST resolve a numeração em texto', async () => {
    const { publicacao } = await compilar(await lerFixture(), { documentId: 'artigo.md' });

    const headings = publicacao.children.filter((b) => b.type === 'heading');
    expect(headings.map((h) => (h.type === 'heading' ? h.number : undefined))).toEqual([
      '1',
      '1.1',
      '1.2',
      '2',
      '2.1',
      '2.2',
      '3',
      '4',
    ]);
  });
});
