# ADR 0005 — CLI antes do editor

**Status:** aceito · 2026-09-07

## Contexto

A visão do produto é um editor acadêmico local-first no espírito do Obsidian:
vault de Markdown, CodeMirror, preview ABNT em tempo real, backlinks, grafo,
validação inline, plugins. Havia três pontos de partida plausíveis: o app
Electron completo, uma extensão de VS Code, ou um compilador de linha de comando.

## Decisão

**CLI primeiro.** `folio build` e `folio lint`, sem UI.

Três razões:

1. **O compilador é a parte que precisa estar certa; a casca é substituível.**
   Começar pelo Electron é começar pela parte descartável — meses de scaffolding
   (vault, abas, file tree, estado) antes de a primeira regra ABNT rodar.

2. **Headless é testável.** O pipeline inteiro cabe em golden tests
   (`input.md → .ast.json → .pub.json → .html`). Compilador é justamente o tipo
   de programa em que golden test e property test valem mais que E2E, e nada
   disso precisa de interface.

3. **Valor utilizável em semanas.** `folio build tcc.md → PDF` já serve para
   escrever de verdade, e o feedback vem de uso real em vez de especulação.

O editor então **embrulha** este núcleo em vez de contê-lo. Desde a P0,
`@abnt/compiler` é o orquestrador headless e `apps/cli` é um host: ele lê o
filesystem, prepara o ambiente e renderiza/exporta. Um futuro `apps/desktop`
ocupa a mesma posição, consumindo o mesmo compiler sem importar o CLI.

## Consequências

Ordem invertida em relação ao instinto de produto: o usuário final quer o
editor, e o editor é o que vende. Aceitamos adiar a demonstração visual em
troca de um núcleo que não precisa ser reescrito quando ela chegar.

A extensão de VS Code continua sendo a opção de menor esforço para chegar a uma
experiência de edição — editor, abas, árvore de arquivos, settings e ecossistema
de graça, escrevendo só o language server e o preview. Vale reconsiderar no M4,
quando houver validação para expor: um `folio lint` maduro é exatamente o que um
language server precisa ter por baixo.

Nada nesta decisão impede isso; o núcleo é o mesmo nos três casos.
