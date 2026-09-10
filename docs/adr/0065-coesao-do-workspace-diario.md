# ADR 0065 — Coesão do workspace diário

**Status:** aceito · 2026-09-09

## Decisão

- Home e o painel de pesquisa são composição de dados que o produto já possui:
  listagem de arquivos, Project operacional, fila de leitura, Problems,
  Research Overview, attachments e PDF annotations. O renderer apenas recebe
  DTOs do preload; não abre filesystem, SQLite nem parseia Markdown.
- Atividade, onboarding, modos de foco, layouts e recência de commands são
  preferências operacionais locais por vault. A atividade armazena somente
  tipo, momento e identificadores opcionais — nunca texto de documento,
  anotação, título sensível ou conteúdo bibliográfico.
- Focus Modes alteram visibilidade e composição de navegação/sidebar. Eles não
  mudam sessões, CodeMirror, Document AST ou a fonte de verdade do vault.
  Layouts salvos preservam essa mesma regra.
- A sidebar continua um único registro de painéis. O contexto seleciona a
  composição apropriada; documentos usam outline/problems/references/backlinks
  existentes, enquanto Home encaminha às superfícies de pesquisa e projeto.
  Não são criados shells concorrentes.
- F145 estende somente o Command Registry: category e aliases são metadata
  declarativa; Palette continua filtrando comandos disponíveis, mostrando
  atalhos e ordenando recência local. Nenhum callback de UI é registrado como
  command paralelo.

## Consequências

O pesquisador descobre o ciclo ler → anotar → escrever → revisar → publicar
sem precisar conhecer packages internos. Apagar as preferências locais não
perde autoria nem projeções reconstruíveis; o vault em Markdown segue útil
fora do Folio.
