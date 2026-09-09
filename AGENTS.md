# abnt — compilador de documentos acadêmicos

Markdown como linguagem de autoria; ABNT como camada de regras sobre um modelo
semântico genérico. Produto comercial. 100% TypeScript.

**Estado: M5 + P0–P22 + Ondas A–N concluídas, Onda O concluída no nível de
produto/host (F66–F70); UI do desktop para elas — Problems clicável
cross-file, diff estrutural na tela — ainda não; Ondas P concluída (F71–F75) e
Q concluída em F76/F77/F79–F82 (F78 opcional adiado); Onda R concluída
(F83–F89)** — artigo ABNT, segundo profile `web-article`,
TCC com elementos pré/pós-textuais, regressão visual PDF/PNG, compiler
headless, vault local-first, índice SQLite/FTS5 descartável, shell desktop
Electron multiprocesso, shell de produto (command registry, tabs, painéis),
preview rápido revisionado, busca/backlinks, reference manager, um servidor
Language Server Protocol (`apps/lsp`) sobre a mesma language-service do
desktop, exportação PDF/DOCX isolada num processo próprio (Export Service), e
um plugin host isolado para regras de lint de terceiros (`abnt lint
--plugin`) e resolução explícita de conflitos provocados por alteração externa
do vault, artefatos de distribuição `dist`, matriz nativa Linux x64, package
Electron `linux-unpacked` e instalador Debian `.deb`. Roadmap em [docs/ROADMAP.md](docs/ROADMAP.md).

## O pipeline

```
Markdown → Document AST → ResolvedDocument → Publication AST → HTML → PDF
           (semântica)     (+ anotações)      (+ apresentação)         (Paged.js
                                                                     + Chromium)
```

Cada seta é uma fronteira de package fiscalizada em CI. Um package por etapa:
`markdown` → `document-model` → `semantics` → `publication` → `renderer-html`.
`standards` fica de fora da cadeia: ele *implementa* `PublicationProfile` e
fornece regras de validação. `@abnt/compiler` é a composição headless:
`SourceSnapshot → prepare → CompilationEnvironment → compile`. `apps/cli` é
somente o host local de filesystem, HTML e PDF.

## Invariantes — não quebre sem ler o ADR correspondente

1. **`document-model` não importa nada do workspace e não conhece norma alguma.**
   Nem a string "abnt". Ele descreve o que o documento *é*, nunca como aparece.
2. **Dado derivado não entra na AST.** Número de seção, citação formatada,
   legenda numerada — tudo vive no `AnnotationStore`, fora da árvore. É o que
   permite publicar a mesma AST sob duas normas. Há teste que falha se violado.
3. **Renderers só veem Publication AST.** Um renderer que consulta a norma está
   reimplementando a norma, e as duas cópias divergem.
4. **Nenhuma dependência copyleft forte em runtime.** Ver o ponto sobre citações
   abaixo — não é teórico.
5. **Não copie texto normativo da ABNT para o repositório.** Codifique a regra e
   cite a cláusula por número. Ver [docs/ABNT.md](docs/ABNT.md).

Os itens 1, 3 e 4 são verificados por `pnpm check`. O item 2 tem teste em
`tests/golden.test.ts`. O item 5 depende de você.

## Armadilha: citações

O caminho óbvio para processar citações é `citeproc-js`. **Não instale.** É
CPAL-1.0/AGPL-1.0, com cláusula de deployment em rede — incompatível com o
modelo comercial. `citeproc-rs` (o substituto da Zotero) foi **arquivado em
13/08/2026**, incompleto. Não existe processador CSL viável em JS para produto
fechado.

Portanto: motor de citação ABNT próprio, implementado no M2. Viável porque precisamos de *uma*
família de estilos, não das 10.000 do CSL. Adotamos o **schema** CSL-JSON como
modelo de dados (interop Zotero/Mendeley/Crossref) sem depender de processador.

`pnpm check:licenses` quebra o build se alguém instalar citeproc. Já testado.

### Dependência dual-licenciada (`MIT OR GPL-...`) não é exceção automática

