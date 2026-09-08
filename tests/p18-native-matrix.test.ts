import { describe, expect, it } from 'vitest';

import {
  OFFICIAL_NATIVE_TARGETS,
  createNativeAddonManifest,
  nativeManifestMismatch,
} from '../apps/desktop/src/workspace/native-addon-manifest.js';

describe('P18 — matriz nativa Linux', () => {
  const manifest = createNativeAddonManifest({
    platform: 'linux',
    architecture: 'x64',
    electronVersion: '39.8.10',
    electronModuleAbi: '140',
    betterSqlite3Version: '12.11.1',
    lockfileSha256: 'a'.repeat(64),
  });

  it('declara Linux x64 como o único target Tier 1 inicial', () => {
    expect(OFFICIAL_NATIVE_TARGETS).toEqual([
      { platform: 'linux', architecture: 'x64', runner: 'ubuntu-22.04', tier: 1 },
    ]);
  });

  it('inclui versões e ABI na identidade do cache', () => {
    expect(manifest.cacheKey).toContain('linux-x64');
    expect(manifest.cacheKey).toContain('electron-39.8.10');
    expect(manifest.cacheKey).toContain('sqlite-12.11.1');
    expect(manifest.cacheKey).toContain('abi-140');
    expect(manifest.cacheKey).toContain('lock-aaaaaaaaaaaaaaaa');
  });

  it('recusa runtime com ABI ou arquitetura diferentes antes de carregar SQLite', () => {
    expect(nativeManifestMismatch(manifest, {
      platform: 'linux',
      architecture: 'x64',
      electronVersion: '39.8.10',
      electronModuleAbi: '141',
    })).toContain('ABI 140 esperado');
    expect(nativeManifestMismatch(manifest, {
      platform: 'linux',
      architecture: 'arm64',
      electronVersion: '39.8.10',
      electronModuleAbi: '140',
    })).toContain('não corresponde');
  });
});
