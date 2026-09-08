import { utilityProcess, type UtilityProcess } from 'electron';

import { createCompilerMessagePortClient, type MessagePortCompilerClient, type MessagePortLike } from '@abnt/protocol';

export type CompilerSupervisorStatus =
  | { readonly type: 'compiler:started' }
  | { readonly type: 'compiler:exited'; readonly code: number };

/** Dono do utility process do compilador; Main só supervisiona, nunca compila. */
export class CompilerSupervisor {
  readonly #entryPath: string;
  readonly #listeners = new Set<(status: CompilerSupervisorStatus) => void>();
  #child: UtilityProcess | undefined;
  #client: MessagePortCompilerClient | undefined;
  #stopping = false;

  constructor(entryPath: string) {
    this.#entryPath = entryPath;
  }

  subscribe(listener: (status: CompilerSupervisorStatus) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  start(): void {
    if (this.#child !== undefined) return;
    // Ver WorkspaceSupervisor.start: sem este reset, reiniciar depois de dispose()
    // deixa 'compiler:exited' mudo para sempre.
    this.#stopping = false;
    const child = utilityProcess.fork(this.#entryPath, [], {
      serviceName: 'folio-compiler',
      stdio: 'pipe',
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      console.error(`[folio-compiler] ${chunk.toString('utf8')}`);
    });
    child.on('exit', (code: number) => {
      if (this.#child !== child) return;
      this.#child = undefined;
      this.#client?.dispose();
      this.#client = undefined;
      if (!this.#stopping) this.#emit({ type: 'compiler:exited', code });
    });
    this.#child = child;
    const processPort: MessagePortLike = {
      postMessage: (value) => child.postMessage(value),
      on: (_event, listener) => child.on('message', listener),
      off: (_event, listener) => child.off('message', listener),
    };
    this.#client = createCompilerMessagePortClient(processPort);
    this.#emit({ type: 'compiler:started' });
  }

  /** Cliente do Main usado somente como endpoint do relay de envelopes. */
  client(): MessagePortCompilerClient {
    this.start();
    if (this.#client === undefined) throw new Error('O Compiler Service não está disponível.');
    return this.#client;
  }

  dispose(): void {
    this.#stopping = true;
    this.#client?.dispose();
    this.#client = undefined;
    this.#child?.kill();
    this.#child = undefined;
  }

  #emit(status: CompilerSupervisorStatus): void {
    for (const listener of this.#listeners) listener(status);
  }
}
