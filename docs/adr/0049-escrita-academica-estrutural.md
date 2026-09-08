# ADR 0049 — Assistência de escrita acadêmica é derivada e local

**Status:** aceito

## Contexto

O Folio já tinha outline, diagnostics e estatísticas de escrita revisionadas,
mas faltava reuni-los numa superfície de uso diário sem introduzir um novo
formato de documento ou estado editorial paralelo.

## Decisão

- O navegador estrutural compara o outline atual com uma expectativa de UI por
  profile. Ele não impõe seções ao `document-model`.
- O checklist mostra apenas o estado dos diagnostics existentes e navega ao
  range de origem quando houver pendência.
- `LanguageWritingStatistics` projeta palavras por heading Markdown no
  Language Service; frontmatter, referências, tabelas, figuras e fórmulas
  permanecem fora da contagem, como no total do documento.
- Metas de documento, sessão e seção são preferências locais do desktop. A
  sessão mede deltas desde a abertura do painel e não grava histórico no vault.

## Consequências

Perfis institucionais podem futuramente registrar expectativas próprias sem
alterar a AST. Metas não sincronizam entre máquinas até existir decisão de
produto para isso, e nunca escondem metadados no SQLite descartável.
