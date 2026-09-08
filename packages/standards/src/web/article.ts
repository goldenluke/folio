import type {
  BibliographicEntity,
  CitationItem,
  CitationNode,
} from '@abnt/document-model';
import type {
  MotorDeCitacao,
  PublicationBlock,
  PublicationProfile,
  StyleTokenRegistry,
  TokensDoProfile,
  UtilitariosDoProfile,
} from '@abnt/publication';
import type { ResolvedDocument } from '@abnt/semantics';

const SANS = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

const ESTILOS: StyleTokenRegistry = {
  'web-body': {
    fontFamily: SANS,
    fontSize: '11pt',
    lineHeight: 1.65,
    textAlign: 'left',
    marginBottom: '0.85em',
  },
  'web-heading-1': {
    fontFamily: SANS,
    fontSize: '22pt',
    fontWeight: 'bold',
    lineHeight: 1.15,
    marginTop: '1.8em',
    marginBottom: '0.45em',
  },
  'web-heading-2': {
    fontFamily: SANS,
    fontSize: '15pt',
    fontWeight: 'bold',
    lineHeight: 1.2,
    marginTop: '1.5em',
    marginBottom: '0.35em',
  },
  'web-heading-3': {
    fontFamily: SANS,
    fontSize: '12pt',
    fontWeight: 'bold',
    lineHeight: 1.3,
    marginTop: '1.2em',
    marginBottom: '0.25em',
  },
  'web-title': { marginBottom: '0.6em' },
  'web-title-line': {
    fontFamily: SANS,
    fontSize: '30pt',
    fontWeight: 'bold',
    lineHeight: 1.08,
    textAlign: 'left',
  },
  'web-authors': { marginBottom: '1.6em' },
  'web-authors-line': { fontFamily: SANS, fontSize: '10pt', lineHeight: 1.4, textAlign: 'left' },
  'web-abstract': { marginBottom: '1.1em', border: '1px solid #d9dde5' },
  'web-abstract-line': {
    fontFamily: SANS,
    fontSize: '10.5pt',
    lineHeight: 1.5,
    textAlign: 'left',
  },
  'web-keywords': { marginBottom: '1.7em' },
  'web-keywords-line': { fontFamily: SANS, fontSize: '10pt', lineHeight: 1.4, textAlign: 'left' },
  'web-quote': {
    fontFamily: SANS,
    fontSize: '10.5pt',
    lineHeight: 1.55,
    marginLeft: '1.2cm',
    marginTop: '1em',
    marginBottom: '1em',
    border: '0 0 0 3px solid #4569a8',
  },
  'web-list': { fontFamily: SANS, fontSize: '11pt', lineHeight: 1.55, marginBottom: '0.8em' },
  'web-list-item': { fontFamily: SANS, fontSize: '11pt', lineHeight: 1.55 },
  'web-figure': { textAlign: 'center', marginTop: '1.2em', marginBottom: '1.2em' },
  'web-table': { marginTop: '1.2em', marginBottom: '1.2em' },
  'web-code': {
    fontFamily: MONO,
    fontSize: '9pt',
    lineHeight: 1.45,
    whiteSpace: 'pre-wrap',
    marginTop: '1em',
    marginBottom: '1em',
    border: '1px solid #d9dde5',
  },
  'web-equation': { textAlign: 'center', marginTop: '1em', marginBottom: '1em' },
  'web-separator': { marginTop: '1.5em', marginBottom: '1.5em' },
  'web-caption': { fontFamily: SANS, fontSize: '9pt', lineHeight: 1.4, textAlign: 'left' },
  'web-source': { fontFamily: SANS, fontSize: '9pt', lineHeight: 1.4, textAlign: 'left' },
  'web-note': { fontFamily: SANS, fontSize: '8.5pt', lineHeight: 1.35, textAlign: 'left' },
  'web-reference': {
    fontFamily: SANS,
    fontSize: '10pt',
    lineHeight: 1.45,
    textAlign: 'left',
    marginBottom: '0.6em',
  },
};

const TOKENS: TokensDoProfile = {
  paragrafo: 'web-body',
  citacaoEmBloco: 'web-quote',
  lista: 'web-list',
  itemDeLista: 'web-list-item',
  figura: 'web-figure',
  tabela: 'web-table',
  codigo: 'web-code',
  equacao: 'web-equation',
  separador: 'web-separator',
  legenda: 'web-caption',
  fonte: 'web-source',
  nota: 'web-note',
  referencia: 'web-reference',
};

const nome = (entry: BibliographicEntity | undefined): string => {
  const first = entry?.author?.[0];
  return first?.literal ?? first?.family ?? entry?.title ?? 'Fonte sem autor';
};

const ano = (entry: BibliographicEntity | undefined): string => {
  const part = entry?.issued?.['date-parts']?.[0]?.[0];
  return part === undefined ? 's.d.' : String(part);
};

const decorado = (item: CitationItem, value: string): string => {
  const locator = item.locator === undefined ? '' : `, ${item.locator.value}`;
  return `${value}${locator}`;
};

