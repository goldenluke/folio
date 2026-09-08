import type { DocumentId } from './ids.js';

/**
 * Posição no arquivo de origem.
 *
 * `offset` é o valor autoritativo; `line`/`column` são derivados e existem só
 * para exibição. Edição incremental no editor mexe em offsets — recalcular
 * linha/coluna a partir deles é barato, e manter linha/coluna como fonte da
 * verdade obrigaria a reindexar o arquivo inteiro a cada tecla.
 */
export interface SourcePosition {
  readonly offset: number;
  readonly line?: number;
  readonly column?: number;
}

export interface SourceRange {
  readonly documentId: DocumentId;
  readonly start: SourcePosition;
  readonly end: SourcePosition;
}

/**
 * Converte offset em linha/coluna (1-based), para exibir diagnósticos.
 * Ver `abnt lint`, que reporta `arquivo.md:84:12`.
 *
 * Uso pontual. Para converter muitos offsets do mesmo texto, use `IndiceDeLinhas`:
 * esta função varre desde o início a cada chamada, o que vira O(n²) em lote.
 */
export function posicaoLegivel(texto: string, offset: number): { line: number; column: number } {
  return new IndiceDeLinhas(texto).posicaoDe(offset);
}

/**
 * Índice de início de linha, para converter offset em linha/coluna em O(log n).
 *
 * Existe porque diagnósticos são gerados aos milhares num documento grande, e
 * cada um precisa de linha e coluna. Recontar quebras desde o início do arquivo
 * a cada conversão transforma a listagem de erros em trabalho quadrático.
 */
export class IndiceDeLinhas {
  /** `#inicios[i]` é o offset onde a linha `i + 1` começa. */
  readonly #inicios: readonly number[];
  readonly #tamanho: number;

  constructor(texto: string) {
    const inicios = [0];
    for (let i = 0; i < texto.length; i += 1) {
      if (texto[i] === '\n') inicios.push(i + 1);
    }
    this.#inicios = inicios;
    this.#tamanho = texto.length;
  }

  posicaoDe(offset: number): { line: number; column: number } {
    const alvo = Math.max(0, Math.min(offset, this.#tamanho));

    let baixo = 0;
    let alto = this.#inicios.length - 1;
    while (baixo < alto) {
      const meio = Math.ceil((baixo + alto) / 2);
      if ((this.#inicios[meio] as number) <= alvo) baixo = meio;
      else alto = meio - 1;
    }

    return { line: baixo + 1, column: alvo - (this.#inicios[baixo] as number) + 1 };
  }
}
