import type {
  Attribution,
  BlockNode,
  Caption,
  CitationItem,
  CodeBlockNode,
  Diagnostic,
  DocumentAst,
  FigureNode,
  InlineNode,
  ListItemNode,
  ListNode,
  MathBlockNode,
  Note,
  NoteId,
  ParagraphNode,
  QuoteNode,
  Registry,
  Resource,
  ResourceId,
  SectionNode,
  SourceRange,
  TableNode,
  TableRow,
  TextNode,
} from '@abnt/document-model';
import {
  IndiceDeLinhas,
  NodeIdFactory,
  asDocumentId,
  asNoteId,
  asResourceId,
} from '@abnt/document-model';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { gfm } from 'micromark-extension-gfm';
import { mathFromMarkdown } from 'mdast-util-math';
import { math } from 'micromark-extension-math';
import type {
  Nodes as MdastNode,
  Parent as MdastParent,
  PhrasingContent,
  RootContent,
} from 'mdast';

import { extrairCitacoes } from './citations.js';
import { extrairReferenciasCruzadas } from './cross-references.js';
import { extrairFrontmatter } from './frontmatter.js';
import { metadadosDeFrontmatter } from './metadata.js';

export interface OpcoesDeParse {
  /** Identifica o documento nos SourceRanges. Default: 'documento'. */
  readonly documentId?: string;
  /** Reconhece `[@chave]` e `@chave` como citações. Default: true. */
  readonly citacoes?: boolean;
}

export interface ResultadoDoParse {
  readonly ast: DocumentAst;
  readonly diagnostics: readonly Diagnostic[];
}

/**
 * Markdown -> Document AST.
 *
 * O parser produz estrutura, nunca julgamento: aqui não existe nenhuma regra
 * ABNT, nenhum limite de palavras, nenhuma exigência de campo. Fiscalizado em
 * `pnpm check:boundaries` (regra `markdown-nao-conhece-normas`).
 */