const motorWeb: MotorDeCitacao = {
  id: 'web:author-date@1',
  formatar(citation: CitationNode, context) {
    const values = citation.items.map((item) => {
      const entry = context.references[item.referenceId];
      if (entry === undefined) return `[?${item.referenceId}]`;
      const author = nome(entry);
      const issued = ano(entry);
      if (citation.mode === 'author-only') return decorado(item, author);
      if (citation.mode === 'year-only') return decorado(item, issued);
      if (citation.mode === 'narrative') return decorado(item, `${author} (${issued})`);
      return decorado(item, `${author}, ${issued}`);
    });
    const text = values.join('; ');
    return {
      conteudo: [
        { type: 'text', value: citation.mode === 'parenthetical' ? `(${text})` : text },
      ],
    };
  },
};

function authors(doc: ResolvedDocument): readonly PublicationBlock[] {
  const contributors = doc.ast.document.metadata.contributors ?? [];
  if (contributors.length === 0) return [];
  return [
    {
      type: 'front-matter',
      role: 'doc:authors',
      style: 'web-authors',
      children: contributors.map((contributor) => {
        const fullName =
          contributor.name.literal ??
          [...(contributor.name.given ?? []), ...(contributor.name.family ?? [])].join(' ').trim();
        const affiliation = contributor.affiliation === undefined ? '' : ` · ${contributor.affiliation}`;
        return {
          type: 'paragraph' as const,
          style: 'web-authors-line',
          children: [{ type: 'text' as const, value: `${fullName}${affiliation}` }],
        };
      }),
    },
  ];
}

function frontMatter(doc: ResolvedDocument, utils: UtilitariosDoProfile): readonly PublicationBlock[] {
  const metadata = doc.ast.document.metadata;
  const blocks: PublicationBlock[] = [];
  if (metadata.title !== undefined) {
    blocks.push({
      type: 'front-matter',
      role: 'doc:title',
      style: 'web-title',
      children: [{ type: 'paragraph', style: 'web-title-line', children: utils.inline(metadata.title) }],
    });
  }
  blocks.push(...authors(doc));
  if (metadata.abstract !== undefined && metadata.abstract.length > 0) {
    blocks.push({
      type: 'front-matter',
      role: 'doc:abstract',
      style: 'web-abstract',
      label: 'Abstract',
      children: utils.blocos(metadata.abstract).map((block) =>
        block.type === 'paragraph' ? { ...block, style: 'web-abstract-line' } : block,
      ),
    });
  }
  if (metadata.keywords !== undefined && metadata.keywords.length > 0) {
    blocks.push({
      type: 'front-matter',
      role: 'doc:keywords',
      style: 'web-keywords',
      label: 'Topics',
      children: [
        {
          type: 'paragraph',
          style: 'web-keywords-line',
          children: [{ type: 'text', value: metadata.keywords.map((keyword) => `#${keyword}`).join(' ') }],
        },
      ],
    });
  }
  return blocks;
}

function backMatter(doc: ResolvedDocument): readonly PublicationBlock[] {
  const references = doc.citations.citedReferenceIds
    .map((id) => doc.bibliography[id])
    .filter((reference): reference is BibliographicEntity => reference !== undefined)
    .sort((left, right) => (left.title ?? left.id).localeCompare(right.title ?? right.id));
  if (references.length === 0) return [];
  return [
    {
      type: 'heading',
      level: 1,
      style: 'web-heading-1',
      children: [{ type: 'text', value: 'References' }],
    },
    ...references.map((reference) => ({
      type: 'paragraph' as const,
      style: 'web-reference',
      children: [
        { type: 'text' as const, value: `${nome(reference)} (${ano(reference)}). ` },
        { type: 'emphasis' as const, children: [{ type: 'text' as const, value: reference.title ?? reference.id }] },
        ...(reference.URL === undefined ? [] : [{ type: 'text' as const, value: `. ${reference.URL}` }]),
      ],
    })),
  ];
}

/** Segundo consumidor deliberadamente não-ABNT do mesmo modelo semântico. */
export const perfilArtigoWeb: PublicationProfile = {
  id: 'web:article@1',
  page: {
    size: 'Letter',
    margin: { top: '1.7cm', right: '1.8cm', bottom: '1.8cm', left: '1.8cm' },
    pageNumber: 'none',
  },
  styles: ESTILOS,
  tokens: TOKENS,
  mostrarNumerosDeSecao: false,
  frontMatter,
  backMatter,
  motorDeCitacao: motorWeb,
  estiloDeTitulo: (level) => (level <= 1 ? 'web-heading-1' : level === 2 ? 'web-heading-2' : 'web-heading-3'),
  formatarLegenda: (type, number, text) => ({
    conteudo: [
      ...(number === undefined
        ? []
        : [
            {
              type: 'text' as const,
              value:
                type === 'figure'
                  ? `Fig. ${number}. `
                  : type === 'table'
                    ? `Table ${number}. `
                    : type === 'code'
                      ? `Listing ${number}. `
                      : `Equation ${number}. `,
            },
          ]),
      ...text,
    ],
    position: 'below',
  }),
};
