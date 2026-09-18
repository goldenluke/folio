import { describe, expect, it, vi } from 'vitest';

import type { EditorController, EditorEvent, EditorEventListener, EditorSnapshot, EditorTransaction } from '@abnt/editor-core';
import type { WorkspaceFileId } from '@abnt/workspace-core';

import { createCommandRegistry } from '../apps/desktop/src/renderer/shell/commands.js';
import { executeAutomation, parseWorkspaceMacros, planAutomation } from '../apps/desktop/src/renderer/shell/automation.js';
import { chordFromEvent, keybindingConflict, mergeKeybindings, normalizeChord, registerKeybindings } from '../apps/desktop/src/renderer/shell/keybindings.js';
import { fuzzyScore, rankCommands, rankQuickOpenFiles } from '../apps/desktop/src/renderer/shell/palette.js';
import { createPanelRegistry } from '../apps/desktop/src/renderer/shell/panels.js';
import { asViewId, createViewsModel } from '../apps/desktop/src/renderer/shell/views.js';

const emptySnapshot = (fileId: string, content = ''): EditorSnapshot => ({
  fileId: fileId as unknown as WorkspaceFileId,
  version: 0,
  session: {
    id: fileId as unknown as WorkspaceFileId,
    file: { id: fileId as unknown as WorkspaceFileId, path: `${fileId}.md` as never, revision: 1, contentHash: 'sha256:x' as never },
    revision: 1,
    content,
    dirty: false,
    status: 'idle',
    diagnostics: [],
  },
  selection: { anchor: 0, head: 0 },
  outline: [],
  diagnostics: [],
});

/** Controller falso o bastante para exercitar o modelo de tabs sem IPC nem CodeMirror. */
class FakeEditorController implements EditorController {
  readonly fileId;
  #snapshot: EditorSnapshot;
  readonly #listeners = new Set<EditorEventListener>();
  disposed = false;

  constructor(fileId: string, content = '') {
    this.fileId = fileId as unknown as WorkspaceFileId;
    this.#snapshot = emptySnapshot(fileId, content);
  }

  snapshot(): EditorSnapshot {
    return this.#snapshot;
  }

  dispatch(_transaction: EditorTransaction): EditorSnapshot {
    return this.#snapshot;
  }

  async save(): Promise<EditorSnapshot> {
    return this.#snapshot;
  }

  async idle(): Promise<void> {}