O gate trata qualquer licença contendo `GPL-3.0`/`GPL-2.0` como proibida por
padrão, mesmo dentro de uma expressão de escolha como
`(MIT OR GPL-3.0-or-later)` — o script não interpreta "OR" como escolha, só
casa a string inteira contra as regras. Isso é correto na maioria dos casos
(a maior parte do que aparece assim é projeto que virou copyleft e mantém MIT
só por compatibilidade histórica), mas `jszip` é o oposto: dual-license
**deliberado** do autor, oferecido como escolha real. `@abnt/renderer-docx`
(P14) depende de `docx`, que depende de `jszip` — registrado em `EXCECOES`
(`scripts/check-licenses.mjs`) com a justificativa, só depois de **perguntar
ao usuário**, não decidir sozinho. Isso não é burocracia: o comentário no
topo do próprio script existe porque alguém — humano ou LLM — vai tentar
resolver esse tipo de bloqueio por reflexo. Uma licença dual-licenciada de
propósito é uma das poucas exceções legítimas a `EXCECOES`, mas a decisão é
do usuário, não do agente. Ver [ADR 0019](docs/adr/0019-export-pdf-docx.md).
Detalhes em [docs/adr/0002](docs/adr/0002-motor-de-citacao-proprio.md).

## Armadilha: inferência de tipo do Zod na fronteira

Não escreva `schema: z.ZodType<T>` num parâmetro genérico. Inferir `T` a partir
dele faz o TypeScript instanciar os internals do Zod 4 sobre a forma inteira do
DTO. Com os schemas grandes do editor isso chegou a **33 milhões de
instanciações e 10,5 GB**: `pnpm typecheck` morria com `exit 134` *antes* de
reportar qualquer erro, escondendo 24 erros de tipo reais no `apps/desktop`.

Use `DtoSchema<T>` (`@abnt/protocol`), que expõe só `safeParse`. O repositório
inteiro passou a checar em ~1 s com 189 mil instanciações. Pelo mesmo motivo o
envelope em `validarResultadoDoProtocolo` é estático: compor o schema do payload
num `z.union` por chamada repetia a instanciação em cada call site.

Se `pnpm typecheck` ficar lento ou estourar heap, meça antes de aumentar
`--max-old-space-size`:

```bash
pnpm exec tsc -p tsconfig.json --extendedDiagnostics   # Instantiations
pnpm exec tsc -p tsconfig.json --generateTrace /tmp/trace
```

Um número na casa dos milhões é bug de tipo, não falta de memória.

## Armadilha: método de protocolo novo trava em silêncio

Adicionar um método a `DesktopWorkspaceService` (`model.ts`) não é o passo
inteiro. `requestEnvelopeSchema` em `schemas.ts` valida `method` contra um
`z.enum([...])` escrito à mão — uma segunda lista, independente da primeira,
que o TypeScript não reconcilia sozinho. Esquecer de adicionar o método novo
nesse enum não dá erro de compilação: dá um **hang silencioso**. A mensagem
falha `protocolEnvelopeSchema.safeParse` no lado que recebe, é descartada
(`if (!parsed.success) return;`), nenhuma resposta é enviada, e a Promise de
quem pediu fica pendurada para sempre — sem rejeitar, sem lançar, sem log.

Foi exatamente o que aconteceu implementando `editor/preview` no P10: um
teste de integração travou por 60s até isolar a causa com um script
standalone chamando o protocolo passo a passo. Ao adicionar um método novo,
atualize os dois lugares na mesma revisão: a interface em `model.ts` **e** o
enum em `schemas.ts`. Se um teste de protocolo travar sem erro, esse enum é o
primeiro lugar a checar.

## Armadilha: `MessagePortMain` entrega `MessageEvent`, não o DTO direto

Os transports de `@abnt/protocol` rodam tanto sobre
`node:worker_threads.MessagePort` quanto sobre os canais do Electron. O primeiro
emite o valor enviado diretamente; `MessagePortMain` e `process.parentPort` do
utility process podem emitir um objeto `{ data, ports }`. Tratar ambos como se
tivessem a mesma forma faz o envelope correto chegar embrulhado, falhar na
validação do Zod e ser descartado sem resposta. O sintoma real foi uma sessão
presa em `compiling` e o renderer exibindo “Preview indisponível”, sem erro no
terminal.

