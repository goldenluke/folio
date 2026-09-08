# ADR 0031 — F18: identificadores e picker de referências cruzadas

**Status:** aceito · 2026-09-08

Markdown declara identificadores persistidos: headings usam ` {#sec:id}`, figuras
aceitam ` {#fig:id}` na linha da imagem e tabelas/equações aceitam uma linha
adjacente `{#tab:id}`/`{#eq:id}`. Referências usam `[[ref:<id>]]`.

O parser produz atributos autorais e `CrossReferenceNode`; o language service
projeta alvos do documento ativo. O picker do desktop consulta essa projeção por
protocolo revisionado e dispara `xref.insert`, que aplica uma transação no
`EditorController`. React não enumera AST nem gera referências efêmeras.
