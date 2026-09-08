# ADR 0018 — Servidor LSP: um segundo host sobre a mesma language-service

**Status:** aceito · 2026-09-07

## Contexto

`@abnt/language-service` (P5) já existia headless, com outline, diagnósticos,
completions, hover, definição, referências e backlinks — desenhado desde o
início para ter "CodeMirror e LSP como adaptadores acima dele" (comentário na
própria fronteira de dependency-cruiser). O desktop (P9-P12) é um desses
adaptadores. Este ciclo entrega o outro: um servidor Language Server Protocol
real, para qualquer editor que fale LSP (Neovim, VS Code sem o desktop, etc.)
sem reimplementar nenhuma regra de outline, diagnóstico ou resolução de link.

## Decisão

### Composição in-process, sem a isolação de processos do desktop

O desktop isola compilação num utility process porque um crash do compilador
não pode derrubar a janela do Electron (ADR 0014). O LSP não tem essa
motivação: é um único processo Node, e um crash dele já mata a sessão do
editor inteira de qualquer forma (é assim que todo LSP funciona). Por isso
`apps/lsp/src/workspace.ts` compõe tudo num só processo — storage, índice
SQLite, sessões e language service — com o compilador rodando in-process via
`createInProcessCompilerClient(criarServicoDeCompiler())`, exatamente como
`apps/cli/src/environment.ts` já faz. A fronteira `lsp-e-so-adapter-lsp`
(`.dependency-cruiser.cjs`) reflete essa decisão: proíbe Markdown/normas/
semântica diretamente (isso a sessão já delega ao compiler) e UI/Electron/
renderização (o LSP não tem preview), mas permite `@abnt/compiler` — ao
contrário da regra homônima do desktop, que proíbe justamente `compiler`.

Índice em `.academic/index-lsp.sqlite`, deliberadamente separado do
`.academic/index.sqlite` do desktop: SQLite não garante segurança sob dois
processos escrevendo concorrentemente no mesmo arquivo, e um editor externo
(Neovim) rodando ao lado do desktop é um cenário real, não hipotético.

### Resolver de ambiente compartilhado, extraído antes de duplicar

O resolvedor de bibliografia criado no P12 (`CompilationEnvironmentResolver`
via `WorkspaceStorage` + `documentTarget`) foi escrito dentro de
`apps/desktop/src/workspace/environment.ts`. O LSP precisa exatamente da
mesma capacidade. Em vez de copiá-la (o que garantiria divergência no
primeiro caso de borda, como o resto deste projeto insiste em evitar), ela
foi extraída para `packages/workspace-environment/` **antes** de escrever
qualquer código do LSP, com sua própria fronteira
(`workspace-environment-so-resolve-dependencias-autorais`). O desktop passou
a importar do package compartilhado; o arquivo antigo foi deletado, não
mantido como re-export de compatibilidade.

### O servidor é uma função, não um script com efeito colateral no import

`apps/lsp/src/create-server.ts` exporta `createLspServer(input, output):
Connection` — toda a lógica (workspace, sincronização de documentos,
handlers) vive aqui, parametrizada pelos streams de transporte.
`apps/lsp/src/server.ts` é só o bin de fato: `createLspServer(process.stdin,
process.stdout)`. Sem essa separação, testar o servidor exigiria spawnar um
subprocesso real; com ela, `tests/p13-lsp.test.ts` fala o protocolo real
(framing `Content-Length`, JSON-RPC) contra um par de `PassThrough` em
memória — mesmo espírito do MessagePort real usado nos testes de integração
do desktop (P10/P11/P12), sem o custo de um processo à parte.

### Sincronização de documento: `didOpen`/`onDidChangeContent` disparam quase juntos