Toda assinatura passa por `attachMessageListener`
(`packages/protocol/src/message-port.ts`), que normaliza as duas formas. Não
duplique essa lógica em `transport.ts`, `workspace-transport.ts` ou
`export-transport.ts`. No desktop, Main ↔ Workspace, Main ↔ Compiler e Main ↔
Export usam o `process.parentPort`; o Main retransmite os mesmos envelopes
`compiler/*` entre Workspace e Compiler. Portas transferidas adicionais
pareceram inicializar corretamente, mas não entregaram mensagens de modo
confiável no runtime real. O smoke desktop só é válido quando abre vault, abre
editor e termina com `preview: true`; ao testar publicação também precisa
terminar com `export: true` — inicializar processos não basta.

Se um bundle incorpora o código de um package e externaliza uma dependência
dele, a resolução passa a partir do diretório do bundle. O Export Service
incorpora `renderer-pdf`, externaliza `puppeteer-core` e localiza `pagedjs`
dinamicamente; os dois precisam ser dependências runtime diretas do desktop.
O teste P14 in-process não detecta essa classe de erro porque resolve módulos a
partir do package original. O smoke Electron detectou `Cannot find module
'puppeteer-core'` antes de a correção entrar.

## Armadilha: `TextDocuments` dispara `onDidOpen` e `onDidChangeContent` juntos

Na `vscode-languageserver`, abrir um documento TAMBÉM conta como uma mudança
de conteúdo (de vazio para o texto inicial) — os dois handlers disparam quase
simultaneamente para o mesmo evento `textDocument/didOpen`. Se `onDidOpen`
faz `await sessions.open(fileId)` antes de `replaceContent`, mas
`onDidChangeContent` chama `replaceContent` sem esperar a mesma abertura, o
segundo corre na frente do primeiro e `replaceContent` lança porque a sessão
ainda não existe. `apps/lsp/src/create-server.ts` resolve memoizando a
promessa de abertura por fileId (`ensureOpen`) — os dois handlers aguardam a
MESMA chamada a `sessions.open(...)` antes de escrever conteúdo. Qualquer
adapter novo sobre `DocumentSessions` que sincronize a partir de eventos de
um editor externo (não só LSP) tem esse mesmo risco.

## Armadilha: montar uma `file://` URI à mão sem normalizar barra final

`uriFromPath`/`pathFromUri` (`apps/lsp/src/uri.ts`) convertem entre caminho
vault-relativo e `file://` URI. `pathFromUri` sempre normalizou um `rootPath`
com barra final; `uriFromPath` não — concatenava `` `${rootPath}/${path}` ``
direto. Quando `rootPath` chega com `/` no fim (aconteceu de verdade: um
`rootUri` de teste com barra final, mas nada garante que todo cliente LSP
manda sem barra), o resultado é `file:///vault//b.md`: a URI parece válida,
mas não bate com nenhum arquivo real, e `documentFor` retorna `undefined`
silenciosamente — sem lançar, sem logar. `definition`/`references` (que
montam a URI de um arquivo diferente do documento aberto) voltavam `[]` sem
erro nenhum; só apareceu comparando com `hover` (que resolve o mesmo link mas
não passa por `uriFromPath`) funcionando corretamente ao lado. Toda função
que monta uma URI a partir de um caminho relativo e uma raiz precisa
normalizar a barra dos dois lados, não só de um.

## Armadilha: `execArgv: [...process.execArgv, '--import', 'tsx']` é bomba de fork

`@abnt/plugin-host` (`PluginHost`) precisa forçar `tsx` no processo do
plugin em desenvolvimento, porque a condição `development` aponta packages do
workspace para `src`; um plugin publicado usa o destino `dist`. O instinto óbvio — herdar
o `execArgv` do processo atual e completar com `--import tsx` — **explode**:
como o host (CLI) já roda sob `tsx`, `process.execArgv` do host já carrega
algo do próprio registro do tsx; empilhar outro `--import tsx` em cima faz o
tsx reexecutar o processo para corrigir o registro duplicado, e a próxima
geração herda a lista já duplicada da anterior. Sem limite — um processo a
mais a cada `fork()` recursivo, até esgotar memória ou PIDs do sistema.
Descoberto rodando o plugin de exemplo à mão (`node -e "...fork(...)..."`)
**antes** de escrever qualquer teste automatizado — um `ps aux` no meio do
incidente mostrava processos reais acumulando `--import tsx --import tsx
--import tsx ...` no próprio argv, um por geração. Corrigido usando uma lista
**fixa** (`execArgv: ['--conditions=development', '--import', 'tsx']`), nunca espalhando o `execArgv` do
processo pai. Qualquer código que faça `fork()`/`spawn()` de um processo
filho que TAMBÉM precisa de um loader/flag que o processo atual já pode ter
registrado corre o mesmo risco — não herde execArgv por reflexo, decida
explicitamente o que o filho precisa.

