import { utilityProcess, type UtilityProcess } from 'electron';

import {
  createExportMessagePortClient,
  protocolError,
  type MessagePortExportClient,
  type MessagePortLike,
} from '@abnt/protocol';

export type ExportSupervisorStatus =
  | { readonly type: 'export:started' }
  | { readonly type: 'export:exited'; readonly code: number };

/**
 * Dono do utility process de exportação; Main só supervisiona, nunca gera o
 * arquivo. Mesmo papel que `CompilerSupervisor`/`WorkspaceSupervisor` cumprem
 * para seus processos — um único cliente memoizado, reiniciado sob demanda no
 * próximo pedido depois de um crash. Processo à parte porque o caminho de PDF
 * sobe um Chromium real via Puppeteer, que pode travar. Ver ADR 0019.
 */
export class ExportSupervisor {
  readonly #entryPath: string;
  readonly #listeners = new Set<(status: ExportSupervisorStatus) => void>();
  #child: UtilityProcess | undefined;
  #client: MessagePortExportClient | undefined;
  #stopping = false;

  constructor(entryPath: string) {
    this.#entryPath = entryPath;
  }

  subscribe(listener: (status: ExportSupervisorStatus) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  start(): MessagePortExportClient {
    if (this.#client !== undefined) return this.#client;
    // Ver WorkspaceSupervisor.start: sem este reset, reiniciar depois de dispose()
    // deixa 'export:exited' mudo para sempre.
    this.#stopping = false;
    const child = utilityProcess.fork(this.#entryPath, [], {
      serviceName: 'folio-export',
      stdio: 'pipe',
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      console.error(`[folio-export] ${chunk.toString('utf8')}`);
    });
    child.on('exit', (code: number) => {
      if (this.#child !== child) return;
      this.#child = undefined;
      // Encerramento inesperado (não veio de dispose()): quem estiver
      // aguardando uma exportação precisa de um erro de verdade, não do
      // cancelamento genérico — esse último some da UI de propósito (ver
      // comentário em MessagePortExportClient.dispose).
      this.#client?.dispose(
        this.#stopping
          ? undefined
          : protocolError('INTERNAL', 'O serviço de exportação encerrou inesperadamente.'),
      );
      this.#client = undefined;
      if (!this.#stopping) this.#emit({ type: 'export:exited', code });
    });
    this.#child = child;
    const processPort: MessagePortLike = {
      postMessage: (value) => child.postMessage(value),
      on: (_event, listener) => child.on('message', listener),
      off: (_event, listener) => child.off('message', listener),
    };
    this.#client = createExportMessagePortClient(processPort);
    this.#emit({ type: 'export:started' });
    return this.#client;
  }

  client(): MessagePortExportClient {
    return this.start();
  }

  dispose(): void {
    this.#stopping = true;
    this.#client?.dispose();
    this.#client = undefined;
    this.#child?.kill();
    this.#child = undefined;
  }

  #emit(status: ExportSupervisorStatus): void {
    for (const listener of this.#listeners) listener(status);
  }
}
