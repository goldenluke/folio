/**
 * Contrato mínimo de um passe semântico. O tipo é genérico para que novos
 * passes possam ser testados e reutilizados sem depender do pipeline atual.
 */
export interface SemanticPass<Input, Output, Context = undefined> {
  readonly id: string;
  execute(input: Input, context: Context): Output;
}

/** Executa passes homogêneos mantendo a ordem declarada visível e testável. */
export function executarPasses<Input, Context>(
  input: Input,
  passes: readonly SemanticPass<Input, Input, Context>[],
  context: Context,
): Input {
  return passes.reduce((current, pass) => pass.execute(current, context), input);
}
