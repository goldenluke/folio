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
- [ ] **F78 — Citation Intent**: fundação de domínio criada em
      `@abnt/citation-intents`, com tipos `support`, `contrast`, `background`,
      `method` e `definition`, validação defensiva e operações idempotentes;
      a integração com store/protocolo revisionado permanece opcional e não
      inscreve intenção automaticamente na citação publicada. Cobertura em
      `tests/f78-citation-intents.test.ts`.
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
- [~] **F102 — Nova família acadêmica real**: APA 7ª edição foi selecionada
      como segunda família; implementação inicial em andamento.

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

### Onda V — Automation & Commands ✅

- [x] **F110 — Command arguments**: commands podem declarar argumentos
      runtime-validated; sem schema, nenhum objeto arbitrário é aceito. A
      validação acontece antes da execução, inclusive quando o invocador é uma
      macro local.
- [x] **F111 — Custom keybindings**: preferência local por vault associa
      chord normalizado a `CommandId`; colisões são apresentadas ao usuário e
      só substituem o binding após confirmação explícita.
- [x] **F112 — Command chains**: o planner constrói chains sequenciais a
      partir de commands registrados e só chama o próprio `CommandRegistry`.
- [x] **F113 — Macros**: macros locais guardam nome, `CommandId` e argumentos
      JSON. Não aceitam JavaScript, shell, PowerShell, `eval` nem callbacks.
- [x] **F114 — Workspace actions**: contexto de command carrega uma seleção
      explícita de `WorkspaceFileId`s para ações sobre documentos, sem inferir
      paths ou tocar filesystem no renderer.
- [x] **F115 — Batch operations**: a superfície permite validar uma seleção
      pelo Workspace Service e adicionar documentos a uma collection com alvo
      explícito e argumentado.
- [x] **F116 — Automation preview**: antes de uma macro/ação executar, o
      usuário vê seus efeitos; salvar e exportar requerem confirmação. As
      operações continuam passando pelos controllers, transações e serviços
      já responsáveis por elas.

Ver ADR 0062.

### Onda W — Sync Preparation (sem cloud) ✅

- [x] **F117 — State Classification**: autoria, estado operacional portátil,
      preferência de máquina e projeção reconstruível são políticas fechadas
      de `workspace-core`; SQLite/FTS nunca é candidato a sync.
- [x] **F118 — Portable Workspace Metadata**: `PortableWorkspaceState` é
      envelope JSON versionado para estado operacional portátil, separado de
      Markdown, `library.json` e SQLite.
- [x] **F119 — Storage Capabilities**: `WorkspaceStorage` declara garantias
      de atomicidade, watch, binários, comparação de revisão e conditional
      write; consumidores não usam `instanceof LocalFilesystemStorage`.
- [x] **F120 — Conflict Taxonomy**: conflitos de texto, referências,
      annotations, projetos, collections, workspace state, delete/edit e
      rename/edit têm resolução manual explícita; entidade não vira text merge.
- [x] **F121 — Conditional Writes**: a borda de sync compara revisão esperada
      antes de escrever e expõe conflito de revisão sem sobrescrever estado.
- [x] **F122 — Sync Adapter Contract**: contrato abstrato prevê
      list/read/write e operações condicionais de rename/delete/revision/
      subscribe/poll conforme capabilities, ainda sem adapter de rede.
- [x] **F123 — Sync Simulation**: dois adapters em memória demonstram
      replicação de estado compartilhável e conflitos explícitos sem rede.

Ver ADR 0066.

### Onda X — Research Capture & Intake ✅

- [x] **F124 — Universal Import**: uma única superfície recebe BibTeX, RIS,
      CSL-JSON, DOI, URL e PDF, encaminhando cada formato pelo adapter
      apropriado antes de qualquer gravação canônica.
- [x] **F125 — Reference Inbox**: candidatos entram como `unreviewed` no
      estado operacional local do vault; importar não altera `library.json`.
- [x] **F126 — PDF Intake**: drag-and-drop calcula SHA-256, procura apenas
      DOI literalmente presente nos bytes e mantém o PDF pendente até a
      confirmação; não há OCR nem metadata inventada.
- [x] **F127 — Metadata Resolution**: DOI preserva proveniência do provider,
      PDF registra DOI literal/ausência e URL é capturada sem scraping frágil.
- [x] **F128 — Duplicate-aware Import**: candidatos usam os mesmos sinais
      explicáveis de DOI/ISBN/título/autor-ano e oferecem criar ou anexar ao
      registro canônico já existente.
- [x] **F129 — URL Reference Capture**: HTTP(S) cria candidato `webpage` com
      URL e data de acesso; provider não vira modelo interno.
- [x] **F130 — Intake Review Queue**: a inbox apresenta totais, lacunas e
      duplicatas. Confirmar chama a biblioteca canônica, anexa o PDF pelo
      Workspace Service e adiciona a referência à fila de leitura.

Ver ADR 0063.

### Onda Y — Submission & Publishing Workflow ✅

- [x] **F131 — Submission Target**: Project associa profile, prazo,
      artefatos e requisitos como estado operacional, sem alterar o Markdown.
- [x] **F132 — Preflight**: a tela agrega diagnósticos revisionados,
      estatísticas estruturais e Reference Health existentes; não cria um
      segundo validador no renderer.
- [x] **F133 — Artifact Set**: um registro final pode gerar PDF, DOCX e HTML
      para cada documento do projeto; arquivos suplementares continuam
      autoria vinculada e são confirmados explicitamente no checklist.
- [x] **F134 — Export Presets**: presets locais aplicam um conjunto de
      formatos ao alvo, sem ganhar autoridade sobre profiles ou publicação.
- [x] **F135 — Submission Snapshot**: antes de exportar, Folio cria snapshots
      operacionais por documento e os vincula ao registro de submissão.
- [x] **F136 — Final Review**: a revisão exibe erros, avisos, citações,
      referências/xrefs não resolvidas, figuras e tabelas.
- [x] **F137 — Reproducible Publication Record**: o registro guarda revisão e
      hash autoral, profile/versão e hashes SHA-256 dos artefatos, sem copiar
      o conteúdo-fonte.

Ver ADR 0064.

### Onda Z — coesão diária do workspace ✅

- [x] **F138 — Home**: ao abrir um vault, Home reúne documentos recentes,
      projetos, fila de leitura, marcos, problemas e progresso sem criar um
      dashboard analítico independente.
- [x] **F139 — Research Dashboard**: Read–Annotate–Write mostra fila,
      PDFs, annotations ainda sem literature note e notas existentes a partir
      dos DTOs já projetados pelo Workspace Service.
- [x] **F140 — Unified Activity**: atividade operacional local registra tipos
      mínimos de ação sem conteúdo de documentos, e nunca vira log autoral.
- [x] **F141 — Contextual Sidebar**: o mesmo registro de painéis compõe o
      contexto do documento ou do workspace; pesquisa, referências e projetos
      continuam superfícies da mesma shell, não três aplicações paralelas.
- [x] **F142 — Focus Modes**: Escrita, Leitura, Revisão e Pesquisa alteram
      somente a composição de navegação e contexto.
- [x] **F143 — Workspace Layouts**: layouts salvos são preferências locais por
      vault, aplicadas sem mudar tabs, sessões ou documentos.
- [x] **F144 — Onboarding**: primeiro uso explica o vault local-first e leva
      a abrir pasta, criar documento/TCC ou importar referências.
- [x] **F145 — Command Discoverability**: a única Command Palette ganha
      categorias, aliases, recência, atalhos e filtragem por disponibilidade.

Ver ADR 0065.

Release operations (packaging, installers, signing, update e observabilidade).
Nada disso deve alterar o núcleo semântico; é essa propriedade que o M4 existe
para verificar.

## F146+ — próximo ciclo de produto (em andamento — ver progresso por onda abaixo)

O baseline chega até F145, com F102 deliberadamente aberto (aguarda escolha
de uma segunda família acadêmica). Nove eixos para o próximo ciclo — não como
fila linear: algumas são fundações transversais, outras dependem claramente
delas. A ordem de implementação recomendada não é a ordem alfabética das
letras:

```
AA Product Hardening
      ↓
AB AI local foundation
      ↓
AC Systematic Review
      ↓
AD Research Data
      ↓
AE Extensions 2.0
      ↓
AF Cloud/Sync
      ↓
AG Collaboration
      ↓
AH Submission Integrations
```

F102 (segunda família acadêmica) fica fora dessa sequência automática — só
entra quando houver decisão comercial concreta de mercado/norma.

**Ponto de nova pausa:** implementar AA, AB e AC primeiro e reavaliar. Essas
três têm a maior chance de aumentar o valor do Folio sem introduzir de
imediato a complexidade operacional de cloud/colaboração. O produto já tem
Projects, intake, workflow de submissão, profiles, automação e coesão diária
(concluído até F145); o próximo salto não é "mais um painel" — é usar essa
infraestrutura para pesquisa científica mais profunda: IA assistida com
controle explícito, revisão sistemática e rastreabilidade de dados.

### Onda AA — Product Hardening & Performance (em andamento — F146 concluído)

Antes de somar cloud, IA ou colaboração: uma rodada ampla para transformar a
quantidade grande de features já existentes num produto fluido.

- [x] **F146 — Performance Observatory**: `apps/desktop/src/renderer/shell/
      performance.ts` grava duração em memória do processo renderer (sem
      disco, sem rede — reiniciar o app limpa a amostra) para startup,
      vault-open (só o caminho sem diálogo nativo — `restoreLast()`, não
      `chooseAndOpen()`, que fica contaminado por tempo de resposta humana),
      abertura de editor, preview (compile fica implícito nele — não há um
      gatilho de "compile" isolado no desktop), busca, grafo, PDF load/search,
      export PDF/DOCX (rotulado como "com diálogo de salvar": o IPC de export
      não separa compilação do diálogo nativo, então a duração inclui a
      escolha do usuário — não há hoje fronteira de protocolo para separar as
      duas coisas), project dashboard e Home. `PerformanceObservatoryDialog`
      (comando `performance.open`, no menu "•••" e na Command Palette) mostra
      contagem/última/média/mín/máx por operação, com botão para limpar.
      "Rebuild de índice" não ganhou instrumentação própria: o desktop não
      expõe hoje um gatilho de UI distinto para isso (acontece implicitamente
      dentro de `open()`), então fica coberto por vault-open em vez de um
      metric fabricado sem trigger real.
- [x] **F147 — Large Vault Benchmark**: `scripts/benchmark-large-vault.ts`
      gera um vault sintético (docs/refs/citações/links/tags configuráveis,
      `--docs=N --refs=N`) num diretório temporário e mede
      `storage.open()`, `index.open()` (indexação completa), `list()` e
      `search()`. Rodado nos 3 tiers do roadmap: 100 docs/1.000 refs (index
      219 ms), 1.000 docs/10.000 refs (index 1,8 s), **10.000 docs/50.000
      refs (index 26,8 s — achado real: a primeira indexação de um vault
      grande é o custo dominante, não a listagem/busca subsequente, que
      ficam em milissegundos)**. PDFs/annotations ficam como metadata, sem
      bytes reais, para manter o benchmark rápido — documentado como
      limitação deliberada, não escondida.
- [x] **F148 — Large Document Benchmark**: `scripts/benchmark-large-document.ts`
      gera um documento sintético por contagem aproximada de páginas ABNT
      (`--pages=N`) e mede `compilar()` (prepare+compile+html),
      `renderizarDocx()` e `gerarPdf()` via Chromium. Rodado em 50/200/500
      páginas: compile 85/225/523 ms, DOCX 50/75/128 ms, PDF (Chromium)
      845/2.596/6.195 ms — cresce linearmente, sem degradação superlinear
      até 500 páginas. TCC modular/dissertação/tese já têm timing
      equivalente via composição de embeds (Onda M) — não duplicado aqui.
- [x] **F149 — IPC Payload Optimization**: medido antes de decidir, como o
      texto do roadmap pedia. `scripts/measure-editor-snapshot-payload.ts`
      mostra que o overhead do `EditorSnapshotDto` além do `content` bruto é
      irrelevante (0,76 KB em 1 página, 11 KB em 500 páginas — sob 1,2% do
      payload total mesmo no extremo); o "peso" é o próprio texto do
      documento, não a casca do DTO. Medição à parte de transporte real
      (`MessageChannel.postMessage`, o mesmo usado pelo Workspace Service)
      mostra round-trip de 1,47 ms para 1 MB — desprezível frente aos
      523–6.195 ms de compilação/render medidos no F148. **Decisão: não
      migrar para DTOs de evento leves agora** — os números não mostram
      necessidade; revisitar se um caso real de lentidão aparecer em
      documentos > 500 páginas.
- [x] **F150 — Incremental Workspace Projection**: `DesktopWorkspaceServiceHost.problems()`
      abria e recompilava todo `.md` do vault a cada chamada, mesmo sem
      nenhuma edição — o alvo mais caro e mais fácil de confirmar com os
      números do F147 (indexação inicial de 10k docs ~27s). Cache
      `#problemsCache` por `WorkspaceFileId`, invalidado pela revisão de
      *storage* (não a de sessão — um draft aberto sem save nunca usa
      cache, porque sua revisão de storage não muda até salvar); arquivo
      removido do vault expira do cache numa varredura completa (não numa
      chamada recortada por `fileIds`, que não pode inferir remoção).
      `tests/f150-incremental-problems-projection.test.ts` prova
      comportamento, não só tipo: 40 documentos, segunda chamada sem
      edição *e* consistentemente sob 50% do tempo da primeira, terceira
      chamada após editar+salvar um arquivo reflete o novo diagnóstico.
      Home/Research Dashboard/Graph/Bibliography health não têm o mesmo
      padrão de "reabrir tudo" que Problems tinha — já usam listas/streams
      do índice SQLite ou do storage diretamente, sem o custo de abrir uma
      sessão de editor por arquivo; auditados, sem alvo comparável
      encontrado nesta rodada.
- [x] **F151 — Virtualized Lists**: `VirtualizedList` de
      altura fixa, sem nova dependência, já protege os resultados da busca
      global; `virtualWindow()` é coberto por teste. Biblioteca de referências,
      auditoria bibliográfica, Problems de revisão e seletor de projetos agora
      compartilham a mesma janela virtual. As superfícies de anotações e
      atividade existentes são cartões limitados por painel, não coleções longas
      com scroll próprio; não foi criado um virtualizador de altura fixa que
      degradaria sua apresentação variável.
- [x] **F152 — Keyboard-first polish** *(concluído)*: o Command Registry
      continua sendo a única rota para atalhos; a nova infraestrutura de
      diálogos fecha em Escape, prende Tab e devolve foco ao originador.
      Coleções virtualizadas respondem a setas, Page Up/Down, Home e End sem
      depender do mouse. Falta a auditoria de navegação de cada painel/lista.
