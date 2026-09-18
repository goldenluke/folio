/** Onda BL (F468–F475). Síntese de anotações é sempre revisável: gera texto, quem escreve é o host via EditorTransaction. */
/** Cor sem rótulo não tem semântica nenhuma — recusa em vez de aceitar um mapa incompleto. */
export function createColorSemantics(colors = {}) {
    for (const [color, label] of Object.entries(colors)) {
        if (color.trim() === '')
            throw new Error('Cor de anotação exige identidade.');
        if (label.trim() === '')
            throw new Error(`Cor ${color} exige um rótulo.`);
    }
    return { version: 1, colors };
}
/** Entrada corrompida (cor sem rótulo, rótulo não-string) é descartada, nunca derruba o mapa inteiro. */
export function parseColorSemantics(input) {
    if (typeof input !== 'object' || input === null || input.version !== 1)
        return createColorSemantics();
    const raw = input.colors;
    if (typeof raw !== 'object' || raw === null)
        return createColorSemantics();
    const colors = {};
    for (const [color, label] of Object.entries(raw)) {
        if (typeof label === 'string' && color.trim() !== '' && label.trim() !== '')
            colors[color] = label;
    }
    return { version: 1, colors };
}
export const annotationMarker = (id) => `<!-- folio-pdf-annotation:${id} -->`;
/** Mesma checagem de idempotência que `linkPdfAnnotation` (F36.4) já usava para uma anotação só. */
export function isAlreadySynthesized(content, annotationId) {
    return content.includes(annotationMarker(annotationId));
}
export function unsynthesizedAnnotations(content, annotations) {
    return annotations.filter((annotation) => !isAlreadySynthesized(content, annotation.id));
}
/** Citação real `[@id, p. N]` em vez de um link inventado: backlink e contexto de citação (F48) nascem de graça, sem mecanismo novo. */
function block(annotation) {
    const quote = `> ${annotation.quote.trim().replace(/\n+/gu, '\n> ')}`;
    const citation = `[@${annotation.referenceId}, p. ${annotation.page}]`;
    const commentLine = annotation.comment === undefined || annotation.comment.trim() === '' ? '' : `\n${annotation.comment.trim()}`;
    return `${annotationMarker(annotation.id)}\n${quote}\n${citation}${commentLine}`;
}
export function synthesizeAnnotations(input) {
    if (input.annotations.length === 0)
        throw new Error('Selecione ao menos uma anotação para sintetizar.');
    const referenceLabel = (referenceId) => input.referenceLabels?.[referenceId] ?? referenceId;
    const colorLabel = (color) => color === undefined ? 'Sem cor' : (input.colorSemantics?.[color] ?? color);
    if (input.template === 'quote-list')
        return input.annotations.map(block).join('\n\n');
    const groupKey = input.template === 'grouped-by-source'
        ? (annotation) => referenceLabel(annotation.referenceId)
        : (annotation) => colorLabel(annotation.color);
    const groups = new Map();
    for (const annotation of input.annotations) {
        const key = groupKey(annotation);
        groups.set(key, [...(groups.get(key) ?? []), annotation]);
    }
    return [...groups.entries()].map(([heading, items]) => `### ${heading}\n\n${items.map(block).join('\n\n')}`).join('\n\n');
}
//# sourceMappingURL=index.js.map