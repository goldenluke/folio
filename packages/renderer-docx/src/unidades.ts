/**
 * Conversão de comprimento CSS-like (como a Publication AST guarda em
 * `StyleDefinition`) para as unidades que a OOXML usa: twips (1/20 de ponto)
 * para margens/recuos/espaçamento, meio-ponto para tamanho de fonte.
 *
 * `em` e `%` não são suportados — são relativos ao contexto (tamanho de
 * fonte, largura do contêiner), e resolver isso corretamente exigiria juntar
 * cascata de estilos que a Publication AST não expõe ao renderer. Um token
 * nessas unidades fica sem essa propriedade no DOCX (herda o padrão do Word)
 * em vez de errar o valor. Ver ADR 0019.
 */

const PONTOS_POR_UNIDADE: Readonly<Record<string, number>> = {
  pt: 1,
  cm: 28.3464566929,
  mm: 2.83464566929,
  in: 72,
};

function paraPontos(valor: string): number | undefined {
  const limpo = valor.trim();
  if (limpo === '0') return 0;
  const match = /^(-?\d+(?:\.\d+)?)(cm|mm|in|pt)$/u.exec(limpo);
  if (match?.[1] === undefined || match[2] === undefined) return undefined;
  const fator = PONTOS_POR_UNIDADE[match[2]];
  return fator === undefined ? undefined : Number(match[1]) * fator;
}

/** Twips (1/20 de ponto) — usado em margens de página, recuo e espaçamento de parágrafo. */
export function paraTwips(valor: string): number | undefined {
  const pontos = paraPontos(valor);
  return pontos === undefined ? undefined : Math.round(pontos * 20);
}

/** Meio-ponto — unidade de tamanho de fonte da OOXML (`size` em `IRunOptions`). */
export function paraMeioPonto(valor: string): number | undefined {
  const pontos = paraPontos(valor);
  return pontos === undefined ? undefined : Math.round(pontos * 2);
}
