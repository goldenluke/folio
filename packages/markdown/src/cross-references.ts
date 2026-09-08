import type { CrossReferenceNode, InlineNode, NodeIdFactory, SourceRange, TextNode } from '@abnt/document-model';

/** Autoria explícita: `[[ref:fig:arquitetura]]` ou `[[ref:sec:metodo|title]]`. */
const XREF = /\[\[ref:([^\]|]+)(?:\|([^\]]+))?\]\]/gu;

export function extrairReferenciasCruzadas(no: TextNode, offset: number, ids: NodeIdFactory, range: (start: number, end: number) => SourceRange | undefined): InlineNode[] {
  const out: InlineNode[] = []; let cursor = 0;
  for (let found = XREF.exec(no.value); found !== null; found = XREF.exec(no.value)) {
    if (found.index > cursor) { const source = range(offset + cursor, offset + found.index); out.push({ id: ids.proximo(), type: 'text', value: no.value.slice(cursor, found.index), ...(source === undefined ? {} : { source }) }); }
    const start = offset + found.index; const end = start + found[0].length; const presentation = found[2] === undefined ? undefined : found[2];
    out.push({ id: ids.proximo(), type: 'cross-reference', target: { kind: 'identifier', identifier: found[1] ?? '' }, ...(presentation === undefined ? {} : { presentation }), ...(range(start, end) ? { source: range(start, end) } : {}) } as CrossReferenceNode);
    cursor = found.index + found[0].length;
  }
  if (out.length === 0) return [no];
  if (cursor < no.value.length) { const source = range(offset + cursor, offset + no.value.length); out.push({ id: ids.proximo(), type: 'text', value: no.value.slice(cursor), ...(source === undefined ? {} : { source }) }); }
  return out;
}
