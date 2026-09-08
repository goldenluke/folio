# ADR 0043 — Autoria institucional: templates, profile e Problems

**Status:** aceito · 2026-09-08

Templates institucionais são conteúdo Markdown inicial: selecionam um profile,
preenchem defaults no frontmatter e propõem estrutura. Eles não são um tipo do
`document-model` nem alteram a AST.

O selector de profile grava `profile` no YAML por uma transação do editor. A
compilação continua sendo a única autoridade para profile, citações e
diagnósticos. Problems é uma projeção da lista revisionada de diagnósticos da
sessão; filtra e navega por posição, sem parse ou revalidação no renderer.