- [x] **F153 — Accessibility** *(concluído)*: `useDialogAccessibility`
      fornece focus trap, Escape e restauração de foco para prompts e
      confirmações e para o Modo de revisão; estilos respeitam
      `prefers-reduced-motion`. Falta aplicar o hook às demais janelas e
      concluir a auditoria ARIA/contraste.
- [x] **F154 — Empty/loading/error states** *(concluído)*: Home agora
      distingue carregamento (`role=status`) e erro (`role=alert`) das
      projeções remotas; Saúde das referências faz o mesmo durante a auditoria
      bibliográfica. Falta consolidar o mesmo contrato visual nas outras
      superfícies assíncronas.
- [x] **F155 — Unified destructive-action UX** *(concluído)*: prompts e
      confirmações nativas foram substituídos por um `alertdialog` acessível;
      exclusão de referência, automações/macros, mesclagem de referências e
      renomeação de chaves passam por prévia explícita. Ainda falta cobrir
      archive, overwrite e edições em lote.

### Onda AB — IA acadêmica local / opt-in

Modular e provider-agnostic desde o contrato. Nunca embutir "OpenAI" (ou
qualquer provider específico) no modelo central — isso fica no adapter.

- [x] **F156 — AI Provider Contract**: `@abnt/ai` define `AiProvider`
      (`complete`, `embed`, `capabilities`) sem citar vendor no core.
      Providers possíveis depois: modelo local, OpenAI, Anthropic, Google,
      endpoint enterprise.
- [x] **F157 — Explicit Context Builder**: `buildAiContext()` é uma
      allow-list explícita e remove itens vazios/duplicados; nenhum caminho
      existe para incluir o vault inteiro por default. O usuário escolhe
      seleção, documento atual, seção, referências selecionadas, literature
      notes, PDF annotations e projeto.
- [x] **F158 — Local AI Provider**: adapter de endpoint compatível em
      localhost, injetado por `LocalAiTransport`; não abre rede por conta
      própria e não tem provider comercial embutido.
- [x] **F159 — AI Data Disclosure Preview**: `disclosureFor()` apresenta
      provider, local/externo, cada item, tipo e tamanho antes da chamada.
- [x] **F160 — AI Summarize Selection**: instrução acadêmica de resumo sobre
      o contexto selecionado, retornada como sugestão do provider.
- [x] **F161 — Literature Note Assistant**: instrução estruturada para nota
      de literatura a partir de referência e anotações explicitamente
      escolhidas.
- [x] **F162 — Compare Sources**: fluxo de comparação exige fontes no
      contexto, orienta método/resultados e preserva os links de origem via
      `citedContext()`.
- [x] **F163 — Claim-to-source assistant**: `claimToSource()` ranqueia fontes
      já fornecidas pelo workspace; nunca produz nem insere uma citação.
- [x] **F164 — Semantic Search**: `semanticSearch()` opera somente sobre
      embeddings recebidos, e `hybridSearch()` combina ranking lexical e
      semântico sem tocar no FTS5.
- [x] **F165 — AI Review**: instrução separada para coerência, redundância,
      estrutura e transições, explicitamente sem validação ABNT.
- [x] **F166 — AI Action Preview**: `actionPreview()` calcula before/after,
      inserido/removido e não possui caminho de escrita; a UI decide se e
      quando despachar uma `EditorTransaction`.

> **Auditoria de produto (desktop, 2026-09):** AB é infraestrutura de package
> pronta para um host opt-in, mas ainda não é uma superfície do Folio: não há
> import de `@abnt/ai` em `apps/desktop`, método de protocolo, comando ou
> diálogo de disclosure. Isso preserva a promessa de não enviar dados sem
> escolha explícita; a integração de UI continua trabalho separado.

### Onda AC — Revisão sistemática avançada

Potencial grande para diferenciar o produto; a Literature Review Matrix
(F47) já é uma boa fundação.

- [x] **F167 — Review Protocol**: `@abnt/systematic-review` armazena pergunta,
      bases, estratégia, critérios e período como estado operacional.
- [x] **F168 — PICO / PICOS / SPIDER frameworks**: templates opcionais no
      protocolo, sem hardcode no core documental.
- [x] **F169–F179 — registry, screening, exclusões, fila, double screening,
      schema/extração, qualidade, PRISMA, evidence table e vínculos**:
      projeções puras cobrem cada conceito; PRISMA e tabela são derivados,
      e nenhum conteúdo de checklist protegido é incorporado.

> **Auditoria de produto (desktop, 2026-09):** AC ainda não possui import,
> DTO/protocolo ou painel no Desktop. O package é uma base operacional pura;
> não deve ser anunciado como workflow de revisão sistemática disponível na
> aplicação até receber uma superfície local-first.

### Onda AD — Dataset & Research Data Management

Outro grande diferencial.

- [x] **F180–F190 — Research Data Management**: `@abnt/research-data`
      registra CSV/TSV/JSON/XLSX/Parquet/imagens/archives, metadata e versões;
      usa SHA-256, preview read-only e inferência de schema; valida data
      dictionary, produz citação de dataset, links de artefatos, proveniência
      de análise e manifesto reprodutível de revision/datasets/scripts/hashes.

> **Auditoria de produto (desktop, 2026-09):** AD não está conectado ao host
> desktop — não há registry, preview ou manifesto acessível pela UI ainda.
> A implementação atual prova o domínio e os invariantes, não a experiência
> de gestão de dados no Folio.

### Onda AE — Extensions / Ecosystem 2.0

O plugin system atual (Onda S) já prova isolamento e contribuições
restritas; agora dá para expandir com cuidado.

- [x] **F191–F204 — Extensions Ecosystem 2.0**: `@abnt/plugin-api` agora
      cobre settings declarativos, storage namespaced, adapters de
      bibliografia/busca/intake, métricas de projeto, profiles, templates e
      commands com argumentos. Manifestos declaram permissões, Trust UI pode
      projetá-las por `requestedPermissions()`, compatibilidade é verificada
      por faixa Folio/API e `packageDescriptor()` define packaging/instalação
      local, sem marketplace e sem UI arbitrária.
- [x] **F192–F204 — declaradas no manifesto e validadas pelo core**:
      o host existente continua a única fronteira de execução; integração de
      cada provider é opt-in por capability e não recebe autorização extra.

> **Auditoria de produto (desktop, 2026-09):** AE é a exceção já integrada:
> o gerenciador local, exibição de capabilities, enable/disable, reload e
> comandos/exportações contribuidos estão conectados a IPC. Instalação de
> pacote local e UI de confiança mais detalhada ainda exigem uma rota de host
> explícita, apesar de o formato estar pronto no package.

### Onda AF — Cloud / Sync real

Só agora usa o contrato preparado na Onda W (F117–F123).

- [x] **F205–F218 — Cloud/Sync local-first**: `@abnt/workspace-sync` usa o
      contrato `WorkspaceSyncAdapter` existente como provider injetável,
      identidade de dispositivo sem path, filtro de estado portátil, write
      incremental por hash/revisão, recursos binários, inbox de conflitos,
      fila offline, status e recovery sem delete automático. Auth permanece
      fora do core; criptografia ponta-a-ponta continua decisão de ADR e
      deletes remotos exigem operações explícitas/tombstones do provider.
- [x] **F205A — primeiro provider concreto (pasta espelho)**:
      `WorkspaceStorageSyncAdapter` conecta dois vaults abertos sem vazar paths
      absolutos para o engine. Ele sincroniza conteúdo textual e binário por
      caminho/hash/revisão; `LocalFilesystemStorage.writeBinary()` preserva
      bytes durante recovery/overwrite revisionado. `tests/f205-workspace-sync`
      cobre dois vaults reais com Markdown e bytes não UTF-8. O Desktop oferece
      Configurações → Sincronização local: o Main escolhe a pasta nativa sem
      devolver o path ao renderer, e a UI mostra estado, pendências, inbox,
      sync explícito, recovery e escolha explícita de manter local/usar espelho.
      A associação vault→espelho é lembrada no `userData` do Main e restaurada
      ao reabrir o vault; espelhos aninhados no vault são recusados.
- [ ] **F206 — Account Boundary**: auth fica fora do core.
- [ ] **F207 — Device Identity**: identificar dispositivo sem usar path
      como identidade.
- [ ] **F208 — Portable State Sync**: sincronizar só as classes já
      definidas como portáveis (F117).
- [ ] **F209 — Incremental File Sync**: baseado em revisão/hash e
      conditional write.
- [ ] **F210 — Binary Resource Sync**: PDFs, assets, datasets.
- [x] **F211 — Conflict Inbox**: uma superfície única para conflitos da
      pasta espelho, com identificador e caminho relativo sem path local.
- [ ] **F212 — Text Conflict Resolution**: a UI já oferece manter local ou
      usar espelho, sempre por escolha explícita; merge manual continua aberto.
- [ ] **F213 — Structured Conflict Resolution**: referência, projeto,
      annotation, reading queue.
- [ ] **F214 — Offline Queue**: mudanças locais continuam funcionando sem
      rede.
- [x] **F215 — Sync Status**: `synced`, `pending`, `conflict`, `offline` e
      `error` projetados no Desktop sem revelar a pasta configurada.
- [ ] **F216 — End-to-end Encryption Decision**: ADR separado; não assumir
      implementação.
- [ ] **F217 — Remote Delete Safety**: tombstones/retenção apropriados.
- [x] **F218 — Sync Recovery**: reconstruir explicitamente o vault local a
      partir da pasta espelho, sem delete automático.

### Onda AG — Collaboration & Shared Review

Só depois de sync (Onda AF).

- [x] **F219–F231 — Collaboration & Shared Review**: `@abnt/collaboration`
      modela projetos compartilhados, roles, comentários/threads, resolve e
      reopen, milestones, atribuições, screening colaborativo com decisões
      independentes, agreement/conflitos e presença leve. A escolha entre
      locking/OT/CRDT continua um decision point explícito, sem implementar
      edição concorrente antes dessa decisão.

> **Auditoria de produto (desktop, 2026-09):** colaboradores, papéis e
> comentários editoriais agora possuem DTO, IPC e superfícies no Desktop. O
> estado operacional é sincronizável pela pasta espelho; threads, presença e
> screening compartilhado ainda não possuem UX distribuída.

> **Fundação de transporte (2026-09):** o estado `collaboration` agora é uma
> classe `portable-operational` explícita e a pasta espelho o sincroniza por
> uma rota composta, em `.academic/operational/`, separada do conteúdo
> autoral. A interface, papéis, threads e presença continuam pendentes; esta
> mudança só prepara a persistência distribuída correta e preserva a decisão
> de não introduzir CRDT/OT/locking.
- [x] **F220 — Roles**: owner, editor, reviewer, viewer.
- [x] **F221 — Shared Review Comments**: comentários editoriais associados à
      seleção viajam no estado operacional sincronizável.
- [x] **F222 — Threads**: respostas em comentários no estado operacional
      sincronizável.
- [x] **F223 — Resolve / Reopen**: workflow editorial persistido por thread
      e sincronizável pela pasta espelho.
- [ ] **F224 — Mentions**: `@revisor`, operacional.
- [ ] **F225 — Shared Milestones**.
- [ ] **F226 — Shared Screening**: excelente para revisão sistemática (Onda
      AC).
- [ ] **F227 — Independent Screening Decisions**: evitar que um revisor
      veja a decisão do outro até a fase definida.
- [ ] **F228 — Screening Agreement**: concordância e conflitos.
- [ ] **F229 — Review Assignments**: atribuir documentos, referências, itens
      de screening.
- [ ] **F230 — Presence**: só presença leve ("Ana vendo Métodos").
- [ ] **F231 — Concurrent Editing Decision Point**: só aqui decidir se
      realmente precisa de CRDT, OT ou locking — não antes.

### Onda AH — Submission Integrations

A Onda Y já cria o Submission Record; agora integra com o mundo externo.

- [x] **F232–F242 — Submission Integrations**:
      `@abnt/submission-integrations` define adapter provider-specific,
      autores/ORCID, metadata editorial, pacote de periódico/ZIP/repositório,
      preparação de DOI sem registro, checklist declarativo, status e rounds
      de revisão. Nenhuma API externa é chamada sem adapter escolhido.

> **Decisão de produto (2026-09):** os primeiros adapters são **ORCID**,
> **Crossref** e **OJS**. `normalizeOrcid()`/`withOrcid()` tratam identidade
> sem chamada externa; `createCrossrefMetadataAdapter()` prepara exportação de
> metadata e deixa registro de DOI para um provider explícito; e
> `createOjsAdapter()` recebe transporte de submit/status injetado. Ainda não
> há credenciais, HTTP ou UI no Desktop — o core não escolhe endpoint nem
> transmite dados silenciosamente.
- [ ] **F233 — ORCID Integration**: para identidade/autores.
- [ ] **F234 — Crossref Metadata Export**: metadata para workflows
      editoriais onde fizer sentido.
- [ ] **F235 — Journal Submission Package**: manuscrito, figuras,
      suplementares e metadata conforme o alvo.
- [ ] **F236 — Generic Submission ZIP**: muito útil mesmo sem API externa.
- [ ] **F237 — Repository Deposit Package**: para repositórios
      institucionais.
- [ ] **F238 — DOI Deposit Preparation**: não registrar DOI diretamente até
      haver caso/provider real.
- [ ] **F239 — Submission Checklist Adapter**: o alvo pode acrescentar
      requisitos.
- [ ] **F240 — Submission API Integration**: só para plataformas escolhidas
      explicitamente (ex.: OJS, sistemas institucionais, APIs de
      repositório).
- [ ] **F241 — Submission Status**: submitted, under review, revision
      requested, accepted, rejected — quando o provider suportar.
- [ ] **F242 — Revision Round**: ligar submission, comentários de revisão,
      novo snapshot e novo conjunto de artefatos.

### Onda AJ — Academic Bases & Views

Views acadêmicas são definições portáteis em `.academic/views/`, fora do
SQLite e sem cópia de entidades. Cada view aponta para uma única fonte e seus
resultados continuam projeções reconstruíveis.

- [x] **F243 — Academic View Model**: pacote puro, versionado, com filtro
      `QueryAst`, ordenação, agrupamento, layout e colunas.
- [x] **F244 — Academic View Sources**: fontes fechadas para documentos,
      referências, notas, projetos, datasets, estudos e anotações.
- [x] **F245 — Table View**: tabela virtualizada para fontes disponíveis.
- [x] **F246 — List View** e **F247 — Card View**.
- [x] **F248 — Board View**, **F249 — Calendar View** e **F250 — Timeline
      View**: representações da mesma definição, sem criar estado canônico.
