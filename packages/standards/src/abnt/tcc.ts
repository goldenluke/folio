import {
  percorrer,
  type BlockNode,
  type CodeBlockNode,
  type Contributor,
  type FigureNode,
  type JsonValue,
  type TableNode,
} from '@abnt/document-model';
import type {
  PublicationBlock,
  PublicationProfile,
  PublicationToc,
  StyleTokenRegistry,
  UtilitariosDoProfile,
} from '@abnt/publication';
import {
  NUMERO_DA_FIGURA,
  NUMERO_DA_SECAO,
  NUMERO_DA_TABELA,
  NUMERO_DO_CODIGO,
  type ResolvedDocument,
} from '@abnt/semantics';

import { perfilArtigoAbnt } from './artigo.js';

const SERIF = '"Times New Roman", Times, serif';

const ESTILOS: StyleTokenRegistry = {
  ...perfilArtigoAbnt.styles,
  // O corpo usa a página padrão. Nomear apenas os headings faria o Paged.js
  // alternar entre `main` e a página padrão a cada parágrafo, criando uma
  // quebra artificial entre o título da seção e seu conteúdo.
  'tcc-heading-1': { ...perfilArtigoAbnt.styles['heading-1'] },
  'tcc-heading-2': { ...perfilArtigoAbnt.styles['heading-2'] },
  'tcc-heading-3': { ...perfilArtigoAbnt.styles['heading-3'] },
  // O back matter compartilhado com o artigo usa estes nomes de token.
  'heading-1': {
    ...perfilArtigoAbnt.styles['heading-1'],
  },
  'tcc-cover': {
    pageName: 'preliminary',
    // O Paged.js transforma este reset declarativo no contador da primeira
    // folha; as folhas seguintes passam a contar a partir da folha de rosto.
    counterReset: 'page 0',
    minHeight: '23cm',
    fontFamily: SERIF,
    fontSize: '12pt',
    textAlign: 'center',
  },
  'tcc-pre-page': {
    pageName: 'preliminary',
    pageBreakBefore: true,
    fontFamily: SERIF,
    fontSize: '12pt',
  },
  'tcc-page-title': {
    fontFamily: SERIF,
    fontSize: '12pt',
    fontWeight: 'bold',
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: '2em',
  },
  'tcc-center': {
    fontFamily: SERIF,
    fontSize: '12pt',
    lineHeight: 1.5,
    textAlign: 'center',
    whiteSpace: 'pre-wrap',
  },
  'tcc-cover-author': {
    fontFamily: SERIF,
    fontSize: '12pt',
    textAlign: 'center',
    textTransform: 'uppercase',
    marginTop: '4cm',
  },
  'tcc-cover-title': {
    fontFamily: SERIF,
    fontSize: '12pt',
    fontWeight: 'bold',
    textAlign: 'center',
    textTransform: 'uppercase',
    marginTop: '6cm',
  },
  'tcc-cover-place': {
    fontFamily: SERIF,
    fontSize: '12pt',
    textAlign: 'center',
    marginTop: '6cm',
    whiteSpace: 'pre-wrap',
  },
  'tcc-nature': {
    fontFamily: SERIF,
    fontSize: '10pt',
    lineHeight: 1,
    textAlign: 'justify',
    marginLeft: '8cm',
    marginTop: '3cm',
  },
  'tcc-catalog-card': {
    fontFamily: SERIF,
    fontSize: '10pt',
    lineHeight: 1,
    textAlign: 'left',
    whiteSpace: 'pre-wrap',
    border: '0.75pt solid #000',
    padding: '1cm',
    marginTop: '7cm',
  },
  'tcc-right-lower': {
    fontFamily: SERIF,
    fontSize: '12pt',
    lineHeight: 1.5,
    textAlign: 'right',
    marginLeft: '8cm',
    marginTop: '12cm',
    whiteSpace: 'pre-wrap',
  },
  'tcc-epigraph': {
    fontFamily: SERIF,
    fontSize: '12pt',
    fontStyle: 'italic',
    lineHeight: 1.5,
    textAlign: 'right',
    marginLeft: '8cm',
    marginTop: '11cm',
    whiteSpace: 'pre-wrap',
  },
  'tcc-pre-body': {
    fontFamily: SERIF,
    fontSize: '12pt',
    lineHeight: 1.5,
    textAlign: 'justify',
    textIndent: '1.25cm',
    whiteSpace: 'pre-wrap',
  },
  'tcc-abstract': {
    fontFamily: SERIF,
    fontSize: '12pt',
    lineHeight: 1,
    textAlign: 'justify',
    textIndent: '0',
  },
  'tcc-list-line': {
    fontFamily: SERIF,
    fontSize: '12pt',
    lineHeight: 1.5,
    textAlign: 'left',
    whiteSpace: 'pre-wrap',
  },
  'tcc-toc': {
    pageName: 'preliminary',
    pageBreakBefore: true,
    // Além de separar listas consecutivas, cobre a transição de uma lista
    // gerada (<nav>) para um elemento pré-textual comum (<section>), caso em
    // que alguns paginadores não honram apenas o break-before do sucessor.
    pageBreakAfter: true,
    fontFamily: SERIF,
    fontSize: '12pt',
    lineHeight: 1.5,
  },
};

