import type { WorkspaceFile, WorkspaceStorage } from '@abnt/workspace-core';
import { asWorkspacePath } from '@abnt/workspace-core';

/** Estado de leitura local-first; a biblioteca CSL-JSON permanece canônica. */
export const PDF_ANNOTATIONS_PATH = asWorkspacePath('references/annotations.json');

export interface PdfAnnotation {
  readonly id: string;
  readonly referenceId: string;
  readonly page: number;
  readonly quote: string;
  readonly comment?: string;
  readonly createdAt: string;
  readonly literatureNoteFileId?: string;
}

type AnnotationManifest = { readonly version: 1; readonly annotations: readonly PdfAnnotation[] };

const manifestFile = async (storage: WorkspaceStorage): Promise<WorkspaceFile | undefined> =>
  (await storage.list()).find((file) => String(file.path) === String(PDF_ANNOTATIONS_PATH));

const isAnnotation = (value: unknown): value is PdfAnnotation => {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.id === 'string' && typeof entry.referenceId === 'string' &&
    typeof entry.page === 'number' && Number.isInteger(entry.page) && entry.page > 0 &&
    typeof entry.quote === 'string' && entry.quote.trim() !== '' && typeof entry.createdAt === 'string' &&
    (entry.comment === undefined || typeof entry.comment === 'string') &&
    (entry.literatureNoteFileId === undefined || typeof entry.literatureNoteFileId === 'string');
};

export const readPdfAnnotations = async (storage: WorkspaceStorage): Promise<readonly PdfAnnotation[]> => {
  const file = await manifestFile(storage);
  if (file === undefined) return [];
  try {
    const content = await storage.read(file.id);
    const parsed = JSON.parse(content.content) as Partial<AnnotationManifest>;
    return parsed.version === 1 && Array.isArray(parsed.annotations) ? parsed.annotations.filter(isAnnotation) : [];
  } catch {
    return [];
  }
};

const writePdfAnnotations = async (storage: WorkspaceStorage, annotations: readonly PdfAnnotation[]): Promise<void> => {
  const content = `${JSON.stringify({ version: 1, annotations } satisfies AnnotationManifest, null, 2)}\n`;
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
