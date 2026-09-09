# ADR 0062 — Automação local e comandos declarativos

**Status:** aceito · 2026-09-09

## Decisão

- O `CommandRegistry` permanece a única porta de execução no renderer.
  Commands podem declarar um schema mínimo de argumentos; o registry valida o
  valor em runtime antes de consultar disponibilidade ou chamar `run`.
  Commands sem schema recusam argumentos.
- Macro é estado operacional local por vault: `{ id, name, commands[] }`.
  Cada step contém somente `CommandId` e um valor JSON. Não há interpretação
  de JavaScript, shell, PowerShell, `eval`, callback serializado ou acesso
  direto a filesystem/IPC fora do command já registrado.
- Uma chain é planejada antes de rodar. Apenas commands que publicam uma
  prévia de automação podem aparecer no plano; o executor percorre os steps
  sequencialmente por `CommandRegistry.execute`. Assim, salvar continua no
  `EditorController`, operações revisionadas continuam no Workspace Service e
  um `WorkspaceEdit` não é contornado por automação.
- Keybindings são preferência local por vault (`chord → CommandId`). Chords
  são normalizados e um binding existente só é substituído após confirmação
  explícita; atalhos ainda são despachados pelo registry, nunca por callback
  DOM particular.
- Ações em lote carregam alvos explícitos por `WorkspaceFileId`. A primeira
  entrega valida uma seleção pelo Workspace Service e atualiza membership de
  collection operacional. Um plano apresenta a contagem e o efeito antes da
  execução; steps de save/export exigem confirmação.

## Consequências

O usuário pode definir `mod+alt+p` para uma macro “Preparar submissão” e ela
continua limitada às capacidades já visíveis na Command Palette. A automação
não vira uma segunda linguagem de extensão, não cria nova fonte de verdade e
não amplia autorização de plugins, renderer ou macros. Operações batch que
venham a mutar autoria deverão continuar exibindo os arquivos afetados e
produzindo o mesmo `WorkspaceEdit` revision-safe usado pela operação unitária.
