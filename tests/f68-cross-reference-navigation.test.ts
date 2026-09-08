import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it } from 'vitest';

import { criarServicoDeCompiler } from '@abnt/compiler';
import { WorkspaceLanguageService } from '@abnt/language-service';
import { SqliteWorkspaceIndex } from '@abnt/workspace-index';
import { LocalFilesystemStorage } from '@abnt/workspace-local';
import { criarResolvedorDeAmbienteVazio, DocumentSessionsService } from '@abnt/workspace-sessions';

const hash = (content: string): string => `sha256:${createHash('sha256').update(content).digest('hex')}`;

const RESULTADOS = '# Resultados\n\n![Gráfico de desempenho](grafico.png) {#fig:grafico}\n';
const METODO = '# Método\n\nOs dados são discutidos em [[ref:fig:grafico]].\n\nVer também [[ref:fig:grafico]] na conclusão.\n';

const withVault = async (run: (root: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), 'abnt-f68-'));
  try {
    await writeFile(join(root, 'resultados.md'), RESULTADOS, 'utf8');
    await writeFile(join(root, 'metodo.md'), METODO, 'utf8');
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

describe('F68 — navegação de cross-reference através de módulos', () => {
  it('go to definition de [[ref:id]] declarado em outro arquivo aponta para o arquivo real', async () => {
    await withVault(async (root) => {
      const storage = LocalFilesystemStorage.create(root);
      const index = SqliteWorkspaceIndex.create({ storage, databasePath: join(root, '.academic', 'index.sqlite') });
      await index.open();
      const files = await storage.list();
      const metodo = files.find((file) => file.path === 'metodo.md');
      const resultados = files.find((file) => file.path === 'resultados.md');
      if (metodo === undefined || resultados === undefined) throw new Error('Fixture incompleta.');

      const sessions = DocumentSessionsService.create({
        storage,
        compiler: criarServicoDeCompiler(),
        environment: criarResolvedorDeAmbienteVazio(),
        hashContent: hash,
        autoCompile: false,
      });
      const language = WorkspaceLanguageService.create({ storage, index, sessions });

      try {
        await sessions.open(metodo.id);
        const offset = METODO.indexOf('[[ref:fig:grafico]]') + 6;

        // O documento aberto (metodo.md) não declara fig:grafico — só o
        // índice vault-wide sabe que resultados.md é quem declara. O range
        // é o do nó `figure` inteiro (a imagem até o atributo), não só o
        // texto "{#fig:grafico}" — mesma convenção de `crossReferenceTargets`.
        const definitions = await language.definition({ fileId: metodo.id, offset });
        expect(definitions).toEqual([
          {
            fileId: resultados.id,
            path: resultados.path,
            range: { start: RESULTADOS.indexOf('![Gráfico'), end: RESULTADOS.indexOf('{#fig:grafico}') + '{#fig:grafico}'.length },
          },
        ]);

        const hover = await language.hover({ fileId: metodo.id, offset });
        expect(hover?.contents[0]).toContain('resultados.md');

        // references() a partir de metodo.md: as duas ocorrências locais.
        const references = await language.references({ fileId: metodo.id, offset });
        expect(references).toHaveLength(2);
        expect(references.every((location) => location.fileId === metodo.id)).toBe(true);
      } finally {
        await sessions.dispose();
        await index.close();
        await storage.close();
      }
    });
  });

  it('definição e referências resolvem localmente quando declaração e uso estão no mesmo arquivo', async () => {
    const root = await mkdtemp(join(tmpdir(), 'abnt-f68-local-'));
    try {
      const local = '# Resultados\n\n![Gráfico](grafico.png) {#fig:local}\n\nVer [[ref:fig:local]] acima.\n';
      await writeFile(join(root, 'unico.md'), local, 'utf8');
      const storage = LocalFilesystemStorage.create(root);
      const index = SqliteWorkspaceIndex.create({ storage, databasePath: join(root, '.academic', 'index.sqlite') });
      await index.open();
      const file = (await storage.list()).find((entry) => entry.path === 'unico.md');
      if (file === undefined) throw new Error('Fixture incompleta.');

      const sessions = DocumentSessionsService.create({
        storage,
        compiler: criarServicoDeCompiler(),
        environment: criarResolvedorDeAmbienteVazio(),
        hashContent: hash,
        autoCompile: false,
      });
      const language = WorkspaceLanguageService.create({ storage, index, sessions });

      try {
        await sessions.open(file.id);
        const declarationRange = { start: local.indexOf('![Gráfico'), end: local.indexOf('{#fig:local}') + '{#fig:local}'.length };
        const usageOffset = local.indexOf('[[ref:fig:local]]') + 6;

        const definitions = await language.definition({ fileId: file.id, offset: usageOffset });
        expect(definitions).toEqual([{ fileId: file.id, path: file.path, range: declarationRange }]);

        const references = await language.references({ fileId: file.id, offset: usageOffset });
        expect(references).toEqual([{ fileId: file.id, path: file.path, range: { start: usageOffset - 6, end: usageOffset - 6 + '[[ref:fig:local]]'.length } }]);
      } finally {
        await sessions.dispose();
        await index.close();
        await storage.close();
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
