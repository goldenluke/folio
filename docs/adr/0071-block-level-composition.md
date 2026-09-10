# ADR 0071 — Composição acadêmica por blocos autorais

**Status:** aceito · 2026-09-09

IDs de bloco usam a forma autoral `^identificador` em uma linha após o bloco;
referências usam `[[arquivo.md#^identificador]]`. A resolução recebe conteúdo
do host e não lê filesystem. Extração, merge e transclusão geram prévia antes
de qualquer `WorkspaceEdit`; o pacote não altera `DocumentAst`, renderer ou
normas.
