# Roadmap

## M0 — Walking skeleton ✅

O pipeline inteiro, trivialmente fino. O passo de maior informação: prova todas
as costuras antes de investir em qualquer uma.

- [x] Monorepo pnpm, TS strict, Vitest
- [x] Gates de CI (`check:boundaries`, `check:licenses`) — **antes** do domínio,
      e testados com violação deliberada
- [x] Markdown + frontmatter → Document AST (document, section, paragraph,
      text, strong)
- [x] Passe de numeração progressiva → `AnnotationStore`
- [x] Publication AST com tokens de estilo
- [x] Renderer HTML + CSS Paged Media
- [x] PDF via Paged.js + Chromium — A4 verificado, 2 páginas, ~310 ms
- [x] Golden test da cadeia inteira + testes de invariante arquitetural

## M1 — Document AST completa ✅

- [x] Conjunto completo de nós: ênfase, strike, link, código, math, listas,
      citação em bloco, figura, tabela, nota, citação, cross-reference,
      containers e quebras
- [x] Parser GFM + math; recursos e notas em registries; source mapping
      preservado inclusive após frontmatter
- [x] Frontmatter inválido é recuperável e produz
      `MD-FRONTMATTER-INVALIDO`, em vez de derrubar o compilador
- [x] JSON Schema v1 + validação em runtime (Zod). TypeScript não deve ser a
      única especificação do formato.
- [x] Property tests: roundtrip serialize/deserialize, unicidade de node IDs,
      normalização idempotente, determinismo, offsets válidos e robustez para
      entrada não confiável
- [x] Cadeia explícita de migrações contíguas (vazia enquanto só existe v1),
      para o versionamento não virar acúmulo de campos opcionais
- [x] Publication AST e renderer HTML cobrem os novos nós; fixture completo
      verificado em PDF com tabela, figura SVG, citação longa e notas de rodapé

## M2 — Bibliografia e citações ✅

O trabalho de maior risco e maior valor. Ver
[ADR 0002](adr/0002-motor-de-citacao-proprio.md) antes de começar.

- [x] Modelo canônico com o schema CSL-JSON
- [x] Importador BibTeX → CSL-JSON, com os quirks do BibTeX em quarentena
      dentro do importador
- [x] Sintaxe: `[@silva2024, p. 42]` e `@silva2024` narrativo (parser M1)
- [x] Motor ABNT próprio: autor-data e numérico (NBR 10520:2023)
- [x] Referências (NBR 6023:2018): livro, capítulo, artigo de periódico,
      trabalho em evento, tese/dissertação, documento eletrônico
- [x] Golden test por tipo de referência, conferido contra os `.csl` ABNT
      existentes usados **como oráculo**, nunca como dependência

**Feito quando:** as referências geradas batem com o oráculo nos tipos centrais.

## M3 — Passes semânticos e validador ✅

- [x] Resolução de cross-references
- [x] Numeração derivada de figuras/tabelas/equações/código (infraestrutura M1)
- [x] `SemanticPass<I, O>` encadeados, cada um testável isoladamente
- [x] `folio lint` com catálogo de regras codificadas:
      `ABNT-10520-CIT-004  artigo.md:84:12`
- [x] Regras iniciais: citação direta sem localização; referência citada e
      ausente; referência nunca citada; figura sem legenda ou fonte; resumo
      fora do limite de palavras

## M4 — Artigo completo, fidelidade e o segundo profile ✅

- [x] Profile NBR 6022 fim a fim
- [x] Infraestrutura visual de citação longa (recuo 4 cm, corpo 10, espaço
      simples) e notas de rodapé; catálogo inicial de validação no M3
- [x] **Segundo profile ("web-article")** — o teste real da abstração. Se ele
      exigir mudar `document-model`, o desenho está errado. Ver
      [ADR 0001](adr/0001-camadas-do-modelo.md).
- [x] Regressão visual: página → PNG → comparação com baseline aprovado
- [-] Reconsiderar a extensão de VS Code ([ADR 0005](adr/0005-cli-antes-do-editor.md))
      — explicitamente adiada por escopo

## M5 — TCC (NBR 14724) ✅

- [x] Profile `abnt-tcc`, selecionável pelo frontmatter ou pela CLI
- [x] Capa, folha de rosto, ficha catalográfica e folha de aprovação
- [x] Dedicatória, agradecimentos e epígrafe opcionais
- [x] Resumo e abstract com palavras-chave em ambos os idiomas
- [x] Listas geradas de ilustrações, tabelas e códigos
- [x] Listas declaradas de abreviaturas/siglas e símbolos
- [x] Sumário com numeração semântica, âncoras e páginas resolvidas pelo Paged.js
- [x] Validação de metadados obrigatórios, resumos, legendas e fontes
- [x] Fixture de 17 páginas, inspecionada visualmente e protegida por baseline
- [x] Implementado como **profile**, sem alterar `document-model`

## P0 — Compiler headless ✅

- [x] `@abnt/compiler`: `SourceSnapshot → prepare → CompilationEnvironment → compile`
- [x] Bibliografia e recursos externos não hidratam mais a Document AST
- [x] CLI reduzido a host local de filesystem, HTML e PDF
- [x] API assíncrona, revisionada e cancelável entre fases
- [x] Fronteiras de compiler headless fiscalizadas no CI

## P1 — Protocolo de serviços ✅

- [x] `@abnt/protocol`: DTOs serializáveis, `ProtocolResult`/erros e versão explícita
- [x] Contratos de compiler e superfície inicial de workspace
- [x] Validação runtime em request, response e envelope MessagePort
- [x] Adaptador domínio ↔ DTO no compiler, sem vazar `Map` ou `AnnotationStore`
- [x] Teste de contrato: execução in-process e por `MessagePort` produzem a mesma saída

## P2 — Workspace local-first ✅

- [x] `workspace-core`: modelo, IDs estáveis, revisões, eventos e contrato `WorkspaceStorage`
- [x] `workspace-local`: filesystem, config, sidecar de identidade e reconciliação headless
- [x] Escritas atômicas, detecção de conflito externo e recovery journal
- [x] Watcher normalizado de snapshots para eventos semânticos de vault
- [x] Teste headless: abrir, editar, salvar, renomear, recuperar e detectar conflito

## P3 — Índice SQLite ✅

- [x] `workspace-index`: schema versionado, migrações e banco derivado em `.academic/index.sqlite`
- [x] Fingerprints por FileId/revisão/hash e indexação incremental por eventos do workspace
- [x] Headings, links, citações, recursos e busca FTS5
- [x] Rebuild completo: apagar `index.sqlite` recompõe tudo a partir do vault
- [x] Teste headless com sincronização incremental, rename e reconstrução

## P4 — Sessões revisionadas e compilação incremental ✅

- [x] `workspace-sessions`: serviço headless que coordena `WorkspaceStorage`,
      `CompilerService` e resolução de ambiente sem importar filesystem ou UI
- [x] Rascunho local e revisão de sessão independentes da revisão persistida do vault
- [x] Compilação automática por revisão, cancelável por `AbortSignal` e protegida
      por token/revisão contra respostas remotas atrasadas
- [x] Eventos de dependências, diagnósticos, preview, descarte e conflito externo
- [x] Salvamento mantém `FileId`/`DocumentId` e não perde uma edição ocorrida em paralelo
- [x] Teste headless com preview, save e descarte de resultado obsoleto

## P5 — Language service headless ✅

- [x] `language-service`: contrato independente de CodeMirror/Electron para
      outline, diagnósticos, autocomplete, hover e navegação
- [x] Fonte da sessão aberta prevalece sobre o índice para representar rascunhos
      ainda não salvos; SQLite responde referências e candidatos globais
- [x] Autocomplete de citações por catálogo injetável e de links relativos pelo vault
- [x] Definição e referências de citações/links via SourceRange e projeção do índice
- [x] Teste headless com documento atual, referências entre arquivos e frontmatter inválido

## P6 — Editor core headless ✅

- [x] `editor-core`: controllers por documento, texto, seleção e eventos sem
      importar CodeMirror, React ou Electron
- [x] Transações atômicas com validação de intervalos, rejeição de sobreposição
      e mapeamento da seleção após múltiplas edições
- [x] Sincronização com `workspace-sessions`; salvar e fechar preservam a
      autoridade da sessão e não criam uma segunda fonte de texto
- [x] Outline/diagnósticos são projeções assíncronas revisionadas, descartadas
      quando uma análise antiga termina depois de uma edição nova
- [x] Teste headless de transação, persistência, encerramento externo e projeção lenta

## P7 — Adaptador CodeMirror 6 ✅

