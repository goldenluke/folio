import type {
  PublicationBlock,
  PublicationInline,
  PublicationProfile,
  StyleTokenRegistry,
  TokensDoProfile,
  UtilitariosDoProfile,
} from '@abnt/publication';
import { compararReferencias, formatarReferenciaAbnt } from '@abnt/bibliography';
import type { ResolvedDocument } from '@abnt/semantics';

import { motorAutorDataAbnt, motorNumericoAbnt } from './citacoes.js';

/**
 * Profile de artigo científico ABNT.
 *
 * AVISO DE ESCOPO — leia antes de confiar na saída.
 *
 * Implementa o esqueleto de apresentação (página, margens, corpo, numeração
 * progressiva, títulos, legendas, notas) e NÃO é conformidade ABNT completa.
 * O catálogo inicial de validação normativa vive em `abnt/validation.ts`.
 * O recorte implementado e as limitações atuais estão documentados em
 * docs/ABNT.md; o profile não substitui revisão editorial institucional.
 * Citações e referências centrais são
 * formatadas pelo motor próprio do M2, sem processador CSL em runtime.
 *
 * Sobre direito autoral: as normas ABNT são vendidas pela própria ABNT e o
 * texto delas é protegido. Aqui codificamos *regras* e citamos a cláusula por
 * número; nunca copiamos o texto normativo para o repositório. Ver
 * docs/ABNT.md.
 *
 * Medidas de página conforme a prática consolidada de apresentação gráfica
 * (NBR 14724, aplicada a artigo por remissão da NBR 6022).
 */

const SERIF = '"Times New Roman", Times, serif';
const MONO = '"Courier New", Courier, monospace';

const ESTILOS: StyleTokenRegistry = {
  // Corpo: 12, entrelinhas 1,5, justificado, recuo de primeira linha 1,25 cm.
  body: {
    fontFamily: SERIF,
    fontSize: '12pt',
    lineHeight: 1.5,
    textAlign: 'justify',
    textIndent: '1.25cm',
    marginTop: '0',
    marginBottom: '0',
  },

  // Seção primária: caixa alta, negrito, alinhada à esquerda.
  'heading-1': {
    fontFamily: SERIF,
    fontSize: '12pt',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    lineHeight: 1.5,
    textAlign: 'left',
    marginTop: '1.5em',
    marginBottom: '0.5em',
  },
  'heading-2': {
    fontFamily: SERIF,
    fontSize: '12pt',
    fontWeight: 'bold',
    lineHeight: 1.5,
    textAlign: 'left',
    marginTop: '1.2em',
    marginBottom: '0.4em',
  },
  'heading-3': {
    fontFamily: SERIF,
    fontSize: '12pt',
    fontWeight: 'normal',
    lineHeight: 1.5,
    textAlign: 'left',
    marginTop: '1em',
    marginBottom: '0.3em',
  },

  // Elementos pré-textuais: token de BLOCO (espaçamento externo) separado do
  // token de LINHA (tipografia). Espaçamento aplicado em cada linha se
  // multiplicaria pelo número de linhas — com dois autores abriria um vão.
  'doc-title': { marginBottom: '2em' },
  'doc-title-line': {
    fontFamily: SERIF,
    fontSize: '14pt',
    fontWeight: 'bold',
    textAlign: 'center',
    textTransform: 'uppercase',
    lineHeight: 1.5,
  },

  'doc-authors': { marginBottom: '2em' },
  'doc-authors-line': {
    fontFamily: SERIF,
    fontSize: '12pt',
    textAlign: 'right',
    lineHeight: 1.5,
  },

  // Resumo: parágrafo único, sem recuo, espaçamento simples (NBR 6028).
  abstract: { marginBottom: '1em' },
  'abstract-line': {
    fontFamily: SERIF,
    fontSize: '12pt',
    lineHeight: 1,
    textAlign: 'justify',
    textIndent: '0',
  },

  keywords: { marginBottom: '2em' },
  'keywords-line': {
    fontFamily: SERIF,
    fontSize: '12pt',
    lineHeight: 1,
    textIndent: '0',
  },

  // Citação com mais de três linhas: recuo de 4 cm da margem esquerda, corpo
  // menor, espaçamento simples, sem aspas (NBR 10520).
  'quote-long': {
    fontFamily: SERIF,
    fontSize: '10pt',
    lineHeight: 1,
    marginLeft: '4cm',
    textAlign: 'justify',
    textIndent: '0',
    marginTop: '1em',
    marginBottom: '1em',
  },

  list: { fontFamily: SERIF, fontSize: '12pt', lineHeight: 1.5, marginBottom: '1em' },
  'list-item': { fontFamily: SERIF, fontSize: '12pt', lineHeight: 1.5, textIndent: '0' },

  figure: { textAlign: 'center', marginTop: '1em', marginBottom: '1em' },
  table: { marginTop: '1em', marginBottom: '1em' },

  code: {
    fontFamily: MONO,
    fontSize: '10pt',
    lineHeight: 1.2,
    whiteSpace: 'pre-wrap',
    textIndent: '0',
    marginTop: '0.5em',
    marginBottom: '0.5em',
  },
  equation: { textAlign: 'center', marginTop: '1em', marginBottom: '1em', textIndent: '0' },
  separator: { marginTop: '1em', marginBottom: '1em' },

  // Legenda acima do elemento, fonte abaixo; ambas em corpo menor e centradas.
  caption: {
    fontFamily: SERIF,
    fontSize: '10pt',
    lineHeight: 1,
    textAlign: 'center',
    textIndent: '0',
    marginBottom: '0.3em',
  },
  source: {
    fontFamily: SERIF,
    fontSize: '10pt',
    lineHeight: 1,
    textAlign: 'center',
    textIndent: '0',
    marginTop: '0.3em',
  },

  // Nota de rodapé: corpo menor, espaçamento simples, sem recuo (NBR 14724).
  note: {
    fontFamily: SERIF,
    fontSize: '10pt',
    lineHeight: 1,
    textAlign: 'justify',
    textIndent: '0',
  },

  reference: {
    fontFamily: SERIF,
    fontSize: '12pt',
    lineHeight: 1,
    textAlign: 'left',
    textIndent: '0',
    marginBottom: '1em',
  },
};

