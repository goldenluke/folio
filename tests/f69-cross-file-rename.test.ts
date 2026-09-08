import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MessageChannel } from 'node:worker_threads';

import { describe, expect, it } from 'vitest';

import { criarServicoDeCompiler } from '@abnt/compiler';
import { createInProcessCompilerClient, createWorkspaceMessagePortClient, serveWorkspaceOverMessagePort } from '@abnt/protocol';

import { DesktopWorkspaceServiceHost } from '../apps/desktop/src/workspace/workspace-service.js';

/**
 * F69 — a infraestrutura já existe desde F20 (Onda D, ADR 0020... ver
 * ADR 0055): `WorkspaceLanguageService.rename()` escaneia texto autoral em
 * TODOS os `.md` do vault, não a fonte virtual composta pelo compiler. Renomear
 * um identificador nunca precisou do CompositeSourceMap (F66) porque
 * `{#id}`/`[[ref:id]]` têm a mesma sintaxe estejam os arquivos conectados por
 * `index.md` ou não. Este teste fecha a lacuna de cobertura: prova o cenário
 * EXATO do roadmap (cap1.md declara, cap2.md referencia, ambos só se
 * encontram via transclusão) em vez de inferir isso de F13's par solto.
 */
describe('F69 — rename cross-file em documento modular', () => {
  it('rename de um identificador declarado em um capítulo atualiza a referência em outro, num único WorkspaceEdit', async () => {
    const root = await mkdtemp(join(tmpdir(), 'folio-f69-'));
    const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
    const channel = new MessageChannel();
    const stop = serveWorkspaceOverMessagePort(channel.port1, host);
    const client = createWorkspaceMessagePortClient(channel.port2);
    try {
      await mkdir(join(root, 'capitulos'));
      await writeFile(
        join(root, 'index.md'),
        '---\ntitle: Trabalho modular\nprofile: abnt-tcc\n---\n\n![[capitulos/metodo.md]]\n\n![[capitulos/resultados.md]]\n',
        'utf8',
      );
      await writeFile(join(root, 'capitulos', 'metodo.md'), '# Método {#sec:metodo}\n\nDescrição do método.\n', 'utf8');
      await writeFile(join(root, 'capitulos', 'resultados.md'), '# Resultados\n\nOs dados seguem [[ref:sec:metodo]] descrito anteriormente.\n', 'utf8');

      const opened = await client.open({ rootPath: root });
      if (!opened.ok) throw new Error('Vault deveria abrir.');
      const metodo = opened.value.files.find((file) => file.path === 'capitulos/metodo.md');
      const resultados = opened.value.files.find((file) => file.path === 'capitulos/resultados.md');
      if (metodo === undefined || resultados === undefined) throw new Error('Capítulos ausentes.');

      // Rename disparado a partir da DECLARAÇÃO, em metodo.md — o capítulo que
      // referencia (resultados.md) só existe no mesmo "documento" através do
      // embed em index.md, nunca abrindo index.md nesta sessão.
      const editor = await client.openEditor({ fileId: metodo.fileId });
      if (!editor.ok) throw new Error('Editor deveria abrir.');
      const offset = editor.value.session.content.indexOf('sec:metodo') + 2;
      const renamed = await client.renameSymbol({
        fileId: metodo.fileId,
        offset,
        newName: 'sec:metodologia',
        expectedRevision: editor.value.session.revision,
      });
      expect(renamed).toMatchObject({
        ok: true,
        value: { changedFiles: expect.arrayContaining(['capitulos/metodo.md', 'capitulos/resultados.md']) },
      });

      // resultados.md não tem sessão aberta: o WorkspaceEdit grava direto no
      // storage, então o disco já reflete o rename.
      const updatedResultados = await client.read({ fileId: resultados.fileId });
      expect(updatedResultados).toMatchObject({ ok: true, value: { content: expect.stringContaining('[[ref:sec:metodologia]]') } });
      // metodo.md tem sessão aberta (foi de lá que o rename partiu): o
      // WorkspaceEdit atualiza o rascunho da sessão, não o disco diretamente
      // — mesma autoridade de sessão que P4/P6 já estabelecem. `read()` vê o
      // disco; o rascunho atualizado aparece no snapshot do editor.
      const metodoSnapshot = await client.editorSnapshot({ fileId: metodo.fileId });
      expect(metodoSnapshot).toMatchObject({ ok: true, value: { session: { content: expect.stringContaining('{#sec:metodologia}') } } });

      // index.md nunca foi tocado — rename opera nos arquivos reais, não na
      // fonte virtual composta (a própria razão de F69 não depender de F66).
      const index = opened.value.files.find((file) => file.path === 'index.md');
      if (index === undefined) throw new Error('index.md ausente.');
      const rootContent = await client.read({ fileId: index.fileId });
      expect(rootContent).toMatchObject({ ok: true, value: { content: expect.stringContaining('![[capitulos/metodo.md]]') } });
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