- [x] `editor-codemirror`: ponte fina entre `EditorController` e `EditorView`,
      sem importar sessões, filesystem, índice, React ou Electron
- [x] Edições e seleção da view viram transações atômicas do core; snapshots
      externos atualizam a view sem criar uma segunda fonte de texto
- [x] Markdown, histórico local, diagnósticos, autocomplete e hover são
      extensões CodeMirror alimentadas pelo `language-service`
- [x] Atualizações vindas do controller não entram no histórico de undo/redo;
      encerrar a sessão destrói a view, sem encerrar o controller por conta própria
- [x] Teste jsdom com view real, edição, seleção, lint, save e ciclo de vida

## P8 — Shell desktop multiprocesso ✅

Ver [ADR 0014](adr/0014-shell-desktop-multiprocesso.md).

- [x] `apps/desktop`: Electron Main, preload, renderer React e dois utility
      processes (Workspace Service e Compiler Service)
- [x] Transporte pelo `@abnt/protocol` de P1 — sem uma segunda família de DTOs
      para Electron; os serviços recebem porta por `process.parentPort` e não
      importam `electron`, então continuam executáveis in-process nos testes
- [x] Preload capability-based (`window.academic`), sem canal IPC genérico;
      `contextIsolation`/`sandbox` ligados e CSP sem origem remota
- [x] Workspace Service como dono único de storage, índice, sessões e controllers
- [x] Montagem real do adaptador CodeMirror sobre um controller remoto: abrir
      vault, abrir Markdown, editar por revisão, ver diagnósticos e salvar
- [x] Cinco fronteiras novas no `dependency-cruiser` (renderer, main, preload,
      compiler service e dono único do SQLite), cada uma verificada contra
      violação deliberada
- [x] Teste headless do Workspace Service por `MessagePort` e teste de contrato
      da API do preload

Ficou fora de propósito: plugins, sync, DOCX, grafo, auto-update. O P8 existe
para provar as fronteiras de processo, não para ser bonito.

**Pendência que bloqueia rodar o desktop de ponta a ponta:** `better-sqlite3`
está compilado para o ABI do Node do ambiente e conflita com o ABI do Electron;
abrir um vault dentro do Electron falha em `ERR_DLOPEN_FAILED`. Detalhes e
saída provável em [ADR 0014](adr/0014-shell-desktop-multiprocesso.md) e na
dívida conhecida abaixo. A verificação funcional de P8/P9 foi feita rodando o
renderer isolado (Vite, sem Electron) contra uma API `window.academic` mockada.

## P9 — Shell de workspace/editor ✅

Primeiro shell de produto sobre o P8: command registry, modelo de tabs e
painel direito registrável, construídos como módulos headless dentro de
`apps/desktop/src/renderer/shell/` (sem package novo — só o desktop consome
isso por enquanto).

- [x] `CommandRegistry`: registro id→handler com `CommandContext`, sem
      depender de componente React específico; explorer, keybindings e futuro
      command palette disparam pelo mesmo registro
- [x] Modelo de tabs (`ViewId`/`ViewState`) distinto da sessão documental —
      trocar de tab só desmonta o CodeMirror local (`adapter.destroy()`); fechar
      uma tab é decisão explícita de chamar `editor.close` no host, não
      consequência automática de desmontar a view
- [x] Cada tab mantém um `RemoteEditorController` próprio e uma assinatura viva
      no host, então uma tab em segundo plano continua recebendo diagnósticos e
      atualizações de sessão mesmo sem CodeMirror montado
- [x] Keybindings como chord→CommandId (`mod+s` salvar, `mod+w` fechar tab),
      nunca chord→callback embutido no componente
- [x] Painel direito registrável: Sumário (outline real do host, clique navega
      por offset com `scrollIntoView`) e Diagnósticos (dados reais da sessão,
      não parse local)
- [x] Ajuste em `editor-codemirror`: seleção externa sem edição junto agora
      revela a posição (`scrollIntoView: true`) — necessário para a navegação
      do outline
- [x] Estilização convertida para Tailwind CSS v4 (`@tailwindcss/vite`); CSS
      próprio ficou só para o que Tailwind não alcança (marcação interna do
      CodeMirror)
- [x] Opção `view.toggleSplitPreview`: editor permanece como view ativa e o
      preview revisionado é aberto/reutilizado em segundo plano, lado a lado;
      a folha A4 é reduzida para caber no painel sem alterar o HTML publicado
- [x] Testes headless de `commands`/`views`/`keybindings` sem Electron nem
      jsdom; verificação funcional completa (multi-tab, outline, diagnósticos,
      dirty indicator, salvar, fechar aba) rodando o renderer isolado no
      browser contra uma API mockada

Ficou fora de propósito: command palette (UI de busca de comandos), menu
nativo do Electron chamando o registry, painéis de backlinks/referências
(dependem de P11/P12), settings.

## P10 — Preview rápido sob demanda ✅

Ver [ADR 0015](adr/0015-preview-rapido-sob-demanda.md).

- [x] `EditorPreviewDto`/`previewEditor` no protocolo — HTML pedido sob
      demanda, fora do caminho de cada tecla; `EditorSnapshotDto` ganha só um
      marcador leve (`previewRevision`/`previewProfileId`) para o cliente
      saber quando reperguntar
- [x] HTML renderizado no host do Workspace Service via `@abnt/renderer-html`
      sobre a Publication AST que a sessão já mantinha desde P4 — nenhuma
      compilação nova, só parou de ser descartada na fronteira do desktop
- [x] `DocumentSessionPreview` ganhou `revision` explícito, para não inferir
      (incorretamente, em geral) da revisão corrente da sessão
- [x] Nova fronteira no `dependency-cruiser`: o host do workspace desktop não
      importa compiler/markdown/standards/semantics/bibliography — consome
      Publication AST já resolvida, não reimplementa compilação
- [x] `PreviewViewState` no modelo de tabs do P9 — tab sem controller, coexiste
      com uma tab de editor do mesmo arquivo, fecha independentemente
- [x] Render em `<iframe sandbox="" srcDoc={html}>`: isola o CSS de paginação
      do Publication HTML do Tailwind do shell e bloqueia `<script>` mesmo que
      `renderizarHtml` falhasse em escapar algo
- [x] Projeção A4 para a mídia de tela usando a mesma `PagePolicy`: o preview
      rápido mostra as margens 3/2/2/3 cm sem alterar o HTML usado pelo PDF
- [x] Teste de integração sobre `MessagePort` real cobrindo o ciclo completo:
      preview inicial, edição invalida, recompilação e preview atualizado
- [x] Verificado no Electron real: editar com a tab de preview aberta atualiza
      o HTML sozinho; o PDF exportado mantém os limites físicos medidos

Ficou fora de propósito: paginação fiel via Paged.js (segundo modo de
preview), isolamento de export PDF em processo próprio (Export Worker, P14),
debounce de UI para recompilação (hoje depende só do guard de revisão já
existente na sessão).

## P11 — Busca full-text e backlinks ✅

Ver [ADR 0016](adr/0016-busca-e-backlinks.md).

- [x] `LanguageService.backlinks(fileId)` reaproveita a mesma resolução de
      link relativo (`documentTarget`) que `definition`/`references` já
      usavam desde P5 — não reimplementa "como resolver um link" numa segunda
      camada; lança `WorkspaceFileNotFoundError` para `fileId` desconhecido,
      igual aos irmãos `outline`/`diagnostics`/`definition`
- [x] `workspace/search` e `workspace/backlinks` no protocolo do desktop —
      `search` só sobre o índice SQLite persistido (mesma limitação que já
      existia antes do desktop: rascunho não salvo não aparece até salvar)
- [x] Campo de busca na sidebar do explorer, com debounce de 200 ms, susbtitui
      a lista de arquivos enquanto há uma consulta ativa; resultado mostra
      título, caminho e trecho destacado
- [x] Painel "Backlinks" registrado ao lado de Sumário/Diagnósticos; clique
      abre o documento de origem do link
- [x] `PanelDefinition.render` passou a ser invocado via JSX
      (`<panel.render .../>`, não chamada direta) — necessário para Backlinks
      usar hooks (`useState`/`useEffect`) buscando dado que a sessão não
      carrega; Sumário/Diagnósticos continuam funcionando sem mudança
- [x] Trecho de busca (`snippet()` do FTS5) renderizado sem
      `dangerouslySetInnerHTML`: divide nos marcadores `<mark>` em vez de
      injetar HTML cru do vault
- [x] Teste headless de `backlinks` sobre a fixture existente do P5 + teste de
      integração de busca/backlinks sobre `MessagePort` real, incluindo o
      caso de erro (arquivo inexistente)
