import { describe, expect, it } from 'vitest';
import { authoredBlocks, blockReference, parseBlockReference, previewExtractSelection, previewMergeModule, transcludeBlock } from '../packages/block-composition/src/index.js';
describe('F274–F280 — composição por bloco', () => {
  const source = 'Introdução do resultado.\n^resultado-principal\n\nOutro bloco.\n^outro';
  it('localiza IDs autorais e resolve referência de bloco sem filesystem', () => { expect(authoredBlocks(source)[0]).toMatchObject({ id: 'resultado-principal', source: 'Introdução do resultado.' }); const reference = parseBlockReference('[[papers/resultado.md#^resultado-principal]]')!; expect(transcludeBlock(reference, () => source)?.id).toBe('resultado-principal'); });
  it('cria referências estáveis e valida sintaxe', () => { expect(blockReference('paper.md', 'resultado-principal')).toBe('[[paper.md#^resultado-principal]]'); expect(parseBlockReference('[[paper.md#resultado]]')).toBeUndefined(); });
  it('produz prévia de extração e merge antes de mutação', () => { const preview = previewExtractSelection({ source: 'Antes texto depois', start: 6, end: 11, destinationPath: 'notes/texto.md', title: 'Texto', blockId: 'texto' }); expect(preview.newDocument).toContain('texto\n^texto'); expect(preview.replacement).toContain('#^texto'); expect(previewMergeModule('# Base\n', '# Módulo', 7)).toContain('# Módulo'); });
});
