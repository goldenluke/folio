# ADR 0020 — Plugin host isolado: regras de lint de terceiros

**Status:** aceito · 2026-09-07

## Contexto

"Plugin host isolado" estava na lista "Além" do roadmap desde o P0 (ver ADR
0004), sem nunca especificar QUE tipo de plugin. "Plugin" pode significar
comandos no desktop, formatos de exportação, temas, regras de lint — cada um
com uma superfície de API e um risco de isolamento completamente diferentes.
Essa ambiguidade foi resolvida perguntando ao usuário antes de desenhar
qualquer coisa: regras de validação/lint customizadas, porque só leem o
documento resolvido e devolvem diagnósticos — não mutam nada, reaproveitam o
caminho de diagnóstico que CLI e desktop já têm, e têm a fronteira de
isolamento mais simples de justificar das três opções consideradas (as
outras eram comandos no desktop, que precisam de acesso à seleção do editor e
capacidade de despachar transação — fronteira mais delicada —, e formatos de
exportação customizados, que reaproveitariam o Export Service do P14 mas
cada plugin poderia trazer dependências pesadas).

## Decisão

### O contrato: mesma forma de `RegraDeValidacao`, do outro lado de um processo

`AbntLintPlugin` (`@abnt/plugin-api`) tem a mesma forma que
`RegraDeValidacao` (built-in, `@abnt/standards`, ver ADR anterior sobre
validação): recebe o documento resolvido, devolve `Diagnostic[]`. A diferença
inteira é ONDE roda. Um plugin não reimplementa nada que a norma ABNT já
faz — ele é aditivo, roda ao lado das regras built-in, nunca no lugar delas.

`ResolvedDocumentDto` — a mesma projeção serializável que já existia para o
protocolo do compiler (Map e AnnotationStore não atravessam IPC) — virou o
formato que um plugin recebe. `resolvedDocumentParaDto`, extraído de
`@abnt/compiler` (antes privado dentro de `serializarResultado`), é o único
lugar que sabe fazer essa conversão; o Plugin Host não duplica essa lógica.

### Isolamento é contenção de crash, não sandbox de segurança

`@abnt/plugin-host` sobe cada plugin com `child_process.fork()` — um
processo Node de verdade, sem Electron, porque o primeiro host é o CLI. Isso
resolve UM problema real (um plugin que trava ou lança não derruba `abnt
lint`), mas deliberadamente **não** resolve outro: o plugin roda com as
mesmas permissões do processo que o hospeda — lê arquivos, faz rede, tudo que
o host consegue fazer. Sandboxing de segurança de verdade (restringir
filesystem/rede de código não confiável) exigiria `node --permission`,
`vm2`-like ou WASM, cada um com custo e superfície de bugs próprios, e fica
fora de escopo até haver uma razão concreta (hoje não há distribuição de
plugins de terceiros nenhuma, só um exemplo local). O nome da classe já
avisa: é o mesmo espírito de `CompilerSupervisor`/`ExportSupervisor` do
desktop, contenção, não confiança.

Diferença deliberada desses dois: `PluginHost` não reinicia sozinho. Os
supervisors do desktop existem para uma sessão longa de usuário sobreviver a
um crash; um `folio lint` de um tiro não ganha nada revivendo o processo no
meio do comando — se o plugin caiu, aquele plugin falhou para aquela
chamada, ponto. Quem decide o que fazer com a falha é o CLI, não o host.

### Falha de plugin é diagnóstico, não exceção

`executarPluginsDeLint` (`apps/cli/src/plugins.ts`) nunca deixa uma exceção
de plugin subir para o comando `lint`. Timeout, crash, exceção dentro de
`lint()`, resposta inválida — tudo vira um diagnóstico sintético
(`PLUGIN-FALHA`, `severity: 'warning'`) na mesma lista que os diagnósticos
reais. Isso significa: um plugin mal comportado nunca muda o `exitCode` do
`folio lint` (só erro REAL de norma faz isso), mas o usuário sempre vê que
algo não rodou. Verificado à mão antes de escrever qualquer teste: plugin que
lança, plugin que `process.exit()` no meio de um pedido, plugin que nunca
manda `ready`.

