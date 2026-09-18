import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('polish final — fluxos críticos não prendem a interface', () => {
  it('mantém Sync e Colaboração com loading, recuperação e saída explícita', async () => {
    const source = await readFile(resolve(import.meta.dirname, '../apps/desktop/src/renderer/app.tsx'), 'utf8');
    expect(source).toContain('Não foi possível consultar a sincronização.');
    expect(source).toContain('Não foi possível carregar a colaboração.');
    expect(source).toContain('Verificando sincronização…');
    expect(source).toContain('Carregando colaboração…');
    expect(source).toContain('Tentar novamente');
    expect(source).toContain('aria-label="Fechar colaboração"');
  });
});
