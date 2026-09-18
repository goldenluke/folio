import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('F405 — Canvas daily workflow', () => {
  it('mantém as três pontes explícitas e confirmáveis', async () => {
    const source = await readFile('apps/desktop/src/renderer/research-canvas.tsx', 'utf8');
    expect(source).toContain('canvasTextForWriting');
    expect(source).toContain('onInsertWriting(writingPreview)');
    expect(source).toContain('literature-note');
    expect(source).toContain('pdf-annotation');
    expect(source).toContain('Preparar prévia');
    expect(source).toContain('Inserir no documento ativo');
  });
});
