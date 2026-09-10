/** Onda BH (F436–F446). Anexos são estado operacional local-first: nunca entram no CSL-JSON canônico. */

export type AttachmentId = string & { readonly __brand: 'AttachmentId' };
export const asAttachmentId = (value: string): AttachmentId => value as AttachmentId;

export type AttachmentRole = 'primary' | 'supplementary' | 'dataset' | 'snapshot';
export type AttachmentKind = 'file' | 'link';

const ROLES: readonly AttachmentRole[] = ['primary', 'supplementary', 'dataset', 'snapshot'];
const isAttachmentRole = (value: unknown): value is AttachmentRole => ROLES.includes(value as AttachmentRole);
const isAttachmentKind = (value: unknown): value is AttachmentKind => value === 'file' || value === 'link';
const isHttpUri = (value: string): boolean => /^https?:\/\//iu.test(value);

export interface AttachmentVersion {
  readonly versionId: string;
  readonly createdAt: string;
  readonly fileId?: string;
  readonly path?: string;
  readonly uri?: string;
  readonly snapshotText?: string;
  readonly note?: string;
}

export interface Attachment {
  readonly id: AttachmentId;
  readonly referenceId: string;
  readonly kind: AttachmentKind;
  readonly role: AttachmentRole;
  readonly mediaType: string;
  readonly displayTitle?: string;
  readonly versions: readonly AttachmentVersion[];
}

export interface AttachmentManifest { readonly version: 2; readonly attachments: readonly Attachment[]; }

export interface CreateAttachmentInput {
  readonly id: string;
  readonly referenceId: string;
  readonly kind: AttachmentKind;
  readonly role: AttachmentRole;
  readonly mediaType: string;
  readonly displayTitle?: string;
  readonly versions: readonly AttachmentVersion[];
}

function validateVersion(kind: AttachmentKind, version: AttachmentVersion): void {
  if (version.versionId.trim() === '' || version.createdAt.trim() === '') throw new Error('Versão de anexo exige identidade e data.');
  if (kind === 'file' && (version.fileId === undefined || version.fileId.trim() === '' || version.path === undefined || version.path.trim() === '')) {
    throw new Error('Versão de anexo em arquivo exige fileId e path.');
  }
  if (kind === 'link' && (version.uri === undefined || !isHttpUri(version.uri))) throw new Error('Anexo de link exige URI HTTP(S).');
}

/** Papel + kind + versões são a identidade funcional; título de exibição é só apresentação. */
export function createAttachment(input: CreateAttachmentInput): Attachment {
  if (input.id.trim() === '' || input.referenceId.trim() === '') throw new Error('Anexo exige identidade e referência.');
  if (!isAttachmentKind(input.kind)) throw new Error(`Tipo de anexo inválido: ${String(input.kind)}.`);
  if (!isAttachmentRole(input.role)) throw new Error(`Papel de anexo inválido: ${String(input.role)}.`);
  if (input.versions.length === 0) throw new Error('Anexo exige ao menos uma versão.');
  const seen = new Set<string>();
  for (const version of input.versions) {
    validateVersion(input.kind, version);
    if (seen.has(version.versionId)) throw new Error(`Versão duplicada: ${version.versionId}.`);
    seen.add(version.versionId);
  }
  return {
    id: asAttachmentId(input.id),
    referenceId: input.referenceId,
    kind: input.kind,
    role: input.role,
    mediaType: input.mediaType,
    ...(input.displayTitle === undefined ? {} : { displayTitle: input.displayTitle }),
    versions: input.versions,
  };
}

export function createAttachmentManifest(attachments: readonly Attachment[] = []): AttachmentManifest {
  const ids = new Set<string>();
  for (const attachment of attachments) { if (ids.has(attachment.id)) throw new Error(`Anexo duplicado: ${attachment.id}.`); ids.add(attachment.id); }
  return { version: 2, attachments };
}

export function attachmentsForReference(manifest: AttachmentManifest, referenceId: string): readonly Attachment[] {
  return manifest.attachments.filter((attachment) => attachment.referenceId === referenceId);
}