- [x] Verificado manualmente no browser: busca com destaque, clique abrindo
      documento, painel de Backlinks re-buscando ao trocar de documento ativo

Ficou fora de propósito: busca estruturada (`cites:`, `has:figure`,
`linksto:`) e o Query AST que a sustentaria, grafo (nodes/edges de
documentos/referências/recursos) — a peça mais visual do P11, fica para uma
fatia própria.

## P12 — Reference manager ✅

Ver [ADR 0017](adr/0017-reference-manager.md). A maior parte do trabalho não
foi UI: foi perceber que o desktop nunca tinha resolvido bibliografia
nenhuma (`criarResolvedorDeAmbienteVazio()` desde o P8) e fechar esse
alicerce antes de ter dado real para mostrar.

- [x] `apps/desktop/src/workspace/environment.ts`: primeiro
      `CompilationEnvironmentResolver` real do desktop — resolve `.bib`
      declarado em `bibliography:` no frontmatter via `WorkspaceStorage`,
      mesmo papel que `apps/cli/src/environment.ts` já cumpre para o CLI;
      reaproveita `documentTarget` (exportado de `@abnt/language-service`)
      para resolução de caminho relativo, a mesma usada por
      `definition`/`references` desde P5
- [x] Fronteira revisada: `bibliography` saiu da lista proibida para o host
      do workspace desktop (é resolução de dependência autoral, não
      reimplementação de compilação); `compiler`/`markdown`/`standards`/
      `semantics` continuam proibidos
- [x] `DocumentSessionSnapshot`/`EditorSnapshot` ganharam `bibliography`,
      espelhando `preview` — mas sem a invalidação eager a cada tecla: o
      catálogo sobrevive a edições de prosa até uma resolução mais nova
      terminar
- [x] `workspace/references` no protocolo: `WorkspaceReferenceDto` já
      formatado em ABNT (`formatarReferenciaAbnt`/`referenciaComoTexto` do
      mesmo `@abnt/bibliography` do compilador, chamado no host) com
      proveniência e `sourceFileId` resolvido
- [x] Painel "Referências" registrado no P9: busca/filtro local, formatado
      ABNT, proveniência, "Inserir citação" (via comando `citation.insert` →
      `EditorTransaction`, nunca toca CodeMirror direto) e "Abrir fonte"
      (abre o `.bib` como uma tab comum)
- [x] Dois testes de integração sobre `MessagePort` real: `.bib` real
      resolve e formata corretamente; documento sem `bibliography:` no
      frontmatter não resolve nada (ausência legítima, não erro)
- [x] Verificado manualmente no browser: listar referências, inserir citação
      (texto real aparece no editor, indicador de "sujo" liga), abrir fonte

Ficou fora de propósito: qual fonte bibliográfica é editável (decisão
deliberadamente adiada — inline, `.bib`, CSL-JSON gerenciado, Zotero),
adapters DOI/RIS/Zotero/Crossref, resolução de recursos (imagens) no
ambiente do desktop — mesma lacuna já registrada no preview do P10.

## P13 — Language server ✅

Ver [ADR 0018](adr/0018-lsp-server.md). Segundo host sobre a mesma
`@abnt/language-service` do desktop — desenhada desde o P5 para isso.
Nenhuma regra de outline, diagnóstico, completion, hover, definição ou
referência foi reimplementada; o LSP só traduz para o protocolo.

- [x] Resolvedor de ambiente extraído para `packages/workspace-environment/`
      **antes** de escrever o LSP, para desktop e LSP reaproveitarem a mesma
      resolução de bibliografia sem duplicar (o desktop passou a importar do
      package compartilhado; o arquivo antigo foi deletado)
- [x] `apps/lsp`: composição in-process (storage + índice SQLite próprio em
      `.academic/index-lsp.sqlite` + sessões + language service), compilador
      in-process via `@abnt/compiler` — mesmo papel que `apps/cli` já cumpre,
      sem a isolação de processos do desktop (que existe por um motivo que o
      LSP não tem, ver ADR 0014)
- [x] Fronteira `lsp-e-so-adapter-lsp`: proíbe Markdown/normas/semântica e
      UI/Electron/renderização; permite `@abnt/compiler` (ao contrário da
      regra homônima do desktop — aqui o compilador roda no mesmo processo
      de propósito)
- [x] `createLspServer(input, output)` separado do bin (`server.ts`) para o
      servidor ser testável sobre streams em memória, sem subprocesso
- [x] Sincronização `didOpen`/`didChange`/`didClose` → sessão, com abertura
      memoizada por arquivo (`ensureOpen`) — corrige uma corrida real entre
      `onDidOpen` e `onDidChangeContent`, que o LSP dispara quase juntos para
      a mesma abertura
- [x] Adapters: `documentSymbol`, diagnósticos (push, só para documentos
      abertos no editor), `completion`, `hover`, `definition`, `references`
- [x] `tests/p13-lsp.test.ts`: integração fim a fim falando o protocolo LSP
      real (framing `Content-Length`) sobre streams em memória, mais
      regressão unitária de `uriFromPath`/`pathFromUri`
- [x] Verificado manualmente com um cliente LSP mínimo contra o processo real
      (`tsx apps/lsp/src/server.ts`) — essa verificação achou dois bugs reais
      (corrida de sessão e barra dupla em `uriFromPath`) que não apareceriam
      só lendo o código

Ficou fora de propósito: rename (precisa de um contrato `WorkspaceEdit` que
ainda não existe), `workspace/symbol`, code actions, múltiplas raízes de
workspace, resolução de recursos (imagens) — mesma lacuna já registrada no
preview do P10.

## P14 — Export PDF isolado + DOCX ✅

Ver [ADR 0019](adr/0019-export-pdf-docx.md). PDF já existia, mas só no CLI;
chega ao desktop isolado num processo próprio, pelo mesmo motivo que a
compilação já é (ADR 0014). DOCX nasce como renderer novo sobre a mesma
Publication AST que HTML e PDF já consomem — nenhuma regra de numeração,
citação ou referência reimplementada.

- [x] `packages/renderer-pdf`: `gerarPdf` extraído de `apps/cli` antes de
      duplicar no desktop, agora sempre devolvendo bytes (`path` é só efeito
      colateral opcional)
- [x] `packages/renderer-docx`: `renderizarDocx(doc): Promise<Buffer>` via
      `docx` (MIT) — percorre a mesma árvore que `renderer-html`; matemática,
      número de página no sumário, SVG e notas de fim como parte OOXML
      separada ficam documentados como lacuna, não escondidos
- [x] Exceção de licença revisada e confirmada com o usuário: `jszip`
      (dependência de `docx`) é dual `MIT OR GPL-3.0-or-later` por escolha
      deliberada do autor; registrada em `EXCECOES`
- [x] `apps/cli build --formato docx`, lado a lado com `pdf`/`html`
- [x] `apps/desktop/src/export-service`: novo utility process (mesma forma do
      Compiler Service) — recebe Publication AST + formato, devolve bytes;
      não conhece vault, Electron nem diálogo
- [x] Protocolo: `DesktopWorkspaceService.exportDocument` (expõe a AST crua,
      mesma fonte que `previewEditor`) + `ExportService.export` (protocolo
      próprio tipo compiler) — as duas peças não se conhecem por inteiro;
      quem liga é o canal IPC `editor.export`, só em Main
- [x] Main: diálogo nativo de salvar + escrita do arquivo no destino escolhido
- [x] Desktop: comandos `document.exportPdf`/`document.exportDocx` + botões
      ao lado do Preview
- [x] `tests/p14-export.test.ts`: três testes de integração sobre
      `MessageChannel` real, incluindo geração de PDF via Chromium de
      verdade e DOCX real (assinaturas de arquivo conferidas)
- [x] Verificado manualmente no browser com bridge mockada: botões habilitam
      só com aba ativa, exportação chama o bridge certo e mostra o caminho
- [x] Verificado no Electron real: Export Service usa `process.parentPort`,
      resolve `puppeteer-core`/`pagedjs` como dependências runtime do desktop e
      conclui o smoke com `export: true`

Ficou fora de propósito: progresso/cancelamento de exportação na UI (o
protocolo já suporta `signal`, a UI não expõe botão), rasterização de SVG
para DOCX, notas de fim como parte OOXML separada, alinhamento explícito de
célula de tabela no DOCX.

## P15 — Plugin host isolado (regras de lint) ✅