## Armadilha: `fs.watch(root, { recursive: true })` segfaulta neste ambiente

Descoberto na Onda O depurando `tests/f60-transclusion.test.ts` (teste F62):
`WorkspaceStorage.subscribe()` (`packages/workspace-local`) chama `fs.watch`
com `recursive: true` para sincronizar alteração externa do vault. Neste
sandbox — Node 22.x real, não o 20.19 documentado em "Ambiente" abaixo — isso
lança um `TypeError: Cannot read properties of undefined (reading 'get')`
dentro de `node:internal/fs/recursive_watch`, de forma **assíncrona** (não no
`await` que abriu o vault, mas num callback do watcher que dispara depois), e
o processo termina com `SIGSEGV` (exit 139). Como o Vitest reutiliza
processo/worker entre arquivos de teste, o crash derruba testes
**não relacionados** que rodam depois no mesmo worker — foi assim que dois
testes de F66/F60 que não tinham nada de errado (um passando isolado, outro
com uma exceção genérica mascarando a real) pareciam falhar. Sintoma
reconhecível: `this.#<algo> is not a function` ou outro erro sem sentido num
`finally`/cleanup, GENUÍNO só se reproduzir em isolamento
(`vitest run arquivo -t "nome exato"`). Qualquer teste que só precisa
compilar/ler o vault (não sincronizar mudança externa) deve abrir a storage
sem chamar `subscribe()` — ver `tests/f66-composite-source-map.test.ts`.
**Causa raiz confirmada depois**: é limitação do Node 22 neste sandbox, não do
produto — `nvm use 20.19.0` (a versão documentada em "Ambiente") faz o
problema desaparecer por completo; `pnpm check` sob 20.19 fecha 58
arquivos/206 testes, todos verdes, incluindo os ~27 arquivos que usam
`SqliteWorkspaceIndex.open()` (ele chama `subscribe()` internamente). Rode a
suíte sob 20.19 antes de concluir que uma mudança quebrou algo; só sob Node 22
esse ruído aparece. Registrado em `docs/ROADMAP.md` § Dívida conhecida.

## Comandos

```bash
pnpm check          # typecheck + boundaries + licenses + testes
pnpm test           # vitest (golden + invariantes)
pnpm typecheck
pnpm check:boundaries   # dependency-cruiser: as fronteiras acima
pnpm check:licenses     # falha em AGPL/CPAL/SSPL em runtime
pnpm test:visual        # PDF → PNG comparado aos baselines aprovados

# rodar o CLI (ver "Ambiente" — precisa de tsx)
NODE_OPTIONS=--conditions=development pnpm exec tsx apps/cli/src/bin.ts build fixtures/artigo/artigo.md --format pdf
NODE_OPTIONS=--conditions=development pnpm exec tsx apps/cli/src/bin.ts build fixtures/artigo/artigo.md --format html
NODE_OPTIONS=--conditions=development pnpm exec tsx apps/cli/src/bin.ts lint  fixtures/artigo/artigo.md
pnpm build
pnpm test:distribution
pnpm check:release

# desktop (Electron) — ver docs/adr/0014
pnpm --filter @abnt/desktop build
pnpm --filter @abnt/desktop start
pnpm --filter @abnt/desktop dev
```

Inspecionar os fixtures (a única verificação honesta de layout):

```bash
NODE_OPTIONS=--conditions=development pnpm exec tsx apps/cli/src/bin.ts build fixtures/completo/completo.md --format pdf
pdftoppm -png -r 80 fixtures/completo/dist/completo.pdf /tmp/pagina
NODE_OPTIONS=--conditions=development pnpm exec tsx apps/cli/src/bin.ts build fixtures/m2/artigo.md --format pdf
```

