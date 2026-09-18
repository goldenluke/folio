export type CitationIntentKind = 'support' | 'contrast' | 'background' | 'method' | 'definition';

export interface CitationIntent {
  readonly id: string;
  readonly fileId: string;
  readonly start: number;
  readonly end: number;
  readonly referenceIds: readonly string[];
  readonly kind: CitationIntentKind;
  readonly note?: string;
  readonly updatedAt: string;
}

export interface CitationIntentSet { readonly version: 1; readonly intents: readonly CitationIntent[]; }

export function createCitationIntent(input: Omit<CitationIntent, 'updatedAt'> & { readonly updatedAt?: string }): CitationIntent {
  if (input.id.trim() === '' || input.fileId.trim() === '' || input.referenceIds.length === 0 || input.start < 0 || input.end < input.start) throw new Error('Intenção de citação inválida.');
  return { ...input, updatedAt: input.updatedAt ?? new Date().toISOString() };
}

export function upsertCitationIntent(set: CitationIntentSet, intent: CitationIntent): CitationIntentSet {
  const next = set.intents.filter((item) => item.id !== intent.id);
  return { version: 1, intents: [...next, intent] };
}

export function removeCitationIntent(set: CitationIntentSet, id: string): CitationIntentSet {
  return { version: 1, intents: set.intents.filter((intent) => intent.id !== id) };
}

export function parseCitationIntentSet(value: unknown): CitationIntentSet {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Conjunto de intenções inválido.');
  const candidate = value as { version?: unknown; intents?: unknown };
  if (candidate.version !== 1 || !Array.isArray(candidate.intents)) throw new Error('Conjunto de intenções inválido.');
  const intents = candidate.intents.flatMap((item) => { try { return [createCitationIntent(item as CitationIntent)]; } catch { return []; } });
  return { version: 1, intents };
}
