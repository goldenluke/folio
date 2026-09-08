import type { WorkspaceFile, WorkspaceStorage } from '@abnt/workspace-core';
import { asWorkspacePath } from '@abnt/workspace-core';

/** Metadado local do vault: não altera nem estende o CSL-JSON canônico. */
export const ATTACHMENTS_PATH = asWorkspacePath('references/attachments.json');

export interface ReferenceAttachment {
  readonly referenceId: string;
  readonly fileId: string;
  readonly path: string;
  readonly mediaType: 'application/pdf';
}

type AttachmentManifest = { readonly version: 1; readonly attachments: readonly ReferenceAttachment[] };

async function manifestFile(storage: WorkspaceStorage): Promise<WorkspaceFile | undefined> {
  return (await storage.list()).find((file) => String(file.path) === String(ATTACHMENTS_PATH));
}

export async function readReferenceAttachments(storage: WorkspaceStorage): Promise<readonly ReferenceAttachment[]> {
  const file = await manifestFile(storage);
  if (file === undefined) return [];
  const content = await storage.read(file.id);
  try {
    const parsed = JSON.parse(content.content) as Partial<AttachmentManifest>;
    if (parsed.version !== 1 || !Array.isArray(parsed.attachments)) return [];
    return parsed.attachments.filter((entry): entry is ReferenceAttachment =>
      typeof entry === 'object' && entry !== null && typeof entry.referenceId === 'string' && typeof entry.fileId === 'string' && typeof entry.path === 'string' && entry.mediaType === 'application/pdf',
    );
  } catch { return []; }
}

async function writeReferenceAttachments(storage: WorkspaceStorage, attachments: readonly ReferenceAttachment[]): Promise<void> {
  const content = `${JSON.stringify({ version: 1, attachments } satisfies AttachmentManifest, null, 2)}\n`;
  const file = await manifestFile(storage);
  if (file === undefined) { await storage.create({ path: ATTACHMENTS_PATH, content }); return; }
  const current = await storage.read(file.id);
  await storage.write({ fileId: file.id, expectedRevision: current.file.revision, content });
}

export async function setReferenceAttachment(storage: WorkspaceStorage, attachment: ReferenceAttachment): Promise<void> {
  const current = await readReferenceAttachments(storage);
  await writeReferenceAttachments(storage, [...current.filter((entry) => entry.referenceId !== attachment.referenceId), attachment]);
}

export async function removeReferenceAttachment(storage: WorkspaceStorage, referenceId: string): Promise<void> {
  const current = await readReferenceAttachments(storage);
  await writeReferenceAttachments(storage, current.filter((entry) => entry.referenceId !== referenceId));
}

/** Preserva o PDF do duplicado quando a referência canônica ainda não tinha um. */
export async function moveReferenceAttachment(storage: WorkspaceStorage, fromId: string, toId: string): Promise<void> {
  const current = await readReferenceAttachments(storage);
  const source = current.find((entry) => entry.referenceId === fromId);
  if (source === undefined) return;
  const targetExists = current.some((entry) => entry.referenceId === toId);
  await writeReferenceAttachments(storage, [
    ...current.filter((entry) => entry.referenceId !== fromId && (targetExists || entry.referenceId !== toId)),
    ...(targetExists ? [] : [{ ...source, referenceId: toId }]),
  ]);
}
