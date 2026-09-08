# ADR 0033 — Busca estruturada: Query AST/Planner sobre o índice existente

**Status:** aceito · 2026-09-08

## Contexto

O P11 (ADR 0016) já entregou busca full-text e deixou explicitamente para uma
"fatia própria" a sintaxe estruturada (`cites:`, `has:figure`, `linksto:`) e o
Query AST que a sustentaria — sem construí-los. `WorkspaceIndex` já expunha
`search()` (FTS5), `links()`, `citations()` e `resources()` desde o P3;
faltava decidir onde a sintaxe textual vira predicado sobre esses dados, sem
montar SQL na UI nem duplicar a resolução de link relativo que
`definition`/`references`/`backlinks` já usam.

## Decisão

### Query AST/Planner vive em `@abnt/language-service`, não em pacote novo

`packages/language-service/src/query.ts` exporta `parseStructuredQuery` e
`executeStructuredQuery`. A fronteira já existente
(`language-service-so-consome-fontes-e-projecoes` no
`.dependency-cruiser.cjs`) permite `language-service → workspace-index,
workspace-core` — exatamente o que o planner precisa. Mesma lógica do ADR
0016: um pacote novo só se justificaria se CLI/LSP precisassem de busca
estruturada fora do desktop, o que não é o caso agora.

### AST v1: só conjunção implícita

```ts
export type QueryTerm =
  | { readonly kind: 'text'; readonly value: string }
  | { readonly kind: 'cites'; readonly referenceId: string }
  | { readonly kind: 'has'; readonly feature: 'figure' | 'table' | 'citation' }
  | { readonly kind: 'linksto'; readonly target: string }
  | { readonly kind: 'type'; readonly value: string };
```

Sem OR, NOT ou parênteses — o suficiente para `has:figure cites:@silva2024`
(AND implícito por espaço). Prefixo desconhecido (`foo:bar`) cai em termo de
texto livre, a mesma filosofia defensiva que `WorkspaceIndex.search()` já usa
para sintaxe FTS inválida (engolir, não rejeitar a consulta do usuário).

### Planner: termos estruturados reduzem um `Set<WorkspaceFileId>`, texto livre vai para o FTS5

Cada termo estruturado interseta o conjunto candidato; o termo `text`
acumulado vai para `index.search()`, que já faz ranking via `bm25()` —
reimplementar ranking no planner duplicaria o que o SQLite já calcula.
`linksto:` resolve o alvo contra título/path (`WorkspaceIndex.documentTitles()`,
novo método desta ADR) e depois filtra `index.links()` via `documentTarget`,
**a mesma função de `@abnt/language-service`** que `definition`/`references`/
`backlinks` já usam — nunca uma segunda resolução de link relativo.

### `has:figure`/`has:table` exigiram schema novo

Nem todo predicado tinha índice pronto: `resources()` cobre recursos
registrados via `registrarRecurso` (majoritariamente figuras, por coincidência
de implementação, não por contrato), e nenhuma tabela sabia "este arquivo tem
uma tabela". Migração `version: 2` do `WorkspaceIndex`
(`packages/workspace-index/src/migrations.ts`) adiciona `indexed_blocks`
(`file_id, node_id, kind, source_start, source_end`), populada no mesmo
`#insertStructure` que já povoa headings/links/citations/resources —
`WORKSPACE_INDEX_SCHEMA_VERSION` sobe para 2, migração aditiva, `rebuild()`
recompõe do zero como já acontece hoje. `has:citation` não precisou disso: é
só `citations(fileId).length > 0`.

### `citations()` ganhou filtro opcional por `referenceId`

`WorkspaceIndex.citations(fileId?, referenceId?)` — parâmetro novo,
compatível-para-trás, empurra `WHERE reference_id = ?` para o SQL usando o
índice `indexed_citations_reference` que já existia, em vez de puxar todas as
citações do vault para JS e filtrar com `.filter()`.

### Fronteira do desktop não muda

`DesktopWorkspaceServiceHost#search()` passou a chamar `parseStructuredQuery`
+ `executeStructuredQuery` sempre — a sintaxe livre já é um `QueryAst` de um
único termo `text`, então nada quebra. A UI **continua chamando
`workspace.search({query, limit})`**: nenhum DTO novo, nenhum protocolo novo.
O renderer nunca vê o AST nem monta SQL.

## Consequências

- `tests/f4-structured-search.test.ts`: `has:figure`, `has:table`,
  `has:citation`, `cites:@id`, `linksto:`, `type:markdown`, combinação AND, e
  sintaxe malformada não quebrando a consulta — tudo sobre `MessagePort` real.
- `docs/adr/0016` permanece a referência para por que backlinks/busca
  reaproveitam `documentTarget`; esta ADR estende o mesmo princípio para busca
  estruturada.

## Não decidido aqui

OR/NOT/parênteses no Query AST, e uma UI dedicada de busca estruturada (hoje é
só a mesma caixa de busca da Quick Open aceitando a sintaxe). Grafo do
workspace fica para a ADR 0034.
