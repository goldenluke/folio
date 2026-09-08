import type { Command, CommandContext, CommandRegistry } from './commands.js';

/**
 * Item apresentado pela palette. Esta é uma projection de commands ou de
 * arquivos já entregues pelo Workspace Service — não uma leitura de disco no
 * renderer.
 */
export interface PaletteItem {
  readonly id: string;
  readonly label: string;
  readonly detail?: string;
  readonly score: number;
}

export interface QuickOpenFile {
  readonly fileId: string;
  readonly path: string;
  readonly title?: string;
}

const normalize = (value: string): string => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase();

/**
 * Pontua uma subsequência: início de palavra e caracteres adjacentes valem
 * mais. É deliberadamente pequeno e determinístico, para não transformar a
 * Command Palette em uma dependência/algoritmo opaco.
 */
export function fuzzyScore(query: string, candidate: string): number | undefined {
  const needle = normalize(query).trim();
  const haystack = normalize(candidate);
  if (needle === '') return 0;

  let cursor = 0;
  let score = 0;
  let previous = -2;
  for (const character of needle) {
    const index = haystack.indexOf(character, cursor);
    if (index === -1) return undefined;
    score += 10;
    if (index === 0 || /[\s/_.:-]/u.test(haystack[index - 1] ?? '')) score += 8;
    if (index === previous + 1) score += 5;
    score -= Math.max(0, index - cursor);
    previous = index;
    cursor = index + 1;
  }
  return score;
}

const byScoreThenLabel = (left: PaletteItem, right: PaletteItem): number =>
  right.score - left.score || left.label.localeCompare(right.label, 'pt-BR');

export function rankCommands(registry: CommandRegistry, context: CommandContext, query: string): readonly PaletteItem[] {
  return registry
    .list()
    .filter((command) => registry.isEnabled(command.id, context))
    .flatMap((command: Command) => {
      const score = Math.max(fuzzyScore(query, command.title) ?? Number.NEGATIVE_INFINITY, fuzzyScore(query, command.id) ?? Number.NEGATIVE_INFINITY);
      return Number.isFinite(score) ? [{ id: command.id, label: command.title, detail: command.id, score }] : [];
    })
    .sort(byScoreThenLabel);
}

/**
 * A ordem dá preferência a título/nome, depois ao caminho, e usa recência só
 * como desempate de produto local. O conteúdo vem do FTS5, mas o arquivo
 * continua identificado pelo `WorkspaceFileId` estável.
 */
export function rankQuickOpenFiles(
  files: readonly QuickOpenFile[],
  query: string,
  recentFileIds: readonly string[],
): readonly PaletteItem[] {
  const recent = new Map(recentFileIds.map((fileId, index) => [fileId, recentFileIds.length - index]));
  return files
    .flatMap((file) => {
      const titleScore = file.title === undefined ? undefined : fuzzyScore(query, file.title);
      const pathScore = fuzzyScore(query, file.path);
      const score = Math.max(titleScore ?? Number.NEGATIVE_INFINITY, pathScore ?? Number.NEGATIVE_INFINITY);
      if (!Number.isFinite(score)) return [];
      return [{
        id: file.fileId,
        label: file.title ?? file.path,
        ...(file.title === undefined ? {} : { detail: file.path }),
        score: score + (recent.get(file.fileId) ?? 0),
      }];
    })
    .sort(byScoreThenLabel);
}
