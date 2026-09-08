# ADR 0032 — F24: editor de metadados YAML

**Status:** aceito · 2026-09-08

O editor visual de metadados lê o frontmatter do snapshot da sessão e aplica
uma única transação que substitui apenas esse frontmatter. Título, subtítulo,
autores, orientador, instituição, curso, cidade, ano, palavras-chave, idioma,
profile e bibliografia voltam para YAML; o corpo Markdown e propriedades não
editadas são preservados.

Autores/orientador são serializados nos formatos `authors`/`contributors` já
consumidos pelo parser; os campos de TCC usam `properties` (`tcc:*`). Não há
estado canônico no React ou SQLite.