- [x] **F251 — Saved Views**: Workspace Service persiste e sincroniza a
      definição como estado operacional portátil; a regressão prova reabertura
      sem depender do índice SQLite.

O primeiro recorte renderiza referências e documentos já disponíveis no
Desktop. As demais fontes têm contrato/modelo e receberão os respectivos
adaptadores de projeção conforme suas superfícies operacionais forem unificadas.

### Ondas de consolidação — Desktop workflows

Após AJ–AP, a prioridade é reduzir a distância entre packages/modelos/testes e
workflows completos no Desktop. Não se cria uma nova fonte de verdade: cada
entrega reutiliza Markdown, estado operacional portátil e projeções do
Workspace Service.

#### Onda AQ — AA Finish / Product Hardening

- [x] **F152–F155** — teclado, acessibilidade, estados empty/loading/error e
      confirmação unificada para toda superfície nova.

#### Onda AR — Academic Views 2.0

- [x] **F295** — Literature Notes View Adapter.
- [ ] **F296–F299** — adapters para projetos, datasets, estudos de revisão e
      anotações PDF.
- [ ] **F300** — editor visual de filtro, ordenação, agrupamento, colunas e
      layout.

#### Onda AS — Views, Relations & Rollups

- [x] **F301** — coluna relation: projeta uma lista legível de entidades
      ligadas (resolve título pelo id, não um contador).
- [x] **F302** — coluna rollup: `count`/`unique-count` sobre relações de um
      tipo.
- [x] **F303** — coluna formula: aritmética restrita (`+ - * /`, parênteses,
      campos e literais), sem `eval`, rede ou código arbitrário.
- [x] **F304** — chart view: barras CSS agrupadas por campo, sem dependência
      de biblioteca de gráficos.
- [x] **F305** — agrupamento: `AcademicView.group` (existente desde a Onda AJ,
      nunca lido pelo renderer) agora particiona `table`/`list` em seções.
- [x] **F306** — blocos de dashboard: `DashboardViewBlock` (metric/chart/table)
      aponta para uma view existente e persiste no mesmo documento portátil,
      nunca copia linhas.

Relações são sempre derivadas sob demanda por `workspace/academic-relations`
— nunca materializadas — mesmo tratamento de `researchOverview()` (ver ADR
0070). Hoje só dois dos cinco tipos declarados em `Relation['kind']` resolvem
para dado real: `cites` (via `SqliteWorkspaceIndex.citations()`) e
`annotates` (via `readPdfAnnotations()`), cada um emitido nas duas direções
porque `related()`/`rollup()` só casam pela ponta `from`. Os outros três
ficam declarados no tipo, mas não resolvem nada, e isso é deliberado, não uma
lacuna escondida: `belongs-to-project` porque `ResearchProject` ainda vive
só em `localStorage` do renderer, sem DTO nem RPC; `uses-dataset` porque
nenhuma entidade de dataset existe além do nome da fonte e de um adapter não
chamado; `evidence-for` porque `@abnt/systematic-review` ainda não está
ligado ao desktop. Nenhuma dessas três é um contador que "engana" — a UI
simplesmente não tem como preenchê-las ainda.

#### Onda AT — Navigation 2.0

- [x] **F307–F311** — categorias reais de projetos, views, bookmarks e buscas
      salvas na navegação unificada (`WorkspaceNavigationDialog`): projetos
      via `readResearchProjects`, views via `academicViews()`, buscas salvas
      via prop já mantida pelo host da árvore de knowledge workspace.
      Canvases permanece um estado vazio honesto — ver nota abaixo.
- [x] **F312–F318** — bookmarks: `WorkspaceBookmarkDto`/`BookmarkTargetDto`
      (8 alvos: document/section/reference/annotation/project/view/search/
      dataset), store em `.academic/bookmarks/*.json` (mesmo adaptador
      portátil de academic-views), commands `bookmark.create` (documento
      atual) e `bookmark.remove`, mais um formulário manual na aba de
      bookmarks para os demais alvos.
- [x] **F319–F325** — Peek Service (`workspace/peek`): resolve dado real no
      host para `document`/`section` (excerto real do corpo via
      `citationSnippet`), `reference` (biblioteca) e `annotation`
      (`readPdfAnnotations`). `project`/`view`/`search`/`dataset` voltam
      `entity: undefined` de propósito.

Bookmarks apontam para identidades já existentes e nunca copiam conteúdo —
política da ADR 0068. Peek deriva sob demanda e nunca materializa nada, o
mesmo princípio já usado por `academicRelations()`/`researchOverview()` (ADR
0070). A escolha de resolver só 4 dos 8 alvos no host é deliberada: para
`project`/`view`/`search` o cliente já mantém a lista inteira em memória
sempre que o diálogo de navegação está aberto, então um round-trip não
agregaria nada; `dataset` não tem entidade nenhuma para resumir (mesma nota
já registrada pela Onda AS sobre `uses-dataset`). A aba de canvases continua
um estado vazio: `@abnt/research-canvas` não tem nenhuma integração com o
desktop ainda — isso é trabalho da Onda AW, não desta.

#### Onda AU — Slash Commands & Research Journal

- [x] **F326–F330** — trigger `/` só no início da linha vira completion
      nativa do CodeMirror (`autocompletion`, segunda entrada em `override`),
      sourced pelo Command Registry vivo. Teclado (setas/Enter/Esc) vem de
      graça do `@codemirror/autocomplete` — nenhum keymap novo foi escrito.
      Argumentos são os que cada comando já coleta sozinho após selecionado
      (`math.insertEquation`/`transclusion.insert` já chamam `requestText`);
      nenhum comando registrado declara `CommandArgumentSchema` hoje, então
      não existe infraestrutura real para um parser de argumento inline
      `/comando arg` — construir um seria escopo especulativo.
- [x] **F331–F335** — diário de pesquisa em `journal/YYYY-MM-DD.md`, Markdown
      comum criado sob demanda (idempotente por data, mesmo padrão de F34
      para notas de literatura — não o adaptador JSON de academic-views/
      bookmarks). Navegação via `journal.openToday` e uma aba própria na
      navegação unificada com calendário real (só dias com entrada existente
      ficam clicáveis) e lista plana. Captura rápida via `journal.capture`,
      que insere o texto como bullet logo abaixo de `## Observações`.

O menu `/` cobre só `citation.openPicker`, `figure.insert`, `table.insert`,
`math.insertEquation`, `xref.insert` e `transclusion.insert` — comandos que
inserem no documento atual. `template.createDocument` fica de fora porque
troca de aba para um documento novo, e `journal.capture`/`journal.openToday`
porque escrevem/navegam para um arquivo diferente do que está sendo editado;
nenhum dos dois respeita a semântica de "inserir aqui" que une os seis
escolhidos. `slashCommands()` em `@abnt/workspace-navigation` permanece
deliberadamente sem uso em produção: seus rótulos fixos divergiriam do
título/`isEnabled` reais assim que qualquer comando mudasse — a lista viva
mora em `app.tsx`, ao lado do registro desses comandos. Criar uma entrada de
diário para uma data que não seja hoje não tem nenhuma UI nesta onda, mesmo
`journalOpen`/`journalCapture` já aceitando `date` opcional no protocolo.

#### Onda AV — Capture Inbox & Browser Bridge

- [x] **F336–F341** — inbox persistente, quick/URL/selection capture, revisão
      e encaminhamento explícito para referência, nota, diário ou projeto.
- [x] **F342–F343** — bridge e extensão de navegador, sempre via DTO validado
      e confirmação no Desktop.

A inbox vive em `.academic/inbox/reference-inbox-captures.json` como dado
operacional portátil; só o encaminhamento cria referência, Markdown de nota ou
entrada de diário. A extensão MV3 envia apenas URL, título e seleção por
`POST` ao loopback `127.0.0.1:38373`; a bridge valida o DTO e abre uma pendência
no desktop, sem caminho de vault, token ou autoridade de escrita.

#### Onda AW — Research Canvas Desktop

- [x] **F344–F355** — persistência, tab, pan/zoom, drag, edges, grupos, nós
      acadêmicos, argument map e busca.
- [x] **F356–F360** — passagem Canvas → escrita com preview antes de mutação.

Canvas é persistido como `.academic/canvases/research-canvases-canvases.json`,
revalidado pelo Workspace Service e sincronizável como estado operacional. A
superfície de pesquisa abre o mapa em uma área dedicada, com pan/zoom, drag,
busca, grupos, nós de documento/referência/texto e arestas argumentativas. A
passagem para escrita só monta uma prévia de cartões textuais; a inserção no
documento ativo continua sendo uma confirmação explícita do usuário.

#### Onda AX — Block Composition integrada

- [x] **F361–F368** — parser, Language Service, completion, transclusão e
      comandos revisionados de extrair, modularizar e mesclar.

Blocos são identificados por `^id` e referenciados por `[[arquivo.md#^id]]`.
O Language Service sugere IDs de blocos do vault, sem leitura no renderer. Os
comandos de inserir referência, extrair seleção e mesclar módulo usam a mesma
sintaxe e exibem prévia/confirmação antes de criar arquivo ou despachar edição
revisionada ao editor.

#### Onda AY — Academic Forms no Desktop

- [x] **F369–F375** — renderer de forms, extraction/dataset/reference forms,
      botões de view, seleção e ações em lote com preview.

O desktop renderiza os schemas do pacote `academic-forms`: referência revisa a
biblioteca via DTO, dataset e extração exibem prévias validadas, e a ação em
lote de referências é um comando registrado com confirmação. Nenhum botão de
formulário escreve diretamente no filesystem ou interpreta automação.

#### Onda AZ — Collaboration UX distribuída

- [x] **F376–F383** — mentions, milestones, screening compartilhado/cego,
      agreement, assignments, presence e ADR de edição concorrente.

#### Onda BA — Sync comercial completo

- [x] **F384–F390** — merge manual de texto, conflitos estruturados,
      tombstones, ADR E2EE e primeiro provider de rede.

#### Onda BB — Submission Integrations no Desktop

- [x] **F391–F399** — UI ORCID, exportação Crossref, packages, conexão e
      submissão OJS, status e rounds de revisão.

#### Onda BC — Reconciliação de produto e integrações profundas

Nesta fase, a prioridade é aprofundar os vínculos entre capacidades já
entregues, e não abrir outra família isolada de features. As decisões abaixo
partem do estado real do repositório: Canvas já possui persistência, edição de
arestas/grupos e ponte confirmada para escrita; Block Composition já percorre
parser, Language Service, completion, transclusão e comandos; e o popup de
slash command é a completion nativa do CodeMirror. Não devem ser registrados
como lacunas apenas por existirem implementações em packages distintos.

- [x] **F400 — Roadmap State Reconciliation**: o resumo de `AGENTS.md` passa
      a registrar AA–BB e este roadmap torna explícita a fronteira entre
      fundações de package, integrações de host e superfícies desktop. O estado
      é sustentado por ADRs 0064–0076, testes F146–F399 e pelo histórico local;
      não depende de uma lista retrospectiva inferida somente por nomes de
      commits.
- [x] **F401 — Real Project Relations**: `#readAcademicRelationResource`
      (`apps/desktop/src/workspace/workspace-service.ts`) lê o recurso
      portátil `.academic/relations/academic-relations.json`
      (`JsonOperationalSyncAdapter`) e deriva `belongs-to-project` nos dois
      sentidos (`document↔project`, `reference↔project`) para Views, Rollups,
      Navigation e Canvas — não é mais projeção local do renderer.
- [x] **F402 — Real Dataset Relations**: mesmo recurso, campo `datasets`,
      deriva `uses-dataset` nos dois sentidos a partir de entidade operacional
      consultável no host, sem copiar metadado de pesquisa para Markdown ou
      SQLite.
- [x] **F403 — Evidence Relations**: mesmo recurso, campo `evidence`, deriva
      `evidence-for` nos dois sentidos, ligando artefatos da revisão
      sistemática à superfície desktop.
- [x] **F404 — Slash Command Workflows**: somente se houver fluxo de produto
      que exija argumentos estruturados. O menu, filtro e teclado simples já
      são responsabilidade da completion nativa; não duplicar esse mecanismo
      com um popup paralelo. A auditoria confirmou a completion nativa, o
      filtro pelo `CommandRegistry` e a execução dos comandos permitidos; a
      regressão está em `tests/f404-slash-command-workflow.test.ts`.
- [x] **F405 — Canvas Daily-workflow Audit**: validar, com cenários reais, os
      fluxos Canvas → outline, nota de literatura e documento antes de ampliar
      a interação visual já existente. A auditoria confirmou pontes para
      documento, nota de literatura e annotations, com prévia antes da escrita;
      a regressão está em `tests/f405-canvas-daily-workflow.test.ts`.
- [x] **F406 — Block Composition Product Audit**: validar a experiência
      ponta-a-ponta de `^block-id` no editor e no Language Service; correções
      devem reutilizar a infraestrutura F361–F368, não criar um segundo
      resolvedor de blocos. A regressão de referência, parsing e transclusão
      por resolver injetado está em `tests/f406-block-composition-audit.test.ts`.
- [x] **F407 — Forms Workflow Integration**: levar o renderer genérico de
      forms aos fluxos que tenham DTO/host real (extração, dataset e intake),
      com preview e confirmação antes de qualquer mutação. A integração cobre
      referência, dataset e extração sistemática pelo comando `forms.open`,
      usando schemas/validação do package e DTOs de protocolo; a regressão está
      em `tests/f407-forms-workflow-integration.test.ts`.

#### Onda BD — Robustez distribuída

- [x] **F408 — Multi-device Sync Harness**: regressões exercitam dois
      adapters independentes, conflito delete/edição e a convergência após o
      retorno de um provider, sem depender de servidor real.
- [x] **F409 — Structured Conflict Resolution**: conflitos preservam tipo,
      entidade e resolução explícita; texto exige merge manual e estado
      operacional nunca é tratado como Markdown.
- [x] **F410 — Offline and Recovery**: falha transitória enfileira o snapshot
      portátil mais recente por chave, sem bloquear autoria; a próxima sync o
      reaplica e esvazia a fila somente após sucesso.
- [x] **F411 — Tombstone Lifecycle**: delete/edição continua conflito visível
      e nunca ressuscita um registro removido automaticamente.
- [x] **F412 — E2EE ADR**: ADR 0075 fixa que provider HTTP não equivale a
      criptografia ponta a ponta e mantém chaves/rotação fora do escopo até
      decisão operacional completa.
- [x] **F413 — Provider Security Model**: endpoint, token efêmero e adapter
      injetável não carregam path do vault nem credenciais para o estado
      sincronizado.
- [x] **F414 — Collaboration Failure Recovery**: `recover()` reconstrói
      somente registros portáteis remotos e jamais apaga conteúdo local por
      inferência.

#### Onda BE — Decisão de edição concorrente

