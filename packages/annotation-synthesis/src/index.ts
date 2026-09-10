/** Onda BL (F468–F475). Síntese de anotações é sempre revisável: gera texto, quem escreve é o host via EditorTransaction. */

export type AnnotationSynthesisTemplate = 'quote-list' | 'grouped-by-source' | 'grouped-by-color';

export interface SynthesizableAnnotation {
  readonly id: string;
  readonly referenceId: string;
  readonly page: number;
  readonly quote: string;
  readonly comment?: string;
  readonly color?: string;
}

export type AnnotationColorSemantics = Readonly<Record<string, string>>;
export interface AnnotationColorSemanticsDocument { readonly version: 1; readonly colors: AnnotationColorSemantics; }

/** Cor sem rótulo não tem semântica nenhuma — recusa em vez de aceitar um mapa incompleto. */
export function createColorSemantics(colors: AnnotationColorSemantics = {}): AnnotationColorSemanticsDocument {
  for (const [color, label] of Object.entries(colors)) {
    if (color.trim() === '') throw new Error('Cor de anotação exige identidade.');
    if (label.trim() === '') throw new Error(`Cor ${color} exige um rótulo.`);
  }
  return { version: 1, colors };
}

/** Entrada corrompida (cor sem rótulo, rótulo não-string) é descartada, nunca derruba o mapa inteiro. */
export function parseColorSemantics(input: unknown): AnnotationColorSemanticsDocument {
  if (typeof input !== 'object' || input === null || (input as { version?: unknown }).version !== 1) return createColorSemantics();
  const raw = (input as { colors?: unknown }).colors;
  if (typeof raw !== 'object' || raw === null) return createColorSemantics();
  const colors: Record<string, string> = {};
  for (const [color, label] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof label === 'string' && color.trim() !== '' && label.trim() !== '') colors[color] = label;
  }
  return { version: 1, colors };
}

export const annotationMarker = (id: string): string => `<!-- folio-pdf-annotation:${id} -->`;

/** Mesma checagem de idempotência que `linkPdfAnnotation` (F36.4) já usava para uma anotação só. */
export function isAlreadySynthesized(content: string, annotationId: string): boolean {
  return content.includes(annotationMarker(annotationId));
}

export function unsynthesizedAnnotations(content: string, annotations: readonly SynthesizableAnnotation[]): readonly SynthesizableAnnotation[] {
  return annotations.filter((annotation) => !isAlreadySynthesized(content, annotation.id));
}

export interface SynthesizeAnnotationsInput {
  readonly annotations: readonly SynthesizableAnnotation[];
  readonly template: AnnotationSynthesisTemplate;
  readonly colorSemantics?: AnnotationColorSemantics;
  readonly referenceLabels?: Readonly<Record<string, string>>;
}

/** Citação real `[@id, p. N]` em vez de um link inventado: backlink e contexto de citação (F48) nascem de graça, sem mecanismo novo. */
function block(annotation: SynthesizableAnnotation): string {
  const quote = `> ${annotation.quote.trim().replace(/\n+/gu, '\n> ')}`;
  const citation = `[@${annotation.referenceId}, p. ${annotation.page}]`;
  const commentLine = annotation.comment === undefined || annotation.comment.trim() === '' ? '' : `\n${annotation.comment.trim()}`;
  return `${annotationMarker(annotation.id)}\n${quote}\n${citation}${commentLine}`;
}

export function synthesizeAnnotations(input: SynthesizeAnnotationsInput): string {
  if (input.annotations.length === 0) throw new Error('Selecione ao menos uma anotação para sintetizar.');
  const referenceLabel = (referenceId: string): string => input.referenceLabels?.[referenceId] ?? referenceId;
  const colorLabel = (color: string | undefined): string => color === undefined ? 'Sem cor' : (input.colorSemantics?.[color] ?? color);
  if (input.template === 'quote-list') return input.annotations.map(block).join('\n\n');
  const groupKey = input.template === 'grouped-by-source'
    ? (annotation: SynthesizableAnnotation): string => referenceLabel(annotation.referenceId)
    : (annotation: SynthesizableAnnotation): string => colorLabel(annotation.color);
  const groups = new Map<string, SynthesizableAnnotation[]>();
  for (const annotation of input.annotations) {
    const key = groupKey(annotation);
    groups.set(key, [...(groups.get(key) ?? []), annotation]);
  }
  return [...groups.entries()].map(([heading, items]) => `### ${heading}\n\n${items.map(block).join('\n\n')}`).join('\n\n');
}
