# ADR 0057 — Citações em grupo e qualidade bibliográfica operacional

**Status:** aceito · 2026-09-08

## Decisão

A Onda Q aprofunda a biblioteca existente sem criar uma segunda bibliografia.

- O editor de citações serializa grupos diretamente para a gramática Markdown
  já aceita pelo parser (`[@a; @b, p. 42]`). A sua lista de itens é somente
  estado transitório da UI; o resultado autoral continua sendo Markdown.
- O tipo do locator é escolhido somente dentre os tipos que o parser já
  representa. Prefixo, sufixo e locator pertencem ao item da citação.
- `CslName.literal` é a representação canônica de autoria institucional. O
  grafo projeta-a como `organization`; nomes pessoais recebem uma identidade
  operacional derivada e um estado `resolved`, `possible-match` ou
  `ambiguous`. Esse estado não muda nem completa o CSL-JSON.
- A auditoria bibliográfica é uma projeção do catálogo, anexos e literature
  notes: reporta identificadores inválidos/ausentes, metadados incompletos,
  duplicatas possíveis, chave divergente e lacunas de PDF/nota. Ela é
  separada da validação normativa de um documento.
- `templates/literature-note.md`, quando presente no vault, é autoria de
  template e recebe apenas placeholders controlados (`referenceId`, `title`,
  `authors`, `year`, `doi`). Não executa JavaScript nem avalia expressões.

## Consequências

- Citações publicadas continuam determinadas pelo compilador/profile, nunca
  pela UI ou por intenção operacional de citação.
- A identidade de pessoas não promete certeza onde faltam ORCID, afiliação ou
  proveniência bibliográfica suficiente; o usuário continua vendo incerteza.
- Apagar SQLite não remove biblioteca, anexos, templates, notas ou auditoria:
  tudo é reconstruído a partir do vault e de estado operacional já existente.
- Intenção de citação (F78) permanece opcional e deliberadamente posterior:
  requer um store operacional revisionado próprio, não cabe no Markdown da
  citação nem na biblioteca canônica.