const TOKENS: TokensDoProfile = {
  paragrafo: 'body',
  citacaoEmBloco: 'quote-long',
  lista: 'list',
  itemDeLista: 'list-item',
  figura: 'figure',
  tabela: 'table',
  codigo: 'code',
  equacao: 'equation',
  separador: 'separator',
  legenda: 'caption',
  fonte: 'source',
  nota: 'note',
  referencia: 'reference',
};

/** Seções sem indicativo numérico (NBR 6024 — elementos sem numeração). */
const SEM_NUMERACAO: ReadonlySet<string> = new Set([
  'doc:abstract',
  'doc:acknowledgements',
  'academic:references',
  'abnt:resumo',
  'abnt:agradecimentos',
  'abnt:referencias',
]);

/** Rótulo por tipo de elemento. "Quadro" permanece como extensão do M4. */
const ROTULO = {
  figure: 'Figura',
  table: 'Tabela',
  equation: 'Equação',
  code: 'Código',
} as const;

function elementosPreTextuais(
  doc: ResolvedDocument,
  utils: UtilitariosDoProfile,
): PublicationBlock[] {
  const { metadata } = doc.ast.document;
  const blocos: PublicationBlock[] = [];

  if (metadata.title !== undefined) {
    blocos.push({
      type: 'front-matter',
      role: 'doc:title',
      style: 'doc-title',
      children: [
        { type: 'paragraph', style: 'doc-title-line', children: utils.inline(metadata.title) },
      ],
    });
  }

  if (metadata.contributors !== undefined && metadata.contributors.length > 0) {
    const linhas = metadata.contributors.map((c) => {
      const nome =
        c.name.literal ?? [...(c.name.given ?? []), ...(c.name.family ?? [])].join(' ').trim();
      return c.affiliation !== undefined ? `${nome} — ${c.affiliation}` : nome;
    });

    blocos.push({
      type: 'front-matter',
      role: 'doc:authors',
      style: 'doc-authors',
      children: linhas.map((linha) => ({
        type: 'paragraph' as const,
        style: 'doc-authors-line',
        children: [{ type: 'text' as const, value: linha }],
      })),
    });
  }

  if (metadata.abstract !== undefined && metadata.abstract.length > 0) {
    // Reestiliza os parágrafos do resumo com o token de resumo: o conversor
    // genérico os marcaria como corpo, que tem recuo e entrelinhas 1,5.
    const paragrafos = utils.blocos(metadata.abstract).map((b) =>
      b.type === 'paragraph' ? { ...b, style: 'abstract-line' } : b,
    );

    blocos.push({
      type: 'front-matter',
      role: 'doc:abstract',
      style: 'abstract',
      label: 'Resumo',
      children: paragrafos,
    });
  }

  if (metadata.keywords !== undefined && metadata.keywords.length > 0) {
    // NBR 6028: palavras-chave separadas por ponto e encerradas por ponto.
    const lista = `${metadata.keywords.join('. ')}.`;
    blocos.push({
      type: 'front-matter',
      role: 'doc:keywords',
      style: 'keywords',
      label: 'Palavras-chave',
      children: [
        { type: 'paragraph', style: 'keywords-line', children: [{ type: 'text', value: lista }] },
      ],
    });
  }

  return blocos;
}

