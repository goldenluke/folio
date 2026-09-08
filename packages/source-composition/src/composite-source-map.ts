/**
 * F66 — mapa de uma fonte virtual (composta pelo host a partir de embeds, ver
 * `@abnt/markdown#expandMarkdownComposition`) de volta para os arquivos
 * autorais reais. Não conhece WorkspaceFileId nem vault: `path` é a mesma
 * string de caminho que o expansor já usa, e é o host de composição
 * (`workspace-environment`) quem sabe convertê-la para identidade do vault.
 * Sempre plano — nunca uma cadeia de segmentos que o consumidor precisa
 * percorrer para chegar na origem final (item 10 do roadmap da Onda O).
 */
export interface CompositeSourceSegment {
  readonly virtualStart: number;
  readonly virtualEnd: number;
  readonly path: string;
  readonly sourceStart: number;
  readonly sourceEnd: number;
}

export interface CompositeSourceMap {
  readonly rootPath: string;
  readonly length: number;
  /** Ordenados e contíguos: `segments[i].virtualEnd === segments[i+1].virtualStart`. */
  readonly segments: readonly CompositeSourceSegment[];
}

export type CompositeOrigin =
  | { readonly kind: 'authored'; readonly path: string; readonly offset: number }
  | { readonly kind: 'synthetic' };

export type CompositeRangeOrigin =
  | { readonly kind: 'authored'; readonly path: string; readonly start: number; readonly end: number }
  | { readonly kind: 'synthetic' };

/**
 * Constrói o mapa incrementalmente, em lockstep com a montagem do texto
 * virtual. `append` é chamado uma vez por trecho literal efetivamente
 * copiado para a saída — nunca por um embed que ainda vai ser expandido
 * recursivamente, o que é o que mantém o mapa plano.
 */
export class CompositeSourceMapBuilder {
  readonly #rootPath: string;
  readonly #segments: CompositeSourceSegment[] = [];
  #cursor = 0;

  constructor(rootPath: string) {
    this.#rootPath = rootPath;
  }

  /**
   * Cada chamada é seu próprio segmento — nunca funde com o anterior. `locateInComposite`
   * usa uma fórmula aditiva (`sourceStart + (offset - virtualStart)`) que só é válida
   * quando largura virtual e largura autoral do segmento coincidem; um trecho vindo de
   * URI reescrita (F66) tem largura diferente do trecho autoral correspondente, então
   * fundi-lo com um segmento idêntico adjacente quebraria essa fórmula para tudo que vem
   * depois do ponto de fusão. Documentos reais não têm segmentos suficientes para isso
   * importar em desempenho.
   */
  append(path: string, length: number, sourceStart: number, sourceEnd: number): void {
    if (length <= 0) return;
    const virtualStart = this.#cursor;
    this.#cursor += length;
    const virtualEnd = this.#cursor;
    this.#segments.push({ virtualStart, virtualEnd, path, sourceStart, sourceEnd });
  }

  build(): CompositeSourceMap {
    return { rootPath: this.#rootPath, length: this.#cursor, segments: this.#segments };
  }
}

const findSegmentIndex = (segments: readonly CompositeSourceSegment[], virtualOffset: number): number => {
  let low = 0;
  let high = segments.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if ((segments[mid] as CompositeSourceSegment).virtualStart <= virtualOffset) low = mid;
    else high = mid - 1;
  }
  return low;
};

/**
 * Resolve um offset da fonte virtual para o arquivo e offset autorais. Nunca
 * inventa origem: um offset fora de qualquer segmento (mapa vazio, texto
 * gerado pelo host sem correspondência autoral) volta `synthetic`.
 */
export function locateInComposite(map: CompositeSourceMap, virtualOffset: number): CompositeOrigin {
  if (map.segments.length === 0) return { kind: 'synthetic' };
  const clamped = Math.max(0, Math.min(virtualOffset, map.length));
  const index = findSegmentIndex(map.segments, clamped);
  const segment = map.segments[index] as CompositeSourceSegment;
  if (clamped < segment.virtualStart || clamped > segment.virtualEnd) return { kind: 'synthetic' };
  const offset = segment.sourceStart + Math.min(clamped, segment.virtualEnd) - segment.virtualStart;
  return { kind: 'authored', path: segment.path, offset };
}

/**
 * Resolve um range. Só devolve origem autoral quando início e fim caem no
 * MESMO segmento — um range que atravessa dois arquivos não tem uma origem
 * única e não deve ser forjado como se tivesse.
 */
export function locateRangeInComposite(map: CompositeSourceMap, virtualStart: number, virtualEnd: number): CompositeRangeOrigin {
  if (map.segments.length === 0) return { kind: 'synthetic' };
  const index = findSegmentIndex(map.segments, Math.max(0, Math.min(virtualStart, map.length)));
  const segment = map.segments[index] as CompositeSourceSegment;
  if (virtualStart < segment.virtualStart || virtualEnd > segment.virtualEnd) return { kind: 'synthetic' };
  const start = segment.sourceStart + (virtualStart - segment.virtualStart);
  const end = segment.sourceStart + (virtualEnd - segment.virtualStart);
  return { kind: 'authored', path: segment.path, start, end };
}