## Ambiente

- **Node 20.19** — sem type stripping nativo. Source usa `tsx` com
  `NODE_OPTIONS=--conditions=development`; distribuição usa `dist` e Node
  puro. Não use `node --experimental-strip-types`.
- **pnpm** está em `~/.local/bin` (corepack não conseguiu escrever em `/usr/bin`).
- **Chromium** é o do sistema, via `puppeteer-core` — não baixamos um segundo.
  Sobrescreva com `ABNT_CHROME=/caminho/para/chrome`.
- Packages usam `exports: "./src/index.ts"`: sem build no loop de dev. Quando
  houver distribuição, isso vira `dist/` com tsup.

## Onde ler mais

| Documento | Assunto |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | camadas, packages, o que cada um pode importar |
| [docs/ROADMAP.md](docs/ROADMAP.md) | M0–M5, P0–P22, Onda A e Onda B — o que está feito e o que falta |
| [docs/ABNT.md](docs/ABNT.md) | escopo normativo, direito autoral, prior art |
| [docs/adr/](docs/adr/) | as decisões e por quê |

## Se você é um LLM continuando este trabalho

Leia [docs/adr/0001](docs/adr/0001-camadas-do-modelo.md) antes de mexer em
`document-model`. A pressão constante neste projeto é enfiar conveniência de
ABNT dentro do núcleo — resolve o problema de hoje e custa a extensibilidade
que é a razão de o projeto existir. Quando estiver em dúvida sobre onde algo
mora, a pergunta é: *isto é verdade sobre o documento, ou é uma decisão
editorial?* Verdade vai para a AST; decisão vai para o profile.

