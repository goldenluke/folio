import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MessageChannel } from 'node:worker_threads';

import { describe, expect, it } from 'vitest';

import { criarServicoDeCompiler } from '@abnt/compiler';
import { WorkspacePluginCatalog } from '../apps/desktop/src/workspace/plugins.js';
import { DesktopWorkspaceServiceHost } from '../apps/desktop/src/workspace/workspace-service.js';
import { createInProcessCompilerClient, createWorkspaceMessagePortClient, serveWorkspaceOverMessagePort, workspacePluginCommandResponseSchema, workspacePluginsResponseSchema } from '../packages/protocol/src/index.js';

describe('F562 — coleção oficial de plugins locais', () => {
  it('descobre os cinco plugins e encaminha cada ponte para uma superfície controlada', async () => {
    const root = await mkdtemp(join(tmpdir(), 'folio-plugin-examples-'));
    try {
      const catalog = new WorkspacePluginCatalog(root, join(process.cwd(), 'examples', 'plugins'));
      const plugins = await catalog.reload();
      expect(plugins).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'folio.zotero-bridge', enabled: true }),
        expect.objectContaining({ id: 'folio.mendeley-bridge', enabled: true }),
        expect.objectContaining({ id: 'folio.institutional-templates', enabled: true }),
        expect.objectContaining({ id: 'folio.scholarly-search', enabled: true }),
        expect.objectContaining({ id: 'folio.local-ai', enabled: true }),
      ]));
      expect(workspacePluginsResponseSchema.safeParse(plugins).success).toBe(true);
      await expect(catalog.command('folio.zotero-bridge', 'import-csl-json', {})).resolves.toMatchObject({ kind: 'open-intake', intakeFormat: 'csl-json' });
      await expect(catalog.command('folio.mendeley-bridge', 'import-ris', {})).resolves.toMatchObject({ kind: 'open-intake', intakeFormat: 'ris' });
      await expect(catalog.command('folio.mendeley-bridge', 'import-bibtex', {})).resolves.toMatchObject({ kind: 'open-intake', intakeFormat: 'bibtex' });
      await expect(catalog.command('folio.institutional-templates', 'create-institutional-tcc', {})).resolves.toMatchObject({ kind: 'open-template', templateKind: 'institutional-tcc' });
      await expect(catalog.command('folio.scholarly-search', 'resolve-identifier', {})).resolves.toMatchObject({ kind: 'open-intake' });
      await expect(catalog.command('folio.local-ai', 'open-local-assistant', {})).resolves.toMatchObject({ kind: 'open-structured-research' });
      expect(workspacePluginCommandResponseSchema.safeParse({ kind: 'open-intake', intakeFormat: 'ris' }).success).toBe(true);
      expect(workspacePluginCommandResponseSchema.safeParse({ kind: 'open-template', templateKind: 'institutional-article' }).success).toBe(true);
      expect(workspacePluginCommandResponseSchema.safeParse({ kind: 'open-structured-research' }).success).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('recarrega a coleção pelo protocolo que o desktop usa', async () => {
    const root = await mkdtemp(join(tmpdir(), 'folio-plugin-reload-'));
    const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
    const channel = new MessageChannel();
    const stop = serveWorkspaceOverMessagePort(channel.port1, host);
    const client = createWorkspaceMessagePortClient(channel.port2);
    try {
      expect(await client.open({ rootPath: root })).toMatchObject({ ok: true });
      const direct = await host.reloadPlugins();
      if (!direct.ok) throw new Error(`Host direto: ${direct.error.message}: ${JSON.stringify(direct.error.details)}`);
      expect(workspacePluginsResponseSchema.safeParse(direct.value).success).toBe(true);
      const reloaded = await client.reloadPlugins();
      if (!reloaded.ok) throw new Error(`${reloaded.error.message}: ${JSON.stringify(reloaded.error.details)}`);
      expect(reloaded).toMatchObject({
        ok: true,
        value: expect.arrayContaining([expect.objectContaining({ id: 'folio.zotero-bridge' })]),
      });
    } finally {
      client.dispose(); stop(); channel.port1.close(); channel.port2.close(); await host.dispose(); await rm(root, { recursive: true, force: true });
    }
  });
});
