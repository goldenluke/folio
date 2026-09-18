import { PDFDocument, PDFString, rgb } from 'pdf-lib';

export type ExportableAnnotation = {
  readonly page: number;
  readonly quote: string;
  readonly comment?: string;
  readonly color?: string;
  readonly rects?: readonly { readonly x: number; readonly y: number; readonly width: number; readonly height: number }[];
};

const color = (value: string | undefined): readonly [number, number, number] => {
  const hex = (value ?? '#facc15').replace('#', '');
  if (!/^[0-9a-f]{6}$/iu.test(hex)) return [0.98, 0.8, 0.08];
  return [Number.parseInt(hex.slice(0, 2), 16) / 255, Number.parseInt(hex.slice(2, 4), 16) / 255, Number.parseInt(hex.slice(4, 6), 16) / 255];
};

/** Produz nova cópia; nunca altera os bytes que chegaram do vault. */
export async function exportAnnotatedPdf(source: Uint8Array, annotations: readonly ExportableAnnotation[], mode: 'editable' | 'flatten'): Promise<Uint8Array> {
  const document = await PDFDocument.load(source, { ignoreEncryption: true });
  for (const annotation of annotations) {
    const page = document.getPage(annotation.page - 1); if (page === undefined) continue;
    const [red, green, blue] = color(annotation.color); const size = page.getSize();
    for (const rect of annotation.rects ?? []) {
      const x = rect.x * size.width; const y = size.height - ((rect.y + rect.height) * size.height); const width = rect.width * size.width; const height = rect.height * size.height;
      if (mode === 'flatten') { page.drawRectangle({ x, y, width, height, color: rgb(red, green, blue), opacity: 0.28, borderColor: rgb(red, green, blue), borderOpacity: 0.7, borderWidth: 0.5 }); continue; }
      const reference = document.context.register(document.context.obj({ Type: 'Annot', Subtype: 'Highlight', Rect: [x, y, x + width, y + height], QuadPoints: [x, y + height, x + width, y + height, x, y, x + width, y], C: [red, green, blue], CA: 0.45, Contents: PDFString.of(annotation.comment ?? annotation.quote) }));
      page.node.addAnnot(reference);
    }
  }
  return document.save();
}
