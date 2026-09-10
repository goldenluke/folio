import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MessageChannel } from 'node:worker_threads';

import { describe, expect, it } from 'vitest';

import { criarServicoDeCompiler } from '@abnt/compiler';
import { createInProcessCompilerClient, createWorkspaceMessagePortClient, serveWorkspaceOverMessagePort } from '@abnt/protocol';

import { DesktopWorkspaceServiceHost } from '../apps/desktop/src/workspace/workspace-service.js';

describe('F454–F459 — Explicit Reference Relations (integração de protocolo)', () => {
  it('cria, lista, projeta no grafo e remove uma relação; recusa duplicata e auto-relação', async () => {
    const root = await mkdtemp(join(tmpdir(), 'abnt-f454-'));
    const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
    const channel = new MessageChannel();
    const stop = serveWorkspaceOverMessagePort(channel.port1, host);
    const client = createWorkspaceMessagePortClient(channel.port2);
    try {
      expect(await client.open({ rootPath: root })).toMatchObject({ ok: true });
      expect(await client.libraryUpsert({ entry: { id: 'silva2020', type: 'article-journal', title: 'Estudo original em ABNT' } })).toMatchObject({ ok: true });
      expect(await client.libraryUpsert({ entry: { id: 'errata2021', type: 'article-journal', title: 'Correção do estudo em ABNT' } })).toMatchObject({ ok: true });
      expect(await client.libraryUpsert({ entry: { id: 'silva2020-dup', type: 'article-journal', title: 'Estudo original em ABNT', DOI: '10.1000/mesmo' } })).toMatchObject({ ok: true });
      expect(await client.libraryUpsert({ entry: { id: 'silva2020-canonico', type: 'article-journal', title: 'Estudo original em ABNT', DOI: '10.1000/mesmo' } })).toMatchObject({ ok: true });

      const created = await client.addReferenceRelation({ kind: 'correction-of', fromId: 'errata2021', toId: 'silva2020', note: 'Erro na tabela 2' });
      expect(created).toMatchObject({ ok: true, value: { kind: 'correction-of', fromId: 'errata2021', toId: 'silva2020', note: 'Erro na tabela 2' } });
      if (!created.ok) return;

      const listedAll = await client.referenceRelations({});
      expect(listedAll).toMatchObject({ ok: true, value: { relations: [expect.objectContaining({ id: created.value.id })] } });

      const listedFiltered = await client.referenceRelations({ referenceId: 'silva2020' });
      expect(listedFiltered).toMatchObject({ ok: true, value: { relations: [expect.objectContaining({ id: created.value.id })] } });
      const listedUnrelated = await client.referenceRelations({ referenceId: 'silva2020-dup' });
      expect(listedUnrelated).toMatchObject({ ok: true, value: { relations: [] } });

      // Erros de validação (Error genérico) nunca atravessam com a mensagem original — ver ProtocolError em model.ts. Por isso só o código é verificável aqui.
      const rejectedDuplicate = await client.addReferenceRelation({ kind: 'version-of', fromId: 'silva2020-dup', toId: 'silva2020-canonico' });
      expect(rejectedDuplicate).toMatchObject({ ok: false, error: { code: 'INTERNAL' } });

      const rejectedSelf = await client.addReferenceRelation({ kind: 'version-of', fromId: 'silva2020', toId: 'silva2020' });
      expect(rejectedSelf).toMatchObject({ ok: false, error: { code: 'INTERNAL' } });

      const rejectedMissing = await client.addReferenceRelation({ kind: 'version-of', fromId: 'inexistente', toId: 'silva2020' });
      expect(rejectedMissing.ok).toBe(false);

      const graph = await client.graph({});
      expect(graph).toMatchObject({ ok: true });
      if (graph.ok) {
        expect(graph.value.edges).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'correction-of', from: 'reference:errata2021', to: 'reference:silva2020' })]));
        expect(graph.value.nodes).toEqual(expect.arrayContaining([
          expect.objectContaining({ id: 'reference:errata2021', kind: 'reference', label: 'Correção do estudo em ABNT' }),
          expect.objectContaining({ id: 'reference:silva2020', kind: 'reference', label: 'Estudo original em ABNT' }),
        ]));
      }

      expect(await client.removeReferenceRelation({ id: created.value.id })).toMatchObject({ ok: true });
      expect(await client.referenceRelations({})).toMatchObject({ ok: true, value: { relations: [] } });
    } finally {
      client.dispose(); stop(); channel.port1.close(); channel.port2.close(); await host.dispose(); await rm(root, { recursive: true, force: true });
    }
  });
});
