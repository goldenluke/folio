import { describe, expect, it } from 'vitest';
import { backlinksFor, createHomeBlock, createWorkspaceThemes, defaultWorkspaceHomeLayout, defaultWorkspaceThemes, enablePageSource, filterPages, groupPages, pageGraphEdges, parsePageDocument, reorderHomeBlocks, sortPages } from '../packages/page-workspace/src/index.js';

describe('F560 — páginas Markdown e consultas do workspace', () => {
  it('mantém Markdown comum utilizável sem criar metadados implicitamente', () => {
    const page = parsePageDocument({ fileId: 'a', path: 'notas/ideia.md', source: '# Ideia\n\n- [ ] Ler fonte' });
    expect(page.properties.id).toBeUndefined();
    expect(page.tasks).toMatchObject([{ text: 'Ler fonte', completed: false, line: 2 }]);
    expect(page.title).toBe('ideia');
  });

  it('lê folio preservando frontmatter acadêmico e diagnostica valores inválidos', () => {
    const source = '---\ntitle: Página de pesquisa\nauthor: Ana\nfolio:\n  id: page-ana\n  type: project\n  status: em andamento\n  tags: [pesquisa, campo]\n  aliases: [Projeto Ana]\n  due: 2026-10-01\n  relations:\n    - targetId: dataset-1\n      kind: uses-dataset\n---\n- [x] Planejar\n';
    const page = parsePageDocument({ fileId: 'a', path: 'projeto.md', source });
    expect(page).toMatchObject({ title: 'Página de pesquisa', properties: { id: 'page-ana', type: 'project', tags: ['pesquisa', 'campo'] } });
    expect(page.tasks[0]).toMatchObject({ completed: true, due: '2026-10-01', status: 'em andamento' });
    expect(page.diagnostics).toEqual([]);
  });

  it('converte por ação explícita e é idempotente', () => {
    const source = '---\ntitle: Nota\n---\nTexto\n';
    const enabled = enablePageSource(source, 'note-1');
    expect(enabled).toContain('folio:');
    expect(enabled).toContain('id: note-1');
    expect(enablePageSource(enabled, 'note-1')).toBe(enabled);
    expect(() => enablePageSource(source, ' ')).toThrow('identificador');
  });

  it('filtra, ordena, agrupa e projeta backlinks sem armazenar arestas', () => {
    const pages = [
      parsePageDocument({ fileId: 'a', path: 'a.md', source: '---\nfolio:\n  id: a\n  status: aberto\n  tags: [método]\n---\n[[b]]' }),
      parsePageDocument({ fileId: 'b', path: 'b.md', source: '---\nfolio:\n  id: b\n  status: fechado\n  aliases: [base]\n---\n' }),
      parsePageDocument({ fileId: 'c', path: 'c.md', source: '---\nfolio:\n  id: c\n  status: aberto\n  relations: [{ targetId: b, kind: supports }]\n---\n[[base]]' }),
    ];
    expect(filterPages(pages, [{ field: 'status', value: 'aberto' }]).map((page) => page.path)).toEqual(['a.md', 'c.md']);
    expect(sortPages(pages, [{ field: 'status', direction: 'descending' }]).map((page) => page.path)).toEqual(['b.md', 'a.md', 'c.md']);
    expect(groupPages(pages, 'status').map((group) => group.value)).toEqual(['aberto', 'fechado']);
    expect(pageGraphEdges(pages)).toEqual(expect.arrayContaining([{ from: 'a', to: 'b', kind: 'wikilink' }, { from: 'c', to: 'b', kind: 'declared-relation' }]));
    expect(backlinksFor(pages, 'b')).toHaveLength(3);
  });
  it('valida temas declarativos sem permitir tokens CSS arbitrários', () => {
    expect(createWorkspaceThemes({ ...defaultWorkspaceThemes(), activeId: 'folio-dark' }).activeId).toBe('folio-dark');
    expect(() => createWorkspaceThemes({ version: 1, activeId: 'x', themes: [{ version: 1, id: 'x', name: 'X', mode: 'light', tokens: { injection: 'url(javascript:alert(1))' } }] })).toThrow('Token');
  });
  it('reordena blocos da Home sem mutar o layout persistido', () => {
    const layout = defaultWorkspaceHomeLayout();
    const reordered = reorderHomeBlocks(layout, 'shortcuts', 'recent');
    expect(reordered.blocks.map((block) => block.id)[0]).toBe('shortcuts');
    expect(layout.blocks.map((block) => block.id)[0]).toBe('recent');
    expect(reorderHomeBlocks(layout, 'missing', 'recent')).toBe(layout);
  });
  it('fornece blocos adicionais com identidade estável para um layout portátil', () => {
    expect(createHomeBlock('favorites')).toEqual({ id: 'favorites', kind: 'favorites', title: 'Favoritos', span: 1, enabled: true });
  });
});
