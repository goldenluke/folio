import { describe, expect, it } from 'vitest';

import { PROTOCOL_VERSION } from '@abnt/protocol';

import { DESKTOP_CHANNELS, createAcademicDesktopApi } from '../apps/desktop/src/shared/api.js';

describe('P8 — API estreita do preload', () => {
  it('valida resposta e não expõe IPC genérico ao renderer', async () => {
    const calls: Array<{ channel: string; value: unknown }> = [];
    const api = createAcademicDesktopApi({
      async invoke(channel, value) {
        calls.push({ channel, value });
        return {
          ok: true,
          value: {
            workspaceId: 'workspace_1',
            configuration: { ignoredPaths: [] },
            files: [],
          },
        };
      },
      subscribe: () => () => undefined,
    });

    const result = await api.workspace.chooseAndOpen();

    expect(result).toMatchObject({ ok: true, value: { workspaceId: 'workspace_1' } });
    expect(calls).toEqual([{ channel: DESKTOP_CHANNELS.chooseWorkspace, value: undefined }]);
    expect(Object.keys(api)).toEqual(['application', 'workspace', 'library', 'research', 'documents', 'editor', 'language', 'onEvent']);
    expect(PROTOCOL_VERSION).toBe(1);
  });

  it('expõe abertura por caminho como capacidade validada, não como IPC genérico', async () => {
    const calls: Array<{ channel: string; value: unknown }> = [];
    const api = createAcademicDesktopApi({
      async invoke(channel, value) {
        calls.push({ channel, value });
        return { ok: true, value: { workspaceId: 'workspace_1', configuration: { ignoredPaths: [] }, files: [] } };
      },
      subscribe: () => () => undefined,
    });

    await expect(api.workspace.open({ rootPath: '/tmp/vault' })).resolves.toMatchObject({ ok: true });
    expect(calls).toEqual([{ channel: DESKTOP_CHANNELS.openWorkspace, value: { rootPath: '/tmp/vault' } }]);
    await expect(api.workspace.open({ rootPath: '' })).resolves.toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
  });

  it('expõe restauração do último vault sem entregar seu caminho ao renderer', async () => {
    const calls: Array<{ channel: string; value: unknown }> = [];
    const api = createAcademicDesktopApi({
      async invoke(channel, value) {
        calls.push({ channel, value });
        return { ok: true, value: { workspaceId: 'workspace_1', configuration: { ignoredPaths: [] }, files: [] } };
      },
      subscribe: () => () => undefined,
    });

    await expect(api.workspace.restoreLast()).resolves.toMatchObject({ ok: true });
    expect(calls).toEqual([{ channel: DESKTOP_CHANNELS.restoreWorkspace, value: undefined }]);
  });

  it('recusa uma resposta que não obedece ao DTO', async () => {
    const api = createAcademicDesktopApi({
      async invoke() {
        return { ok: true, value: { workspaceId: 42 } };
      },
      subscribe: () => () => undefined,
    });

    await expect(api.workspace.chooseAndOpen()).resolves.toMatchObject({
      ok: false,
      error: { code: 'VALIDATION' },
    });
  });

  it('expõe identidade de build por uma capacidade específica, sem dados de vault', async () => {
    const calls: Array<{ channel: string; value: unknown }> = [];
    const api = createAcademicDesktopApi({
      async invoke(channel, value) {
        calls.push({ channel, value });
        return {
          ok: true,
          value: {
            schemaVersion: 1,
            product: 'Folio',
            appVersion: '0.1.0-dev.0',
            commit: 'unavailable',
            channel: 'development',
            platform: 'linux',
            architecture: 'x64',
            electronVersion: '39.2.7',
            protocolVersion: 1,
            workspaceConfigSchemaVersion: 1,
            workspaceStateSchemaVersion: 1,
            workspaceIndexSchemaVersion: 1,
            pluginApiVersion: 1,
          },
        };
      },
      subscribe: () => () => undefined,
    });

    await expect(api.application.systemInformation()).resolves.toMatchObject({
      ok: true,
      value: { product: 'Folio', channel: 'development' },
    });
    expect(calls).toEqual([{ channel: DESKTOP_CHANNELS.systemInformation, value: undefined }]);
  });
});
