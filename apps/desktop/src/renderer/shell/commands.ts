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
}

export interface Command {
  readonly id: string;
  readonly title: string;
  /** Se ausente, o comando está sempre disponível para o contexto atual. */
  isEnabled?(context: CommandContext): boolean;
  run(context: CommandContext): void | Promise<void>;
}

export interface CommandRegistry {
  register(command: Command): () => void;
  execute(id: string, context: CommandContext): Promise<void>;
  isEnabled(id: string, context: CommandContext): boolean;
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
    async execute(id, context) {
      const command = commands.get(id);
      if (command === undefined) throw new Error(`Comando desconhecido: ${id}`);
      if (command.isEnabled?.(context) === false) return;
      await command.run(context);
    },
    isEnabled(id, context) {
      const command = commands.get(id);
      if (command === undefined) return false;
      return command.isEnabled?.(context) ?? true;
    },
    list() {
      return [...commands.values()];
    },
  };
}
