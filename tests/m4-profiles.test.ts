import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { compilar } from '@abnt/cli';
import { percorrer } from '@abnt/document-model';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(HERE, '..', 'fixtures', 'm4');

const source = (): Promise<string> => readFile(join(FIXTURE_DIR, 'artigo.md'), 'utf8');

describe('M4 — artigo ABNT', () => {
  it('publica elementos do artigo de ponta a ponta, incluindo fonte de figura no Markdown', async () => {
    const result = await compilar(await source(), {
      documentId: 'artigo.md',
      baseDir: FIXTURE_DIR,
      embutirRecursos: true,
      perfil: 'abnt-artigo',
    });

    expect(result.diagnosticos.filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
    expect(result.html).toContain('Figura 1 — Fluxo entre autoria, semântica e publicação');
    expect(result.html).toContain('Fonte: (Silva, 2024)');
    expect(result.html).toContain('Tabela 1 — Camadas da publicação');
    expect(result.html).toContain('Código 1 — Compilação orientada por profile');
    expect(result.html).toMatch(/<h1 id="n\d+" class="s-heading-1">1 Introdução<\/h1>/);
    expect(result.html).toContain('<h1 class="s-heading-1">Referências</h1>');
    expect(result.html).toContain('src="data:image/svg+xml;base64,');
  });
});

describe('M4 — segundo profile', () => {
  it('republica a mesma AST como web article sem números nem regras ABNT', async () => {
    const markdown = await source();
    const abnt = await compilar(markdown, {
      documentId: 'artigo.md',
      baseDir: FIXTURE_DIR,
      perfil: 'abnt-artigo',
    });
    const web = await compilar(markdown, {
      documentId: 'artigo.md',
      baseDir: FIXTURE_DIR,
      perfil: 'web-article',
    });

    expect(JSON.stringify(web.ast)).toBe(JSON.stringify(abnt.ast));
    expect(web.publicacao.page.size).toBe('Letter');
    expect(web.publicacao.page.pageNumber).toBe('none');
    expect(web.html).toContain('class="s-web-title-line"');
    expect(web.html).toMatch(/<h1 id="n\d+" class="s-web-heading-1">Introdução<\/h1>/);
    expect(web.html).not.toMatch(/class="s-web-heading-1">1 Introdução<\/h1>/);
    expect(web.html).toContain('<h1 class="s-web-heading-1">References</h1>');
    expect(web.html).toContain('Table 1. Camadas da publicação');
    expect(web.html).toContain('Listing 1. Compilação orientada por profile');
    expect(web.diagnosticos.some((diagnostic) => diagnostic.id.startsWith('ABNT-'))).toBe(false);

    const sectionNumbers = [...percorrer(web.ast)]
      .filter((node) => node.type === 'section')
      .map((node) => web.resolvido.annotations.getString(node.id, 'semantic:section-number'));
    expect(sectionNumbers).toEqual(['1', '2', '3']);
  });
});
