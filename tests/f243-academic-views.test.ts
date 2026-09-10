import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MessageChannel } from 'node:worker_threads';

import { describe, expect, it } from 'vitest';
import { criarServicoDeCompiler } from '@abnt/compiler';
import { createInProcessCompilerClient, createWorkspaceMessagePortClient, serveWorkspaceOverMessagePort } from '@abnt/protocol';
import {
  createAcademicView,
  createAcademicViewsDocument,
  parseAcademicViewsDocument,
  tableColumns,
  viewSourceDescriptor,
} from '../packages/academic-views/src/index.js';
import { DesktopWorkspaceServiceHost } from '../apps/desktop/src/workspace/workspace-service.js';

describe('F243–F244 — Academic Views', () => {
  it('guarda apenas uma definição serializável de references, nunca seus resultados', () => {
    const view = createAcademicView({
      id: 'papers-2025', name: 'Todos os papers de 2025', source: 'references', layout: 'table', filterQuery: 'year:2025',
      columns: [{ field: 'title' }, { field: 'authors' }, { field: 'year' }, { field: 'readingState' }, { field: 'citationCount' }],
    });
    const document = createAcademicViewsDocument([view]);
    expect(document).toEqual({ version: 1, views: [view] });
    expect(JSON.stringify(document)).not.toContain('items');
    expect(view.filter?.query.root).toMatchObject({ kind: 'term', term: { kind: 'property', key: 'year', value: '2025' } });
    expect(tableColumns(view).map((column) => column.field)).toEqual(['title', 'authors', 'year', 'readingState', 'citationCount']);
  });

  it('revalida o JSON portátil e impede fontes, layouts e colunas inválidas', () => {
    const valid = createAcademicViewsDocument([createAcademicView({ id: 'notas', name: 'Notas', source: 'literature-notes', layout: 'cards' })]);
    expect(parseAcademicViewsDocument(JSON.parse(JSON.stringify(valid)))).toEqual(valid);
    expect(() => createAcademicViewsDocument([valid.views[0]!, valid.views[0]!])).toThrow('duplicada');
    expect(() => parseAcademicViewsDocument({ version: 1, views: [{ version: 1, id: 'x', name: 'X', source: 'annotations', layout: 'board' }] })).toThrow('não está disponível');
  });

  it('declara fontes finitas em vez de misturar qualquer entidade', () => {
    expect(viewSourceDescriptor('references')).toMatchObject({ label: 'Referências' });
    expect(() => createAcademicView({ id: 'x', name: 'X', source: 'anything' as never, layout: 'table' })).toThrow('Fonte de view inválida');
  });

  it('persiste a definição em .academic/views e a recompõe após reabrir o vault', async () => {
    const root = await mkdtemp(join(tmpdir(), 'folio-academic-views-')); const vault = join(root, 'vault'); await mkdir(vault);
    const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
    const channel = new MessageChannel(); const stop = serveWorkspaceOverMessagePort(channel.port1, host); const client = createWorkspaceMessagePortClient(channel.port2);
    try {
      await client.open({ rootPath: vault });
      await expect(client.setAcademicViews({ version: 1, views: [{ version: 1, id: 'papers-2025', name: 'Todos os papers de 2025', source: 'references', layout: 'table', filterQuery: 'year:2025', columns: [{ field: 'title' }, { field: 'year' }] }] })).resolves.toMatchObject({ ok: true, value: { views: [{ id: 'papers-2025', filterQuery: 'year:2025' }] } });
      const raw = await readFile(join(vault, '.academic', 'views', 'academic-views-views.json'), 'utf8');
      expect(raw).toContain('papers-2025'); expect(raw).not.toContain('sqlite');
      await expect(client.academicViews()).resolves.toMatchObject({ ok: true, value: { views: [{ name: 'Todos os papers de 2025' }] } });
    } finally { client.dispose(); stop(); channel.port1.close(); channel.port2.close(); await host.dispose(); await rm(root, { recursive: true, force: true }); }
  });

  it('F301–F306 — persiste layout de gráfico, coluna rollup e blocos de dashboard', async () => {
    const root = await mkdtemp(join(tmpdir(), 'folio-academic-views-as-')); const vault = join(root, 'vault'); await mkdir(vault);
    const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
    const channel = new MessageChannel(); const stop = serveWorkspaceOverMessagePort(channel.port1, host); const client = createWorkspaceMessagePortClient(channel.port2);
    try {
      await client.open({ rootPath: vault });
      const view = {
        version: 1 as const, id: 'citacoes-por-ano', name: 'Citações por ano', source: 'references' as const, layout: 'chart' as const,
        group: { field: 'year' },
        columns: [{ field: 'title' }, { field: 'citations', derived: { kind: 'rollup' as const, relationKind: 'cites' as const, operation: 'count' as const } }],
      };
      const dashboards = [{ id: 'bloco-1', viewId: 'citacoes-por-ano', title: 'Visão geral', kind: 'metric' as const }];
      await expect(client.setAcademicViews({ version: 1, views: [view], dashboards })).resolves.toMatchObject({
        ok: true,
        value: { views: [{ layout: 'chart', columns: [{ field: 'title' }, { field: 'citations', derived: { kind: 'rollup', relationKind: 'cites', operation: 'count' } }] }], dashboards },
      });
      await expect(client.academicViews()).resolves.toMatchObject({ ok: true, value: { dashboards } });
      await expect(client.academicRelations()).resolves.toMatchObject({ ok: true, value: { relations: [] } });
    } finally { client.dispose(); stop(); channel.port1.close(); channel.port2.close(); await host.dispose(); await rm(root, { recursive: true, force: true }); }
  });
});
