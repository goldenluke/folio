# ADR 0003 — PDF via HTML/CSS + Paged.js + Chromium

**Status:** aceito · 2026-09-07 · com plano B explícito

## Contexto

Três caminhos para gerar PDF a partir do Publication AST:

| Caminho | Prós | Contras |
|---|---|---|
| **Typst** | `abntyp` já existe no Typst Universe, com NBR 10520:2023; paginação, notas de rodapé e cabeçalhos correntes nativos e corretos | binário externo; fidelidade dependente de template de terceiros; preview não compartilha renderer |
| **HTML/CSS + Paged.js** | mesmo renderer serve preview e PDF; layout sob nosso controle; MIT | fidelidade ABNT por nossa conta; Chromium não implementa CSS Paged Media sozinho |
| **PDFKit** | controle total | reimplementar paginação, órfãs/viúvas, notas, cabeçalhos — buraco sem fundo |

## Decisão

**HTML/CSS + Paged.js + Chromium**, com a interface `Renderer` mantida abstrata.

O argumento decisivo não é técnico, é de produto: sendo comercial, o que as
instituições pagam é justamente a fidelidade de layout aos seus próprios
padrões editoriais. Terceirizar isso para um template que não controlamos
transfere para fora o diferencial — e cria dependência de supply chain no
ponto mais sensível. Somado a isso, preview e PDF compartilharem um renderer
é uma vantagem de produto difícil de obter por outro caminho.

Detalhes de implementação:

- **`puppeteer-core`, não `puppeteer`**: usa o Chromium já instalado em vez de
  baixar um segundo de ~150 MB. Também tira do nosso colo o ciclo de
  atualização de segurança do browser. Sobrescreva com `ABNT_CHROME`.
- **Paged.js com `auto: false`**, e `PagedPolyfill.preview()` chamado
  explicitamente. Assim a conclusão da paginação é uma promessa, e não uma
  sondagem do DOM torcendo para já ter terminado.
- **`preferCSSPageSize: true` e margens zero no `page.pdf()`**: o Paged.js já
  aplicou as margens no layout que gerou; deixar o Chromium aplicar as dele
  produziria margem dupla.

## Consequências

Verificado no M0: A4 (594,96 × 841,92 pt), margens 3/2/2/3 cm, número de página
no canto superior direito, numeração progressiva, corpo justificado com recuo
de primeira linha. Duas páginas em ~310 ms.

Riscos conhecidos, ainda não enfrentados:

- cabeçalho de tabela repetindo entre páginas;
- órfãs/viúvas interagindo com recuo de citação longa;
- caixa da ficha catalográfica (M5);
- notas de rodapé com chamada e nota na mesma página.

O Paged.js suporta notas de rodapé e running headers, mas a cauda longa é onde
esse caminho custa. Mitigação: `Renderer` abstrato desde já, regressão visual a
partir do M4, e **nenhum hack de CSS pode vazar para o Publication AST** — se
vazar, o plano B deixa de ser viável.

**Plano B:** Typst + `abntyp`. A interface abstrata é o que mantém essa porta
aberta; o custo de trocar é escrever um `renderer-typst`, não reescrever o
núcleo.

## Fontes

- [Paged.js](https://pagedjs.org/) — MIT
- [abntyp — Typst Universe](https://typst.app/universe/package/abntyp/)