export function parseMarkdown(fonte: string, opcoes: OpcoesDeParse = {}): DocumentAst {
  const documentId = asDocumentId(opcoes.documentId ?? 'documento');
  const reconhecerCitacoes = opcoes.citacoes ?? true;
  const { dados, corpo, offsetDoCorpo } = extrairFrontmatter(fonte);
  const ids = new NodeIdFactory();

  // O frontmatter é sempre um número inteiro de linhas terminando em quebra,
  // então corrigir a linha é uma soma e a coluna não muda. Recalcular via
  // varredura do texto seria O(n) por nó, ou seja O(n²) no documento.
  const linhasDoFrontmatter =
    offsetDoCorpo === 0 ? 0 : (fonte.slice(0, offsetDoCorpo).match(/\n/g) ?? []).length;

  // Índice construído uma vez sobre o arquivo inteiro. Sem ele, cada citação
  // pagaria uma varredura do texto para descobrir sua linha, e um documento com
  // centenas de citações viraria trabalho quadrático.
  const linhas = new IndiceDeLinhas(fonte);

  /** Offsets relativos ao arquivo original, com linha/coluna derivadas. */
  const intervaloDeOffsets = (inicio: number, fim: number): SourceRange => ({
    documentId,
    start: { offset: inicio, ...linhas.posicaoDe(inicio) },
    end: { offset: fim, ...linhas.posicaoDe(fim) },
  });

  const intervalo = (no: MdastNode): SourceRange | undefined => {
    const p = no.position;
    if (p?.start.offset === undefined || p.end.offset === undefined) return undefined;
    return {
      documentId,
      start: {
        offset: p.start.offset + offsetDoCorpo,
        line: p.start.line + linhasDoFrontmatter,
        column: p.start.column,
      },
      end: {
        offset: p.end.offset + offsetDoCorpo,
        line: p.end.line + linhasDoFrontmatter,
        column: p.end.column,
      },
    };
  };

  /** Anexa `source` só quando existe — `exactOptionalPropertyTypes` recusa `undefined`. */
  const comSource = <T extends object>(base: T, no: MdastNode): T & { source?: SourceRange } => {
    const s = intervalo(no);
    return s === undefined ? base : { ...base, source: s };
  };

  // Recursos e notas vivem em registries, fora da árvore.
  const recursos: Record<string, Resource> = {};
  const notas: Record<string, Note> = {};
  const notasPorRotulo = new Map<string, NoteId>();

  const registrarRecurso = (uri: string): ResourceId => {
    const id = asResourceId(`r${Object.keys(recursos).length + 1}`);
    recursos[id] = { id, uri };
    return id;
  };

  const idDaNota = (rotulo: string): NoteId => {
    const existente = notasPorRotulo.get(rotulo);
    if (existente !== undefined) return existente;
    const id = asNoteId(`nota-${rotulo}`);
    notasPorRotulo.set(rotulo, id);
    return id;
  };

  // -------------------------------------------------------------------------
  // Inline
  // -------------------------------------------------------------------------

  function inline(nos: readonly PhrasingContent[]): InlineNode[] {
    const saida: InlineNode[] = [];

    for (const no of nos) {
      switch (no.type) {
        case 'text': {
          const base: TextNode = comSource(
            { id: ids.proximo(), type: 'text' as const, value: no.value },
            no,
          );
          if (!reconhecerCitacoes) {
            saida.push(base);
            break;
          }
          const inicio = base.source?.start.offset ?? 0;
          saida.push(...extrairCitacoes(base, inicio, { ids, intervalo: intervaloDeOffsets }).flatMap((item) => item.type === 'text' ? extrairReferenciasCruzadas(item, item.source?.start.offset ?? inicio, ids, intervaloDeOffsets) : [item]));
          break;
        }

        case 'strong':
          saida.push(
            comSource({ id: ids.proximo(), type: 'strong' as const, children: inline(no.children) }, no),
          );
          break;

        case 'emphasis':
          saida.push(
            comSource({ id: ids.proximo(), type: 'emphasis' as const, children: inline(no.children) }, no),
          );
          break;

        case 'delete':
          saida.push(
            comSource({ id: ids.proximo(), type: 'strike' as const, children: inline(no.children) }, no),
          );
          break;

        case 'inlineCode':
          saida.push(
            comSource({ id: ids.proximo(), type: 'code-inline' as const, value: no.value }, no),
          );
          break;

        case 'inlineMath':
          saida.push(
            comSource(
              { id: ids.proximo(), type: 'math-inline' as const, language: 'tex' as const, value: no.value },
              no,
            ),
          );
          break;

        case 'link':
          saida.push(
            comSource(
              {
                id: ids.proximo(),
                type: 'link' as const,
                url: no.url,
                ...(typeof no.title === 'string' ? { title: no.title } : {}),
                children: inline(no.children),
              },
              no,
            ),
          );
          break;

        case 'image':
          // Imagem dentro de parágrafo com mais conteúdo continua inline; o
          // caso de imagem sozinha vira figura e é tratado no nível de bloco.
          saida.push(
            comSource(
              {
                id: ids.proximo(),
                type: 'link' as const,
                url: no.url,
                children: [{ id: ids.proximo(), type: 'text' as const, value: no.alt ?? '' }],
              },
              no,
            ),
          );
          break;

        case 'footnoteReference':
          saida.push(
            comSource(
              { id: ids.proximo(), type: 'note-reference' as const, noteId: idDaNota(no.identifier) },
              no,
            ),
          );
          break;

        case 'break':
          saida.push(comSource({ id: ids.proximo(), type: 'hard-break' as const }, no));
          break;

        default:
          if ('children' in no && Array.isArray((no as MdastParent).children)) {
            saida.push(...inline((no as MdastParent).children as PhrasingContent[]));
          } else if ('value' in no && typeof no.value === 'string') {
            saida.push(comSource({ id: ids.proximo(), type: 'text' as const, value: no.value }, no));
          }
          break;
      }
    }

    return saida;
  }

  // -------------------------------------------------------------------------
  // Blocos
  // -------------------------------------------------------------------------

  /**
   * Parágrafo que contém só uma imagem vira figura.
   *
   * `![legenda](img.png)` sozinho é intenção de figura, não de imagem no meio
   * do texto — e figura é o que carrega legenda, numeração e fonte na ABNT.
   */
  function talvezFigura(no: Extract<RootContent, { type: 'paragraph' }>): FigureNode | undefined {
    const relevantes = no.children.filter(
      (c) => !(c.type === 'text' && c.value.trim() === ''),
    );
    const unica = relevantes[0];
    const identifier = relevantes.length === 2 && relevantes[1]?.type === 'text'
      ? /^\s*\{#([^{}\s]+)\}\s*$/u.exec(relevantes[1].value)?.[1]
      : undefined;
    if (unica === undefined || unica.type !== 'image' || relevantes.length > (identifier === undefined ? 1 : 2)) return undefined;

    const resourceId = registrarRecurso(unica.url);
    const alt = unica.alt ?? '';

    return comSource(
      {
        id: ids.proximo(),
        type: 'figure' as const,
        content: [
          {
            type: 'image' as const,
            resourceId,
            ...(alt !== ''
              ? { alt: [{ id: ids.proximo(), type: 'text' as const, value: alt }] }
              : {}),
          },
        ],
        ...(alt !== ''
          ? {
              caption: {
                short: [{ id: ids.proximo(), type: 'text' as const, value: alt }],
              },
          }
          : {}),
        ...(identifier === undefined ? {} : { attributes: { identifier } }),
      },
      no,
    );
  }

  /**
   * `Fonte: texto [@referência]` logo após figura/tabela pertence ao elemento
   * anterior. A convenção preserva Markdown legível e não exige HTML bruto.
   * O parser apenas reconhece a estrutura; a norma decide se ela é obrigatória.
   */
  function fonteDoParagrafo(
    no: Extract<RootContent, { type: 'paragraph' }>,
  ): Attribution | undefined {
    const primeiro = no.children[0];
    if (primeiro?.type !== 'text') return undefined;
    const prefixo = /^\s*fonte\s*:\s*/i;
    if (!prefixo.test(primeiro.value)) return undefined;

    const semPrefixo = {
      ...primeiro,
      value: primeiro.value.replace(prefixo, ''),
    };
    const nos = inline([semPrefixo, ...no.children.slice(1)]);
    const citations: CitationItem[] = [];
    const content: InlineNode[] = [];
    for (const node of nos) {
      if (node.type === 'citation') citations.push(...node.items);
      else content.push(node);
    }

    return {
      ...(content.some((node) => node.type !== 'text' || node.value.trim() !== '')
        ? { content }
        : {}),
      ...(citations.length > 0 ? { citations } : {}),
    };
  }

  /** `Tabela: título` imediatamente antes do elemento vira sua legenda. */
  function legendaDoParagrafo(
    no: Extract<RootContent, { type: 'paragraph' }>,
  ): Caption | undefined {
    const primeiro = no.children[0];
    if (primeiro?.type !== 'text') return undefined;
    const prefixo = /^\s*(?:figura|tabela|quadro|código|codigo|equação|equacao)\s*:\s*/i;
    if (!prefixo.test(primeiro.value)) return undefined;
    const semPrefixo = { ...primeiro, value: primeiro.value.replace(prefixo, '') };
    const short = inline([semPrefixo, ...no.children.slice(1)]);
    return short.length > 0 ? { short } : undefined;
  }

  function linhasDaTabela(
    linhas: readonly Extract<RootContent, { type: 'table' }>['children'][number][],
  ): TableRow[] {
    return linhas.map((linha) =>
      comSource(
        {
          id: ids.proximo(),
          type: 'table-row' as const,
          cells: linha.children.map((celula) =>
            comSource(
              {
                id: ids.proximo(),
                type: 'table-cell' as const,
                children: [
                  comSource(
                    {
                      id: ids.proximo(),
                      type: 'paragraph' as const,
                      children: inline(celula.children),
                    },
                    celula,
                  ) as ParagraphNode,
                ],
              },
              celula,
            ),
          ),
        },
        linha,
      ),
    );
  }

  /** Converte um bloco mdast, devolvendo zero ou mais blocos do modelo. */
  function converterBloco(no: RootContent): BlockNode[] {
    switch (no.type) {
      case 'paragraph': {
        const figura = talvezFigura(no);
        if (figura !== undefined) return [figura];
        return [
          comSource(
            { id: ids.proximo(), type: 'paragraph' as const, children: inline(no.children) },
            no,
          ) as ParagraphNode,
        ];
      }

      case 'blockquote':
        return [
          comSource(
            {
              id: ids.proximo(),
              type: 'quote' as const,
              children: no.children.flatMap(converterBloco),
            },
            no,
          ) as QuoteNode,
        ];

      case 'list':
        return [
          comSource(
            {
              id: ids.proximo(),
              type: 'list' as const,
              ordered: no.ordered === true,
              ...(typeof no.start === 'number' && no.start !== 1 ? { start: no.start } : {}),
              items: no.children.map(
                (item) =>
                  comSource(
                    {
                      id: ids.proximo(),
                      type: 'list-item' as const,
                      ...(typeof item.checked === 'boolean' ? { checked: item.checked } : {}),
                      children: item.children.flatMap(converterBloco),
                    },
                    item,
                  ) as ListItemNode,
              ),
            },
            no,
          ) as ListNode,
        ];

      case 'code':
        return [
          comSource(
            {
              id: ids.proximo(),
              type: 'code-block' as const,
              ...(typeof no.lang === 'string' && no.lang !== '' ? { language: no.lang } : {}),
              value: no.value,
            },
            no,
          ) as CodeBlockNode,
        ];

      case 'math':
        return [
          comSource(
            {
              id: ids.proximo(),
              type: 'math-block' as const,
              language: 'tex' as const,
              value: no.value,
            },
            no,
          ) as MathBlockNode,
        ];

      case 'table': {
        const [cabecalho, ...corpoDaTabela] = no.children;
        const alinhamentos = (no.align ?? []).map((a) =>
          a === null ? {} : { alignment: a as 'left' | 'right' | 'center' },
        );

        return [
          comSource(
            {
              id: ids.proximo(),
              type: 'table' as const,
              columns: alinhamentos,
              ...(cabecalho !== undefined ? { head: linhasDaTabela([cabecalho]) } : {}),
              body: linhasDaTabela(corpoDaTabela),
            },
            no,
          ) as TableNode,
        ];
      }

      case 'thematicBreak':
        return [comSource({ id: ids.proximo(), type: 'thematic-break' as const }, no)];

      case 'footnoteDefinition': {
        // Definição de nota não entra na árvore: vai para o registry, e o
        // corpo referencia por id. Assim a mesma nota pode ser chamada de
        // dois pontos sem duplicar conteúdo.
        const id = idDaNota(no.identifier);
        notas[id] = { id, kind: 'footnote', children: no.children.flatMap(converterBloco) };
        return [];
      }

      case 'html':
        // HTML bruto é descartado de propósito: aceitá-lo abriria um caminho
        // para injeção no preview e criaria conteúdo que os renderers não-HTML
        // (DOCX, PDF via outro backend) não saberiam traduzir.
        return [];

      default:
        if ('children' in no && Array.isArray((no as MdastParent).children)) {
          return ((no as MdastParent).children as RootContent[]).flatMap(converterBloco);
        }
        return [];
    }
  }

  // -------------------------------------------------------------------------
  // Aninhamento de seções
  // -------------------------------------------------------------------------

  interface SecaoAberta {
    readonly depth: number;
    readonly titulo: InlineNode[];
    readonly filhos: BlockNode[];
    readonly origem: MdastNode;
    readonly identifier?: string;
  }

  const raiz: BlockNode[] = [];
  const pilha: SecaoAberta[] = [];

  const destinoAtual = (): BlockNode[] => pilha[pilha.length - 1]?.filhos ?? raiz;
  const identifierParagraph = (node: Extract<RootContent, { type: 'paragraph' }>): string | undefined => {
    const relevant = node.children.filter((child) => child.type !== 'text' || child.value.trim() !== '');
    const value = relevant.length === 1 && relevant[0]?.type === 'text' ? relevant[0].value : undefined;
    return value === undefined ? undefined : /^\s*\{#([^{}\s]+)\}\s*$/u.exec(value)?.[1];
  };

  /**
   * mdast entrega `[h1, p, h2, p, h1]`; o modelo quer uma árvore.
   * Um heading de profundidade d fecha toda seção aberta com profundidade >= d.
   */
  const fecharAte = (profundidade: number): void => {
    while (pilha.length > 0 && (pilha[pilha.length - 1] as SecaoAberta).depth >= profundidade) {
      const aberta = pilha.pop() as SecaoAberta;
      const secao: SectionNode = comSource(
        {
          id: ids.proximo(),
          type: 'section' as const,
          depth: aberta.depth,
          title: aberta.titulo,
          children: aberta.filhos,
          ...(aberta.identifier === undefined ? {} : { attributes: { identifier: aberta.identifier } }),
        },
        aberta.origem,
      );
      destinoAtual().push(secao);
    }
  };

  let legendaPendente: { readonly caption: Caption; readonly fallback: readonly BlockNode[] } | undefined;

  for (const no of fromMarkdown(corpo, {
    extensions: [gfm(), math()],
    mdastExtensions: [gfmFromMarkdown(), mathFromMarkdown()],
  }).children) {
    if (no.type === 'heading') {
      if (legendaPendente !== undefined) {
        destinoAtual().push(...legendaPendente.fallback);
        legendaPendente = undefined;
      }
      fecharAte(no.depth);
      const last = no.children.at(-1);
      const suffix = last !== undefined && last.type === 'text' ? /\s*\{#([^{}\s]+)\}\s*$/u.exec(last.value) : null;
      const children = suffix === null || last === undefined || last.type !== 'text' ? no.children : [...no.children.slice(0, -1), { ...last, value: last.value.slice(0, suffix.index).trimEnd() }];
      pilha.push({ depth: no.depth, titulo: inline(children), filhos: [], origem: no, ...(suffix === null ? {} : { identifier: suffix[1] }) });
      continue;
    }
    if (no.type === 'paragraph') {
      const identifier = identifierParagraph(no);
      const destinoDoIdentificador = destinoAtual();
      const anteriorComId = destinoDoIdentificador[destinoDoIdentificador.length - 1];
      if (identifier !== undefined && (anteriorComId?.type === 'figure' || anteriorComId?.type === 'table' || anteriorComId?.type === 'math-block' || anteriorComId?.type === 'code-block')) {
        destinoDoIdentificador[destinoDoIdentificador.length - 1] = { ...anteriorComId, attributes: { ...(anteriorComId.attributes ?? {}), identifier } };
        continue;
      }
      const caption = legendaDoParagrafo(no);
      if (caption !== undefined) {
        if (legendaPendente !== undefined) destinoAtual().push(...legendaPendente.fallback);
        legendaPendente = { caption, fallback: converterBloco(no) };
        continue;
      }
      const attribution = fonteDoParagrafo(no);
      const destino = destinoAtual();
      const anterior = destino[destino.length - 1];
      if (attribution !== undefined && (anterior?.type === 'figure' || anterior?.type === 'table')) {
        destino[destino.length - 1] = { ...anterior, attribution };
        continue;
      }
    }
    const blocks = converterBloco(no);
    if (legendaPendente !== undefined) {
      const first = blocks[0];
      if (
        blocks.length === 1 &&
        (first?.type === 'figure' || first?.type === 'table' || first?.type === 'code-block' || first?.type === 'math-block')
      ) {
        destinoAtual().push({ ...first, caption: legendaPendente.caption });
        legendaPendente = undefined;
        continue;
      }
      destinoAtual().push(...legendaPendente.fallback);
      legendaPendente = undefined;
    }
    destinoAtual().push(...blocks);
  }

  if (legendaPendente !== undefined) destinoAtual().push(...legendaPendente.fallback);

  fecharAte(1);

  return {
    schema: 'document-ast',
    version: 1,
    documentId,
    document: {
      id: ids.proximo(),
      type: 'document',
      metadata: metadadosDeFrontmatter(dados),
      children: raiz,
    },
    references: {} as Registry<never>,
    resources: recursos,
    notes: notas,
  };
}

/**
 * Variante usada pelo pipeline: preserva a API simples de `parseMarkdown`, mas
 * também torna problemas recuperáveis da linguagem observáveis pelo usuário.
 *
 * A extração é repetida hoje para não contaminar a função central com estado
 * mutável. É um custo linear pequeno e explícito; quando o parser incremental
 * chegar, ambas as APIs passarão a compartilhar o mesmo snapshot sintático.
 */
export function parseMarkdownComDiagnosticos(
  fonte: string,
  opcoes: OpcoesDeParse = {},
): ResultadoDoParse {
  const ast = parseMarkdown(fonte, opcoes);
  const { problema } = extrairFrontmatter(fonte);
  if (problema === undefined) return { ast, diagnostics: [] };

  const documentId = asDocumentId(opcoes.documentId ?? 'documento');
  const linhas = new IndiceDeLinhas(fonte);
  const fim = Math.min(problema.offset + 3, fonte.length);

  return {
    ast,
    diagnostics: [
      {
        id: 'MD-FRONTMATTER-INVALIDO',
        severity: 'warning',
        message: problema.mensagem,
        source: {
          documentId,
          start: { offset: problema.offset, ...linhas.posicaoDe(problema.offset) },
          end: { offset: fim, ...linhas.posicaoDe(fim) },
        },
      },
    ],
  };
}