Ver [ADR 0020](adr/0020-plugin-host-lint.md). "Plugin host isolado" estava na
lista "Além" desde o P0 sem nunca dizer que TIPO de plugin — decisão tomada
perguntando ao usuário antes de desenhar qualquer API: regras de lint
customizadas primeiro (só leem o documento resolvido, não mutam nada),
comandos de editor e formatos de exportação customizados ficam para depois.

- [x] `resolvedDocumentParaDto` extraído de `@abnt/compiler` (antes inline em
      `serializarResultado`) — o Plugin Host reaproveita a mesma serialização
      que o protocolo do compiler já tinha, não duplica
- [x] `@abnt/plugin-api`: contrato `AbntLintPlugin` (mesma forma de
      `RegraDeValidacao`, do outro lado de um processo) + `runLintPlugin`,
      a ponte que um arquivo de plugin chama para falar com o host
- [x] `@abnt/plugin-host`: `PluginHost` roda cada plugin isolado via
      `child_process.fork` — contenção de crash (mesmo espírito de
      `CompilerSupervisor`/`ExportSupervisor` do desktop), não sandbox de
      segurança; documentado como lacuna deliberada, não escondida
- [x] Fronteiras novas: plugin-api e plugin-host só conhecem
      `@abnt/protocol`/`@abnt/document-model`, nunca markdown/standards/
      semantics/compiler
- [x] `folio lint --plugin <caminho>` (repetível); falha de plugin
      (timeout, crash, exceção) vira diagnóstico `PLUGIN-FALHA` de aviso,
      nunca derruba o comando
- [x] `examples/plugins/paragrafo-longo.mjs`: plugin real usando a API de
      verdade, avisa parágrafo com mais de 150 palavras
- [x] `tests/p15-plugins.test.ts`: plugin de exemplo real + três cenários de
      falha (lança, cai no meio do pedido, nunca manda `ready`) + sanity
      check de isolamento de processo de verdade
- [x] Armadilha real documentada: `execArgv: [...process.execArgv, ...]`
      para registrar `tsx` é uma bomba de fork quando o host já roda sob
      `tsx` — descoberta rodando à mão antes de qualquer teste

Ficou fora de propósito: descoberta/instalação de plugins (hoje é um caminho
de arquivo literal), sandbox de segurança real, `--plugin` no comando
`build`, integração no desktop, comandos de editor e formatos de exportação
customizados (as duas alternativas descartadas na decisão de escopo).

## P16 — Conflitos externos para sync local-first ✅

Ver [ADR 0021](adr/0021-conflitos-externos-local-first.md). Esta entrega não
cria uma nuvem: fecha o caminho para vaults alterados por um sincronizador de
arquivos ou editor externo, sem sobrescrita silenciosa.

- [x] `DocumentSessions.resolveExternalConflict`: `keep-local` adota a revisão
      externa como nova base e preserva o draft; `reload-external` descarta o
      draft e recarrega pelo `WorkspaceStorage`
- [x] `EditorSnapshotDto.externalChange` e `editor/resolve-conflict` passam
      por protocolo validado, MessagePort, Workspace Service e preload narrow
- [x] `EditorController.resolveExternalConflict`, incluindo a projeção remota
      usada pelo CodeMirror, sem dar à view autoridade sobre o conteúdo
- [x] Banner de conflito no desktop com comandos reutilizáveis “Manter minha
      versão” e “Recarregar externa”
- [x] Testes de sessão para os dois desfechos e integração MessagePort real:
      alteração externa → conflito → manter local → save intencional

Ficou fora de propósito: transporte cloud, autenticação, CRDT, merge textual,
Git e sincronização bidirecional. Um futuro adapter sync continua abaixo de
`WorkspaceStorage`; não altera o núcleo semântico.

## P17 — Foundation de distribuição ✅

Ver [ADR 0022](adr/0022-build-distribuicao-dist.md). O primeiro recorte de
production hardening remove a dependência de TypeScript em runtime dos bins e
cria uma verificação de artefato; não finge que signing ou o ABI nativo já
estão resolvidos.

- [x] Todos os packages têm export condicional: `development` → `src`, padrão
      → `dist`; `files` restringe o payload publicável a `dist`
- [x] `pnpm build` compila packages e apps em ordem topológica; CLI/LSP usam
      agora `bin` em JavaScript compilado (`dist/bin.js` / `dist/server.js`)
- [x] Build do desktop entra no pipeline de release junto de Main, preload,
      serviços utility e renderer
- [x] `pnpm test:distribution` verifica presença dos artefatos e executa o
      CLI distribuído sem `tsx`, além de validar o bin LSP pelo parser Node
- [x] `pnpm check:release` combina gates, build topológico e smoke; o
      dependency-cruiser continua deliberadamente sobre `src` pela condição
      `development`, não sobre bundles `dist` excluídos
- [x] Execução de source continua explícita pela condição `development`; o
      child process de plugins recebe essa condição sem herdar `execArgv`

Ficou fora de propósito: instaladores por SO, assinatura/notarização,
auto-update, crash reporting remoto, política de retenção de logs e uma matriz
de prebuilds de `better-sqlite3` por SO/arquitetura. Esses itens exigem credenciais,
infraestrutura de release e uma matriz de plataformas; não são seguros para
inferir dentro do código do produto.

## P18 — Matriz nativa Linux x64 ✅

Ver [ADR 0023](adr/0023-matriz-nativa-linux.md). A primeira decisão de release
é deliberadamente pequena: Linux x64 é o único target Tier 1, produzido por
build nativo em `ubuntu-22.04`, sem cross-compilation nem prebuild publicado.

- [x] `native-addon.json` acompanha a cópia privada de `better-sqlite3` do
      Workspace Service: plataforma, arquitetura, Electron, ABI, versão do
      addon e hash do lockfile participam da identidade
- [x] Cache local/CI estritamente chaveado por target + Electron + ABI +
      `better-sqlite3` + lockfile; cache miss recompila e nunca toca o store
      compartilhado do pnpm
- [x] Workspace Service recusa manifesto/runtime incompatíveis antes de abrir
      SQLite e ainda instancia `Database(':memory:')` com o addon privado
- [x] `smoke:native` inicia o Electron construído, abre vault temporário,
      migra/indexa SQLite, pesquisa FTS, abre editor, gera preview e exporta
      PDF real
- [x] Workflow Linux nativo, em runner limpo, publica o addon e manifesto como
      artefato efêmero de auditoria

Ficou fora de propósito: package, installer, signing, notarization,
auto-update, repositório de artefatos de release e targets Windows/macOS/arm64.

## P19 — Package Electron Linux ✅

Ver [ADR 0024](adr/0024-package-electron-linux.md). O primeiro package é um
diretório executável, não assinado, para validar que Folio roda fora do checkout
e do toolchain de desenvolvimento.

- [x] `electron-builder` produz `release/linux-unpacked` para Linux x64, com
      ASAR habilitado e identidade pública `Folio` / `com.folio.academic`
- [x] Stage temporário de produção: bundles `dist` e somente dependências de
      runtime; `tsx`, TypeScript e demais ferramentas de desenvolvimento não
      fazem parte do aplicativo
- [x] Workspace Service e `better-sqlite3` P18 são recursos privados em
      `resources/workspace-runtime`, fora do ASAR; o serviço é iniciado dessa
      raiz para não resolver a cópia Node do monorepo
- [x] `smoke:package` abre o binário distribuído e verifica vault, SQLite/FTS,
      edição persistida/reabertura, preview, PDF e DOCX reais
- [x] CI Linux empacota e executa o mesmo smoke, publicando o diretório apenas
      como artefato efêmero de auditoria

Ficou fora de propósito: AppImage/deb/RPM, assinatura, notarização,
repositório de downloads, auto-update, SBOM e qualquer target além de Linux
x64.

## P20 — Instalador Debian Linux ✅

Ver [ADR 0025](adr/0025-instalador-debian-linux.md). O primeiro instalador de
Folio é propositalmente um único `.deb` não assinado para Linux x64; não há
promessa implícita de suporte para todos os formatos Linux.

- [x] `installer:linux` gera `folio_<versão>_amd64.deb` via `electron-builder`,
      reaproveitando o stage fechado e o addon nativo P18/P19
- [x] metadados Debian, homepage oficial, dependências Electron, launcher e
      associação de janela configurados explicitamente
- [x] símbolo do Folio versionado em SVG e ícones PNG nos tamanhos de desktop
      necessários; o pacote não usa mais o ícone padrão do Electron
- [x] `smoke:installer` extrai o `.deb` em raiz temporária, confere control
      fields/launcher/ícones e executa o binário instalado sem ambiente Node,
      pnpm, tsx ou cwd do checkout
- [x] CI Linux produz e smoke-testa o instalador após validar o package P19

