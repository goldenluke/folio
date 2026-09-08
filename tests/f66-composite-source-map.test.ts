import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { criarServicoDeCompiler } from '@abnt/compiler';
import { expandMarkdownComposition, type TransclusionReader } from '@abnt/markdown';
import { locateInComposite, locateRangeInComposite } from '@abnt/source-composition';
import { LocalFilesystemStorage } from '@abnt/workspace-local';
import { criarResolvedorDeAmbienteLocal } from '@abnt/workspace-environment';
import { DocumentSessionsService } from '@abnt/workspace-sessions';

const hash = (content: string): string => `sha256:${createHash('sha256').update(content).digest('hex')}`;

/** Leitor em memória: os testes puros de F66 não precisam de filesystem real. */
const readerFrom = (files: Readonly<Record<string, string>>): TransclusionReader => ({
  async read(path) {
    return files[path];
  },
});

describe('F66 — Composite Source Map', () => {
  it('embed simples: offset dentro do conteúdo incorporado volta para o arquivo real', async () => {
    const b = '# Capítulo\n\nConteúdo de B.\n';
    const result = await expandMarkdownComposition({
      sourcePath: 'a.md',
      content: '# Raiz\n\n![[b.md]]\n',
      reader: readerFrom({ 'b.md': b }),
    });
    const virtualOffset = result.content.indexOf('Conteúdo de B.');
    expect(virtualOffset).toBeGreaterThan(-1);
    const origin = locateInComposite(result.sourceMap, virtualOffset);
    expect(origin).toEqual({ kind: 'authored', path: 'b.md', offset: b.indexOf('Conteúdo de B.') });
  });

  it('embed aninhado: offset no conteúdo mais profundo aponta direto para o arquivo folha, sem percorrer a cadeia', async () => {
    const c = '# Fundo\n\nTexto de C.\n';
    const result = await expandMarkdownComposition({
      sourcePath: 'a.md',
      content: '# Raiz\n\n![[b.md]]\n',
      reader: readerFrom({
        'b.md': '# B\n\n![[c.md]]\n',
        'c.md': c,
      }),
    });
    const virtualOffset = result.content.indexOf('Texto de C.');
    expect(virtualOffset).toBeGreaterThan(-1);
    // Não deve haver nenhum segmento intermediário apontando para "b.md" nessa posição.
    const origin = locateInComposite(result.sourceMap, virtualOffset);
    expect(origin).toEqual({ kind: 'authored', path: 'c.md', offset: c.indexOf('Texto de C.') });
  });

  it('section embed: só a seção selecionada entra, e o offset volta para a posição real dentro do arquivo (não relativa a zero)', async () => {
    const modulo = '# Método\n\nTexto fora.\n\n## Amostra\n\nTexto da amostra.\n\n# Resultados\n\nNão entra.\n';
    const result = await expandMarkdownComposition({
      sourcePath: 'a.md',
      content: '# Raiz\n\n![[modulo.md#Amostra]]\n',
      reader: readerFrom({ 'modulo.md': modulo }),
    });
    expect(result.content).not.toContain('Texto fora.');
    expect(result.content).not.toContain('Não entra.');
    const virtualOffset = result.content.indexOf('Texto da amostra.');
    const origin = locateInComposite(result.sourceMap, virtualOffset);
    expect(origin).toEqual({ kind: 'authored', path: 'modulo.md', offset: modulo.indexOf('Texto da amostra.') });
    // A posição real está no meio do arquivo, não em 0 — prova que a seleção de
    // seção não "zera" o offset autoral.
    expect((origin as { offset: number }).offset).toBeGreaterThan(20);
  });

  it('múltiplos embeds do mesmo arquivo: cada ocorrência mapeia para a origem correta sem se confundir', async () => {
    const b = '# B\n\nConteúdo único de B.\n';
    const result = await expandMarkdownComposition({
      sourcePath: 'a.md',
      content: '![[b.md]]\n\nseparador\n\n![[b.md]]\n',
      reader: readerFrom({ 'b.md': b }),
    });
    const occurrences = [...result.content.matchAll(/Conteúdo único de B\./gu)];
    expect(occurrences).toHaveLength(2);
    const [primeira, segunda] = occurrences;
    const origemPrimeira = locateInComposite(result.sourceMap, primeira!.index!);
    const origemSegunda = locateInComposite(result.sourceMap, segunda!.index!);
    const esperado = { kind: 'authored', path: 'b.md', offset: b.indexOf('Conteúdo único de B.') };
    expect(origemPrimeira).toEqual(esperado);
    expect(origemSegunda).toEqual(esperado);
  });

  it('ciclo: o diagnóstico aponta para o arquivo que escreveu a referência que fecha o ciclo', async () => {
    const b = '# B\n\n![[a.md]]\n';
    const result = await expandMarkdownComposition({
      sourcePath: 'a.md',
      content: '# A\n\n![[b.md]]\n',
      reader: readerFrom({ 'b.md': b }),
    });
    const diagnostic = result.diagnostics.find((item) => item.id === 'COMPOSICAO-EMBED-CICLO');
    expect(diagnostic).toBeDefined();
    expect(String(diagnostic!.source!.documentId)).toBe('b.md');
    expect(diagnostic!.source!.start.offset).toBe(b.indexOf('![[a.md]]'));
  });

  it('alvo ausente: o diagnóstico aponta para o embed escrito pelo autor, não para o alvo', async () => {
    const content = '# A\n\nTexto antes.\n\n![[inexistente.md]]\n';
    const result = await expandMarkdownComposition({
      sourcePath: 'a.md',
      content,
      reader: readerFrom({}),
    });
    const diagnostic = result.diagnostics.find((item) => item.id === 'COMPOSICAO-EMBED-NAO-ENCONTRADO');
    expect(diagnostic).toBeDefined();
    expect(String(diagnostic!.source!.documentId)).toBe('a.md');
    expect(diagnostic!.source!.start.offset).toBe(content.indexOf('![[inexistente.md]]'));
  });

  it('recurso rebaseado: reescrever a URI de uma imagem não destrói o mapeamento do texto ao redor', async () => {
    const modulo = 'Antes da imagem.\n\n![Foto](assets/foto.png)\n\nDepois da imagem.\n';
    const result = await expandMarkdownComposition({
      sourcePath: 'index.md',
      content: '# Raiz\n\n![[capitulos/modulo.md]]\n',
      reader: readerFrom({ 'capitulos/modulo.md': modulo }),
    });
    expect(result.content).toContain('![Foto](capitulos/assets/foto.png)');
    const antesOffset = result.content.indexOf('Antes da imagem.');
    const depoisOffset = result.content.indexOf('Depois da imagem.');
    expect(locateInComposite(result.sourceMap, antesOffset)).toEqual({
      kind: 'authored', path: 'capitulos/modulo.md', offset: modulo.indexOf('Antes da imagem.'),
    });
    expect(locateInComposite(result.sourceMap, depoisOffset)).toEqual({
      kind: 'authored', path: 'capitulos/modulo.md', offset: modulo.indexOf('Depois da imagem.'),
    });
  });

  it('locateRangeInComposite recusa um range que atravessa dois arquivos', async () => {
    const result = await expandMarkdownComposition({
      sourcePath: 'a.md',
      content: '![[b.md]]\n\n![[c.md]]\n',
      reader: readerFrom({ 'b.md': 'Conteúdo B.', 'c.md': 'Conteúdo C.' }),
    });
    const range = locateRangeInComposite(result.sourceMap, 0, result.sourceMap.length);
    expect(range).toEqual({ kind: 'synthetic' });
  });
});

