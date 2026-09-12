import { describe, expect, it } from 'vitest';

import {
  OFFICIAL_NATIVE_TARGETS,
  createNativeAddonManifest,
  nativeManifestMismatch,
} from '../apps/desktop/src/workspace/native-addon-manifest.js';

describe('P18 / F557 — matriz nativa por runner', () => {
  const manifest = createNativeAddonManifest({
    platform: 'linux',
    architecture: 'x64',
    electronVersion: '39.8.10',
    electronModuleAbi: '140',
    betterSqlite3Version: '12.11.1',
    lockfileSha256: 'a'.repeat(64),
  });

  it('declara Linux e Windows x64 como targets Tier 1, cada um com runner próprio', () => {
    expect(OFFICIAL_NATIVE_TARGETS).toEqual([
      { platform: 'linux', architecture: 'x64', runner: 'ubuntu-22.04', tier: 1 },
      { platform: 'win32', architecture: 'x64', runner: 'windows-2022', tier: 1 },
    ]);
  });

  it('mantém a identidade Windows separada do binding Linux', () => {
    const windows = createNativeAddonManifest({
      platform: 'win32',
      architecture: 'x64',
      electronVersion: '39.8.10',
      electronModuleAbi: '140',
      betterSqlite3Version: '12.11.1',
      lockfileSha256: 'b'.repeat(64),
    });
    expect(windows.cacheKey).toContain('win32-x64');
    expect(nativeManifestMismatch(windows, {
      platform: 'linux',
      architecture: 'x64',
      electronVersion: '39.8.10',
      electronModuleAbi: '140',
    })).toContain('não corresponde');
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
