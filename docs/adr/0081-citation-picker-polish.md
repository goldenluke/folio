# ADR 0081 — Citation Picker Polish: sem round-trip pelo Compiler Service

## Contexto

Onda BP (F505–F507) pede três polimentos sobre o picker de citação
(`CitationDialog`, ADR 0029) e o motor de citações existente: ranking por
documento/projeto, prévia de contexto e um parser de locator inline. A
leitura óbvia para a prévia (F506) seria invocar o motor de verdade
(`motorAutorDataAbnt`, `@abnt/standards`) com o `CitationNode` do rascunho.
Isso esbarra num invariante que já existia, mas que esta onda foi a
primeira a testar: `.dependency-cruiser.cjs` proíbe (`severity: 'error'`)
tanto `apps/desktop/src/workspace/*` quanto `apps/desktop/src/renderer/*`
de importar `@abnt/markdown`, `@abnt/standards`, `@abnt/semantics` ou
`@abnt/compiler` diretamente — regras `workspace-desktop-nao-reimplementa-
compilacao` e `renderer-desktop-nao-alcanca-o-sistema`. Compilação inteira
(parse, semântica, normas) fica isolada no Compiler Service (ADR 0015/0017,
P8); o host do workspace só fala com ele através da interface abstrata
`CompilerService` (`@abnt/protocol`), nunca importando o pacote real.

Rodar a prévia através de um compile completo (sintetizar um documento com
a citação anexada, `prepare`+`compile`, extrair o texto renderizado da
Publication AST) resolveria isso com pureza arquitetural total, mas é
desproporcional para uma prévia dentro de um picker — e ainda exigiria
inventar contexto (frontmatter sintético, ambiente de compilação) só para
formatar uma citação.

## Decisão

`@abnt/bibliography` já é a exceção documentada: é importável tanto pelo
host do workspace quanto por `@abnt/standards` (que a usa internamente para
`autorDaChamada`/`autorDaChamadaParentetica`/`anoDaReferencia` —
exatamente os blocos que `motorAutorDataAbnt` compõe). O host já a importa
para `formatarReferenciaAbnt`/`referenciaComoTexto`. Cada `WorkspaceReferenceDto`
(`references()`, F31) ganhou três campos calculados com essas mesmas
funções: `narrativeAuthor`, `parentheticalAuthor`, `year`. O renderer compõe
a prévia no cliente, com uma nova função pura em `citation-source.ts`
(`citationPreviewText`) que espelha a composição de `itemAutorData`
(`@abnt/standards`) — mesma forma "autor (ano, locator)" — mas sem resolver
sufixo de ano (2020a/2020b), porque isso exige o documento inteiro
resolvido, que só o Compiler Service tem. A prévia é rotulada
"aproximada" na UI; o texto que entra no documento nunca vem daqui — vem de
`citationSource(draft)`, que já existia e continua sendo a fonte real da
inserção.

Locator (F507) seguiu o precedente já estabelecido por `editableCitationAt`
(a própria ADR 0029 documenta essa separação: "a interpretação acadêmica
segue no language-service/compilador depois da edição" — o renderer já
mantém seu próprio reconhecedor leve de `p.`/`cap.`/`seção`/etc. para reabrir
uma citação existente, exatamente por não poder importar o parser real de
`@abnt/markdown`). A tabela de abreviações que já vivia embutida dentro de
`editableCitationAt.parseItem` foi extraída para `parseLocatorSuffix`,
exportada, e reaproveitada por um novo campo de "adição rápida" no picker
(`chave, p. 12` num campo só) — sem duplicar uma terceira vez, só
compartilhando a cópia que já existia no lado do renderer.

Ranking (F505) não tocou nenhuma fronteira: `citationCount` em
`WorkspaceReferenceDto` é `#requireIndex().citations(fileId)` agregado por
`referenceId`, escopado ao documento aberto (0 nos demais consumidores da
mesma DTO, como `citationExplorer`, que já calculam sua própria contagem
vault-wide separadamente). "Projeto" é só leitura de
`readResearchProjects(workspaceId)` já existente (F103, `localStorage`),
filtrando por `documentIds` — nenhum estado novo.

## Consequências

A prévia pode divergir do texto final da compilação em dois casos raros:
sufixo de ano (duas referências do mesmo autor no mesmo ano) e citação em
sistema numérico (a prévia sempre usa a forma autor-data, já que é o
sistema dominante nos profiles deste produto). Ambos os casos são só uma
prévia incorreta, nunca uma escrita incorreta — a fonte da verdade continua
sendo a compilação real, e a UI rotula a prévia como aproximada. Se um
profile numérico ganhar peso no produto, a prévia precisará de uma segunda
composição (`itemNumerico`-like) no mesmo arquivo, não uma reabertura desta
decisão. `parseLocatorSuffix` e o reconhecedor de `editableCitationAt`
continuam sendo uma cópia deliberada do parser real de `@abnt/markdown`
(pré-existente a esta onda) — qualquer novo tipo de locator adicionado à
gramática canônica (`interpretarLocalizador`) precisa ser replicado à mão
aqui também; não há teste cruzado que force sincronia entre os dois.
