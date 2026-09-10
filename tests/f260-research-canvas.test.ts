import { describe, expect, it } from 'vitest';
import { argumentMap, canvasSearch, canvasTextForWriting, createResearchCanvas, moveCanvasNode, outlinePreview, parseResearchCanvas, removeCanvasNode } from '../packages/research-canvas/src/index.js';
describe('F260–F266 — Research Canvas', () => {
  const canvas = createResearchCanvas({ id: 'revisao', title: 'Mapa da revisão', nodes: [{ id: 'claim', type: 'text', text: 'A intervenção reduz o risco.', role: 'claim', x: 0, y: 0 }, { id: 'paper', type: 'reference', referenceId: 'silva2024', x: 240, y: 20 }], edges: [{ id: 'e1', from: 'paper', to: 'claim', kind: 'supports' }], groups: [{ id: 'g1', label: 'Evidências', nodeIds: ['paper'] }] });
  it('modela fontes e cartões de argumento sem inserir conceitos no documento', () => { expect(canvas.schema).toBe('folio-research-canvas'); expect(argumentMap(canvas)).toEqual([canvas.edges[0]]); });
  it('gera outline e busca como projeções do artefato', () => { expect(outlinePreview(canvas)).toHaveLength(2); expect(canvasSearch(canvas, 'silva')).toMatchObject([{ type: 'reference' }]); });
  it('rejeita conexões para nós inexistentes', () => expect(() => createResearchCanvas({ ...canvas, edges: [{ id: 'bad', from: 'missing', to: 'claim', kind: 'supports' }] })).toThrow('Conexão'));
  it('preserva coordenadas operacionais e só produz texto após uma prévia explícita', () => {
    const moved = moveCanvasNode(canvas, 'claim', 80, 120);
    expect(moved.nodes[0]).toMatchObject({ x: 80, y: 120 });
    expect(canvasTextForWriting(moved)).toBe('- A intervenção reduz o risco.');
    expect(parseResearchCanvas(JSON.parse(JSON.stringify(moved)))).toEqual(moved);
  });
  it('remove cartões sem deixar relações e grupos órfãos', () => {
    expect(removeCanvasNode(canvas, 'paper')).toMatchObject({ nodes: [{ id: 'claim' }], edges: [], groups: [] });
  });
});
