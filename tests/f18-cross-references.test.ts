import { expect, it } from 'vitest';
import { parseMarkdown } from '@abnt/markdown';
import { percorrer } from '@abnt/document-model';

it('preserva identificador de seção e referência cruzada na AST', () => {
 const ast=parseMarkdown('## Método {#sec:metodo}\n\nVer [[ref:sec:metodo]].');
 const nodes=[...percorrer(ast)];
 expect(nodes.find((n)=>n.type==='section')).toMatchObject({attributes:{identifier:'sec:metodo'}});
 expect(nodes.find((n)=>n.type==='cross-reference')).toMatchObject({target:{kind:'identifier',identifier:'sec:metodo'}});
});

it('atribui IDs a figura, tabela e equação por declaração adjacente', () => {
 const ast=parseMarkdown('![Arquitetura](a.png) {#fig:arq}\n\n| A |\n| - |\n| x |\n\n{#tab:dados}\n\n$$\nx = 1\n$$\n\n{#eq:um}');
 const nodes=[...percorrer(ast)];
 expect(nodes.find((n)=>n.type==='figure')).toMatchObject({attributes:{identifier:'fig:arq'}});
 expect(nodes.find((n)=>n.type==='table')).toMatchObject({attributes:{identifier:'tab:dados'}});
 expect(nodes.find((n)=>n.type==='math-block')).toMatchObject({attributes:{identifier:'eq:um'}});
});
