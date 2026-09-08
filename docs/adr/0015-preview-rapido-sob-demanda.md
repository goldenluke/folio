# ADR 0015 — Preview rápido sob demanda, revisionado à parte do snapshot

**Status:** aceito · 2026-09-07

## Contexto

Desde P4, `workspace-sessions` já compila cada revisão e guarda o resultado em
`session.preview: { profileId, publication }` — a mesma Publication AST que
alimenta HTML e PDF (ver [ADR 0003](0003-backend-pdf.md)). `editor-core`
já projeta isso em `EditorSnapshot.preview`. Nada disso precisou ser
construído para P10: o gap inteiro estava na camada de protocolo do desktop,
que descartava `preview` ao montar `EditorSnapshotDto` — o P8/P9 nunca tinham
motivo para carregá-lo.

## Decisão

### Dois níveis, não um payload só

`EditorSnapshotDto` (o caminho de cada tecla) ganha só um marcador barato:
`previewRevision?`/`previewProfileId?`. O HTML em si vem por uma chamada
separada, `previewEditor({fileId})`, pedida sob demanda quando uma tab de
preview está realmente aberta. Mandar a Publication AST renderizada a cada
keystroke, mesmo para quem não está olhando o preview, violaria a regra de
projeções pequenas do protocolo (ver AGENTS.md).

### Onde o HTML é renderizado

Em `apps/desktop/src/workspace/` — o host do Workspace Service, não um
processo novo. `renderizarHtml(Publication AST): string` é uma função pura,
sem I/O, sem rede; não tem a característica (memória pesada, pode travar,
recurso exclusivo) que justificaria isolamento de processo (ver "Regra de
processo novo" em AGENTS.md). O precedente já existe: `apps/cli/src/pipeline.ts`
compõe `@abnt/compiler` e `@abnt/renderer-html` no mesmo processo há muito
tempo; o Workspace Service faz exatamente a mesma composição.

Uma regra nova no `dependency-cruiser`
(`workspace-desktop-nao-reimplementa-compilacao`) proíbe esse host de importar
`compiler`/`markdown`/`standards`/`semantics`/`bibliography` diretamente — ele
consome a Publication AST que a sessão já resolveu, nunca compila por conta
própria. Verificada contra violação deliberada antes de entrar.

### `DocumentSessionPreview` ganhou `revision`

`session.preview` é invalidado (`undefined`) na hora em que uma edição chega
— `replaceContent` zera `preview` no mesmo passo síncrono em que avança
`session.revision`. Hoje isso faz `session.preview.revision` e
`session.revision` colidirem sempre que `preview` existe. Mesmo assim,
`DocumentSessionPreview` ganhou um campo `revision` explícito em vez de o
desktop inferir de `session.revision`: se algum dia a sessão passar a manter
um preview visivelmente desatualizado enquanto recompila — troca razoável de
produto, não hipotética — inferir da revisão da sessão vira silenciosamente
incorreto sem que nenhum teste avise. Gravar o fato onde ele nasce é mais
barato que reconstruí-lo depois.

### Renderização: iframe sandboxed, nunca innerHTML

O preview usa `<iframe sandbox="" srcDoc={html}>`. Duas razões, não uma:

1. **Isolamento visual** — a Publication HTML carrega seu próprio `<style>`
   de paginação (`@page`, densidade tipográfica ABNT); deixá-lo vazar para
   fora do iframe brigaria com o Tailwind do shell.
2. **Defesa em profundidade** — `renderizarHtml` já escapa conteúdo do
   usuário (`urlSegura` recusa `javascript:`), mas `sandbox=""` garante que
   nenhum `<script>` executa mesmo que essa camada falhe. `contentDocument`
   do iframe fica inacessível ao pai (origem opaca) — confirmado na
   verificação manual, não é teórico.

O browser comum ignora a geometria de `@page` na mídia de tela. Sem uma
projeção explícita, o preview rápido colocava o conteúdo junto às bordas do
iframe mesmo quando o PDF tinha as margens físicas corretas. O modo
`renderizarHtml(doc, { preview: true })` acrescenta somente em `@media screen`
uma folha A4 e aplica os valores da mesma `PagePolicy` como `padding`; o caminho
de exportação continua usando o HTML padrão, portanto não recebe margem dupla.
Isso representa geometria e largura de leitura no modo rápido, sem fingir que
há paginação — que continua sendo responsabilidade do Paged.js.

### Armadilha real encontrada implementando isto

Adicionar um método de protocolo novo exige tocar **dois** lugares
independentes: a interface `DesktopWorkspaceService`/`WorkspaceMethod` em
`model.ts`, **e** o `z.enum([...])` de `requestEnvelopeSchema` em
`schemas.ts`. Esquecer o segundo não dá erro de tipo — dá um **hang
silencioso**: a mensagem falha `protocolEnvelopeSchema.safeParse` no lado que
recebe, é descartada (`if (!parsed.success) return;`), nenhuma resposta é
enviada, e a Promise do lado que pediu fica pendurada para sempre, sem
rejeitar. Foi exatamente o que aconteceu ao adicionar `editor/preview` — um
teste de integração real travou por 60s até isolar a causa com um script
standalone.

Não há como o compilador pegar isso: `ProtocolMethod` (tipo) e o `z.enum`
(validação em runtime) são duas fontes de verdade que o TypeScript não
consegue reconciliar sozinho. Ao adicionar um método de protocolo novo,
confira os dois na mesma revisão.

## Consequências

- Teste de integração (`tests/p10-preview.test.ts`) exercita o ciclo
  completo — abrir editor, pedir preview, editar, confirmar que o marcador de
  revisão cai, esperar a recompilação, confirmar que o HTML mudou — sobre
  `MessagePort` real, mesmo padrão do P8.
- `PreviewViewState` é uma tab sem controller: fecha sozinha, coexiste com uma
  tab de editor para o mesmo arquivo, e os painéis de outline/diagnóstico
  corretamente mostram "nenhum documento aberto" quando ela está ativa (eles
  são de `EditorViewState`, não de qualquer view).
- Verificado no Electron real: editar com a tab de preview aberta atualiza o
  HTML sozinho, sem o usuário pedir de novo. O preview de tela representa A4
  com margens 3/2/2/3 cm; o PDF correspondente foi medido e mantém esses mesmos
  limites físicos.

## Não decidido aqui

Paginação fiel (Paged.js) como segundo modo de preview, debounce explícito de
UI para recompilação (hoje depende só do guard de revisão já existente na
sessão), e isolamento de export PDF em processo próprio (`Export Worker`,
P14). Ver "Fast preview vs paged preview" e "Export Worker" no roadmap de
produto.