Ficou fora de propósito: AppImage/RPM/Flatpak/Snap, assinatura, repositório
APT, publicação, auto-update e VM limpa de distribuição. O smoke por extração
é deliberadamente sem privilégios e não instala nada no sistema do runner.

## P22 — Versionamento e identidade de build ✅

Ver [ADR 0026](adr/0026-identidade-de-build-e-semver.md). O Folio entra na
linha SemVer `0.1.0-dev.0`, sem confundir a versão do produto com a dos
contratos persistidos.

- [x] SemVer definido em ADR; desktop, CLI e LSP distribuíveis usam a mesma
      versão pública de produto
- [x] `build-info.json` versionado no `dist` e nos artefatos contém versão,
      commit, canal, target, Electron, protocolo, schemas e API de plugins
- [x] CI carimba commit/canal sem qualquer segredo de release
- [x] **Ajuda → Informações do sistema** lê DTO validado pela API estreita do
      preload e nunca expõe conteúdo, IDs ou caminhos do vault
- [x] smoke de distribuição exige o manifesto junto dos bundles

Ficou fora de propósito: publicação, tags, assinatura, notarização,
repositório APT e auto-update. P21 foi adiado explicitamente por não haver
autoridade nem credenciais de deploy.

## Features — produto antes de deploy

A sequência P18–P22 permanece como fundação de distribuição experimental.
P21 e os marcos P23–P28 (release, update, observabilidade, supervisão,
hardening e performance de produção) estão **congelados por prioridade** até
o produto estar próximo do uso diário. As features seguem num eixo próprio.

## F1 — Inteligência de linguagem no desktop ✅

Ver [ADR 0027](adr/0027-inteligencia-de-linguagem-desktop.md). O desktop agora
consome o `language-service` real por protocolo, em vez de manter um adapter
remoto vazio.

- [x] completion de citações (inclusive `.bib` resolvido pela sessão) e links
- [x] hover de citações e links
- [x] go to definition (`Mod-Enter`) e find references (`Mod-Shift-Enter`)
- [x] outline e diagnósticos permanecem projeções revisionadas do
      `EditorController`; backlinks usam a consulta global existente
- [x] requests incluem `expectedRevision`; resultado obsoleto é recusado no
      Workspace Service, sem parser/SQLite no renderer
- [x] teste MessagePort cobre o fluxo real e o descarte por revisão

Ficou fora de propósito: Command Palette/Quick Open (F2/F3), picker de
citações, cross-reference picker, rename, code actions e uma UI de Problems
mais ampla.

## F2/F3 — Command Palette e Quick Open ✅

Ver [ADR 0028](adr/0028-command-palette-quick-open.md). O `CommandRegistry`
do desktop agora tem uma superfície de descoberta real, sem criar callbacks
paralelos por componente.

- [x] `Mod+Shift+P` abre Command Palette e executa commands habilitados pelo
      mesmo registry usado por menus e atalhos
- [x] `Mod+P` abre Quick Open com ranking fuzzy por título/nome, caminho e
      recência efêmera de UI
- [x] consulta não vazia enriquece o Quick Open por `workspace.search`/FTS5
      com debounce; React continua sem filesystem ou SQLite
- [x] arquivo selecionado usa `WorkspaceFileId` estável; path é só projeção
- [x] testes cobrem ranking fuzzy, disponibilidade de command e Quick Open

Ficou fora de propósito: histórico persistente, tags, argumentos/macro de
commands, busca estruturada e contribuições de plugins para a palette.

## F11/F12 — Picker e editor de citações ✅

Ver [ADR 0029](adr/0029-citation-picker-editor.md).

- [x] `Mod+Shift+C` abre picker de referência com modo, locator, prefixo e
      sufixo; aplica via command/transação editorial
- [x] clicar numa citação existente abre o mesmo editor para substituir seu
      range autoral
- [x] `@chave [p. 42]` é narrativa com locator; a forma parentética separa
      locator de sufixo livre
- [x] Markdown continua fonte de verdade; parser, compilador e formatação ABNT
      não foram movidos para o renderer

Ficou fora de propósito: citações múltiplas visuais, DOI e edição da biblioteca.

## F26 — Centro de diagnósticos acadêmicos ✅

Ver [ADR 0030](adr/0030-diagnostics-center.md).

- [x] command/palette abre uma visão ampliada de problemas do documento ativo
- [x] contadores de erros, avisos e informações; agrupamento de UI por área
- [x] seleção navega pelo `SourceRange` no `EditorController`
- [x] renderer apenas projeta snapshot revisionado, sem nova validação

Ficou fora de propósito: Problems global multiarquivo, filtros persistentes e
quick fixes, que dependem de `WorkspaceEdit`.

## F18 — Cross-reference Picker ✅

Ver [ADR 0031](adr/0031-cross-reference-picker.md).

- [x] IDs persistidos para seções, figuras, tabelas e equações
- [x] sintaxe autoral `[[ref:<id>]]` reconhecida pelo parser
- [x] `xref.insert` abre picker sobre alvos projetados pelo language service
- [x] consulta IPC revisionada e inserção por `EditorController`

## F24 — Editor de metadados ✅

Ver [ADR 0032](adr/0032-metadata-editor.md).

- [x] formulário de título, subtítulo, autores, orientador, instituição,
      curso, cidade, ano, palavras-chave, idioma, profile e bibliografia
- [x] escrita de volta para frontmatter YAML por transação editorial
- [x] corpo do Markdown e propriedades desconhecidas são preservados

## Onda C — referências de verdade ✅

### F6/F7/F37 — Biblioteca editável e vault-wide ✅

Ver [ADR 0039](adr/0039-biblioteca-gerenciada-csl-json.md).

- [x] `references/library.json` em CSL-JSON é fonte canônica local-first
- [x] CRUD visual com preview ABNT no Workspace Service
- [x] biblioteca global participa de citações mesmo sem `bibliography:`

### F8/F9/F10 — DOI e interoperabilidade ✅

Ver [ADR 0040](adr/0040-intercambio-bibliografico-e-doi.md).

- [x] importação DOI revisável via CSL-JSON normalizado
- [x] import/export BibTeX, RIS e CSL-JSON
- [x] importação local de exportações Zotero; sync/OAuth ficou fora de propósito

### F30 — Saúde das referências ✅

Ver [ADR 0041](adr/0041-saude-de-referencias.md).

- [x] total, citadas, não usadas, chaves ausentes e entradas sem DOI
- [x] projeção derivada, sem novo estado canônico

## F4 — Busca estruturada ✅

Ver [ADR 0033](adr/0033-busca-estruturada.md). Query AST/Planner sobre o
mesmo `WorkspaceIndex` do P11 — nenhuma indexação nova além de
`indexed_blocks` (schema v2) para `has:figure`/`has:table`.

- [x] `cites:@id`, `has:figure`, `has:table`, `has:citation`, `linksto:`,
      `type:markdown`, combináveis por espaço (AND implícito)
- [x] texto livre continua puro FTS5 (`bm25`), sem AST de permeio
- [x] `linksto:` reaproveita `documentTarget` — a mesma resolução de link que
      `definition`/`references`/`backlinks` já usam
- [x] `WorkspaceIndex.citations(fileId?, referenceId?)` filtra no SQL
- [x] `workspace.search()` não mudou de forma; UI não vê o AST

Ficou fora de propósito: OR/NOT/parênteses no AST, UI dedicada de busca
estruturada (usa a mesma caixa da Quick Open).

## F5 — Grafo do workspace ✅

Ver [ADR 0034](adr/0034-workspace-graph.md). Novo pacote
`@abnt/workspace-graph`, grafo sempre derivado on-the-fly.

- [x] nodes `document`/`reference`/`resource`; edges `links-to`/`cites`/`embeds`
- [x] `buildWorkspaceGraph` puro e síncrono, testável sem SQLite/MessagePort
- [x] `workspace/graph` no protocolo do desktop
- [x] `GraphDialog`: layout circular escrito à mão, sem dependência nova
- [x] clique num nó documento abre o arquivo

Ficou fora de propósito: layout de força/física, filtro por tipo de nó na UI.

## F31 — Citation Explorer ✅

Ver [ADR 0035](adr/0035-citation-explorer.md). Exigiu resolver bibliografia
do vault inteiro pela primeira vez — P12 só resolvia por documento aberto.

- [x] `scanBibliographyDeclarations`: pré-filtro por frontmatter (regex+YAML,
      nunca `@abnt/markdown`) antes de abrir qualquer sessão
