import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MessageChannel } from 'node:worker_threads';

import { describe, expect, it } from 'vitest';

import { criarServicoDeCompiler } from '@abnt/compiler';
import { createInProcessCompilerClient, createWorkspaceMessagePortClient, serveWorkspaceOverMessagePort } from '@abnt/protocol';
import { DesktopWorkspaceServiceHost } from '../apps/desktop/src/workspace/workspace-service.js';

describe('F344–F360 — canvas persistente no Workspace Service', () => {
  it('guarda o canvas operacional fora do Markdown e o revalida ao ler', async () => {
    const root = await mkdtemp(join(tmpdir(), 'folio-canvas-'));
    const vault = join(root, 'vault'); await mkdir(vault);
    const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
    const channel = new MessageChannel(); const stop = serveWorkspaceOverMessagePort(channel.port1, host); const client = createWorkspaceMessagePortClient(channel.port2);
    try {
      await client.open({ rootPath: vault });
      const request = { version: 1 as const, canvases: [{ schema: 'folio-research-canvas' as const, version: 1 as const, id: 'mapa', title: 'Mapa de evidências', nodes: [{ id: 'claim', type: 'text' as const, text: 'Hipótese', role: 'claim' as const, x: 20, y: 30 }], edges: [], groups: [] }] };
      await expect(client.setResearchCanvases(request)).resolves.toMatchObject({ ok: true, value: { canvases: [{ id: 'mapa' }] } });
      await expect(client.researchCanvases()).resolves.toMatchObject({ ok: true, value: request });
      const raw = await readFile(join(vault, '.academic', 'canvases', 'research-canvases-canvases.json'), 'utf8');
      expect(raw).toContain('Mapa de evidências');
    } finally { client.dispose(); stop(); channel.port1.close(); channel.port2.close(); await host.dispose(); await rm(root, { recursive: true, force: true }); }
  });
});
