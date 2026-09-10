import type { AiContext, AiContextItem, AiDisclosure } from './model.js';

const allowed = new Set<AiContextItem['kind']>(['selection', 'document', 'section', 'reference', 'literature-note', 'pdf-annotation', 'project']);

/** Context is an explicit allow-list: callers must name every item they send. */
export function buildAiContext(items: readonly AiContextItem[]): AiContext {
  const ids = new Set<string>();
  return { items: items.flatMap((item) => {
    if (!allowed.has(item.kind) || item.id.trim() === '' || item.text.trim() === '' || ids.has(item.id)) return [];
    ids.add(item.id);
    return [{ ...item, text: item.text.trim() }];
  }) };
}

export function disclosureFor(provider: { readonly label: string; readonly external: boolean }, context: AiContext): AiDisclosure {
  const items = context.items.map((item) => ({ kind: item.kind, label: item.label, characters: item.text.length }));
  return { provider: provider.label, external: provider.external, items, totalCharacters: items.reduce((sum, item) => sum + item.characters, 0) };
}

export const contextAsPrompt = (context: AiContext): string => context.items.map((item, index) => `[${index + 1}] ${item.kind}: ${item.label}\n${item.text}`).join('\n\n');
