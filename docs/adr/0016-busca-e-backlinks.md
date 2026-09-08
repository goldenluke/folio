# ADR 0016 — Busca full-text e backlinks reaproveitando o que já existia

**Status:** aceito · 2026-09-07

## Contexto

`workspace-index` já expõe `search()` (FTS5) e `links()` desde P3. O
`language-service` já resolve um link relativo contra o vault (função privada
`documentTarget`) desde P5, usada por `definition`/`references` para
navegação a partir do cursor. Como em P10, o trabalho não era construir
capacidade nova — era decidir onde a superfície de produto (protocolo do
desktop, painel de UI) se apoia no que já existe, sem duplicar regra.

## Decisão

### Backlinks reaproveita a resolução de link existente, não reimplementa

`LanguageService` ganhou `backlinks(fileId)`, mas a implementação chama a
mesma função `documentTarget` que `definition`/`references` já usam — só
filtra pelo caminho absoluto do arquivo consultado em vez de por uma posição
de cursor. Colocar isso em `apps/desktop` (como fiz para o HTML do P10)
teria criado uma segunda implementação de "como resolver um link relativo",
e as duas divergiriam no primeiro caso de borda (`../`, âncora, link
externo). `backlinks` é um conceito de linguagem/navegação — a mesma
categoria de `definition`/`references` — não um cálculo de apresentação como
HTML era.

Lança `WorkspaceFileNotFoundError` para um `fileId` que não existe, igual a
`outline`/`diagnostics`/`definition` (que herdam isso de `storage.read`
falhar). A primeira versão devolvia `[]` silenciosamente; um teste de
integração pedindo backlinks de um arquivo inexistente esperava `NOT_FOUND` e
falhou, o que expôs a inconsistência antes de virar comportamento público.

### Busca só vê o índice persistido

`search()` no desktop chama `SqliteWorkspaceIndex.search()` diretamente, sem
combinar com sessões abertas não salvas — mesma limitação que o índice já
tinha antes do desktop existir (rebuild vem do vault, não de rascunho em
memória). Editar um documento e buscar por um termo novo antes de salvar não
encontra nada até salvar; é um limite conhecido, não um bug, e documentado
aqui para não ser "descoberto" de novo.

### Painel de Backlinks precisa buscar dado que a sessão não carrega

Diferente de Sumário/Diagnósticos (leem direto de `EditorSnapshot`, síncrono),
Backlinks precisa de uma chamada assíncrona por documento ativo. Isso exigiu
mudar como painéis são invocados: `PanelDefinition.render` deixou de ser
chamado como função pura (`panel.render({view})`) e passou a ser invocado via
JSX (`<activePanel.render view={...} openDocument={...} />`), para que
`useState`/`useEffect` dentro do painel sigam as Regras de Hooks do React.
Sumário e Diagnósticos continuam funcionando sem mudança — a diferença é
invisível para eles.

`render` também ganhou `openDocument(fileId, path)` nos props: clicar num
backlink abre o documento de origem, mesma indireção que
`document.open` já usa no explorer.

### Snippet do FTS5 não é HTML seguro

`snippet(document_fts, ...)` insere `<mark>`/`</mark>` literal ao redor do
termo encontrado, mas o resto do texto é conteúdo cru do vault — não passa
por `escaparHtml`. Renderizar isso com `dangerouslySetInnerHTML` seria um
vetor de auto-XSS trivial (Markdown pode conter HTML bruto). O renderer
divide a string nos marcadores e devolve cada pedaço como filho de string do
React — que escapa automaticamente — em vez de injetar HTML.

## Consequências

- Teste em `tests/p5-language-service.test.ts` prova que `backlinks`
  reaproveita a MESMA resolução que `references` já usava, sobre a fixture
  existente (`artigo.md` → `notas.md`).
- Teste de integração (`tests/p11-search-backlinks.test.ts`) exercita busca e
  backlinks sobre `MessagePort` real, incluindo o caso de erro
  (`NOT_FOUND` para arquivo inexistente).
- Verificado manualmente no browser: busca com destaque, clique abrindo
  documento, painel de Backlinks re-buscando ao trocar de documento ativo.

## Não decidido aqui

Busca estruturada (`cites:`, `has:figure`, `linksto:`) e o Query AST que a
sustentaria — a API atual (`{query, limit}`) não impede evoluir para isso,
mas não foi construída ainda. Grafo (nodes/edges sobre documentos, referências
e recursos) é a peça mais visual do P11 e fica para uma fatia própria,
seguindo "graph view não é o grafo" do roteiro de produto.
