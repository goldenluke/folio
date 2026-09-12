import { describe, expect, it } from 'vitest';

import { focusTrapDestination } from '../apps/desktop/src/renderer/dialog-navigation.js';

describe('F552 — navegação de foco em diálogos', () => {
  const first = { id: 'first' };
  const middle = { id: 'middle' };
  const last = { id: 'last' };

  it('volta ao último controle com Shift+Tab no primeiro', () => {
    expect(focusTrapDestination([first, middle, last], first, true)).toBe(last);
  });

  it('volta ao primeiro controle com Tab no último', () => {
    expect(focusTrapDestination([first, middle, last], last, false)).toBe(first);
  });

  it('não interfere no foco que ainda está dentro da sequência', () => {
    expect(focusTrapDestination([first, middle, last], middle, false)).toBeUndefined();
    expect(focusTrapDestination([], null, false)).toBeUndefined();
  });
});
