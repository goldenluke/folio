# ADR 0012 — Editor core sem CodeMirror ou segunda fonte de texto

**Status:** aceito · 2026-09-07

## Contexto

Depois de P4 e P5, uma interface ainda precisa combinar rascunho, seleção,
diagnósticos, outline e preview. Fazer isso diretamente em componentes React ou
em extensões CodeMirror repetiria regras de transação e concorrência, além de
impedir o futuro LSP de compartilhar o mesmo comportamento.

Por outro lado, `EditorState` de uma biblioteca visual não pode se tornar a
fonte de verdade: a sessão é quem protege revisões, salvamento atômico, conflito
externo e cancelamento do compilador.

## Decisão

`@abnt/editor-core` define `EditorWorkspace` e um `EditorController` por
`WorkspaceFileId`. Cada controller expõe um snapshot imutável com:

- `DocumentSessionSnapshot` como texto e estado autoritativos;
- seleção baseada em offsets UTF-16;
- outline e diagnósticos derivados pelo `LanguageService`;
- preview já produzido pela sessão, quando disponível.

`dispatch` recebe transações atômicas de edição/seleção. Os intervalos são
validados contra o snapshot atual, sobreposições são recusadas e a seleção é
transformada pelas edições quando não foi explicitamente fornecida. O controller
nunca escreve arquivo: chama `DocumentSessions.replaceContent` e `save`.

Cada atualização de fonte inicia uma nova projeção assíncrona. Um epoch local e
a revisão da sessão são checados na conclusão; outline ou diagnósticos de uma
fonte velha não podem substituir o estado novo. Encerrar uma sessão encerra o
controller e o remove do workspace de editores.

## Consequências

- O adaptador CodeMirror pode traduzir transações e seleção sem conhecer vault,
  compiler ou índice.
- React/Electron permanecem consumidores de snapshots e eventos, não donos do
  modelo de edição.
- O sistema evita duas cópias mutáveis do documento; a recuperação e os
  conflitos continuam centralizados na P2/P4.
- Undo/redo, IME e rendering virtual pertencem ao adaptador de editor visual;
  não são simulados no core antes de haver uma integração concreta.