function elementosPosTextuais(
  doc: ResolvedDocument,
  numeric: boolean,
): PublicationBlock[] {
  const references = doc.citations.citedReferenceIds
    .map((id) => doc.bibliography[id])
    .filter((item): item is NonNullable<typeof item> => item !== undefined);

  if (!numeric) references.sort(compararReferencias);
  if (references.length === 0) return [];

  return [
    {
      type: 'heading',
      level: 1,
      style: 'heading-1',
      children: [{ type: 'text', value: 'Referências' }],
    },
    ...references.map((reference) => {
      const prefix = numeric
        ? `${doc.citations.numberByReference.get(reference.id) ?? '?'}. `
        : '';
      const children: PublicationInline[] = [{ type: 'text', value: prefix }];
      for (const trecho of formatarReferenciaAbnt(reference)) {
        const text = { type: 'text' as const, value: trecho.text };
        children.push(
          trecho.style !== undefined ? { type: trecho.style, children: [text] } : text,
        );
      }
      return { type: 'paragraph' as const, style: 'reference', children };
    }),
  ];
}

export const perfilArtigoAbnt: PublicationProfile = {
  id: 'abnt:artigo@6022-2018',

  page: {
    size: 'A4',
    // Superior e esquerda 3 cm; inferior e direita 2 cm.
    margin: { top: '3cm', right: '2cm', bottom: '2cm', left: '3cm' },
    pageNumber: 'top-right',
  },

  styles: ESTILOS,
  tokens: TOKENS,
  secoesSemNumeracao: SEM_NUMERACAO,

  frontMatter: elementosPreTextuais,
  backMatter: (doc) => elementosPosTextuais(doc, false),
  motorDeCitacao: motorAutorDataAbnt,

  estiloDeTitulo: (nivel) => (nivel <= 1 ? 'heading-1' : nivel === 2 ? 'heading-2' : 'heading-3'),

  /** ABNT: "Figura 1 — Texto", acima do elemento; fonte vai abaixo. */
  formatarLegenda: (tipo, numero, texto) => {
    const conteudo: PublicationInline[] = [];
    if (numero !== undefined) {
      const separador = texto.length > 0 ? ' — ' : '';
      conteudo.push({ type: 'text', value: `${ROTULO[tipo]} ${numero}${separador}` });
    }
    conteudo.push(...texto);
    return { conteudo, position: 'above' };
  },
};

/** Variante do mesmo profile com sistema numérico da NBR 10520:2023. */
export const perfilArtigoAbntNumerico: PublicationProfile = {
  ...perfilArtigoAbnt,
  id: 'abnt:artigo@6022-2018/numerico',
  backMatter: (doc) => elementosPosTextuais(doc, true),
  motorDeCitacao: motorNumericoAbnt,
};