Os marcos M0–M5 e P0–P22 estão concluídos. P18 escolheu Linux x64 como único
target Tier 1 e registra a identidade do addon privado em
`dist/workspace/native-addon.json`: target, Electron, ABI, `better-sqlite3` e
lockfile participam da chave de cache. Nunca reutilize um `.node` só porque o
nome do pacote coincide, nem reconstrua o binding do store pnpm. O smoke
`pnpm --filter @abnt/desktop smoke:native` precisa atravessar SQLite/FTS,
editor, preview e PDF no Electron real; `require('better-sqlite3')` não valida
ABI. Windows, macOS e arm64 não são suportados até ADR e runner nativo próprios.
P19 produz `apps/desktop/release/linux-unpacked` via `electron-builder`, com
ASAR e sem assinatura. O Workspace Service não roda de dentro do ASAR no
package: Main o inicia em `resources/workspace-runtime/index.cjs`, adjacente à
cópia privada do `better-sqlite3` e ao manifesto P18. Isso é necessário para
que a resolução estática do índice use o addon Electron correto — validar uma
instância manual antes do protocolo não redireciona `require()` no bundle. O
smoke `pnpm --filter @abnt/desktop smoke:package` é obrigatório após
`package:linux`: abre o binário empacotado e exige edição/salvamento/reabertura,
FTS, preview, PDF e DOCX. Não introduza instalador, signing ou update sem ADR
operacional; o target oficial ainda é somente Linux x64.
P20 escolhe somente `.deb` para Debian/Ubuntu x64. O installer reutiliza o
stage P19 e inclui `resources/workspace-runtime` com o addon P18; não rode
`node-gyp` nem tente instalar dependências na máquina final. O smoke
`pnpm --filter @abnt/desktop smoke:installer` extrai o `.deb` sem root e lança
o executável de `/opt/Folio` com PATH mínimo, validando vault, FTS, save,
preview, PDF e DOCX. Não declare AppImage/RPM/Flatpak/Snap como suportados, nem
trate esse smoke como substituto de uma VM limpa ou de signing: ambos são
marcos posteriores. Ver ADR 0025.
P21 (signing/notarização) foi adiado explicitamente: não invente chaves,
segredos nem workflow de deploy. P22 fixa SemVer de produto em `0.1.0-dev.0`
e gera `apps/desktop/dist/build-info.json` com versão, commit/canal, target,
Electron, protocolo, schemas do workspace e API de plugins. O único caminho
do renderer para esse dado é `window.academic.application.systemInformation()`;
Main lê e valida o DTO, e o manifesto nunca recebe path, ID, título ou conteúdo
do vault. `FOLIO_GIT_COMMIT`/`FOLIO_BUILD_CHANNEL` são inputs de CI controlados;
não leia `git` do runtime distribuído. Ver ADR 0026.
P21 e P23–P28 de release/produção estão congelados por prioridade de produto:
não implemente deploy, auto-update, logs/crash reporting remoto ou backoff de
processos até nova decisão explícita. A trilha ativa é Features. F1 conecta o
CodeMirror desktop ao mesmo `WorkspaceLanguageService` do LSP via DTOs
`language/*` revisionados; o Renderer não parseia Markdown. Requests de
completion/hover/definition/references carregam `expectedRevision`, e o
Workspace Service confere a sessão antes e depois da consulta para impedir que
ranges stale alcancem a view. Outline/diagnósticos seguem no snapshot do
EditorController, e backlinks usam a consulta global já existente. Ver ADR
0027.
F2/F3 adicionam a Command Palette e Quick Open como superfícies do mesmo
`CommandRegistry`: `Mod+Shift+P` descobre/executa commands e `Mod+P` abre
arquivos. O ranking fuzzy mora em módulo puro interno ao renderer; Quick Open
usa `WorkspaceFileDto` já projetado e `workspace.search` para enriquecer por
FTS5. React nunca lê filesystem/SQLite, path continua apresentação e o item
selecionado passa `WorkspaceFileId`. Recência é estado efêmero de UI, não dado
autoral nem metadado persistido. Ver ADR 0028.
F11/F12 serializam citações via command `citation.insert`, que despacha uma
transação no `EditorController`; picker/modal/CodeMirror nunca escrevem arquivo.
O clique no CodeMirror só repassa offset ao host, que substitui o range do
Markdown autoral. A gramática suporta narrativa com locator (`@chave [p. 42]`)
e sufixo separado (`[@chave, p. 42, grifo nosso]`); não formate ABNT no UI.
Ver ADR 0029.
F26 é uma projeção de `EditorSnapshot.diagnostics`: `diagnostics.openCenter`
não pode revalidar, parsear ou consultar SQLite no renderer. O agrupamento por
prefixo de regra é somente apresentação; a fonte e severidade seguem do core.
Quick fixes continuam bloqueados por `WorkspaceEdit`. Ver ADR 0030.
F18 usa identificadores autorais e `[[ref:<id>]]`; o picker não lê AST no
renderer. Alvos vêm do language service por protocolo com `expectedRevision` e
entram no documento por `xref.insert`/EditorTransaction. Ver ADR 0031.
F24 edita frontmatter YAML via uma única transação; autores/orientador usam os
campos já aceitos pelo parser e TCC usa `properties.tcc:*`. Nunca transforme
metadados em estado canônico do React/SQLite. Ver ADR 0032.

Onda A fechou aqui — F1/F2/F3/F11/F12/F18/F24/F26 concluídas, sem lacuna
funcional pendente. Onda B (F4, F5, F31, F32, F33, F34) segue abaixo.

