/**
 * Calcula o salto de foco no limite de um diálogo. Mantê-lo puro permite
 * exercitar Tab/Shift+Tab sem depender do DOM do Electron.
 */
export function focusTrapDestination<T>(
  targets: readonly T[],
  active: T | null,
  shiftKey: boolean,
): T | undefined {
  const first = targets[0];
  const last = targets.at(-1);
  if (first === undefined || last === undefined) return undefined;
  if (shiftKey && active === first) return last;
  if (!shiftKey && active === last) return first;
  return undefined;
}
