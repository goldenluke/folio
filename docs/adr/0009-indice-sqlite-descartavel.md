# ADR 0009 — Índice SQLite é projeção descartável do workspace

**Status:** aceito · 2026-09-07

## Contexto

Um vault grande precisa responder a busca, headings, links, citações e recursos
sem reprocessar todo Markdown a cada consulta. Colocar os documentos no banco,
porém, violaria o modelo local-first adotado na P2 e criaria duas fontes de
verdade concorrentes.

## Decisão

`@abnt/workspace-index` recebe apenas `WorkspaceStorage` e um path para um
SQLite local — normalmente `.academic/index.sqlite`. Ele não importa o
filesystem local, Electron, compiler, normas ou renderers. Isso permite trocar
o storage sob o índice e mantém a projeção fora do núcleo semântico.

O schema tem versão própria (`PRAGMA user_version` + `index_migrations`) e,
na versão inicial, materializa:

- fingerprint de arquivo: `FileId`, `DocumentId`, path, revisão e hash;
- headings, links, citações e recursos extraídos da Document AST;
- FTS5 sobre título e fonte Markdown.

Ao abrir ou sincronizar, arquivos cujo fingerprint não mudou são ignorados;
alterações recebidas como eventos do workspace reindexam somente o arquivo
afetado. Renames preservam `FileId`, portanto atualizam a projeção sem perder
relações. Remoções eliminam as linhas dependentes na mesma transação.

`rebuild()` fecha e remove `index.sqlite`, `-wal` e `-shm`, aplica as migrações
e recompõe tudo pelo `WorkspaceStorage`. O mesmo resultado é obtido quando o
arquivo é apagado entre duas execuções. O banco nunca contém a única cópia do
documento.

## Consequências

- P4 pode usar os fingerprints para invalidar compilações dependentes.
- P5/P8 podem implementar language service, busca e grafo a partir de consultas
  estruturadas, sem interpretar strings Markdown na UI.
- O adaptador depende de `better-sqlite3@12`, limitado ao Node 20 do projeto;
  ele fornece SQLite com FTS5 e licença permissiva. Não atravessa a fronteira
  do package para o domínio.
- Caches antigos podem ser apagados em vez de receber migração quando uma
  migração não for segura ou não compensar o custo.
