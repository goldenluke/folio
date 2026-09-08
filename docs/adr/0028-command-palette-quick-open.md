# ADR 0028 — F2/F3: Command Palette e Quick Open

**Status:** aceito · 2026-09-08

## Contexto

O shell P9 já possuía um `CommandRegistry` e um mapa de keybindings, mas eles
não tinham uma superfície de descoberta. Abrir documentos ainda dependia do
Explorer ou da busca textual lateral. Uma IDE acadêmica precisa permitir que a
mesma operação seja encontrada por nome, atalho e, futuramente, plugin, sem
amarrar comandos a callbacks de componentes React.

## Decisão

O renderer ganha uma única Command Palette com dois modos:

```text
Mod+Shift+P → comandos registrados
Mod+P       → Quick Open de documentos
```

`palette.commands` e `palette.quickOpen` são commands normais do mesmo
`CommandRegistry` usado pelos menus e keybindings. A palette só lista comandos
habilitados no `CommandContext` atual e, ao selecionar um deles, chama
`CommandRegistry.execute`; não conhece as operações de salvar, exportar ou
editar individualmente.

O ranking fuzzy é um módulo puro do shell desktop. Ele favorece início de
palavra e caracteres consecutivos, é determinístico e não introduz dependência
de busca ou licença adicional.

Quick Open começa pela lista de `WorkspaceFileDto` já projetada pelo Workspace
Service e consulta `workspace.search` com debounce quando existe consulta. A
resposta FTS5 acrescenta título e resultados de conteúdo; o ranking combina
título/nome, caminho e uma recência efêmera de arquivos abertos. React não lê
filesystem, não consulta SQLite e não usa path como identidade: o item selecionado
leva `fileId` estável e path apenas para apresentação/abertura.

## Consequências

- Todo comando existente passa a ser descobrível sem criar outra família de
  callbacks de UI.
- O Quick Open permanece funcional com consulta vazia usando a projeção atual
  do vault; conteúdo/títulos enriquecidos vêm do índice reconstruível quando
  há busca.
- Recência é estado de UI e não é persistida como metadado documental.
- A palette não implementa comandos de citações, referências ou metadados; ela
  apenas os descobrirá quando suas features registrarem commands.

## Não decidido aqui

Histórico persistente de arquivos, tags, busca estruturada, argumentos de
commands, macros e contribuição de plugins para a palette. P21 e P23–P28 de
release/produção continuam congelados.
