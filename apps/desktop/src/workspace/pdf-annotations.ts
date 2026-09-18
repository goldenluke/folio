import type { WorkspaceFile, WorkspaceStorage } from '@abnt/workspace-core';
import { asWorkspacePath } from '@abnt/workspace-core';

/** Estado de leitura local-first; a biblioteca CSL-JSON permanece canônica. */
export const PDF_ANNOTATIONS_PATH = asWorkspacePath('references/annotations.json');

export interface PdfAnnotation {
  readonly id: string;
  readonly referenceId: string;
  /** Identidade estável do documento; o caminho pode mudar sem soltar a annotation. */
  readonly pdfDocumentId: string;
  readonly fileId?: string;
  readonly page: number;
  readonly quote: string;
  readonly kind: 'highlight' | 'underline' | 'strikeout' | 'comment' | 'area' | 'ink';
  readonly anchor?: { readonly quote: string; readonly start?: number; readonly end?: number; };
  readonly rects?: readonly { readonly x: number; readonly y: number; readonly width: number; readonly height: number; }[];
  readonly externalId?: string;
  readonly comment?: string;
  /** Onda BL: cor do destaque; o significado (`AnnotationColorSemantics`) é configurado pelo usuário, nunca fixo. */
  readonly color?: string;
  readonly semanticType?: 'population' | 'intervention' | 'method' | 'outcome' | 'finding' | 'limitation' | 'risk' | 'quote' | 'context';
  readonly createdAt: string;
  readonly modifiedAt: string;
  readonly literatureNoteFileId?: string;
}

type AnnotationManifest = { readonly version: 2; readonly annotations: readonly PdfAnnotation[] };

const manifestFile = async (storage: WorkspaceStorage): Promise<WorkspaceFile | undefined> =>
  (await storage.list()).find((file) => String(file.path) === String(PDF_ANNOTATIONS_PATH));

const isAnnotation = (value: unknown): value is PdfAnnotation => {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.id === 'string' && typeof entry.referenceId === 'string' && typeof entry.pdfDocumentId === 'string' &&
    typeof entry.page === 'number' && Number.isInteger(entry.page) && entry.page > 0 &&
    typeof entry.quote === 'string' && entry.quote.trim() !== '' && typeof entry.createdAt === 'string' && typeof entry.modifiedAt === 'string' &&
    (entry.kind === 'highlight' || entry.kind === 'underline' || entry.kind === 'strikeout' || entry.kind === 'comment' || entry.kind === 'area' || entry.kind === 'ink') &&
    (entry.comment === undefined || typeof entry.comment === 'string') &&
    (entry.color === undefined || typeof entry.color === 'string') &&
    (entry.externalId === undefined || typeof entry.externalId === 'string') &&
    (entry.literatureNoteFileId === undefined || typeof entry.literatureNoteFileId === 'string');
};

export const readPdfAnnotations = async (storage: WorkspaceStorage): Promise<readonly PdfAnnotation[]> => {
  const file = await manifestFile(storage);
  if (file === undefined) return [];
  try {
    const content = await storage.read(file.id);
    const parsed = JSON.parse(content.content) as Partial<AnnotationManifest>;
    if (parsed.version === 2 && Array.isArray(parsed.annotations)) return parsed.annotations.filter(isAnnotation);
    if ((parsed as { version?: unknown }).version === 1 && Array.isArray(parsed.annotations)) return parsed.annotations.flatMap((value) => {
      if (typeof value !== 'object' || value === null) return [];
      const legacy = value as { id?: unknown; referenceId?: unknown; page?: unknown; quote?: unknown; comment?: unknown; color?: unknown; createdAt?: unknown; literatureNoteFileId?: unknown };
      if (typeof legacy.id !== 'string' || typeof legacy.referenceId !== 'string' || typeof legacy.page !== 'number' || typeof legacy.quote !== 'string' || typeof legacy.createdAt !== 'string') return [];
      return [{ id: legacy.id, referenceId: legacy.referenceId, pdfDocumentId: 'reference:' + legacy.referenceId, page: legacy.page, quote: legacy.quote, kind: 'highlight' as const, anchor: { quote: legacy.quote }, createdAt: legacy.createdAt, modifiedAt: legacy.createdAt, ...(typeof legacy.comment === 'string' ? { comment: legacy.comment } : {}), ...(typeof legacy.color === 'string' ? { color: legacy.color } : {}), ...(typeof legacy.literatureNoteFileId === 'string' ? { literatureNoteFileId: legacy.literatureNoteFileId } : {}) }];
    });
    return [];
  } catch {
    return [];
  }
};

const writePdfAnnotations = async (storage: WorkspaceStorage, annotations: readonly PdfAnnotation[]): Promise<void> => {
  const content = `${JSON.stringify({ version: 2, annotations } satisfies AnnotationManifest, null, 2)}\n`;
  const file = await manifestFile(storage);
  if (file === undefined) {
    await storage.create({ path: PDF_ANNOTATIONS_PATH, content });
    return;
  }
  const current = await storage.read(file.id);
  await storage.write({ fileId: file.id, expectedRevision: current.file.revision, content });
};

export const addPdfAnnotation = async (storage: WorkspaceStorage, annotation: PdfAnnotation): Promise<void> => {
  await writePdfAnnotations(storage, [...await readPdfAnnotations(storage), annotation]);
};

export const removeStoredPdfAnnotation = async (storage: WorkspaceStorage, referenceId: string, id: string): Promise<void> => {
  await writePdfAnnotations(storage, (await readPdfAnnotations(storage)).filter((entry) => entry.referenceId !== referenceId || entry.id !== id));
};

export const updatePdfAnnotation = async (storage: WorkspaceStorage, annotation: PdfAnnotation): Promise<void> => {
  await writePdfAnnotations(storage, (await readPdfAnnotations(storage)).map((entry) => entry.id === annotation.id ? annotation : entry));
};

/** F54: anotações pertencentes à referência mesclada acompanham a canônica. */
export const movePdfAnnotations = async (storage: WorkspaceStorage, fromId: string, toId: string): Promise<void> => {
  await writePdfAnnotations(storage, (await readPdfAnnotations(storage)).map((entry) => entry.referenceId === fromId ? { ...entry, referenceId: toId } : entry));
};
