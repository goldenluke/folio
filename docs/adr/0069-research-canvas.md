# ADR 0069 — Research Canvas como artefato acadêmico

**Status:** aceito · 2026-09-09

Canvas é um JSON versionado, criado explicitamente pelo usuário, com nós que
referenciam documentos, seções, referências, notas, anotações, datasets e
projetos. Cartões de texto e arestas de argumento (`supports`, `contradicts`,
`derived-from`) são operacionais; não alteram Markdown nem DocumentAst. O
formato permanece deliberadamente simples para futura interoperabilidade com
JSON Canvas, que exigirá ADR próprio de mapeamento antes de ser declarado
compatível.