- [x] resolução real reaproveita o pipeline de compilação existente, em
      lote, fechando as sessões que abriu (`sessions.idle()` evita a corrida
      do `autoCompile` fire-and-forget)
- [x] `citationExplorer()`: citações agrupadas por referência, localizadas
      por seção via `index.headings()`, com lista de referências nunca citadas
- [x] painel `citationExplorerPanel`, vault-wide (não depende de `view`)

Ficou fora de propósito: cache do catálogo por revisão de arquivo.

## F32 — Backlinks 2.0 / menções não linkadas ✅

Ver [ADR 0036](adr/0036-mencoes-nao-linkadas.md). Sempre sugestão — nunca
edita o documento sozinho.

- [x] `WorkspaceIndex.documentTitles()`; `LanguageService.unlinkedMentions()`
      exclui ocorrências dentro do `source` range de `link`/`citation`
      existentes, sem rastrear contexto de pai na árvore
- [x] varredura limitada ao documento ativo, sob demanda, revisionada
- [x] seção colapsável dentro do painel de Backlinks existente
- [x] "Transformar em link" é uma transação editorial só sob clique explícito
      (comando `mention.linkify`)

Ficou fora de propósito: heurística além de substring case-insensitive,
sugestão de link para âncoras de seção.

## F33 — Grafo acadêmico (pessoas) ✅

Ver [ADR 0037](adr/0037-grafo-academico.md). Depende do catálogo que o F31
constrói, não só do F5 — por isso veio depois na sequência real de trabalho.

- [x] `buildWorkspaceGraph` aceita `bibliography` opcional: nós `person` e
      aresta `authored-by` a partir de `author`/`editor`
- [x] `includePeople` opt-in no protocolo — custo de resolver bibliografia
      vault-wide só quando pedido
- [x] slug de pessoa normalizado (diacríticos, minúsculas) para convergir
      autores repetidos entre `.bib`s diferentes
- [x] checkbox "Incluir pessoas" no `GraphDialog`

Ficou fora de propósito: nó `organization` (o modelo bibliográfico não tem
esse campo estruturado ainda), desambiguação de pessoas homônimas.

## F34 — Literature Notes ✅

Ver [ADR 0038](adr/0038-literature-notes.md). Exigiu uma primitiva de storage
que não existia: criar arquivo novo.

- [x] `WorkspaceStorage.create()` — mesma checagem de colisão de `rename()`,
      mesma escrita atômica de `write()`, emite `workspace:file-created`
- [x] correção de `errorFor()`: `WorkspaceAlreadyExistsError` → `CONFLICT`
      (bug latente também para `rename()`, corrigido junto)
- [x] vínculo autoritativo é a citação `[@id]` no corpo, não o frontmatter —
      reaproveita busca estruturada, Citation Explorer e grafo de graça
- [x] idempotente por path (`papers/{referenceId}.md`); reabre em vez de
      sufixar em colisão
- [x] botão "Criar nota de leitura" no painel de Referências

Ficou fora de propósito: template customizável de literature note.

## Onda D — autoria confortável

- [x] **F13/F14/F15 — figuras e recursos desktop**: `figure.insert`, seletor
      nativo e drag-and-drop copiam imagens para `assets/` através do Workspace
      Service; Markdown guarda somente URI relativa e preview/export resolve
      imagem como projeção data URI.
- [x] **F16 — Table Editor**: diálogo visual para inserir tabela GFM, ajustar
      linhas/colunas e alinhamento; o resultado continua Markdown comum.
- [x] **F17 — Math UX**: inserção de equação com ID, preview pelo pipeline de
      publicação/KaTeX, referências cruzadas e completions TeX sob `\\`.
- [x] **F19 — Outline**: navegação, seção ativa e recolhimento de subseções;
      alterações de fonte sempre seguem transação editorial.
- [x] **F20 — Rename semântico**: `WorkspaceEdit` revision-safe para chaves
      de citação e identificadores de referências cruzadas, inclusive em
      documentos fechados no vault.
- [x] **F21 — Code Actions**: diagnóstico de chave bibliográfica ausente pode
      criar, sob clique explícito, entrada mínima editável na biblioteca local.
- [x] **F22 — Templates**: cria documentos Markdown normais no vault, sem
      tipo especial no `document-model`.
- [x] **F28/F29 — contagem e estatísticas**: projeção revisionada do Language
      Service para palavras, caracteres, parágrafos, citações, figuras,
      tabelas, equações e tempo de leitura.

## Além

## Onda E — leitura e pesquisa

- [x] **F35 — PDFs como recursos de pesquisa**: PDF selecionado no desktop é
      copiado para `resources/papers/`, associado à referência por
      `references/attachments.json` e pode ser aberto ou revelado sem expor
      path absoluto ao renderer. Ver ADR 0042.
- [x] **F36 — leitor PDF interno**: fecha o ciclo `Referência → PDF →
      highlight → annotation → Literature Note → citação`. Não é apenas um
      visualizador: a fonte continua o PDF local anexado e as anotações são
      dados operacionais separados de `library.json`.
  - [x] **F36.1 — viewer**: páginas, zoom, thumbnails, busca textual, página
        atual e “ir para página”, sem expor path absoluto ao renderer.
  - [x] **F36.2 — seleção**: copiar e criar annotation, capturando página e
        trecho selecionado.
  - [x] **F36.3 — highlights**: persistir destaque, comentário opcional e
        localização no PDF; permitir navegar da annotation de volta ao trecho.
  - [x] **F36.4 — literature notes**: enviar uma annotation para a nota de
        leitura como Markdown comum, com página/origem e vínculo navegável nos
        dois sentidos.

Annotations vivem em `references/annotations.json`, local-first e separadas da
bibliografia CSL-JSON. O renderer recebe bytes pelo protocolo validado, nunca
um path absoluto ou `file://`. Ver ADR 0045.

## Onda F — autoria institucional

- [x] **F23 — templates institucionais**: artigo e TCC institucionais são
      Markdown comum com defaults de metadata e profile; ver ADR 0043.
- [x] **F25 — Profile selector**: desktop mostra os profiles embarcados e
      persiste a escolha no frontmatter YAML.
- [x] **F27 — Problems panel**: tabela filtrável de severidade, documento,
      linha, regra e mensagem; a navegação usa o diagnóstico revisionado.

## Navegação de IDE

- [x] **F38 — histórico e recentes**: `Alt+Left`/`Alt+Right` recuperam
      posição e seleção; recentes persistem por vault como preferência local
      de UI, nunca em SQLite ou no documento. Ver ADR 0044.
- [x] **F39 — split de dois editores**: duas views podem mostrar o mesmo
      documento ou documentos distintos, com seleção independente e uma única
      sessão autoritativa por `fileId`.
- [x] **F40 — multi-window**: menu, Command Palette e `Ctrl/Cmd+Shift+N`
      abrem uma nova janela que restaura o mesmo vault. `open()` é idempotente
      para a raiz já ativa, portanto não descarta sessões/controladores da
      primeira janela; o Workspace Service continua único. Ver ADR 0046.

## Próximo ciclo de produto

O foco deixa de ser aumentar superfícies isoladas e passa a completar o ciclo
acadêmico `Read → Annotate → Relate → Cite → Write → Validate → Publish`.
Escrita, validação e publicação já estão mais maduras que leitura e anotação;
por isso F36 precede novas integrações de janela ou deploy.

### Onda G — leitura acadêmica e anotações ✅

- [x] **F36 — PDF Reader interno**: F36.1–F36.4 concluídas; futuras features
      podem consumir annotation↔literature note sem criar uma segunda fonte de
      verdade para a referência.

### Onda H — Knowledge Workspace avançado ✅

- [x] **F41 — Tags**: tags em Markdown ou frontmatter são projetadas para o
      Query AST; `tag:metodologia` não envolve SQL no React.
- [x] **F42 — properties/metadata search**: filtros estruturados como
      `author:`, `year:`, `profile:`, `lang:` e `tag:` planejados no mesmo
      Query Planner de F4.
- [x] **F43 — saved searches**: salvar consultas como views operacionais do
      workspace, nunca como conteúdo autoral nem metadado escondido em SQLite.
- [x] **F44 — collections**: agrupar documentos/referências por projeto ou
      fluxo sem mover arquivos automaticamente; metadata operacional local.

F43/F44 vivem como preferência local por vault do desktop; não alteram o
Markdown nem o índice SQLite descartável. Ver ADR 0047.

### Onda I — workflow de revisão bibliográfica ✅

- [x] **F45 — Reading Queue**: estados locais `to-read`, `reading`, `read` e
      `reviewed` para referências.
- [x] **F46 — Reference Notes Dashboard**: projetar, por referência, PDF,
      note, citações, última leitura, DOI e autores.
