import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

import type { WorkspaceFile, WorkspaceStorage } from '@abnt/workspace-core';
import { asWorkspaceFileId, asWorkspacePath } from '@abnt/workspace-core';
import {
  addAttachmentVersion,
  attachmentsForReference as attachmentsForReferenceInManifest,
  createAttachment,
  createAttachmentManifest,
  latestAttachmentVersion,
  parseAttachmentManifest,
  retargetAttachments,
  type Attachment,
  type AttachmentKind,
  type AttachmentManifest,
  type AttachmentRole,
  type AttachmentVersion,
} from '@abnt/attachment-model';

/** Onda BH (F436–F446): recurso operacional local, fora do CSL-JSON canônico. */
export const ATTACHMENTS_PATH = asWorkspacePath('references/attachments.json');

async function manifestFile(storage: WorkspaceStorage): Promise<WorkspaceFile | undefined> {
  return (await storage.list()).find((file) => String(file.path) === String(ATTACHMENTS_PATH));
}

export async function readAttachmentManifest(storage: WorkspaceStorage): Promise<AttachmentManifest> {
  const file = await manifestFile(storage);
  if (file === undefined) return createAttachmentManifest([]);
  const content = await storage.read(file.id);
  try { return parseAttachmentManifest(JSON.parse(content.content) as unknown); } catch { return createAttachmentManifest([]); }
}

async function writeAttachmentManifest(storage: WorkspaceStorage, manifest: AttachmentManifest): Promise<void> {
  const content = `${JSON.stringify(manifest, null, 2)}\n`;
  const file = await manifestFile(storage);
  if (file === undefined) { await storage.create({ path: ATTACHMENTS_PATH, content }); return; }
  const current = await storage.read(file.id);
  await storage.write({ fileId: file.id, expectedRevision: current.file.revision, content });
}

export async function attachmentsForReference(storage: WorkspaceStorage, referenceId: string): Promise<readonly Attachment[]> {
  return attachmentsForReferenceInManifest(await readAttachmentManifest(storage), referenceId);
}

export async function findAttachment(storage: WorkspaceStorage, attachmentId: string): Promise<Attachment | undefined> {
  return (await readAttachmentManifest(storage)).attachments.find((attachment) => String(attachment.id) === attachmentId);
}

export interface AddAttachmentInput {
  readonly referenceId: string;
  readonly role: AttachmentRole;
  readonly kind: AttachmentKind;
  readonly mediaType: string;
  readonly displayTitle?: string;
  readonly version: AttachmentVersion;
}

export async function addAttachmentToVault(storage: WorkspaceStorage, input: AddAttachmentInput): Promise<Attachment> {
  const manifest = await readAttachmentManifest(storage);
  const ids = new Set(manifest.attachments.map((attachment) => attachment.id as string));
  let id = `${input.referenceId}-${input.role}`;
  if (ids.has(id)) { let suffix = 2; while (ids.has(`${id}-${suffix}`)) suffix += 1; id = `${id}-${suffix}`; }
  const attachment = createAttachment({
    id, referenceId: input.referenceId, kind: input.kind, role: input.role, mediaType: input.mediaType,
    ...(input.displayTitle === undefined ? {} : { displayTitle: input.displayTitle }),
    versions: [input.version],
  });
  await writeAttachmentManifest(storage, createAttachmentManifest([...manifest.attachments, attachment]));
  return attachment;
}

export async function addVersionToVaultAttachment(storage: WorkspaceStorage, attachmentId: string, version: AttachmentVersion): Promise<Attachment> {
  const manifest = await readAttachmentManifest(storage);
  const attachment = manifest.attachments.find((entry) => String(entry.id) === attachmentId);
  if (attachment === undefined) throw new Error(`Anexo não encontrado: ${attachmentId}.`);
  const updated = addAttachmentVersion(attachment, version);
  await writeAttachmentManifest(storage, createAttachmentManifest(manifest.attachments.map((entry) => String(entry.id) === attachmentId ? updated : entry)));
  return updated;
}

