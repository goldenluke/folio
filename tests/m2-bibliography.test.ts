import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  formatarReferenciaAbnt,
  importarBibtex,
  referenciaComoTexto,
} from '@abnt/bibliography';
import { cslBibliographicEntityV1 } from '@abnt/document-model';

const AQUI = dirname(fileURLToPath(import.meta.url));
const BIB = join(AQUI, '..', 'fixtures', 'm2', 'referencias.bib');
const ORACLE = join(AQUI, 'oracles', 'abnt-ufrgs-m2.json');

describe('M2: BibTeX -> CSL-JSON', () => {
  it('normaliza os seis tipos centrais sem deixar quirks no modelo canônico', async () => {
    const result = importarBibtex(await readFile(BIB, 'utf8'), { documentId: 'referencias.bib' });

    expect(result.diagnostics).toEqual([]);
    expect(Object.keys(result.references)).toHaveLength(6);
    expect(result.references['silva2024']).toMatchObject({
      id: 'silva2024',
      type: 'book',
      author: [{ family: 'Silva', given: 'João' }],
      issued: { 'date-parts': [[2024]] },
      publisher: 'Atlas',
      'publisher-place': 'São Paulo',
    });
    expect(result.references['costa2021']).toMatchObject({
      type: 'chapter',
      'container-title': 'Fundamentos de computação distribuída',
      page: '45–68',
    });
    expect(result.references['ibge2025']).toMatchObject({
      type: 'webpage',
      accessed: { 'date-parts': [[2026, 9, 7]] },
      URL: 'https://example.org/indicadores-internet',
    });

    for (const entry of Object.values(result.references)) {
      expect(cslBibliographicEntityV1.safeParse(entry).success).toBe(true);
      expect(entry).not.toHaveProperty('year');
      expect(entry).not.toHaveProperty('journal');
      expect(entry).not.toHaveProperty('booktitle');
    }
  });

  it('transforma falhas, chave ausente e duplicada em diagnósticos', () => {
    const malformed = importarBibtex('@book{a,title={incompleto}');
    expect(malformed.diagnostics.some((d) => d.id === 'BIBTEX-SINTAXE')).toBe(true);

    const withoutKey = importarBibtex('@book{, title={Sem chave}}');
    expect(withoutKey.diagnostics.some((d) => d.id === 'BIBTEX-CHAVE-AUSENTE')).toBe(true);

    const duplicate = importarBibtex('@book{x,title={A}}\n@book{x,title={B}}');
    expect(duplicate.diagnostics.some((d) => d.id === 'BIBTEX-CHAVE-DUPLICADA')).toBe(true);
  });
});

describe('M2: referências NBR 6023:2018', () => {
  it('mantém um golden por tipo, conferido contra o estilo CSL registrado', async () => {
    const imported = importarBibtex(await readFile(BIB, 'utf8'));
    const oracle = JSON.parse(await readFile(ORACLE, 'utf8')) as {
      references: Record<string, string>;
    };

    const output = Object.fromEntries(
      Object.values(imported.references).map((entry) => [
        entry.type,
        referenciaComoTexto(formatarReferenciaAbnt(entry)),
      ]),
    );

    expect(output).toEqual(oracle.references);
  });

  it('marca títulos principais para ênfase tipográfica sem congelar HTML', async () => {
    const imported = importarBibtex(await readFile(BIB, 'utf8'));
    const book = imported.references['silva2024'];
    expect(book).toBeDefined();
    if (book === undefined) return;
    expect(formatarReferenciaAbnt(book).some((part) => part.style === 'strong')).toBe(true);
  });
});