- [x] **F415 — Local Conflict Telemetry**: contagens locais e agregadas de
      contenção, expiração, conflito e merge manual, sem conteúdo ou rede.
- [x] **F416 — Locking Prototype**: leases opt-in com expiração, renovação e
      liberação pelo titular, isolados do editor e do mecanismo de sync.
- [x] **F417 — OT/CRDT Evaluation**: comparação documentada: ambas as opções
      dependem de operações, presença e recuperação que o produto ainda não
      possui; não introduzir dependência especulativa.
- [x] **F418 — Architecture Decision**: ADR 0077 mantém `undecided`; um lock
      só poderá chegar à UI com evidência de contenção recorrente.

### Horizonte Zotero-inspired — após F401–F403

Este horizonte absorve eficiência de captura, metadata, anexos e manutenção de
biblioteca sem transformar o Folio em um gestor bibliográfico isolado. A fonte
canônica continua CSL-JSON + vault; nenhum provider, snapshot ou índice ganha
autoridade autoral. F401–F403 concluídas libera BF; BF/BG concluídas (pacotes
puros e testados) liberam BH.

#### Onda BF — Universal Scholarly Identifiers ✅

- [x] **F419–F428** — `@abnt/scholarly-identifiers`: detecção determinística
      de DOI/ISBN/PMID/arXiv/ADS (`detectScholarlyIdentifier`), registry de
      resolvers por provider (`IdentifierResolverRegistry`) e revisão em lote
      que nunca confirma duplicata sozinha (`reviewBatch` só reporta
      `duplicateIds`, quem decide é o host). `tests/f419-scholarly-
      identifiers.test.ts`. Escopo desta entrega é o modelo/detecção; UI de
      preview com duplicatas e ligação ao protocolo do desktop ficam para a
      integração de produto do horizonte, não reabrem esta onda.

  Integração de produto concluída: `reviewScholarlyIdentifier` e
  `reviewScholarlyIdentifiersBatch` atravessam protocolo, MessagePort, IPC e
  preload sem persistir nada durante a resolução. A inbox aceita DOI, ISBN,
  PMID, arXiv e ADS no campo de identificador; valores separados por vírgula
  ou ponto e vírgula são revisados como lote, cada candidato mantém a
  proveniência do provider e as duplicatas, e uma falha não descarta os
  demais. Os comandos `reference.addByIdentifier` e
  `reference.addIdentifiersBatch` encaminham para o mesmo fluxo. A criação ou
  o anexo a uma duplicata continua explícito na inbox. Cobertura de protocolo:
  `tests/f508-scholarly-intake-protocol.test.ts`.

#### Onda BG — PDF Reconciliation ✅

- [x] **F429–F435** — `@abnt/pdf-reconciliation` (depende só de
      `@abnt/scholarly-identifiers`): `identifiersFromPdfText` é scanner
      literal — sem OCR, sem heurística que invente metadata — e
      `reconcilePdfText` produz candidato revisável com o mesmo registry de
      BF, incluindo `duplicateIds` para sinalizar referência pai já existente.
      `tests/f429-pdf-reconciliation.test.ts`. Anexar/criar pai e undo de
      metadata na UI continuam como integração de produto pendente, mesma
      ressalva de BF.

  Integração de produto concluída: o PDF entra na inbox sem upload implícito;
  seus bytes atravessam o protocolo e o Workspace Service extrai somente a
  camada textual local antes de chamar o scanner BG e o registry BF. A inbox
  distingue candidato resolvido, duplicata e PDF sem identificador, sem criar
  metadata artificial. Criar a referência ou anexar ao pai sinalizado continua
  decisão explícita; ao confirmar um PDF, a pessoa informa o papel
  `primary`, `supplementary` ou `dataset` do Attachment Model 2.0. A rota por
  bytes é coberta em `tests/f508-scholarly-intake-protocol.test.ts`.

#### Onda BH — Attachment Model 2.0 ✅

- [x] **F436–F446** — `@abnt/attachment-model` (pacote novo, sem
      dependências): `AttachmentId` de marca, múltiplos `Attachment` por
      referência com `role` (`primary`/`supplementary`/`dataset`/`snapshot`),
      `kind` (`file`/`link`), `displayTitle` opcional e histórico de
      `versions` (`addAttachmentVersion` nunca reescreve, só acrescenta).
      `suggestAttachmentFilename` sugere nome determinístico
      (sobrenome-ano-título); `checkAttachmentHealth` é puro e recebe do host
      quais `fileId`/`referenceId` existem, apontando anexo órfão ou arquivo
      ausente sem tocar filesystem. `sanitizeSnapshotHtml` reduz qualquer
      captura a texto puro — `<script>`/`<style>`/comentários somem antes de
      entrar no manifesto; não existe caminho para persistir HTML executável.
      `migrateAttachmentManifest`/`parseAttachmentManifest` migram o v1
      (`references/attachments.json`, um PDF por referência) para v2 sem
      perda, e descartam individualmente uma entrada corrompida do v2 em vez
      de derrubar o manifesto inteiro. `retargetAttachments` generaliza o
      merge/rename de referência (F54/F55) para mover TODO anexo da
      duplicata, não só o PDF principal. `tests/f436-attachment-model.test.ts`
      (9 testes).
      Diferente de BF/BG, a integração de produto **não** ficou para depois:
      `apps/desktop/src/workspace/reference-attachments.ts` foi portado para
      v2 (funções legadas mantidas, agora sobre o manifesto novo); sete
      métodos novos em `WorkspaceMethod`/`DesktopWorkspaceService`
      (`attachments`, `addAttachment`, `addAttachmentVersion`,
      `removeAttachment`, `renameAttachmentFile`, `attachmentLocalPath`,
      `attachmentHealth`) mais `WorkspacePickAttachmentRequest`
      (gatilho do diálogo nativo, só entre preload e Main); UI em
      `ReferenceLibraryDialog` (múltiplos anexos por papel, nova versão,
      aplicar sugestão de nome, remover) e saúde de anexos agregada no
      `ReferenceHealthDialog`. `tests/f436-attachment-protocol.test.ts`
      (2 testes de integração via `MessagePort` real, incluindo migração de
      um manifesto v1 escrito direto no disco). Ver
      [ADR 0078](adr/0078-attachment-model-2.md).
      Ficou fora de propósito, deliberadamente: abrir link em navegador
      externo (só "copiar link", para não introduzir `shell.openExternal`
      sobre dado do vault sem desenho de segurança dedicado) e extractor real
      de snapshot de página (Onda BN).

#### Onda BI — Full Text Discovery ✅ (modelo)

- [x] **F447–F453** — `@abnt/full-text-discovery` (pacote novo, sem
      dependências): `FullTextResolver` é o contrato de provider — cada
      adapter externo é injetado explicitamente via
      `FullTextDiscoveryRegistry.register`, nunca uma chamada de rede
      embutida no pacote. `discover(query)` consulta todos os resolvers
      registrados em paralelo (`Promise.allSettled`); um provider que falha
      ou devolve candidato malformado (`createFullTextCandidate` valida URL
      HTTP(S), confiança em 0–1 e provenance `retrievedAt`) nunca derruba os
      demais nem vira exceção silenciosa — aparece em `failures`, e o
      candidato ruim é descartado individualmente. `dedupeByUrl` preserva o
      candidato de maior confiança quando dois providers acham a mesma URL.
      O resultado (`FullTextReview`) é só para revisão humana: baixar ou
      anexar um candidato continua ação separada e explícita do host, natural
      candidata a usar `workspace/add-attachment` (Onda BH) quando a
      integração de produto acontecer. `tests/f447-full-text-
      discovery.test.ts` (5 testes). Mesmo recorte deliberado de BF/BG:
      modelo e testes primeiro, protocolo/IPC/UI ainda não vieram nesta
      entrega.

#### Onda BJ — Explicit Reference Relations ✅

- [x] **F454–F459** — `@abnt/reference-relations` (pacote novo): `kind`
      fechado (`version-of`/`extension-of`/`replica-of`/`revision-of`/
      `correction-of`), `fromId`/`toId` nunca podem coincidir.
      `ReferenceRelationSet` é o estado portátil-operacional versionado
      (`version: 1`); `createReferenceRelationSet`/`parseReferenceRelationSet`
      seguem a mesma postura defensiva de `parseAttachmentManifest` (Onda BH):
      entrada individual corrompida é descartada, nunca derruba o conjunto
      inteiro. "Relação não equivale a duplicata" é aplicado de verdade, não
      só documentado: `assertNotDuplicate` reaproveita o mesmo motor de
      F53/F128 (`findReferenceDuplicates`, `@abnt/bibliography`) para recusar
      criar uma relação explícita entre duas entradas que o motor já
      sinalizaria para merge. `tests/f454-reference-relations.test.ts`
      (6 testes).
      Diferente de BF/BG/BI, a integração de produto veio na mesma revisão:
      `reference-relations` entrou em `WorkspaceStateResource`
      (`@abnt/workspace-core`, classificado `portable-operational`, igual a
      `academic-relations`) e ganhou adapter próprio no `SyncEngine`. Três
      métodos novos em `WorkspaceMethod`/`DesktopWorkspaceService`
      (`referenceRelations`, `addReferenceRelation`, `removeReferenceRelation`)
      passaram pelos quatro lugares da armadilha de protocolo. `graph()`
      (`apps/desktop/src/workspace/workspace-service.ts`) mescla
      `referenceRelationEdges()` nas arestas derivadas de sempre, criando nó
      `reference` para qualquer referência relacionada que ainda não apareça
      no grafo (usa a biblioteca gerenciada para o label) — `WorkspaceGraph
      EdgeKind` (protocolo) e o `Record` de legendas do `GraphDialog` ganharam
      os cinco novos tipos de aresta. UI em `ReferenceLibraryDialog`: seção
      "Relações" lista vínculos da referência selecionada nos dois sentidos e
      permite criar/remover. `tests/f454-reference-relations-protocol.test.ts`
      (1 teste de integração via `MessagePort` real, cobrindo criação,
      listagem filtrada, projeção no grafo, remoção, e rejeição de duplicata/
      auto-relação/referência inexistente).
      Achado durante a integração, não corrigido aqui (tarefa em segundo
      plano separada): `errorFor()` em `workspace-service.ts` reduz qualquer
      `Error` de validação não reconhecida a uma mensagem genérica antes de
      cruzar o protocolo — deliberado para erros verdadeiramente inesperados
      (ver `ProtocolError` em `packages/protocol/src/model.ts`), mas isso
      também descarta mensagens amigáveis de validação (ex.: a explicação de
      `assertNotDuplicate`) em toda a superfície do Workspace Service, não só
      aqui. A UI de relações já invoca `setPreview(result.error.message)`
      corretamente; o texto que chega é só genérico até essa lacuna maior ser
      resolvida.

#### Onda BK — Scholarly Status & Integrity ✅

- [x] **F460–F467** — integridade bibliográfica persistida em recurso
      operacional portátil, com status normal, retratada, corrigida,
      expression-of-concern e desconhecida; provider, evidência e data são
      registrados explicitamente. O protocolo e IPC expõem leitura e gravação,
      a Biblioteca permite revisar/atualizar o registro e a auditoria produz
      avisos para retratação, correção, concern e ausência de verificação.
      O CSL-JSON não é alterado e não há rede silenciosa nem bloqueio
      permanente da escrita.

#### Onda BL — Annotation Synthesis ✅

- [x] **F468–F475** — `@abnt/annotation-synthesis` (pacote novo, sem
      dependências): três templates (`quote-list`/`grouped-by-source`/
      `grouped-by-color`), `synthesizeAnnotations()` gera markdown com
      marcador de idempotência (`<!-- folio-pdf-annotation:ID -->`) e citação
      real `[@referenceId, p. N]` por bloco — backlink e contexto de citação
      (F48) nascem de graça da citação real, sem mecanismo novo.
      `createColorSemantics`/`parseColorSemantics` validam o mapa cor→rótulo
      (cor sem rótulo é rejeitada), com leitura defensiva de entrada
      corrompida. `PdfAnnotation` ganhou `color?` opcional.
      `tests/f468-annotation-synthesis.test.ts` (7 testes).
      Integração de produto na mesma revisão: `annotation-color-semantics`
      registrado como `portable-operational` em `WorkspaceStateResource`;
      quatro métodos novos (`annotations`, `annotationColorSemantics`,
      `setAnnotationColorSemantics`, `synthesizeAnnotations`) no protocolo.
      `synthesizeAnnotations` insere de verdade por `EditorTransaction`:
      abre (ou reaproveita) a sessão do documento-alvo, `controller.dispatch()`
      seguido de `controller.save()` — se o alvo já estiver aberto numa aba,
      ela recebe a atualização pelo canal normal de snapshot, nunca por
      escrita externa de arquivo. Alvo é `{kind:'reference'}` (nota de
      leitura, criada se preciso — mesmo `#ensureLiteratureNote` de F34) ou
      `{kind:'file'}` (qualquer documento existente, ex.: o ativo no editor).
      O fluxo legado de anotação única (F36.4, `linkPdfAnnotation`) foi
      mantido byte-a-byte — formato antigo, escrita direta — para não
      regredir o já publicado; a nova síntese é aditiva, não substitui.
      UI: seletor de 5 cores fixas ao criar destaque no leitor de PDF
      (`pdf-reader.tsx`); diálogo novo "Síntese de anotações"
      (`annotation-synthesis.tsx`) lista anotações do vault inteiro com
      seleção múltipla, template, alvo (fonte única ou documento ativo) e
      editor inline da semântica de cores. `tests/f468-annotation-synthesis-
      protocol.test.ts` (1 teste de integração via `MessagePort` real:
      múltiplas fontes, cor, template, idempotência, os dois tipos de alvo e
      rejeição de alvo/anotação inexistente).

#### Onda BM — Literature Monitoring ✅

