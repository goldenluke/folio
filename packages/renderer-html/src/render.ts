import type {
  PublicationBlock,
  PublicationCaption,
  PublicationDocument,
  PublicationInline,
  PublicationNote,
  PublicationTableRow,
} from '@abnt/publication';
import katex from 'katex';

import { classeDoToken, folhaDeEstilo } from './css.js';

/** Escapa texto para contexto de conteúdo HTML. */
export function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Escapa para uso em atributo, recusando esquemas perigosos.
 *
 * URLs vêm do documento do usuário, que é conteúdo não confiável — um
 * `[clique](javascript:...)` viraria XSS no preview, que roda no mesmo
 * contexto do aplicativo.
 */
export function urlSegura(url: string): string {
  const limpa = url.trim();
  if (/^(javascript|vbscript):/i.test(limpa)) return '#';
  // `data:` é permitido só para imagem, que é como recursos embutidos chegam.
  if (/^data:/i.test(limpa) && !/^data:image\//i.test(limpa)) return '#';
  return escaparHtml(limpa);
}

const TAG_DE_MARCA = {
  strong: 'strong',
  emphasis: 'em',
  strike: 's',
  code: 'code',
} as const;

/**
 * TeX -> MathML nativo.
 *
 * Usamos a saída MathML do KaTeX, não o HTML estilizado dele: Chromium moderno
 * compõe MathML sem folhas de estilo nem fontes externas, o PDF fica
 * autocontido e a fórmula continua acessível a leitores de tela.
 */
function renderizarMatematica(valor: string, linguagem: string, display: boolean): string {
  if (linguagem !== 'tex') {
    return `<span class="math-source" data-language="${escaparHtml(linguagem)}">${escaparHtml(
      valor,
    )}</span>`;
  }

  return katex.renderToString(valor, {
    displayMode: display,
    output: 'mathml',
    throwOnError: false,
    strict: 'ignore',
  });
}

/**
 * Publication AST -> HTML.
 *
 * INVARIANTE: este renderer é burro de propósito. Ele não sabe o que é ABNT,
 * não numera seção, não ordena referência, não decide o que é citação longa.
 * Tudo isso já chegou resolvido. Um renderer que precisa consultar a norma é
 * um renderer que está reimplementando a norma — e aí passam a existir duas
 * versões da regra, que divergem.
 */
export interface OpcoesDeHtml {
  /** Representa o papel e suas margens no browser, sem paginação Paged.js. */
  readonly preview?: boolean;
}

export function renderizarHtml(doc: PublicationDocument, opcoes: OpcoesDeHtml = {}): string {
  const notasPorId = new Map<string, PublicationNote>(doc.notes.map((n) => [n.id, n]));
  /** Notas de fim, que ao contrário das de rodapé saem agrupadas no final. */
  const notasDeFim: PublicationNote[] = [];

  function inline(nodes: readonly PublicationInline[]): string {
    return nodes
      .map((n) => {
        switch (n.type) {
          case 'text':
            return escaparHtml(n.value);

          case 'strong':
          case 'emphasis':
          case 'strike':
          case 'code': {
            const tag = TAG_DE_MARCA[n.type];
            return `<${tag}>${inline(n.children)}</${tag}>`;
          }

          case 'link':
            return `<a href="${urlSegura(n.url)}">${inline(n.children)}</a>`;

          case 'math':
            return renderizarMatematica(n.value, n.language, n.display);

          case 'note-mark': {
            const nota = notasPorId.get(n.noteId);
            if (nota === undefined) return `<sup>${escaparHtml(n.marker)}</sup>`;

            if (nota.kind === 'endnote') {
              notasDeFim.push(nota);
              return `<sup class="note-mark"><a href="#nota-${escaparHtml(nota.id)}">${escaparHtml(
                n.marker,
              )}</a></sup>`;
            }

            // Nota de rodapé é emitida INLINE, no ponto da chamada, e o
            // Paged.js a flutua para o rodapé da página em que esse ponto
            // caiu. Agrupá-las no fim do documento faria todas caírem na
            // última página, longe da chamada.
            //
            // O conteúdo precisa ser inline: um <p> dentro de <span> é HTML
            // inválido, e o parser do browser retira o parágrafo de dentro do
            // span — o que deixaria o texto da nota solto no corpo e a nota
            // flutuada vazia.
            return `<span class="footnote ${classeDoToken(nota.style)}">${conteudoInline(
              nota.children,
            )}</span>`;
          }
        }
      })
      .join('');
  }

  /**
   * Achata blocos em conteúdo inline.
   *
   * Usado onde o HTML só admite conteúdo inline — nota de rodapé flutuada,
   * célula compacta. Parágrafos viram texto separado por espaço; o que não
   * tem representação inline (tabela, figura) é omitido, porque não existe
   * forma válida de embutir isso e emitir HTML inválido quebraria o layout
   * inteiro em vez de degradar só aquele trecho.
   */
  function conteudoInline(blocos: readonly PublicationBlock[]): string {
    return blocos
      .map((b) => {
        switch (b.type) {
          case 'paragraph':
          case 'heading':
            return inline(b.children);
          case 'quote':
          case 'list-item':
          case 'front-matter':
            return conteudoInline(b.children);
          case 'list':
            return conteudoInline(b.items);
          case 'code':
            return `<code>${escaparHtml(b.value)}</code>`;
          case 'math-block':
            return renderizarMatematica(b.value, b.language, true);
          default:
            return '';
        }
      })
      .filter((s) => s !== '')
      .join(' ');
  }

  function legenda(cap: PublicationCaption | undefined): string {
    if (cap === undefined) return '';
    return `<p class="${classeDoToken(cap.style)}">${inline(cap.text)}</p>`;
  }

  function linhas(rows: readonly PublicationTableRow[]): string {
    return rows
      .map((linha) => {
        const celulas = linha.cells
          .map((c) => {
            const tag = c.header ? 'th' : 'td';
            const attrs = [
              c.alignment !== undefined ? ` style="text-align:${c.alignment}"` : '',
              c.rowSpan !== undefined && c.rowSpan > 1 ? ` rowspan="${c.rowSpan}"` : '',
              c.columnSpan !== undefined && c.columnSpan > 1 ? ` colspan="${c.columnSpan}"` : '',
            ].join('');
            return `<${tag}${attrs}>${c.children.map(bloco).join('')}</${tag}>`;
          })
          .join('');
        return `<tr>${celulas}</tr>`;
      })
      .join('\n');
  }

  function bloco(b: PublicationBlock): string {
    const classe = classeDoToken(b.style);

    switch (b.type) {
      case 'paragraph':
        return `<p class="${classe}">${inline(b.children)}</p>`;

      case 'heading': {
        // O nível vira h1..h6 e satura em h6, limite do HTML.
        const tag = `h${Math.min(Math.max(b.level, 1), 6)}`;
        const numero = b.number !== undefined ? `${escaparHtml(b.number)} ` : '';
        const id = b.anchor === undefined ? '' : ` id="${escaparHtml(b.anchor)}"`;
        return `<${tag}${id} class="${classe}">${numero}${inline(b.children)}</${tag}>`;
      }

      case 'quote': {
        const fonte =
          b.attribution !== undefined
            ? `\n<p class="quote-source">${inline(b.attribution)}</p>`
            : '';
        return `<blockquote class="${classe}">\n${b.children
          .map(bloco)
          .join('\n')}${fonte}\n</blockquote>`;
      }

      case 'list': {
        const tag = b.ordered ? 'ol' : 'ul';
        const start =
          b.ordered && b.start !== undefined && b.start !== 1 ? ` start="${b.start}"` : '';
        return `<${tag} class="${classe}"${start}>\n${b.items.map(bloco).join('\n')}\n</${tag}>`;
      }

      case 'list-item':
        return `<li class="${classe}">${b.children.map(bloco).join('')}</li>`;

      case 'figure': {
        const id = b.anchor === undefined ? '' : ` id="${escaparHtml(b.anchor)}"`;
        const acima = b.caption?.position === 'above' ? legenda(b.caption) : '';
        const abaixo = b.caption?.position === 'below' ? legenda(b.caption) : '';
        return `<figure${id} class="${classe}">
${acima}<img src="${urlSegura(b.src)}" alt="${escaparHtml(b.alt)}">
${abaixo}${legenda(b.attribution)}
</figure>`;
      }

      case 'table': {
        const id = b.anchor === undefined ? '' : ` id="${escaparHtml(b.anchor)}"`;
        const cabeca = b.head.length > 0 ? `<thead>\n${linhas(b.head)}\n</thead>\n` : '';
        const acima = b.caption?.position === 'above' ? legenda(b.caption) : '';
        const abaixo = b.caption?.position === 'below' ? legenda(b.caption) : '';
        // A âncora fica no elemento <table>: o Paged.js não resolve
        // target-counter() de forma confiável quando o alvo é o <div> que
        // envolve uma tabela paginada.
        return `<div class="${classe}">
${acima}<table${id}>
${cabeca}<tbody>
${linhas(b.body)}
</tbody>
</table>
${abaixo}${legenda(b.attribution)}
</div>`;
      }

      case 'code': {
        const id = b.anchor === undefined ? '' : ` id="${escaparHtml(b.anchor)}"`;
        const lang = b.language !== undefined ? ` data-language="${escaparHtml(b.language)}"` : '';
        return `${legenda(b.caption)}<pre${id} class="${classe}"${lang}><code>${escaparHtml(
          b.value,
        )}</code></pre>`;
      }

      case 'math-block': {
        const id = b.anchor === undefined ? '' : ` id="${escaparHtml(b.anchor)}"`;
        return `${legenda(b.caption)}<div${id} class="${classe} math-block" data-language="${escaparHtml(
          b.language,
        )}">${renderizarMatematica(b.value, b.language, true)}</div>`;
      }

      case 'thematic-break':
        return `<hr class="${classe}">`;

      case 'front-matter': {
        const rotulo =
          b.label !== undefined
            ? `<span class="front-matter-label">${escaparHtml(b.label)}: </span>`
            : '';
        const filhos = b.children.map(bloco).join('\n');
        // O rótulo entra dentro do primeiro parágrafo quando há um, para que
        // "Resumo: texto..." fique no mesmo bloco em vez de virar duas linhas.
        const corpo =
          rotulo !== '' && b.children[0]?.type === 'paragraph'
            ? filhos.replace(/^(<p[^>]*>)/, `$1${rotulo}`)
            : rotulo + filhos;
        // O estilo do bloco vai na <section>, não nos filhos: espaçamento de
        // bloco aplicado em cada filho se multiplica pelo número de filhos.
        return `<section class="front-matter ${classe}" data-role="${escaparHtml(
          b.role,
        )}">\n${corpo}\n</section>`;
      }

      case 'toc':
        return `<nav class="publication-toc ${classe}">
<p class="publication-toc-title">${inline(b.title)}</p>
${b.entries
  .map(
    (entry) =>
      `<p class="publication-toc-entry toc-level-${entry.level}"><a href="#${escaparHtml(
        entry.target,
      )}">${inline(entry.children)}</a></p>`,
  )
  .join('\n')}
</nav>`;
    }
  }

  // O corpo precisa ser montado antes das notas de fim: é a travessia dele que
  // descobre quais notas foram efetivamente chamadas, e em que ordem.
  const corpo = doc.children.map(bloco).join('\n');

  const fim =
    notasDeFim.length === 0
      ? ''
      : `\n<section class="endnotes">\n${notasDeFim
          .map(
            (n) =>
              `<div class="endnote ${classeDoToken(n.style)}" id="nota-${escaparHtml(n.id)}">` +
              `<sup>${escaparHtml(n.marker)}</sup> ${n.children.map(bloco).join('')}</div>`,
          )
          .join('\n')}\n</section>`;

  return `<!doctype html>
<html lang="${escaparHtml(doc.language)}">
<head>
<meta charset="utf-8">
<title>${escaparHtml(doc.title)}</title>
<style>
${folhaDeEstilo(doc.page, doc.styles, opcoes)}
</style>
</head>
<body>
${corpo}${fim}
</body>
</html>
`;
}
