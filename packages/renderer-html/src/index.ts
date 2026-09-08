/**
 * @abnt/renderer-html — Publication AST -> HTML.
 *
 * INVARIANTE: importa apenas @abnt/publication. Nunca markdown, standards,
 * semantics ou bibliography. Fiscalizado em `pnpm check:boundaries`.
 *
 * Este mesmo HTML alimenta os dois caminhos de saída — o preview e o PDF
 * (via Paged.js + Chromium). Compartilhar o renderer é justamente a vantagem
 * que justificou escolher HTML/CSS em vez de Typst; ver docs/adr/0003.
 */

export { renderizarHtml, escaparHtml, type OpcoesDeHtml } from './render.js';
export { folhaDeEstilo, cssDePagina, cssDePreview, classeDoToken } from './css.js';
