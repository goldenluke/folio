# ADR 0060 — Ecossistema de profiles de publicação

**Status:** aceito · 2026-09-09

## Decisão

- O registro do `@abnt/compiler` passa a expor um `PublicationProfileManifest`
  declarativo, versionado e serializável por profile. Ele contém identidade,
  tipos de documento, sistema de citação, capacidades, metadados, regra IDs,
  descrições próprias e política de página; nunca funções normativas.
- O Compiler Service lista esses manifests e o Workspace Service os repassa ao
  desktop por DTO validado. O renderer não importa standards, profiles
  executáveis ou SQLite: apenas apresenta o contrato recebido.
- Um profile institucional é composição explícita de um profile base e uma
  lista limitada de overrides declarados. Não há subclasses, resolução dinâmica
  ou alteração da Document AST. `institutional-tcc` é um modelo de composição,
  não a alegação de conformidade com uma instituição específica.
- O inspector permite comparar manifests em linguagem editorial e aplicar a
  escolha somente como `profile` no frontmatter, por `EditorTransaction`.
  Capabilities e metadados não são inferidos por React a partir do Markdown.
- O preview de validação usa uma compilação seca sobre `fileId` e revisão
  esperada. Ele é descartado se o rascunho mudar e não publica preview,
  diagnósticos, Publication AST ou fonte composta na sessão.

## Consequências

Profiles seguem sendo comportamento do compilador sobre o mesmo Document AST;
a source of truth autoral continua sendo Markdown e frontmatter. O índice
SQLite não armazena uma cópia de manifests nem decisões editoriais. A próxima
família acadêmica real (F102) permanece uma decisão de produto/mercado: este
ADR não escolhe APA, IEEE, Vancouver nem outro estilo automaticamente.
