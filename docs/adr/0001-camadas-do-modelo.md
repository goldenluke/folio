# ADR 0001 — Quatro modelos, e a ABNT fora do núcleo

**Status:** aceito · 2026-09-07

## Contexto

O caminho curto para um compilador ABNT é `Markdown → HTML → PDF` com as regras
da norma espalhadas pelo parser e pelo gerador. Funciona para um protótipo e
colapsa quando entram citações, notas, referências cruzadas, mais de um tipo de
documento e as variações que cada universidade impõe sobre a norma.

O erro estrutural desse caminho é misturar três perguntas distintas: *o que foi
escrito*, *o que isso significa* e *como deve aparecer*.

## Decisão

Quatro representações, com responsabilidade única cada:

```
Syntax Tree → Document AST → ResolvedDocument → Publication AST
```

E uma regra: **o Document AST não conhece norma nenhuma.** Nem a string "abnt".
Ele descreve fatos semânticos — "isto é uma seção", "isto é uma citação", "isto
referencia aquela figura" — e deliberadamente não descreve decisões editoriais.

Corolários:

- **Dado derivado não entra na AST.** Número de seção, citação formatada e
  legenda numerada vivem no `AnnotationStore`, fora da árvore.
- **Atributo ≠ anotação.** Atributo é o que o autor declarou; anotação é o que
  o compilador concluiu. Anotação nunca volta para o Markdown.
- **A norma é consumidora do modelo**, via `PublicationProfile`. `publication`
  define a interface; `standards` a implementa. O compilador nunca importa a
  norma.

## Consequências

Positivas: a mesma AST publica sob ABNT e sob APA compartilhando uma árvore;
cache por hash de conteúdo funciona; edição incremental invalida pouco;
inserir uma seção não reescreve as vizinhas.

Custo: mais indireção. Adicionar um elemento exige tocar em modelo, pass,
profile e renderer, em vez de um `if` no gerador de HTML. É o preço, e é o
motivo de o projeto existir.

## A armadilha que continua aberta

**Não se valida uma abstração genérica com um único consumidor.** Um Document
AST testado só contra ABNT é um AST-da-ABNT fantasiado, e isso só aparece no dia
em que se tenta plugar a segunda norma — quando já é caro.

Mitigação prevista para o M4: um segundo profile deliberadamente diferente
("web-article", sem numeração de seção e com citação numérica). Se ele exigir
mudar `document-model`, a abstração estava errada.

Enquanto isso, `tests/golden.test.ts` mantém três testes que falham se a AST
começar a carregar número, nome de norma ou valor tipográfico.
