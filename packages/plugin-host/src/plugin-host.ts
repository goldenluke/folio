import { fork, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';

import { asDocumentId, asNodeId, type Diagnostic } from '@abnt/document-model';
import {
  PLUGIN_PROTOCOL_VERSION,
  pluginCommandResponseMessageSchema,
  pluginExportResponseMessageSchema,
  pluginLintResponseMessageSchema,
  pluginReadyMessageSchema,
  type AbntLintPluginInfo,
  type PluginCommandContext,
  type PluginCommandResult,
  type PluginExportResult,
} from '@abnt/plugin-api';
import type { DiagnosticDto, PublicationDocument, ResolvedDocumentDto } from '@abnt/protocol';

export interface PluginHostOptions {
  /** Tempo máximo para o plugin anunciar `ready` depois de subir. */
  readonly startupTimeoutMs?: number;
}

const diagnosticoParaDominio = (dto: DiagnosticDto): Diagnostic => ({
  id: dto.id,
  severity: dto.severity,
  message: dto.message,
  ...(dto.nodeId !== undefined ? { nodeId: asNodeId(dto.nodeId) } : {}),
  ...(dto.source !== undefined
    ? { source: { documentId: asDocumentId(dto.source.documentId), start: dto.source.start, end: dto.source.end } }
    : {}),
});

interface PendingLint {
  readonly resolve: (diagnostics: readonly Diagnostic[]) => void;
  readonly reject: (error: Error) => void;
  readonly timer: NodeJS.Timeout;
}
interface PendingProduct<T> { readonly resolve: (value: T) => void; readonly reject: (error: Error) => void; readonly timer: NodeJS.Timeout; }

/**
 * Executa UM plugin de lint isolado num processo Node próprio
 * (`child_process.fork`, sem depender de Electron). Mesmo espírito de
 * `CompilerSupervisor`/`ExportSupervisor` do desktop: contenção de crash, não
 * sandbox de segurança — o plugin roda com as mesmas permissões do processo
 * host, só não pode travar quem o chamou. Ver ADR 0020.
 *
 * Uma instância cobre a vida de UM processo: se o plugin cai ou trava, quem
 * chama vê o erro e decide o que fazer (num `abnt lint` de um tiro, não faz
 * sentido reviver o processo no meio do comando). Sem reinício automático,
 * ao contrário dos supervisors do desktop, que existem para uma sessão longa
 * de usuário continuar funcionando.
 */
export class PluginHost {
  readonly #child: ChildProcess;
  readonly #pending = new Map<string, PendingLint>();
  readonly #pendingCommands = new Map<string, PendingProduct<PluginCommandResult>>();
  readonly #pendingExports = new Map<string, PendingProduct<PluginExportResult>>();
  readonly #entryPath: string;
  readonly #ready: Promise<AbntLintPluginInfo>;
  #dead = false;

  constructor(entryPath: string, options: PluginHostOptions = {}) {
    this.#entryPath = entryPath;
    const startupTimeoutMs = options.startupTimeoutMs ?? 5000;
    // Os packages do workspace exportam `./src/index.ts` direto, sem build
    // (mesma dívida do bin do CLI e do servidor do LSP — ver ROADMAP). Um
    // plugin que importa `@abnt/document-model` só resolve com `tsx`
    // registrado; plugins publicados como pacotes compilados não precisariam
    // disso. Ver ADR 0020.
    //
    // `execArgv` é uma lista fixa, nunca `[...process.execArgv, ...]`: se o
    // host já roda sob `tsx` (o CLI sempre roda), herdar o execArgv do pai e
    // ainda acrescentar '--import tsx' registra o loader em duplicidade —
    // tsx re-executa o processo para corrigir isso, e cada geração herda a
    // lista já duplicada da anterior. Sem o spread, uma bomba de fork real,
    // descoberta rodando isto à mão antes de escrever qualquer teste.
    this.#child = fork(entryPath, [], { stdio: 'pipe', execArgv: ['--conditions=development', '--import', 'tsx'] });

    this.#ready = new Promise<AbntLintPluginInfo>((resolve, reject) => {
      const cleanup = (): void => {
        clearTimeout(timer);
        this.#child.off('message', onMessage);
        this.#child.off('exit', onExit);
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Plugin não respondeu "ready" em ${startupTimeoutMs}ms: ${entryPath}`));
      }, startupTimeoutMs);
      const onMessage = (raw: unknown): void => {
        const parsed = pluginReadyMessageSchema.safeParse(raw);
        if (!parsed.success) return;
        cleanup();
        resolve(parsed.data.plugin);
      };
      const onExit = (code: number | null): void => {
        cleanup();
        reject(new Error(`Processo do plugin encerrou antes de responder "ready" (code ${code ?? 'null'}): ${entryPath}`));
      };
      this.#child.on('message', onMessage);
      this.#child.once('exit', onExit);
    });
    // Evita "unhandled rejection" quando o chamador nunca aguarda ready()
    // diretamente (ex.: só chama lint()) — a promessa original continua
    // rejeitando normalmente para quem de fato a aguarda.
    this.#ready.catch(() => {});

    this.#child.on('message', (raw: unknown) => {
      const parsed = pluginLintResponseMessageSchema.safeParse(raw);
      if (!parsed.success) return;
      const pending = this.#pending.get(parsed.data.requestId);
      if (pending === undefined) return;
      this.#pending.delete(parsed.data.requestId);
      clearTimeout(pending.timer);
      if (parsed.data.ok) pending.resolve(parsed.data.diagnostics.map(diagnosticoParaDominio));
      else pending.reject(new Error(parsed.data.error));
    });
    this.#child.on('message', (raw: unknown) => {
      const parsed = pluginCommandResponseMessageSchema.safeParse(raw); if (!parsed.success) return;
      const pending = this.#pendingCommands.get(parsed.data.requestId); if (pending === undefined) return;
      this.#pendingCommands.delete(parsed.data.requestId); clearTimeout(pending.timer);
      if (parsed.data.ok) pending.resolve(parsed.data.result); else pending.reject(new Error(parsed.data.error));
    });
    this.#child.on('message', (raw: unknown) => {
      const parsed = pluginExportResponseMessageSchema.safeParse(raw); if (!parsed.success) return;
      const pending = this.#pendingExports.get(parsed.data.requestId); if (pending === undefined) return;
      this.#pendingExports.delete(parsed.data.requestId); clearTimeout(pending.timer);
      if (parsed.data.ok) pending.resolve(parsed.data.result); else pending.reject(new Error(parsed.data.error));
    });

    this.#child.on('exit', (code) => {
      this.#dead = true;
      const error = new Error(`Processo do plugin encerrou (code ${code ?? 'null'}): ${entryPath}`);
      for (const [id, pending] of this.#pending) {
        clearTimeout(pending.timer);
        pending.reject(error);
        this.#pending.delete(id);
      }
      this.#rejectProduct(this.#pendingCommands, error);
      this.#rejectProduct(this.#pendingExports, error);
    });
  }

  /** Resolve com a identidade do plugin assim que ele confirmar que subiu. */
  ready(): Promise<AbntLintPluginInfo> {
    return this.#ready;
  }

  async lint(document: ResolvedDocumentDto, timeoutMs = 10_000): Promise<readonly Diagnostic[]> {
    await this.#ready;
    if (this.#dead) throw new Error(`Plugin já encerrou; não é possível pedir lint: ${this.#entryPath}`);
    const requestId = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(requestId);
        this.dispose();
        reject(new Error(`Plugin não respondeu em ${timeoutMs}ms: ${this.#entryPath}`));
      }, timeoutMs);
      this.#pending.set(requestId, { resolve, reject, timer });
      this.#child.send({ version: PLUGIN_PROTOCOL_VERSION, type: 'abnt-plugin/lint', requestId, document });
    });
  }

  async command(commandId: string, context: PluginCommandContext, timeoutMs = 10_000): Promise<PluginCommandResult> {
    await this.#ready;
    return this.#request(this.#pendingCommands, 'abnt-plugin/command', { commandId, context }, timeoutMs);
  }

  async export(exportId: string, publication: PublicationDocument, timeoutMs = 20_000): Promise<PluginExportResult> {
    await this.#ready;
    return this.#request(this.#pendingExports, 'abnt-plugin/export', { exportId, publication }, timeoutMs);
  }

  #request<T>(pending: Map<string, PendingProduct<T>>, type: 'abnt-plugin/command' | 'abnt-plugin/export', payload: object, timeoutMs: number): Promise<T> {
    if (this.#dead) return Promise.reject(new Error(`Plugin já encerrou; não é possível enviar pedido: ${this.#entryPath}`));
    const requestId = randomUUID();
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(requestId); this.dispose(); reject(new Error(`Plugin não respondeu em ${timeoutMs}ms: ${this.#entryPath}`)); }, timeoutMs);
      pending.set(requestId, { resolve, reject, timer });
      this.#child.send({ version: PLUGIN_PROTOCOL_VERSION, type, requestId, ...payload });
    });
  }

  #rejectProduct<T>(pending: Map<string, PendingProduct<T>>, error: Error): void {
    for (const [id, request] of pending) { clearTimeout(request.timer); request.reject(error); pending.delete(id); }
  }

  dispose(): void {
    if (this.#dead) return;
    this.#dead = true;
    this.#child.kill();
    const error = new Error(`Plugin encerrado: ${this.#entryPath}`);
    for (const [id, pending] of this.#pending) {
      clearTimeout(pending.timer);
      pending.reject(error);
      this.#pending.delete(id);
    }
    this.#rejectProduct(this.#pendingCommands, error);
    this.#rejectProduct(this.#pendingExports, error);
  }
}
