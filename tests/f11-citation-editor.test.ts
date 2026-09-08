import { describe, expect, it } from 'vitest';

import { parseMarkdown } from '@abnt/markdown';
import { percorrer } from '@abnt/document-model';

import { citationSource, editableCitationAt } from '../apps/desktop/src/renderer/shell/citation-source.js';

describe('F11/F12 — autoria visual de citações', () => {
  it('serializa modos editoriais para a gramática Markdown reconhecida', () => {
    expect(citationSource({ referenceId: 'silva2024', mode: 'parenthetical', locator: 'p. 42' })).toBe('[@silva2024, p. 42]');
    expect(citationSource({ referenceId: 'silva2024', mode: 'suppress-author', locator: 'cap. 3' })).toBe('[-@silva2024, cap. 3]');
    expect(citationSource({ referenceId: 'silva2024', mode: 'narrative', locator: 'p. 42' })).toBe('@silva2024 [p. 42]');
  });

  it('reconhece uma citação completa junto ao cursor para uma única transação de substituição', () => {
    const content = 'Como mostra [ver @silva2024, p. 42], o método funciona.';
    const found = editableCitationAt(content, content.indexOf('silva'));
    expect(found).toEqual({ range: { start: 12, end: 35 }, draft: { referenceId: 'silva2024', mode: 'parenthetical', prefix: 'ver', locator: 'p. 42' } });
  });

  it('o parser mantém o locator da citação narrativa na AST sem o renderer precisar formatar norma', () => {
    const document = parseMarkdown('Segundo @silva2024 [p. 42], a hipótese é válida.');
    const citation = [...percorrer(document)].find((node) => node.type === 'citation');
    expect(citation).toMatchObject({ mode: 'narrative', items: [{ referenceId: 'silva2024', locator: { type: 'page', value: '42' } }] });
  });

  it('preserva sufixo livre separado do locator na semântica da citação', () => {
    const document = parseMarkdown('[@silva2024, p. 42, grifo nosso]');
    const citation = [...percorrer(document)].find((node) => node.type === 'citation');
    expect(citation).toMatchObject({ items: [{ locator: { type: 'page', value: '42' }, suffix: [{ value: 'grifo nosso' }] }] });
  });
});