const property = (doc: ResolvedDocument, key: string): JsonValue | undefined =>
  doc.ast.document.metadata.properties?.[key];

const textProperty = (doc: ResolvedDocument, key: string): string | undefined => {
  const value = property(doc, key);
  if (typeof value === 'string' && value.trim() !== '') return value.trim();
  if (typeof value === 'number') return String(value);
  return undefined;
};

const nameOf = (contributor: Contributor): string =>
  contributor.name.literal ??
  [...(contributor.name.given ?? []), ...(contributor.name.family ?? [])].join(' ').trim();

const contributorsByRole = (doc: ResolvedDocument, role: Contributor['role']): Contributor[] =>
  (doc.ast.document.metadata.contributors ?? []).filter((contributor) => contributor.role === role);

const line = (value: string, style = 'tcc-center'): PublicationBlock => ({
  type: 'paragraph',
  style,
  children: [{ type: 'text', value }],
});

const page = (
  role: string,
  children: readonly PublicationBlock[],
  style = 'tcc-pre-page',
): PublicationBlock => ({ type: 'front-matter', role, style, children });

function cover(doc: ResolvedDocument, utils: UtilitariosDoProfile): PublicationBlock {
  const metadata = doc.ast.document.metadata;
  const institution = textProperty(doc, 'tcc:institution') ?? '';
  const authors = contributorsByRole(doc, 'author').map(nameOf).join('\n');
  const place = textProperty(doc, 'tcc:place') ?? '';
  const year = textProperty(doc, 'tcc:year') ?? '';
  return page(
    'tcc:cover',
    [
      line(institution, 'tcc-center'),
      line(authors, 'tcc-cover-author'),
      {
        type: 'paragraph',
        style: 'tcc-cover-title',
        children: utils.inline(metadata.title ?? []),
      },
      line([place, year].filter(Boolean).join('\n'), 'tcc-cover-place'),
    ],
    'tcc-cover',
  );
}

function titlePage(doc: ResolvedDocument, utils: UtilitariosDoProfile): PublicationBlock {
  const metadata = doc.ast.document.metadata;
  const author = contributorsByRole(doc, 'author').map(nameOf).join('\n');
  const advisors = [
    ...contributorsByRole(doc, 'advisor').map((item) => `Orientador: ${nameOf(item)}`),
    ...contributorsByRole(doc, 'coadvisor').map((item) => `Coorientador: ${nameOf(item)}`),
  ];
  const place = textProperty(doc, 'tcc:place') ?? '';
  const year = textProperty(doc, 'tcc:year') ?? '';
  return page('tcc:title-page', [
    line(author, 'tcc-center'),
    {
      type: 'paragraph',
      style: 'tcc-cover-title',
      children: utils.inline(metadata.title ?? []),
    },
    line(
      [textProperty(doc, 'tcc:nature'), ...advisors].filter(Boolean).join('\n\n'),
      'tcc-nature',
    ),
    line([place, year].filter(Boolean).join('\n'), 'tcc-cover-place'),
  ]);
}

