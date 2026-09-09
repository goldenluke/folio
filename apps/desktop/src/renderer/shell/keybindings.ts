import type { CommandContext, CommandRegistry } from './commands.js';

/**
 * Keybindings mapeiam chord → CommandId, nunca chord → callback embutido num
 * componente. É o que permite plugins e customização futura reaproveitarem o
 * mesmo mapa que atalhos nativos usam.
 */
export type KeyBindingMap = ReadonlyMap<string, string>;
export type CustomKeybindings = Readonly<Record<string, string>>;

export interface KeyLike {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
}

const isMac = (): boolean =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform ?? navigator.userAgent ?? '');

/** "mod" resolve para cmd no macOS e ctrl nas demais plataformas. */
export function chordFromEvent(event: KeyLike, macOverride: boolean = isMac()): string | undefined {
  const key = event.key.toLowerCase();
  if (['control', 'meta', 'shift', 'alt'].includes(key)) return undefined;
  const mod = macOverride ? event.metaKey : event.ctrlKey;
  const parts: string[] = [];
  if (mod) parts.push('mod');
  if (event.altKey) parts.push('alt');
  if (event.shiftKey) parts.push('shift');
  parts.push(key === ' ' ? 'space' : key);
  return parts.join('+');
}

/** Normaliza somente chords que a aplicação sabe produzir, para persistência estável. */
export function normalizeChord(value: string): string | undefined {
  const parts = value.trim().toLowerCase().split('+').map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return undefined;
  const key = parts.at(-1);
  if (key === undefined || ['control', 'meta', 'shift', 'alt', 'mod'].includes(key) || parts.filter((part) => part === 'mod').length > 1) return undefined;
  const modifiers = new Set(parts.slice(0, -1));
  if ([...modifiers].some((part) => !['mod', 'alt', 'shift'].includes(part))) return undefined;
  return [...(['mod', 'alt', 'shift'] as const).filter((part) => modifiers.has(part)), key === ' ' ? 'space' : key].join('+');
}

/** Preferências do usuário sobrescrevem o mapa padrão pelo mesmo chord. */
export function mergeKeybindings(defaults: KeyBindingMap, custom: CustomKeybindings): Map<string, string> {
  const merged = new Map(defaults);
  for (const [rawChord, commandId] of Object.entries(custom)) {
    const chord = normalizeChord(rawChord);
    if (chord !== undefined && commandId.trim() !== '') merged.set(chord, commandId);
  }
  return merged;
}

export function keybindingConflict(bindings: KeyBindingMap, chord: string, commandId: string): string | undefined {
  const normalized = normalizeChord(chord);
  if (normalized === undefined) return 'Atalho inválido.';
  const assigned = bindings.get(normalized);
  return assigned === undefined || assigned === commandId ? undefined : assigned;
}

/** Só faz preventDefault quando o chord está no mapa; digitação comum passa direto. */
export function registerKeybindings(options: {
  readonly registry: CommandRegistry;
  readonly bindings: KeyBindingMap;
  readonly context: () => CommandContext;
  readonly target: { addEventListener(type: 'keydown', listener: (event: KeyboardEvent) => void): void; removeEventListener(type: 'keydown', listener: (event: KeyboardEvent) => void): void };
}): () => void {
  const listener = (event: KeyboardEvent): void => {
    const chord = chordFromEvent(event);
    if (chord === undefined) return;
    const commandId = options.bindings.get(chord);
    if (commandId === undefined) return;
    event.preventDefault();
    void options.registry.execute(commandId, options.context());
  };
  options.target.addEventListener('keydown', listener);
  return () => options.target.removeEventListener('keydown', listener);
}
