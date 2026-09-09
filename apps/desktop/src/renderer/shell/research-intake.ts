import type { BibliographicEntityDto } from '@abnt/protocol';

export type IntakeSource = 'bibtex' | 'ris' | 'csl-json' | 'doi' | 'url' | 'pdf';
export interface IntakeDuplicate { readonly referenceId: string; readonly score: number; readonly reasons: readonly string[]; }
export interface IntakeItem {
  readonly id: string;
  readonly source: IntakeSource;
  readonly entry?: BibliographicEntityDto;
  readonly createdAt: string;
  readonly provenance: readonly string[];
  readonly duplicates: readonly IntakeDuplicate[];
  readonly pdf?: { readonly name: string; readonly sha256: string };
}

/** URL declarada pelo usuário; não há scraping nem provider embutido no core. */
export function captureUrl(url: string): BibliographicEntityDto | undefined {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return undefined;
    const stem = parsed.hostname.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/gu, '') || 'pagina';
    return { id: `web-${stem}`, type: 'webpage', URL: parsed.toString(), accessed: { 'date-parts': [[new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate()]] } };
  } catch { return undefined; }
}

/** Sem OCR: reconhece somente DOI literalmente disponível nos bytes do PDF. */
export function doiFromPdfText(text: string): string | undefined {
  const found = text.match(/10\.\d{4,9}\/[\w.()/:;-]+/iu)?.[0];
  return found?.replace(/[.,;:)}\]]+$/u, '');
}

export function inboxSummary(items: readonly IntakeItem[]): { readonly total: number; readonly missingAuthors: number; readonly duplicates: number; readonly missingYear: number } {
  return { total: items.length, missingAuthors: items.filter((item) => (item.entry?.author?.length ?? 0) === 0).length, duplicates: items.filter((item) => item.duplicates.length > 0).length, missingYear: items.filter((item) => item.entry?.issued?.['date-parts']?.[0]?.[0] === undefined).length };
}
