# ADR 0035 — Citation Explorer: catálogo bibliográfico vault-wide sob demanda

**Status:** aceito · 2026-09-08

## Contexto

`index.citations()` sem `fileId` já devolve todas as citações do vault com
`referenceId`, `fileId`, `path`, `sourceStart` — agrupar por `referenceId` dá
contagem e localização de graça. O que faltava era saber, para o vault
inteiro, quais referências existem e como estão formatadas — inclusive as
nunca citadas. O ADR 0017 (P12) resolveu bibliografia só para o documento com
**sessão de editor aberta**; não existia (nem existe hoje, fora desta ADR) um
catálogo agregado do vault inteiro.

## Decisão

### Pré-filtro por frontmatter, nunca `@abnt/markdown`

`apps/desktop/src/workspace/frontmatter-scan.ts` exporta
`scanBibliographyDeclarations(storage, files)`: regex `^---\n(...)\n---` +
`parse` do pacote `yaml` (mesma biblioteca que
`apps/desktop/src/renderer/shell/frontmatter.ts` já usa no renderer para o
Metadata Editor, aqui replicada no host porque o renderer não pode fazer
`storage.read()` em lote). Decide só "este arquivo declara `bibliography:`
não vazio" — não resolve nada, não é compilação. `bibliography:` pode ser
string ou lista; ambos os casos são cobertos.

### Resolução real reaproveita o pipeline de compilação existente, em lote

`DesktopWorkspaceServiceHost#resolveVaultBibliography()`: para cada arquivo do
subconjunto filtrado, abre uma sessão de editor (`EditorWorkspaceService.open`,
a mesma chamada que `openEditor()` já usa) se ainda não estiver aberta, espera
a compilação assentar, lê `controller.snapshot().bibliography`, e fecha a
sessão de volta **só se foi este método que abriu** — sessões que o usuário já
tinha abertas continuam abertas. Isso reaproveita 100% do pipeline P12; nenhuma
segunda importação de `.bib`.

O ponto que exigiu investigação: `DocumentSessionsService.open()` dispara
`autoCompile` como fire-and-forget (`void this.compile(fileId)`), então ler
`snapshot().bibliography` logo após abrir a sessão é uma corrida — o `.bib`
pode não ter resolvido ainda. A sessão já expõe `sessions.idle(fileId)`, que
aguarda `session.active?.promise` da compilação em andamento; chamar isso
logo após `editors.open()` resolve a corrida sem polling (ao contrário do
padrão `waitForReferences` usado nos testes de P12, que existe porque o teste
não tem acesso a `sessions` diretamente — o host tem).

### `#referenceDtoFrom` extraído de `references()`, reaproveitado pelo catálogo

A formatação ABNT (`formatarReferenciaAbnt`/`referenciaComoTexto`) e a
resolução de `sourceFileId`/`sourceLabel` que `references()` (P12) já fazia
por documento viraram um método privado único
(`#referenceDtoFrom`), chamado tanto por `references()` quanto pelo catálogo
vault-wide — nenhuma segunda regra de formatação.

### `citationExplorer()` agrupa citações e localiza por seção via `index.headings()`

Para cada grupo de citações da mesma referência, a seção que contém a citação
é a última heading do mesmo arquivo com `sourceStart <= citation.sourceStart`
— nenhuma indexação nova, só uma busca sobre `index.headings(fileId)` já
existente. `uncited` é o catálogo inteiro menos as referências que aparecem em
`index.citations()` — reaproveita o mesmo catálogo, sem segunda resolução.

## Consequências

- `tests/f31-citation-explorer.test.ts`: dois documentos citando a mesma
  referência de um `.bib` compartilhado (contagem 2, seção correta em cada
  local) e uma referência nunca citada aparecendo em `uncited`; valida também
  que nenhuma sessão fica aberta como efeito colateral da chamada
  (`editorSnapshot` de um arquivo que ninguém abriu explicitamente retorna
  `NOT_FOUND`).
- Painel novo `citationExplorerPanel`
  (`apps/desktop/src/renderer/shell/panel-views.tsx`) — não depende de `view`
  (a diferença de Backlinks/Referências, que são por documento): é vault-wide
  por natureza, busca uma vez ao montar.

## Não decidido aqui

Cache do catálogo por revisão de arquivo (hoje recalcula do zero a cada
abertura do painel — aceitável para o tamanho de vault atual, mas o primeiro
ponto a otimizar se ficar perceptível). Ordenação/filtro do Citation Explorer
na UI. O catálogo bruto (`BibliographicEntity`, não só o DTO formatado) também
alimenta o grafo acadêmico — ver ADR 0037.
