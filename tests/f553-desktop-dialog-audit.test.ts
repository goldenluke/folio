import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const renderer = resolve(import.meta.dirname, '../apps/desktop/src/renderer');

describe('F553/F554 — contrato mínimo das janelas desktop', () => {
  it('nomeia todos os diálogos declarados no renderer', async () => {
    const entries = await readdir(renderer);
    const dialogFiles = await Promise.all(entries.filter((entry) => entry.endsWith('.tsx')).map(async (entry) => ({
      entry,
      content: await readFile(resolve(renderer, entry), 'utf8'),
    })));
    const modalSources = dialogFiles.filter(({ content }) => content.includes('role="dialog"') || content.includes('role="alertdialog"'));
    expect(modalSources.length).toBeGreaterThan(10);
    for (const { entry, content } of modalSources) {
      expect(content, `${entry} precisa nomear o diálogo`).toMatch(/aria-label(?:ledby)?=/u);
    }
  });

  it('mantém estado explícito para as superfícies assíncronas priorizadas pela BV', async () => {
    for (const entry of ['academic-forms.tsx', 'structured-research.tsx', 'profile-inspector.tsx', 'history-dialog.tsx', 'capture-inbox.tsx', 'literature-monitoring.tsx']) {
      const content = await readFile(resolve(renderer, entry), 'utf8');
      expect(content, `${entry} precisa anunciar carregamento`).toContain('role="status"');
      expect(content, `${entry} precisa expor falha recuperável`).toContain('role="alert"');
    }
  });

  it('converte controles de fechar legados em botões nomeados com ícone', async () => {
    const content = await readFile(resolve(renderer, 'dialog-accessibility.ts'), 'utf8');
    expect(content).toContain('function upgradeLegacyCloseButtons');
    expect(content).toContain("button.dataset.dialogClose = ''");
    expect(content).toContain("button.replaceChildren(icon)");
    expect(content).not.toContain("find((button) => button.textContent?.trim() === '×')");
  });
});