F4 é um Query AST/Planner em `packages/language-service/src/query.ts`
(`parseStructuredQuery`/`executeStructuredQuery`), não um pacote novo — a
fronteira já permitia `language-service → workspace-index`. `cites:`/`has:`/
`linksto:`/`type:` reduzem um `Set<WorkspaceFileId>`; texto livre vai para
`index.search()` (FTS5/bm25) sem duplicar ranking. `has:figure`/`has:table`
exigiram schema v2 do índice (`indexed_blocks`); `has:citation` não. Nunca
monte SQL na UI: `workspace.search()` continua a mesma chamada de sempre. Ver
ADR 0033.
F5 é o pacote novo `@abnt/workspace-graph` — `buildWorkspaceGraph` é puro e
síncrono, recebe projeções que o host já buscou (`links()/citations()/
resources()`), nunca acessa storage/índice sozinho. `links-to` resolve via
`documentTarget` de `language-service`, a mesma função de sempre. Grafo é
sempre derivado on-the-fly, nunca materializado em SQLite. Armadilha real: um
método novo de protocolo precisa entrar em **dois** lugares —
`WorkspaceMethod` (model.ts) E o `z.enum([...])` de `requestEnvelopeSchema`
(schemas.ts); esquecer o segundo descarta a requisição em silêncio
(`safeParse` falha, nada responde, parece hang no cliente). Ver ADR 0034.
F31 exigiu resolver bibliografia do vault inteiro pela primeira vez — P12 só
resolvia por documento com sessão aberta.
`apps/desktop/src/workspace/frontmatter-scan.ts` pré-filtra por
regex+YAML do frontmatter (nunca `@abnt/markdown`) quais documentos declaram
`bibliography:`; a resolução real abre sessão de editor em lote e fecha só as
que abriu. `sessions.idle(fileId)` depois de `editors.open()` evita a corrida
do `autoCompile` fire-and-forget — não faça polling como os testes de P12
fazem, o host tem acesso direto a `sessions`. Ver ADR 0035.
F32 é sempre sugestão, nunca edição automática. `unlinkedMentions` exclui
ocorrências dentro do `source` range de `link`/`citation` existentes — não
precisa rastrear "pai" na árvore, o span do nó já cobre isso. Varredura
limitada ao documento ativo, sob demanda, revisionada como completion/hover.
"Transformar em link" é uma transação via comando (`mention.linkify`), nunca
automático. Ver ADR 0036.
F33 depende de F31, não só de F5 — precisa do catálogo bibliográfico
vault-wide para `author`/`editor`. `buildWorkspaceGraph` aceita `bibliography`
opcional desde a F5 (decisão antecipada); `includePeople` é opt-in no
protocolo porque resolver bibliografia é o passo mais caro da Onda B inteira.
Ver ADR 0037.
F34 precisou de uma primitiva nova: `WorkspaceStorage.create()` (arquivo que
ainda não existe — `write()`/`rename()` exigem registro prévio). O vínculo
autoritativo nota↔referência é a citação `[@id]` no corpo, não o
`sourceReference:` do frontmatter (que é só atalho de UI). Idempotente por
path (`papers/{referenceId}.md`): reabre em vez de sufixar. Corrigiu de
passagem um bug latente em `errorFor()` que não mapeava
`WorkspaceAlreadyExistsError`. Ver ADR 0038.