Bug real encontrado durante a verificação manual: a classe `TextDocuments` da
`vscode-languageserver` trata abrir um documento como uma mudança de conteúdo
(de vazio para o texto inicial) — `onDidOpen` e `onDidChangeContent` disparam
para o MESMO evento, quase simultaneamente. A primeira implementação fazia
`onDidOpen` chamar `await sessions.open(fileId)` e depois `replaceContent`,
enquanto `onDidChangeContent` chamava `replaceContent` direto — sem esperar
`open()` terminar. Resultado: `replaceContent` corria antes da sessão existir
e lançava `A sessão do arquivo ... não está aberta`. Corrigido memoizando a
promessa de abertura por fileId (`ensureOpen`), para que os dois handlers
esperem a MESMA operação de abertura antes de escrever conteúdo.

### `uriFromPath` precisa normalizar barra final tanto quanto `pathFromUri`

Segundo bug real, também achado na verificação manual (não em teste
unitário isolado — só apareceu na conversão de ida e volta usada por
`definition`/`references`): `pathFromUri` já normalizava um `rootPath` com
barra final, mas `uriFromPath` concatenava `` `${rootPath}/${path}` `` sem a
mesma checagem, produzindo `file:///vault//b.md` quando `rootPath` chegava
com `/` no fim. `definition`/`references` (que precisam montar a URI de um
arquivo DIFERENTE do documento aberto) resolviam para uma URI mal formada,
`documentFor` não encontrava o arquivo, e o resultado silenciosamente virava
`[]` — sem erro, só uma lista vazia. `hover`, que não passa por
`uriFromPath`, funcionava normalmente, o que ajudou a isolar o bug: outline e
hover corretos, definição e referências vazios, apontou direto para a única
função usada pelos dois últimos e não pelos dois primeiros. Fixado
normalizando a barra final em `uriFromPath` do mesmo jeito que `pathFromUri`
já fazia. `tests/p13-lsp.test.ts` fixa essa regressão explicitamente.

### Diagnósticos são push, só para documentos abertos no editor

O LSP assina `workspace.sessions.subscribe(...)` e publica diagnósticos via
`connection.sendDiagnostics` sempre que um evento de sessão chega — mas só
para arquivos que estão `documents.get(uri) !== undefined`, isto é, abertos
no editor conectado. Publicar diagnóstico de um arquivo que o cliente nunca
abriu não tem para onde ir na UI de nenhum editor real.

### Sem rename, sem `workspace/symbol`, sem code action

Fora de escopo deste ciclo, por decisão explícita do roadmap: rename
multi-arquivo precisa de um contrato `WorkspaceEdit` (identidade de arquivo,
revisão/hash esperado, ranges, edições, tratamento de conflito) que ainda não
existe — implementar rename sem isso primeiro seria construir sobre um
alicerce que ainda não foi desenhado.

## Consequências

- `apps/lsp` expõe `documentSymbol`, `hover`, `definition`, `references`,
  `completion` e diagnósticos via push — todos traduzindo tipos de
  `@abnt/language-service`, nenhum reimplementando lógica de resolução.
- `tests/p13-lsp.test.ts`: um teste de integração fala o protocolo LSP real
  fim a fim (initialize → didOpen → outline → definição → hover →
  referências → completion → shutdown) sobre streams em memória, mais três
  testes unitários de `pathFromUri`/`uriFromPath`, incluindo a regressão da
  barra dupla.
- Verificado manualmente com um cliente LSP mínimo falando `Content-Length`
  framing sobre stdio contra o processo real (`tsx apps/lsp/src/server.ts`),
  antes de existir o teste em memória — foi essa verificação que achou os
  dois bugs acima, não a leitura do código.
- `pnpm check` permanece verde; nova fronteira `lsp-e-so-adapter-lsp`
  verificada com violação deliberada antes de confirmar o estado limpo.

## Não decidido aqui

Rename, `workspace/symbol` e code actions ficam para quando o contrato de
edição multi-arquivo existir. Resolução de recursos (imagens) no ambiente
continua sem resolver, mesma lacuna já registrada desde o P10. Múltiplas
raízes de workspace (`workspaceFolders` com mais de uma entrada) não são
suportadas — o servidor abre um único vault na primeira pasta recebida.