- [x] **F47 — Literature Review Matrix**: visão tabular derivada de
      referências e properties de literature notes (tema, método, amostra,
      resultado e nota), sem criar outro modelo bibliográfico.
- [x] **F48 — Citation Context**: estender Citation Explorer com o trecho de
      cada uso, agrupado por seção e navegável.

F45 é preferência local por vault; F46/F47 vêm do `Workspace Service`, que
cruza biblioteca canônica, anexos, notas e o índice descartável. F48 calcula o
trecho no host, a partir dos ranges indexados, e o renderer apenas navega pela
projeção. Ver ADR 0048.

### Onda J — escrita acadêmica assistida estruturalmente ✅

- [x] **F49 — Document Structure Navigator**: projeção de profile + documento
      que evidencia seções esperadas e faltantes de artigo/TCC; não altera o
      `document-model`.
- [x] **F50 — Requirement Checklist**: checklist derivado dos diagnostics
      existentes, com links para a origem de cada requisito.
- [x] **F51 — Academic Writing Goals**: metas locais para resumo, capítulos e
      produção diária, apoiadas em statistics e sem alterar o documento.
- [x] **F52 — Session Writing Progress**: palavras, tempo e citações da sessão
      como estado local de UI/workspace.

F49/F50 são projeções de outline e diagnostics revisionados. F51/F52 vivem em
preferências locais por documento/vault; `writingStatistics` passou a projetar
palavras por seção no Language Service para suportar metas de resumo e
capítulos sem parsing no renderer. Ver ADR 0049.

### Onda K — referências e deduplicação ✅

- [x] **F53 — Duplicate detection**: sugerir possíveis duplicatas por DOI,
      ISBN, similaridade de título e autor+ano; jamais mesclar automaticamente.
- [x] **F54 — Merge References**: revisão de campos e escolha de canônica,
      seguida de `WorkspaceEdit` revision-safe para renomear citações no vault.
- [x] **F55 — Reference Key Management**: políticas de chave, preview e rename
      vault-wide usando a infraestrutura semântica de F20.

F53 retorna pares e razões explicáveis, sem efeito colateral. F54 exige uma
entrada revisada e uma chave canônica; a transação troca citações, atalhos de
literature notes, PDFs e anotações antes de consolidar o CSL-JSON. F55 oferece
preview por política e aplica rename pelo mesmo `WorkspaceEdit` revision-safe
do Language Service. Ver ADR 0050.

### Onda L — grafo útil no trabalho diário ✅

- [x] **F56 — Graph filters**: filtrar documentos, referências, pessoas,
      recursos, tags e tipos de aresta.
- [x] **F57 — Local Graph**: vizinhança de um documento por profundidade 1/2.
- [x] **F58 — Force-directed layout**: layout determinístico em memória, sem
      dependência de visualização ou estado persistido.
- [x] **F59 — Graph search/highlight**: localizar, destacar e navegar nós do
      grafo filtrado.

Tags chegam ao grafo como uma projeção opcional do mesmo scanner de metadata
da Onda H; `workspace.graph` pode reduzir uma resposta ao entorno não
direcionado do documento ativo. Filtros, busca, destaque e layout são apenas
apresentação no renderer: não há parser Markdown, I/O ou SQLite nessa camada.
O layout é force-directed determinístico e limitado a 180 nós visíveis para
preservar a responsividade sem adicionar uma dependência de licença a avaliar.
Ver ADR 0051.

### Onda M — transclusão e composição documental ✅

- [x] **F60 — Embeds**: `![[arquivo.md]]` é inclusão; links Markdown normais
      mantêm sua semântica de navegação.
- [x] **F61 — Section embeds**: `![[arquivo.md#Seção]]` seleciona a seção até
      o próximo heading de mesmo nível ou superior.
- [x] **F62 — Modular TCC**: raiz `index.md` publica capítulos Markdown
      separados; o desktop cria esse conjunto pelo comando de template.

A expansão é uma projeção de fonte pura, injetada pelo host antes do compiler.
Ela detecta ciclos, módulos/seções ausentes e tenta escapar do vault; frontmatter
de capítulos não se mistura à metadata da raiz, e URIs relativas são rebased
para preservar recursos no preview/PDF/DOCX. A Document AST não ganhou um nó
de vault nem dados derivados. Ver ADR 0052.

### Onda N — revisão e histórico

- [x] **F63 — File history via Git adapter**: integração opcional, nunca
      requisito para abrir um vault.
- [x] **F64 — Visual diff**: comparar versões por linhas e, depois, por
      estrutura quando houver base semântica suficiente.
- [x] **F65 — Snapshot manual**: snapshots locais opcionais para vaults sem
      Git.

Git é consultado somente quando já existe; snapshots manuais vivem em
`.academic/history`, e o renderer recebe apenas revisões e linhas do diff.
Ver ADR 0053.

### Onda O — fonte composta e navegação estrutural ✅

- [x] **F66 — Composite Source Map**: `@abnt/source-composition` mapeia a
      fonte virtual (F60–F62) de volta ao arquivo e offset autorais reais,
      plano mesmo com embeds aninhados; diagnósticos de composição (ciclo,
      embed ausente, seção ausente, URI inválida) passaram a carregar a
      origem de quem escreveu o embed.
- [x] **F67 — Diagnostics remapeados**: `CompilationEnvironmentResolver.
      remapCompositionDiagnostics` reescreve `documentId`/offset de um
      diagnóstico do compiler sobre a fonte composta para o arquivo real antes
      de a sessão publicá-lo; `Workspace Problems` preserva `fileId`, heading
      e range autorais para a navegação do desktop.
- [x] **F68 — Navegação através de embeds**: `workspace-index` schema v3
      (`indexed_identifiers`/`indexed_xrefs`) sustenta
      `definition`/`references`/`hover` de `[[ref:id]]` vault-wide no
      `WorkspaceLanguageService` — não usa `CompositeSourceMap` (não precisa:
      navegação trabalha com offsets autorais de arquivos já indexados, não
      com a fonte virtual de compilação).
- [x] **F69 — Cross-file refactor**: infraestrutura já existia desde F20
      (Onda D) — `rename()` escaneia todos os `.md` do vault por texto, nunca
      pela fonte composta, então nunca precisou de F66. Cenário modular
      literal do roadmap coberto em `tests/f69-cross-file-rename.test.ts`.
- [x] **F70 — Structural Diff**: `@abnt/structural-diff` compara duas
      revisões do MESMO arquivo (não a fonte composta) por fatos com chave
      estável — seção/citação/figura/tabela/link/metadado adicionado, removido
      ou alterado — nunca um dump de árvore. `workspace/history-structural-diff`
      complementa `historyDiff` (F64) sem substituí-lo.

O mapa (F66) nunca cruza processo: é construído e consumido dentro do host de
composição, e só o efeito (um `DiagnosticDto.source` já corrigido) atravessa o
protocolo, na mesma forma de DTO que já existia — nenhum schema novo. Ver ADR
0054 (F66/F67) e ADR 0055 (F68/F69/F70).

**O-UI — superfície desktop concluída:** o modo de revisão abre o módulo
autoral e seleciona seu range ao clicar em Problems, inclusive para diagnóstico
de TCC composto; o histórico expõe `Text Diff | Structural Diff` sobre a mesma
revisão. A interface só projeta DTOs do host, sem abrir fonte virtual ou
reconstruir o diff. Diff estrutural da fonte composta inteira (`index.md` com
capítulos) continua fora: exigiria rodar a composição dentro do fluxo de
histórico, que hoje só compara texto já em mãos.

### Onda P — query language e descoberta avançada ✅

- [x] **F71 — Boolean Query AST**: `OR`, `NOT`, parênteses e `AND` explícito
      ou implícito são parser/planner do `language-service`, sobre os mesmos
      predicados estruturados e projeções FTS5/SQLite do F4.
- [x] **F72 — Search View dedicada**: superfície acadêmica para consulta,
      filtros, contagem, documento, seção e snippet; Quick Open permanece
      simples.
- [x] **F73 — Section-level search**: hit textual recebe o heading do outline
      indexado que o contém; o renderer só consome o DTO.
- [x] **F74 — Smart unlinked mentions**: normalização de diacríticos, limites
      de palavra, títulos de documento/seção e títulos/autores bibliográficos;
      documento sugere link e bibliografia sugere citação, sempre com
      confirmação do usuário. Aliases aguardam formato autoral explícito.
- [x] **F75 — Search actions**: abrir, abrir ao lado, adicionar à collection,
      criar busca salva e copiar link são Commands — não callbacks especiais
      da Search View.