`@abnt/protocol` é a fronteira DTO/runtime-validated entre hosts e serviços;
não deixe `Map`, `AnnotationStore`, `Error` ou IDs branded vazarem por ela.
No workspace, path é localização e `WorkspaceFileId`/`WorkspaceDocumentId` são
identidade; a fonte da verdade continua no filesystem, nunca num índice.
`workspace-index` é cache SQLite: pode ser apagado e reconstruído; não importe-o
em compiler, workspace-core/local, modelo documental, normas ou renderers.
`workspace-sessions` coordena rascunhos e compilações pelo contrato P1: toda
edição tem revisão própria e todo resultado assíncrono precisa passar pelo guard
de revisão/token antes de atualizar diagnóstico ou preview. Não mova essa lógica
para compiler nem para uma futura UI.
`language-service` observa a sessão para a fonte atual e usa `workspace-index`
somente para consultas globais. Não replique parse, offsets ou navegação em um
adaptador CodeMirror/LSP: ele deve apenas traduzir o contrato deste package.
`editor-core` é dono apenas da seleção e das transações; a fonte do texto segue
na sessão. Uma projeção de language service só pode atualizar o controller se
a revisão/epoch ainda for atual. `editor-codemirror` já é o adaptador de
`EditorController`: ele pode importar CodeMirror, mas não sessões, storage,
índice, React, Electron ou norma. Mudança da view sempre passa pelo controller;
atualização externa volta à view sem entrar no histórico local.
No desktop (`apps/desktop`), a fronteira é de processo: Main só supervisiona e
encaminha DTO; o Workspace Service é dono único de storage, índice e sessões; o
Compiler Service não conhece vault; o renderer não abre `fs`, SQLite nem
Electron e fala apenas pela API do preload. Os serviços recebem porta por
`process.parentPort` e não importam `electron` — é isso que os mantém testáveis
in-process. Cinco regras do dependency-cruiser fiscalizam isso; ver
[docs/adr/0014](docs/adr/0014-shell-desktop-multiprocesso.md). O build desktop
mantém uma cópia Electron-específica de `better-sqlite3` dentro de `dist`, sem
recompilar a dependência usada pelo Node nos testes. Main retransmite envelopes
do Compiler Service, mas não interpreta nem executa compilação.
`apps/desktop/src/renderer/shell/` é o Command Registry, o modelo de tabs e o
registro de painéis do P9 — módulos headless dentro do renderer, não um package
novo, porque só o desktop os consome por enquanto. Tab não é sessão: fechar uma
tab é decisão explícita (chama `editor.close`), trocar de tab só desmonta o
CodeMirror local. O modo lado a lado é o command `view.toggleSplitPreview`: o
editor continua ativo e a tab de preview é apenas criada/reutilizada em segundo
plano, sem ganhar controller nem autoridade sobre o source. Estilo do renderer usa Tailwind CSS v4
(`@tailwindcss/vite`); CSS à mão fica só para o que Tailwind não alcança
(marcação interna gerada pelo CodeMirror).
Preview (P10) é sob demanda, não empurrado a cada tecla: `EditorSnapshotDto`
carrega só `previewRevision`/`previewProfileId` (marcador leve); o HTML vem de
`previewEditor`, renderizado no host do Workspace Service via
`@abnt/renderer-html` sobre a Publication AST que a sessão já mantém desde P4.
`DocumentSessionPreview.revision` é a revisão real do preview — nunca infira
isso de `session.revision`, que já pode ter avançado por uma edição enquanto o
preview antigo ainda não foi invalidado. Preview renderiza em
`<iframe sandbox="" srcDoc={html}>`, nunca `dangerouslySetInnerHTML`: isola o
CSS de paginação do Tailwind do shell e barra `<script>` mesmo se o escape do
renderer falhasse. Como `@page` não cria margens na mídia de tela, o modo
`renderizarHtml(..., { preview: true })` representa A4 e aplica a mesma
`PagePolicy` somente em `@media screen`; o PDF usa o modo padrão e não recebe
margem dupla. Ver [docs/adr/0015](docs/adr/0015-preview-rapido-sob-demanda.md).
Busca e backlinks (P11) não reimplementam resolução de link: `LanguageService.
backlinks(fileId)` reaproveita a mesma `documentTarget` que `definition`/
`references` já usam desde P5, só lança `WorkspaceFileNotFoundError` em vez de
devolver lista vazia para `fileId` desconhecido — consistente com os métodos
irmãos. `search()` só enxerga o índice SQLite persistido, nunca sessões
abertas não salvas. Painéis de P9 agora são invocados via JSX
(`<panel.render .../>`, não chamada direta): é o que permite Backlinks usar
`useState`/`useEffect` para buscar dado que a sessão não carrega. O snippet do
FTS5 embute `<mark>` literal em texto não escapado do vault — o renderer
divide na marcação em vez de usar `dangerouslySetInnerHTML`. Ver
[docs/adr/0016](docs/adr/0016-busca-e-backlinks.md).
`apps/desktop/src/workspace/environment.ts` (P12) é o primeiro
`CompilationEnvironmentResolver` real do desktop — antes disso, TODO documento
compilava contra ambiente vazio (`criarResolvedorDeAmbienteVazio`), sem
bibliografia nenhuma resolvendo. Resolve `.bib` via `WorkspaceStorage`
reaproveitando `documentTarget`, mesma resolução de link relativo de P5.
`bibliography` deixou de estar na lista proibida do host do workspace desktop
(é resolução de dependência autoral, não compilação); `compiler`/`markdown`/
`standards`/`semantics` continuam proibidos. `DocumentSessionSnapshot.
bibliography` espelha `preview`, mas não é invalidado a cada edição — ao
contrário do HTML de preview, um catálogo de referências um pouco desatualizado
não é o tipo de erro que os guards de revisão existem para evitar. Ver
[docs/adr/0017](docs/adr/0017-reference-manager.md).
A extensão de VS Code foi explicitamente adiada. O motor M2 já é o usado pelos
profiles ABNT; `motorDeCitacaoProvisorio` permanece apenas como fallback
barulhento para profiles que esqueçam de registrar um motor.
