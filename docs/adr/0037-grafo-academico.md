# ADR 0037 — Grafo acadêmico: pessoas a partir do catálogo que o Citation Explorer já constrói

**Status:** aceito · 2026-09-08

## Contexto

O F5 (ADR 0034) entregou nodes/edges de documentos, referências e recursos.
O roteiro de produto quer também `reference --authored-by--> person` — mas
isso exige `BibliographicEntity.author`/`.editor`, que só existe depois de
resolver bibliografia, e resolver bibliografia do vault inteiro é exatamente o
que o F31 (ADR 0035) já foi obrigado a construir (`#resolveVaultBibliography`).
Daí a ordem de dependência real: F33 depende de F31, não só de F5.

## Decisão

### Nenhuma indexação nova — só threading do catálogo existente

`buildWorkspaceGraph` (`@abnt/workspace-graph`) já aceitava um campo opcional
`bibliography: ReadonlyMap<string, {entity, sourceFileId?}>` desde a ADR 0034
(decisão antecipada para não exigir migrar chamadas existentes depois). Esta
ADR é o que finalmente alimenta esse campo: para cada entrada do catálogo, um
nó `person:{slug}` por `author`/`editor` (usa `editor` só quando não há `author`,
p.ex. coletâneas) e uma aresta `authored-by` de `reference:{id}`.
`paper --embeds--> figure`, `paper --links-to--> note` e `paper --cites-->
reference` já vinham de graça do F5 — nenhuma indexação nova para nenhum dos
quatro tipos de aresta do roteiro original.

### `VaultBibliographyEntry` guarda a entidade crua ao lado do DTO formatado

`DesktopWorkspaceServiceHost#resolveVaultBibliography()` (ADR 0035) retornava
só `WorkspaceReferenceDto` — formatado para exibição, sem a estrutura de
`author`/`editor` que o grafo precisa. Refatorado para devolver
`Map<string, {dto, entity, sourceFileId?}>`: `citationExplorer()` (F31)
continua consumindo só `.dto`; `graph()` (F33) consome `.entity`
(`BibliographicEntity` reconstruído com `asReferenceId(id)`, já que o Registry
indexado pelo id omite o campo `id` dentro de cada entrada). Nenhuma segunda
resolução de bibliografia — o mesmo catálogo serve os dois consumidores.

### Slug de pessoa: normalização determinística, sem depender de um id externo

`personSlug` em `packages/workspace-graph/src/build.ts` monta o slug a partir
de `given`/`family`/`literal` (`CslName`), remove diacríticos
(`normalize('NFKD')` + faixa Unicode de combining marks) e caracteres não
alfanuméricos — duas citações do mesmo autor em `.bib`s diferentes, mesmo com
grafia levemente distinta de acentuação, convergem para o mesmo nó `person`
enquanto given+family coincidirem.

### `includePeople` é opt-in no protocolo, não o comportamento padrão

`WorkspaceGraphRequest.includePeople?: boolean` — quando ausente ou `false`,
`graph()` nem chama `#resolveVaultBibliography()`, evitando o custo de abrir
sessões de editor para vaults que só querem o grafo de documentos/links. A UI
(`GraphDialog`) expõe isso como uma checkbox "Incluir pessoas" que refaz a
consulta.

## Consequências

- `tests/f33-graph-academic.test.ts`: dois testes unitários de
  `buildWorkspaceGraph` (com e sem `bibliography`, confirmando que o F5 v1
  continua funcionando sem o campo novo) e um teste de integração
  `workspace/graph` com `includePeople: true`/`false` sobre `MessagePort`
  real, verificando que o nó `person` só aparece quando pedido.
- Fecha a Onda B: as seis fatias (F4, F5, F31, F32, F33, F34) reaproveitam a
  mesma base de projeções (`WorkspaceIndex`) e o mesmo pipeline de
  bibliografia (P12), sem nenhuma nova fonte de verdade sobre o vault.

## Não decidido aqui

Nó `organization` (afiliação institucional) — o roteiro original menciona
`WorkspaceNodeKind` incluindo `organization`, mas nenhuma entrada de
`BibliographicEntity` hoje carrega essa informação estruturada; fica para
quando o modelo bibliográfico ganhar esse campo. Desambiguação de pessoas com
nomes muito parecidos mas que não são a mesma pessoa (o slug atual assume que
coincidência de given+family é a mesma pessoa).
