import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MessageChannel } from 'node:worker_threads';

import { expect, it } from 'vitest';

import { criarServicoDeCompiler, profileManifests } from '@abnt/compiler';
import { createInProcessCompilerClient, createWorkspaceMessagePortClient, serveWorkspaceOverMessagePort } from '@abnt/protocol';

import { DesktopWorkspaceServiceHost } from '../apps/desktop/src/workspace/workspace-service.js';

it('F96/F97/F99 — manifests são declarativos e a composição institucional preserva o profile base', async () => {
  const manifests = profileManifests();
  const institutional = manifests.find((profile) => profile.id === 'institutional-tcc');
  expect(manifests.map((profile) => profile.id)).toEqual(expect.arrayContaining(['abnt-artigo', 'abnt-artigo-numerico', 'abnt-tcc', 'web-article', 'institutional-tcc', 'apa-7-institutional', 'apa-7-university-program']));
  expect(institutional).toMatchObject({
    version: '1.0.0',
    composition: { baseProfileId: 'abnt-tcc', overrides: expect.arrayContaining(['page.margin', 'requiredMetadata']) },
    pagePolicy: { margin: { top: '2.5cm', left: '2.5cm' } },
  });
  expect(institutional?.rules.every((rule) => rule.id.length > 0 && rule.description.length > 0)).toBe(true);
});

it('F98/F101 — desktop recebe manifests e avalia um profile sem alterar o draft aberto', async () => {
  const root = await mkdtemp(join(tmpdir(), 'folio-f101-'));
  const host = DesktopWorkspaceServiceHost.create({ compiler: createInProcessCompilerClient(criarServicoDeCompiler()) });
  const channel = new MessageChannel();
  const stop = serveWorkspaceOverMessagePort(channel.port1, host);
  const client = createWorkspaceMessagePortClient(channel.port2);
  try {
    await writeFile(join(root, 'artigo.md'), '---\ntitle: Teste\nauthors: Pessoa\n---\n\n# Introdução\n\nTexto.\n', 'utf8');
    const opened = await client.open({ rootPath: root });
    if (!opened.ok) throw new Error('vault não abriu');
    const file = opened.value.files.find((candidate) => candidate.path === 'artigo.md');
    if (file === undefined) throw new Error('fixture incompleta');
    const editor = await client.openEditor({ fileId: file.fileId });
    if (!editor.ok) throw new Error('editor não abriu');
    const manifests = await client.profiles({});
    expect(manifests).toMatchObject({ ok: true, value: expect.arrayContaining([expect.objectContaining({ id: 'abnt-tcc', requiredMetadata: expect.any(Array) })]) });
    const before = await client.editorSnapshot({ fileId: file.fileId });
    if (!before.ok) throw new Error('snapshot não disponível');
    const preview = await client.previewProfileValidation({ fileId: file.fileId, expectedRevision: before.value.session.revision, profileId: 'institutional-tcc' });
    expect(preview).toMatchObject({ ok: true, value: { revision: before.value.session.revision, profileId: 'institutional-tcc', errors: expect.any(Number), warnings: expect.any(Number), errorDelta: expect.any(Number), warningDelta: expect.any(Number) } });
    const after = await client.editorSnapshot({ fileId: file.fileId });
    expect(after).toMatchObject({ ok: true, value: { session: { revision: before.value.session.revision, content: before.value.session.content }, previewProfileId: before.value.previewProfileId } });
  } finally {
    client.dispose(); stop(); channel.port1.close(); channel.port2.close();
    await host.dispose(); await rm(root, { recursive: true, force: true });
  }
});