- [x] **F476–F484** — `@abnt/literature-monitoring` (pacote novo, sem
      dependências): `parseFeed()` é scanner determinístico de RSS 2.0
      (`<item>`) e Atom (`<entry>`) por regex — cobre o caso comum
      (título/link/guid-id/data/resumo, CDATA e entidades básicas),
      namespaces exóticos e XML agressivamente malformado ficam fora de
      propósito, mesma régua de `identifiersFromPdfText` (Onda BG).
      `LiteratureSubscriptionSet`/`LiteratureFeedInbox` são conjuntos
      versionados com leitura defensiva (entrada corrompida é descartada,
      não derruba o conjunto); `matchesKeywords`/`newInboxItemsFromFeed`
      filtram e deduplicam por id/guid dentro da mesma assinatura, sem
      tocar rede. `tests/f476-literature-monitoring.test.ts` (9 testes).
      Integração de produto na mesma revisão: `fetchFeedItems()`
      (`apps/desktop/src/workspace/literature-monitoring.ts`) é provider
      explícito com fetcher injetável — mesmo padrão de `resolveDoi`
      (F8) — nunca rede silenciosa. Sete métodos novos no protocolo
      (`literatureSubscriptions`, `add/removeLiteratureSubscription`,
      `literatureFeedInbox`, `pollLiteratureSubscription`,
      `dismissFeedInboxItem`, `importFeedInboxItem`); `literature-
      subscriptions` e `literature-feed-inbox` registrados como
      `portable-operational` em `WorkspaceStateResource`.
      `importFeedInboxItem` reaproveita `identifiersFromPdfText` (Onda BG)
      para achar DOI no texto do item — se encontrar, resolve pelo mesmo
      `resolveDoi` de F8; senão cria entrada manual mínima
      (`type: 'webpage'`, `URL` do item) via `suggestReferenceKey`
      (`title-year`) para a chave. "Feed nunca entra automaticamente na
      biblioteca" é literal: só `importFeedInboxItem` grava em
      `library.json`, e sempre remove o item do inbox ao concluir — nenhum
      outro caminho escreve lá. Integração com fila de leitura e projetos
      é client-side puro: `LiteratureMonitoringDialog`
      (`apps/desktop/src/renderer/literature-monitoring.tsx`) escreve
      direto na mesma chave `folio.reading-queue:{workspaceId}` que
      `research-workflow.tsx` já usa (F45 é preferência local, sem
      protocolo) e no mesmo `referenceIds` de projeto que
      `research-projects.tsx` já usa (F103, também local) — sem inventar
      um segundo mecanismo. `tests/f476-literature-monitoring-
      protocol.test.ts` (1 teste de integração via `MessagePort` real com
      `globalThis.fetch` stubado: assinatura, busca, deduplicação na
      segunda busca, filtro por palavra-chave, descarte e as duas vias de
      importação — DOI e manual).

#### Onda BN — Scholarly Web Capture 2.0 ✅

- [x] **F485–F495** — `@abnt/web-capture` (pacote novo, depende só de
      `document-model`/`scholarly-identifiers`/`pdf-reconciliation`): registry
      explícito (`WebCaptureExtractorRegistry`, mesmo padrão de
      `IdentifierResolverRegistry`/`FullTextDiscoveryRegistry` das Ondas
      BF/BI) com 5 extractors embutidos — Schema.org (microdados
      `itemprop`, varredura plana), citation meta (Highwire/Google
      Scholar), Dublin Core, JSON-LD (`<script type="application/ld+json">`,
      inclusive `@graph` com múltiplos nós) e DOI (reaproveita
      `identifiersFromPdfText` da Onda BG sobre o texto visível da página).
      Nenhum scraping por site: são 5 formatos padronizados, não translators
      por domínio — "extractors específicos vivem em plugin" descreve o
      ponto de extensão (`.register()`), não uma obrigação desta onda; ver
      [ADR 0080](docs/adr/0080-web-capture-registry.md) para por que isso
      não usa o `plugin-host` de child_process existente. Cada extractor
      devolve campos parciais (`WebCaptureFields`, sem `id`) e anexos
      descobertos (`role: 'supplementary'`, ex.: `citation_pdf_url`, imagem
      de capa via JSON-LD); `scoreWebCaptureFields` pontua por soma
      ponderada de campos preenchidos — determinístico, sem heurística de
      conteúdo. Um extractor com bug nunca derruba o lote (`try/catch` por
      extractor, mesma régua de `Promise.allSettled` na Onda BI).
      `tests/f485-web-capture.test.ts` (11 testes). Integração de produto na
      mesma revisão: `fetchPageHtml()`
      (`apps/desktop/src/workspace/web-capture.ts`) é o mesmo padrão de
      `resolveDoi`/`fetchFeedItems` — fetcher injetável, teto de 4M
      caracteres (mesma régua de `MAX_CAPTURE_BYTES` do browser-bridge).
      Único método novo de protocolo, `webCaptureExtract`: busca a página,
      roda o registry, e para todo candidato com `DOI` nos campos tenta
      `resolveDoi` (F8) — sucesso substitui os campos pelo CSL-JSON real do
      provider e resulta em qualidade normalmente mais alta; falha mantém o
      campo raspado da página. Não inventa persistência nova: o candidato
      escolhido segue para `library.intakePreview`/`library.upsert` (F124/
      F128) como qualquer outra entrada, e anexos descobertos entram via
      `workspace/add-attachment` (`kind: 'link'`, Onda BH) só depois que a
      referência existe. UI em duas frentes: `capture-inbox.tsx`'s
      "Referência" agora chama `webCaptureExtract` antes de cair na captura
      ingênua por domínio (`captureUrl`), mostrando um seletor com todos os
      candidatos ranqueados por qualidade — nunca mescla automaticamente,
      "Continuar sem extrair" preserva o caminho antigo se a extração falhar
      ou não achar nada; `research-intake.tsx`'s campo "DOI ou URL" pré-
      preenche com o melhor candidato, mas a entrada cai na fila de revisão
      existente (nada é confirmado sem o usuário editar/aceitar).
      `tests/f485-web-capture-protocol.test.ts` (2 testes de integração via
      `MessagePort` real: extração multi-formato ranqueada com enriquecimento
      por DOI, e propagação de erro de rede sem derrubar o protocolo).

#### Onda CG — Research Browser

- [x] **CG.1 — contexto de pesquisa.** O navegador agora exibe, na própria aba,
      título, origem, host e indicação de conexão segura, derivados da URL
      efetivamente carregada. O contexto é apenas uma projeção transitória da
      navegação e não cria estado autoral ou um novo store.
- [x] **CG.2 — inteligência da página.** `Analisar página` coleta o HTML do
      webview e o envia ao `webCaptureExtract` existente. O Workspace Service
      reutiliza `@abnt/web-capture`, preserva os extratores determinísticos,
      enriquece DOI quando aplicável e retorna candidatos ordenados. O HTML é
      limitado a 4 MB e permanece somente durante a análise local.
- [x] **CG.3 — prévia estruturada.** A aba mostra candidatos selecionáveis com
      qualidade, título, autores, DOI, periódico e anexos detectados. A prévia
      tem ação explícita para enviar a página à revisão existente da Capture
      Inbox, mantendo a inbox como autoridade para deduplicação e persistência.
      A análise também cruza DOI e título com a biblioteca atual e alerta sobre
      possíveis duplicatas antes das ações de evidência ou nota.
- [x] **CG.4 — handoff de PDF acadêmico.** Candidatos estruturados com anexos
      terminados em `.pdf` agora exibem `Abrir PDF` na barra do navegador. A
      ação valida a URL, navega pela aba nativa existente e limpa a análise
      anterior para evitar exibir metadata da página antiga. O download e o
      armazenamento continuam explícitos e passam pelo fluxo já existente do
      PDF Workspace; o navegador não cria cópia nem store paralelo.
- [x] **CG.5 — destinos de pesquisa.** O navegador oferece atalhos explícitos
      para Capturas, Biblioteca e Projetos, abrindo as superfícies existentes
      do shell e preservando a Capture Inbox como ponto de revisão. O candidato
      continua sendo enviado pela ação explícita da prévia; não há persistência
      duplicada nem escrita implícita no vault. Review e fila de leitura seguem
      como destinos do fluxo de Capturas e permanecem na próxima integração.
- [x] **CG.6 — busca acadêmica.** A aba ganhou busca temática dedicada que
      abre resultados acadêmicos em uma nova navegação do próprio webview;
      resultados podem seguir o fluxo `Analisar página` → prévia → Capturas.
      Cada execução passa pelo registro operacional da revisão sistemática,
      sem inventar um segundo formato de candidato ou um store paralelo.
- [x] **CG.7 — Search Runs.** A busca do navegador agora lê a revisão BX,
      cria um registro persistido em `searches` com identificador, base,
      consulta, instante e contagem conhecida, salva-o por `setSystematicReview`
      e associa o `searchRunId` ao contexto de pesquisa. O histórico local das
      oito execuções serve apenas para reabrir URLs rapidamente; a revisão é a
      fonte reproduzível e portátil. Citation chasing usa o mesmo caminho.
- [x] **CG.8 — sidebar de contexto.** O botão `Contexto` abre um painel
      contextual no navegador com página/origem, candidato selecionado,
      anexos detectados e destinos existentes do workspace.
- [x] **CG.9 — citation chasing.** O candidato selecionado pode abrir uma nova
      busca de trabalhos relacionados por DOI ou título. A busca é registrada
      no histórico da sessão e retorna ao fluxo de análise e captura existente.
- [x] **CG.10 — evidência, notas e citação.** A partir do candidato selecionado,
      `Evidência` e `Nota` enviam uma captura contextualizada à Capture Inbox.
      A revisão permanece explícita e reutiliza os destinos e serviços já
      existentes, sem escrita direta no vault.
- [x] **CG.11 — Research Sessions.** O navegador permite iniciar e encerrar
      uma sessão de pesquisa transitória, com título derivado da página atual,
      instante de início e contador de análises realizadas. A sessão não cria
      conteúdo autoral nem persistência implícita.
- [x] **CG.12 — privacidade e navegação.** O webview mantém sandbox, isolamento
      de contexto, Node desativado e partição dedicada; agora também bloqueia
      navegação não HTTP(S) e novas janelas, orientando o usuário a usar abas
      nativas do Folio.
- [x] **CG.13 — performance, smoke e polish.** O fluxo foi validado com
      typecheck, build do desktop e testes de protocolo da captura web, intake
      acadêmico e auditoria de diálogos. A UI limita candidatos visíveis,
      limita Search Runs a oito itens e descarta HTML após a análise.

#### Onda CI — Evidence-to-Writing Workflow

Família planejada para conectar leitura, extração de evidências e escrita sem
duplicar os domínios existentes. Fila de leitura, Search Run, Capture Inbox,
Evidence Synthesis, annotations, literatura e editor continuam sendo as fontes
de verdade; CI deve apenas compor projeções e handoffs explícitos.

- [x] **CI.1 — fila de leitura contextual:** a fila reaproveita a projeção
      `WorkspaceResearchOverviewDto`, permite abrir o PDF anexado ou a nota
      literária e atualiza a referência para `reading` antes do handoff. A
      navegação usa a mesma aba nativa do PDF Workspace; nenhum store novo foi
      criado.
- [x] **CI.2 — contexto preservado no PDF:** `PdfViewState` transporta contexto
      transitório de referência, revisão, Search Run e artefato; o leitor recebe
      a projeção sem gravá-la no Markdown ou em novo recurso portátil.
- [x] **CI.3 — annotation para extraction:** annotation selecionada no PDF é
      encaminhada como rascunho ao painel de extração, que preserva ID, página,
      artefato e revisor e só registra a extração ao confirmar explicitamente.
- [x] **CI.4 — Evidence Inspector:** cada extração agora abre uma projeção da
      cadeia extração → annotation → página → artifact → obra → referência,
      com retorno direto à annotation no PDF e sem materializar arestas novas.
- [x] **CI.5 — Literature Note Workspace:** o PDF Workspace abre a nota
      literária pelo serviço existente, envia annotations com locator para a
      nota e encaminha a mesma annotation ao Evidence Synthesis. PDF, Markdown
      e evidência permanecem superfícies distintas, sem novo store.
- [x] **CI.6 — Evidence → Claim:** claims suportadas ou contraditas por evidências, com criação e ligação revisável no Evidence Synthesis.
- [x] **CI.7 — Claim → manuscript:** geração de prévia Markdown com claim e evidências de suporte/contradição; a prévia é revisada antes de qualquer inserção autoral.
- [x] **CI.8 — provenance de claims:** projeção auditável liga claim, relação, evidência, obra, extrações, páginas, annotations e artefatos, sem duplicar conteúdo autoral.
- [x] **CI.9 — gate editorial:** claims só geram prévia para manuscrito quando todas as evidências relacionadas possuem extração auditável; o estado é exibido na UI.
- [x] **CI.10 — living research:** status de atualidade das claims baseado nas extrações verificadas, com sinalização de evidência desatualizada ou ainda não verificada.
      permanecem operacionais; inserções usam EditorTransaction após prévia.
- [x] **CI.11 — pacote reprodutível:** manifesto determinístico com fontes, estratégias, Search Runs, decisões, extrações, claims e relações, com hash e exclusão explícita dos bytes de PDFs.
- [x] **CI.12 — smoke ponta a ponta:** fluxo evidência → claim → extração → proveniência → pacote reprodutível validado em teste integrado; PDFs permanecem fora do pacote.
      hashes, estratégias, decisões e extrações sem PDFs protegidos por padrão.

#### Onda BO — Library Maintenance Center ✅

- [x] **F496–F504** — `libraryMaintenanceOverview` (único método novo de
      protocolo) é composição pura de sinais já existentes, por referência:
      citação (mesmo `#requireIndex().citations()` de `referenceHealth`/
      `researchOverview`), duplicata (`findReferenceDuplicates`, `@abnt/
      bibliography`, F53), saúde de anexo (`checkAttachmentHealth`, `@abnt/
      attachment-model`, Onda BH) e relação explícita (`#readReferenceRelations`,
      Onda BJ). A auditoria bibliográfica em si (`invalid-doi`, `missing-pdf`
      etc.) foi extraída de dentro de `referenceHealth` para o método privado
      `#auditCatalog`, reaproveitado por ambos — não há duas cópias do mesmo
      loop de validação. Nenhum algoritmo novo: o método só junta `Map`s por
      `referenceId`, no mesmo molde de `projectDashboard()` (F105) e
      `researchOverview()` (F45–F47). Duas ações em lote na UI, seguindo o
      precedente já existente de `batch.addToCollection`/`forms.
      applyReferenceType` (laço no cliente sobre métodos de item único, atrás
      de uma única confirmação) — nenhum método de protocolo novo para lote:
      remover referências selecionadas (`library.remove` em laço) e limpar
      anexos quebrados das selecionadas (busca `attachmentHealth()` fresco,
      filtra por seleção e código `missing-file`/`broken-link`, remove via
      `workspace.removeAttachment`). UI nova em
      `library-maintenance-center.tsx` (`LibraryMaintenanceCenterDialog`,
      comando `library.maintenanceCenter`): totais, lista com checkbox por
      referência e badges (citada/não usada, duplicata, anexos e problemas,
      relações, auditoria) — não duplica nenhuma das telas já existentes
      (`ReferenceMaintenanceDialog` continua sendo o fluxo de merge/rename
      passo-a-passo; `ReferenceHealthDialog` continua sendo o detalhe de
      auditoria; este painel é a visão agregada e o ponto de ações em lote).
      `tests/f496-library-maintenance.test.ts` (1 teste de integração via
      `MessagePort` real cobrindo citação, duplicata por DOI, anexo e
      relação simultaneamente, e confirmando que `referenceHealth` e
      `libraryMaintenanceOverview` concordam nos totais compartilhados).

