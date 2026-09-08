import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MessageChannel } from 'node:worker_threads';

import { describe, expect, it } from 'vitest';

import { criarServicoDeCompiler } from '@abnt/compiler';
import {
  createInProcessCompilerClient,
  createWorkspaceMessagePortClient,
  serveWorkspaceOverMessagePort,
  type EditorPreviewDto,
  type MessagePortWorkspaceClient,
  type ProtocolResult,
} from '@abnt/protocol';

import { DesktopWorkspaceServiceHost } from '../apps/desktop/src/workspace/workspace-service.js';

const ARTICLE = '# Introdução\n\nTexto inicial.\n';

const withVault = async (run: (root: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), 'abnt-p10-'));
  try {
    await writeFile(join(root, 'artigo.md'), ARTICLE, 'utf8');
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

/**
 * `previewEditor` não é revisionado por push — o cliente pede sob demanda.
 * Como o protocolo de desktop não expõe `idle()` (isso é detalhe do host, não
 * contrato de fio), esperar a compilação assentar aqui é sondar a mesma
 * chamada que um cliente real usaria, até parar de vir `undefined`.
 */
const waitForPreview = async (
  client: MessagePortWorkspaceClient,
  fileId: string,
  minRevision = 0,
  timeoutMs = 2000,
): Promise<ProtocolResult<EditorPreviewDto | undefined>> => {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const result = await client.previewEditor({ fileId });
    if (!result.ok || (result.value !== undefined && result.value.revision >= minRevision)) return result;
    if (Date.now() > deadline) return result;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

describe('P10 — preview rápido sob demanda', () => {
  it('renderiza a Publication AST já resolvida pela sessão e a revisiona corretamente', async () => {
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

        const firstPreview = await waitForPreview(client, article.fileId);
        expect(firstPreview).toMatchObject({ ok: true, value: { fileId: article.fileId } });
        if (!firstPreview.ok || firstPreview.value === undefined) throw new Error('Preview inicial deveria existir.');
        expect(firstPreview.value.html).toContain('Introdução');
        expect(firstPreview.value.html).toContain('<!doctype html>');
        expect(firstPreview.value.html).toContain('@media screen');
        expect(firstPreview.value.html).toContain('padding: 3cm 2cm 2cm 3cm');
        expect(firstPreview.value.html).toContain('width: 21cm');
        const firstRevision = firstPreview.value.revision;

        const changed = await client.dispatchEditor({
          fileId: article.fileId,
          expectedRevision: editor.value.session.revision,
          transaction: {
            edits: [{ range: { start: ARTICLE.length, end: ARTICLE.length }, text: '\n# Resultados\n\nDados novos.\n' }],
          },
        });
        if (!changed.ok) throw new Error('Edição deveria ser aceita.');
        // A sessão invalida o preview na hora (não deixa um stale visível) — some
        // até a próxima compilação terminar. `previewRevision`, quando presente,
        // sempre bate com a revisão real do preview: guardamos isso explícito no
        // próprio objeto (DocumentSessionPreview.revision) em vez de inferir de
        // session.revision, que já teria avançado neste ponto.
        expect(changed.value.session.revision).toBeGreaterThan(firstRevision);
        expect(changed.value.previewRevision).toBeUndefined();

        const secondPreview = await waitForPreview(client, article.fileId, firstRevision + 1);
        if (!secondPreview.ok || secondPreview.value === undefined) throw new Error('Preview atualizado deveria existir.');
        expect(secondPreview.value.revision).toBeGreaterThan(firstRevision);
        expect(secondPreview.value.html).toContain('Resultados');

        const missing = await client.previewEditor({ fileId: 'file_inexistente' });
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
});