function uniqueAttachmentId(existing: ReadonlySet<string>, base: string): AttachmentId {
  if (!existing.has(base)) return asAttachmentId(base);
  let suffix = 2;
  while (existing.has(`${base}-${suffix}`)) suffix += 1;
  return asAttachmentId(`${base}-${suffix}`);
}

/**
 * Usado por merge/rename de referência (F54/F55): move todo anexo de
 * `fromReferenceId` para `toReferenceId`. Quando a canônica já tem um anexo
 * do mesmo papel+tipo, preserva o dela e descarta o da duplicata — mesma
 * regra de "quem já tem, mantém" do modelo v1, agora por papel em vez de
 * global (v1 só tinha um anexo possível, então as duas regras coincidiam).
 */
export function retargetAttachments(manifest: AttachmentManifest, fromReferenceId: string, toReferenceId: string): AttachmentManifest {
  if (fromReferenceId === toReferenceId) return manifest;
  const fromAttachments = manifest.attachments.filter((attachment) => attachment.referenceId === fromReferenceId);
  const toAttachments = manifest.attachments.filter((attachment) => attachment.referenceId === toReferenceId);
  const untouched = manifest.attachments.filter((attachment) => attachment.referenceId !== fromReferenceId && attachment.referenceId !== toReferenceId);
  const ids = new Set(manifest.attachments.map((attachment) => attachment.id as string));
  const moved: Attachment[] = [];
  for (const attachment of fromAttachments) {
    if (toAttachments.some((existing) => existing.role === attachment.role && existing.kind === attachment.kind)) continue;
    const id = uniqueAttachmentId(ids, `${toReferenceId}-${attachment.role}`);
    ids.add(id);
    moved.push({ ...attachment, id, referenceId: toReferenceId });
  }
  return createAttachmentManifest([...untouched, ...toAttachments, ...moved]);
}

/** Nunca reescreve o histórico: versão nova é sempre acrescentada, mais recente por último. */
export function addAttachmentVersion(attachment: Attachment, version: AttachmentVersion): Attachment {
  validateVersion(attachment.kind, version);
  if (attachment.versions.some((existing) => existing.versionId === version.versionId)) throw new Error(`Versão duplicada: ${version.versionId}.`);
  return { ...attachment, versions: [...attachment.versions, version] };
}

export function latestAttachmentVersion(attachment: Attachment): AttachmentVersion {
  const version = attachment.versions[attachment.versions.length - 1];
  if (version === undefined) throw new Error(`Anexo ${attachment.id} não tem versão.`);
  return version;
}

