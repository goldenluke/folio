import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MessageChannel } from 'node:worker_threads';

import { describe, expect, it } from 'vitest';

import { criarServicoDeCompiler } from '@abnt/compiler';
import { createInProcessCompilerClient, createWorkspaceMessagePortClient, serveWorkspaceOverMessagePort } from '@abnt/protocol';
import { DesktopWorkspaceServiceHost } from '../apps/desktop/src/workspace/workspace-service.js';
import { researchJournalPath } from '../packages/workspace-navigation/src/index.js';

describe('F331–F335 — diário de pesquisa: criação idempotente e captura', () => {
  it('journalOpen cria a entrada de hoje uma única vez e journalCapture acrescenta ao arquivo existente', async () => {
    const root = await mkdtemp(join(tmpdir(), 'folio-journal-'));
    const vault = join(root, 'vault');
    await mkdir(vault);
    const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
    const channel = new MessageChannel();
    const stop = serveWorkspaceOverMessagePort(channel.port1, host);
    const client = createWorkspaceMessagePortClient(channel.port2);
    try {
      await client.open({ rootPath: vault });
      const expectedPath = researchJournalPath(new Date());

      const opened = await client.journalOpen({});
      expect(opened.ok).toBe(true);
      if (!opened.ok) return;
      expect(opened.value.path).toBe(expectedPath);
      const raw = await readFile(join(vault, expectedPath), 'utf8');
      expect(raw).toContain('Diário de pesquisa');
      expect(raw).toContain('## Observações');

      // Idempotente: reabre o mesmo arquivo, não cria um segundo nem sufixa.
      const reopened = await client.journalOpen({});
      expect(reopened.ok).toBe(true);
      if (reopened.ok) expect(reopened.value.fileId).toBe(opened.value.fileId);

      const captured = await client.journalCapture({ text: 'Ideia para revisão de literatura' });
      expect(captured.ok).toBe(true);
      if (captured.ok) expect(captured.value.path).toBe(expectedPath);
      const afterCapture = await readFile(join(vault, expectedPath), 'utf8');
      expect(afterCapture).toContain('- Ideia para revisão de literatura');

      const secondCapture = await client.journalCapture({ text: 'Segunda nota' });
      expect(secondCapture.ok).toBe(true);
      const afterSecondCapture = await readFile(join(vault, expectedPath), 'utf8');
      expect(afterSecondCapture).toContain('- Segunda nota\n- Ideia para revisão de literatura');

      // Data explícita: cria um arquivo distinto, sem afetar o de hoje.
      const explicitDate = await client.journalOpen({ date: '2025-01-15' });
      expect(explicitDate.ok).toBe(true);
      if (explicitDate.ok) {
        expect(explicitDate.value.path).toBe('journal/2025-01-15.md');
        expect(explicitDate.value.fileId).not.toBe(opened.value.fileId);
      }
    } finally {
      client.dispose();
      stop();
      channel.port1.close();
      channel.port2.close();
      await host.dispose();
      await rm(root, { recursive: true, force: true });
    }
  });
});
