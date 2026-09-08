/**
 * Primitiva pura de reescrita de texto com mapeamento de offset de volta ao
 * original. Existe porque compor fontes (F66) precisa aplicar mais de uma
 * transformação sobre o mesmo arquivo — remoção de frontmatter, rebase de URI
 * — sem perder a posição original de cada trecho.
 */
export interface TextPatch {
  readonly originalStart: number;
  readonly originalEnd: number;
  readonly replacement: string;
}

/**
 * Um trecho contíguo do texto processado e seu correspondente no original.
 * `exact` é falso quando o trecho veio de uma substituição (ex.: URI
 * reescrita): o comprimento pode ter mudado, então a posição interna é
 * proporcional, não caractere-a-caractere.
 */
export interface TextSpanMapping {
  readonly processedStart: number;
  readonly processedEnd: number;
  readonly originalStart: number;
  readonly originalEnd: number;
  readonly exact: boolean;
}

export interface PatchedText {
  readonly text: string;
  /** Cobre `[0, text.length)` de forma contígua e ordenada; nunca vazio. */
  readonly spans: readonly TextSpanMapping[];
}

/**
 * Aplica patches não sobrepostos, ordenados por posição original. Trechos de
 * exclusão (`replacement: ''`) não geram span: nada no texto processado pode
 * apontar para conteúdo que foi removido.
 */
export function applyTextPatches(original: string, patches: readonly TextPatch[]): PatchedText {
  const sorted = [...patches].sort((a, b) => a.originalStart - b.originalStart);
  let text = '';
  const spans: TextSpanMapping[] = [];
  let cursor = 0;
  for (const patch of sorted) {
    if (patch.originalStart < cursor) {
      throw new Error('applyTextPatches: patches sobrepostos não são suportados.');
    }
    if (patch.originalStart > cursor) {
      const start = text.length;
      text += original.slice(cursor, patch.originalStart);
      spans.push({ processedStart: start, processedEnd: text.length, originalStart: cursor, originalEnd: patch.originalStart, exact: true });
    }
    if (patch.replacement.length > 0) {
      const start = text.length;
      text += patch.replacement;
      spans.push({ processedStart: start, processedEnd: text.length, originalStart: patch.originalStart, originalEnd: patch.originalEnd, exact: false });
    }
    cursor = patch.originalEnd;
  }
  if (cursor < original.length) {
    const start = text.length;
    text += original.slice(cursor);
    spans.push({ processedStart: start, processedEnd: text.length, originalStart: cursor, originalEnd: original.length, exact: true });
  }
  if (spans.length === 0) spans.push({ processedStart: 0, processedEnd: 0, originalStart: cursor, originalEnd: cursor, exact: true });
  return { text, spans };
}

const findSpan = (spans: readonly TextSpanMapping[], offset: number): TextSpanMapping => {
  let low = 0;
  let high = spans.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if ((spans[mid] as TextSpanMapping).processedStart <= offset) low = mid;
    else high = mid - 1;
  }
  return spans[low] as TextSpanMapping;
};

/**
 * Converte um offset do texto processado de volta ao original. Dentro de um
 * span exato o resultado é exato; dentro de uma substituição é proporcional —
 * suficiente para não perder o entorno, não para reconstruir a URI antiga
 * caractere a caractere.
 */
export function mapProcessedOffsetToOriginal(spans: readonly TextSpanMapping[], offset: number): number {
  const last = spans[spans.length - 1] as TextSpanMapping;
  const clamped = Math.max(0, Math.min(offset, last.processedEnd));
  const span = findSpan(spans, clamped);
  const processedLength = span.processedEnd - span.processedStart;
  const originalLength = span.originalEnd - span.originalStart;
  if (processedLength === 0) return span.originalStart;
  const ratio = (clamped - span.processedStart) / processedLength;
  return Math.round(span.originalStart + ratio * originalLength);
}
