# ADR 0048 — Workflow de revisão bibliográfica é projeção, não novo modelo

**Status:** aceito

## Contexto

Depois de PDF, notas de leitura e Citation Explorer, o Folio precisava apoiar
o ciclo de revisão sem duplicar a bibliografia CSL-JSON ou interpretar
Markdown no renderer.

## Decisão

- A fila de leitura é uma preferência local, versionada por vault no storage
  do renderer. Ela registra somente estado e instante da alteração.
- O `Workspace Service` expõe `researchOverview`, que combina biblioteca
  canônica, anexos PDF locais, notas de leitura e contagens do índice.
- A matriz lê somente `review.topic`, `review.method`, `review.sample` e
  `review.result` do frontmatter das literature notes. O arquivo Markdown
  permanece a fonte editável desses dados.
- Cada local do Citation Explorer recebe um trecho contextual derivado do range
  indexado e da seção precedente; a UI nunca reparseia o documento.

## Consequências

O SQLite continua descartável e não armazena estado editorial. Notas antigas
continuam válidas: campos `review` ausentes aparecem vazios na matriz. A fila
não sincroniza entre máquinas até que exista uma decisão explícita de sync.
