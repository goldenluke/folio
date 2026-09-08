import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  FootnoteReferenceRun,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type ParagraphChild,
  type PositiveUniversalMeasure,
} from 'docx';

import type {
  PublicationBlock,
  PublicationCaption,
  PublicationDocument,
  PublicationInline,
  PublicationListItem,
  PublicationNote,
  PublicationNoteMark,
  PublicationTableRow as PublicationTableRowAst,
  StyleDefinition,
} from '@abnt/publication';

import { estiloDeParagrafo, estiloDeTexto } from './estilos.js';
import { paraTwips } from './unidades.js';

/**
 * Renderer DOCX: percorre a mesma Publication AST que `@abnt/renderer-html`,
 * numeração/citações/ordem de referências já resolvidas — só traduz para
 * OOXML em vez de HTML. Só importa `@abnt/publication` (fiscalizado pela
 * mesma regra `renderer-so-ve-publication` que cobre qualquer
 * `packages/renderer-*`).
 *
 * Lacunas conhecidas e deliberadas (ver ADR 0019): matemática (inline e
 * bloco) sai como texto monoespaçado da fonte TeX, não tipografada — Word não
 * tem um equivalente de KaTeX embutido; sumário sem número de página nem
 * hyperlink — a AST não carrega número de página (só o Paged.js resolve isso
 * via `target-counter()`, que não existe fora de CSS); imagem só é embutida
 * quando `figure.src` é um `data:image/{png,jpeg,gif,bmp}` — SVG precisaria
 * de rasterização, fora de escopo; notas de fim (`kind: 'endnote'`) viram
 * nota de rodapé comum — Word trata as duas em partes OOXML separadas e
 * implementar as duas dobraria a superfície sem um pedido concreto ainda;
 * alinhamento explícito de célula de tabela não é aplicado — usa o
 * alinhamento do token de estilo do parágrafo.
 */

const NUMBERING_ORDENADA = 'abnt-docx-ordenada';

const NIVEIS_ORDENADOS = Array.from({ length: 6 }, (_valor, nivel) => ({
  level: nivel,
  format: LevelFormat.DECIMAL,
  text: `%${nivel + 1}.`,
  alignment: AlignmentType.START,
  style: { paragraph: { indent: { left: 360 * (nivel + 1), hanging: 360 } } },
}));

const TIPO_POR_MIME: Readonly<Record<string, 'png' | 'jpg' | 'gif' | 'bmp'>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
};

const LARGURA_MAXIMA_IMAGEM_PX = 600;

function medida(valor: `${number}cm` | `${number}in`): PositiveUniversalMeasure {
  return valor;
}

const TAMANHO_PAGINA: Readonly<Record<'A4' | 'Letter', { width: PositiveUniversalMeasure; height: PositiveUniversalMeasure }>> = {
  A4: { width: medida('21cm'), height: medida('29.7cm') },
  Letter: { width: medida('8.5in'), height: medida('11in') },
};

/** Lê largura/altura de um PNG a partir do cabeçalho IHDR — os outros formatos usam um tamanho padrão. */
function dimensoesPng(bytes: Buffer): { readonly width: number; readonly height: number } | undefined {
  const assinatura = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(assinatura)) return undefined;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

interface ImagemDecodificada {
  readonly tipo: 'png' | 'jpg' | 'gif' | 'bmp';
  readonly bytes: Buffer;
  readonly width: number;
  readonly height: number;
}

function decodificarImagemEmbutida(src: string): ImagemDecodificada | undefined {
  const match = /^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/su.exec(src.trim());
  if (match?.[1] === undefined || match[2] === undefined) return undefined;
  const tipo = TIPO_POR_MIME[match[1].toLowerCase()];
  if (tipo === undefined) return undefined;
  const bytes = Buffer.from(match[2], 'base64');
  const dimensoes = tipo === 'png' ? dimensoesPng(bytes) : undefined;
  const intrinseca = dimensoes ?? { width: LARGURA_MAXIMA_IMAGEM_PX, height: Math.round(LARGURA_MAXIMA_IMAGEM_PX * 0.6) };
  const fator = intrinseca.width > LARGURA_MAXIMA_IMAGEM_PX ? LARGURA_MAXIMA_IMAGEM_PX / intrinseca.width : 1;
  return { tipo, bytes, width: Math.round(intrinseca.width * fator), height: Math.round(intrinseca.height * fator) };
}

