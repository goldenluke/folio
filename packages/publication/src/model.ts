/**
 * Publication AST — o documento já decidido, ainda não desenhado.
 *
 * Aqui já pode existir apresentação: número de seção resolvido, ordem da lista
 * de referências, política de quebra de página. O que NÃO pode existir é valor
 * bruto de layout (`12pt`, `3cm`): isso vem de token resolvido pelo tema.
 *
 * A fronteira: Document AST diz "isto é uma citação longa"; Publication AST diz
 * "isto usa o token `quote-long`"; o tema diz que `quote-long` é recuo de 4 cm,
 * corpo 10, espaço simples. Trocar de instituição troca só o tema.
 */

/** Identificador de token tipográfico. O valor concreto vive no tema. */
export type StyleToken = string;

// ---------------------------------------------------------------------------
// Inline
// ---------------------------------------------------------------------------

export interface PublicationText {
  readonly type: 'text';
  readonly value: string;
}

export interface PublicationMarked {
  readonly type: 'strong' | 'emphasis' | 'strike' | 'code';
  readonly children: readonly PublicationInline[];
}

export interface PublicationLink {
  readonly type: 'link';
  readonly url: string;
  readonly children: readonly PublicationInline[];
}

export interface PublicationMath {
  readonly type: 'math';
  readonly display: boolean;
  readonly language: string;
  readonly value: string;
}

/** Chamada de nota já numerada. O conteúdo vai em `notes`. */
export interface PublicationNoteMark {
  readonly type: 'note-mark';
  readonly marker: string;
  readonly noteId: string;
}

export type PublicationInline =
  | PublicationText
  | PublicationMarked
  | PublicationLink
  | PublicationMath
  | PublicationNoteMark;

// ---------------------------------------------------------------------------
// Block
// ---------------------------------------------------------------------------

export interface PublicationParagraph {
  readonly type: 'paragraph';
  readonly style: StyleToken;
  readonly children: readonly PublicationInline[];
}

export interface PublicationHeading {
  readonly type: 'heading';
  readonly level: number;
  readonly style: StyleToken;
  /** Âncora de publicação para sumário e referências internas. */
  readonly anchor?: string;
  /** Indicativo numérico já resolvido ("2.1"). Ausente em seção sem numeração. */
  readonly number?: string;
  readonly children: readonly PublicationInline[];
}

export interface PublicationQuote {
  readonly type: 'quote';
  readonly style: StyleToken;
  readonly children: readonly PublicationBlock[];
  /** Fonte já formatada pelo motor de citação. */
  readonly attribution?: readonly PublicationInline[];
}

export interface PublicationListItem {
  readonly type: 'list-item';
  readonly style: StyleToken;
  readonly children: readonly PublicationBlock[];
}

export interface PublicationList {
  readonly type: 'list';
  readonly style: StyleToken;
  readonly ordered: boolean;
  readonly start?: number;
  readonly items: readonly PublicationListItem[];
}

/**
 * Legenda já montada: rótulo, número e texto num só lugar.
 * "Figura 1 — Arquitetura do sistema" chega pronto ao renderer.
 */
export interface PublicationCaption {
  readonly style: StyleToken;
  readonly text: readonly PublicationInline[];
  /** Posição relativa ao conteúdo. ABNT: legenda acima, fonte abaixo. */
  readonly position: 'above' | 'below';
}

export interface PublicationFigure {
  readonly type: 'figure';
  readonly style: StyleToken;
  readonly anchor?: string;
  /** URI já resolvida pelo compilador; o renderer não consulta registry. */
  readonly src: string;
  readonly alt: string;
  /** Largura autoral validada, por exemplo `65%`. */
  readonly width?: string;
  readonly caption?: PublicationCaption;
  readonly attribution?: PublicationCaption;
}

export interface PublicationTableCell {
  readonly children: readonly PublicationBlock[];
  readonly alignment?: 'left' | 'right' | 'center' | 'justify';
  readonly rowSpan?: number;
  readonly columnSpan?: number;
  readonly header: boolean;
}

export interface PublicationTableRow {
  readonly cells: readonly PublicationTableCell[];
}

export interface PublicationTable {
  readonly type: 'table';
  readonly style: StyleToken;
  readonly anchor?: string;
  readonly head: readonly PublicationTableRow[];
  readonly body: readonly PublicationTableRow[];
  readonly caption?: PublicationCaption;
  readonly attribution?: PublicationCaption;
}

