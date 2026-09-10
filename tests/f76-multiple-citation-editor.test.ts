import { describe, expect, it } from 'vitest';

import { citationSource, editableCitationAt } from '../apps/desktop/src/renderer/shell/citation-source.js';

describe('F76/F77 — grupos de citações e locator tipado', () => {
  it('serializa itens ordenados, cada um com seu locator, prefixo e sufixo', () => {
    expect(citationSource({
      mode: 'parenthetical',
      items: [
        { referenceId: 'silva2024', prefix: 'ver' },
        { referenceId: 'souza2023', locatorKind: 'chapter', locator: '3' },
        { referenceId: 'costa2021', locatorKind: 'page', locator: '42', suffix: 'grifo nosso' },
      ],
    })).toBe('[ver @silva2024; @souza2023, cap. 3; @costa2021, p. 42, grifo nosso]');
  });

  it('reconhece o grupo autoral inteiro para uma única transação de edição', () => {
    const content = 'Base [@silva2024; @souza2023, seção Método].';
    expect(editableCitationAt(content, content.indexOf('souza'))).toEqual({
      range: { start: 5, end: content.length - 1 },
      draft: { mode: 'parenthetical', items: [
        { referenceId: 'silva2024' },
        { referenceId: 'souza2023', locator: 'Método', locatorKind: 'section' },
      ] },
    });
  });

  it('não deixa uma citação anterior capturar um clique no texto comum nem e-mail', () => {
    const content = 'Base [@silva2024] texto comum [rótulo]. Contato: pessoa@universidade.edu.';
    expect(editableCitationAt(content, content.indexOf('texto'))).toBeUndefined();
    expect(editableCitationAt(content, content.indexOf('universidade'))).toBeUndefined();
    expect(editableCitationAt(content, content.indexOf('silva'))).toMatchObject({ range: { start: 5, end: 17 } });
  });
});
