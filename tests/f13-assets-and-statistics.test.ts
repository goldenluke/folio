import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MessageChannel } from 'node:worker_threads';

import { describe, expect, it } from 'vitest';

import { criarServicoDeCompiler } from '@abnt/compiler';
import { parseMarkdown } from '@abnt/markdown';
import { percorrer } from '@abnt/document-model';
import { createInProcessCompilerClient, createWorkspaceMessagePortClient, serveWorkspaceOverMessagePort } from '@abnt/protocol';

import { DesktopWorkspaceServiceHost } from '../apps/desktop/src/workspace/workspace-service.js';
import { equationSource, figureSource, markdownTableSource, parseMarkdownTable, tableSource, templateSource } from '../apps/desktop/src/renderer/shell/authoring-source.js';

describe('Onda D — recursos e autoria confortável', () => {
  it('copia imagem para assets com URI relativa e gera Markdown sem formato proprietário', async () => {
    const root = await mkdtemp(join(tmpdir(), 'abnt-f13-'));
    await writeFile(join(root, 'paper.md'), '# Texto\n');
    const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
    const channel = new MessageChannel(); const stop = serveWorkspaceOverMessagePort(channel.port1, host); const client = createWorkspaceMessagePortClient(channel.port2);
    try {
      const opened = await client.open({ rootPath: root }); if (!opened.ok) throw new Error('vault não abriu');
      const paper = opened.value.files.find((file) => file.path === 'paper.md'); if (paper === undefined) throw new Error('paper não indexado');
      const asset = await client.importAsset({ sourceFileId: paper.fileId, name: 'gráfico final.png', mediaType: 'image/png', base64: Buffer.from([137, 80, 78, 71]).toString('base64') });
      expect(asset).toMatchObject({ ok: true, value: { file: { path: 'assets/gr-fico-final.png', mediaType: 'image/png' }, authoredUri: 'assets/gr-fico-final.png' } });
      if (!asset.ok) return;
      expect(figureSource({ uri: asset.value.authoredUri, alt: 'Gráfico', caption: 'Resultados', source: 'Autoria própria', identifier: 'resultado' })).toContain('![Gráfico](assets/gr-fico-final.png) {#resultado}');
      expect(figureSource({ uri: asset.value.authoredUri, alt: 'Gráfico', caption: '', width: 65 })).toContain('{width=65%}');
      const sizedFigure = [...percorrer(parseMarkdown('![Gráfico](assets/grafico.png) {#resultado width=65%}'))].find((node) => node.type === 'figure');
      expect(sizedFigure).toMatchObject({ type: 'figure', attributes: { identifier: 'resultado', properties: { width: '65%' } } });
      expect(tableSource(2, 2)).toContain('| --- | --- |');
      expect(equationSource('E = mc^2', 'energia')).toContain('{#energia}');
    } finally { client.dispose(); stop(); channel.port1.close(); channel.port2.close(); await host.dispose(); await rm(root, { recursive: true, force: true }); }
  });

  it('calcula estatísticas no serviço revisionado, não no renderer', async () => {
    const root = await mkdtemp(join(tmpdir(), 'abnt-f28-'));
    await writeFile(join(root, 'paper.md'), '# Método\n\nUm texto acadêmico simples com palavras.\n\n![Figura](assets/a.png)\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n$$\nx = y\n$$\n');
    const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
    const channel = new MessageChannel(); const stop = serveWorkspaceOverMessagePort(channel.port1, host); const client = createWorkspaceMessagePortClient(channel.port2);
    try {
      const opened = await client.open({ rootPath: root }); if (!opened.ok) throw new Error('vault não abriu');
      const paper = opened.value.files.find((file) => file.path === 'paper.md'); if (paper === undefined) throw new Error('paper não indexado');
      const editor = await client.openEditor({ fileId: paper.fileId }); if (!editor.ok) throw new Error('editor não abriu');
      const stats = await client.writingStatistics({ fileId: paper.fileId, expectedRevision: editor.value.session.revision });
      expect(stats).toMatchObject({ ok: true, value: { figures: 1, tables: 1, equations: 1, sections: [{ title: 'Método', words: expect.any(Number) }] } });
    } finally { client.dispose(); stop(); channel.port1.close(); channel.port2.close(); await host.dispose(); await rm(root, { recursive: true, force: true }); }
  });

  it('não inclui bibliografia, tabela, fórmulas, figuras ou frontmatter na contagem de escrita', async () => {
    const root = await mkdtemp(join(tmpdir(), 'abnt-f28-policy-'));
    await writeFile(join(root, 'paper.md'), '---\ntitle: Metadado\n---\n\n# Texto\n\nCorpo contado aqui.\n\nFigura: Legenda ignorada\n![Alt ignorado](assets/a.png)\nFonte: Ignorada\n\n| Tabela | Ignorada |\n| --- | --- |\n| x | y |\n\n$$ x = y $$\n\n# Referências\n\nSilva. Bibliografia ignorada.\n');
    const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
    const channel = new MessageChannel(); const stop = serveWorkspaceOverMessagePort(channel.port1, host); const client = createWorkspaceMessagePortClient(channel.port2);
    try {
      const opened = await client.open({ rootPath: root }); if (!opened.ok) throw new Error('vault não abriu');
      const paper = opened.value.files.find((file) => file.path === 'paper.md'); if (paper === undefined) throw new Error('paper não indexado');
      const editor = await client.openEditor({ fileId: paper.fileId }); if (!editor.ok) throw new Error('editor não abriu');
      const stats = await client.writingStatistics({ fileId: paper.fileId, expectedRevision: editor.value.session.revision });
      expect(stats).toMatchObject({ ok: true, value: { words: 4, tables: 1 } });
    } finally { client.dispose(); stop(); channel.port1.close(); channel.port2.close(); await host.dispose(); await rm(root, { recursive: true, force: true }); }
  });

  it('edita tabela GFM como Markdown normal', () => {
    const parsed = parseMarkdownTable('| A | B |\n| :---: | ---: |\n| um | dois |');
    expect(parsed).toMatchObject({ headers: ['A', 'B'], rows: [['um', 'dois']], alignment: ['center', 'right'] });
    if (parsed === undefined) return;
    expect(markdownTableSource({ ...parsed, rows: [['editado', 'dois']] })).toContain('| editado | dois |');
  });

  it('renomeia documento pela autoridade do workspace', async () => {
    const root = await mkdtemp(join(tmpdir(), 'abnt-f20-document-'));
    await writeFile(join(root, 'old.md'), '# Antigo\n'); await writeFile(join(root, 'links.md'), '[Abrir](old.md)\n[[old.md]]\n');
    const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
    const channel = new MessageChannel(); const stop = serveWorkspaceOverMessagePort(channel.port1, host); const client = createWorkspaceMessagePortClient(channel.port2);
    try {
      const opened = await client.open({ rootPath: root }); if (!opened.ok) throw new Error('vault não abriu');
      const old = opened.value.files.find((file) => file.path === 'old.md'); const links = opened.value.files.find((file) => file.path === 'links.md');
      if (old === undefined || links === undefined) throw new Error('arquivos ausentes');
      expect(await client.renameDocument({ fileId: old.fileId, path: 'novo.md', expectedRevision: old.revision })).toMatchObject({ ok: true, value: { path: 'novo.md' } });
      expect(await client.read({ fileId: links.fileId })).toMatchObject({ ok: true, value: { content: expect.stringContaining('novo.md') } });
    } finally { client.dispose(); stop(); channel.port1.close(); channel.port2.close(); await host.dispose(); await rm(root, { recursive: true, force: true }); }
  });

  it('planeja e aplica rename semântico como WorkspaceEdit revisionado', async () => {
    const root = await mkdtemp(join(tmpdir(), 'abnt-f20-'));
    await writeFile(join(root, 'one.md'), 'Figura: Exemplo\n\n![A](assets/a.png) {#fig-antiga}\n\nVeja [[ref:fig-antiga]].\n');
    await writeFile(join(root, 'two.md'), 'Também veja [[ref:fig-antiga]].\n');
    const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
    const channel = new MessageChannel(); const stop = serveWorkspaceOverMessagePort(channel.port1, host); const client = createWorkspaceMessagePortClient(channel.port2);
    try {
      const opened = await client.open({ rootPath: root }); if (!opened.ok) throw new Error('vault não abriu');
      const one = opened.value.files.find((file) => file.path === 'one.md'); if (one === undefined) throw new Error('one não indexado');
      const editor = await client.openEditor({ fileId: one.fileId }); if (!editor.ok) throw new Error('editor não abriu');
      const offset = editor.value.session.content.indexOf('fig-antiga') + 2;
      const renamed = await client.renameSymbol({ fileId: one.fileId, offset, newName: 'fig-nova', expectedRevision: editor.value.session.revision });
      expect(renamed).toMatchObject({ ok: true, value: { changedFiles: expect.arrayContaining(['one.md', 'two.md']) } });
      const second = opened.value.files.find((file) => file.path === 'two.md'); if (second === undefined) throw new Error('two não indexado');
      expect(await client.read({ fileId: second.fileId })).toMatchObject({ ok: true, value: { content: expect.stringContaining('fig-nova') } });
    } finally { client.dispose(); stop(); channel.port1.close(); channel.port2.close(); await host.dispose(); await rm(root, { recursive: true, force: true }); }
  });

  it('renomeia chave de citação em todos os documentos sem edição no renderer', async () => {
    const root = await mkdtemp(join(tmpdir(), 'abnt-f20-citation-'));
    await writeFile(join(root, 'one.md'), 'Use [@silva2024].\n');
    await writeFile(join(root, 'two.md'), 'Também [@silva2024, p. 42].\n');
    const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
    const channel = new MessageChannel(); const stop = serveWorkspaceOverMessagePort(channel.port1, host); const client = createWorkspaceMessagePortClient(channel.port2);
    try {
      const opened = await client.open({ rootPath: root }); if (!opened.ok) throw new Error('vault não abriu');
      const one = opened.value.files.find((file) => file.path === 'one.md'); const two = opened.value.files.find((file) => file.path === 'two.md');
      if (one === undefined || two === undefined) throw new Error('arquivos ausentes');
      const editor = await client.openEditor({ fileId: one.fileId }); if (!editor.ok) throw new Error('editor não abriu');
      const renamed = await client.renameSymbol({ fileId: one.fileId, offset: editor.value.session.content.indexOf('silva2024') + 3, newName: 'silva2025', expectedRevision: editor.value.session.revision });
      expect(renamed).toMatchObject({ ok: true, value: { changedFiles: expect.arrayContaining(['one.md', 'two.md']) } });
      expect(await client.read({ fileId: two.fileId })).toMatchObject({ ok: true, value: { content: expect.stringContaining('@silva2025') } });
    } finally { client.dispose(); stop(); channel.port1.close(); channel.port2.close(); await host.dispose(); await rm(root, { recursive: true, force: true }); }
  });

  it('cria template como Markdown normal do vault', async () => {
    const root = await mkdtemp(join(tmpdir(), 'abnt-f22-'));
    const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
    const channel = new MessageChannel(); const stop = serveWorkspaceOverMessagePort(channel.port1, host); const client = createWorkspaceMessagePortClient(channel.port2);
    try {
      expect(await client.open({ rootPath: root })).toMatchObject({ ok: true });
      const created = await client.createDocument({ path: 'templates/meu-artigo.md', content: templateSource('article') });
      expect(created).toMatchObject({ ok: true, value: { path: 'templates/meu-artigo.md', mediaType: 'text/markdown' } });
      if (!created.ok) return;
      expect(await client.read({ fileId: created.value.fileId })).toMatchObject({ ok: true, value: { content: expect.stringContaining('# Introdução') } });
    } finally { client.dispose(); stop(); channel.port1.close(); channel.port2.close(); await host.dispose(); await rm(root, { recursive: true, force: true }); }
  });

  it('resolve recurso relativo somente na projeção de preview', async () => {
    const root = await mkdtemp(join(tmpdir(), 'abnt-f14-'));
    await writeFile(join(root, 'paper.md'), '![Pixel](assets/pixel.png)\n');
    const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
    const channel = new MessageChannel(); const stop = serveWorkspaceOverMessagePort(channel.port1, host); const client = createWorkspaceMessagePortClient(channel.port2);
    try {
      const opened = await client.open({ rootPath: root }); if (!opened.ok) throw new Error('vault não abriu');
      const paper = opened.value.files.find((file) => file.path === 'paper.md'); if (paper === undefined) throw new Error('paper ausente');
      await client.importAsset({ sourceFileId: paper.fileId, name: 'pixel.png', mediaType: 'image/png', base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlH0lQAAAAASUVORK5CYII=' });
      const editor = await client.openEditor({ fileId: paper.fileId }); if (!editor.ok) throw new Error('editor não abriu');
      let preview = await client.previewEditor({ fileId: paper.fileId });
      const until = Date.now() + 2000;
      while (preview.ok && preview.value === undefined && Date.now() < until) { await new Promise((resolve) => setTimeout(resolve, 15)); preview = await client.previewEditor({ fileId: paper.fileId }); }
      expect(preview).toMatchObject({ ok: true, value: { html: expect.stringContaining('data:image/png;base64,') } });
    } finally { client.dispose(); stop(); channel.port1.close(); channel.port2.close(); await host.dispose(); await rm(root, { recursive: true, force: true }); }
  });

  it('oferece completions TeX revisionadas sem parser no renderer', async () => {
    const root = await mkdtemp(join(tmpdir(), 'abnt-f17-'));
    await writeFile(join(root, 'math.md'), 'A fórmula é $\\sq');
    const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
    const channel = new MessageChannel(); const stop = serveWorkspaceOverMessagePort(channel.port1, host); const client = createWorkspaceMessagePortClient(channel.port2);
    try {
      const opened = await client.open({ rootPath: root }); if (!opened.ok) throw new Error('vault não abriu');
      const math = opened.value.files.find((file) => file.path === 'math.md'); if (math === undefined) throw new Error('math ausente');
      const editor = await client.openEditor({ fileId: math.fileId }); if (!editor.ok) throw new Error('editor não abriu');
      const result = await client.completions({ fileId: math.fileId, offset: editor.value.session.content.length, expectedRevision: editor.value.session.revision });
      expect(result).toMatchObject({ ok: true, value: { items: expect.arrayContaining([expect.objectContaining({ kind: 'math', label: '\\sqrt', insertText: 'sqrt' })]) } });
    } finally { client.dispose(); stop(); channel.port1.close(); channel.port2.close(); await host.dispose(); await rm(root, { recursive: true, force: true }); }
  });

  it('renomeia heading no documento ativo por WorkspaceEdit', async () => {
    const root = await mkdtemp(join(tmpdir(), 'abnt-f19-'));
    await writeFile(join(root, 'outline.md'), '# Introdução\n\nTexto.\n');
    const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
    const channel = new MessageChannel(); const stop = serveWorkspaceOverMessagePort(channel.port1, host); const client = createWorkspaceMessagePortClient(channel.port2);
    try {
      const opened = await client.open({ rootPath: root }); if (!opened.ok) throw new Error('vault não abriu');
      const file = opened.value.files.find((candidate) => candidate.path === 'outline.md'); if (file === undefined) throw new Error('outline ausente');
      const editor = await client.openEditor({ fileId: file.fileId }); if (!editor.ok) throw new Error('editor não abriu');
      const result = await client.renameSymbol({ fileId: file.fileId, offset: 3, newName: 'Contexto e problema', expectedRevision: editor.value.session.revision });
      expect(result).toMatchObject({ ok: true, value: { changedFiles: ['outline.md'] } });
      const snapshot = await client.editorSnapshot({ fileId: file.fileId });
      expect(snapshot).toMatchObject({ ok: true, value: { session: { content: expect.stringContaining('# Contexto e problema') } } });
    } finally { client.dispose(); stop(); channel.port1.close(); channel.port2.close(); await host.dispose(); await rm(root, { recursive: true, force: true }); }
  });

  it('reorganiza seções irmãs como uma única edição revisionada', async () => {
    const root = await mkdtemp(join(tmpdir(), 'abnt-f19-move-'));
    await writeFile(join(root, 'outline.md'), '# Primeira\n\nA\n\n# Segunda\n\nB\n');
    const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
    const channel = new MessageChannel(); const stop = serveWorkspaceOverMessagePort(channel.port1, host); const client = createWorkspaceMessagePortClient(channel.port2);
    try {
      const opened = await client.open({ rootPath: root }); if (!opened.ok) throw new Error('vault não abriu');
      const file = opened.value.files.find((candidate) => candidate.path === 'outline.md'); if (file === undefined) throw new Error('outline ausente');
      const editor = await client.openEditor({ fileId: file.fileId }); if (!editor.ok) throw new Error('editor não abriu');
      const offset = editor.value.session.content.indexOf('Segunda');
      const result = await client.moveSection({ fileId: file.fileId, offset, direction: 'up', expectedRevision: editor.value.session.revision });
      expect(result).toMatchObject({ ok: true, value: { label: 'Mover seção acima' } });
      const snapshot = await client.editorSnapshot({ fileId: file.fileId });
      expect(snapshot).toMatchObject({ ok: true, value: { session: { content: expect.stringMatching(/^# Segunda/) } } });
    } finally { client.dispose(); stop(); channel.port1.close(); channel.port2.close(); await host.dispose(); await rm(root, { recursive: true, force: true }); }
  });
});
