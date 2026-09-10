import type { AiActionPreview, AiContext, AiSourceSuggestion } from './model.js';

export const academicInstruction = {
  summarize: 'Resuma o trecho selecionado com precisão acadêmica. Não invente fatos; indique incertezas.',
  literatureNote: 'Sugira uma estrutura de literature note: contribuição, método, resultados, limitações e citações de apoio. Não invente conteúdo.',
  compare: 'Compare as fontes fornecidas: semelhanças, diferenças, método e resultados. Identifique cada fonte pelo rótulo do contexto.',
  review: 'Revise coerência, redundância, estrutura e transições. Não aplique normas ABNT e não reescreva diretamente o documento.',
} as const;

const tokens = (text: string): Set<string> => new Set(text.toLocaleLowerCase('pt-BR').match(/[\p{L}\p{N}]{3,}/gu) ?? []);
const overlap = (a: Set<string>, b: Set<string>): number => { let shared = 0; for (const token of a) if (b.has(token)) shared += 1; return shared / Math.max(1, Math.sqrt(a.size * b.size)); };

/** Local lexical candidate finder; semantic ranking can replace scores when embeddings are available. */
export function claimToSource(claim: string, sources: readonly { readonly id: string; readonly text: string }[]): readonly AiSourceSuggestion[] {
  const query = tokens(claim);
  return sources.map((source) => ({ sourceId: source.id, score: overlap(query, tokens(source.text)), reason: 'sobreposição lexical no conteúdo selecionado' })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score);
}

export function semanticSearch(query: readonly number[], entries: readonly { readonly id: string; readonly embedding: readonly number[] }[]): readonly AiSourceSuggestion[] {
  const similarity = (a: readonly number[], b: readonly number[]): number => a.length !== b.length || a.length === 0 ? 0 : a.reduce((sum, value, index) => sum + value * (b[index] ?? 0), 0) / Math.sqrt(a.reduce((sum, value) => sum + value * value, 0) * b.reduce((sum, value) => sum + value * value, 0) || 1);
  return entries.map((entry) => ({ sourceId: entry.id, score: similarity(query, entry.embedding), reason: 'similaridade semântica por embedding' })).sort((a, b) => b.score - a.score);
}

/** Never performs an edit: the UI must explicitly dispatch the returned preview. */
export function actionPreview(before: string, after: string): AiActionPreview {
  let start = 0; while (start < before.length && start < after.length && before[start] === after[start]) start += 1;
  let end = 0; while (end < before.length - start && end < after.length - start && before[before.length - 1 - end] === after[after.length - 1 - end]) end += 1;
  return { before, after, removed: before.slice(start, before.length - end), inserted: after.slice(start, after.length - end) };
}

export function hybridSearch(lexical: readonly AiSourceSuggestion[], semantic: readonly AiSourceSuggestion[]): readonly AiSourceSuggestion[] {
  const scores = new Map<string, { lexical?: number; semantic?: number }>();
  for (const item of lexical) scores.set(item.sourceId, { ...scores.get(item.sourceId), lexical: item.score });
  for (const item of semantic) scores.set(item.sourceId, { ...scores.get(item.sourceId), semantic: item.score });
  return [...scores].map(([sourceId, score]) => ({ sourceId, score: (score.lexical ?? 0) * 0.4 + (score.semantic ?? 0) * 0.6, reason: 'ranking híbrido lexical + semântico' })).sort((a, b) => b.score - a.score);
}

export function citedContext(context: AiContext): readonly { readonly label: string; readonly source?: AiContext['items'][number]['source'] }[] { return context.items.map(({ label, source }) => ({ label, ...(source === undefined ? {} : { source }) })); }
