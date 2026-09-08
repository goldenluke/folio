import { describe, expect, it } from 'vitest';

import { asReferenceId, type BibliographicEntity, type Registry } from '@abnt/document-model';
import {
  exportarBibtex,
  exportarCslJson,
  exportarRis,
  importarBibtex,
  importarCslJson,
  importarRis,
} from '@abnt/bibliography';

const TANENBAUM: BibliographicEntity = {
  id: asReferenceId('tanenbaum2017'),
  type: 'book',
  title: 'Distributed Systems',
  author: [{ given: 'Andrew S.', family: 'Tanenbaum' }],
  issued: { 'date-parts': [[2017]] },
  publisher: 'Pearson',
  'publisher-place': 'Boston',
};

describe('F9 — BibTeX export', () => {
  it('exporta e reimporta preservando os campos principais', () => {
    const registry: Registry<BibliographicEntity> = { tanenbaum2017: TANENBAUM };
    const bibtex = exportarBibtex(registry);
    expect(bibtex).toContain('@book{tanenbaum2017,');
    expect(bibtex).toContain('title = {{Distributed Systems}}');
    expect(bibtex).toContain('author = {Tanenbaum, Andrew S.}');

    const reimported = importarBibtex(bibtex);
    expect(reimported.diagnostics).toHaveLength(0);
    // @retorquere/bibtex-parser sentence-casa títulos por padrão mesmo com
    // chave dupla de proteção — comportamento do parser, não do export.
    expect(reimported.references.tanenbaum2017).toMatchObject({
      type: 'book',
      author: [{ family: 'Tanenbaum', given: 'Andrew S.' }],
      publisher: 'Pearson',
    });
    expect(reimported.references.tanenbaum2017?.title).toMatch(/^Distributed [Ss]ystems$/u);
  });
});

describe('F9 — RIS import/export', () => {
  it('importa um bloco RIS típico (estilo Zotero/Mendeley)', () => {
    const ris = [
      'TY  - JOUR',
      'AU  - Tanenbaum, Andrew S.',
      'TI  - Distributed Systems',
      'T2  - Pearson Series',
      'PY  - 2017',
      'PB  - Pearson',
      'VL  - 3',
      'SP  - 1',
      'EP  - 40',
      'DO  - 10.1000/xyz',
      'UR  - https://example.org/ds',
      'ER  - ',
      '',
    ].join('\n');

    const result = importarRis(ris);
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0);
    const entries = Object.entries(result.references);
    expect(entries).toHaveLength(1);
    const [key, entry] = entries[0] as [string, BibliographicEntity];
    expect(key).toBe('tanenbaum2017');
    expect(entry).toMatchObject({
      type: 'article-journal',
      title: 'Distributed Systems',
      author: [{ family: 'Tanenbaum', given: 'Andrew S.' }],
      publisher: 'Pearson',
      volume: '3',
      page: '1-40',
      DOI: '10.1000/xyz',
      URL: 'https://example.org/ds',
    });
    expect(entry.issued?.['date-parts']?.[0]?.[0]).toBe(2017);
  });

  it('gera chave a partir de autor+ano quando ID não está presente, sem colisão', () => {
    const ris = [
      'TY  - BOOK',
      'AU  - Silva, Joao',
      'TI  - Primeiro',
      'PY  - 2020',
      'ER  - ',
      'TY  - BOOK',
      'AU  - Silva, Joao',
      'TI  - Segundo',
      'PY  - 2020',
      'ER  - ',
      '',
    ].join('\n');
    const result = importarRis(ris);
    const keys = Object.keys(result.references).sort();
    expect(keys).toHaveLength(2);
    expect(keys[0]).not.toBe(keys[1]);
  });

  it('round-trip export -> import preserva tipo, autor e ano', () => {
    const registry: Registry<BibliographicEntity> = { tanenbaum2017: TANENBAUM };
    const ris = exportarRis(registry);
    const reimported = importarRis(ris);
    expect(reimported.references.tanenbaum2017).toMatchObject({
      type: 'book',
      title: 'Distributed Systems',
      author: [{ family: 'Tanenbaum', given: 'Andrew S.' }],
    });
  });
});

describe('F9 — CSL-JSON import/export', () => {
  it('exporta como array CSL-JSON e reimporta identicamente', () => {
    const registry: Registry<BibliographicEntity> = { tanenbaum2017: TANENBAUM };
    const json = exportarCslJson(registry);
    const parsed = JSON.parse(json) as unknown;
    expect(Array.isArray(parsed)).toBe(true);

    const reimported = importarCslJson(json);
    expect(reimported.diagnostics).toHaveLength(0);
    expect(reimported.references.tanenbaum2017).toMatchObject({
      type: 'book',
      title: 'Distributed Systems',
      publisher: 'Pearson',
    });
  });

  it('aceita CSL-JSON como objeto por id (não só array)', () => {
    const json = JSON.stringify({ x2024: { id: 'x2024', type: 'webpage', title: 'Página' } });
    const result = importarCslJson(json);
    expect(result.diagnostics).toHaveLength(0);
    expect(result.references.x2024).toMatchObject({ type: 'webpage', title: 'Página' });
  });

  it('rejeita JSON malformado e item com type inválido, sem lançar', () => {
    expect(importarCslJson('{ isto nao é json')).toMatchObject({
      references: {},
      diagnostics: [expect.objectContaining({ severity: 'error' })],
    });
    expect(importarCslJson(JSON.stringify([{ id: 'x', type: 'tipo-que-nao-existe' }]))).toMatchObject({
      references: {},
      diagnostics: [expect.objectContaining({ severity: 'error' })],
    });
  });

  it('detecta chave duplicada dentro do mesmo arquivo CSL-JSON', () => {
    const json = JSON.stringify([
      { id: 'dup', type: 'book', title: 'Um' },
      { id: 'dup', type: 'book', title: 'Dois' },
    ]);
    const result = importarCslJson(json);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ id: 'CSL-JSON-CHAVE-DUPLICADA' }));
    expect(Object.keys(result.references)).toHaveLength(1);
  });
});
