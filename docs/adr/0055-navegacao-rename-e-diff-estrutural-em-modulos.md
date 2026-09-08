# ADR 0055 — F68/F69/F70: navegação, rename e diff estrutural sobre documentos modulares

**Status:** aceito

## Contexto

ADR 0054 (F66) deu ao host de composição um jeito de traduzir um offset da
fonte virtual de volta ao arquivo real. Os itens seguintes da Onda O pediam
três capacidades sobre essa mesma base: navegação (F68), rename cross-file
(F69) e diff estrutural (F70). Investigar cada um mudou o que havia para
construir.

## F68 — navegação através de embeds

**Decisão:** `[[ref:id]]` não tinha NENHUM suporte de `definition`/
`references`/`hover` no `WorkspaceLanguageService` antes desta ADR — só
`crossReferenceTargets()` (F18, para o picker de inserção). A lacuna real não
era "atravessar embeds": era a ausência de um índice vault-wide de
`{#id}`/`[[ref:id]]`, sem o qual nem navegação DENTRO de um único arquivo
aberto conseguia saber que `fig:grafico` mora em outro arquivo.

- `workspace-index` schema v3 adiciona duas tabelas: `indexed_identifiers`
  (toda declaração `{#id}` — seção, figura, tabela, equação — mesma origem que
  `crossReferenceTargets` já calculava por documento) e `indexed_xrefs` (toda
  ocorrência de `[[ref:id]]`). `WorkspaceIndex.identifiers(id?)` e
  `.crossReferences(fileId?, id?)` seguem exatamente o formato de
  `citations()`/`links()` já existentes — mesma extração em
  `#insertStructure`, mesmo padrão de query.
- `WorkspaceLanguageService.definition/references/hover` ganharam um terceiro
  ramo (`crossReferenceAt`), depois de citação e link. Primeiro tenta resolver
  a declaração no PRÓPRIO documento (`identifierDeclarationIn`, cobre o
  rascunho aberto ainda não indexado); só recorre ao índice vault-wide quando
  a declaração não está ali. É esse segundo passo que faz uma referência
  atravessar um embed: os dois arquivos nunca precisam se encontrar no
  language-service, porque nunca precisaram — cada um é só mais um documento
  comum, indexado como qualquer outro.
- `CompositeSourceMap` (F66) **não é usado aqui**. Ele resolve offset da fonte
  *virtual de compilação* de volta ao autoral; navegação no editor sempre
  trabalha com offsets autorais de um arquivo já aberto — o índice vault-wide
  é a peça que faltava, não um mapa de composição.

## F69 — rename cross-file: já existia

**Decisão: nenhuma mudança de produto.** `WorkspaceLanguageService.rename()`
(F20, Onda D, muito antes da transclusão existir) já escaneia texto autoral em
**todos** os `.md` do vault via regex sobre `{#id}`/`[[ref:id]]`/`@chave`, não
a fonte composta pelo compiler. Um rename nunca precisou saber se `cap1.md` e
`cap2.md` se conectam por um `index.md` com embeds — a sintaxe do identificador
é idêntica com ou sem transclusão. `tests/f13-assets-and-statistics.test.ts`
já cobria isso com um par de arquivos soltos; `tests/f69-cross-file-rename.
test.ts` fecha a lacuna de cobertura com o cenário literal do roadmap
(capítulo que declara + capítulo que referencia, ambos só unidos por
`index.md`), sem tocar `index.md`, provando que rename opera nos arquivos
reais e nunca na composição.

Reimplementar isso sobre `CompositeSourceMap` teria sido o erro que o item 90
do roadmap avisa: construir infraestrutura nova para um problema que a
existente já resolve.

## F70 — Structural Diff

**Decisão:** novo pacote `@abnt/structural-diff`, folha de domínio (só
`document-model`/`markdown`; regra `structural-diff-so-compara-documentos`).
`structuralDiff(from, to)` faz o parser rodar duas vezes (independente,
nenhuma sessão/ambiente) e compara fatos extraídos de cada AST — nunca as
árvores inteiras.

- **Casamento por chave estável, nunca por posição.** Seções com
  `attributes.identifier` em ambas as revisões e título diferente viram
  `section-renamed`; sem identificador em comum, a mesma mudança de título vira
  `section-removed` + `section-added` — honesto sobre não ter certeza de
  identidade, em vez de adivinhar (mesmo espírito do item 12 da ADR 0054:
  nunca inventar uma correspondência que a chave não sustenta). Citações usam
  `referenceId`; figura/tabela usam `identifier` quando existe, senão a legenda;
  links usam o texto visível (label) para detectar troca de alvo
  (`reference-target-changed`) sem confundir com adição/remoção.
- **Não substitui `lineDiff` (F64).** `historyStructuralDiff` é um método novo
  no protocolo, par de `historyDiff`, mesmo request (`fileId`,
  `fromRevisionId`, `toRevisionId?`). `WorkspaceHistoryStructuralChangeDto`
  usa `kind: string` solto — o protocolo não importa o union de
  `@abnt/structural-diff` (regra `protocol-nao-importa-implementacoes`).
- **Escopo: duas revisões do MESMO arquivo**, não a fonte composta de F60–F62.
  Diff estrutural de um `index.md` inteiro (capítulos incluídos) ficou fora —
  exigiria rodar a composição inteira (leitura de arquivos, resolução de
  embeds) dentro do fluxo de histórico, que hoje só compara texto que já tem
  em mãos. Registrado como lacuna deliberada, não escondida.

## Fronteira comum às três: UI do desktop fica de fora

F68/F69/F70 entregam capacidade de host/protocolo, testada via `MessagePort`
real (mesmo padrão dos testes P8/P14/F60). Nenhuma amplia a superfície do
desktop além do protocolo: painel de Problems clicável cross-file (F67 UI já
registrado como pendência na ADR 0054), comando de rename disparado da UI além
do já existente, e visualização de `historyStructuralDiff` ao lado do diff por
linha continuam para uma entrega de produto separada. Ver `docs/ROADMAP.md`.

## Achado à parte: ambiente de teste

Depurar F66 (turno anterior) revelou que `fs.watch(root, { recursive: true })`
segfaulta neste sandbox sob Node 22.x, derrubando testes não relacionados que
rodam depois no mesmo worker do Vitest. Rodar a suíte inteira sob Node 20.19
(a versão documentada em "Ambiente") elimina o problema por completo — `pnpm
check` fecha com 58 arquivos/206 testes e regressão visual, todos verdes.
Não é um bug de F66–F70; é a mesma dívida de versão de Node já registrada em
`docs/ROADMAP.md` § Dívida conhecida, agora com uma correlação clara entre
sintoma e causa.
