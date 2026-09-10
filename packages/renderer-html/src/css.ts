import type { PagePolicy, StyleDefinition, StyleTokenRegistry } from '@abnt/publication';

/** Token -> nome de classe CSS. Prefixo evita colisão com CSS do usuário. */
export const classeDoToken = (token: string): string => `s-${token.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

const PROPRIEDADES: ReadonlyArray<readonly [keyof StyleDefinition, string]> = [
  ['fontFamily', 'font-family'],
  ['fontSize', 'font-size'],
  ['lineHeight', 'line-height'],
  ['fontWeight', 'font-weight'],
  ['fontStyle', 'font-style'],
  ['textAlign', 'text-align'],
  ['textTransform', 'text-transform'],
  ['marginTop', 'margin-top'],
  ['marginBottom', 'margin-bottom'],
  ['marginLeft', 'margin-left'],
  ['textIndent', 'text-indent'],
  ['counterReset', 'counter-reset'],
  ['whiteSpace', 'white-space'],
  ['border', 'border'],
  ['padding', 'padding'],
  ['minHeight', 'min-height'],
  ['pageName', 'page'],
];

function regraDeEstilo(token: string, def: StyleDefinition): string {
  const linhas: string[] = [];
  for (const [chave, css] of PROPRIEDADES) {
    const valor = def[chave];
    if (valor !== undefined) linhas.push(`  ${css}: ${String(valor)};`);
  }
  if (def.pageBreakBefore === true) linhas.push('  break-before: page;');
  if (def.pageBreakAfter === true) linhas.push('  break-after: page;');
  if (linhas.length === 0) return '';
  return `.${classeDoToken(token)} {\n${linhas.join('\n')}\n}`;
}

const CAIXA_DE_MARGEM: Record<NonNullable<PagePolicy['pageNumber']>, string | null> = {
  'top-right': '@top-right',
  'top-center': '@top-center',
  'bottom-center': '@bottom-center',
  none: null,
};

/**
 * CSS de página.
 *
 * `@page` com margin boxes é CSS Paged Media, que o Chromium não implementa
 * sozinho — quem interpreta é o Paged.js, injetado em tempo de renderização.
 * Ver docs/adr/0003.
 */
export function cssDePagina(page: PagePolicy): string {
  const { top, right, bottom, left } = page.margin;
  const caixa = CAIXA_DE_MARGEM[page.pageNumber ?? 'none'];

  const numeracao =
    caixa === null
      ? ''
      : `
  ${caixa} {
    content: counter(page);
    font-family: "Times New Roman", Times, serif;
    font-size: 12pt;
    vertical-align: bottom;
    padding-bottom: 0.5cm;
  }`;

  const variants = Object.entries(page.variants ?? {})
    .map(([name, variant]) => {
      const variantBox = CAIXA_DE_MARGEM[variant.pageNumber ?? 'none'];
      const content =
        variantBox === null
          ? ['@top-right', '@top-center', '@bottom-center']
              .map((box) => `  ${box} { content: none; }`)
              .join('\n')
          : `  ${variantBox} {
    content: counter(page);
    font-family: "Times New Roman", Times, serif;
    font-size: 12pt;
  }`;
      return `@page ${name} {
${content}
}`;
    })
    .join('\n\n');

  return `@page {
  size: ${page.size};
  margin: ${top} ${right} ${bottom} ${left};${numeracao}
}${variants === '' ? '' : `\n\n${variants}`}`;
}

const DIMENSOES_DE_PAGINA: Readonly<Record<string, readonly [string, string]>> = {
  A4: ['21cm', '29.7cm'],
  LETTER: ['21.59cm', '27.94cm'],
};

/**
 * Projeção de tela do papel para o preview rápido.
 *
 * `@page` só participa da mídia impressa/Paged.js; num iframe comum ele não
 * cria recuo algum e o conteúdo encosta nas bordas, embora o PDF esteja
 * correto. Esta regra usa a MESMA PagePolicy para representar o papel em tela
 * sem introduzir paginação pesada no caminho de edição. O `@media screen`
 * garante que ela nunca some uma segunda margem ao PDF.
 */
export function cssDePreview(page: PagePolicy): string {
  const { top, right, bottom, left } = page.margin;
  const dimensoes = DIMENSOES_DE_PAGINA[page.size.trim().toUpperCase()];
  const tamanho =
    dimensoes === undefined
      ? '  max-width: 21cm;\n  min-height: 29.7cm;'
      : `  width: ${dimensoes[0]};\n  min-height: ${dimensoes[1]};`;

  return `@media screen {
  html {
    box-sizing: border-box;
    min-height: 100%;
    padding: 1rem;
    background: #cbd5e1;
  }

  body {
    box-sizing: border-box;
${tamanho}
    margin: 0 auto;
    padding: ${top} ${right} ${bottom} ${left};
    background: #fff;
    box-shadow: 0 1px 5px rgb(15 23 42 / 0.28);
  }
}`;
}

export function folhaDeEstilo(
  page: PagePolicy,
  styles: StyleTokenRegistry,
  opcoes: { readonly preview?: boolean } = {},
): string {
  const regras = Object.entries(styles)
    .map(([token, def]) => regraDeEstilo(token, def))
    .filter((r) => r !== '');

  return [
    cssDePagina(page),
    `
