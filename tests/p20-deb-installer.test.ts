import { access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const config = require('../apps/desktop/folio-builder.config.cjs') as {
  readonly linux: {
    readonly icon: string;
    readonly syncDesktopName: boolean;
    readonly desktop: { readonly entry: Readonly<Record<string, string>> };
  };
  readonly deb: {
    readonly packageName: string;
    readonly packageCategory: string;
    readonly priority: string;
  };
};

describe('P20 — instalador Debian Linux', () => {
  it('declara somente o formato Debian e uma entrada de desktop associável', () => {
    expect(config.deb).toEqual({ packageName: 'folio', packageCategory: 'editors', priority: 'optional' });
    expect(config.linux.syncDesktopName).toBe(true);
    expect(config.linux.desktop.entry).toMatchObject({ Name: 'Folio', Categories: 'Office;Education;', StartupWMClass: 'Folio' });
  });

  it('mantém o conjunto de ícones versionado para o pacote', async () => {
    for (const size of [64, 128, 256, 512]) {
      await access(resolve('apps/desktop', config.linux.icon, `${size}x${size}.png`));
    }
    await access('apps/desktop/build/icons/folio.svg');
  });
});
