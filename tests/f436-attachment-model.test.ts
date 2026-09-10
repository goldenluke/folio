import { describe, expect, it } from 'vitest';

import {
  addAttachmentVersion,
  attachmentsForReference,
  checkAttachmentHealth,
  createAttachment,
  createAttachmentManifest,
  latestAttachmentVersion,
  migrateAttachmentManifest,
  parseAttachmentManifest,
  retargetAttachments,
  sanitizeSnapshotHtml,
  suggestAttachmentFilename,
} from '../packages/attachment-model/src/index.js';

describe('F436–F446 — Attachment Model 2.0', () => {
  it('aceita múltiplos anexos com papéis distintos para a mesma referência', () => {
    const primary = createAttachment({ id: 'a1', referenceId: 'silva2026', kind: 'file', role: 'primary', mediaType: 'application/pdf', versions: [{ versionId: 'v1', createdAt: '2026-01-01T00:00:00.000Z', fileId: 'file_1', path: 'papers/silva2026.pdf' }] });
    const supplementary = createAttachment({ id: 'a2', referenceId: 'silva2026', kind: 'file', role: 'supplementary', mediaType: 'application/zip', displayTitle: 'Material suplementar', versions: [{ versionId: 'v1', createdAt: '2026-01-02T00:00:00.000Z', fileId: 'file_2', path: 'papers/silva2026-supp.zip' }] });
    const manifest = createAttachmentManifest([primary, supplementary]);
    const forReference = attachmentsForReference(manifest, 'silva2026');
    expect(forReference).toHaveLength(2);
    expect(forReference.map((attachment) => attachment.role)).toEqual(['primary', 'supplementary']);
  });

  it('rejeita anexo sem identidade, papel inválido ou sem versão', () => {
    expect(() => createAttachment({ id: '', referenceId: 'x', kind: 'file', role: 'primary', mediaType: 'application/pdf', versions: [] })).toThrow();
    expect(() => createAttachment({ id: 'a1', referenceId: 'x', kind: 'file', role: 'invalid' as never, mediaType: 'application/pdf', versions: [{ versionId: 'v1', createdAt: '2026-01-01', fileId: 'f', path: 'p' }] })).toThrow('Papel');
    expect(() => createAttachment({ id: 'a1', referenceId: 'x', kind: 'file', role: 'primary', mediaType: 'application/pdf', versions: [] })).toThrow('versão');
  });

  it('exige URI HTTP(S) para anexos de link e nunca preserva HTML executável em snapshot', () => {
    const link = createAttachment({
      id: 'a3', referenceId: 'silva2026', kind: 'link', role: 'snapshot', mediaType: 'text/html',
      versions: [{ versionId: 'v1', createdAt: '2026-01-01T00:00:00.000Z', uri: 'https://example.org/artigo', snapshotText: sanitizeSnapshotHtml('<p>Resumo</p><script>alert(1)</script>') }],
    });
    expect(latestAttachmentVersion(link).snapshotText).toBe('Resumo');
    expect(() => createAttachment({ id: 'a4', referenceId: 'x', kind: 'link', role: 'snapshot', mediaType: 'text/html', versions: [{ versionId: 'v1', createdAt: '2026-01-01', uri: 'javascript:alert(1)' }] })).toThrow('URI');
  });

  it('acrescenta versão sem descartar histórico e aponta a versão mais recente', () => {
    const attachment = createAttachment({ id: 'a1', referenceId: 'silva2026', kind: 'file', role: 'primary', mediaType: 'application/pdf', versions: [{ versionId: 'v1', createdAt: '2026-01-01T00:00:00.000Z', fileId: 'file_1', path: 'papers/silva2026.pdf' }] });
    const updated = addAttachmentVersion(attachment, { versionId: 'v2', createdAt: '2026-02-01T00:00:00.000Z', fileId: 'file_3', path: 'papers/silva2026-v2.pdf', note: 'Errata do autor' });
    expect(updated.versions).toHaveLength(2);
    expect(latestAttachmentVersion(updated).fileId).toBe('file_3');
    expect(attachment.versions).toHaveLength(1);
    expect(() => addAttachmentVersion(updated, { versionId: 'v2', createdAt: '2026-03-01T00:00:00.000Z', fileId: 'file_4', path: 'papers/silva2026-v3.pdf' })).toThrow('duplicada');
  });

  it('sugere nome de arquivo determinístico a partir de metadado bibliográfico, sem escrever nada', () => {
    expect(suggestAttachmentFilename({ surname: 'Silva', year: 2026, title: 'Ensino híbrido em ABNT', extension: '.PDF' })).toBe('silva-2026-ensino-hibrido-em-abnt.pdf');
    expect(suggestAttachmentFilename({ extension: 'pdf' })).toBe('anexo.pdf');
  });

  it('relata anexos órfãos e arquivos ausentes sem tocar filesystem', () => {
    const manifest = createAttachmentManifest([
      createAttachment({ id: 'a1', referenceId: 'silva2026', kind: 'file', role: 'primary', mediaType: 'application/pdf', versions: [{ versionId: 'v1', createdAt: '2026-01-01', fileId: 'file_1', path: 'papers/silva2026.pdf' }] }),
      createAttachment({ id: 'a2', referenceId: 'removida2020', kind: 'file', role: 'primary', mediaType: 'application/pdf', versions: [{ versionId: 'v1', createdAt: '2026-01-01', fileId: 'file_missing', path: 'papers/removida2020.pdf' }] }),
    ]);
    const issues = checkAttachmentHealth(manifest, { existingFileIds: new Set(['file_1']), knownReferenceIds: new Set(['silva2026']) });
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ attachmentId: 'a2', code: 'missing-file' }),
      expect.objectContaining({ attachmentId: 'a2', code: 'orphan-reference' }),
    ]));
    expect(issues).toHaveLength(2);
  });

  it('migra o manifesto v1 (um PDF por referência) para v2 sem perder dado', () => {
    const legacy = { version: 1 as const, attachments: [{ referenceId: 'silva2026', fileId: 'file_1', path: 'papers/silva2026.pdf', mediaType: 'application/pdf' as const }] };
    const migrated = migrateAttachmentManifest(legacy);
    expect(migrated.version).toBe(2);
    expect(migrated.attachments).toHaveLength(1);
    expect(migrated.attachments[0]).toMatchObject({ referenceId: 'silva2026', role: 'primary', kind: 'file' });
    expect(latestAttachmentVersion(migrated.attachments[0]!)).toMatchObject({ fileId: 'file_1', path: 'papers/silva2026.pdf' });
    expect(parseAttachmentManifest(legacy)).toEqual(migrated);
  });

  it('retargetAttachments move todo anexo da duplicata, mas preserva o papel que a canônica já tinha', () => {
    const manifest = createAttachmentManifest([
      createAttachment({ id: 'silva2026-primary', referenceId: 'silva2026', kind: 'file', role: 'primary', mediaType: 'application/pdf', versions: [{ versionId: 'v1', createdAt: '2026-01-01', fileId: 'file_1', path: 'papers/silva2026.pdf' }] }),
      createAttachment({ id: 'dup-primary', referenceId: 'silva2026-dup', kind: 'file', role: 'primary', mediaType: 'application/pdf', versions: [{ versionId: 'v1', createdAt: '2026-01-02', fileId: 'file_2', path: 'papers/dup.pdf' }] }),
      createAttachment({ id: 'dup-dataset', referenceId: 'silva2026-dup', kind: 'file', role: 'dataset', mediaType: 'application/zip', versions: [{ versionId: 'v1', createdAt: '2026-01-03', fileId: 'file_3', path: 'papers/dup-dataset.zip' }] }),
    ]);
    const merged = retargetAttachments(manifest, 'silva2026-dup', 'silva2026');
    const forCanonical = attachmentsForReference(merged, 'silva2026');
    expect(forCanonical.map((attachment) => attachment.role).sort()).toEqual(['dataset', 'primary']);
    expect(latestAttachmentVersion(forCanonical.find((attachment) => attachment.role === 'primary')!).fileId).toBe('file_1');
    expect(attachmentsForReference(merged, 'silva2026-dup')).toHaveLength(0);
    expect(retargetAttachments(manifest, 'silva2026', 'silva2026')).toBe(manifest);
  });

  it('descarta entradas corrompidas do manifesto v2 sem derrubar as demais', () => {
    const manifest = parseAttachmentManifest({ version: 2, attachments: [{ id: 'a1', referenceId: 'x', kind: 'file', role: 'primary', mediaType: 'application/pdf', versions: [{ versionId: 'v1', createdAt: '2026-01-01', fileId: 'f', path: 'p' }] }, { id: 'a2' }] });
    expect(manifest.attachments).toHaveLength(1);
    expect(parseAttachmentManifest({ garbage: true })).toEqual({ version: 2, attachments: [] });
  });
});
