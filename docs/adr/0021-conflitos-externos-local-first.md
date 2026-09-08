# ADR 0021 — Conflitos de alteração externa no vault local-first

## Contexto

Um vault pode ser alterado por Dropbox, iCloud, Syncthing, Git ou um editor
externo. `workspace-local` já normaliza esses eventos; `workspace-sessions`
já preservava a alteração externa quando havia rascunho sujo. Faltava fechar o
fluxo de produto: o desktop não recebia esse estado e, portanto, não oferecia
uma escolha explícita antes de salvar.

## Decisão

`DocumentSessions.resolveExternalConflict(fileId, resolution)` é a autoridade
para o desfecho, exposto como `editor/resolve-conflict` no protocolo
versionado. A projeção passa por `editor-core`, Workspace Service, Main e API
restrita do preload até o renderer; o renderer apenas dispara comandos e nunca
reescreve arquivos ou altera a base de revisão por conta própria.

- `keep-local`: conserva o rascunho e adota a revisão externa como a nova base
  persistida. O próximo `save()` sobrescreve o arquivo conscientemente.
- `reload-external`: descarta o rascunho, cancela a compilação ativa e recarrega
  o arquivo do `WorkspaceStorage`; projeções e bibliografia são invalidadas e
  a compilação é reprogramada.

Sem conflito pendente, a operação é idempotente. O banner do desktop deixa a
decisão visível; não há sobrescrita silenciosa.

## Consequências

Este P16 integra-se a ferramentas de sincronização baseadas em filesystem, mas
não implementa transporte remoto, conta, CRDT, merge textual ou política de
Git. Isso preserva o modelo local-first: Markdown continua a fonte de verdade,
e SQLite continua apenas projection descartável. Um sync proprietário futuro
deve ser um adapter de `WorkspaceStorage`, com identidade e política de
conflito próprias, não uma responsabilidade de React, CodeMirror ou da AST.