#### Onda BP — Citation Picker Polish ✅

- [x] **F505–F507** — Descoberta desta onda: tanto `apps/desktop/src/
      workspace/*` quanto `apps/desktop/src/renderer/*` são proibidos
      (`.dependency-cruiser.cjs`, `severity: error`) de importar `@abnt/
      markdown`/`@abnt/standards`/`@abnt/semantics`/`@abnt/compiler`
      diretamente — compilação fica isolada no Compiler Service (ADR 0015/
      0017). Isso descartou "chamar o motor de verdade" para a prévia e
      forçou as três features a ficarem como extensão de DTO existente +
      composição no cliente, nunca um novo round-trip pelo compilador. Ver
      [ADR 0081](docs/adr/0081-citation-picker-polish.md).
      **F505 (ranking)**: `WorkspaceReferenceDto` (F31, `references()`)
      ganhou `citationCount` — `#requireIndex().citations(fileId)` agregado
      por referência, escopado ao documento aberto (as demais chamadas de
      `#referenceDtoFrom`, vault-wide, recebem 0 — nenhum consumidor delas
      lia esse campo antes de existir). `CitationDialog` ordena por
      `citationCount*2 + (está no mesmo projeto do documento ? 1 : 0)`,
      onde "projeto" é só leitura de `readResearchProjects(workspaceId)`
      (F103, já client-side) filtrando por `documentIds` — nenhum estado
      novo, nenhum protocolo novo.
      **F506 (prévia)**: `WorkspaceReferenceDto` também ganhou
      `narrativeAuthor`/`parentheticalAuthor`/`year`, calculados no host via
      `autorDaChamada`/`autorDaChamadaParentetica`/`anoDaReferencia`
      (`@abnt/bibliography` — as mesmas funções que `motorAutorDataAbnt`
      usa por baixo). `citationPreviewText` (novo, `citation-source.ts`)
      compõe a prévia no cliente com esses rótulos, mesma forma "autor
      (ano, locator)" do motor real, mas sem sufixo de ano (2020a/2020b) —
      rotulada "aproximada" na UI; a inserção continua vindo de
      `citationSource(draft)`, nunca da prévia.
      **F507 (locator inline)**: a tabela de abreviações (`p.`/`cap.`/
      `seção`/...) que já vivia embutida dentro de `editableCitationAt`
      (ADR 0029 já documentava essa cópia deliberada, por não poder importar
      o parser real) virou `parseLocatorSuffix`, exportada e reaproveitada
      por um campo novo de "adição rápida" no picker: digitar `chave, p. 12`
      resolve a referência e preenche locator/sufixo em um passo, sem as
      três interações separadas de antes.
      `tests/f505-citation-picker-polish.test.ts` (6 testes das funções
      puras) e `tests/f505-citation-picker-polish-protocol.test.ts` (1 teste
      de integração via `MessagePort` real confirmando `citationCount`/
      autor/ano em `references()`).

### Próximas ondas — integração de UI e produto

Esta sequência fecha a distância entre modelos puros já testados e as
superfícies desktop. Cada onda entrega package, protocolo, IPC, UI e teste de
integração; nenhuma cria uma segunda fonte de verdade fora do workspace.

#### Trilha principal de fechamento do produto

As próximas entregas não abrem uma nova família de produto. Elas fecham a
cadeia que transforma modelos e infraestrutura existentes em fluxos locais
completos, revisáveis e consistentes. A ordem é deliberada:

```text
BV.2–BV.4 (fundação de UX)
  → BF (identificadores)
  → BG (PDF reconciliation)
  → BR/BI (texto completo e integridade)
  → BT (views e forms)
  → BV.5 (regressão)
  → BU (sync e colaboração)
  → polish final ✅
```

- [x] **Polish final — fechamento de produto.** Revisão transversal dos fluxos
      recentes: diálogos têm estado de carregamento anunciado, falha recuperável
      e saída por teclado ou botão; confirmações seguem a fronteira única;
      Sync e Colaboração não prendem a interface quando a consulta falha.
      A suíte de regressão cobre os contratos de diálogo, confirmação, sync e
      preferências locais antes do build final.

#### Onda BX — Evidence synthesis genérica (planejada)

- [x] **BX.1 — modelo de evidência e migração.** Criar um pacote-folha para
      `Source`, `SearchStrategy`, `SearchRun`, `Record`, `Work`, `Artifact`,
      `EvidenceItem`, `AssessmentStage`, `Criterion`, decisão com proveniência
      e estado de texto completo. A migração de `ReviewStudy` é explícita,
      idempotente e reversível por backup; nenhuma biblioteca CSL-JSON,
      anotação ou anexo é duplicado. `Record` representa uma ocorrência de
      busca; `Work` reconcilia ocorrências; `Artifact` aponta para Attachment
      Model 2.0; `EvidenceItem` é a unidade que entra na síntese.
      `@abnt/evidence-synthesis` implementa a conversão determinística do
      Review v1 e registra `evidence-synthesis` como recurso operacional
      portátil; o estado legado permanece intacto até a UI configurável BX.3.

- [x] **BX.2 — busca reproduzível e intake.** Separar estratégia autoral de
      execução (`SearchRun`), guardar query conceitual, query compilada e query
      efetivamente executada, filtros, paginação, contagens e hash de artefato
      importado. Um contrato de provider compila uma Search AST restrita por
      capacidade; importação RIS/BibTeX/CSV e busca integrada convergem para a
      mesma Review Inbox, sem importar resultados automaticamente à biblioteca.
      A implementação registra fonte, consulta conceitual, consulta compilada,
      execução, paginação/filtros quando informados, contagens e hash do
      candidato. O compilador recebe uma AST restrita e capacidades declaradas,
      portanto não executa texto opaco nem acessa rede. RIS, BibTeX, CSL-JSON,
      CSV e lista manual são lidos conservadoramente no pacote puro e entram
      em `EvidenceSynthesis.inbox`; a criação de CSL-JSON continua sendo a
      confirmação explícita da Inbox de pesquisa existente.

- [x] **BX.3 — avaliação configurável.** Substituir o núcleo nomeado em torno
      de “study/screening” por estágios configuráveis, opções de decisão,
      critérios próprios, revisão simples ou dupla, cegamento e reconciliação
      manual. Exclusão em estágios definidos pelo workflow pode exigir motivo;
      cada decisão guarda revisor, data, nota e critério. Relações entre
      preprint, versão publicada e correção reutilizam Reference Relations em
      vez de deduplicação agressiva.
      A implementação trata candidatos da inbox como candidatos até admissão
      explícita a EvidenceItem; essa admissão não cria CSL-JSON. Estágios e
      critérios são editáveis, decisões são substituíveis apenas pelo mesmo
      revisor e conflitos não são decididos por maioria: uma reconciliação
      manual, identificada e datada é necessária. Estágios podem exigir motivo
      para exclusão; a validação fica no pacote puro antes da persistência
      protocolada.

- [x] **BX.4 — texto completo, PDF e extração auditável.** Reutilizar Full
      Text Discovery e Attachment Model 2.0: aquisição só após o estágio que a
      justifica e sempre confirmada. Anotações podem apontar para categoria,
      critério, campo de extração e papel de evidência. Valores extraídos têm
      proveniência (artefato, página, anotação, revisor e verificação); schemas
      suportam texto, rich-text, número, booleano, data, seleção, identificador,
      referência, anotação, medida e objeto estruturado.
      A interface reutiliza os métodos de descoberta e download já confirmados:
      uma obra precisa ser vinculada explicitamente a uma referência; candidatos
      não baixam sozinhos; o PDF confirmado entra no Attachment Model 2.0 e
      volta como Artifact da obra. Extrações aceitam valor simples ou objeto e
      registram artefato, página, anotação, revisor e instante de verificação.
      A validação não permite apontar para item ou artefato inexistente.

- [x] **BX.5 — workspace, síntese e exportação.** Criar um destino próprio no
      shell com Overview, Protocol, Sources, Searches, Records, Assessment,
      Full Text, PDFs, Extraction, Appraisal, Evidence, Synthesis e Reporting.
      O dashboard e as Academic Views continuam projeções. Síntese inicial é
      narrativa, temática, tabela e mapa de evidência; CSV/TSV/JSON servem
      análise externa. Monitoring RSS/Atom alimenta somente inbox revisável;
      living review reaplica estratégias e identifica records novos.
      O destino Síntese deriva Overview, narrativa, tabela e mapa diretamente
      do recurso operacional, sem salvar um relatório paralelo. Exportações
      CSV, TSV e JSON são arquivos locais para análise externa. A navegação de
      Pesquisa mantém protocolo/fontes/buscas, avaliação, texto completo e
      extração como destinos do mesmo estado; o monitoramento existente segue
      encaminhando material para inbox revisável, nunca para a biblioteca.

#### Família CE — PDF Workspace (planejada)

PDF passa a ser arquivo de primeira classe do vault: Explorer e anexos abrem
o mesmo leitor em uma tab identificada por WorkspaceFileId, não por caminho
nem por referência. O modelo canônico de anotação permanece sidecar,
portátil e sincronizável; anotações internas de PDF são apenas fronteira
explícita de importação/exportação. O renderer-pdf atual não participa desta
família: ele produz PDF de publicação, enquanto CE lê PDF já existente.

Antes da CE.2, avaliar em ADR licença, atualização, isolamento e packaging do
runtime de renderização interativo. Nenhuma dependência de leitor de PDF entra
em runtime comercial sem passar por check:licenses, build empacotado e smoke
Electron.

- [x] **CE.1 — PDF como arquivo de workspace.** Reconhecer
      application/pdf, abrir PDF do Explorer na mesma tab system de Markdown,
      preservar identidade por WorkspaceFileId, suportar divisão e fazer
      anexos de referência resolverem para esse mesmo leitor.
      A implementação reutiliza a fronteira binária segura de asset preview,
      agora limitada também a PDF de até 48 MB. A tab PDF é deduplicada por
      fileId e não por path; Explorer e o anexo primário da Biblioteca resolvem
      para o mesmo pane. O reader inicial renderiza página, navegação e zoom;
      text layer, miniaturas, annotations e divisão de pane continuam CE.2–CE.4.

- [x] **CE.2 — leitor dedicado.** Renderização de páginas, modo contínuo e
      página única, zoom, fit width/page, miniaturas, outline, navegação,
      busca, text layer, seleção e cópia. Estado de página/zoom/painéis é
      preferência operacional local, nunca escrita no PDF.
      O pane usa PDF.js já empacotado no desktop e seu worker local; entrega
      página única e fluxo contínuo, zoom, ajuste de largura, navegação por
      página, lista de páginas, outline quando disponível, text layer e busca
      por páginas. A seleção e a cópia usam a camada textual real. Persistência
      de posição/painéis e miniaturas rasterizadas ficam para o polimento,
      evitando transformar preferência efêmera em estado autoral.

- [x] **CE.3 — Annotation Model 2.0.** Migrar a identidade de
      referenceId + page para documento PDF estável ligado a WorkspaceFileId,
      com referência opcional, âncora semântica, offsets e geometria como
      fallback visual. Preservar compatibilidade com anotações existentes.
      O sidecar de annotations passou a gravar manifest v2, com PdfDocumentId,
      fileId opcional, kind, anchor textual, offsets e retângulos opcionais,
      createdAt e modifiedAt. Manifestos v1 são convertidos deterministicamente
      em leitura, preservando referência, trecho, comentário, cor e ligação de
      literature note. O contrato legado continua aceito durante a migração.

- [x] **CE.4 — UX de anotação no leitor.** Highlight, underline, strikeout,
      comentário, área e tinta; cores, edição, remoção, filtros e sincronismo
      bidirecional entre layer e sidebar. Sidecar é a única fonte canônica.
      PDFs soltos passam a criar e listar annotations pelo `fileId`, sem exigir
      CSL-JSON; a seleção da text layer grava quote, âncora e retângulos
      normalizados no sidecar. O leitor projeta as marcações sobre a página,
      permite escolher tipo/cor/comentário antes de salvar e remove a mesma
      annotation pela sidebar. O vínculo com literatura continua deliberadamente
      restrito a PDFs associados a uma referência e será aprofundado na CE.5.

- [x] **CE.5 — PDF e referência.** Vincular/desvincular referência, encontrar
      metadata via PDF reconciliation, abrir referência/nota, citar e criar
      referência. PDF solto permanece utilizável sem referência. O vínculo
      reutiliza o mesmo `WorkspaceFileId` pelo Attachment Model 2.0, sem
      copiar, mover ou alterar o PDF; o reader permite escolher referência,
      descobrir metadata localmente e criar a entrada antes do vínculo, abrir
      Biblioteca e criar/abrir a nota de literatura.

- [x] **CE.6 — deep links e Markdown.** Links para PDF, página e anotação,
      completion, definition, backlinks, copiar link, arrastar PDF/anotação e
      enviar seleção para nota com citação real. Entregue inicialmente o
      formato estável `folio://pdf/<fileId>?page=N&annotation=ID`, cópia de
      links de página/annotation e envio de annotation para a nota resolvendo
      a referência pelo Attachment Model. A resolução de links dentro do
      Markdown. Completion e backlinks já existiam; agora definition carrega
      `page` e o shell abre o PDF diretamente no locator indicado. O link
      `pdf-annotation:ID` usa um resolvedor injetado do host, devolvendo PDF,
      página e annotationId sem dar filesystem ao Language Service. O Research
      Browser também encaminha o candidato selecionado ao comando
      `citation.insert`, que o insere no editor ativo. Permanecem pendentes
      o cabeçalho do PDF e as annotations fornecem payload Markdown arrastável
      para o editor, sem escrita implícita; enviar uma annotation para nota
      abre a nota e insere a citação com página via `citation.insert`.

- [x] **CE.7 — importação de annotations embutidas.** Detectar highlights,
      comentários e geometria de leitores externos, apresentar revisão e
      importar somente por confirmação. Não implementar sincronização contínua
      sidecar ↔ PDF embutido. O reader inspeciona annotations PDF padrão
      (highlight, underline, strikeout, text comment e ink), apresenta a
      confirmação com a quantidade encontrada e grava apenas no sidecar. Cada
      importação preserva o identificador externo, tornando a operação
      idempotente; o arquivo PDF original nunca é regravado, achatado nem
      monitorado continuamente.

- [x] **CE.8 — exportação anotada.** Exportar cópia com annotations PDF padrão
      editáveis ou flatten, sempre sem sobrescrever o original. O reader gera
      uma cópia nova a partir dos bytes originais e do sidecar: no modo
      editável adiciona annotations PDF padrão; no modo achatado desenha as
      marcações diretamente nas páginas. O destino é um download com nome
      distinto, sem escrita no vault e sem substituição do PDF de origem.

