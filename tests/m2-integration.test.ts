import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { compilar } from '@abnt/cli';
import type { BibliographicEntity, Registry } from '@abnt/document-model';
import { asReferenceId } from '@abnt/document-model';

const AQUI = dirname(fileURLToPath(import.meta.url));
const PASTA = join(AQUI, '..', 'fixtures', 'm2');

const reference = (
  id: string,
  title: string,
  year: number,
  family = 'Silva',
): BibliographicEntity => ({
  id: asReferenceId(id),
  type: 'book',
  title,
  author: [{ family, given: 'Ana' }],
  issued: { 'date-parts': [[year]] },
  publisher: 'Editora Exemplo',
  'publisher-place': 'São Paulo',
});

describe('M2 de ponta a ponta', () => {
  it('carrega bibliography do frontmatter, cita e gera a seção automaticamente', async () => {
    const source = await readFile(join(PASTA, 'artigo.md'), 'utf8');
    const result = await compilar(source, { documentId: 'artigo.md', baseDir: PASTA });

    expect(Object.keys(result.ast.references)).toHaveLength(0);
    expect(Object.keys(result.resolvido.bibliography)).toHaveLength(6);
    expect(result.diagnosticos.filter((d) => d.severity === 'error')).toEqual([]);
    expect(result.diagnosticos.some((d) => d.id === 'CIT-MOTOR-PROVISORIO')).toBe(false);
    expect(result.html).toContain('Segundo Silva (2024)');
    expect(result.html).toContain('(Oliveira; Souza, 2023)');
    expect(result.html).toContain('<h1 class="s-heading-1">Referências</h1>');
    expect(result.html.match(/<p class="s-reference">/g)).toHaveLength(6);
  });

  it('reutiliza um marcador autoral vazio de referências sem duplicar o título', async () => {
    const result = await compilar('Texto [@silva2024].\n\n# Referências', {
      references: { silva2024: reference('silva2024', 'Obra de teste', 2024) },
    });

    expect(result.html.match(/Referências/g)).toHaveLength(1);
    expect(result.html).not.toContain('1 Referências');
  });

  it('desambigua mesmo autor/ano fora da AST e ordena a chamada parentética', async () => {
    const references: Registry<BibliographicEntity> = {
      b: reference('b', 'Zonas replicadas', 2024),
      a: reference('a', 'Arquiteturas replicadas', 2024),
    };
    const result = await compilar('Texto [@b; @a].', { references });

    expect(result.html).toContain('(Silva, 2024a; Silva, 2024b)');
    expect(JSON.stringify(result.ast)).not.toContain('yearSuffix');
    expect(result.resolvido.citations.yearSuffixByReference.get(asReferenceId('a'))).toBe('a');
    expect(result.resolvido.citations.yearSuffixByReference.get(asReferenceId('b'))).toBe('b');
  });

  it('numera por primeira ocorrência e ordena as referências pelo número', async () => {
    const references: Registry<BibliographicEntity> = {
      a: reference('a', 'Primeiro alfabeticamente', 2020, 'Almeida'),
      b: reference('b', 'Segundo alfabeticamente', 2021, 'Barros'),
    };
    const result = await compilar('Primeira [@b]. Depois [@a, p. 9]. Segundo @b, outra.', {
      references,
      perfil: 'abnt-artigo-numerico',
    });

    expect(result.html).toContain('Primeira (1). Depois (2, p. 9). Segundo Barros (1), outra.');
    expect(result.resolvido.citations.citedReferenceIds).toEqual(['b', 'a']);
    expect(result.html.indexOf('1. BARROS')).toBeLessThan(result.html.indexOf('2. ALMEIDA'));
  });

  it('seleciona sistema numérico pelo frontmatter e rejeita a combinação com notas', async () => {
    const references: Registry<BibliographicEntity> = { a: reference('a', 'Obra', 2024) };
    const source = [
      '---',
      'citations:',
      '  system: numeric',
      '---',
      '',
      'Texto [@a] com nota[^n].',
      '',
      '[^n]: Conteúdo da nota.',
    ].join('\n');
    const result = await compilar(source, { references });

    expect(result.html).toContain('Texto (1)');
    expect(result.diagnosticos.some((d) => d.id === 'ABNT-10520-NUM-001')).toBe(true);
  });

  it('reporta referência ausente uma vez por ocorrência, com source range', async () => {
    const result = await compilar('Texto [@inexistente].', { documentId: 'ausente.md' });
    const diagnostics = result.diagnosticos.filter((d) => d.id === 'CIT-REF-AUSENTE');
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.source?.documentId).toBe('ausente.md');
    expect(result.html).toContain('[?inexistente]');
  });

  it('não reserva número nem cria lacuna para referência numérica ausente', async () => {
    const references: Registry<BibliographicEntity> = {
      a: reference('a', 'Obra válida', 2024),
    };
    const result = await compilar('Ausente [@x]. Válida [@a].', {
      references,
      perfil: 'abnt-artigo-numerico',
    });

    expect(result.html).toContain('Ausente (?x). Válida (1).');
    expect(result.resolvido.citations.numberByReference.has(asReferenceId('x'))).toBe(false);
    expect(result.resolvido.citations.numberByReference.get(asReferenceId('a'))).toBe(1);
  });
});
