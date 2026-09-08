# ADR 0047 — Knowledge Workspace local

**Data:** 2026-09-08  
**Estado:** aceito

## Decisão

Tags Markdown/frontmatter e properties de frontmatter entram no Query Planner
como projeções fornecidas pelo host desktop. O `language-service` recebe a
projeção abstrata e não lê YAML ou SQLite diretamente. A sintaxe inclui
`tag:`, `author:`, `year:`, `profile:` e `lang:`, combinável por AND com F4.

Buscas salvas e collections são preferências locais do desktop por `workspaceId`
em armazenamento da UI. Collections guardam IDs de documentos e referências,
mas não movem arquivos nem se tornam conteúdo Markdown.

## Consequências

- O React continua sem SQL e sem acesso ao filesystem.
- Tags e metadata permanecem autorais no Markdown; a projeção pode ser
  descartada/recalculada.
- Views operacionais não contaminam `library.json`, o Document AST ou o índice
  SQLite canônico-descartável.
