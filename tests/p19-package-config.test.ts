import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const config = require('../apps/desktop/folio-builder.config.cjs') as {
  readonly appId: string;
  readonly productName: string;
  readonly asar: boolean;
  readonly extraResources: readonly { readonly from: string; readonly to: string }[];
  readonly npmRebuild: boolean;
  readonly linux: { readonly target: readonly string[]; readonly executableName: string };
};

describe('P19 — package Linux não assinado', () => {
  it('produz somente o diretório Linux x64 e mantém ASAR habilitado', () => {
    expect(config.appId).toBe('com.folio.academic');
    expect(config.productName).toBe('Folio');
    expect(config.linux.target).toEqual(['dir']);
    expect(config.linux.executableName).toBe('folio');
    expect(config.asar).toBe(true);
  });

  it('mantém o runtime privado do Workspace Service fora do ASAR e não pede rebuild global', () => {
    expect(config.extraResources).toContainEqual(expect.objectContaining({ to: 'workspace-runtime' }));
    expect(config.npmRebuild).toBe(false);
  });
});