  subscribe(listener: EditorEventListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  dispose(): void {
    this.disposed = true;
    const event: EditorEvent = { type: 'editor:closed', fileId: this.fileId };
    for (const listener of this.#listeners) listener(event);
    this.#listeners.clear();
  }
}

describe('P9 — CommandRegistry', () => {
  it('executa comandos habilitados e ignora os desabilitados', async () => {
    const registry = createCommandRegistry();
    const run = vi.fn();
    registry.register({ id: 'document.save', title: 'Salvar', isEnabled: (ctx) => ctx.activeViewId !== undefined, run });

    await registry.execute('document.save', {});
    expect(run).not.toHaveBeenCalled();

    await registry.execute('document.save', { activeViewId: asViewId('view_1') });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('recusa registro duplicado e execução de comando desconhecido', async () => {
    const registry = createCommandRegistry();
    registry.register({ id: 'x', title: 'X', run: () => {} });
    expect(() => registry.register({ id: 'x', title: 'X de novo', run: () => {} })).toThrow();
    await expect(registry.execute('inexistente', {})).rejects.toThrow();
  });

  it('valida argumentos antes de executar e não aceita objeto arbitrário sem schema', async () => {
    const registry = createCommandRegistry();
    const run = vi.fn();
    registry.register({
      id: 'document.open', title: 'Abrir',
      arguments: { safeParse: (value) => typeof value === 'object' && value !== null && typeof (value as { fileId?: unknown }).fileId === 'string' ? { success: true as const, data: value } : { success: false as const, message: 'fileId obrigatório' } },
      run,
    });
    registry.register({ id: 'without-args', title: 'Sem argumentos', run: () => {} });

    await expect(registry.execute('document.open', {}, { nope: true })).rejects.toThrow('fileId obrigatório');
    await expect(registry.execute('without-args', {}, { nope: true })).rejects.toThrow('não aceita argumentos');
    await registry.execute('document.open', {}, { fileId: 'metodo' });
    expect(run).toHaveBeenCalledWith({}, { fileId: 'metodo' });
  });
});

describe('F110–F116 — automação declarativa', () => {
  it('planeja e executa uma chain sequencial apenas por commands registrados', async () => {
    const registry = createCommandRegistry();
    const order: string[] = [];
    registry.register({ id: 'document.save', title: 'Salvar', automationPreview: () => ({ summary: 'Salvar', requiresConfirmation: true }), run: () => { order.push('save'); } });
    registry.register({ id: 'publication.preview', title: 'Preview', automationPreview: () => ({ summary: 'Preview' }), run: () => { order.push('preview'); } });
    const plan = planAutomation(registry, {}, [{ commandId: 'document.save' }, { commandId: 'publication.preview' }]);

    expect(plan.requiresConfirmation).toBe(true);
    expect(plan.steps.map((step) => step.preview.summary)).toEqual(['Salvar', 'Preview']);
    await executeAutomation(registry, {}, plan);
    expect(order).toEqual(['save', 'preview']);
    expect(() => planAutomation(registry, {}, [{ commandId: 'not-registered' }])).toThrow('não pode ser automatizado');
  });

  it('recusa macros malformadas e nunca transforma texto em código executável', () => {
    expect(parseWorkspaceMacros([{ id: 'prepare', name: 'Preparar', commands: [{ commandId: 'document.save' }] }])).toEqual([{ id: 'prepare', name: 'Preparar', commands: [{ commandId: 'document.save' }] }]);
    expect(parseWorkspaceMacros([{ id: 'bad', name: 'Ruim', commands: [{ commandId: 'x', args: () => {} }] }])).toEqual([]);
  });
});

describe('P9 — Tab/View model', () => {
  it('abre cada navegador de pesquisa em sua própria aba', () => {
    const model = createViewsModel();

    const first = model.openBrowser();
    const second = model.openBrowser({ url: 'https://example.org/' });

    expect(second).not.toBe(first);
    expect(model.list()).toMatchObject([
      { id: first, type: 'browser', url: 'https://scholar.google.com/', title: 'Navegador' },
      { id: second, type: 'browser', url: 'https://example.org/', title: 'Navegador' },
    ]);
    model.updateBrowser(second, { url: 'https://example.org/article', title: 'Artigo de exemplo' });
    expect(model.active()).toMatchObject({ id: second, type: 'browser', url: 'https://example.org/article', title: 'Artigo de exemplo' });
  });

  it('abrir dois arquivos cria duas tabs; ativar uma não fecha a outra', () => {
    const model = createViewsModel();
    const a = new FakeEditorController('a');
    const b = new FakeEditorController('b');

    const idA = model.openEditor({ fileId: 'a', path: 'a.md', controller: a, snapshot: a.snapshot() });
    const idB = model.openEditor({ fileId: 'b', path: 'b.md', controller: b, snapshot: b.snapshot() });

    expect(model.list().map((view) => view.fileId)).toEqual(['a', 'b']);
    expect(model.active()?.id).toBe(idB);

    model.activate(idA);
    expect(model.active()?.id).toBe(idA);
    expect(model.list()).toHaveLength(2);
  });

  it('reabrir um arquivo já aberto ativa a tab existente em vez de duplicar', () => {
    const model = createViewsModel();
    const a = new FakeEditorController('a');
    const idA = model.openEditor({ fileId: 'a', path: 'a.md', controller: a, snapshot: a.snapshot() });
    const again = model.openEditor({ fileId: 'a', path: 'a.md', controller: a, snapshot: a.snapshot() });

    expect(again).toBe(idA);
    expect(model.list()).toHaveLength(1);
  });

  it('reordena tabs sem alterar a sessão ou qual tab está ativa', () => {
    const model = createViewsModel();
    const a = new FakeEditorController('a');
    const b = new FakeEditorController('b');
    const c = new FakeEditorController('c');
    const idA = model.openEditor({ fileId: 'a', path: 'a.md', controller: a, snapshot: a.snapshot() });
    model.openEditor({ fileId: 'b', path: 'b.md', controller: b, snapshot: b.snapshot() });
    const idC = model.openEditor({ fileId: 'c', path: 'c.md', controller: c, snapshot: c.snapshot() });
    model.reorder(idC, idA);
    expect(model.list().map((view) => view.fileId)).toEqual(['c', 'a', 'b']);
    expect(model.active()?.id).toBe(idC);
  });

  it('pode abrir duas views do mesmo documento para split e atualiza ambas pelo snapshot da sessão única', () => {
    const model = createViewsModel();
    const left = new FakeEditorController('a');
    const right = new FakeEditorController('a');
    const leftId = model.openEditor({ fileId: 'a', path: 'a.md', controller: left, snapshot: left.snapshot() });
    const rightId = model.openEditor({ fileId: 'a', path: 'a.md', controller: right, snapshot: right.snapshot(), duplicate: true });

    expect(leftId).not.toBe(rightId);
    expect(model.list()).toHaveLength(2);
    model.updateSnapshot('a', emptySnapshot('a', 'alteração compartilhada'));
    expect(model.list().map((view) => view.type === 'editor' ? view.snapshot.session.content : '')).toEqual(['alteração compartilhada', 'alteração compartilhada']);
  });

  it('fechar uma tab não descarta as demais nem seus controllers', () => {
    const model = createViewsModel();
    const a = new FakeEditorController('a');
    const b = new FakeEditorController('b');
    const idA = model.openEditor({ fileId: 'a', path: 'a.md', controller: a, snapshot: a.snapshot() });
    model.openEditor({ fileId: 'b', path: 'b.md', controller: b, snapshot: b.snapshot() });

    const removed = model.close(idA);
    expect(removed?.fileId).toBe('a');
    expect(model.list().map((view) => view.fileId)).toEqual(['b']);
    // O modelo nunca chama dispose() sozinho — é o host que decide, e só ele sabe
    // se deve encerrar a sessão remota também.
    expect(a.disposed).toBe(false);
  });

  it('fechar a tab ativa promove uma vizinha', () => {
    const model = createViewsModel();
    const a = new FakeEditorController('a');
    const b = new FakeEditorController('b');
    const idA = model.openEditor({ fileId: 'a', path: 'a.md', controller: a, snapshot: a.snapshot() });
    model.openEditor({ fileId: 'b', path: 'b.md', controller: b, snapshot: b.snapshot() });
    model.activate(idA);

    model.close(idA);
    expect(model.active()?.fileId).toBe('b');
  });

  it('updateSnapshot reflete progresso de uma tab em segundo plano', () => {
    const model = createViewsModel();
    const a = new FakeEditorController('a');
    model.openEditor({ fileId: 'a', path: 'a.md', controller: a, snapshot: a.snapshot() });

    model.updateSnapshot('a', emptySnapshot('a', 'novo conteúdo'));
    expect(model.list()[0]?.snapshot.session.content).toBe('novo conteúdo');
  });

  it('closeAll esvazia a lista de uma vez, para troca de vault', () => {
    const model = createViewsModel();
    const a = new FakeEditorController('a');
    const b = new FakeEditorController('b');
    model.openEditor({ fileId: 'a', path: 'a.md', controller: a, snapshot: a.snapshot() });
    model.openEditor({ fileId: 'b', path: 'b.md', controller: b, snapshot: b.snapshot() });

    const removed = model.closeAll();
    expect(removed.map((view) => view.fileId).sort()).toEqual(['a', 'b']);
    expect(model.list()).toHaveLength(0);
    expect(model.active()).toBeUndefined();
  });

  it('uma tab de preview e uma tab de editor para o mesmo arquivo coexistem', () => {
    const model = createViewsModel();
    const a = new FakeEditorController('a');
    const editorId = model.openEditor({ fileId: 'a', path: 'a.md', controller: a, snapshot: a.snapshot() });
    const previewId = model.openPreview({ fileId: 'a', path: 'a.md' });

    expect(editorId).not.toBe(previewId);
    expect(model.list()).toHaveLength(2);
    const preview = model.list().find((view) => view.id === previewId);
    expect(preview).toMatchObject({ type: 'preview', fileId: 'a', preview: undefined, loading: true });
  });

  it('reabrir preview do mesmo arquivo ativa a tab existente em vez de duplicar', () => {
    const model = createViewsModel();
    const first = model.openPreview({ fileId: 'a', path: 'a.md' });
    const second = model.openPreview({ fileId: 'a', path: 'a.md' });

    expect(second).toBe(first);
    expect(model.list()).toHaveLength(1);
  });

  it('pode abrir preview em segundo plano sem tirar a autoridade visual do editor', () => {
    const model = createViewsModel();
    const a = new FakeEditorController('a');
    const editorId = model.openEditor({ fileId: 'a', path: 'a.md', controller: a, snapshot: a.snapshot() });

    const previewId = model.openPreview({ fileId: 'a', path: 'a.md', activate: false });

    expect(previewId).not.toBe(editorId);
    expect(model.active()?.id).toBe(editorId);
    expect(model.list()).toHaveLength(2);
  });

  it('updatePreview substitui o HTML e limpa o loading só da tab correspondente', () => {
    const model = createViewsModel();
    model.openPreview({ fileId: 'a', path: 'a.md' });
    model.openPreview({ fileId: 'b', path: 'b.md' });

    model.updatePreview('a', { fileId: 'a', revision: 3, profileId: 'abnt-artigo', html: '<p>a</p>' });

    const a = model.list().find((view) => view.fileId === 'a');
    const b = model.list().find((view) => view.fileId === 'b');
    expect(a).toMatchObject({ loading: false, preview: { revision: 3, html: '<p>a</p>' } });
    expect(b).toMatchObject({ loading: true, preview: undefined });
  });
});

describe('P9 — Painéis registráveis', () => {
  it('não permite dois painéis com o mesmo id e permite desregistrar', () => {
    const registry = createPanelRegistry();
    const unregister = registry.register({ id: 'outline', title: 'Sumário', render: () => null as never });
    expect(() => registry.register({ id: 'outline', title: 'De novo', render: () => null as never })).toThrow();
    expect(registry.list()).toHaveLength(1);
    unregister();
    expect(registry.list()).toHaveLength(0);
  });
});

describe('P9 — Keybindings', () => {
  it('resolve "mod" para cmd no macOS e ctrl nas demais plataformas', () => {
    const event = { key: 's', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false };
    expect(chordFromEvent(event, false)).toBe('mod+s');
    expect(chordFromEvent({ ...event, ctrlKey: false, metaKey: true }, true)).toBe('mod+s');
  });

  it('ignora teclas modificadoras sozinhas e é indiferente a maiúsculas', () => {
    expect(chordFromEvent({ key: 'Control', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false }, false)).toBeUndefined();
    expect(chordFromEvent({ key: 'S', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false }, false)).toBe('mod+s');
  });

  it('normaliza preferências e exige que o chamador resolva conflito antes de sobrescrever', () => {
    const defaults = new Map([['mod+s', 'document.save']]);
    const merged = mergeKeybindings(defaults, { ' MOD + ALT + P ': 'macro.prepare' });
    expect(normalizeChord(' MOD + ALT + P ')).toBe('mod+alt+p');
    expect(merged.get('mod+alt+p')).toBe('macro.prepare');
    expect(keybindingConflict(merged, 'mod+s', 'macro.prepare')).toBe('document.save');
    expect(keybindingConflict(merged, 'mod+alt+p', 'macro.prepare')).toBeUndefined();
  });

  it('despacha para o CommandRegistry só quando o chord está mapeado', async () => {
    const registry = createCommandRegistry();
    const run = vi.fn();
    registry.register({ id: 'document.save', title: 'Salvar', run });

    const listeners = new Map<string, (event: KeyboardEvent) => void>();
    const target = {
      addEventListener: (type: 'keydown', listener: (event: KeyboardEvent) => void) => listeners.set(type, listener),
      removeEventListener: (type: 'keydown') => listeners.delete(type),
    };

    const unregister = registerKeybindings({
      registry,
      bindings: new Map([['mod+s', 'document.save']]),
      context: () => ({}),
      target,
    });

    const preventDefault = vi.fn();
    const mapped = { key: 's', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false, preventDefault } as unknown as KeyboardEvent;
    listeners.get('keydown')?.(mapped);
    await Promise.resolve();
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledTimes(1);

    const unmapped = { key: 'x', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false, preventDefault: vi.fn() } as unknown as KeyboardEvent;
    listeners.get('keydown')?.(unmapped);
    expect(run).toHaveBeenCalledTimes(1);

    unregister();
    expect(listeners.size).toBe(0);
  });
});

describe('F2/F3 — Command Palette e Quick Open', () => {
  it('faz ranking fuzzy com preferência por início de palavra', () => {
    expect(fuzzyScore('abr arq', 'Abrir arquivo rapidamente')).toBeGreaterThan(fuzzyScore('abr arq', 'Salvar documento') ?? -Infinity);
    expect(fuzzyScore('zzz', 'Abrir arquivo')).toBeUndefined();
  });

  it('lista somente comandos habilitados pelo mesmo CommandRegistry que os atalhos usam', () => {
    const registry = createCommandRegistry();
    registry.register({ id: 'document.save', title: 'Salvar documento', run: () => {} });
    registry.register({ id: 'document.exportPdf', title: 'Exportar como PDF', isEnabled: () => false, run: () => {} });

    expect(rankCommands(registry, {}, 'sal').map((item) => item.id)).toEqual(['document.save']);
    expect(rankCommands(registry, {}, 'export')).toEqual([]);
  });

  it('prioriza nome/título fuzzy e uso recente no Quick Open, sem depender de caminho como identidade', () => {
    const ranked = rankQuickOpenFiles(
      [
        { fileId: 'metodo', path: 'capitulos/metodologia.md', title: 'Metodologia' },
        { fileId: 'intro', path: 'introducao.md', title: 'Introdução' },
        { fileId: 'anexo', path: 'anexos/metodos.md' },
      ],
      'met',
      ['intro', 'metodo'],
    );

    expect(ranked.map((item) => item.id)).toEqual(['metodo', 'anexo']);
    expect(ranked[0]).toMatchObject({ label: 'Metodologia', detail: 'capitulos/metodologia.md' });
  });
});