export interface PublicationCode {
  readonly type: 'code';
  readonly style: StyleToken;
  readonly anchor?: string;
  readonly language?: string;
  readonly value: string;
  readonly caption?: PublicationCaption;
}

export interface PublicationMathBlock {
  readonly type: 'math-block';
  readonly style: StyleToken;
  readonly anchor?: string;
  readonly language: string;
  readonly value: string;
  readonly caption?: PublicationCaption;
}

export interface PublicationThematicBreak {
  readonly type: 'thematic-break';
  readonly style: StyleToken;
}

/**
 * Bloco de elemento pré-textual (título, autores, resumo, palavras-chave).
 * O `role` diz o que é; o tema decide como aparece.
 */
export interface PublicationFrontMatterBlock {
  readonly type: 'front-matter';
  readonly role: string;
  readonly style: StyleToken;
  readonly label?: string;
  readonly children: readonly PublicationBlock[];
}

export interface PublicationTocEntry {
  readonly level: number;
  readonly target: string;
  readonly children: readonly PublicationInline[];
}

/**
 * Lista navegável cujo número de página é resolvido pelo backend paginado.
 * Serve tanto ao sumário quanto às listas de figuras, tabelas e códigos.
 */
export interface PublicationToc {
  readonly type: 'toc';
  readonly style: StyleToken;
  readonly title: readonly PublicationInline[];
  readonly entries: readonly PublicationTocEntry[];
}

export type PublicationBlock =
  | PublicationParagraph
  | PublicationHeading
  | PublicationQuote
  | PublicationList
  | PublicationListItem
  | PublicationFigure
  | PublicationTable
  | PublicationCode
  | PublicationMathBlock
  | PublicationThematicBreak
  | PublicationFrontMatterBlock
  | PublicationToc;

// ---------------------------------------------------------------------------
// Documento
// ---------------------------------------------------------------------------

/** Nota já numerada, pronta para o renderer posicionar. */
export interface PublicationNote {
  readonly id: string;
  readonly marker: string;
  readonly kind: 'footnote' | 'endnote' | string;
  readonly style: StyleToken;
  readonly children: readonly PublicationBlock[];
}

export interface PagePolicy {
  readonly size: 'A4' | 'Letter';
  readonly margin: {
    readonly top: string;
    readonly right: string;
    readonly bottom: string;
    readonly left: string;
  };
  /** Posição do número de página. ABNT: canto superior direito. */
  readonly pageNumber?: 'top-right' | 'top-center' | 'bottom-center' | 'none';
  /** Variações nomeadas, por exemplo páginas pré-textuais sem número visível. */
  readonly variants?: {
    readonly [name: string]: {
      readonly pageNumber?: 'top-right' | 'top-center' | 'bottom-center' | 'none';
    };
  };
}

export interface StyleDefinition {
  readonly fontFamily?: string;
  readonly fontSize?: string;
  readonly lineHeight?: string | number;
  readonly fontWeight?: string;
  readonly fontStyle?: 'normal' | 'italic';
  readonly textAlign?: 'left' | 'right' | 'center' | 'justify';
  readonly textTransform?: 'none' | 'uppercase';
  readonly marginTop?: string;
  readonly marginBottom?: string;
  readonly marginLeft?: string;
  readonly textIndent?: string;
  /** Operação de contador da publicação, por exemplo reiniciar a paginação. */
  readonly counterReset?: string;
  readonly pageBreakBefore?: boolean;
  readonly pageBreakAfter?: boolean;
  readonly whiteSpace?: 'normal' | 'pre' | 'pre-wrap';
  readonly border?: string;
  readonly padding?: string;
  readonly minHeight?: string;
  readonly pageName?: string;
}

export type StyleTokenRegistry = { readonly [token: StyleToken]: StyleDefinition };

export interface PublicationDocument {
  readonly schema: 'publication-ast';
  readonly version: 1;
  /** Só para exibição (título da aba, metadados do PDF). */
  readonly title: string;
  readonly language: string;
  readonly page: PagePolicy;
  readonly styles: StyleTokenRegistry;
  readonly children: readonly PublicationBlock[];
  readonly notes: readonly PublicationNote[];
}
