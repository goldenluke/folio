import { AlignmentType, type IParagraphPropertiesOptionsBase, type IRunStylePropertiesOptions } from 'docx';

import type { StyleDefinition } from '@abnt/publication';

import { paraMeioPonto, paraTwips } from './unidades.js';

const ALINHAMENTO: Readonly<Record<string, (typeof AlignmentType)[keyof typeof AlignmentType]>> = {
  left: AlignmentType.LEFT,
  right: AlignmentType.RIGHT,
  center: AlignmentType.CENTER,
  justify: AlignmentType.JUSTIFIED,
};

/** Propriedades de run (caractere) derivadas do token de estilo. */
export function estiloDeTexto(estilo: StyleDefinition | undefined): IRunStylePropertiesOptions {
  if (estilo === undefined) return {};
  const tamanho = estilo.fontSize === undefined ? undefined : paraMeioPonto(estilo.fontSize);
  return {
    ...(estilo.fontFamily !== undefined ? { font: estilo.fontFamily } : {}),
    ...(tamanho !== undefined ? { size: tamanho } : {}),
    ...(estilo.fontWeight === 'bold' || estilo.fontWeight === '700' ? { bold: true } : {}),
    ...(estilo.fontStyle === 'italic' ? { italics: true } : {}),
    ...(estilo.textTransform === 'uppercase' ? { allCaps: true } : {}),
  };
}

/** Propriedades de parágrafo derivadas do token de estilo. */
export function estiloDeParagrafo(estilo: StyleDefinition | undefined): IParagraphPropertiesOptionsBase {
  if (estilo === undefined) return {};
  const alinhamento = estilo.textAlign === undefined ? undefined : ALINHAMENTO[estilo.textAlign];
  const antes = estilo.marginTop === undefined ? undefined : paraTwips(estilo.marginTop);
  const depois = estilo.marginBottom === undefined ? undefined : paraTwips(estilo.marginBottom);
  const recuoPrimeiraLinha = estilo.textIndent === undefined ? undefined : paraTwips(estilo.textIndent);
  return {
    ...(alinhamento !== undefined ? { alignment: alinhamento } : {}),
    ...(antes !== undefined || depois !== undefined
      ? { spacing: { ...(antes !== undefined ? { before: antes } : {}), ...(depois !== undefined ? { after: depois } : {}) } }
      : {}),
    ...(recuoPrimeiraLinha !== undefined && recuoPrimeiraLinha > 0
      ? { indent: { firstLine: recuoPrimeiraLinha } }
      : {}),
    ...(estilo.pageBreakBefore === true ? { pageBreakBefore: true } : {}),
  };
}