- [x] **CE.9 — nova versão de attachment.** Criar versão anotada explícita no
      Attachment Model 2.0; preservar arquivo original e histórico. O reader
      oferece versões editável ou achatada somente para PDF já vinculado a uma
      referência; a cópia exportada é adicionada por `addAttachmentVersion`,
      com nome e nota de proveniência. O arquivo original e todas as versões
      anteriores permanecem intactos.

- [x] **CE.10 — integração com Evidence Synthesis.** O leitor encaminha uma
      annotation para a extração auditável, já com página e annotationId.
      A síntese persiste somente essa referência e o valor de extração: quote,
      comentário e geometria continuam canônicos no sidecar do PDF. Cada
      extração vinculada ganhou “Abrir anotação no PDF”, que encontra o sidecar,
      reutiliza a tab do arquivo e a posiciona na página correspondente.

- [x] **CE.11 — polimento.** A primeira página fica disponível antes de outline
      e annotations terminarem; em modo contínuo as páginas entram
      incrementalmente ao rolar. O leitor informa PDF inválido, protegido ou
      ausente e permite recarregar quando o vault muda externamente. Setas
      navegam, +/− ajustam zoom, F ajusta a largura, A verifica o próximo lote
      de annotations embutidas e Esc descarta uma seleção. Conflitos ao gravar
      o sidecar pedem recarregamento explícito, sem sobrescrever a alteração
      externa.

#### Família CF — PDF Workspace 2.0 (planejada)

Evoluir o leitor já entregue para um fluxo contínuo de leitura acadêmica:
PDF, annotation, evidência, nota de literatura e manuscrito. O PDF continua
imutável, o sidecar v2 permanece a fonte canônica de annotations e qualquer
ponte para Markdown, biblioteca ou Evidence Synthesis usa confirmação e os
contratos existentes.

- [x] **CF.1 — toolbar de annotation.** Exibir ações contextuais após seleção:
      highlight, underline, strikeout, comentário, extração, citação e cópia,
      com atalhos e sem criar uma segunda camada de edição. A toolbar fica
      ancorada ao fluxo de leitura, usa o sidecar v2 para salvar as marcações,
      abre o campo de comentário sem perder a seleção e encaminha extração,
      citação e cópia para as ações já existentes. Os atalhos Alt+H, Alt+U,
      Alt+S, Alt+M, Alt+E, Alt+C e Alt+X cobrem as ações sem disputar os
      atalhos nativos do editor.
- [x] **CF.2 — sidebar avançada.** Agrupar annotations por página e permitir
      busca textual, filtro por tipo e filtro por vínculo com nota; cada item
      exibe sua página, pode ser clicado para reposicionar o leitor e mantém
      as ações de copiar link, enviar para nota, usar na síntese e remover.
      Cor, semântica e tags ainda dependem da taxonomia prevista em CF.11.
- [x] **CF.3 — deep links autorais.** Links copiados pelo leitor agora usam
      Markdown estável para o arquivo e a página (`[[caminho.pdf#page=N]]`)
      ou para a annotation (`[[pdf-annotation:ID]]`); `folio://` continua
      reservado ao routing interno. A resolução interativa desses links,
      completion, definition e backlinks seguem como trabalho das etapas
      seguintes do language service.
- [x] **CF.4 — pontes por arrastar e soltar.** Annotations da sidebar podem
      ser arrastadas como payload Markdown autoral para o editor; o destino
      insere o link na posição atual do cursor sem acesso direto ao vault.
      As ações de extração e síntese continuam explícitas e revisionadas pelos
      fluxos já existentes, com marcadores de origem idempotentes.
- [x] **CF.5 — modo de leitura.** O leitor agora abre a nota de literatura
      vinculada em um painel lateral sobre o mesmo workspace, sem abandonar o
      PDF; o conteúdo é carregado pela sessão do editor e permanece separado
      do sidecar e do PDF. Quando não há vínculo, a ação informa o próximo
      passo em vez de criar estado implícito.
- [x] **CF.6 — contexto de referência.** O painel do leitor mostra a
      referência vinculada, o estado do anexo, a quantidade de versões e as
      ações para abrir a nota, abrir a referência na Biblioteca ou desvincular.
      Para PDFs soltos, mantém disponíveis descoberta de metadata, vínculo
      explícito e abertura da Biblioteca.
- [x] **CF.7 — busca de annotations.** A busca global combina os resultados
      do índice de documentos com annotations dos PDFs do vault, pesquisando
      quote e comentário sem duplicar o conteúdo no workspace. Resultados
      identificados como annotation abrem a tab PDF e posicionam a página
      correspondente; a indexação dedicada no FTS continua uma otimização
      futura, sem alterar o contrato autoral.
- [x] **CF.8 — backlinks do PDF.** O contexto do leitor consulta os backlinks
      derivados pelo índice existente e lista os arquivos e rótulos que usam o
      PDF. Arestas continuam derivadas, sem persistência ou fonte de verdade
      adicional.
- [x] **CF.9 — progresso de leitura.** Persistir localmente, por PDF, a
      última página, a maior página alcançada, a última abertura e o status
      inicial de leitura. O estado fica em localStorage operacional e nunca
      altera o PDF ou o Markdown autoral.
- [x] **CF.10 — workspace multi-PDF.** O shell permite manter vários PDFs
      abertos em abas nativas, cada um identificado por `WorkspaceFileId`, e
      alternar entre eles sem copiar arquivos nem criar estados paralelos de
      extração. Página, annotations, progresso e contexto de cada PDF
      permanecem associados à sua própria aba/documento.
- [x] **CF.11 — taxonomia de annotations.** Separar cor visual de tipo
      semântico pesquisável, com vocabulário inicial para população,
      intervenção, método, outcome, finding, limitation, risk, quote e
      context. O tipo é validado no protocolo, persistido no sidecar e pode
      ser escolhido e filtrado no reader, sem confundir semântica com cor.
