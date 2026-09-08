import {
  PROTOCOL_VERSION,
  protocolError,
  type CompilerCompileRequest,
  type CompilerPrepareRequest,
  type CompilerService,
  type MessagePortLike,
  type ProtocolEnvelope,
  type ProtocolResponseEnvelope,
  type ProtocolResult,
} from './model.js';
import {
  compilationResultDtoSchema,
  compilerCompileRequestSchema,
  compilerPrepareRequestSchema,
  preparedCompilationDtoSchema,
  protocolEnvelopeSchema,
  protocolResponseEnvelopeSchema,
  validarDto,
  validarResultadoDoProtocolo,
  validarVersaoDoProtocolo,
} from './schemas.js';
import { attachMessageListener, type MessagePortUnsubscribe } from './message-port.js';

type Unsubscribe = MessagePortUnsubscribe;

const cancellation = () => protocolError('CANCELLED', 'Operação cancelada.');

const internalError = () => protocolError('INTERNAL', 'Falha interna do serviço.');

const isCancelled = (signal?: AbortSignal): boolean => signal?.aborted ?? false;

const enviarResposta = (port: MessagePortLike, id: string, result: ProtocolResult<unknown>): void => {
  port.postMessage({ version: PROTOCOL_VERSION, kind: 'response', id, result } satisfies ProtocolResponseEnvelope);
};

const chamarComProtecao = async <T>(
  operation: () => Promise<ProtocolResult<T>>,
  signal?: AbortSignal,
): Promise<ProtocolResult<T>> => {
  if (isCancelled(signal)) return cancellation();
  try {
    const result = await operation();
    return isCancelled(signal) ? cancellation() : result;
  } catch {
    return isCancelled(signal) ? cancellation() : internalError();
  }
};

/**
 * Adaptador local que aplica a mesma validação de entrada e saída do transporte
 * MessagePort. Assim, testes e hosts in-process não ganham um contrato menor.
 */
export function createInProcessCompilerClient(service: CompilerService): CompilerService {
  return {
    async prepare(request, signal) {
      const input = validarDto(compilerPrepareRequestSchema, request);
      if (!input.ok) return input;
      const result = await chamarComProtecao(() => service.prepare(input.value, signal), signal);
      const checked = validarResultadoDoProtocolo(result, preparedCompilationDtoSchema);
      return checked.ok ? checked.value : checked;
    },
    async compile(request, signal) {
      const input = validarDto(compilerCompileRequestSchema, request);
      if (!input.ok) return input;
      const result = await chamarComProtecao(() => service.compile(input.value, signal), signal);
      const checked = validarResultadoDoProtocolo(result, compilationResultDtoSchema);
      return checked.ok ? checked.value : checked;
    },
  };
}

/** Expõe um CompilerService através de um MessagePort sem importar Node ou Electron. */
export function serveCompilerOverMessagePort(port: MessagePortLike, service: CompilerService): Unsubscribe {
  const local = createInProcessCompilerClient(service);
  const pending = new Map<string, AbortController>();

  const handleRequest = async (envelope: Extract<ProtocolEnvelope, { kind: 'request' }>): Promise<void> => {
    const version = validarVersaoDoProtocolo(envelope.version);
    if (!version.ok) {
      enviarResposta(port, envelope.id, version);
      return;
    }

    const controller = new AbortController();
    pending.set(envelope.id, controller);
    try {
      const result =
        envelope.method === 'compiler/prepare'
          ? await local.prepare(envelope.payload as CompilerPrepareRequest, controller.signal)
          : envelope.method === 'compiler/compile'
            ? await local.compile(envelope.payload as CompilerCompileRequest, controller.signal)
            : protocolError('UNSUPPORTED_METHOD', 'Método não suportado pelo Compiler Service.');
      enviarResposta(port, envelope.id, result);
    } finally {
      pending.delete(envelope.id);
    }
  };

  const unsubscribe = attachMessageListener(port, (value) => {
    const parsed = protocolEnvelopeSchema.safeParse(value);
    if (!parsed.success) return;
    const envelope = parsed.data;
    if (envelope.kind === 'cancel') {
      pending.get(envelope.id)?.abort();
      return;
    }
    if (envelope.kind === 'request' && envelope.method.startsWith('compiler/')) void handleRequest(envelope);
  });

  return () => {
    unsubscribe();
    for (const controller of pending.values()) controller.abort();
    pending.clear();
  };
}

interface PendingRequest {
  readonly resolve: (result: ProtocolResult<unknown>) => void;
  readonly schema: import('zod').z.ZodType<unknown>;
  readonly cleanupAbort: () => void;
}

export interface MessagePortCompilerClient extends CompilerService {
  dispose(): void;
}

/** Cliente MessagePort com descarte de respostas velhas e propagação de cancelamento. */
export function createCompilerMessagePortClient(port: MessagePortLike): MessagePortCompilerClient {
  let sequence = 0;
  const pending = new Map<string, PendingRequest>();

  const unsubscribe = attachMessageListener(port, (value) => {
    const envelope = protocolResponseEnvelopeSchema.safeParse(value);
    if (!envelope.success) return;
    const response = envelope.data;
    const request = pending.get(response.id);
    if (request === undefined) return;
    pending.delete(response.id);
    request.cleanupAbort();

    const version = validarVersaoDoProtocolo(response.version);
    if (!version.ok) {
      request.resolve(version);
      return;
    }

    const checked = validarResultadoDoProtocolo(response.result, request.schema);
    request.resolve(checked.ok ? checked.value : checked);
  });

  const request = <T>(
    method: 'compiler/prepare' | 'compiler/compile',
    payload: unknown,
    schema: import('zod').z.ZodType<unknown>,
    signal?: AbortSignal,
  ): Promise<ProtocolResult<T>> => {
    const input = validarDto<unknown>(
      method === 'compiler/prepare' ? compilerPrepareRequestSchema : compilerCompileRequestSchema,
      payload,
    );
    if (!input.ok) return Promise.resolve(input);
    if (isCancelled(signal)) return Promise.resolve(cancellation());

    sequence += 1;
    const id = `request-${sequence}`;
    return new Promise((resolve) => {
      const onAbort = () => {
        if (!pending.delete(id)) return;
        port.postMessage({ version: PROTOCOL_VERSION, kind: 'cancel', id });
        resolve(cancellation());
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      const cleanupAbort = () => signal?.removeEventListener('abort', onAbort);
      pending.set(id, { resolve: resolve as (result: ProtocolResult<unknown>) => void, schema, cleanupAbort });
      port.postMessage({ version: PROTOCOL_VERSION, kind: 'request', id, method, payload: input.value });
    });
  };

  return {
    prepare: (request, signal) => requestForPrepare(request, signal),
    compile: (request, signal) => requestForCompile(request, signal),
    dispose: () => {
      unsubscribe();
      for (const [id, entry] of pending) {
        entry.cleanupAbort();
        entry.resolve(cancellation());
        pending.delete(id);
      }
    },
  };

  function requestForPrepare(
    value: CompilerPrepareRequest,
    signal?: AbortSignal,
  ): Promise<ProtocolResult<import('./model.js').PreparedCompilationDto>> {
    return request('compiler/prepare', value, preparedCompilationDtoSchema, signal);
  }

  function requestForCompile(
    value: CompilerCompileRequest,
    signal?: AbortSignal,
  ): Promise<ProtocolResult<import('./model.js').CompilationResultDto>> {
    return request('compiler/compile', value, compilationResultDtoSchema, signal);
  }
}