/** Scanner determinístico: nunca preserva marcação executável, só o texto. */
export function sanitizeSnapshotHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/giu, ' ')
    .replace(/<style[\s\S]*?<\/style>/giu, ' ')
    .replace(/<!--[\s\S]*?-->/gu, ' ')
    .replace(/<[^>]+>/gu, ' ')
    .replace(/&nbsp;/giu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

export interface AttachmentFilenameInput {
  readonly surname?: string;
  readonly year?: string | number;
  readonly title?: string;
  readonly extension: string;
}

const slugify = (value: string): string => value
  .normalize('NFD').replace(/[\u0300-\u036f]/gu, '')
  .toLocaleLowerCase('pt-BR')
  .replace(/[^a-z0-9]+/gu, '-')
  .replace(/^-+|-+$/gu, '');

/** Sugestão só — quem confirma o nome final é o usuário, nunca é escrita automática. */
export function suggestAttachmentFilename(input: AttachmentFilenameInput): string {
  const parts = [input.surname, input.year === undefined ? undefined : String(input.year), input.title]
    .filter((part): part is string => part !== undefined && part.trim() !== '');
  const base = slugify(parts.join('-')) || 'anexo';
  const truncated = base.length > 80 ? base.slice(0, 80).replace(/-+$/u, '') : base;
  const extension = input.extension.replace(/^\.+/u, '').toLocaleLowerCase('pt-BR');
  return `${truncated}.${extension}`;
}

export interface AttachmentHealthContext {
  readonly existingFileIds: ReadonlySet<string>;
  readonly knownReferenceIds: ReadonlySet<string>;
  readonly unreachableUris?: ReadonlySet<string>;
}

export interface AttachmentHealthIssue {
  readonly attachmentId: AttachmentId;
  readonly referenceId: string;
  readonly code: 'missing-file' | 'broken-link' | 'orphan-reference';
  readonly message: string;
}

/** Puro: quem já resolveu existência de arquivo/alcançabilidade de link é o host. */
export function checkAttachmentHealth(manifest: AttachmentManifest, context: AttachmentHealthContext): readonly AttachmentHealthIssue[] {
  const issues: AttachmentHealthIssue[] = [];
  for (const attachment of manifest.attachments) {
    const latest = latestAttachmentVersion(attachment);
    if (!context.knownReferenceIds.has(attachment.referenceId)) {
      issues.push({ attachmentId: attachment.id, referenceId: attachment.referenceId, code: 'orphan-reference', message: `Referência ${attachment.referenceId} não existe mais na biblioteca.` });
    }
    if (attachment.kind === 'file' && latest.fileId !== undefined && !context.existingFileIds.has(latest.fileId)) {
      issues.push({ attachmentId: attachment.id, referenceId: attachment.referenceId, code: 'missing-file', message: `Arquivo do anexo ${attachment.id} não foi encontrado no vault.` });
    }
    if (attachment.kind === 'link' && latest.uri !== undefined && context.unreachableUris?.has(latest.uri) === true) {
      issues.push({ attachmentId: attachment.id, referenceId: attachment.referenceId, code: 'broken-link', message: `Link do anexo ${attachment.id} não respondeu na última verificação.` });
    }
  }
  return issues;
}

/** Formato anterior (P/F35): um único PDF por referência, sem papel nem versão. */
export interface LegacyReferenceAttachment { readonly referenceId: string; readonly fileId: string; readonly path: string; readonly mediaType: 'application/pdf'; }
interface LegacyAttachmentManifest { readonly version: 1; readonly attachments: readonly LegacyReferenceAttachment[]; }

const isLegacyManifest = (input: unknown): input is LegacyAttachmentManifest =>
  typeof input === 'object' && input !== null && (input as { version?: unknown }).version === 1 && Array.isArray((input as { attachments?: unknown }).attachments);

/** Migração versionada: v1 vira o anexo `primary` com uma versão só, sem perder fileId/path. */
export function migrateAttachmentManifest(input: LegacyAttachmentManifest): AttachmentManifest {
  const attachments = input.attachments.flatMap((legacy) => {
    if (typeof legacy !== 'object' || legacy === null) return [];
    const entry = legacy as Partial<LegacyReferenceAttachment>;
    if (typeof entry.referenceId !== 'string' || typeof entry.fileId !== 'string' || typeof entry.path !== 'string') return [];
    try {
      return [createAttachment({
        id: `${entry.referenceId}-primary`,
        referenceId: entry.referenceId,
        kind: 'file',
        role: 'primary',
        mediaType: 'application/pdf',
        versions: [{ versionId: 'v1', createdAt: new Date(0).toISOString(), fileId: entry.fileId, path: entry.path }],
      })];
    } catch { return []; }
  });
  return createAttachmentManifest(attachments);
}

/** Entrada única de leitura: aceita v1 (migra), v2 (revalida) ou lixo (vira manifesto vazio). Entrada individual corrompida é descartada, nunca derruba o manifesto inteiro. */
export function parseAttachmentManifest(input: unknown): AttachmentManifest {
  if (isLegacyManifest(input)) return migrateAttachmentManifest(input);
  if (typeof input !== 'object' || input === null || (input as { version?: unknown }).version !== 2 || !Array.isArray((input as { attachments?: unknown }).attachments)) {
    return createAttachmentManifest([]);
  }
  const seen = new Set<string>();
  const attachments: Attachment[] = [];
  for (const candidate of (input as { attachments: readonly unknown[] }).attachments) {
    try {
      const attachment = createAttachment(candidate as CreateAttachmentInput);
      if (seen.has(attachment.id)) continue;
      seen.add(attachment.id);
      attachments.push(attachment);
    } catch { /* entrada corrompida: descarta e segue */ }
  }
  return { version: 2, attachments };
}
