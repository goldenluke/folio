import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const desktop = resolve(import.meta.dirname, '../apps/desktop/src');

describe('F563 — gerenciador de vaults', () => {
  it('mantém criação e recentes no Main, com superfície preload validada', async () => {
    const [api, ipc] = await Promise.all([
      readFile(resolve(desktop, 'shared/api.ts'), 'utf8'),
      readFile(resolve(desktop, 'main/ipc.ts'), 'utf8'),
    ]);
    for (const token of ['vaults', 'createVault', 'forgetVault']) {
      expect(api).toContain(token);
      expect(ipc).toContain(`DESKTOP_CHANNELS.${token}`);
    }
    expect(ipc).toContain("writeFile(join(rootPath, 'README.md')");
  });

  it('substitui o atalho de abrir pela janela de gerenciamento', async () => {
    const [app, dialog] = await Promise.all([
      readFile(resolve(desktop, 'renderer/app.tsx'), 'utf8'),
      readFile(resolve(desktop, 'renderer/vault-manager.tsx'), 'utf8'),
    ]);
    expect(app).toContain("id: 'workspace.manageVaults'");
    expect(app).toContain('Gerenciar vaults');
    expect(dialog).toContain('Criar vault');
    expect(dialog).toContain('Escolher pasta');
    expect(dialog).toContain('Remover dos recentes?');
  });
});
