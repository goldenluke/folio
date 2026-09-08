import { MessageChannel } from 'node:worker_threads';

import { describe, expect, it } from 'vitest';

import { criarServicoDeCompiler } from '@abnt/compiler';
import {
  createCompilerMessagePortClient,
  createInProcessCompilerClient,
  editorSnapshotRequestSchema,
  serveCompilerOverMessagePort,
  validarResultadoDoProtocolo,
  validarVersaoDoProtocolo,
  type CompilationEnvironmentDto,
  type CompilerPrepareRequest,
} from '@abnt/protocol';

const request: CompilerPrepareRequest = {
  source: {
    documentId: 'protocol.md',
    revision: 12,
    content: '# Introdução\n\nTexto com uma citação inexistente [@ausente].',
    contentHash: 'sha256:protocol-fixture',
  },
};

const environment: CompilationEnvironmentDto = {
  bibliography: { entries: {}, sources: [], provenanceByReference: {} },
  resources: {},
  dependencies: { bibliography: [], resources: [] },
};

describe('P1 — contrato versionado de serviços', () => {
  it('mantém resultado idêntico in-process e via MessagePort', async () => {
    const service = criarServicoDeCompiler();
    const local = createInProcessCompilerClient(service);
    const channel = new MessageChannel();
    const stop = serveCompilerOverMessagePort(channel.port1, service);
    const remote = createCompilerMessagePortClient(channel.port2);

    try {
      const [localPrepared, remotePrepared] = await Promise.all([
        local.prepare(request),
        remote.prepare(request),
      ]);
      expect(remotePrepared).toEqual(localPrepared);
      if (!localPrepared.ok || !remotePrepared.ok) throw new Error('Prepare deveria ter êxito.');

      const compileRequest = {
        prepared: localPrepared.value,
        environment: { environment, diagnostics: [] },
      };
      const [localCompiled, remoteCompiled] = await Promise.all([
        local.compile(compileRequest),
        remote.compile(compileRequest),
      ]);
      expect(remoteCompiled).toEqual(localCompiled);
      if (!localCompiled.ok) throw new Error('Compile deveria ter êxito.');
      expect(localCompiled.value.resolved.annotations).toBeDefined();
      expect(localCompiled.value.resolved.identifiers).toEqual({});
    } finally {
      remote.dispose();
      stop();
      channel.port1.close();
      channel.port2.close();
    }
  });

  it('rejeita DTO inválido antes de chamar a implementação', async () => {
    const client = createInProcessCompilerClient(criarServicoDeCompiler());
    const result = await client.prepare({ source: { ...request.source, revision: -1 } } as CompilerPrepareRequest);

    expect(result).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
  });

  it('recusa explicitamente uma versão futura do protocolo', () => {
    const result = validarVersaoDoProtocolo(2);

    expect(result).toMatchObject({ ok: false, error: { code: 'UNSUPPORTED_VERSION' } });
  });

  it('responde UNSUPPORTED_VERSION no transporte, antes de interpretar o payload', async () => {
    const service = criarServicoDeCompiler();
    const channel = new MessageChannel();
    const stop = serveCompilerOverMessagePort(channel.port1, service);
    const response = new Promise<unknown>((resolve) => channel.port2.once('message', resolve));

    try {
      channel.port2.postMessage({
        version: 2,
        kind: 'request',
        id: 'future-version',
        method: 'compiler/prepare',
        payload: { not: 'parsed' },
      });
      await expect(response).resolves.toMatchObject({
        version: 1,
        kind: 'response',
        id: 'future-version',
        result: { ok: false, error: { code: 'UNSUPPORTED_VERSION' } },
      });
    } finally {
      stop();
      channel.port1.close();
      channel.port2.close();
    }
  });
});

/**
 * O envelope de resultado deixou de embutir o schema do payload num `z.union` por
 * chamada — isso instanciava os internals do Zod sobre o DTO inteiro em cada call
 * site e estourava a heap do `tsc`. Agora a casca é validada antes e o payload
 * depois; estes testes fixam que o comportamento observável não mudou.
 * Ver docs/adr/0014.
 */
describe('P1 — envelope de resultado validado em duas etapas', () => {
  it('aceita sucesso e erro bem formados', () => {
    expect(validarResultadoDoProtocolo({ ok: true, value: { fileId: 'file_1' } }, editorSnapshotRequestSchema)).toEqual({
      ok: true,
      value: { ok: true, value: { fileId: 'file_1' } },
    });
    expect(
      validarResultadoDoProtocolo(
        { ok: false, error: { code: 'NOT_FOUND', message: 'sumiu' } },
        editorSnapshotRequestSchema,
      ),
    ).toMatchObject({ ok: true, value: { ok: false, error: { code: 'NOT_FOUND' } } });
  });

  it('recusa envelope malformado e payload fora do DTO, apontando o caminho', () => {
    expect(validarResultadoDoProtocolo({ resultado: 'nenhum' }, editorSnapshotRequestSchema)).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION' },
    });

    const payloadInvalido = validarResultadoDoProtocolo({ ok: true, value: { fileId: 42 } }, editorSnapshotRequestSchema);
    if (payloadInvalido.ok) throw new Error('Payload fora do DTO deveria ser recusado.');
    expect(payloadInvalido.error.code).toBe('VALIDATION');
    expect(payloadInvalido.error.problems?.[0]?.path).toBe('value.fileId');
  });
});
