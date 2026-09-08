import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MessageChannel } from 'node:worker_threads';

import { describe, expect, it } from 'vitest';

import { criarServicoDeCompiler } from '@abnt/compiler';
import { createInProcessCompilerClient, createWorkspaceMessagePortClient, serveWorkspaceOverMessagePort } from '@abnt/protocol';

import { DesktopWorkspaceServiceHost } from '../apps/desktop/src/workspace/workspace-service.js';
import { lineDiff } from '../apps/desktop/src/workspace/history.js';

describe('F64 — diff por linhas', () => {
  it('projeta inserções e remoções sem parser no renderer', () => {
    expect(lineDiff('a\nb\n', 'a\nc\n')).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'removed', text: 'b' }),
      expect.objectContaining({ kind: 'added', text: 'c' }),
    ]));
  });
});

describe('F63/F65 — Git opcional e snapshots locais', () => {
  it('abre vault sem Git e preserva snapshot manual fora do Markdown', async () => {
    const root = await mkdtemp(join(tmpdir(), 'folio-history-'));
    const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) }); const channel = new MessageChannel(); const stop = serveWorkspaceOverMessagePort(channel.port1, host); const client = createWorkspaceMessagePortClient(channel.port2);
    try {
      await writeFile(join(root, 'nota.md'), '# Nota\n\nVersão atual.\n', 'utf8');
      const opened = await client.open({ rootPath: root }); if (!opened.ok) throw new Error('Vault deveria abrir.'); const file = opened.value.files[0]; if (file === undefined) throw new Error('Arquivo ausente.');
      const initial = await client.history({ fileId: file.fileId }); expect(initial).toMatchObject({ ok: true, value: { gitAvailable: false, revisions: [] } });
      const snapshot = await client.historyCreateSnapshot({ fileId: file.fileId, label: 'Antes da revisão' }); expect(snapshot).toMatchObject({ ok: true, value: { source: 'snapshot', label: 'Antes da revisão' } });
      if (!snapshot.ok) return;
      const diff = await client.historyDiff({ fileId: file.fileId, fromRevisionId: snapshot.value.id }); expect(diff).toMatchObject({ ok: true, value: { lines: expect.any(Array) } });
      const raw = await client.read({ fileId: file.fileId }); expect(raw).toMatchObject({ ok: true, value: { content: expect.not.stringContaining('Antes da revisão') } });
    } finally { client.dispose(); stop(); channel.port1.close(); channel.port2.close(); await host.dispose(); await rm(root, { recursive: true, force: true }); }
  });
});
