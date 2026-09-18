import { describe, expect, it } from 'vitest';
import { authoredBlocks, blockReference, parseBlockReference, transcludeBlock } from '../packages/block-composition/src/index.js';

describe('F406 — auditoria de composição de blocos', () => {
  it('resolve bloco autoral por resolver injetado', () => {
    const source = '# Resultado\n\nConteúdo\n^resultado-principal';
    const parsed = parseBlockReference(blockReference('notes/resultado.md', 'resultado-principal'));
    expect(parsed).toEqual({ path: 'notes/resultado.md', blockId: 'resultado-principal' });
    expect(authoredBlocks(source)).toHaveLength(1);
    expect(transcludeBlock(parsed!, () => source)?.source).toContain('Conteúdo');
  });
});
