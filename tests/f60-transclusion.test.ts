import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MessageChannel } from 'node:worker_threads';

import { describe, expect, it } from 'vitest';

import { criarServicoDeCompiler } from '@abnt/compiler';
import { expandMarkdownComposition } from '@abnt/markdown';
import { createInProcessCompilerClient, createWorkspaceMessagePortClient, serveWorkspaceOverMessagePort, type MessagePortWorkspaceClient } from '@abnt/protocol';

import { DesktopWorkspaceServiceHost } from '../apps/desktop/src/workspace/workspace-service.js';
import { compilar } from '../apps/cli/src/pipeline.js';

describe('F60/F61 — composição de fonte Markdown', () => {
  it('distingue link de embed, seleciona uma seção e rebaseia URIs do módulo', async () => {
    const source = await expandMarkdownComposition({
      sourcePath: 'tcc/index.md',
      content: '# Raiz\n\n[Link normal](notes.md)\n\n![[chapters/metodo.md#Método]]\n',
      reader: {
        async read(path) {
          return path === 'tcc/chapters/metodo.md'
            ? '---\ntitle: Metadata local\n---\n\n# Método\n\n![Fluxo](assets/fluxo.png)\n\n## Amostra\n\nTexto incorporado.\n\n# Fora\n\nNão entra.\n'
            : undefined;
        },
      },
    });
    expect(source.diagnostics).toEqual([]);
    expect(source.content).toContain('[Link normal](notes.md)');
    expect(source.content).toContain('# Método');
    expect(source.content).toContain('![Fluxo](chapters/assets/fluxo.png)');
    expect(source.content).toContain('Texto incorporado.');
    expect(source.content).not.toContain('Metadata local');
    expect(source.content).not.toContain('Não entra.');
    expect(source.dependencies).toEqual(['tcc/chapters/metodo.md']);
  });

  it('mantém a fonte autoral e diagnostica ciclo/módulo ausente', async () => {
    const source = await expandMarkdownComposition({
      sourcePath: 'a.md', content: '![[b.md]]\n',
      reader: { async read(path) { return path === 'b.md' ? '![[a.md]]\n' : undefined; } },
    });
    expect(source.content).toContain('![[a.md]]');
    expect(source.diagnostics).toContainEqual(expect.objectContaining({ id: 'COMPOSICAO-EMBED-CICLO' }));
  });
});

const waitForPreview = async (client: MessagePortWorkspaceClient, fileId: string): Promise<string> => {
  const deadline = Date.now() + 2_000;
  for (;;) {
    const result = await client.previewEditor({ fileId });
    if (result.ok && result.value !== undefined) return result.value.html;
    if (Date.now() > deadline) throw new Error('Preview não foi compilado.');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

describe('F62 — TCC modular no Workspace Service', () => {
  it('publica a raiz com capítulos separados, sem gravar a fonte expandida', async () => {
    const root = await mkdtemp(join(tmpdir(), 'folio-f62-'));
    const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
    const channel = new MessageChannel(); const stop = serveWorkspaceOverMessagePort(channel.port1, host); const client = createWorkspaceMessagePortClient(channel.port2);
    try {
      await mkdir(join(root, 'chapters'));
      await writeFile(join(root, 'index.md'), '---\ntitle: Trabalho modular\nprofile: abnt-tcc\n---\n\n![[chapters/introducao.md]]\n\n![[chapters/metodo.md#Amostra]]\n', 'utf8');
      await writeFile(join(root, 'chapters', 'introducao.md'), '# Introdução\n\nCapítulo independente.\n', 'utf8');
      await writeFile(join(root, 'chapters', 'metodo.md'), '# Método\n\nTexto fora da seleção.\n\n## Amostra\n\nAmostra incorporada.\n\n# Resultados\n\nNão entra.\n', 'utf8');
      const opened = await client.open({ rootPath: root }); if (!opened.ok) throw new Error('Vault deveria abrir.');
      const index = opened.value.files.find((file) => file.path === 'index.md'); if (index === undefined) throw new Error('Raiz ausente.');
      const editor = await client.openEditor({ fileId: index.fileId }); if (!editor.ok) throw new Error('Editor deveria abrir.');
      const html = await waitForPreview(client, index.fileId);
      expect(html).toContain('Capítulo independente.');
      expect(html).toContain('Amostra incorporada.');
      expect(html).not.toContain('Não entra.');
      const raw = await client.read({ fileId: index.fileId });
      expect(raw).toMatchObject({ ok: true, value: { content: expect.stringContaining('![[chapters/introducao.md]]') } });
    } finally {
      client.dispose(); stop(); channel.port1.close(); channel.port2.close(); await host.dispose();
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe('F60 — CLI usa a mesma composição', () => {
  it('expande módulos antes do compiler sem expor filesystem ao núcleo', async () => {
    const root = await mkdtemp(join(tmpdir(), 'folio-f60-cli-'));
    try {
      await mkdir(join(root, 'capitulos'));
      await writeFile(join(root, 'capitulos', 'intro.md'), '# Introdução\n\nTexto do capítulo.\n', 'utf8');
      const result = await compilar('---\ntitle: Documento composto\n---\n\n![[capitulos/intro.md]]\n', {
        documentId: 'index.md', sourcePath: 'index.md', baseDir: root,
      });
      expect(result.html).toContain('Texto do capítulo.');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
