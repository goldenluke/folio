# ADR 0014 — Shell desktop multiprocesso sobre o protocolo existente

**Status:** aceito · 2026-09-07

## Contexto

P0–P7 produziram um núcleo headless completo: compilador, protocolo de serviços,
workspace local-first, índice descartável, sessões revisionadas, language service
e adaptador CodeMirror. Nada disso tinha aplicação. O ciclo de produto começa
aqui, e o risco é conhecido: ao ganhar uma UI, um projeto tende a deixar o
framework de interface virar a fonte de verdade e o transporte virar uma segunda
família de contratos paralela à que já existe.

Este ADR fixa as fronteiras de processo antes que a UI cresça.

## Decisão

### Por que Electron

O núcleo é 100% TypeScript e o backend de PDF já é Chromium + Paged.js. Electron
entrega o mesmo runtime nos três sistemas operacionais sem introduzir um segundo
idioma no core, que é a restrição global do projeto. Tauri exigiria Rust para o
host; um app web abandonaria o local-first.

### Quem roda o quê

```
Electron Main ── supervisiona ──┬── Workspace Service (utility process)
   janela, diálogo nativo,      │      workspace-local, workspace-index,
   ciclo de vida, CSP           │      workspace-sessions, editor-core,
                                │      language-service
                                └── Compiler Service (utility process)
   Renderer                            @abnt/compiler
   React, CodeMirror, DTOs
```

- **Main** não compila, não indexa e não parseia Markdown. Ele cria janela,
  abre o diálogo nativo de pasta, encaminha DTOs já validados e observa a saída
  dos filhos. Main que importa domínio transforma a separação de processos em
  decoração: um crash do compilador derrubaria a aplicação inteira.
- **Renderer** monta CodeMirror pelo adaptador P7 e fala só com a API do
  preload. Não abre `fs`, SQLite nem Electron.
- **Workspace Service** é o dono único de storage, índice, sessões e
  controllers. Duas conexões SQLite no mesmo arquivo são duas verdades sobre o
  vault (ver [ADR 0009](0009-indice-sqlite-descartavel.md)).
- **Compiler Service** recebe `SourceSnapshot` serializado e devolve resultado.
  Não conhece vault, índice nem sessões — é isso que permite matá-lo e
  reiniciá-lo sem perder o rascunho do usuário.

### Transporte

Não existe família de DTOs específica de Electron. O transporte é o
`@abnt/protocol` de P1: `process.parentPort` transporta os envelopes entre Main
e cada utility process; o Main retransmite os envelopes `compiler/*` entre
Workspace Service e Compiler Service sem interpretar conteúdo; e
`ipcMain.handle`/`ipcRenderer.invoke` carregam os mesmos DTOs entre renderer e
Main. O adapter do processo implementa a mesma superfície `MessagePortLike`,
portanto nenhum serviço importa `electron` e todos continuam executáveis
in-process — é assim que
`tests/p8-desktop-workspace.test.ts` roda o Workspace Service inteiro sobre um
`MessageChannel` de `node:worker_threads`, sem Electron.

Cada canal Main ↔ Utility usa o `parentPort` nativo porque ele já é a autoridade
de comunicação e ciclo de vida do utility process. As primeiras implementações
transferiam portas adicionais, inclusive uma ligação direta Workspace ↔
Compiler; no runtime real elas aceitavam a transferência, mas não entregavam
mensagens de forma confiável, produzindo compilação permanentemente pendente sem
crash. Como os envelopes, validação e cancelamento permanecem os do
`@abnt/protocol`, o relay no Main troca somente o transporte físico, não o
contrato nem o lugar onde a compilação é executada.

Há ainda uma diferença de forma entre os emissores: `MessagePortMain` entrega
um `MessageEvent` (`{ data, ports }`), enquanto `worker_threads.MessagePort`
entrega o valor diretamente. `@abnt/protocol` centraliza essa normalização em
`attachMessageListener`; duplicá-la por transporte já deixou envelopes válidos
do Compiler Service presos na validação sem produzir resposta.