const withTempDir = async (run: (root: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), 'folio-f67-'));
  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

describe('F67 — diagnósticos remapeados', () => {
  it('um diagnóstico do compiler sobre a fonte composta aponta para o arquivo real e a posição correta', async () => {
    await withTempDir(async (root) => {
      await mkdir(join(root, 'capitulos'));
      await writeFile(join(root, 'index.md'), '# Trabalho\n\n![[capitulos/metodo.md]]\n', 'utf8');
      const metodoContent = '# Método\n\nVeja [[ref:fig:inexistente]] para detalhes.\n';
      await writeFile(join(root, 'capitulos', 'metodo.md'), metodoContent, 'utf8');

      // Sem subscribe(): não ativa o watcher recursivo do filesystem, que este
      // teste não precisa e que é instável neste ambiente (Node/SO) — dívida
      // já registrada, não algo que a F66 precisa resolver.
      const storage = LocalFilesystemStorage.create(root);
      const opened = await storage.open();
      const index = opened.files.find((file) => String(file.path) === 'index.md');
      if (index === undefined) throw new Error('index.md ausente.');

      const sessions = DocumentSessionsService.create({
        storage,
        compiler: criarServicoDeCompiler(),
        environment: criarResolvedorDeAmbienteLocal(storage),
        hashContent: hash,
      });

      try {
        await sessions.open(index.id);
        await sessions.idle(index.id);
        const snapshot = sessions.snapshot(index.id);
        const diagnostic = snapshot?.diagnostics.find((item) => item.id === 'XREF-NAO-RESOLVIDA');
        expect(diagnostic).toBeDefined();
        expect(diagnostic!.source).toBeDefined();
        // F67: sem remapeamento, isso apontaria para "index.md" (a fonte
        // virtual) — o ponto inteiro da F66/F67 é corrigir para o arquivo real.
        expect(diagnostic!.source!.documentId).toBe('capitulos/metodo.md');
        expect(diagnostic!.source!.start.offset).toBe(metodoContent.indexOf('[[ref:fig:inexistente]]'));
      } finally {
        await sessions.dispose();
        await storage.close();
      }
    });
  });
});
