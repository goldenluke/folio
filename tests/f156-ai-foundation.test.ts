import { describe, expect, it } from 'vitest';
import { actionPreview, buildAiContext, claimToSource, createLocalAiProvider, disclosureFor, hybridSearch, semanticSearch } from '../packages/ai/src/index.js';

describe('F156–F166 — IA acadêmica local e opt-in', () => {
  const context = buildAiContext([
    { id: 'selection', kind: 'selection', label: 'Trecho em Methods', text: 'A amostra teve 40 participantes.', source: { fileId: 'methods', path: 'methods.md' } },
    { id: 'reference', kind: 'reference', label: 'Silva 2024', text: 'Estudo qualitativo com entrevistas.', source: { url: 'https://doi.org/example' } },
    { id: 'selection', kind: 'selection', label: 'duplicado', text: 'não entra' },
  ]);

  it('só envia o contexto explicitamente selecionado e mostra sua divulgação', () => {
    expect(context.items).toHaveLength(2);
    expect(disclosureFor({ label: 'Modelo local', external: false }, context)).toMatchObject({ external: false, totalCharacters: 67 });
  });

  it('mantém o provider local adaptável e não conhece um vendor', async () => {
    const provider = createLocalAiProvider({ model: 'teste', transport: { async post(path) { return path === '/v1/chat/completions' ? { choices: [{ message: { content: 'Resumo local.' } }] } : { data: [{ embedding: [1, 0] }] }; } } });
    await expect(provider.complete({ instruction: 'Resuma', context })).resolves.toMatchObject({ text: 'Resumo local.', provider: 'local' });
    await expect(provider.embed?.({ texts: ['a'] })).resolves.toEqual([[1, 0]]);
  });

  it('oferece sugestões e previews sem editar o documento', () => {
    expect(claimToSource('entrevistas qualitativas', [{ id: 'a', text: 'entrevistas qualitativas com participantes' }, { id: 'b', text: 'ensaio clínico' }])[0]?.sourceId).toBe('a');
    expect(semanticSearch([1, 0], [{ id: 'a', embedding: [1, 0] }, { id: 'b', embedding: [0, 1] }])[0]?.sourceId).toBe('a');
    expect(hybridSearch([{ sourceId: 'a', score: .5, reason: '' }], [{ sourceId: 'a', score: 1, reason: '' }])[0]?.score).toBeCloseTo(.8);
    expect(actionPreview('texto antigo', 'texto novo')).toMatchObject({ removed: 'antig', inserted: 'nov' });
  });
});
