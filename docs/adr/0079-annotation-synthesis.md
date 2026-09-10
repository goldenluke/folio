# ADR 0079 — Annotation Synthesis

## Contexto

F36.4 já ligava uma anotação de PDF a uma literature note, mas com três
limites: uma anotação por vez, sempre para a nota auto-criada da MESMA
referência, e por escrita direta de arquivo (`storage.write`) — se a nota
estivesse aberta numa aba, a aba não via a mudança pelo canal normal.
Onda BL (F468–F475) precisa de síntese: várias anotações, de várias
referências, numa nota escolhida pelo usuário.

## Decisão

`@abnt/annotation-synthesis` é o pacote puro: `synthesizeAnnotations()` gera
markdown a partir de uma lista de anotações e um template
(`quote-list`/`grouped-by-source`/`grouped-by-color`). Cada bloco carrega um
marcador de idempotência (`<!-- folio-pdf-annotation:ID -->`, mesma
convenção de F36.4) e uma citação real `[@referenceId, p. N]` — não um link
inventado. Isso resolve backlink e contexto de citação (F48) de graça: a nota
sintetizada passa a citar de verdade, então aparece em Citation Explorer e em
qualquer busca por `cites:` sem nenhum mecanismo adicional. Cor é campo
opcional em `PdfAnnotation`; seu significado (`createColorSemantics`/
`parseColorSemantics`, mapa cor→rótulo validado) é preferência do usuário,
nunca fixa no produto — uma cor sem rótulo é rejeitada na escrita e
descartada na leitura defensiva.

A inserção de verdade (`DesktopWorkspaceServiceHost.#insertAnnotationsIntoTarget`)
usa o mesmo padrão de "abrir sessão se preciso, closar só se foi quem abriu"
que `projectDashboard()` (F105) já usa para outro propósito: `editors.open()`/
`editors.controller()`, `controller.dispatch({edits:[...]})` para a
EditorTransaction de verdade, `controller.save()` para persistir, e
`editors.close()` só quando a sessão não estava aberta antes. Se o
documento-alvo já estiver aberto numa aba, ela recebe a mudança pelo canal
normal de snapshot — não existe escrita por fora da sessão. Alvo é
`{kind:'reference'}` (reaproveita `#ensureLiteratureNote` de F34) ou
`{kind:'file'}` (qualquer documento existente, ex.: o documento ativo no
editor).

`linkPdfAnnotation` (F36.4) foi mantido byte-a-byte — mesmo formato antigo
("### PDF, p. N"), mesma escrita direta de arquivo. Não foi migrado para o
mecanismo novo: o formato de saída mudaria (citação real em vez de heading)
e regrediria o teste existente (`tests/f36-pdf-reader.test.ts` verifica a
substring "PDF, p. 2"). A síntese da Onda BL é aditiva, uma segunda
capacidade ao lado da primeira, não uma substituição.

## Consequências

Duas anotações da mesma referência inseridas por vias diferentes
(`linkPdfAnnotation` antigo e `synthesizeAnnotations` novo) produzem formatos
de bloco diferentes na mesma nota — aceito deliberadamente para não regredir
o fluxo publicado. `annotation-color-semantics` participa do
`SyncEngine` como as demais entradas `portable-operational`; a paleta de
cores em si é fixa no cliente (5 cores), só o rótulo é configurável — uma
paleta livre (color picker completo) ficou fora de propósito por agora.