Cancelamento atravessa o transporte pelos envelopes de cancel de P1. A sessão
continua sendo a autoridade do descarte: resultado que chega fora da revisão
corrente é descartado no Workspace Service, nunca na UI.

### Preload

`contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, CSP sem
`unsafe-eval` e sem origem remota, `will-navigate` bloqueado e
`setWindowOpenHandler` negando tudo.

A ponte exposta é `window.academic`, com verbos de domínio
(`workspace.chooseAndOpen`, `editor.dispatch`, …). Nunca
`send(channel, payload)`: um canal genérico devolve ao renderer exatamente o
poder que o sandbox existe para tirar. A resposta é revalidada contra o schema
no lado do renderer — o preload não confia no Main mais do que o necessário.

O diálogo nativo é uma conveniência, não uma autoridade. A mesma ponte expõe
`workspace.open({ rootPath })`, validado pelo DTO de protocolo no renderer e no
Main, para permitir abrir um vault por caminho quando o seletor do sistema não
responder. Isso não entrega acesso a `fs` ao renderer: o caminho continua sendo
apenas uma solicitação ao Workspace Service. A UI aplica timeout ao diálogo
para que um problema do sistema operacional nunca deixe o comando bloqueado.

### Restart

Cada supervisor reporta saída não solicitada como erro operacional, distinto de
diagnóstico de documento (ver [ADR 0011](0011-language-service-headless.md)).
`dispose()` marca parada intencional para não emitir ruído no encerramento, e
`start()` limpa essa marca — sem isso, o primeiro crash silencia todos os
seguintes e a UI nunca mais descobre que o serviço caiu.

### Inferência de schema não atravessa a fronteira

`validarDto` e `validarResultadoDoProtocolo` recebem `DtoSchema<T>`, uma
superfície estrutural com `safeParse`, e **não** `z.ZodType<T>`.

Isto não é estilo. Inferir `T` a partir de `z.ZodType<T>` faz o compilador
instanciar os internals do Zod 4 sobre a forma inteira do DTO. Com os schemas
grandes do editor, um único arquivo do desktop chegou a **33 milhões de
instanciações de tipo e 10,5 GB**, e `pnpm typecheck` morria com `exit 134`
antes de reportar erro algum — o que escondeu 24 erros de tipo reais no
`apps/desktop`. Com a superfície estrutural, o repositório inteiro fica em
189 mil instanciações e 1 s de checagem.

Pelo mesmo motivo o envelope de resultado é estático: compor o schema do payload
dentro de um `z.union` a cada chamada repetia essa instanciação em todo call
site. A casca é validada primeiro, o payload depois.

## Consequências

- Cinco regras novas no `dependency-cruiser` fiscalizam as fronteiras acima, cada
  uma verificada contra violação deliberada antes de entrar.
- O Workspace Service é testável sem Electron, e o teste P8 exercita abrir vault,
  editar por revisão, compilar, salvar e persistir.
- Crash isolation existe de verdade: derrubar o compilador não leva junto o
  rascunho, porque o rascunho vive no Workspace Service.
- Fica em aberto para P9+: política de restart automático (hoje o erro é
  reportado e o serviço reinicia sob demanda), projeções pequenas por evento em
  vez de snapshot inteiro do editor, e language service no renderer via DTO — o
  P8 devolve listas vazias em vez de replicar parser no cliente.

## ABI nativo

`better-sqlite3` precisa de um artefato para o `NODE_MODULE_VERSION` do Node dos
testes e outro para o Electron. O build desktop de P17 copia a dependência para
`dist/workspace/node_modules` e compila somente essa cópia contra os headers do
Electron; nunca altera o store compartilhado do pnpm. O smoke test abre um vault
e instancia o índice de verdade — apenas executar `require('better-sqlite3')`
não serve, porque o binding é carregado sob demanda na criação do `Database`.

## Não decidido aqui

Empacotamento, assinatura, auto-update e estratégia de Chromium para o backend
de PDF no desktop. O CLI continua usando o Chromium do sistema; o desktop já
carrega o seu. Unificar isso exige ADR próprio, junto de P17.
