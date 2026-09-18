import {
  PROTOCOL_VERSION,
  protocolError,
  type ExportRequest,
  type ExportResultDto,
  type ExportService,
  type MessagePortLike,
  type ProtocolEnvelope,
  type ProtocolResponseEnvelope,
  type ProtocolResult,
} from './model.js';
import {
  exportRequestSchema,
  exportResultDtoSchema,
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

/** Adaptador local com a mesma validação de entrada e saída do transporte MessagePort. */
export function createInProcessExportClient(service: ExportService): ExportService {
  return {
    async export(request, signal) {
      const input = validarDto(exportRequestSchema, request);
      if (!input.ok) return input;
      if (isCancelled(signal)) return cancellation();
      try {
        const result = await service.export(input.value, signal);
        if (isCancelled(signal)) return cancellation();
        const checked = validarResultadoDoProtocolo(result, exportResultDtoSchema);
        return checked.ok ? checked.value : checked;
      } catch {
        return isCancelled(signal) ? cancellation() : internalError();
      }
    },
  };
}

/** Expõe um ExportService através de um MessagePort sem importar Node ou Electron. */
export function serveExportOverMessagePort(port: MessagePortLike, service: ExportService): Unsubscribe {
  const local = createInProcessExportClient(service);
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
        envelope.method === 'export/run'
          ? await local.export(envelope.payload as ExportRequest, controller.signal)
          : protocolError('UNSUPPORTED_METHOD', 'Método não suportado pelo Export Service.');
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
    if (envelope.kind === 'request' && envelope.method === 'export/run') void handleRequest(envelope);
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

export interface MessagePortExportClient extends ExportService {
  /**
   * Resolve os pedidos pendentes com `reason` (padrão: cancelamento). Um
   * encerramento inesperado do processo filho deve passar um erro INTERNAL
   * aqui — do contrário o pedido pendente herda o código CANCELLED, e a UI
   * trata isso como "usuário cancelou" e esconde a mensagem de propósito
   * (ver `exportActiveDocument` em app.tsx), fazendo a falha real desaparecer
   * em silêncio.
   */
  dispose(reason?: ProtocolResult<unknown>): void;
}

/** Cliente MessagePort com descarte de respostas velhas e propagação de cancelamento. */
export function createExportMessagePortClient(port: MessagePortLike): MessagePortExportClient {
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

  return {
    export(value: ExportRequest, signal?: AbortSignal): Promise<ProtocolResult<ExportResultDto>> {
      const input = validarDto(exportRequestSchema, value);
      if (!input.ok) return Promise.resolve(input);
      if (isCancelled(signal)) return Promise.resolve(cancellation());
      sequence += 1;
      const id = `export-${sequence}`;
      return new Promise((resolve) => {
        const onAbort = () => {
          if (!pending.delete(id)) return;
          port.postMessage({ version: PROTOCOL_VERSION, kind: 'cancel', id });
          resolve(cancellation());
        };
        signal?.addEventListener('abort', onAbort, { once: true });
        const cleanupAbort = () => signal?.removeEventListener('abort', onAbort);
        pending.set(id, {
          resolve: resolve as (result: ProtocolResult<unknown>) => void,
          schema: exportResultDtoSchema,
          cleanupAbort,
        });
        port.postMessage({ version: PROTOCOL_VERSION, kind: 'request', id, method: 'export/run', payload: input.value });
      });
    },
    dispose: (reason) => {
      unsubscribe();
      for (const [id, entry] of pending) {
        entry.cleanupAbort();
        entry.resolve(reason ?? cancellation());
        pending.delete(id);
      }
    },
  };
}
