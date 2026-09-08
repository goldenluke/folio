# ADR 0050 — Deduplicação de referências exige revisão humana

**Status:** aceito

## Contexto

Bibliotecas importadas acumulam chaves e registros repetidos. DOI e ISBN são
sinais fortes, mas título, autor e ano são apenas heurísticas e não podem
apagar ou combinar conteúdo autoral automaticamente.

## Decisão

- O serviço retorna candidatos com razões (`doi`, `isbn`, `title`,
  `author-year`) e score somente para ordenar a revisão.
- A UI obriga escolher a referência canônica e quais campos da duplicada devem
  compor o resultado antes de chamar `libraryMerge`.
- Merge e rename de chave usam o Language Service para calcular os edits de
  citação no vault inteiro e aplicam cada revisão pelo Workspace Service.
- O host atualiza também `sourceReference` de literature notes e move anexos
  PDF/anotações para a chave canônica. O CSL-JSON continua a fonte canônica.
- Sugestões de chave (`author-year`, `title-year`) são preview; o usuário ainda
  confirma a nova chave e conflitos são rejeitados.

## Consequências

Não há merge automático. Uma referência com PDF duplicado não perde o recurso:
se a canônica não tinha PDF, o vínculo é transferido; caso já exista, o recurso
permanece no vault, sem ser apagado automaticamente.