/** `javascript:`/`vbscript:` não executam num hyperlink do Word, mas não têm por que existir num documento gerado. */
function linkSeguro(url: string): string | undefined {
  const limpa = url.trim();
  return /^(javascript|vbscript):/iu.test(limpa) ? undefined : limpa;
}

interface MarcaAcumulada {
  readonly bold?: boolean;
  readonly italics?: boolean;
  readonly strike?: boolean;
  readonly font?: string;
}

export async function renderizarDocx(doc: PublicationDocument): Promise<Buffer> {
  const notas = new Map<string, PublicationNote>(doc.notes.map((nota) => [nota.id, nota]));
  const numeroDaNota = new Map<string, number>();
  const footnotes: Record<string, { children: Paragraph[] }> = {};

  const estiloDoToken = (token: string): StyleDefinition | undefined => doc.styles[token];

  /** Achata blocos em listas de parágrafos "soltos" — usado em citações e itens de lista sem estrutura própria de bloco. */
  function conteudoComoParagrafos(b: PublicationBlock): readonly (readonly PublicationInline[])[] {
    switch (b.type) {
      case 'paragraph':
      case 'heading':
        return [b.children];
      case 'quote':
      case 'front-matter':
        return b.children.flatMap(conteudoComoParagrafos);
      case 'list-item':
        return b.children.flatMap(conteudoComoParagrafos);
      case 'list':
        return b.items.flatMap((item) => item.children.flatMap(conteudoComoParagrafos));
      case 'code':
        return [[{ type: 'text', value: b.value }]];
      default:
        return [];
    }
  }

  function notaReferencia(marca: PublicationNoteMark): ParagraphChild {
    const nota = notas.get(marca.noteId);
    if (nota === undefined) return new TextRun(marca.marker);
    let numero = numeroDaNota.get(marca.noteId);
    if (numero === undefined) {
      numero = numeroDaNota.size + 1;
      numeroDaNota.set(marca.noteId, numero);
      const paragrafos = nota.children.flatMap((filho) => bloco(filho)).filter((f): f is Paragraph => f instanceof Paragraph);
      footnotes[String(numero)] = { children: paragrafos.length > 0 ? paragrafos : [new Paragraph({})] };
    }
    return new FootnoteReferenceRun(numero);
  }

  function paragraphChildren(nodes: readonly PublicationInline[], marca: MarcaAcumulada = {}): ParagraphChild[] {
    return nodes.flatMap((n): ParagraphChild[] => {
      switch (n.type) {
        case 'text':
          return [new TextRun({ text: n.value, ...marca })];
        case 'strong':
          return paragraphChildren(n.children, { ...marca, bold: true });
        case 'emphasis':
          return paragraphChildren(n.children, { ...marca, italics: true });
        case 'strike':
          return paragraphChildren(n.children, { ...marca, strike: true });
        case 'code':
          return paragraphChildren(n.children, { ...marca, font: 'Courier New' });
        case 'link': {
          const url = linkSeguro(n.url);
          const filhos = paragraphChildren(n.children, marca);
          return url === undefined ? filhos : [new ExternalHyperlink({ link: url, children: filhos })];
        }
        case 'math':
          return [new TextRun({ text: n.value, font: 'Courier New', italics: true, ...marca })];
        case 'note-mark':
          return [notaReferencia(n)];
      }
    });
  }

  function legenda(caption: PublicationCaption): Paragraph {
    return new Paragraph({ children: paragraphChildren(caption.text), alignment: AlignmentType.CENTER });
  }

  function imagemOuPlaceholder(src: string, alt: string): Paragraph {
    const decodificada = decodificarImagemEmbutida(src);
    if (decodificada === undefined) {
      return new Paragraph({
        children: [new TextRun({ text: `[Figura: ${alt === '' ? 'sem descrição' : alt}]`, italics: true })],
        alignment: AlignmentType.CENTER,
      });
    }
    return new Paragraph({
      children: [
        new ImageRun({
          type: decodificada.tipo,
          data: decodificada.bytes,
          transformation: { width: decodificada.width, height: decodificada.height },
        }),
      ],
      alignment: AlignmentType.CENTER,
    });
  }

  function celulaDaTabela(cell: PublicationTableRowAst['cells'][number], cabecalho: boolean): TableCell {
    const conteudo = cell.children.flatMap((filho) => bloco(filho));
    return new TableCell({
      children: conteudo.length > 0 ? conteudo : [new Paragraph({})],
      ...(cell.columnSpan !== undefined ? { columnSpan: cell.columnSpan } : {}),
      ...(cabecalho ? { shading: { fill: 'D9D9D9' } } : {}),
    });
  }

  function linhaDaTabela(row: PublicationTableRowAst, cabecalho: boolean): TableRow {
    return new TableRow({
      tableHeader: cabecalho,
      children: row.cells.map((cell) => celulaDaTabela(cell, cabecalho)),
    });
  }

  function tabela(head: readonly PublicationTableRowAst[], body: readonly PublicationTableRowAst[]): Table {
    const linhas = [...head.map((r) => linhaDaTabela(r, true)), ...body.map((r) => linhaDaTabela(r, false))];
    return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: linhas });
  }

  function itemDeLista(item: PublicationListItem, ordenada: boolean, nivel: number): (Paragraph | Table)[] {
    return item.children.flatMap((filho): (Paragraph | Table)[] => {
      if (filho.type === 'list') {
        return filho.items.flatMap((sub) => itemDeLista(sub, filho.ordered, nivel + 1));
      }
      const estilo = estiloDoToken(item.style);
      return conteudoComoParagrafos(filho).map(
        (inlineNodes) =>
          new Paragraph({
            children: paragraphChildren(inlineNodes),
            ...estiloDeParagrafo(estilo),
            ...(ordenada
              ? { numbering: { reference: NUMBERING_ORDENADA, level: Math.min(nivel, 5) } }
              : { bullet: { level: Math.min(nivel, 5) } }),
          }),
      );
    });
  }

  const NIVEL_TITULO: Readonly<Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]>> = {
    1: HeadingLevel.HEADING_1,
    2: HeadingLevel.HEADING_2,
    3: HeadingLevel.HEADING_3,
    4: HeadingLevel.HEADING_4,
    5: HeadingLevel.HEADING_5,
    6: HeadingLevel.HEADING_6,
  };

  function bloco(b: PublicationBlock): (Paragraph | Table)[] {
    const estilo = estiloDoToken(b.style);
    switch (b.type) {
      case 'paragraph':
        return [new Paragraph({ children: paragraphChildren(b.children), run: estiloDeTexto(estilo), ...estiloDeParagrafo(estilo) })];

      case 'heading': {
        const nivel = Math.min(Math.max(b.level, 1), 6);
        const numero = b.number !== undefined ? [new TextRun(`${b.number} `)] : [];
        return [
          new Paragraph({
            heading: NIVEL_TITULO[nivel] ?? HeadingLevel.HEADING_6,
            children: [...numero, ...paragraphChildren(b.children)],
            ...estiloDeParagrafo(estilo),
          }),
        ];
      }

      case 'quote': {
        const RECUO_CITACAO_LONGA = 720; // 0.5in — recuo visual de citação longa; ABNT define 4cm exatos via token de estilo próprio quando existir
        const paragrafos = b.children
          .flatMap(conteudoComoParagrafos)
          .map((inlineNodes) => new Paragraph({ children: paragraphChildren(inlineNodes), indent: { left: RECUO_CITACAO_LONGA }, ...estiloDeParagrafo(estilo) }));
        const atribuicao =
          b.attribution !== undefined
            ? [new Paragraph({ children: paragraphChildren(b.attribution), indent: { left: RECUO_CITACAO_LONGA }, alignment: AlignmentType.RIGHT })]
            : [];
        return [...paragrafos, ...atribuicao];
      }

      case 'list':
        return b.items.flatMap((item) => itemDeLista(item, b.ordered, 0));

      case 'list-item':
        // Só alcançável se um list-item aparecer fora de um `list` (a AST permite; a prática não gera isso).
        return conteudoComoParagrafos(b).map((inlineNodes) => new Paragraph({ children: paragraphChildren(inlineNodes) }));

      case 'figure': {
        const acima = b.caption?.position === 'above' ? [legenda(b.caption)] : [];
        const abaixo = b.caption?.position === 'below' ? [legenda(b.caption)] : [];
        const fonte = b.attribution !== undefined ? [legenda(b.attribution)] : [];
        return [...acima, imagemOuPlaceholder(b.src, b.alt), ...abaixo, ...fonte];
      }

      case 'table': {
        const legendaAcima = b.caption?.position === 'above' ? [legenda(b.caption)] : [];
        const legendaAbaixo = b.caption?.position === 'below' ? [legenda(b.caption)] : [];
        const fonte = b.attribution !== undefined ? [legenda(b.attribution)] : [];
        return [...legendaAcima, tabela(b.head, b.body), ...legendaAbaixo, ...fonte];
      }

      case 'code': {
        const paragrafos = b.value.split('\n').map((linha) => new Paragraph({ children: [new TextRun({ text: linha, font: 'Courier New' })] }));
        const legendaBloco = b.caption !== undefined ? [legenda(b.caption)] : [];
        return [...paragrafos, ...legendaBloco];
      }

      case 'math-block': {
        const paragrafo = new Paragraph({
          children: [new TextRun({ text: b.value, font: 'Courier New', italics: true })],
          alignment: AlignmentType.CENTER,
        });
        const legendaBloco = b.caption !== undefined ? [legenda(b.caption)] : [];
        return [paragrafo, ...legendaBloco];
      }

      case 'thematic-break':
        return [
          new Paragraph({
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, space: 1 } },
            spacing: { before: 240, after: 240 },
          }),
        ];

      case 'front-matter': {
        const paragrafos = b.children.flatMap((filho) => bloco(filho));
        const primeiro = paragrafos[0];
        if (b.label !== undefined && primeiro instanceof Paragraph) {
          primeiro.addRunToFront(new TextRun({ text: `${b.label}: `, bold: true }));
        }
        return paragrafos;
      }

      case 'toc': {
        const titulo = new Paragraph({ heading: HeadingLevel.HEADING_1, children: paragraphChildren(b.title) });
        const entradas = b.entries.map(
          (entrada) => new Paragraph({ children: paragraphChildren(entrada.children), indent: { left: 360 * entrada.level } }),
        );
        return [titulo, ...entradas];
      }
    }
  }

  // A ordem importa: `notaReferencia` preenche `footnotes` como efeito colateral
  // durante o percurso do corpo, na ordem de aparição — igual ao renderer HTML.
  const corpo = doc.children.flatMap((b) => bloco(b));

  const margem = (valor: string): number => paraTwips(valor) ?? 1440;
  const tamanho = TAMANHO_PAGINA[doc.page.size];

  const documento = new Document({
    title: doc.title,
    footnotes,
    numbering: { config: [{ reference: NUMBERING_ORDENADA, levels: NIVEIS_ORDENADOS }] },
    sections: [
      {
        properties: {
          page: {
            size: tamanho,
            margin: {
              top: margem(doc.page.margin.top),
              right: margem(doc.page.margin.right),
              bottom: margem(doc.page.margin.bottom),
              left: margem(doc.page.margin.left),
            },
          },
        },
        children: corpo,
      },
    ],
  });

  return Packer.toBuffer(documento);
}
