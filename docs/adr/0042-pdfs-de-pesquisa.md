# ADR 0042 — PDFs de pesquisa: recurso local vinculado à referência

**Status:** aceito · 2026-09-08

## Decisão

F35 guarda o PDF no vault, em `resources/papers/`, e mantém o vínculo
referência → arquivo em `references/attachments.json`. O arquivo continua
binário do `WorkspaceStorage`; `references/library.json` permanece CSL-JSON
puro e fonte canônica da bibliografia.

Uma referência possui no máximo um PDF ativo. Trocar o arquivo cria o novo
recurso e atualiza o manifesto; o recurso anterior não é apagado
automaticamente, pois remoção física exige uma política explícita de limpeza.
Desvincular remove somente a entrada do manifesto.

## Fronteiras

O renderer vê apenas DTOs com caminho relativo do vault. O Main abre o seletor
nativo, lê os bytes e chama o Workspace Service; para Abrir/Revelar, ele obtém
o caminho local internamente e chama `shell.openPath`/`showItemInFolder` sem
devolvê-lo ao preload. Não há `file://` no Markdown, na AST ou em CSL-JSON.

## Fora de escopo

Leitor PDF interno, páginas, highlights, anotações e sincronização com Zotero.