function catalogCard(doc: ResolvedDocument): PublicationBlock | undefined {
  const value = textProperty(doc, 'tcc:catalog-card');
  return value === undefined
    ? undefined
    : page('tcc:catalog-card', [line('Ficha catalográfica', 'tcc-page-title'), line(value, 'tcc-catalog-card')]);
}

function approvalSheet(doc: ResolvedDocument, utils: UtilitariosDoProfile): PublicationBlock {
  const author = contributorsByRole(doc, 'author').map(nameOf).join('\n');
  const board = [
    ...contributorsByRole(doc, 'advisor').map((item) => `${nameOf(item)} — Orientador(a)`),
    ...contributorsByRole(doc, 'coadvisor').map((item) => `${nameOf(item)} — Coorientador(a)`),
    ...contributorsByRole(doc, 'reviewer').map((item) => `${nameOf(item)} — Avaliador(a)`),
  ];
  return page('tcc:approval-sheet', [
    line(author, 'tcc-center'),
    {
      type: 'paragraph',
      style: 'tcc-cover-title',
      children: utils.inline(doc.ast.document.metadata.title ?? []),
    },
    line(textProperty(doc, 'tcc:nature') ?? '', 'tcc-nature'),
    line(`Aprovado em: ${textProperty(doc, 'tcc:approval-date') ?? ''}`, 'tcc-pre-body'),
    line(['Banca examinadora', ...board].join('\n\n'), 'tcc-center'),
  ]);
}

function optionalTextPage(
  doc: ResolvedDocument,
  key: string,
  role: string,
  title: string | undefined,
  style: string,
): PublicationBlock | undefined {
  const value = textProperty(doc, key);
  if (value === undefined) return undefined;
  return page(role, [
    ...(title === undefined ? [] : [line(title, 'tcc-page-title')]),
    line(value, style),
  ]);
}

function abstractPage(
  doc: ResolvedDocument,
  utils: UtilitariosDoProfile,
  english: boolean,
): PublicationBlock | undefined {
  const blocks: readonly BlockNode[] | undefined = english
    ? undefined
    : doc.ast.document.metadata.abstract;
  const raw = english ? textProperty(doc, 'tcc:abstract-en') : undefined;
  if ((blocks === undefined || blocks.length === 0) && raw === undefined) return undefined;
  const keywords = english
    ? property(doc, 'tcc:keywords-en')
    : doc.ast.document.metadata.keywords;
  const keywordValues = Array.isArray(keywords)
    ? keywords.filter((value): value is string => typeof value === 'string')
    : [];
  const content = raw === undefined
    ? utils.blocos(blocks ?? []).map((block) =>
        block.type === 'paragraph' ? { ...block, style: 'tcc-abstract' } : block,
      )
    : [line(raw, 'tcc-abstract')];
  return page(english ? 'tcc:abstract-en' : 'tcc:abstract-pt', [
    line(english ? 'Abstract' : 'Resumo', 'tcc-page-title'),
    ...content,
    ...(keywordValues.length === 0
      ? []
      : [
          line(
            `${english ? 'Keywords' : 'Palavras-chave'}: ${keywordValues.join('. ')}.`,
            'tcc-abstract',
          ),
        ]),
  ]);
}

function propertyListPage(
  doc: ResolvedDocument,
  key: string,
  role: string,
  title: string,
): PublicationBlock | undefined {
  const values = property(doc, key);
  if (!Array.isArray(values) || values.length === 0) return undefined;
  const rows = values.flatMap((value) => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return [];
    const term = value['term'];
    const definition = value['definition'];
    return typeof term === 'string' && typeof definition === 'string'
      ? [`${term} — ${definition}`]
      : [];
  });
  if (rows.length === 0) return undefined;
  return page(role, [line(title, 'tcc-page-title'), ...rows.map((row) => line(row, 'tcc-list-line'))]);
}

