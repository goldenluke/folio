# ADR 0013 — CodeMirror é projeção visual, não autoridade de edição

**Status:** aceito · 2026-09-07

## Contexto

P6 definiu um `EditorController` headless para texto, seleção, revisões e
projeções de linguagem. Um editor desktop precisa de IME, undo/redo, desenho
virtual, teclas, lint, autocomplete e hover; CodeMirror 6 fornece esses recursos.
Usá-lo como fonte de verdade, porém, duplicaria o rascunho guardado por
`workspace-sessions` e recolocaria no componente visual os riscos de conflito,
salvamento e resultados assíncronos obsoletos já tratados nas P2–P6.

## Decisão

`@abnt/editor-codemirror` é um adaptador dependente apenas de
`@abnt/editor-core`, `@abnt/language-service` e bibliotecas CodeMirror.

- Toda alteração ou seleção de `EditorView` é convertida em `EditorTransaction`
  e entregue ao controller.
- Todo evento externo do controller atualiza a view com `addToHistory: false`.
  Assim, save, compilação, conflito ou mudança de outra superfície não viram
  uma ação local de undo/redo.
- O language service fornece completions e hover diretamente; o snapshot do
  controller fornece os diagnósticos para o lint.
- A sessão fechar destrói a view. Destruir a view não fecha a sessão: o host é
  dono desse ciclo de vida.

## Consequências

- React e Electron podem apenas montar/desmontar o adaptador e observar seus
  snapshots; não precisam conhecer offsets, AST, SQLite ou regras ABNT.
- O package é testável com uma `EditorView` real no jsdom, sem inicializar uma
  aplicação desktop.
- Uma futura extensão VS Code ou LSP continua consumindo `editor-core` e
  `language-service`, sem depender de CodeMirror.
