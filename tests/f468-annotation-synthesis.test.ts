import { describe, expect, it } from 'vitest';

import {
  createColorSemantics,
  isAlreadySynthesized,
  parseColorSemantics,
  synthesizeAnnotations,
  unsynthesizedAnnotations,
  type SynthesizableAnnotation,
} from '../packages/annotation-synthesis/src/index.js';

const annotation = (overrides: Partial<SynthesizableAnnotation> = {}): SynthesizableAnnotation => ({
  id: 'a1', referenceId: 'silva2026', page: 4, quote: 'trecho relevante', ...overrides,
});

describe('F468–F475 — Annotation Synthesis', () => {
  it('produz lista simples de citações reais, com marcador e comentário opcional', () => {
    const markdown = synthesizeAnnotations({ annotations: [annotation({ comment: 'Relacionar ao método' })], template: 'quote-list' });
    expect(markdown).toContain('<!-- folio-pdf-annotation:a1 -->');
    expect(markdown).toContain('> trecho relevante');
    expect(markdown).toContain('[@silva2026, p. 4]');
    expect(markdown).toContain('Relacionar ao método');
  });

  it('agrupa por fonte usando o rótulo da referência quando fornecido', () => {
    const markdown = synthesizeAnnotations({
      annotations: [annotation({ id: 'a1', referenceId: 'silva2026' }), annotation({ id: 'a2', referenceId: 'costa2020', page: 9 })],
      template: 'grouped-by-source',
      referenceLabels: { silva2026: 'Silva (2026)', costa2020: 'Costa (2020)' },
    });
    expect(markdown.indexOf('### Silva (2026)')).toBeLessThan(markdown.indexOf('<!-- folio-pdf-annotation:a1 -->'));
    expect(markdown.indexOf('### Costa (2020)')).toBeLessThan(markdown.indexOf('<!-- folio-pdf-annotation:a2 -->'));
  });

  it('agrupa por cor usando a semântica configurada, com fallback para "Sem cor"', () => {
    const markdown = synthesizeAnnotations({
      annotations: [annotation({ id: 'a1', color: '#fde047' }), annotation({ id: 'a2', color: undefined })],
      template: 'grouped-by-color',
      colorSemantics: { '#fde047': 'Evidência' },
    });
    expect(markdown).toContain('### Evidência');
    expect(markdown).toContain('### Sem cor');
  });

  it('rejeita síntese sem nenhuma anotação selecionada', () => {
    expect(() => synthesizeAnnotations({ annotations: [], template: 'quote-list' })).toThrow('Selecione ao menos uma');
  });

  it('detecta idempotência pelo marcador e filtra anotações já sintetizadas', () => {
    const content = 'texto anterior\n\n<!-- folio-pdf-annotation:a1 -->\n> já inserida\n';
    expect(isAlreadySynthesized(content, 'a1')).toBe(true);
    expect(isAlreadySynthesized(content, 'a2')).toBe(false);
    const pending = unsynthesizedAnnotations(content, [annotation({ id: 'a1' }), annotation({ id: 'a2' })]);
    expect(pending.map((item) => item.id)).toEqual(['a2']);
  });

  it('cria e revalida semântica de cor, exigindo rótulo não vazio para cada cor', () => {
    expect(createColorSemantics({ '#fde047': 'Evidência' })).toEqual({ version: 1, colors: { '#fde047': 'Evidência' } });
    expect(() => createColorSemantics({ '#fde047': '' })).toThrow('rótulo');
    expect(() => createColorSemantics({ '': 'Evidência' })).toThrow('identidade');
  });

  it('descarta entradas corrompidas de semântica de cor sem derrubar o mapa inteiro', () => {
    expect(parseColorSemantics({ version: 1, colors: { '#fde047': 'Evidência', '#f87171': '', vazio: 42 } })).toEqual({ version: 1, colors: { '#fde047': 'Evidência' } });
    expect(parseColorSemantics({ garbage: true })).toEqual({ version: 1, colors: {} });
  });
});
