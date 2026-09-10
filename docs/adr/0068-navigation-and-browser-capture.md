# ADR 0068 — Navegação transversal e captura externa

**Status:** aceito · 2026-09-09

Bookmarks são estado operacional portátil e apontam para identidades já
existentes; nunca copiam Markdown ou referências. Uma integração de Web
Clipper envia somente um DTO validado com URL HTTP(S), título e seleção. O
Desktop o encaminha à inbox existente para preview, normalização e confirmação
do usuário; nenhuma extensão recebe filesystem ou autoridade de escrita.
