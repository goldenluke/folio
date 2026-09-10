# ADR 0077 — Decisão de edição concorrente

## Contexto

O Folio sincroniza arquivos e estado operacional com conflitos explícitos. Não
há evidência de produto suficiente para impor locking, OT ou CRDT ao editor.

## Decisão

F415 registra apenas contagens locais de contenção, expiração, conflitos e
merge manual; nunca conteúdo, paths, seleção, identidade pessoal ou telemetria
remota. F416 oferece `DocumentLeaseLocks` como protótipo isolado e opt-in: um
lease expira, pode ser renovado pelo titular e não altera a semântica do editor
ou a resolução de sync.

OT e CRDT permanecem alternativas avaliadas, não dependências: ambos exigem
um protocolo de operações, presença em tempo real, recuperação e auditoria que
o produto não possui hoje. Locking é mais simples, mas só será integrado à UI
se os sinais locais mostrarem contenção recorrente. A decisão corrente continua
`undecided`.

## Consequências

Não há rede nova, conta, servidor de presença nem bloqueio automático de
autoria. Conflitos continuam no fluxo manual de sync. Uma decisão futura deve
alterar esta ADR e incluir testes de falha, offline e interoperabilidade antes
de afetar o editor principal.
