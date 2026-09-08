# ADR 0034 — Workspace Graph: projeção pura sobre índice + bibliografia

**Status:** aceito · 2026-09-08

## Contexto

O ADR 0016 (P11) também reservou o grafo (nodes/edges de documentos,
referências e recursos) como "a peça mais visual do P11", deixada para uma
fatia própria. Diferente da busca estruturada (ADR 0033), o grafo cresce em
outra direção no F33 (pessoas/organizações a partir de bibliografia) — isso
pesou na escolha de onde ele vive.

## Decisão

### Pacote novo `@abnt/workspace-graph`, não dentro de `workspace-index`

`workspace-index-so-projeta-o-vault` (`.dependency-cruiser.cjs`) proíbe
`workspace-index` de importar qualquer coisa além de `workspace-core`,
`document-model`, `markdown` — não pode importar `language-service` (para
`documentTarget`) nem bibliografia. Forçar o grafo para dentro do índice exigiria
furar essa fronteira estreita. Um pacote novo mantém `workspace-index` fiel ao
seu papel e dá espaço para o F33 crescer sem mais uma exceção. Nova regra
simétrica à de `workspace-environment`:

```js
{
  name: 'workspace-graph-e-projecao-pura',
  from: { path: `^${pkg('workspace-graph')}` },
  to: { path: `^${anyPkgExcept('workspace-graph', 'workspace-core', 'document-model', 'language-service', 'workspace-index')}` },
}
```

### Builder puro e síncrono, zero I/O

`packages/workspace-graph/src/build.ts` exporta `buildWorkspaceGraph(sources)`
onde `sources` são projeções que o host **já buscou**
(`storage.list()` + `index.links()/citations()/resources()`) — testável com
`vitest` puro, sem SQLite nem MessagePort (ver os dois primeiros testes de
`tests/f5-workspace-graph.test.ts`). `links-to` resolve via `documentTarget`
de `@abnt/language-service` — a MESMA função que `definition`/`references`/
`backlinks` e a busca estruturada (ADR 0033) já usam. `cites` cria um nó
`reference:{id}` mesmo sem bibliografia resolvida (`resolved: false`), para não
perder a aresta quando a referência não resolve.

`bibliography` é um campo opcional de `WorkspaceGraphSources` desde o
primeiro commit deste pacote — não porque F33 já estivesse decidido aqui, mas
porque adicionar o campo depois exigiria migrar toda chamada existente; vazio
por padrão não muda o comportamento do F5 v1.

### Grafo sempre derivado on-the-fly, nunca materializado em SQLite

`DesktopWorkspaceServiceHost#graph()` chama `storage.list()` +
`index.links()/citations()/resources()` (já carregados em memória pelo
`better-sqlite3`) e `buildWorkspaceGraph(...)` a cada chamada. Para o tamanho
de vault que o produto atende hoje, reconstruir por chamada é mais simples que
manter uma tabela de grafo sincronizada — e evita uma segunda fonte de verdade
sobre os mesmos dados que `links()/citations()/resources()` já são. Se um
vault muito grande tornar isso perceptível, um cache em memória invalidado por
evento de workspace é a próxima opção, não uma tabela SQLite nova.

### UI: dialog overlay com layout circular escrito à mão, sem dependência nova

Em vez de um novo tipo de `ViewState` (mudança grande no shell), o grafo é um
dialog (`GraphDialog` em `apps/desktop/src/renderer/app.tsx`), mesmo padrão já
usado por Diagnostics Center (F26) e Metadata Editor (F24) — menor superfície
de mudança que criar uma aba nova. Layout: posição circular determinística por
índice do nó, sem `d3-force`/`cytoscape` — coerente com o padrão do projeto de
não trazer biblioteca pesada para o que cabe em ~40 linhas de código próprio
(motor de citação, renderer PDF e editor de frontmatter também são próprios).
Clicar num nó `document` abre o arquivo; a legenda mostra a cor de cada `kind`.

## Consequências

- `tests/f5-workspace-graph.test.ts`: unitário puro de `buildWorkspaceGraph`
  (nodes/edges corretos, link para arquivo inexistente não gera aresta órfã) +
  integração `workspace/graph` sobre `MessagePort` real.
- Achado durante a integração: o método `'workspace/graph'` precisou ser
  adicionado em **dois** lugares no protocolo — o union `WorkspaceMethod` E o
  `z.enum([...])` de `requestEnvelopeSchema` em `packages/protocol/src/schemas.ts`.
  Esquecer o segundo faz a requisição ser descartada silenciosamente por
  `protocolEnvelopeSchema.safeParse` (sem erro, sem resposta — parece um hang
  no cliente). Registrado aqui para a próxima ADR que adicionar um método não
  repetir a mesma investigação.

## Não decidido aqui

Nós `person`/`organization` e aresta `authored-by` — isso é a ADR 0037 (F33).
Grafo com tags, filtro por tipo de nó na UI, e uma library de layout mais
sofisticada se o hand-rolled circular não escalar visualmente para vaults
grandes.
