import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('CH.11 — sessões de pesquisa', () => {
  it('persiste título, início, encerramento e métricas por aba', () => {
    const source = readFileSync('apps/desktop/src/renderer/research-browser.tsx', 'utf8');
    expect(source).toContain('folio.research-session:${initialUrl}');
    expect(source).toContain('startedAt');
    expect(source).toContain('endedAt');
    expect(source).toContain('analyses');
    expect(source).toContain('captures');
    expect(source).toContain('Título da sessão de pesquisa');
    expect(source).toContain('window.localStorage.setItem');
  });
});
