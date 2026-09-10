import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MessageChannel } from 'node:worker_threads';

import { describe, expect, it } from 'vitest';

import { criarServicoDeCompiler } from '@abnt/compiler';
import { createInProcessCompilerClient, createWorkspaceMessagePortClient, serveWorkspaceOverMessagePort } from '@abnt/protocol';

import { DesktopWorkspaceServiceHost } from '../apps/desktop/src/workspace/workspace-service.js';

describe('F436–F446 — Attachment Model 2.0 (integração de protocolo)', () => {
  it('múltiplos anexos por papel, versão, snapshot sanitizado, renomeação e saúde', async () => {
    const root = await mkdtemp(join(tmpdir(), 'abnt-f436-'));
    const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
    const channel = new MessageChannel();
    const stop = serveWorkspaceOverMessagePort(channel.port1, host);
    const client = createWorkspaceMessagePortClient(channel.port2);
    try {
      expect(await client.open({ rootPath: root })).toMatchObject({ ok: true });
      expect(await client.libraryUpsert({ entry: { id: 'silva2026', type: 'article-journal', title: 'Ensino híbrido em ABNT', author: [{ family: 'Silva' }], issued: { 'date-parts': [[2026]] } } })).toMatchObject({ ok: true });

      const primary = await client.addAttachment({ referenceId: 'silva2026', role: 'primary', kind: 'file', mediaType: 'application/pdf', name: 'RASCUNHO FINAL v3.pdf', base64: Buffer.from('%PDF-1.4\n').toString('base64') });
      expect(primary).toMatchObject({ ok: true, value: { referenceId: 'silva2026', role: 'primary', kind: 'file', suggestedFilename: 'silva-2026-ensino-hibrido-em-abnt.pdf', versions: [{ file: { mediaType: 'application/pdf' } }] } });
      if (!primary.ok) return;

      const supplementary = await client.addAttachment({ referenceId: 'silva2026', role: 'supplementary', kind: 'file', mediaType: 'application/zip', displayTitle: 'Dados brutos', name: 'dados.zip', base64: Buffer.from('PK').toString('base64') });
      expect(supplementary).toMatchObject({ ok: true, value: { role: 'supplementary', displayTitle: 'Dados brutos' } });

      const link = await client.addAttachment({ referenceId: 'silva2026', role: 'snapshot', kind: 'link', mediaType: 'text/html', uri: 'https://example.org/artigo', snapshotHtml: '<p>Resumo do artigo</p><script>alert(1)</script>' });
      expect(link).toMatchObject({ ok: true, value: { kind: 'link', versions: [{ uri: 'https://example.org/artigo', snapshotText: 'Resumo do artigo' }] } });
      if (!link.ok) return;
      expect(link.value.versions[0]?.snapshotText).not.toContain('script');

      const listed = await client.attachments({ referenceId: 'silva2026' });
      expect(listed).toMatchObject({ ok: true });
      if (listed.ok) expect(listed.value.map((item) => item.role).sort()).toEqual(['primary', 'snapshot', 'supplementary']);

      const versioned = await client.addAttachmentVersion({ attachmentId: primary.value.id, name: 'silva-2026-final.pdf', base64: Buffer.from('%PDF-1.4\nv2\n').toString('base64') });
      expect(versioned).toMatchObject({ ok: true });
      if (versioned.ok) expect(versioned.value.versions).toHaveLength(2);

      const renamed = await client.renameAttachmentFile({ attachmentId: primary.value.id, filename: 'silva-2026-ensino-hibrido-em-abnt.pdf' });
      expect(renamed).toMatchObject({ ok: true });
      if (renamed.ok) expect(renamed.value.versions.at(-1)?.path).toBe('resources/papers/silva-2026-ensino-hibrido-em-abnt.pdf');

      const healthyBefore = await client.attachmentHealth({});
      expect(healthyBefore).toMatchObject({ ok: true, value: [] });

      expect(await client.removeAttachment({ attachmentId: supplementary.ok ? supplementary.value.id : '' })).toMatchObject({ ok: true });
      const afterRemove = await client.attachments({ referenceId: 'silva2026' });
      if (afterRemove.ok) expect(afterRemove.value.map((item) => item.role).sort()).toEqual(['primary', 'snapshot']);

      // Corrompe o manifesto por fora do protocolo (ex.: sincronizador externo) para provar que a saúde detecta.
      const manifestPath = join(root, 'references', 'attachments.json');
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as { version: 2; attachments: readonly { referenceId: string; versions: readonly { fileId?: string }[] }[] };
      const corrupted = { ...manifest, attachments: manifest.attachments.map((entry) => ({ ...entry, versions: entry.versions.map((version) => version.fileId === undefined ? version : { ...version, fileId: 'file_inexistente' }) })) };
      await writeFile(manifestPath, JSON.stringify(corrupted), 'utf8');
      const healthAfter = await client.attachmentHealth({});
      expect(healthAfter).toMatchObject({ ok: true, value: [expect.objectContaining({ code: 'missing-file', referenceId: 'silva2026' })] });

      // F35/F36 (formato v1 legado): attachReferencePdf/referenceAttachments continuam funcionando sobre o mesmo manifesto v2.
      expect(await client.attachReferencePdf({ referenceId: 'silva2026', name: 'legado.pdf', base64: Buffer.from('%PDF-1.4\nlegado\n').toString('base64') })).toMatchObject({ ok: true });
      expect(await client.referenceAttachments({})).toMatchObject({ ok: true, value: [expect.objectContaining({ referenceId: 'silva2026' })] });
    } finally {
      client.dispose(); stop(); channel.port1.close(); channel.port2.close(); await host.dispose(); await rm(root, { recursive: true, force: true });
    }
  });

  it('migra um manifesto v1 escrito diretamente no disco (vault anterior à Onda BH) ao listar anexos v2', async () => {
    const root = await mkdtemp(join(tmpdir(), 'abnt-f436-migrate-'));
    const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
    const channel = new MessageChannel();
    const stop = serveWorkspaceOverMessagePort(channel.port1, host);
    const client = createWorkspaceMessagePortClient(channel.port2);
    try {
      expect(await client.open({ rootPath: root })).toMatchObject({ ok: true });
      expect(await client.libraryUpsert({ entry: { id: 'silva2020', type: 'article-journal', title: 'Artigo antigo' } })).toMatchObject({ ok: true });
      const legacyManifest = { version: 1, attachments: [{ referenceId: 'silva2020', fileId: 'file_legado', path: 'papers/antigo.pdf', mediaType: 'application/pdf' }] };
      expect(await client.createDocument({ path: 'references/attachments.json', content: JSON.stringify(legacyManifest) })).toMatchObject({ ok: true });

      const listed = await client.attachments({ referenceId: 'silva2020' });
      expect(listed).toMatchObject({ ok: true, value: [expect.objectContaining({ role: 'primary', kind: 'file', mediaType: 'application/pdf' })] });
      if (listed.ok) expect(listed.value[0]?.versions).toMatchObject([{ path: 'papers/antigo.pdf' }]);

      // A próxima escrita no manifesto (ex.: um novo anexo) já sai em v2 — nunca regrava v1.
      expect(await client.addAttachment({ referenceId: 'silva2020', role: 'supplementary', kind: 'link', mediaType: 'text/html', uri: 'https://example.org' })).toMatchObject({ ok: true });
      const manifestFile = (await client.list({})).ok ? (await client.list({})).value.find((file) => file.path === 'references/attachments.json') : undefined;
      if (manifestFile !== undefined) {
        const current = await client.read({ fileId: manifestFile.fileId });
        if (current.ok) expect((JSON.parse(current.value.content) as { version: number }).version).toBe(2);
      }
    } finally {
      client.dispose(); stop(); channel.port1.close(); channel.port2.close(); await host.dispose(); await rm(root, { recursive: true, force: true });
    }
  });
});