Ver ADR 0056. A busca não ganhou uma fonte de verdade nova: índice segue
descartável, arquivos seguem autoria e buscas/collections seguem estado
operacional local.

### Onda Q — citações e bibliografia avançadas ✅ (F78 opcional adiado)

- [x] **F76 — Multiple Citation Editor**: o picker edita grupo ordenado de
      referências e serializa uma única transação para Markdown; não mantém
      banco próprio de citações.
- [x] **F77 — Locator UX**: cada item seleciona apenas `page`, `chapter`,
      `section`, `paragraph`, `volume`, `issue`, `figure` ou `table`, tipos
      já suportados pelo parser/semântica.
- [ ] **F78 — Citation Intent**: adiado como feature opcional até existir store
      operacional revisionado próprio; não será inscrito automaticamente na
      citação publicada.
- [x] **F79 — Organization entities**: `CslName.literal` projeta nós
      `organization` no grafo, sem inferir instituição de uma string livre.
- [x] **F80 — Person disambiguation**: homônimos não são fundidos sem
      identificador forte; a projeção explicita `resolved`, `possible-match` ou
      `ambiguous` e não altera CSL-JSON.
- [x] **F81 — Bibliography audit**: Reference Health separa qualidade
      bibliográfica de diagnóstico normativo e verifica DOI/ISBN, URL/acesso,
      autoria/ano, duplicata, chave, PDF e literature note.
- [x] **F82 — Literature Note templates**: `templates/literature-note.md`
      aceita placeholders controlados, sem JavaScript arbitrário.

Ver ADR 0057.

### Onda R — revisão e edição acadêmica ✅

- [x] **F83 — Workspace Problems**: o Workspace Service agrega diagnósticos
      revisionados para o vault inteiro; React apenas filtra/navega DTOs.
- [x] **F84 — Persistent Problems filters**: severidade, categoria e escopo
      persistem como preferência operacional local por vault.
- [x] **F85 — Quick Fix framework**: diagnóstico produz ações somente quando
      há `WorkspaceEdit` mecânico, seguro e revisionado.
- [x] **F86 — Review comments**: comentários editoriais locais guardam
      `fileId`, range e revisão, sem entrar no Markdown.
- [x] **F87 — Review mode**: Problems, comentários e quick fixes usam a mesma
      superfície integrada.
- [x] **F88 — Change navigation**: Command Registry navega diagnósticos e
      comentários sem atalhos acoplados ao DOM.
- [x] **F89 — Document comparison**: Workspace Service compara dois documentos
      em texto e estrutura; o renderer apenas escolhe arquivos e projeta DTOs.

Ver ADR 0058.

### Onda S — plataforma de plugins de produto ✅

- [x] **F90 — Plugin discovery local**: `.academic/plugins/<plugin>/plugin.json`
      é descoberto no Workspace Service; manifesto, versão de API e entry são
      validados antes de qualquer execução.
- [x] **F91 — Desktop plugin integration**: desktop lista, habilita,
      desabilita e recarrega plugins; falhas ficam visíveis e não derrubam o
      workspace. Estado de habilitação é operacional por vault.
- [x] **F92 — Plugin commands**: contribuições declarativas entram no único
      Command Registry; plugins nunca registram atalhos no DOM.
- [x] **F93 — Plugin views**: views são descritores restritos (`title` e
      texto), não componentes React arbitrários no renderer.
- [x] **F94 — Plugin language contributions**: primeira capability de
      linguagem é diagnóstico read-only sobre `ResolvedDocumentDto`
      revisionado; falhas viram `PLUGIN-FALHA` de aviso.
- [x] **F95 — Plugin export contributions**: plugin recebe Publication AST e
      retorna conteúdo textual; Main abre o diálogo nativo e salva o destino.
      Plugin não altera silenciosamente a Document AST.

Ver ADR 0059.

### Onda T — ecossistema de profiles ✅ até F101

- [x] **F96 — Profile manifest**: o registro do compiler expõe metadata
      declarativa e versionada (identidade, tipo documental, citações,
      metadados, regras e página) por DTO validado.
- [x] **F97 — Profile capabilities**: capabilities e metadados obrigatórios
      orientam UI sem importar implementações normativas no renderer.
- [x] **F98 — Profile inspector**: desktop mostra profile, regras ativas,
      metadata, página e composição a partir dos manifests do Compiler Service.
- [x] **F99 — Institutional profile composition**: `institutional-tcc` prova
      composição explícita sobre `abnt-tcc`, sem herança dinâmica ou AST nova.
- [x] **F100 — Profile comparison**: inspector compara diferenças editoriais
      declaradas entre dois profiles.
- [x] **F101 — Profile validation preview**: avaliação seca revision-safe
      informa o impacto antes de escrever o profile no frontmatter.
- [ ] **F102 — Nova família acadêmica real**: aguarda escolha explícita de
      produto/mercado; não selecionar APA, IEEE, Vancouver ou equivalente por
      reflexo técnico.

Ver ADR 0060.

### Onda U — Research Projects ✅

- [x] **F103 — Research Project**: iniciativa acadêmica operacional por vault,
      independente de pasta e de frontmatter.
- [x] **F104 — Project Membership**: documentos, referências, collections,
      buscas salvas e notas são vinculados por IDs e podem participar de vários
      projetos sem duplicação.
- [x] **F105 — Project Dashboard**: Workspace Service projeta palavras,
      revisões e diagnósticos por FileId; desktop agrega leituras e referências
      sem criar banco de analytics.
- [x] **F106 — Milestones**: marcos e prazos são estado operacional local.
- [x] **F107 — Project Goals**: metas de palavras, leitura, referências e zero
      erros reaproveitam as projeções existentes.
- [x] **F108 — Submission Targets**: alvo, profile, deadline, outputs e
      checklist são associados ao projeto, sem alterar publicação autoral.
- [x] **F109 — Project Archive**: arquivar só oculta das listas ativas e
      preserva todos os vínculos.

Ver ADR 0061.

Release operations (packaging, installers, signing, update e observabilidade).
Nada disso deve alterar o núcleo semântico; é essa propriedade que o M4 existe
para verificar.

## Dívida conhecida

- Linux x64 tem `linux-unpacked` e `.deb` validados, mas assinatura,
  repositório APT, auto-update e qualquer target adicional continuam pendentes.
- O produto usa SemVer `0.1.0-dev.0`; P23 ainda precisa decidir a promoção de
  versão, tags e publicação de artefatos.
- `nomeDePessoa` em `markdown/src/metadata.ts` ainda é heurística para autores
  do próprio documento. Nomes bibliográficos já usam o parser estrutural do M2.
- Node 20 no ambiente; Vite 7 e ferramentas recentes pedem 20.19+ — estamos
  exatamente no limite.
- Descoberto ao investigar F62 durante a Onda O, **causa raiz confirmada**:
  em Node 22.x (não o 20.19 documentado acima), `fs.watch(root, { recursive:
  true })` — usado por `WorkspaceStorage.subscribe()`
  (`packages/workspace-local`), disparado por qualquer `SqliteWorkspaceIndex.
  open()` — segfaulta (`SIGSEGV`) de forma assíncrona depois do teste que o
  disparou, derrubando testes não relacionados que rodam depois no mesmo
  processo/worker do Vitest (afeta ~27 arquivos de teste que abrem índice ou
  vault real: P3, P5, P8, P11, P12, F4, F5, F30–F37 etc. — não é específico
  de F66–F70). **Rodar a suíte sob Node 20.19 elimina o problema por
  completo** — `pnpm check` fecha 58 arquivos/206 testes e regressão visual,
  todos verdes (`nvm install 20.19.0 && nvm use 20.19.0` antes de `pnpm
  check`/`pnpm test`). Continua valendo a recomendação de evitar
  `subscribe()` em testes puramente de composição
  (`tests/f66-composite-source-map.test.ts`), mas não é mais necessário para
  os demais: o ambiente documentado (20.19) já resolve.
- O build do desktop isola uma cópia Electron-específica de `better-sqlite3`
  em `dist/workspace/node_modules`, sem alterar o binding Node usado pelos
  testes. Por enquanto, a matriz oficial é somente Linux x64; qualquer expansão
  exige novo ADR e runner nativo correspondente.
- P21 e P23–P28 de release/produção (incluindo logs, crash reporting e backoff
  de processos) estão congelados por prioridade de produto. Não interpretar a
  base experimental Linux como compromisso de deploy público.
- Cada edição devolve o `EditorSnapshot` inteiro pelo IPC. Projeções pequenas
  por evento são P9; ver ADR 0014.
