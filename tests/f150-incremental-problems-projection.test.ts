import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MessageChannel } from 'node:worker_threads';

import { expect, it } from 'vitest';

import { criarServicoDeCompiler } from '@abnt/compiler';
import { createInProcessCompilerClient, createWorkspaceMessagePortClient, serveWorkspaceOverMessagePort } from '@abnt/protocol';

import { DesktopWorkspaceServiceHost } from '../apps/desktop/src/workspace/workspace-service.js';

it('F150 — problems() reusa diagnósticos de arquivos fechados sem revisão nova, e invalida no save', async () => {
  const root = await mkdtemp(join(tmpdir(), 'folio-f150-'));
  const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
  const channel = new MessageChannel(); const stop = serveWorkspaceOverMessagePort(channel.port1, host); const client = createWorkspaceMessagePortClient(channel.port2);
  try {
    const fileCount = 40;
    for (let index = 0; index < fileCount; index += 1) {
      await writeFile(join(root, `doc${index}.md`), `# Doc ${index}\n\n[@ausente${index}]\n`, 'utf8');
    }
    const opened = await client.open({ rootPath: root });
    if (!opened.ok) throw new Error('vault não abriu');

    const firstStart = performance.now();
    const first = await client.problems({});
    const firstMs = performance.now() - firstStart;
    if (!first.ok) throw new Error('primeira varredura falhou');
    expect(first.value.length).toBeGreaterThanOrEqual(fileCount);

    const secondStart = performance.now();
    const second = await client.problems({});
    const secondMs = performance.now() - secondStart;
    if (!second.ok) throw new Error('segunda varredura falhou');

    // Mesmo conteúdo lógico...
    expect(second.value.map((p) => p.path).sort()).toEqual(first.value.map((p) => p.path).sort());
    // ...e sensivelmente mais rápido: nada foi reaberto/recompilado na segunda
    // chamada, só o cache foi replayado. Limiar frouxo o bastante para não
    // ser flaky, apertado o bastante para provar que não é coincidência.
    expect(secondMs).toBeLessThan(firstMs * 0.5);

    // Editar e salvar um único arquivo precisa invalidar só aquele arquivo,
    // e o novo problema precisa aparecer na próxima varredura.
    const target = opened.value.files.find((file) => file.path === 'doc0.md');
    if (target === undefined) throw new Error('fixture incompleta');
    const editor = await client.openEditor({ fileId: target.fileId });
    if (!editor.ok) throw new Error('não abriu o editor');
    const content = editor.value.session.content;
    const changed = await client.dispatchEditor({
      fileId: target.fileId,
      expectedRevision: editor.value.session.revision,
      transaction: { edits: [{ range: { start: content.length, end: content.length }, text: '\n[@outra-ausente]\n' }] },
    });
    if (!changed.ok) throw new Error('edição rejeitada');
    const saved = await client.saveEditor({ fileId: target.fileId, expectedRevision: changed.value.session.revision });
    if (!saved.ok) throw new Error('save rejeitado');
    await client.closeEditor({ fileId: target.fileId });

    const third = await client.problems({});
    if (!third.ok) throw new Error('terceira varredura falhou');
    const doc0Problems = third.value.filter((p) => p.path === 'doc0.md');
    expect(doc0Problems.length).toBeGreaterThanOrEqual(2);
  } finally {
    client.dispose(); stop(); channel.port1.close(); channel.port2.close();
    await host.dispose(); await rm(root, { recursive: true, force: true });
  }
});