### Armadilha real encontrada: `execArgv: [...process.execArgv, ...]` é uma bomba de fork

Os packages do workspace exportam `./src/index.ts` direto — mesma dívida já
registrada para o bin do CLI e o servidor do LSP (nenhum tem `dist/`
compilado ainda). Um plugin que importa `@abnt/document-model` só resolve o
`.ts` com `tsx` registrado como loader. A tentativa óbvia,
`execArgv: [...process.execArgv, '--import', 'tsx']` (herdar o que o
processo atual já tem e completar com tsx), **explode**: como o CLI já roda
sob `tsx`, `process.execArgv` do host já carrega algo relacionado ao próprio
registro do tsx; herdar isso e empilhar outro `--import tsx` faz o tsx
reexecutar o processo para corrigir o registro duplicado, e a próxima
geração herda a lista já duplicada da anterior — um processo a mais a cada
starts, sem limite, até esgotar memória/PIDs. Descoberto rodando o plugin de
exemplo à mão (`node -e "... fork(...)..."`) antes de escrever qualquer
teste automatizado, com um processo real acumulando `--import tsx --import
tsx --import tsx ...` no próprio argv a cada geração. Corrigido usando uma
lista FIXA (`execArgv: ['--conditions=development', '--import', 'tsx']`), nunca espalhando o execArgv do
processo pai. Documentado em `packages/plugin-host/src/plugin-host.ts` com o
comentário mais longo do arquivo de propósito — é o tipo de bug que só
aparece de novo se alguém "simplificar" essa linha achando o spread mais
correto.

### Plugin de exemplo prova a API, não só documenta

`examples/plugins/paragrafo-longo.mjs`: avisa quando um parágrafo passa de
150 palavras. Usa `@abnt/plugin-api` de verdade (`runLintPlugin`) e
`@abnt/document-model` (`percorrer`) para andar a AST — não é pseudocódigo,
é o que `tests/p15-plugins.test.ts` de fato spawna e verifica, e o que rodou
manualmente via `folio lint documento.md --plugin
examples/plugins/paragrafo-longo.mjs` antes de qualquer teste existir.

## Consequências

- Novos packages: `@abnt/plugin-api` (contrato + `runLintPlugin`, só conhece
  `@abnt/protocol`) e `@abnt/plugin-host` (`PluginHost`, só conhece
  `@abnt/plugin-api` + `@abnt/document-model` para restaurar os brands de
  `Diagnostic`). Duas fronteiras novas no dependency-cruiser, cada uma
  verificada com violação deliberada.
- `resolvedDocumentParaDto` exportado de `@abnt/compiler` — extraído de
  código já existente, não escrito do zero, para o Plugin Host não duplicar
  a serialização que o protocolo do compiler já resolvia.
- `folio lint --plugin <caminho>` (repetível) no CLI.
- `tests/p15-plugins.test.ts`: cinco testes — plugin de exemplo real
  devolvendo diagnóstico correto; plugin que lança rejeitando com erro claro;
  plugin que cai no meio de um pedido rejeitando em vez de travar; plugin que
  nunca manda `ready` estourando o timeout de startup; sanity check de que o
  plugin roda mesmo num processo com PID diferente (fork de verdade, não
  atalho in-process).
- `pnpm check` permanece verde.

## Não decidido aqui

Descoberta/instalação de plugins (hoje é um caminho de arquivo literal,
`--plugin`; um manifesto, um diretório convencional no vault, ou um registro
tipo npm ficam para quando houver mais de um plugin real em uso). Sandboxing
de segurança de verdade (ver acima). Suporte no comando `folio build` (hoje só
`lint` aceita `--plugin` — extensão trivial, mas sem um pedido concreto
ainda). Integração no desktop (o Plugin Host é agnóstico de host — CLI hoje,
Workspace Service depois —, mas plugar isso no P9-P14 fica para quando houver
uma razão de produto, não só "porque dá para fazer"). Comandos customizados e
formatos de exportação customizados — as duas alternativas descartadas na
decisão de escopo — continuam possíveis num Plugin Host futuro com um
segundo contrato ao lado de `AbntLintPlugin`, não dentro dele.
