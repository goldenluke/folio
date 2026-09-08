import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { compilar } from '@abnt/cli';
import { percorrerTudo } from '@abnt/document-model';
import { parseMarkdown } from '@abnt/markdown';

const AQUI = dirname(fileURLToPath(import.meta.url));
const PASTA = join(AQUI, '..', 'fixtures', 'completo');
const ARQUIVO = join(PASTA, 'completo.md');

describe('M1 de ponta a ponta', () => {
  it('o fixture cobre os nós estruturais centrais com IDs únicos', async () => {
    const fonte = await readFile(ARQUIVO, 'utf8');
    const ast = parseMarkdown(fonte, { documentId: 'completo.md' });
    const nos = [...percorrerTudo(ast)];
    const tipos = new Set(nos.map((no) => no.type));

    for (const tipo of [
          'document',
          'section',
          'paragraph',
          'text',
          'emphasis',
          'strong',
          'strike',
          'code-inline',
          'math-inline',
          'link',
          'citation',
          'note-reference',
          'quote',
          'list',
          'list-item',
          'figure',
          'table',
          'table-row',
          'table-cell',
          'code-block',
          'math-block',
          'thematic-break',
        ]) {
      expect(tipos.has(tipo), `tipo não exercitado: ${tipo}`).toBe(true);
    }

    expect(new Set(nos.map((no) => no.id)).size).toBe(nos.length);
    expect(Object.keys(ast.notes)).toHaveLength(2);
    expect(Object.keys(ast.resources)).toHaveLength(1);
  });

  it('linhas e células da tabela preservam posição no Markdown', async () => {
    const fonte = await readFile(ARQUIVO, 'utf8');
    const ast = parseMarkdown(fonte, { documentId: 'completo.md' });
    const nos = [...percorrerTudo(ast)];
    const linha = nos.find((no) => no.type === 'table-row');
    const celula = nos.find((no) => no.type === 'table-cell');

    expect(linha?.source?.start.line).toBeGreaterThan(1);
    expect(celula?.source?.start.line).toBe(linha?.source?.start.line);
    expect(fonte.slice(linha?.source?.start.offset, linha?.source?.end.offset)).toContain('|');
  });

  it('publica figura embutida, tabela, notas e diagnósticos honestos de citação', async () => {
    const fonte = await readFile(ARQUIVO, 'utf8');
    const resultado = await compilar(fonte, {
      documentId: 'completo.md',
      baseDir: PASTA,
      embutirRecursos: true,
    });

    expect(resultado.html).toContain('src="data:image/svg+xml;base64,');
    expect(Object.values(resultado.ast.resources)[0]?.uri).toBe('figuras/arquitetura.svg');
    expect(resultado.html).toContain('<table');
    expect(resultado.html).toContain('<math');
    expect(resultado.html).toContain('<mfrac>');
    expect(resultado.html).toContain('float: footnote');
    expect(resultado.html.match(/<span class="footnote s-note">/g)).toHaveLength(2);
    expect(resultado.html).not.toContain('<span class="footnote"><p');

    expect(resultado.diagnosticos.some((d) => d.id === 'CIT-MOTOR-PROVISORIO')).toBe(false);
    expect(resultado.diagnosticos.some((d) => d.id === 'CIT-REF-AUSENTE')).toBe(true);
    expect(
      resultado.diagnosticos
        .filter((d) => d.id === 'CIT-REF-AUSENTE')
        .every((d) => (d.source?.start.line ?? 0) > 1),
    ).toBe(true);
  });
});