- [x] **CF.12 — desempenho.** O comando \`pnpm benchmark:pdf-workspace\` executa
      cargas reproduzíveis de 50, 200, 500 e 1000 páginas e mede compilação,
      geração de HTML e tamanho produzido; a indexação/listagem/busca do vault
      permanece coberta por \`benchmark-large-vault.ts\`. Pintura, rolagem,
      overlays e memória do Chromium continuam verificadas pelos smoke e pela
      regressão visual do desktop, sem apresentar timings headless como medida
      de UI.

Ordem de entrega: CF.1, CF.2, CF.5, CF.3, CF.4, CF.6, CF.7, CF.8, CF.10,
CF.11, CF.12. A CE.6 continua a registrar as pontes Markdown ainda parciais;
CF.3–CF.4 a completam sem mudar o formato canônico de annotation.

- [x] **Onda BF — Identificadores acadêmicos como fluxo de produto.** A entrada
      universal e em lote para DOI, ISBN, PMID, arXiv e ADS usa o registry
      existente, revisão por item, proveniência de provider e duplicatas no
      mesmo item de inbox. Os comandos `reference.addByIdentifier` e
      `reference.addIdentifiersBatch` passam pelo Command Registry; falhas de
      provider nunca invalidam o lote inteiro, e a confirmação reutiliza a
      inbox e a biblioteca canônica sem estado paralelo.

- [x] **Onda BG — PDF reconciliation como intake autônomo.** PDFs entram na
      inbox e permanecem revisáveis mesmo sem metadata. O host extrai apenas
      texto local dos bytes e o pacote aplica `identifiersFromPdfText`; cada
      identificador passa pelo registry BF. A UI apresenta candidato e
      duplicata antes de criar/anexar, preserva o não resolvido sem inventar
      metadata e pede o papel do Attachment Model 2.0 explicitamente. Não há
      OCR, LLM ou resolver específico do PDF.

- [x] **Onda BR/BI — Texto completo e integridade bibliográfica.** Fechar
      F515–F522 e incorporar F460–F467: registry pequeno de providers
      injetáveis, busca explícita por DOI/título, revisão de candidato
      (provider, URL, licença, versão, confiança e data), download confirmado
      para Attachment Model 2.0 e proveniência operacional fora do CSL-JSON.
      Batch apenas encontra candidatos; cada download continua confirmado.
      Status acadêmico usa provider/evidência/data para normal, retratado,
      corrigido, expression-of-concern ou desconhecido; Biblioteca, Peek,
      inserção de citação e preflight mostram avisos sem bloquear
      permanentemente. Relações de correção reutilizam Reference Relations.
      A integridade fica em `.academic/integrity/reference-integrity-records.json`:
      o pesquisador registra explicitamente status, provider, evidência e data,
      sem rede silenciosa nem alteração do CSL-JSON. A Biblioteca e a auditoria
      de saúde exibem retratação, correção, expression of concern e ausência de
      verificação como avisos revisáveis.

- [x] **Onda BT — Views e forms operacionais.** Só começa após auditorias
      manuais F405 (Canvas) e F406 (block composition). Productizar adapters
      de projetos, datasets, revisão sistemática e anotações sobre a fonte
      real do Workspace Service; entregar editor visual para origem, filtro,
      ordenação, grupo, colunas e layout; e expor relation, rollup e fórmula
      com preview pelo parser restrito existente, nunca `eval`. Forms seguem
      sempre `validar → prévia → confirmar → host`.

- [x] **Onda BV.5 — Regressão e polish transversal.** Depois de BF, BG, BR e
      BT, concluir a auditoria de semântica/contraste, estados assíncronos,
      confirmações de mutações e revisão visual/teclado dos fluxos novos antes
      de declarar F152–F155 fechadas. Diálogos passam a ter nome, foco preso,
      Escape e retorno de foco; controles de fechar legados são normalizados
      como ícones nomeados. As superfícies assíncronas prioritárias anunciam
      loading, erro recuperável e retry. Capturas e formulários também cobrem
      rejeições de Promise, não ficando em estado intermediário.

- [x] **Onda BU — Sync e colaboração de produto.** Depois dos fluxos
      locais acima. Implementar primeiro conta, dispositivo, destino, status e
      fila offline; depois sync incremental, comparação/merge manual,
      compartilhamento/permissões e, somente após ADR, E2EE. O vault legível
      continua fonte de verdade; conta não define identidades; SQLite, cache,
      previews, CRDT, locking e edição simultânea ficam fora do escopo. A
      entrega usa pasta espelho local como destino configurável e persistido só
      na máquina em `.academic/local/`; o engine já sincroniza Markdown,
      binários e estado operacional portátil, preserva fila offline e exige
      decisão explícita em conflito. Colaboração compartilha papéis, marcos,
      atribuições, menções, presença e triagem, sem segunda fonte de verdade.

#### Onda BQ — Intake acadêmico unificado

- [x] **F508–F514** — intake acadêmico unificado: DOI, ISBN, PMID e arXiv
      passam por registry de providers explícitos (`doi.org`, Open Library,
      Europe PMC e arXiv), devolvendo candidato CSL-JSON, proveniência e
      duplicatas antes de qualquer escrita. ADS informa que exige credencial
      NASA ADS configurada, sem inventar metadata. O drop de PDF usa
      `reconcilePdfText` e o mesmo registry, preserva o scanner literal sem
      OCR e leva a referência candidata para a inbox existente, onde o usuário
      escolhe criar ou anexar ao pai detectado. Protocolo, IPC e UI do intake
      estão cobertos por teste MessagePort em `tests/f508-scholarly-intake-
      protocol.test.ts`.

#### Onda BR — Texto completo e integridade bibliográfica

- [x] **F515–F522** — integrar BI: providers explícitos de full text,
      candidatos revisáveis e download confirmado para Attachment Model 2.0.
      Incluir F460–F467: status de retratação/correção, refresh explícito e
      avisos em biblioteca, citação e preflight. `@abnt/reference-integrity`
      valida o registro portátil de evidências; Workspace Service o persiste e
      a Reference Health o projeta como avisos. Não há consulta automática a
      serviços externos: provider, URL/identificador da evidência e data são
      sempre revisados e informados pelo pesquisador.

#### Onda BS — Assistentes de pesquisa estruturada

- [x] **F523–F526 — IA acadêmica opt-in:** provider local configurado por
      solicitação, contexto escolhido por item e disclosure com contagem de
      caracteres antes da rede. A resposta é só sugestão: a inserção no
      documento ativo exige segunda confirmação e usa a sessão do editor,
      seguida de salvamento. Nenhum conteúdo do vault é enviado por padrão.
- [x] **F527–F531 — revisão sistemática local-first:** recurso operacional
      versionado em `.academic/systematic-review`, portátil no sync, para
      protocolo, registros de busca, estudos, decisões por revisor, motivos de
      exclusão, extração, qualidade e destinos de evidência. A tela oferece
      triagem, sinaliza conflito/acordo entre revisores e mostra o fluxo PRISMA;
      referências e Markdown continuam suas fontes canônicas.
- [x] **F532–F534 — dados de pesquisa:** registry portátil em
      `.academic/datasets`, importação binária exclusivamente pelo host,
      SHA-256, linhagem de versões, preview read-only de CSV/TSV/JSON e
      dicionário inferido. A interface também projeta citação CSL-JSON e
      manifesto de reprodutibilidade para cópia. Nenhum arquivo é analisado ou
      transformado sem a ação explícita de importação/preview do usuário.

#### Onda BT — Views e formulários operacionais

- [x] **F535–F541** — adapters restantes de Academic Views (F296–F299), editor
      visual de filtros/ordenação/agrupamento/colunas (F300) e fluxos reais dos
      forms (F407), depois das auditorias Canvas e block composition (F405–F406).
      A auditoria atual confirma que as fontes reais, layouts, filtros,
      ordenação, agrupamento e colunas derivadas já estão expostos em
      `academic-views.tsx` e cobertos por
      `tests/f535-academic-views-adapters.test.ts`. Os formulários validam os
      dados antes do envio e exigem a ação explícita de salvamento; a integração
      é coberta por `tests/f407-forms-workflow-integration.test.ts`.

#### Onda BU — Colaboração e sync de produto

- [x] **F542–F551** — colaboração e sync de produto local-first. A direção de
      produto é aproximar o Folio de um vault-sync local-first:
      A direção de produto é aproximar o Folio de um vault-sync local-first:
      o vault legível permanece a fonte de verdade, a conta é opcional e só
      autoriza destinos/dispositivos; SQLite, previews e caches nunca viajam.
      A entrega será fatiada em BU.1 conta/dispositivo/status/fila offline;
      BU.2 sync remoto incremental para texto, JSON operacional e binários por
      hash; BU.3 comparação e resolução manual de conflitos; BU.4
      compartilhamento de vault e permissões; e BU.5 E2EE somente depois de
      ADR para chaves e recuperação. Não inclui CRDT, locking nem edição
      simultânea: texto continua a exigir merge explícito quando divergir.
      Colaboração existente (papéis, marcos, atribuições, menções, presença e
      triagem) permanece uma camada operacional sincronizável sobre esse
      modelo, não uma segunda fonte de verdade. O destino é restaurado ao
      reabrir o vault mas nunca sincronizado; status não expõe paths. O painel
      mostra fila, indisponibilidade e conflitos com escolhas explícitas de
      manter local ou usar espelho. E2EE, conta hospedada e edição concorrente
      continuam fora desta entrega por exigirem infraestrutura e ADR próprios.

#### Onda BV — Qualidade, perfis e distribuição

#### Onda BW — Workspace híbrido de páginas (concluída)

BW.1 entrega `@abnt/page-workspace`: páginas continuam arquivos Markdown e
passam a aceitar frontmatter autoral `folio:` com ID estável, tipo, status,
tags, aliases, prazo, projeto e relações declaradas. Checkboxes seguem no
corpo Markdown e são projetados como tarefas; filtros, ordenação, grupos,
wikilinks e backlinks são derivados, nunca uma segunda fonte de verdade.

BW.2 registra páginas, propriedades, tarefas e layout da Home no protocolo,
IPC e Workspace Service. Toda edição abre a sessão, exige revisão, despacha
uma transação e chama `save()`; layouts ficam em `.academic/home/` como estado
operacional portátil. Markdown sem `folio:` permanece plenamente válido e só
vira página por ação explícita e idempotente.

BW.3 substitui a Home fixa por blocos configuráveis (recentes, documentos,
tarefas, projetos, bases, capturas, calendário, grafo e atalhos), com ordem,
visibilidade e largura persistidas. A reordenação aceita arrastar e soltar e
mantém botões de subir/descer como alternativa acessível por teclado. O cabeçalho do editor agora permite
converter um documento em página e editar tipo, status, projeto, tags, aliases
e prazo acima do
Markdown. O shell abre com trilho compacto, explorador persistente, editor ao
centro e Contexto à direita; explorador e Contexto são recolhíveis e suas
larguras são redimensionáveis, persistidas no mesmo estado portátil da Home.
Backlinks e relações abrem, a partir do cabeçalho da página, os painéis já
derivados do índice e do grafo, sem criar arestas persistidas extras.
Projeto é selecionado pela lista portátil de projetos e ainda explicita um
vínculo órfão para que ele possa ser corrigido, em vez de trocar IDs silenciosamente.
O layout de quadro das Academic Views agrupa dinamicamente pelo campo escolhido
(inclusive rollups, fórmulas e relações derivadas), sem colunas ou cartões fixos.
Views de documentos também projetam tipo, status e prazo de `folio:`; o
calendário ordena o prazo real quando a página o declara.
Os itens da Home mantêm título e contexto em linhas próprias, com truncamento,
foco visível e hover estável; não dependem de uma classe utilitária removível no build.
Markdown sem `folio:` permanece silenciosamente utilizável: habilitar a camada
de página é uma ação secundária no menu de reticências e na Command Palette.
O explorador revela o documento ativo, expande resultados filtrados e permite
recolher a árvore sem perder o estado do vault.
O modo de personalização também inclui blocos ausentes, e Favoritos projeta os
bookmarks portáteis já existentes, sem copiar dados ou criar uma coleção paralela.
BW.4 amplia o manifesto declarativo de plugins com temas, painéis,
blocos da Home, propriedades e renderizadores de view; essas contribuições
continuam DTOs validados, sem DOM, vault ou IPC genérico.

BW.5 adiciona temas claro/escuro portáveis em `.academic/themes/`, com tokens
JSON restritos, aplicação por variáveis CSS e troca pela Home. Projetos agora
são lidos e gravados pelo recurso portátil `.academic/research-projects/`; o
endpoint de importação explícita e idempotente de dados legados aceita apenas
registros minimamente identificáveis e deduplica por ID. A interface provisória
de importação foi removida da Home para não expor a noção de “projeto legado”.
A fila de leitura também foi normalizada como recurso portátil; Fluxo de
pesquisa, intake e monitoramento acrescentam ou alteram itens por esse mesmo
contrato. A regressão visual/smoke desktop completo permanece para o polimento
seguinte.

#### Onda BX — Coleção inicial de plugins locais (em andamento)

- [x] **F562 — Pontes de ecossistema instaláveis:** `examples/plugins/` passa
      a distribuir cinco plugins completos e isolados: Zotero, Mendeley,
      templates institucionais, busca acadêmica e assistência local. As
      pontes Zotero/Mendeley abrem a inbox de pesquisa com CSL-JSON, RIS ou
      BibTeX já selecionado; a importação continua explícita, revisável e
      converte para a biblioteca CSL-JSON canônica. O plugin de templates
      institucionais abre o criador nativo já no TCC ou artigo institucional.
      A busca encaminha para a inbox de identificadores, onde DOI, PMID, ISBN,
      arXiv e ADS são resolvidos como candidatos revisáveis; a assistência
      local abre o assistente estruturado existente, que preserva disclosure e
      consentimento antes de qualquer envio. Os plugins retornam apenas ações
      declarativas, sem DOM, escrita implícita no vault ou rede silenciosa.
      `open-intake`, `open-template` e `open-structured-research` são
      respostas de comando validadas ponta a ponta e limitadas às superfícies
      que o Folio já autoriza.
      A coleção acompanha o Workspace Service e é instalada no primeiro
      carregamento de um vault apenas quando cada diretório ainda não existe;
      não substitui nem atualiza código local do usuário.
      A descoberta e o ciclo IPC dos cinco exemplos são verificados em
      `tests/f562-official-plugin-examples.test.ts`.

- [x] **F563 — Gerenciador de vaults:** o shell substitui o atalho isolado de
      abrir vault por uma janela com vaults recentes, atualização, abertura de
      outra pasta, criação de vault e remoção somente do atalho local. O Main
      mantém a lista em `userData`, abre os diálogos nativos e cria um
      `README.md` inicial sem expor escrita arbitrária ao renderer; remover um
      recente nunca apaga arquivos. O contrato é coberto em
      `tests/f563-vault-manager-contract.test.ts`.

- [x] **F564 — Explorador orientado à autoria:** arquivos técnicos e diretórios
      operacionais (`.academic`, `.git`, `node_modules`, JSON, JS, TS, Lua,
      LaTeX/estilos, CSS e mapas/configurações) deixam de poluir a árvore;
      Markdown, PDFs, imagens
      e anexos continuam visíveis. Cobertura em
      `tests/f564-file-explorer-filter.test.ts`.

- [ ] **F552–F559** — fechar o polimento transversal do desktop, concluir a
      família institucional APA e preparar Windows x64 sem declarar suporte
      antes de uma execução nativa. A onda não muda as fontes de verdade do
      workspace nem introduz sync, conta ou telemetria.

  Entregas e critérios de aceite:

  - [x] **F552 — teclado de diálogos:** Escape, Tab/Shift+Tab, foco inicial e
        restauração do foco de origem para todos os modais; listas
        virtualizadas mantêm setas, Page Up/Down, Home e End. O shell cobre
        diálogos legados durante a transição e o algoritmo de borda é testado
        em `tests/f552-dialog-navigation.test.ts`.
  - [x] **F553 — semântica acessível:** `normalizeDialogSemantics` completa
        papel, `aria-modal`, nome e descrição nos modais legados enquanto cada
        janela nova usa o hook local; o foco visível não depende só de cor. A
        auditoria estática cobre essa fronteira em
        `tests/f553-desktop-dialog-audit.test.ts`.
  - [x] **F554 — estados assíncronos:** listagens e projeções priorizadas
        distinguem carregamento, vazio orientado e erro recuperável. O gestor
        de plugins passou a expor `role=status`, `role=alert` e tentativa de
        novo carregamento, em vez de parecer vazio durante a consulta.
  - [x] **F555 — mutações seguras:** a confirmação acessível compartilhada
        cobre as ações críticas auditadas; descarte da inbox nomeia o item e o
        envio ao endpoint local declara destino e volume antes da operação.
        O renderer não usa `window.confirm`; a regressão está em
        `tests/f555-confirmation-boundary.test.ts`.
  - [x] **F556 — APA institucional:** `apa-7-institutional` exige metadados
        institucionais configuráveis; `apa-7-university-program` é a
        composição declarativa para universidade e programa. Ambos preservam
        `apa-7` como profile-base e não duplicam regras de citação.
  - [x] **F557 — build nativo Windows:** `win32-x64` está habilitado no manifesto e
        o pipeline recompila o addon no próprio runner Windows, sem reutilizar binário
        Linux nem tentar cross-compile do `better-sqlite3`; a matriz e a
        separação de cache são cobertas por `tests/p18-native-matrix.test.ts`.
  - [ ] **F558 — pacote Windows:** gerar instalador NSIS x64 e executar smoke
        real em `windows-2022`, atravessando vault, SQLite/FTS, edição,
        preview, PDF e DOCX antes de promover o target. O script já bloqueia
        execução fora de `win32-x64`, exige `FOLIO_NATIVE_TARGET` correspondente
        e valida a presença do `.exe`; a guarda é coberta por
        `tests/f558-windows-package-guard.test.ts`. A geração real continua
        aguardando runner Windows.
  - [ ] **F559 — publicação e suporte:** só após F558, atualizar a matriz de
        distribuição e os links de download. Assinatura e atualização
        automática continuam fora do escopo; macOS segue sem target até ter
        runner, política de assinatura/notarização e smoke próprios.

  Estado inicial: F556 está concluída. A configuração de build e pacote para
  Windows existe, mas F558–F559 continuam abertos até a validação em um runner
  `win32-x64`; o ambiente Linux não é evidência de compatibilidade Windows.

  Plano de execução auditável:

  - [x] **BV.1 — inventário e teclado:** os diálogos com `role=dialog` ou
        `role=alertdialog` são governados pelo shell durante a transição; cada
        modal novo adota o hook local. Escape, Tab/Shift+Tab, foco inicial e
        restauração do foco de origem têm uma implementação única. Listas
        longas mantêm setas, Page Up/Down, Home e End via `VirtualizedList`.
  - [x] **BV.2 — semântica e contraste:** o hook e a normalização global
        asseguram papel modal, rótulo e descrição inclusive em janelas
        legadas; controles focados recebem contorno visível de alto contraste.
  - [x] **BV.3 — estados assíncronos:** as superfícies priorizadas anunciam
        carregamento (`role=status`), vazio com próximo passo e erro
        recuperável (`role=alert`); o gestor de plugins adota integralmente o
        contrato para a operação de descoberta e recarga.
  - [x] **BV.4 — mutações e operações em lote:** `requestConfirmation`
        continua a única confirmação de UI e agora protege também o descarte
        da inbox e o envio de texto ao endpoint local, explicando alvo, efeito
        e destino antes de qualquer ação.
  - [x] **BV.5 — regressão de UI:** testes de teclado/foco e de
        estados loading/error para cada família de diálogo, executar typecheck,
        testes relevantes, build desktop e revisão de contraste/semântica.

### F102 — Segunda família acadêmica: APA 7ª edição

Escolha de produto: **APA 7ª edição**, por alcance internacional em ciências
sociais e comportamentais, ciências naturais, enfermagem, comunicação,
educação, negócios e engenharia. A implementação permanece uma sub-sequência
própria — não uma única feature:

- [x] F102A — specification mapping (escopo inicial: artigo APA 7)
- [x] F102B — citation engine rules (autor-data, narrativa, múltiplas fontes e locator)
- [x] F102C — validation (metadados essenciais, abstract e qualidade de DOI)
- [x] F102D — publication profile (APA 7 Article registrado no Compiler Service)
- [x] F102E — fixtures (publicação cobre citação e referência APA)
- [x] F102F — visual regression (fixture APA 7 em PDF/PNG e baseline aprovado)
- [x] F102G — institutional variants (`apa-7-institutional` configurável e
      `apa-7-university-program` como composição declarativa de referência)

O profile APA será implementado sem copiar texto protegido do manual: regras
codificadas, fixtures autorais e referências públicas por edição/cláusula.

#### Onda CH — Integração do Research Workflow

- [x] **CH.2 — Search Runs persistidos.** A busca acadêmica do navegador
      grava cada execução na revisão sistemática BX e associa seu identificador
      ao contexto compartilhado.
- [x] **CH.3 — revisão estruturada.** A análise cruza candidatos com a
      Biblioteca e alerta possíveis duplicatas antes do encaminhamento.
- [x] **CH.4 — handoff de PDF.** PDFs detectados podem ser abertos na origem
      ou enviados explicitamente à Capture Inbox para revisão. O navegador não
      baixa nem grava arquivos silenciosamente; a confirmação e o fluxo de
      anexos existentes continuam responsáveis pela persistência.
- [x] **CH.5 — destinos do workflow.** A aba oferece atalhos para Capturas,
      Biblioteca, Projetos, Revisão e Fila. Revisão abre o workflow BX; a fila
      encaminha primeiro o candidato à Capture Inbox, preservando confirmação
      e a autoridade dos recursos existentes.
- [x] **CH.6 — busca acadêmica multi-fonte.** A busca reproduzível suporta
      Google Scholar, OpenAlex e Crossref, registrando a fonte escolhida no
      mesmo Search Run e abrindo a consulta no navegador de pesquisa.
- [x] **CH.7 — integração de Search Run.** Ao analisar a página de resultados,
      o navegador localiza a execução correspondente e atualiza seu
      `resultCount` com os candidatos estruturados encontrados, preservando o
      registro BX como fonte portátil da execução.
- [x] **CH.8 — sidebar de pesquisa.** O contexto do navegador acompanha a
      execução ativa, a sessão e o estado do candidato, incluindo vínculo
      semântico pelo `searchRunId` e sinalização de possíveis duplicatas. A
      projeção permanece transitória e não duplica dados do workspace.
- [x] **CH.9 — citation chasing.** A busca de trabalhos relacionados usa o DOI
      ou título do candidato selecionado, registra a consulta como Search Run,
      identifica a origem no contexto da aba e retorna ao mesmo fluxo de
      análise, revisão e captura.
- [x] **CH.10 — evidência, nota e citação.** O candidato selecionado pode ser
      enviado à Capture Inbox como evidência ou nota com título, DOI, fonte e
      URL preservados. A ação de citação continua usando o Command Registry e
      o fluxo revisionado do editor, sem escrita direta no Markdown.
- [x] **CH.11 — sessões de pesquisa.** Início, encerramento, título, horário e
      métricas de análise/captura são restaurados por aba através de
      `localStorage`; o título pode ser ajustado, e o encerramento preserva o
      registro para retomada posterior. A sessão é operacional e local; não
      altera o vault nem a persistência bibliográfica. A regressão está em
      `tests/ch11-research-sessions.test.ts`.

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
