import { describe, expect, it } from 'vitest';

import { validarSystemInformationDto } from '@abnt/protocol';

import {
  BUILD_INFORMATION_FILE,
  buildChannelFromEnvironment,
  createBuildInformation,
} from '../apps/desktop/src/shared/build-information.js';

describe('P22 — identidade de build', () => {
  it('cria uma projeção versionada, pública e validável', () => {
    const identity = createBuildInformation({
      appVersion: '0.1.0-dev.0',
      commit: 'abcdef123456',
      channel: 'development',
      platform: 'linux',
      architecture: 'x64',
      electronVersion: '39.2.7',
      protocolVersion: 1,
      workspaceConfigSchemaVersion: 1,
      workspaceStateSchemaVersion: 1,
      workspaceIndexSchemaVersion: 1,
      pluginApiVersion: 1,
    });

    expect(validarSystemInformationDto(identity)).toMatchObject({ ok: true });
    expect(identity).not.toHaveProperty('vaultPath');
    expect(identity).not.toHaveProperty('workspaceId');
    expect(BUILD_INFORMATION_FILE).toBe('build-info.json');
  });

  it('aceita somente canais de distribuição conhecidos', () => {
    expect(buildChannelFromEnvironment(undefined)).toBe('development');
    expect(buildChannelFromEnvironment('stable')).toBe('stable');
    expect(() => buildChannelFromEnvironment('nightly')).toThrow('Canal de build inválido');
  });
});
