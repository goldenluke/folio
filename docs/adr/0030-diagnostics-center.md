# ADR 0030 — F26: centro de diagnósticos acadêmicos

**Status:** aceito · 2026-09-08

O comando `diagnostics.openCenter` apresenta uma visão ampliada dos diagnósticos
do `EditorSnapshot` revisionado. Ele conta erros, avisos e informações; agrupa
por categoria de regra e navega pelo `SourceRange` ao selecionar uma ocorrência.

Não há parsing, chamada SQLite nem revalidação no renderer: o painel é somente
projeção de `DocumentSessions → EditorController`. A classificação é de UI,
por prefixos públicos das regras, e não altera a severidade/semântica fornecida
pelo compilador. Quick fixes e uma lista global multiarquivo continuam fora de
escopo até existir `WorkspaceEdit` transacional.
