# ADR 0074 — Colaboração distribuída sem edição concorrente

## Contexto

O Folio compartilha estado operacional por meio da pasta espelho. Pessoas,
marcos, atribuições, menções, decisões de triagem e presença precisam viajar
com esse estado, mas o editor continua sendo um arquivo Markdown local.

## Decisão

O recurso portátil `collaboration/shared-project` passa a incluir esses dados
operacionais. A triagem pode permanecer na fase `independent`, que não expõe
decisões alheias na superfície, ou passar para `reconciliation`, que mede os
desacordos. Referências a pessoas são IDs de colaboradores locais, nunca
contas, e-mails ou dados de presença em tempo real.

`concurrentEditing` é persistido somente como `undecided`. Locking, OT e CRDT
são alternativas de arquitetura registradas pelo domínio, não funcionalidades
habilitadas: o produto continua a editar localmente e usa o fluxo explícito de
conflitos da pasta espelho.

## Consequências

O diálogo de colaboração vira uma superfície de coordenação compartilhável sem
introduzir servidor, login ou canal de presença. Edição simultânea exigirá ADR
próprio, protocolo revisionado e resolução de operações; não basta mudar a UI.
