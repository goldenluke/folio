# ADR 0054 — Composite Source Map (F66)

**Status:** aceito

## Contexto

A Onda M (ADR 0052) fez `![[arquivo.md]]`/`![[arquivo.md#Seção]]` funcionarem
compondo uma fonte virtual antes do parser: o TCC modular publica corretamente,
mas todo range que a AST carrega para um trecho transcluído aponta para essa
fonte virtual — que nenhum arquivo real corresponde byte a byte. Um diagnóstico
de compilação sobre um capítulo, por exemplo, hoje aponta para um offset da
raiz composta, não para `capitulos/metodo.md`. O próprio ADR 0052 já registrava
isso como lacuna explícita ("essa capacidade exige um source map explícito em
marco futuro"). Esta ADR fecha essa dívida para o primeiro consumidor real:
diagnósticos de compilação (F67). Navegação (F68), rename cross-file (F69) e
structural diff (F70) ficam para entregas seguintes, sobre a mesma
infraestrutura.

## Decisão

**Onde vive.** `@abnt/source-composition` é um pacote novo, folha (não importa
nenhum outro package do workspace — regra `source-composition-e-folha` no
dependency-cruiser). Ele não conhece `WorkspaceFileId`, vault, protocolo nem
Document AST: só offsets e caminhos como `string`, exatamente como o expansor
de `@abnt/markdown` já tratava caminho antes desta ADR. Fica fora do
`document-model` de propósito (item 8 do roadmap de produto): o mapa existe
porque um host *compôs* várias fontes, o que não é verdade universal sobre um
documento.

**O que ele expõe.**

- `applyTextPatches(original, patches)` — primitiva pura: aplica um conjunto de
  substituições/remoções não sobrepostas e devolve o texto processado junto de
  `spans: TextSpanMapping[]`, contíguos e ordenados, cada um marcado `exact`
  (correspondência caractere a caractere) ou não (veio de uma substituição de
  comprimento diferente, ex.: URI reescrita — a posição interna é proporcional).
- `CompositeSourceMapBuilder` — constrói o mapa incrementalmente, em lockstep
  com a montagem do texto virtual. `append(path, length, sourceStart,
  sourceEnd)` é chamado uma vez por trecho **literal** efetivamente copiado
  para a saída — nunca por um embed ainda não expandido. Cada chamada vira seu
  próprio segmento; segmentos adjacentes não são fundidos (ver "Armadilha"
  abaixo).
- `locateInComposite`/`locateRangeInComposite` — resolvem um offset ou range da
  fonte virtual para `{ kind: 'authored', path, offset }` ou `{ kind:
  'synthetic' }`. Nunca inventam origem: offset fora de qualquer segmento, ou
  range que atravessa dois segmentos, volta `synthetic`.

**Quem constrói.** `expandMarkdownComposition` (`@abnt/markdown`), a mesma
função que já compunha a fonte virtual desde F60–F62. A varredura que decide
"este trecho de texto vai para a saída" agora também registra de onde ele veio
— não há segunda passada nem estrutura reconstruída depois. Frontmatter
removido e seção selecionada (`sectionOf`) entram como janela de corte;
rebase de URI (`rebaseMarkdownUris`, agora `collectUriRebasePatches`) entra
como `TextPatch` de substituição. As duas coisas compõem um único
`applyTextPatches` por arquivo, então o offset final de qualquer posição do
texto processado volta direto ao arquivo em disco — nunca a um estágio
intermediário (frontmatter-stripped, seção extraída) que o consumidor
precisaria conhecer.

**Nested embeds nunca formam cadeia.** Cada emissão de texto literal (fora de
um embed ainda a expandir) gera um segmento apontando para o arquivo que
efetivamente contém aquele texto. Um embed dentro de outro embed é só mais uma
chamada recursiva de `expand()` compartilhando o mesmo builder — o segmento
correspondente ao conteúdo de `secao.md` (incluído por `capitulo.md`, incluído
por `index.md`) já nasce apontando para `secao.md`. Não existe
`node.parent`/cadeia para o consumidor percorrer, e não existe forma de criar
um ciclo no grafo do mapa porque ele nunca referencia outro segmento — só o
cursor virtual global e o arquivo/offset autoral.

**Diagnósticos de composição ganharam origem.** Ciclo, embed não encontrado,
seção ausente e URI de embed inválida (`COMPOSICAO-EMBED-*`,
`COMPOSICAO-SECAO-NAO-ENCONTRADA`) agora carregam `source: SourceRange`
apontando para o arquivo que **escreveu** o embed problemático — nunca para o
alvo — usando o offset autoral calculado pela mesma composição de patches.
Antes desta ADR esses diagnósticos não carregavam range nenhum.

**F67 — diagnósticos do compiler remapeados.** `CompilationEnvironmentResolver`
(`@abnt/workspace-sessions`) ganhou um método opcional,
`remapCompositionDiagnostics(diagnostics, sourceMap, rootDocumentId)`.
`document-sessions.ts` chama esse método sobre `prepared.value.diagnostics` e
`result.value.diagnostics` antes de publicá-los na sessão, só quando
`expandSource` devolveu um `sourceMap`. A implementação real
(`criarResolvedorDeAmbienteLocal`, `@abnt/workspace-environment`) reescreve
`source` apenas quando `documentId` do diagnóstico é o da raiz (documento
composto); um diagnóstico que já cita outro arquivo (ex.: bibliografia) não é
tocado. Sem origem autoral única no mapa (`locateRangeInComposite` devolve
`synthetic`), o diagnóstico original é preservado — nunca aponta para um
arquivo arbitrário.

**Reuso de `documentId` como path.** `DiagnosticDto.source.documentId` — hoje
uma `string` solta no protocolo — passa a poder valer o **path** do arquivo
autoral real, não só o `DocumentId` da sessão. Isso não muda a forma do DTO
(nenhuma migração de schema), mas é uma convenção nova que qualquer consumidor
futuro (F68 em diante) precisa conhecer: `documentId` de um diagnóstico
remapeado é resolvido para `WorkspaceFileId` pelo host, como
`workspace-environment` já faz para bibliografia (`storage.list()` + match por
path), nunca pelo renderer.

**O mapa nunca cruza processo.** `CompositeSourceMap` é consumido e descartado
dentro do host de composição (`workspace-sessions`/`workspace-environment`,
mesmo processo do Compiler/Workspace Service); só o **efeito** dele — um
`DiagnosticDto` já com `source` corrigido — atravessa o protocolo, na mesma
forma de DTO que já existia. Por isso esta ADR não introduz DTO nem versão de
schema novos: não há nada de F66 para serializar.

**Hash autoral não muda.** `session.contentHash` continua vindo de
`session.content` (a fonte autoral, pré-composição); a fonte expandida ganha um
hash próprio (`compilationHash`) só para a revisão que o compiler consome. F66
não altera esse contrato do P4 — o mapa é mais uma projeção derivada da mesma
expansão ephemeral do ADR 0052, nunca uma nova autoridade.

## Armadilha: fundir segmentos adjacentes quebra a fórmula de offset

A primeira versão do builder fundia dois segmentos consecutivos do mesmo
arquivo com `sourceEnd === próximoSourceStart` para reduzir o tamanho do mapa.
`locateInComposite` resolve um offset com uma fórmula **aditiva**
(`sourceStart + (offset - virtualStart)`), que só é correta quando a largura
virtual e a largura autoral do segmento coincidem. Um trecho vindo de URI
reescrita tem largura diferente do trecho autoral (`assets/foto.png` vira
`capitulos/assets/foto.png`, +10 caracteres); fundir esse segmento com o
trecho idêntico adjacente produzia um segmento cuja largura virtual e autoral
divergiam, e todo offset depois do ponto de fusão saía errado por exatamente o
delta da reescrita — um teste (`recurso rebaseado`) pegou isso porque comparava
a posição de um trecho *depois* da imagem, não só a URI em si. Corrigido
removendo a fusão: cada `append()` é seu próprio segmento. Documentos reais não
têm segmentos suficientes para o tamanho da lista importar.

## Testes

`tests/f66-composite-source-map.test.ts`: embed simples, embed aninhado
(offset vai direto para o arquivo folha), seção (offset real dentro do
arquivo, não relativo a zero), múltiplos embeds do mesmo arquivo (cada
ocorrência resolve para a origem correta), ciclo e alvo ausente (diagnóstico
aponta para quem escreveu o embed), recurso rebaseado (texto ao redor da URI
reescrita continua exato), e `locateRangeInComposite` recusando um range que
atravessa dois arquivos. Um teste de integração (F67) compila um documento
composto real via `DocumentSessionsService` + `criarResolvedorDeAmbienteLocal`
sobre um `LocalFilesystemStorage` de verdade (sem `subscribe()`, para não
depender do watcher recursivo — ver dívida abaixo) e confere que um
`XREF-NAO-RESOLVIDA` gerado dentro de um capítulo aponta para o capítulo, não
para a raiz.

## Consequências

Diagnósticos de compilação sobre documentos modulares agora carregam a
localização autoral real, não a posição na fonte virtual — pré-requisito para
F67 (UI de clique-para-abrir, ainda não implementada), F68 (navegação através
de embeds) e F69 (rename cross-file). A composição continua inteiramente
ephemeral: apagar `index.sqlite` não perde nada, o Markdown modular continua
útil fora do Folio, e nenhuma norma ou processo remoto precisa entender o mapa
— ele não sai do host que o construiu.

Dívida deliberadamente não fechada nesta entrega: o painel de diagnósticos do
desktop ainda não usa o `documentId` remapeado para abrir um arquivo diferente
do documento ativo (hoje `F26`/Problems navega só dentro do `EditorController`
corrente); Language Service ainda não expõe `locateInComposite` para
go-to-definition/rename atravessarem embeds (F68/F69); e o teste de integração
evita deliberadamente `WorkspaceStorage.subscribe()` porque o watcher recursivo
(`fs.watch(root, { recursive: true })`) é instável neste ambiente — mesma
dívida de Node "no limite" já registrada em `docs/ROADMAP.md`, não algo que a
F66 introduziu ou precisa resolver.
