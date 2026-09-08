# ADR 0039 — Biblioteca gerenciada em CSL-JSON no vault

**Status:** aceito · 2026-09-08

## Decisão

`references/library.json` é a fonte canônica editável da biblioteca do vault.
Ela contém um array CSL-JSON legível para diff; SQLite continua apenas índice
descartável. BibTeX, RIS e exportações Zotero são adaptadores de import/export,
nunca a autoridade de dados.

O CRUD atravessa protocolo e `WorkspaceStorage`; o renderer não escreve arquivo
nem mantém uma biblioteca paralela. A biblioteca também é fundida ao ambiente
de compilação, permitindo citar suas entradas sem `bibliography:` no documento.

## Consequências

- colisões com `.bib` declarado preservam a entrada da biblioteca gerenciada;
- `WorkspaceStorage.create()` permite criar a biblioteca sem arquivo prévio;
- a sincronização ao vivo com Zotero permanece fora de escopo.
