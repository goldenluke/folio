import { describe, expect, it } from 'vitest';

import { citationPreviewText, parseLocatorSuffix, type CitationPreviewReference } from '../apps/desktop/src/renderer/shell/citation-source.js';

describe('F505–F507 — Citation Picker Polish (funções puras do renderer)', () => {
  it('parseLocatorSuffix reconhece locator abreviado e separa sufixo livre', () => {
    expect(parseLocatorSuffix('p. 42')).toEqual({ locator: '42', locatorKind: 'page' });
    expect(parseLocatorSuffix('cap. 3, grifo nosso')).toEqual({ locator: '3', locatorKind: 'chapter', suffix: 'grifo nosso' });
    expect(parseLocatorSuffix('seção 2.1')).toEqual({ locator: '2.1', locatorKind: 'section' });
    expect(parseLocatorSuffix('grifo nosso')).toEqual({ locator: 'grifo nosso' });
    expect(parseLocatorSuffix('')).toEqual({});
  });

  it('citationPreviewText compõe autor/ano/locator para o modo parentético', () => {
    const references = new Map<string, CitationPreviewReference>([
      ['silva2024', { narrativeAuthor: 'Silva', parentheticalAuthor: 'SILVA', year: '2024' }],
    ]);
    const text = citationPreviewText({ mode: 'parenthetical', items: [{ referenceId: 'silva2024', locator: '42', locatorKind: 'page' }] }, references);
    expect(text).toBe('(SILVA, 2024, p. 42)');
  });

  it('citationPreviewText compõe a forma narrativa com autor fora dos parênteses', () => {
    const references = new Map<string, CitationPreviewReference>([
      ['silva2024', { narrativeAuthor: 'Silva', parentheticalAuthor: 'SILVA', year: '2024' }],
    ]);
    const text = citationPreviewText({ mode: 'narrative', items: [{ referenceId: 'silva2024' }] }, references);
    expect(text).toBe('Silva (2024)');
  });

  it('citationPreviewText suprime o autor quando o modo é suppress-author', () => {
    const references = new Map<string, CitationPreviewReference>([
      ['silva2024', { narrativeAuthor: 'Silva', parentheticalAuthor: 'SILVA', year: '2024' }],
    ]);
    const text = citationPreviewText({ mode: 'suppress-author', items: [{ referenceId: 'silva2024' }] }, references);
    expect(text).toBe('(2024)');
  });

  it('citationPreviewText junta múltiplas entradas com ponto e vírgula, e sinaliza referência desconhecida', () => {
    const references = new Map<string, CitationPreviewReference>([
      ['silva2024', { narrativeAuthor: 'Silva', parentheticalAuthor: 'SILVA', year: '2024' }],
      ['souza2020', { narrativeAuthor: 'Souza', parentheticalAuthor: 'SOUZA', year: '2020' }],
    ]);
    expect(citationPreviewText({ mode: 'parenthetical', items: [{ referenceId: 'silva2024' }, { referenceId: 'souza2020' }] }, references)).toBe('(SILVA, 2024; SOUZA, 2020)');
    expect(citationPreviewText({ mode: 'parenthetical', items: [{ referenceId: 'fantasma2099' }] }, references)).toBe('([?fantasma2099])');
  });

  it('citationPreviewText devolve undefined sem itens', () => {
    expect(citationPreviewText({ mode: 'parenthetical', items: [] }, new Map())).toBeUndefined();
  });
});
