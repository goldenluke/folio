import type { ViewId } from './views.js';

/**
 * Um command não depende de componente React específico. Menus, keybindings,
 * command palette e (futuramente) plugins disparam pelo mesmo registro; só a
 * apresentação muda. Ver "Command System" no roteiro de P9.
 */
export interface CommandContext {
  readonly workspaceId?: string;
  readonly activeViewId?: ViewId;
  readonly activeFileId?: string;
  /** Alvo explícito para comandos que abrem algo específico, como `document.open`. */
  readonly targetFile?: { readonly fileId: string; readonly path: string };
  /** Alvo explícito para `citation.insert`. */
  readonly targetReference?: { readonly id: string };
  /** Transação editorial declarativa para inserir/substituir uma citação. */
  readonly targetCitation?: { readonly range: { readonly start: number; readonly end: number }; readonly text: string };
  readonly targetCrossReference?: { readonly identifier: string; readonly presentation?: string };
  /** Alvo explícito para `mention.linkify` (F32) — sugestão vira link só com este clique. */
  readonly targetMention?: {
    readonly range: { readonly start: number; readonly end: number };
    readonly text: string;
    readonly targetPath: string;
  };
  /** F72/F75: resultado explicitamente selecionado na Search View. */
  readonly targetSearchResult?: {
    readonly fileId: string;
    readonly path: string;
    readonly title: string;
    readonly section?: { readonly title: string; readonly range: { readonly start: number; readonly end: number } };
  };
  /** Consulta explícita para salvar/copiar; não depende do estado de um componente. */
  readonly targetSearchQuery?: string;
  /** F114: alvo explícito de uma ação em lote; nunca é inferido pelo componente. */
  readonly selectedFiles?: readonly { readonly fileId: string; readonly path: string }[];
  /** F312–F318: alvo explícito para `bookmark.remove`. */
  readonly targetBookmark?: { readonly id: string };
}

/**
 * A fronteira de argumentos de command é deliberadamente pequena. Commands do
 * renderer não aceitam objetos arbitrários de macros/plugins: cada command que
 * recebe argumentos opt-in valida sua forma antes de executar.
 */
export interface CommandArgumentSchema {
  safeParse(value: unknown):
    | { readonly success: true; readonly data: unknown }
    | { readonly success: false; readonly message?: string };
}

export interface CommandAutomationPreview {
  readonly summary: string;
  /** Escrita/exportação pede confirmação antes de uma macro prosseguir. */
  readonly requiresConfirmation?: boolean;
}

export interface Command {
  readonly id: string;
  readonly title: string;
  /** F145: metadados de descoberta; não criam um segundo registry. */
  readonly category?: string;
  readonly aliases?: readonly string[];
  /** Ausente significa que o command não aceita argumentos. */
  readonly arguments?: CommandArgumentSchema;
  /** Só commands declarados aqui podem participar de chains/macros locais. */
  readonly automationPreview?: (context: CommandContext, args: unknown) => CommandAutomationPreview;
  /** Se ausente, o comando está sempre disponível para o contexto atual. */
  isEnabled?(context: CommandContext, args: unknown): boolean;
  run(context: CommandContext, args: unknown): void | Promise<void>;
}

export interface CommandRegistry {
  register(command: Command): () => void;
  execute(id: string, context: CommandContext, args?: unknown): Promise<void>;
  isEnabled(id: string, context: CommandContext, args?: unknown): boolean;
  automationPreview(id: string, context: CommandContext, args?: unknown): CommandAutomationPreview | undefined;
  list(): readonly Command[];
}

export function createCommandRegistry(): CommandRegistry {
  const commands = new Map<string, Command>();

  return {
    register(command) {
      if (commands.has(command.id)) {
        throw new Error(`Comando duplicado: ${command.id}`);
      }
      commands.set(command.id, command);
      return () => commands.delete(command.id);
    },
    async execute(id, context, args) {
      const command = commands.get(id);
      if (command === undefined) throw new Error(`Comando desconhecido: ${id}`);
      const parsed = parseArguments(command, args);
      if (command.isEnabled?.(context, parsed) === false) return;
      await command.run(context, parsed);
    },
    isEnabled(id, context, args) {
      const command = commands.get(id);
      if (command === undefined) return false;
      try { return command.isEnabled?.(context, parseArguments(command, args)) ?? true; } catch { return false; }
    },
    automationPreview(id, context, args) {
      const command = commands.get(id);
      if (command?.automationPreview === undefined) return undefined;
      return command.automationPreview(context, parseArguments(command, args));
    },
    list() {
      return [...commands.values()];
    },
  };
}

function parseArguments(command: Command, args: unknown): unknown {
  if (command.arguments === undefined) {
    if (args === undefined) return undefined;
    throw new Error(`O comando ${command.id} não aceita argumentos.`);
  }
  const result = command.arguments.safeParse(args);
  if (!result.success) throw new Error(result.message ?? `Argumentos inválidos para ${command.id}.`);
  return result.data;
}
