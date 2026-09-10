export type BookmarkTarget =
  | { readonly kind: 'document'; readonly fileId: string; readonly path: string }
  | { readonly kind: 'section'; readonly fileId: string; readonly path: string; readonly offset: number }
  | { readonly kind: 'reference'; readonly referenceId: string }
  | { readonly kind: 'annotation'; readonly referenceId: string; readonly annotationId: string }
  | { readonly kind: 'project'; readonly projectId: string }
  | { readonly kind: 'view'; readonly viewId: string }
  | { readonly kind: 'search'; readonly query: string }
  | { readonly kind: 'dataset'; readonly datasetId: string };

export interface WorkspaceBookmark { readonly version: 1; readonly id: string; readonly label: string; readonly target: BookmarkTarget; readonly createdAt: string; }
export interface WorkspaceBookmarks { readonly version: 1; readonly bookmarks: readonly WorkspaceBookmark[]; }
export function createBookmarks(bookmarks: readonly WorkspaceBookmark[] = []): WorkspaceBookmarks {
  const ids = new Set<string>(); for (const bookmark of bookmarks) { if (bookmark.id.trim() === '' || bookmark.label.trim() === '') throw new Error('Bookmark exige identidade e nome.'); if (ids.has(bookmark.id)) throw new Error(`Bookmark duplicado: ${bookmark.id}.`); ids.add(bookmark.id); }
  return { version: 1, bookmarks };
}
/** Revalida conteúdo lido de disco antes de ele chegar a qualquer UI. */
export function parseBookmarksDocument(input: unknown): WorkspaceBookmarks {
  if (typeof input !== 'object' || input === null || (input as { version?: unknown }).version !== 1 || !Array.isArray((input as { bookmarks?: unknown }).bookmarks)) {
    throw new Error('Arquivo de bookmarks inválido.');
  }
  const record = input as { bookmarks: readonly unknown[] };
  return createBookmarks(record.bookmarks.map((candidate) => candidate as WorkspaceBookmark));
}

export interface WebClipperCapture { readonly version: 1; readonly url: string; readonly title?: string; readonly selection?: string; readonly capturedAt: string; }
/** A extensão apenas entrega dados declarativos; o host ainda exige preview e confirmação. */
export function validateWebClipperCapture(value: unknown): WebClipperCapture {
  if (typeof value !== 'object' || value === null) throw new Error('Captura inválida.'); const item = value as Partial<WebClipperCapture>;
  if (item.version !== 1 || typeof item.url !== 'string' || !/^https?:\/\//iu.test(item.url)) throw new Error('O Web Clipper aceita apenas URL HTTP(S).');
  if (item.title !== undefined && typeof item.title !== 'string') throw new Error('Título inválido.'); if (item.selection !== undefined && typeof item.selection !== 'string') throw new Error('Seleção inválida.'); if (typeof item.capturedAt !== 'string') throw new Error('Data de captura inválida.');
  return { version: 1, url: item.url, ...(item.title === undefined ? {} : { title: item.title }), ...(item.selection === undefined ? {} : { selection: item.selection }), capturedAt: item.capturedAt };
}

/** F336–F343: candidato revisável; não é referência, documento nem nota canônica. */
export interface CaptureInboxItem {
  readonly id: string;
  readonly capturedAt: string;
  readonly title?: string;
  readonly url?: string;
  readonly selection?: string;
  readonly note?: string;
}
export interface CaptureInbox { readonly version: 1; readonly items: readonly CaptureInboxItem[]; }

export function createCaptureInbox(items: readonly CaptureInboxItem[] = []): CaptureInbox {
  const ids = new Set<string>();
  for (const item of items) {
    if (item.id.trim() === '' || item.capturedAt.trim() === '') throw new Error('Captura exige identidade e data.');
    if (ids.has(item.id)) throw new Error(`Captura duplicada: ${item.id}.`);
    if (item.url === undefined && item.selection === undefined && item.note === undefined) throw new Error('Captura exige URL, seleção ou nota.');
    if (item.url !== undefined && !/^https?:\/\//iu.test(item.url)) throw new Error('Captura aceita somente URL HTTP(S).');
    ids.add(item.id);
  }
  return { version: 1, items };
}

export function parseCaptureInbox(input: unknown): CaptureInbox {
  if (typeof input !== 'object' || input === null || (input as { version?: unknown }).version !== 1 || !Array.isArray((input as { items?: unknown }).items)) throw new Error('Arquivo de inbox inválido.');
  return createCaptureInbox((input as { items: readonly unknown[] }).items.map((item) => item as CaptureInboxItem));
}

export function captureInboxItem(clip: WebClipperCapture): CaptureInboxItem {
  return { id: crypto.randomUUID(), capturedAt: clip.capturedAt, url: clip.url, ...(clip.title === undefined ? {} : { title: clip.title }), ...(clip.selection === undefined ? {} : { selection: clip.selection }) };
}

export function captureNotePath(item: CaptureInboxItem): string { return `notas/capturas/${item.id}.md`; }
export function captureNoteSource(item: CaptureInboxItem): string {
  const title = item.title?.trim() || 'Captura';
  const source = item.url === undefined ? '' : `Fonte: ${item.url}\n\n`;
  return `# ${title}\n\n${source}${item.selection ?? item.note ?? ''}\n`;
}

export const slashCommands = (query = ''): readonly { readonly id: string; readonly label: string }[] => [
  { id: 'figure.insert', label: 'Inserir figura' }, { id: 'citation.openPicker', label: 'Inserir citação' }, { id: 'table.insert', label: 'Inserir tabela' }, { id: 'xref.insert', label: 'Inserir referência cruzada' }, { id: 'template.createDocument', label: 'Criar documento' },
].filter((command) => command.label.toLocaleLowerCase().includes(query.replace(/^\//u, '').toLocaleLowerCase()));

export function researchJournalPath(date: Date): string { return `journal/${date.toISOString().slice(0, 10)}.md`; }
export function researchJournalSource(date: Date): string { return `# Diário de pesquisa — ${date.toISOString().slice(0, 10)}\n\n## Observações\n\n## Próximos passos\n`; }

/**
 * Insere uma captura como bullet logo abaixo de `## Observações`, mais
 * recente primeiro, em lista compacta (sem linha em branco entre bullets).
 * Se o cabeçalho não existir mais (usuário editou o arquivo), acrescenta um
 * novo no fim em vez de lançar — a validação só roda na criação do arquivo.
 */
export function appendJournalCapture(content: string, text: string): string {
  const line = text.replace(/\r?\n/gu, ' ').trim();
  const heading = '## Observações';
  const headingIndex = content.indexOf(heading);
  if (headingIndex === -1) {
    const trimmed = content.replace(/\n+$/u, '');
    return `${trimmed}\n\n${heading}\n\n- ${line}\n`;
  }
  const rest = content.slice(headingIndex + heading.length);
  const nextHeadingOffset = rest.search(/\n#{1,6}\s/u);
  const sectionBody = nextHeadingOffset === -1 ? rest : rest.slice(0, nextHeadingOffset);
  const remainder = nextHeadingOffset === -1 ? '' : rest.slice(nextHeadingOffset);
  const existingBullets = sectionBody.replace(/^\n+/u, '');
  return `${content.slice(0, headingIndex)}${heading}\n\n- ${line}\n${existingBullets}${remainder}`;
}
