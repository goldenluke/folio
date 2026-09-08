# ADR 0004 — Packages somente quando a fronteira é fiscalizada em CI

**Status:** aceito · 2026-09-07

## Contexto

O desenho de destino deste sistema tem cerca de 40 packages e cinco ou seis
processos isolados. É para onde ele vai. Não é por onde ele começa.

Fronteira de package é barata de adicionar e cara de manter vazia: 40 pastas
com um `index.ts` de reexport cada produzem cerimônia sem benefício e escondem
quais separações realmente importam.

## Decisão

Começamos com **7 packages + 1 app**. A P0 adiciona o oitavo package,
`compiler`, porque agora há uma costura real entre autoria, ambiente e hosts
futuros. A regra continua única:

> Uma fronteira só existe onde codifica um **invariante fiscalizado em CI** —
> não onde descreve um conceito.

As fronteiras que existem hoje, em `.dependency-cruiser.cjs`:

| Regra | Invariante |
|---|---|
| `document-model-e-folha` | `document-model` não importa nada do workspace |
| `standards-nao-conhece-sintaxe-nem-saida` | norma não vê Markdown nem HTML |
| `renderer-so-ve-publication` | renderer não importa markdown/standards/semantics/bibliography |
| `markdown-nao-conhece-normas` | parser produz estrutura, não julgamento |
| `compiler-headless` | compiler não lê disco, não renderiza e não conhece UI |
| `camadas-inferiores-nao-importam-compiler` | orquestração não vaza para o domínio |
| `ninguem-importa-o-cli` | `apps/cli` é o topo do grafo |
| `sem-ciclos` | sem dependência circular |

Duas escolhas de suporte:

- **pnpm, não npm.** O layout estrito de `node_modules` do pnpm impede
  dependência fantasma — um package não consegue importar o que não declarou.
  Isso é fiscalização de fronteira de graça, no mesmo espírito das regras acima.
- **Gate de licença junto**, pelo motivo do [ADR 0002](0002-motor-de-citacao-proprio.md).

Ambos os gates foram **testados com violação deliberada**, não apenas
configurados: o de licença contra `citeproc`, o de fronteira contra um import
de `@abnt/standards` dentro de `renderer-html`. Um gate que nunca disparou é um
gate que não se sabe se funciona.

## Consequências

Quando um package novo se justificar, ele nasce numa costura já desenhada — a
divisão em 40 continua sendo o destino, só não é o ponto de partida.

Ausentes de propósito: `workspace`, `editor`, `plugin-api`, `protocol`, `sync`,
`renderer-docx`, `document-index`. `document-graph` está dobrado dentro de
`semantics` até haver grafo que justifique separar.

## Sobre os processos

Mesma lógica se aplica ao isolamento em processos (workspace / compiler /
export / plugin host / sync). Isolar tem custo real: serialização de AST no
IPC, depuração mais difícil, supervisão, latência de startup.

O invariante que preservamos agora, e que não custa nada: as entradas da
fronteira do compiler (`SourceSnapshot` e `CompilationEnvironment`) são
assíncronas, tipadas e serializáveis. O `CompilationResult` ainda expõe
estruturas ergonômicas em memória (`AnnotationStore` e `Map`s); seu DTO de
transporte pertence à P1. Com isso, extrair para `worker_threads` ou processo
separado depois é uma adaptação de protocolo, não uma reescrita do domínio.
