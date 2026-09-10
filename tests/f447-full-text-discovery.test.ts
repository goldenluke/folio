import { describe, expect, it } from 'vitest';

import { FullTextDiscoveryRegistry, createFullTextCandidate, type FullTextCandidate, type FullTextQuery } from '../packages/full-text-discovery/src/index.js';

const candidate = (overrides: Partial<FullTextCandidate> = {}): FullTextCandidate => createFullTextCandidate({
  provider: 'unpaywall', url: 'https://example.org/artigo.pdf', license: 'open-access', confidence: 0.8, retrievedAt: '2026-09-10T00:00:00.000Z', ...overrides,
});

describe('F447–F453 — Full Text Discovery', () => {
  it('agrega candidatos de múltiplos providers e nunca decide sozinho o que anexar', async () => {
    const registry = new FullTextDiscoveryRegistry();
    registry.register({ provider: 'unpaywall', async resolve() { return [candidate()]; } });
    registry.register({ provider: 'arxiv', async resolve() { return [candidate({ provider: 'arxiv', url: 'https://arxiv.org/abs/2601.00001', confidence: 0.6 })]; } });
    const review = await registry.discover({ doi: '10.1000/exemplo' });
    expect(review.candidates).toHaveLength(2);
    expect(review.failures).toEqual([]);
    expect(review.candidates.map((item) => item.provider).sort()).toEqual(['arxiv', 'unpaywall']);
  });

  it('deduplica por URL preservando o candidato de maior confiança', async () => {
    const registry = new FullTextDiscoveryRegistry();
    registry.register({ provider: 'repositorio-a', async resolve() { return [candidate({ provider: 'repositorio-a', confidence: 0.4 })]; } });
    registry.register({ provider: 'repositorio-b', async resolve() { return [candidate({ provider: 'repositorio-b', confidence: 0.9 })]; } });
    const review = await registry.discover({ doi: '10.1000/exemplo' });
    expect(review.candidates).toHaveLength(1);
    expect(review.candidates[0]).toMatchObject({ provider: 'repositorio-b', confidence: 0.9 });
  });

  it('um provider que falha não derruba os demais nem vira exceção silenciosa', async () => {
    const registry = new FullTextDiscoveryRegistry();
    registry.register({ provider: 'instavel', async resolve() { throw new Error('timeout de rede'); } });
    registry.register({ provider: 'estavel', async resolve() { return [candidate({ provider: 'estavel' })]; } });
    const review = await registry.discover({ title: 'Ensino híbrido' });
    expect(review.candidates).toHaveLength(1);
    expect(review.failures).toEqual([{ provider: 'instavel', message: 'timeout de rede' }]);
  });

  it('descarta candidato malformado do adapter sem corromper a revisão', async () => {
    const registry = new FullTextDiscoveryRegistry();
    registry.register({ provider: 'ruim', async resolve() { return [{ provider: 'ruim', url: 'javascript:alert(1)', license: 'unknown', confidence: 0.5, retrievedAt: '2026-09-10' }]; } });
    registry.register({ provider: 'bom', async resolve() { return [candidate({ provider: 'bom' })]; } });
    const review = await registry.discover({ doi: '10.1000/exemplo' });
    expect(review.candidates).toEqual([expect.objectContaining({ provider: 'bom' })]);
  });

  it('rejeita busca sem DOI nem título e rejeita candidato com confiança fora de 0–1', async () => {
    const registry = new FullTextDiscoveryRegistry();
    await expect(registry.discover({} as FullTextQuery)).rejects.toThrow('DOI ou título');
    expect(() => candidate({ confidence: 1.5 })).toThrow('entre 0 e 1');
  });
});