function elementList(
  doc: ResolvedDocument,
  utils: UtilitariosDoProfile,
  kind: 'figure' | 'table' | 'code-block',
  title: string,
): PublicationToc | undefined {
  type ListedNode = FigureNode | TableNode | CodeBlockNode;
  const config =
    kind === 'figure'
      ? { annotation: NUMERO_DA_FIGURA, label: 'Figura' }
      : kind === 'table'
        ? { annotation: NUMERO_DA_TABELA, label: 'Tabela' }
        : { annotation: NUMERO_DO_CODIGO, label: 'Código' };
  const entries = [...percorrer(doc.ast)]
    .filter((node): node is ListedNode => node.type === kind)
    .flatMap((node) => {
      const number = doc.annotations.getString(node.id, config.annotation);
      if (number === undefined) return [];
      return [
        {
          level: 1,
          target: String(node.id),
          children: [
            { type: 'text' as const, value: `${config.label} ${number} — ` },
            ...utils.inline(node.caption?.short ?? []),
          ],
        },
      ];
    });
  return entries.length === 0
    ? undefined
    : { type: 'toc', style: 'tcc-toc', title: [{ type: 'text', value: title }], entries };
}

function tableOfContents(
  doc: ResolvedDocument,
  utils: UtilitariosDoProfile,
): PublicationToc {
  const entries: PublicationToc['entries'][number][] = [];
  const visit = (nodes: readonly BlockNode[], level: number): void => {
    for (const node of nodes) {
      if (node.type !== 'section') continue;
      const number = doc.annotations.getString(node.id, NUMERO_DA_SECAO);
      if (number !== undefined) {
        entries.push({
          level,
          target: String(node.id),
          children: [
            { type: 'text', value: `${number} ` },
            ...utils.inline(node.title ?? []),
          ],
        });
      }
      visit(node.children, level + 1);
    }
  };
  visit(doc.ast.document.children, 1);
  return { type: 'toc', style: 'tcc-toc', title: [{ type: 'text', value: 'Sumário' }], entries };
}

function frontMatter(doc: ResolvedDocument, utils: UtilitariosDoProfile): readonly PublicationBlock[] {
  const blocks: Array<PublicationBlock | undefined> = [
    cover(doc, utils),
    titlePage(doc, utils),
    catalogCard(doc),
    approvalSheet(doc, utils),
    optionalTextPage(doc, 'tcc:dedication', 'tcc:dedication', undefined, 'tcc-right-lower'),
    optionalTextPage(doc, 'tcc:acknowledgements', 'tcc:acknowledgements', 'Agradecimentos', 'tcc-pre-body'),
    optionalTextPage(
      doc,
      'tcc:epigraph',
      'tcc:epigraph',
      undefined,
      'tcc-epigraph',
    ),
    abstractPage(doc, utils, false),
    abstractPage(doc, utils, true),
    elementList(doc, utils, 'figure', 'Lista de ilustrações'),
    elementList(doc, utils, 'table', 'Lista de tabelas'),
    elementList(doc, utils, 'code-block', 'Lista de códigos'),
    propertyListPage(doc, 'tcc:abbreviations', 'tcc:abbreviations', 'Lista de abreviaturas e siglas'),
    propertyListPage(doc, 'tcc:symbols', 'tcc:symbols', 'Lista de símbolos'),
    tableOfContents(doc, utils),
  ];
  return blocks.filter((block): block is PublicationBlock => block !== undefined);
}

/** Profile de trabalho acadêmico, sem introduzir qualquer nó específico na AST. */
export const perfilTccAbnt: PublicationProfile = {
  ...perfilArtigoAbnt,
  id: 'abnt:tcc@14724-2011',
  page: {
    size: 'A4',
    margin: { top: '3cm', right: '2cm', bottom: '2cm', left: '3cm' },
    pageNumber: 'top-right',
    variants: {
      preliminary: { pageNumber: 'none' },
      main: { pageNumber: 'top-right' },
    },
  },
  styles: ESTILOS,
  tokens: perfilArtigoAbnt.tokens,
  frontMatter,
  ...(perfilArtigoAbnt.backMatter !== undefined
    ? { backMatter: perfilArtigoAbnt.backMatter }
    : {}),
  estiloDeTitulo: (level) =>
    level <= 1 ? 'tcc-heading-1' : level === 2 ? 'tcc-heading-2' : 'tcc-heading-3',
};
