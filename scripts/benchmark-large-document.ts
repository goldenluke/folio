/**
 * F148 — Large Document Benchmark. Gera um documento Markdown sintético de
 * tamanho aproximado em páginas ABNT (~280 palavras/página) e mede
 * prepare+compile+html (via `compilar()` do @abnt/cli), export PDF e export
 * DOCX contra ele.
 *
 * Uso:
 *   NODE_OPTIONS=--conditions=development tsx scripts/benchmark-large-document.ts --pages=50
 *
 * Tiers do roadmap (F148): 50/200/500 páginas. TCC modular/dissertação/tese
 * já têm timing equivalente via F70/embeds (Onda M) — não duplicado aqui.
 */
import { compilar, gerarPdf, renderizarDocx } from '@abnt/cli';

const WORDS_PER_PAGE = 280;

function parseArgs(argv: readonly string[]): { readonly pages: number; readonly skipPdf: boolean } {
  const match = argv.find((arg) => arg.startsWith('--pages='));
  return { pages: match === undefined ? 50 : Number(match.slice('--pages='.length)), skipPdf: argv.includes('--skip-pdf') };
}

const paragraph = (index: number): string =>
  `Este é o parágrafo sintético número ${index} deste documento de benchmark. ` +
  'Ele existe apenas para ocupar espaço com prosa plausível, repetindo estrutura de frases para simular texto acadêmico real sem depender de nenhum conteúdo autoral externo. '.repeat(3);

function buildDocument(targetPages: number): string {
  const targetWords = targetPages * WORDS_PER_PAGE;
  const wordsPerParagraph = paragraph(0).split(/\s+/u).length;
  const paragraphsNeeded = Math.ceil(targetWords / wordsPerParagraph);
  const sections = Math.max(4, Math.round(targetPages / 8));
  const paragraphsPerSection = Math.ceil(paragraphsNeeded / sections);

  const lines = ['---', 'title: "Documento sintético de benchmark"', 'lang: pt-BR', '---', ''];
  let written = 0;
  for (let section = 0; section < sections && written < paragraphsNeeded; section += 1) {
    lines.push(`# Seção ${section + 1}`, '');
    for (let index = 0; index < paragraphsPerSection && written < paragraphsNeeded; index += 1, written += 1) {
      lines.push(paragraph(written), '');
    }
  }
  return lines.join('\n');
}

async function main(): Promise<void> {
  const { pages, skipPdf } = parseArgs(process.argv.slice(2));
  const content = buildDocument(pages);
  console.log(`Documento sintético: ~${pages} páginas, ${content.split(/\s+/u).length} palavras, ${content.length} caracteres.`);

  const compileStart = performance.now();
  const result = await compilar(content, { documentId: 'bench.md', revision: 1, embutirRecursos: true });
  console.log(`compilar() (prepare+compile+html): ${(performance.now() - compileStart).toFixed(0)} ms — html: ${result.html.length} caracteres`);

  const docxStart = performance.now();
  const docxBytes = await renderizarDocx(result.publicacao);
  console.log(`renderizarDocx(): ${(performance.now() - docxStart).toFixed(0)} ms — ${docxBytes.length} bytes`);

  if (skipPdf) {
    console.log('PDF pulado (--skip-pdf).');
    return;
  }
  const pdfStart = performance.now();
  const pdf = await gerarPdf(result.html);
  console.log(`gerarPdf() via Chromium: ${(performance.now() - pdfStart).toFixed(0)} ms — ${pdf.bytes.length} bytes${pdf.pages !== undefined ? `, ${pdf.pages} páginas reais` : ''}`);
}

void main();
