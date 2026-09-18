/** Onda BH (F436–F446). Anexos são estado operacional local-first: nunca entram no CSL-JSON canônico. */
export type AttachmentId = string & {
    readonly __brand: 'AttachmentId';
};
export declare const asAttachmentId: (value: string) => AttachmentId;
export type AttachmentRole = 'primary' | 'supplementary' | 'dataset' | 'snapshot';
export type AttachmentKind = 'file' | 'link';
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
export interface AttachmentManifest {
    readonly version: 2;
    readonly attachments: readonly Attachment[];
}
export interface CreateAttachmentInput {
    readonly id: string;
    readonly referenceId: string;
    readonly kind: AttachmentKind;
    readonly role: AttachmentRole;
    readonly mediaType: string;
    readonly displayTitle?: string;
    readonly versions: readonly AttachmentVersion[];
}
/** Papel + kind + versões são a identidade funcional; título de exibição é só apresentação. */
export declare function createAttachment(input: CreateAttachmentInput): Attachment;
export declare function createAttachmentManifest(attachments?: readonly Attachment[]): AttachmentManifest;
export declare function attachmentsForReference(manifest: AttachmentManifest, referenceId: string): readonly Attachment[];
/**
 * Usado por merge/rename de referência (F54/F55): move todo anexo de
 * `fromReferenceId` para `toReferenceId`. Quando a canônica já tem um anexo
 * do mesmo papel+tipo, preserva o dela e descarta o da duplicata — mesma
 * regra de "quem já tem, mantém" do modelo v1, agora por papel em vez de
 * global (v1 só tinha um anexo possível, então as duas regras coincidiam).
 */
export declare function retargetAttachments(manifest: AttachmentManifest, fromReferenceId: string, toReferenceId: string): AttachmentManifest;
/** Nunca reescreve o histórico: versão nova é sempre acrescentada, mais recente por último. */
export declare function addAttachmentVersion(attachment: Attachment, version: AttachmentVersion): Attachment;
export declare function latestAttachmentVersion(attachment: Attachment): AttachmentVersion;
/** Scanner determinístico: nunca preserva marcação executável, só o texto. */
export declare function sanitizeSnapshotHtml(html: string): string;
export interface AttachmentFilenameInput {
    readonly surname?: string;
    readonly year?: string | number;
    readonly title?: string;
    readonly extension: string;
}
/** Sugestão só — quem confirma o nome final é o usuário, nunca é escrita automática. */
export declare function suggestAttachmentFilename(input: AttachmentFilenameInput): string;
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
export declare function checkAttachmentHealth(manifest: AttachmentManifest, context: AttachmentHealthContext): readonly AttachmentHealthIssue[];
/** Formato anterior (P/F35): um único PDF por referência, sem papel nem versão. */
export interface LegacyReferenceAttachment {
    readonly referenceId: string;
    readonly fileId: string;
    readonly path: string;
    readonly mediaType: 'application/pdf';
}
interface LegacyAttachmentManifest {
    readonly version: 1;
    readonly attachments: readonly LegacyReferenceAttachment[];
}
/** Migração versionada: v1 vira o anexo `primary` com uma versão só, sem perder fileId/path. */
export declare function migrateAttachmentManifest(input: LegacyAttachmentManifest): AttachmentManifest;
/** Entrada única de leitura: aceita v1 (migra), v2 (revalida) ou lixo (vira manifesto vazio). Entrada individual corrompida é descartada, nunca derruba o manifesto inteiro. */
export declare function parseAttachmentManifest(input: unknown): AttachmentManifest;
export {};
//# sourceMappingURL=index.d.ts.map