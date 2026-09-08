import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MessageChannel } from 'node:worker_threads';

import { describe, expect, it } from 'vitest';

import { criarServicoDeCompiler } from '@abnt/compiler';
import { createInProcessCompilerClient, createWorkspaceMessagePortClient, serveWorkspaceOverMessagePort } from '@abnt/protocol';

import { DesktopWorkspaceServiceHost } from '../apps/desktop/src/workspace/workspace-service.js';

const ARTIGO = `---
bibliography: referencias.bib
---

# Introdução

Sistemas distribuídos exigem coordenação [@tanenbaum2017, p. 10].
`;

const METODOS = `---
bibliography: referencias.bib
---

# Metodologia

## Coleta de dados

Baseado em @tanenbaum2017 para o desenho do estudo.
`;

const BIB = `@book{tanenbaum2017,
  author    = {Tanenbaum, Andrew S.},
  title     = {Distributed Systems},
  publisher = {Pearson},
  year      = {2017}
}
@book{silva2024,
  author    = {Silva, Joao},
  title     = {Metodologia Qualitativa},
  publisher = {Editora X},
  year      = {2024}
}
`;

const withVault = async (run: (root: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), 'abnt-f31-'));
  try {
    await writeFile(join(root, 'artigo.md'), ARTIGO, 'utf8');
    await writeFile(join(root, 'metodos.md'), METODOS, 'utf8');
    await writeFile(join(root, 'referencias.bib'), BIB, 'utf8');
    await mkdir(join(root, 'papers'));
    await writeFile(join(root, 'papers', 'tanenbaum2017.md'), `---
sourceReference: tanenbaum2017
review:
  topic: sistemas distribuídos
  method: estudo de caso
  sample: equipes remotas
  result: coordenação explícita
---
`, 'utf8');
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

describe('F31 — citation explorer vault-wide', () => {
  it('agrega citações de múltiplos documentos por referência e lista as nunca citadas', async () => {
    await withVault(async (root) => {
      const host = DesktopWorkspaceServiceHost.create({
        compiler: createInProcessCompilerClient(criarServicoDeCompiler()),
      });
      const channel = new MessageChannel();
      const stop = serveWorkspaceOverMessagePort(channel.port1, host);
      const client = createWorkspaceMessagePortClient(channel.port2);

      try {
        const opened = await client.open({ rootPath: root });
        if (!opened.ok) throw new Error('Vault deveria abrir.');

        // Nenhum editor foi aberto manualmente — citationExplorer resolve a
        // bibliografia por conta própria e fecha as sessões que abriu.
        const explorer = await client.citationExplorer({});
        expect(explorer.ok).toBe(true);
        if (!explorer.ok) return;

        expect(explorer.value.cited).toHaveLength(1);
        const tanenbaum = explorer.value.cited[0];
        expect(tanenbaum).toMatchObject({ referenceId: 'tanenbaum2017', count: 2 });
        expect(tanenbaum?.formatted).toContain('TANENBAUM, Andrew S.');
        expect(tanenbaum?.locations).toHaveLength(2);
        expect(tanenbaum?.locations).toContainEqual(
          expect.objectContaining({ path: 'artigo.md', sectionTitle: 'Introdução', snippet: expect.stringContaining('Sistemas distribuídos') }),
        );
        expect(tanenbaum?.locations).toContainEqual(
          expect.objectContaining({ path: 'metodos.md', sectionTitle: 'Coleta de dados' }),
        );

        expect(explorer.value.uncited).toHaveLength(1);
        expect(explorer.value.uncited[0]).toMatchObject({ id: 'silva2024' });
        expect(explorer.value.uncited[0]?.formatted).toContain('SILVA, Joao');

        const overview = await client.researchOverview({});
        expect(overview).toMatchObject({ ok: true });
        if (overview.ok) {
          expect(overview.value.references).toContainEqual(expect.objectContaining({
            referenceId: 'tanenbaum2017',
            citationCount: 2,
            literatureNote: expect.objectContaining({ path: 'papers/tanenbaum2017.md' }),
            review: { topic: 'sistemas distribuídos', method: 'estudo de caso', sample: 'equipes remotas', result: 'coordenação explícita' },
          }));
        }

        // Sessões abertas internamente não devem vazar: nenhum editor deveria
        // ficar aberto por conta desta chamada.
        const artigo = opened.value.files.find((file) => file.path === 'artigo.md');
        if (artigo === undefined) throw new Error('Fixture incompleta.');
        const snapshot = await client.editorSnapshot({ fileId: artigo.fileId });
        expect(snapshot).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
      } finally {
        client.dispose();
        stop();
        channel.port1.close();
        channel.port2.close();
        await host.dispose();
      }
    });
  });
});
