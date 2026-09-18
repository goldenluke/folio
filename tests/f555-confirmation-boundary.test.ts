import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const renderer = resolve(import.meta.dirname, '../apps/desktop/src/renderer');

describe('F555 — confirmação antes de mutações ou envios sensíveis', () => {
  it('não usa confirmações nativas no renderer', async () => {
    const [intake, research] = await Promise.all([
      readFile(resolve(renderer, 'research-intake.tsx'), 'utf8'),
      readFile(resolve(renderer, 'structured-research.tsx'), 'utf8'),
    ]);

    for (const content of [intake, research]) {
      expect(content).toContain("requestConfirmation");
      expect(content).not.toContain('window.confirm');
    }
  });

  it('mantém a confirmação acessível como a única fronteira compartilhada', async () => {
    const prompt = await readFile(resolve(renderer, 'text-prompt.tsx'), 'utf8');
    expect(prompt).toContain('role="alertdialog"');
    expect(prompt).toContain('aria-describedby="confirmation-description"');
  });
});
