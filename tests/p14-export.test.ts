import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MessageChannel } from 'node:worker_threads';

import { describe, expect, it } from 'vitest';

import { criarServicoDeCompiler } from '@abnt/compiler';
import {
  createExportMessagePortClient,
  createInProcessCompilerClient,
  createWorkspaceMessagePortClient,
  serveExportOverMessagePort,
  serveWorkspaceOverMessagePort,
  type EditorExportDto,
  type MessagePortWorkspaceClient,
  type ProtocolResult,
} from '@abnt/protocol';

import { createExportService } from '../apps/desktop/src/export-service/service.js';
import { DesktopWorkspaceServiceHost } from '../apps/desktop/src/workspace/workspace-service.js';

const ARTICLE = '# Introdução\n\nTexto inicial com **destaque** e uma lista:\n\n- Um\n- Dois\n';

const withVault = async (run: (root: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), 'abnt-p14-'));
  try {
    await writeFile(join(root, 'artigo.md'), ARTICLE, 'utf8');
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

/** Mesmo motivo de `waitForPreview` em P10: exportDocument não é revisionado por push. */
const waitForExport = async (
  client: MessagePortWorkspaceClient,
  fileId: string,
  timeoutMs = 2000,
): Promise<ProtocolResult<EditorExportDto | undefined>> => {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const result = await client.exportDocument({ fileId });
    if (!result.ok || result.value !== undefined) return result;
    if (Date.now() > deadline) return result;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

describe('P14 — exportação PDF/DOCX sobre a Publication AST da sessão', () => {
  it('exportDocument expõe a mesma Publication AST que o preview usa', async () => {
    await withVault(async (root) => {
      const host = DesktopWorkspaceServiceHost.create({
        compiler: createInProcessCompilerClient(criarServicoDeCompiler()),
      });
      const channel = new MessageChannel();
      const stop = serveWorkspaceOverMessagePort(channel.port1, host);
      const client = createWorkspaceMessagePortClient(channel.port2);

      try {
        const opened = await client.open({ rootPath: root });
        if (!opened.ok) throw new Error('Vault deveria abrir.');
        const article = opened.value.files[0];
        if (article === undefined) throw new Error('Arquivo inicial ausente.');

        const editor = await client.openEditor({ fileId: article.fileId });
        if (!editor.ok) throw new Error('Editor deveria abrir.');

        const exported = await waitForExport(client, article.fileId);
        expect(exported).toMatchObject({ ok: true, value: { fileId: article.fileId } });
        if (!exported.ok || exported.value === undefined) throw new Error('Export deveria existir.');
        expect(exported.value.publication.title).toBeDefined();
        expect(exported.value.publication.children.length).toBeGreaterThan(0);

        const missing = await client.exportDocument({ fileId: 'file_inexistente' });
        expect(missing).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
      } finally {
        client.dispose();
        stop();
        channel.port1.close();
        channel.port2.close();
        await host.dispose();
      }
    });
  });

  it('Export Service gera DOCX real a partir da Publication AST recebida por MessagePort', async () => {
    await withVault(async (root) => {
      const host = DesktopWorkspaceServiceHost.create({
        compiler: createInProcessCompilerClient(criarServicoDeCompiler()),
      });
      const workspaceChannel = new MessageChannel();
      const stopWorkspace = serveWorkspaceOverMessagePort(workspaceChannel.port1, host);
      const workspaceClient = createWorkspaceMessagePortClient(workspaceChannel.port2);

      const exportChannel = new MessageChannel();
      const stopExport = serveExportOverMessagePort(exportChannel.port1, createExportService());
      const exportClient = createExportMessagePortClient(exportChannel.port2);

      try {
        const opened = await workspaceClient.open({ rootPath: root });
        if (!opened.ok) throw new Error('Vault deveria abrir.');
        const article = opened.value.files[0];
        if (article === undefined) throw new Error('Arquivo inicial ausente.');
        await workspaceClient.openEditor({ fileId: article.fileId });

        const exported = await waitForExport(workspaceClient, article.fileId);
        if (!exported.ok || exported.value === undefined) throw new Error('Export deveria existir.');

        const docx = await exportClient.export({ publication: exported.value.publication, format: 'docx' });
        expect(docx.ok).toBe(true);
        if (!docx.ok) return;
        expect(docx.value.bytes.byteLength).toBeGreaterThan(0);
        expect(docx.value.pages).toBeUndefined();
        // Assinatura ZIP (PK\x03\x04) — todo .docx é um contêiner OOXML/ZIP.
        expect(Array.from(docx.value.bytes.subarray(0, 2))).toEqual([0x50, 0x4b]);
      } finally {
        workspaceClient.dispose();
        stopWorkspace();
        workspaceChannel.port1.close();
        workspaceChannel.port2.close();
        exportClient.dispose();
        stopExport();
        exportChannel.port1.close();
        exportChannel.port2.close();
        await host.dispose();
      }
    });
  });

  it('Export Service gera PDF real via Paged.js/Chromium a partir da mesma Publication AST', async () => {
    await withVault(async (root) => {
      const host = DesktopWorkspaceServiceHost.create({
        compiler: createInProcessCompilerClient(criarServicoDeCompiler()),
      });
      const workspaceChannel = new MessageChannel();
      const stopWorkspace = serveWorkspaceOverMessagePort(workspaceChannel.port1, host);
      const workspaceClient = createWorkspaceMessagePortClient(workspaceChannel.port2);

      const exportChannel = new MessageChannel();
      const stopExport = serveExportOverMessagePort(exportChannel.port1, createExportService());
      const exportClient = createExportMessagePortClient(exportChannel.port2);

      try {
        const opened = await workspaceClient.open({ rootPath: root });
        if (!opened.ok) throw new Error('Vault deveria abrir.');
        const article = opened.value.files[0];
        if (article === undefined) throw new Error('Arquivo inicial ausente.');
        await workspaceClient.openEditor({ fileId: article.fileId });

        const exported = await waitForExport(workspaceClient, article.fileId);
        if (!exported.ok || exported.value === undefined) throw new Error('Export deveria existir.');

        const pdf = await exportClient.export({ publication: exported.value.publication, format: 'pdf' });
        expect(pdf.ok).toBe(true);
        if (!pdf.ok) return;
        expect(pdf.value.bytes.byteLength).toBeGreaterThan(0);
        expect(pdf.value.pages).toBeGreaterThanOrEqual(1);
        // Assinatura de arquivo PDF.
        expect(Buffer.from(pdf.value.bytes.subarray(0, 5)).toString('latin1')).toBe('%PDF-');
      } finally {
        workspaceClient.dispose();
        stopWorkspace();
        workspaceChannel.port1.close();
        workspaceChannel.port2.close();
        exportClient.dispose();
        stopExport();
        exportChannel.port1.close();
        exportChannel.port2.close();
        await host.dispose();
      }
    });
  }, 30_000);
});
