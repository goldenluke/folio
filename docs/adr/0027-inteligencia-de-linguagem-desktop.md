# ADR 0027 — F1: inteligência de linguagem no desktop

**Status:** aceito · 2026-09-08

## Contexto

`@abnt/language-service` já entrega outline, diagnósticos, completions, hover,
definição, referências e backlinks sobre a fonte autoritativa da sessão e o
índice global. O LSP (P13) já prova essa semântica por outro adapter.

O renderer Electron, porém, mantinha `remoteLanguageService` como stub vazio.
O editor recebia snapshots revisionados para outline/diagnósticos, mas
autocomplete, hover e navegação no CodeMirror não alcançavam o serviço real.
Reimplementar parsing no renderer resolveria a aparência de curto prazo e
criaria uma terceira semântica divergente (desktop, LSP e core).

P21–P28 de release/produção foram congelados por prioridade de produto. Esta
decisão inicia uma trilha de features independente: F1.

## Decisão

### DTOs revisionados de linguagem

`@abnt/protocol` passa a transportar quatro consultas pequenas:

```text
language/completions
language/hover
language/definition
language/references
```

Cada pedido carrega `fileId`, offset UTF-16 e `expectedRevision`. O Workspace
Service consulta a `WorkspaceLanguageService` somente se a sessão aberta ainda
está nessa revisão e confere a mesma condição depois da operação. Se a edição
avançou, devolve `CONFLICT`; o adapter visual descarta a resposta. Assim ranges
de uma revisão anterior nunca são aplicados ao documento atual, mesmo quando o
IPC não pode cancelar trabalho já iniciado.

Outline e diagnósticos continuam seguindo o caminho já existente:

```text
DocumentSessions → EditorController → EditorSnapshotDto → CodeMirror
```

Eles não ganharam uma segunda RPC por serem projeções já revisionadas no
snapshot. Backlinks continuam na consulta global existente, `documents.backlinks`.

### CodeMirror como adapter

`createRemoteLanguageService` é uma tradução DTO ↔ tipos headless. O renderer
não importa parser, filesystem, SQLite ou Electron. CodeMirror usa esse adapter
para autocomplete de citações/links, hover, `Mod-Enter` para definição e
`Mod-Shift-Enter` para listar referências.

O host React recebe somente `LanguageLocation[]`: ele abre/ativa a view e move
a seleção por `EditorController.dispatch`, sem tocar em `EditorState` fora do
adapter. Múltiplas referências aparecem em um diálogo de navegação, não em um
novo modelo de tabs ou em uma análise local.

### Catálogo bibliográfico por documento

O desktop fornece ao language service um catálogo derivado da bibliografia já
resolvida na sessão daquele documento. A fonte continua `.bib`/ambiente de
compilação; SQLite não vira catálogo canônico. Por isso autocomplete e hover
enxergam uma referência declarada no frontmatter antes de ela ter sido usada
em qualquer citação persistida no índice.

## Consequências

- O desktop e LSP consomem a mesma `WorkspaceLanguageService`.
- Completion/hover/navegação não recebem AST, Markdown ou conteúdo de vault
  extra pelo protocolo; somente DTOs de linguagem necessários.
- O guard de revisão é fiscalizado por teste de MessagePort: uma consulta com
  revisão antiga recebe `CONFLICT` após editar.
- A navegação de cross-references semânticas, rename e code actions continuam
  dependentes de `WorkspaceEdit`; não foram simulados como operações visuais.

## Não decidido aqui

Command Palette/Quick Open (F2/F3), picker/editor visual de citações,
cross-reference picker, rename multi-arquivo, code actions e busca estruturada.
P25/P26 (logs e supervisão de produção), signing, update e deploy seguem
congelados até nova decisão explícita de prioridade.
