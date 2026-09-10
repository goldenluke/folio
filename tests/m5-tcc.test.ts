import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { compilar } from '@abnt/cli';
import { parseMarkdown } from '@abnt/markdown';
import type { PublicationInline, PublicationToc } from '@abnt/publication';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(HERE, '..', 'fixtures', 'm5');
const FILE = join(FIXTURE_DIR, 'tcc.md');

const source = (): Promise<string> => readFile(FILE, 'utf8');
const inlineText = (nodes: readonly PublicationInline[]): string =>
  nodes.map((node) => (node.type === 'text' ? node.value : '')).join('');

describe('M5 — profile de TCC', () => {
  it('preserva properties genéricas e papéis de contribuidores no parser', async () => {
    const ast = parseMarkdown(await source(), { documentId: 'tcc.md' });
    const roles = ast.document.metadata.contributors?.map((item) => item.role);

    expect(roles).toEqual(['author', 'advisor', 'coadvisor', 'reviewer', 'reviewer']);
    expect(ast.document.metadata.properties?.['publication:profile']).toBe('abnt-tcc');
    expect(ast.document.metadata.properties?.['tcc:institution']).toBe(
      'Universidade Federal do Exemplo',
    );
    // Os elementos editoriais são gerados pelo profile; não viram nós da AST.
    expect(ast.document.children.some((node) => node.type === 'container')).toBe(false);
  });

  it('gera todos os elementos pré-textuais, listas e sumário sem erros', async () => {
    const result = await compilar(await source(), {
      documentId: 'tcc.md',
      baseDir: FIXTURE_DIR,
      embutirRecursos: true,
    });
    const roles = result.publicacao.children.flatMap((block) =>
      block.type === 'front-matter' ? [block.role] : [],
    );

    expect(result.diagnosticos).toEqual([]);
    expect(result.publicacao.page.variants?.preliminary?.pageNumber).toBe('none');
    expect(result.publicacao.page.variants?.main?.pageNumber).toBe('top-right');
    expect(result.publicacao.styles['tcc-cover']?.counterReset).toBe('page 0');
    expect(roles).toEqual(
      expect.arrayContaining([
        'tcc:cover',
        'tcc:title-page',
        'tcc:catalog-card',
        'tcc:approval-sheet',
        'tcc:dedication',
        'tcc:acknowledgements',
        'tcc:epigraph',
        'tcc:abstract-pt',
        'tcc:abstract-en',
        'tcc:abbreviations',
        'tcc:symbols',
      ]),
    );

    const lists = result.publicacao.children.filter(
      (block): block is PublicationToc => block.type === 'toc',
    );
    expect(lists.map((list) => inlineText(list.title))).toEqual([
      'Lista de ilustrações',
      'Lista de tabelas',
      'Lista de códigos',
      'Sumário',
    ]);
    expect(lists.at(-1)?.entries.map((entry) => inlineText(entry.children))).toEqual([
      '1 Introdução',
      '1.1 Objetivos',
      '2 Fundamentação',
      '3 Metodologia',
      '4 Resultados',
      '5 Conclusão',
    ]);
    expect(result.html).toContain('target-counter(attr(href), page)');
    expect(result.html).toContain('publication-toc-leader');
    expect(result.html).toContain('border-bottom: 1px dotted currentColor;');
    expect(result.html).toContain('@page preliminary');
    expect(result.html).toContain('counter-reset: page 0;');
    expect(result.html).toContain('data-role="tcc:approval-sheet"');
    expect(result.html).toMatch(/<h1 id="n\d+" class="s-tcc-heading-1">1 Introdução<\/h1>/);
    expect(result.html).toContain('<h1 class="s-heading-1">Referências</h1>');
  });

  it('diagnostica metadados estruturais ausentes no profile TCC', async () => {
    const result = await compilar('# Introdução\n\nRascunho.', { perfil: 'abnt-tcc' });
    const ids = result.diagnosticos.map((diagnostic) => diagnostic.id);

    expect(ids).toContain('ABNT-14724-EST-001');
    expect(ids).toContain('ABNT-14724-EST-002');
    expect(ids).toContain('ABNT-14724-EST-003');
    expect(ids).toContain('ABNT-14724-EST-009');
    expect(ids).toContain('ABNT-6028-TCC-001');
    expect(ids).toContain('ABNT-6028-TCC-002');
  });

  it('inclui um logotipo institucional opcional apenas na capa', async () => {
    const withLogo = (await source()).replace('properties:\n', 'properties:\n  "tcc:cover-logo": "data:image/svg+xml;base64,PHN2Zy8+"\n');
    const result = await compilar(withLogo, { documentId: 'tcc.md', baseDir: FIXTURE_DIR, embutirRecursos: true });
    const cover = result.publicacao.children.find((block) => block.type === 'front-matter' && block.role === 'tcc:cover');
    expect(cover?.type === 'front-matter' ? cover.children[0] : undefined).toMatchObject({ type: 'figure', src: 'data:image/svg+xml;base64,PHN2Zy8+', width: '28%' });
  });
});
