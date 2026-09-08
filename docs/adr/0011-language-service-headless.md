# ADR 0011 — Language service usa fonte atual e índice global

**Status:** aceito · 2026-09-07

## Contexto

Uma UI de edição precisa de outline, diagnósticos, autocomplete, hover e
navegação antes de existir um editor concreto. Calcular tudo sobre SQLite deixa
o resultado atrasado enquanto há um rascunho não salvo. Calcular tudo varrendo
o vault a cada tecla ignora a projeção incremental já construída na P3.

Também não é aceitável que CodeMirror, Electron ou um futuro servidor LSP
reimplementem parsing de citações, resolução de links e conversão de offsets.
Isso criaria comportamentos diferentes conforme a interface usada.

## Decisão

`@abnt/language-service` é uma camada headless acima de `markdown`,
`workspace-sessions`, `workspace-index` e `WorkspaceStorage`.

- Para o arquivo consultado, ele usa o conteúdo da `DocumentSession`, quando
  aberta, e constrói uma Document AST efêmera com SourceRanges atuais.
- Para relações de workspace, usa o índice SQLite: referências de uma citação,
  links vindos de outros documentos e candidatos já observados no vault.
- Referências bibliográficas são recebidas por `LanguageReferenceCatalog`, uma
  porta injetável. O serviço não abre `.bib`, não chama DOI e não conhece Zotero.
- Todo contrato fala em `WorkspaceFileId`, paths e offsets; não fala em
  `EditorState`, `CodeMirror`, DOM ou Electron.

As operações iniciais são `outline`, `diagnostics`, `completions`, `hover`,
`definition` e `references`. Rename e edição estrutural ficam para uma fase em
que `WorkspaceEdit` e conflitos multi-arquivo tenham contrato próprio.

## Consequências

- O preview/editor recebe respostas coerentes com o texto que a pessoa está
  digitando, sem esperar um save para atualizar outline ou completions.
- Consultas globais continuam rápidas e descartáveis; deletar `index.sqlite`
  não altera a semântica da fonte atual.
- CodeMirror e LSP poderão ser adaptadores finos, preservando a mesma semântica
  de posições e navegação.
- A bibliografia continua uma dependência materializada pelo host, mantendo o
  núcleo e o language service independentes de providers externos.
