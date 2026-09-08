import { utilityProcess, type UtilityProcess } from 'electron';

import {
  createWorkspaceMessagePortClient,
  serveCompilerOverMessagePort,
  validarDesktopEventDto,
  type DesktopEventDto,
  type MessagePortLike,
  type MessagePortWorkspaceClient,
} from '@abnt/protocol';

import { CompilerSupervisor } from './compiler-supervisor.js';

export type WorkspaceSupervisorStatus =
  | { readonly type: 'workspace:started' }
  | { readonly type: 'workspace:exited'; readonly code: number };

/** Mantém o workspace fora do Main e encaminha apenas DTOs validados. */
export class WorkspaceSupervisor {
  readonly #entryPath: string;
  readonly #compiler: CompilerSupervisor;
  readonly #events = new Set<(event: DesktopEventDto) => void>();
  readonly #status = new Set<(status: WorkspaceSupervisorStatus) => void>();
  #child: UtilityProcess | undefined;
  #client: MessagePortWorkspaceClient | undefined;
  #stopCompilerRelay: (() => void) | undefined;
  #stopping = false;

  constructor(entryPath: string, compiler: CompilerSupervisor) {
    this.#entryPath = entryPath;
    this.#compiler = compiler;
  }

  subscribe(listener: (event: DesktopEventDto) => void): () => void {
    this.#events.add(listener);
    return () => this.#events.delete(listener);
  }

  subscribeStatus(listener: (status: WorkspaceSupervisorStatus) => void): () => void {
    this.#status.add(listener);
    return () => this.#status.delete(listener);
  }

  start(): MessagePortWorkspaceClient {
    if (this.#client !== undefined) return this.#client;
    // Reiniciar após dispose() precisa voltar a reportar saída; senão o primeiro
    // crash silencia todos os seguintes e a UI nunca mais sabe que caiu.
    this.#stopping = false;
    this.#compiler.start();
    const child = utilityProcess.fork(this.#entryPath, [], {
      serviceName: 'folio-workspace',
      stdio: 'pipe',
    });
    // Falha antes do primeiro RPC não pode virar apenas timeout no renderer.
    child.stderr?.on('data', (chunk: Buffer) => {
      console.error(`[folio-workspace] ${chunk.toString('utf8')}`);
    });
    child.on('error', (error) => {
      console.error('[folio-workspace] falha ao iniciar o processo:', error);
    });
    child.on('message', (message) => {
      if (typeof message !== 'object' || message === null || !('type' in message)) return;
      if (message.type !== 'abnt:desktop-event' || !('event' in message)) return;
      const checked = validarDesktopEventDto(message.event);
      if (!checked.ok) return;
      for (const listener of this.#events) listener(checked.value);
    });
    child.on('exit', (code: number) => {
      if (this.#child !== child) return;
      if (!this.#stopping) console.error(`[folio-workspace] processo encerrado com código ${code}.`);
      this.#child = undefined;
      this.#stopCompilerRelay?.();
      this.#stopCompilerRelay = undefined;
      this.#client?.dispose();
      this.#client = undefined;
      if (!this.#stopping) this.#emitStatus({ type: 'workspace:exited', code });
    });
    this.#child = child;
    const processPort: MessagePortLike = {
      postMessage: (value) => child.postMessage(value),
      on: (_event, listener) => {
        child.on('message', listener);
      },
      off: (_event, listener) => {
        child.off('message', listener);
      },
    };
    this.#stopCompilerRelay = serveCompilerOverMessagePort(processPort, this.#compiler.client());
    this.#client = createWorkspaceMessagePortClient(processPort);
    this.#emitStatus({ type: 'workspace:started' });
    return this.#client;
  }

  client(): MessagePortWorkspaceClient {
    return this.start();
  }

  dispose(): void {
    this.#stopping = true;
    this.#client?.dispose();
    this.#client = undefined;
    this.#stopCompilerRelay?.();
    this.#stopCompilerRelay = undefined;
    this.#child?.kill();
    this.#child = undefined;
  }

  #emitStatus(status: WorkspaceSupervisorStatus): void {
    for (const listener of this.#status) listener(status);
  }
}
