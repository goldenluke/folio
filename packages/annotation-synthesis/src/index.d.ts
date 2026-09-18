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
export interface AnnotationColorSemanticsDocument {
    readonly version: 1;
    readonly colors: AnnotationColorSemantics;
}
/** Cor sem rótulo não tem semântica nenhuma — recusa em vez de aceitar um mapa incompleto. */
export declare function createColorSemantics(colors?: AnnotationColorSemantics): AnnotationColorSemanticsDocument;
/** Entrada corrompida (cor sem rótulo, rótulo não-string) é descartada, nunca derruba o mapa inteiro. */
export declare function parseColorSemantics(input: unknown): AnnotationColorSemanticsDocument;
export declare const annotationMarker: (id: string) => string;
/** Mesma checagem de idempotência que `linkPdfAnnotation` (F36.4) já usava para uma anotação só. */
export declare function isAlreadySynthesized(content: string, annotationId: string): boolean;
export declare function unsynthesizedAnnotations(content: string, annotations: readonly SynthesizableAnnotation[]): readonly SynthesizableAnnotation[];
export interface SynthesizeAnnotationsInput {
    readonly annotations: readonly SynthesizableAnnotation[];
    readonly template: AnnotationSynthesisTemplate;
    readonly colorSemantics?: AnnotationColorSemantics;
    readonly referenceLabels?: Readonly<Record<string, string>>;
}
export declare function synthesizeAnnotations(input: SynthesizeAnnotationsInput): string;
//# sourceMappingURL=index.d.ts.map