html, body {
  margin: 0;
  padding: 0;
}

p {
  margin: 0;
  orphans: 2;
  widows: 2;
}

.front-matter-label {
  font-weight: bold;
}

.publication-toc-title {
  text-align: center;
  text-transform: uppercase;
  font-weight: bold;
  margin: 0 0 1.5em;
}

.publication-toc-entry {
  display: flex;
  gap: 0.5em;
  margin-bottom: 0.35em;
}

.publication-toc-entry a {
  color: inherit;
  text-decoration: none;
  flex: 1;
  display: flex;
}

.publication-toc-entry-text {
  background: white;
  padding-right: 0.35em;
}

.publication-toc-leader {
  flex: 1;
  align-self: center;
  border-bottom: 1px dotted currentColor;
  opacity: 0.9;
}

.publication-toc-page {
  min-width: 2.4em;
  padding-left: 0.75em;
  text-align: right;
  background: white;
}

.publication-toc-entry a::after {
  content: target-counter(attr(href), page);
  min-width: 2.4em;
  padding-left: 0.75em;
  text-align: right;
  background: white;
}

/* Título de seção não deve ficar sozinho no fim da página. */
h1, h2, h3, h4, h5, h6 {
  break-after: avoid;
  break-inside: avoid;
  margin: 0;
}

blockquote, figure, table, pre {
  margin: 0;
}

/* Figura e tabela não devem ser partidas entre páginas. */
figure, .s-table {
  break-inside: avoid;
}

table {
  border-collapse: collapse;
  width: 100%;
}

/* Cabeçalho de tabela se repete quando ela atravessa páginas — o Paged.js
   respeita thead, o Chromium sozinho não. */
thead {
  display: table-header-group;
}

th, td {
  padding: 0.2em 0.4em;
  vertical-align: top;
}

/* Tabela ABNT: fechada só em cima e embaixo, sem grade lateral. */
table, th, td {
  border: none;
}
thead tr:last-child th {
  border-bottom: 0.5pt solid #000;
}
thead tr:first-child th {
  border-top: 0.5pt solid #000;
}
tbody tr:last-child td {
  border-bottom: 0.5pt solid #000;
}

img {
  max-width: 100%;
  height: auto;
}

.note-mark a {
  text-decoration: none;
  color: inherit;
}

.quote-source {
  text-align: right;
  font-size: 10pt;
}

/* Notas de rodapé.
   O elemento é emitido inline, no ponto da chamada; o Paged.js o move para a
   área de rodapé da página em que esse ponto caiu e gera a chamada e o
   marcador. Daí o float abaixo, em vez de posicionamento nosso. */
.footnote {
  float: footnote;
  footnote-display: block;
}

/* Marcador gerado pelo Paged.js: numeração contínua no documento. */
::footnote-call {
  vertical-align: super;
  font-size: 0.7em;
  line-height: 0;
}

::footnote-marker {
  vertical-align: super;
  font-size: 0.7em;
}

/* Filete separando o rodapé do corpo, como manda a apresentação gráfica. */
.pagedjs_footnote_area > div {
  border-top: 0.5pt solid #000;
  padding-top: 0.2em;
}

.endnote {
  margin-bottom: 0.4em;
}

ol, ul {
  margin: 0;
  padding-left: 2em;
}`.trim(),
    ...regras,
    ...(opcoes.preview === true ? [cssDePreview(page)] : []),
  ].join('\n\n');
}
