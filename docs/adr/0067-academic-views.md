# ADR 0067 — Academic Views como projeções portáveis

**Status:** aceito · 2026-09-09

## Decisão

Uma Academic View é uma definição versionada, armazenada em estado operacional
portátil, sobre uma única fonte acadêmica existente: documentos, referências,
notas de literatura, projetos, datasets, estudos de revisão ou anotações.

- A definição contém somente configuração: fonte, filtro (`QueryAst` e o texto
  da consulta), layout, ordenação, agrupamento e colunas.
- Ela não contém linhas, entidades, totais, contadores, seleção temporária ou
  valores computados. Esses resultados são projeções reconstruíveis do host.
- A persistência futura será um JSON versionado em `.academic/views/`, fora do
  SQLite e fora do Markdown autoral. Apagar o índice não apaga a view.
- Views não misturam fontes arbitrariamente na primeira versão. Relações e
  rollups, se necessários, serão uma extensão posterior e explícita.
- Mudar um cartão de board ou uma ação da view deve delegar para o serviço que
  já é dono do estado operacional correspondente; uma view nunca cria um
  campo `status` genérico em Markdown.

## Consequências

O produto ganha a ideia de Bases do Obsidian e múltiplas representações do
Notion sem introduzir um banco canônico, uma nova AST ou uma cópia das
entidades acadêmicas. O pacote `@abnt/academic-views` é propositalmente puro:
ele modela e valida a configuração, mas não lê filesystem, SQLite, React ou
Electron. O Workspace Service continuará sendo responsável por resolver e
persistir a projeção.