export async function removeAttachmentFromVault(storage: WorkspaceStorage, attachmentId: string): Promise<void> {
  const manifest = await readAttachmentManifest(storage);
  await writeAttachmentManifest(storage, createAttachmentManifest(manifest.attachments.filter((entry) => String(entry.id) !== attachmentId)));
}

/**
 * Sugestão de renomeação (F44x) só se torna escrita quando o usuário
 * confirma esta chamada explicitamente — nunca acontece sozinha ao anexar.
 */
export async function renameAttachmentFile(storage: WorkspaceStorage, attachmentId: string, filename: string): Promise<Attachment> {
  const manifest = await readAttachmentManifest(storage);
  const attachment = manifest.attachments.find((entry) => String(entry.id) === attachmentId);
  if (attachment === undefined) throw new Error(`Anexo não encontrado: ${attachmentId}.`);
  const version = latestAttachmentVersion(attachment);
  if (attachment.kind !== 'file' || version.fileId === undefined || version.path === undefined) throw new Error('Só é possível renomear um anexo em arquivo.');
  const nextPath = asWorkspacePath(`${dirname(version.path)}/${filename}`);
  const renamed = await storage.rename({ fileId: asWorkspaceFileId(version.fileId), path: nextPath, expectedRevision: (await storage.read(asWorkspaceFileId(version.fileId))).file.revision });
  const nextVersion: AttachmentVersion = { ...version, path: String(renamed.path) };
  const updated: Attachment = { ...attachment, versions: attachment.versions.map((entry) => entry.versionId === version.versionId ? nextVersion : entry) };
  await writeAttachmentManifest(storage, createAttachmentManifest(manifest.attachments.map((entry) => String(entry.id) === attachmentId ? updated : entry)));
  return updated;
}

/** Formato anterior (F35): "o" anexo de uma referência é sempre o papel `primary`. */
export interface ReferenceAttachment { readonly referenceId: string; readonly fileId: string; readonly path: string; readonly mediaType: 'application/pdf'; }

function toLegacyShape(attachment: Attachment): ReferenceAttachment | undefined {
  const version = latestAttachmentVersion(attachment);
  if (attachment.kind !== 'file' || version.fileId === undefined || version.path === undefined) return undefined;
  return { referenceId: attachment.referenceId, fileId: version.fileId, path: version.path, mediaType: 'application/pdf' };
}

export async function readReferenceAttachments(storage: WorkspaceStorage): Promise<readonly ReferenceAttachment[]> {
  const manifest = await readAttachmentManifest(storage);
  return manifest.attachments
    .filter((attachment) => attachment.role === 'primary' && attachment.mediaType === 'application/pdf')
    .flatMap((attachment) => { const legacy = toLegacyShape(attachment); return legacy === undefined ? [] : [legacy]; });
}

export async function setReferenceAttachment(storage: WorkspaceStorage, attachment: ReferenceAttachment): Promise<void> {
  const manifest = await readAttachmentManifest(storage);
  const withoutPrimary = manifest.attachments.filter((entry) => !(entry.referenceId === attachment.referenceId && entry.role === 'primary'));
  const created = createAttachment({
    id: `${attachment.referenceId}-primary`, referenceId: attachment.referenceId, kind: 'file', role: 'primary', mediaType: attachment.mediaType,
    versions: [{ versionId: randomUUID(), createdAt: new Date().toISOString(), fileId: attachment.fileId, path: attachment.path }],
  });
  await writeAttachmentManifest(storage, createAttachmentManifest([...withoutPrimary, created]));
}

export async function removeReferenceAttachment(storage: WorkspaceStorage, referenceId: string): Promise<void> {
  const manifest = await readAttachmentManifest(storage);
  await writeAttachmentManifest(storage, createAttachmentManifest(manifest.attachments.filter((entry) => !(entry.referenceId === referenceId && entry.role === 'primary'))));
}

/** Move TODO anexo do duplicado (não só o PDF primário); ver `retargetAttachments`. */
export async function moveReferenceAttachment(storage: WorkspaceStorage, fromId: string, toId: string): Promise<void> {
  const manifest = await readAttachmentManifest(storage);
  const next = retargetAttachments(manifest, fromId, toId);
  if (next !== manifest) await writeAttachmentManifest(storage, next);
}
