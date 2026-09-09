import type { CommandAutomationPreview, CommandContext, CommandRegistry } from './commands.js';

/** Uma macro persiste apenas dados JSON e ids de commands registrados. Nunca código. */
export interface CommandInvocation {
  readonly commandId: string;
  readonly args?: unknown;
}

export interface WorkspaceMacro {
  readonly id: string;
  readonly name: string;
  readonly commands: readonly CommandInvocation[];
}

export interface AutomationPlan {
  readonly steps: readonly { readonly invocation: CommandInvocation; readonly preview: CommandAutomationPreview }[];
  readonly requiresConfirmation: boolean;
}

const isJsonValue = (value: unknown): boolean => value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
  || (Array.isArray(value) && value.every(isJsonValue))
  || (typeof value === 'object' && value !== null && Object.values(value).every(isJsonValue));

export function parseWorkspaceMacros(value: unknown): readonly WorkspaceMacro[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return [];
    const data = entry as { id?: unknown; name?: unknown; commands?: unknown };
    if (typeof data.id !== 'string' || typeof data.name !== 'string' || !Array.isArray(data.commands)) return [];
    const commands = data.commands.flatMap((step) => {
      if (typeof step !== 'object' || step === null || Array.isArray(step)) return [];
      const invocation = step as { commandId?: unknown; args?: unknown };
      if (typeof invocation.commandId !== 'string' || invocation.commandId === '' || (invocation.args !== undefined && !isJsonValue(invocation.args))) return [];
      return [{ commandId: invocation.commandId, ...(invocation.args === undefined ? {} : { args: invocation.args }) }];
    });
    return commands.length === data.commands.length ? [{ id: data.id, name: data.name, commands }] : [];
  });
}

/** Planeja antes de executar: um step sem metadado não é automatizável. */
export function planAutomation(registry: CommandRegistry, context: CommandContext, commands: readonly CommandInvocation[]): AutomationPlan {
  const steps = commands.map((invocation) => {
    if (invocation.commandId.startsWith('macro.')) throw new Error('Macros não podem chamar outras macros.');
    const preview = registry.automationPreview(invocation.commandId, context, invocation.args);
    if (preview === undefined) throw new Error(`O comando ${invocation.commandId} não pode ser automatizado.`);
    if (!registry.isEnabled(invocation.commandId, context, invocation.args)) throw new Error(`O comando ${invocation.commandId} não está disponível neste contexto.`);
    return { invocation, preview };
  });
  return { steps, requiresConfirmation: steps.some((step) => step.preview.requiresConfirmation === true) };
}

/** Chain sequencial, sempre pelo registry — não pula transactions nem o Workspace Service. */
export async function executeAutomation(registry: CommandRegistry, context: CommandContext, plan: AutomationPlan): Promise<void> {
  for (const step of plan.steps) await registry.execute(step.invocation.commandId, context, step.invocation.args);
}
