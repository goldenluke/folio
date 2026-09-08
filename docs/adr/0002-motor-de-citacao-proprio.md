# ADR 0002 — Motor de citação próprio; CSL-JSON só como formato

**Status:** aceito · 2026-09-07
**Importância:** esta é a decisão mais fácil de reverter por engano. Leia antes
de instalar qualquer coisa relacionada a citação.

## Contexto

Formatar citações e referências ABNT é o núcleo de valor do produto. O caminho
óbvio é adotar CSL (Citation Style Language) com um processador pronto e um
estilo ABNT existente. Investigamos os dois processadores disponíveis.

### `citeproc-js`

Licenciado **CPAL-1.0 OR AGPL-1.0**. Verificado empiricamente — instalamos o
pacote e o gate acusou:

```
citeproc@2.4.63 — CPAL-1.0 OR AGPL-1.0
```

Ambas as opções são copyleft com cláusula de deployment em rede. Para produto
comercial fechado, especialmente com versão web e sync no horizonte, é
inviável: AGPL obrigaria a abrir o trabalho vinculado ao servir por rede.

### `citeproc-rs`

O substituto oficial da Zotero, em Rust com bindings WASM. **Arquivado pelo
próprio dono em 13/08/2026**, read-only, descrito como work-in-progress com
testes falhando. Não é opção.

**Conclusão: não existe processador CSL viável em JS para produto comercial
fechado.**

## Decisão

1. **Motor de citação ABNT próprio**, em `bibliography` + `standards` (M2).
   É tratável porque precisamos de *uma* família de estilos — autor-data e
   numérico da NBR 10520:2023, e as referências da NBR 6023:2018 — e não das
   10.000 do repositório CSL.

2. **Adotar o *schema* CSL-JSON como modelo bibliográfico canônico.** O formato
   é uma especificação de dados, não um programa: usá-lo não cria vínculo de
   licença e dá interoperabilidade com Zotero, Mendeley e Crossref de graça.
   Importadores (BibTeX, RIS, DOI) normalizam para ele.

3. **Estilos `.csl` ABNT existentes entram só como oráculo de teste** durante o
   desenvolvimento, nunca como dependência de runtime. Eles são CC BY-SA 3.0 —
   redistribuição comercial é permitida com atribuição e link para
   citationstyles.org, e o ShareAlike recai sobre o arquivo de estilo
   modificado, não sobre nosso programa. Como não os distribuímos, a questão
   não chega a se colocar.

4. **Gate de licença no CI desde o M0**, antes de qualquer código de domínio:
   `pnpm check:licenses` quebra o build em AGPL/CPAL/SSPL/GPL em runtime.
   Distingue runtime de dev — ferramenta de build copyleft não é distribuída e
   só gera aviso, porque um gate que reclama do que não importa é um gate que
   alguém desliga.

## Consequências

Custo real: escrever formatação de referência para os tipos centrais (livro,
capítulo, artigo de periódico, trabalho em evento, tese, documento eletrônico)
e manter isso correto. É o trabalho de maior risco do M2, e por isso ele vem
com golden test por tipo de referência.

Ganho: nenhum vínculo de licença no coração do produto, e liberdade para
expressar regras que o CSL não expressa bem — a NBR 6023 tem exigências de
consistência tipográfica entre referências que não cabem no modelo do CSL.

## Implementação do M2

Concluída em 2026-09-07. `@abnt/bibliography` importa BibTeX com
`@retorquere/bibtex-parser` (ISC) e produz CSL-JSON; `@abnt/semantics` deriva
ordem numérica e desambiguação; `@abnt/standards` implementa os dois motores e
os seis tipos centrais. O oráculo registrado nos testes é o estilo UFRGS ABNT
do repositório oficial CSL, fixado no commit
`b9b0e0639d1b4643808245b97eb60f596f8abcc7` e executado via Pandoc somente
durante a conferência manual.

## Fontes

- [citeproc-js — LICENSE](https://github.com/Juris-M/citeproc-js/blob/master/LICENSE)
- [citeproc-rs — arquivado](https://github.com/zotero/citeproc-rs)
- [CSL styles — licença CC BY-SA](https://github.com/citation-style-language/styles)
- [CSL-JSON schema oficial](https://github.com/citation-style-language/schema/blob/master/schemas/input/csl-data.json)
- [csl-abnt (NBR 6023:2018 + 10520:2023)](https://github.com/virgilinojuca/csl-abnt)
