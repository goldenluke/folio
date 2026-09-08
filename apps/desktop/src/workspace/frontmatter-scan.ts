import { parse as parseYaml } from 'yaml';

import { isMarkdownPath, type WorkspaceFile, type WorkspaceFileId, type WorkspaceStorage } from '@abnt/workspace-core';

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---/u;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const declaresBibliography = (value: unknown): boolean => {
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.some((item) => typeof item === 'string' && item.trim() !== '');
  return false;
};

/**
 * Pré-filtro barato (regex + YAML do frontmatter, nunca `@abnt/markdown`) para
 * reduzir o universo de documentos antes de abrir qualquer sessão de editor —
 * usado por F31 (Citation Explorer vault-wide) e F33 (grafo acadêmico). Só
 * decide "vale a pena abrir sessão"; a resolução real de bibliografia
 * continua vindo do pipeline de compilação existente (P12/ADR 0017).
 */
export async function scanBibliographyDeclarations(
  storage: WorkspaceStorage,
  files: readonly WorkspaceFile[],
): Promise<readonly WorkspaceFile[]> {
  const declared: WorkspaceFile[] = [];
  for (const file of files) {
    if (!isMarkdownPath(file.path)) continue;
    const { content } = await storage.read(file.id);
    const frontmatter = FRONTMATTER_PATTERN.exec(content)?.[1];
    if (frontmatter === undefined) continue;
    let parsed: unknown;
    try {
      parsed = parseYaml(frontmatter);
    } catch {
      continue;
    }
    if (isRecord(parsed) && declaresBibliography(parsed.bibliography)) declared.push(file);
  }
  return declared;
}

/** F41/F42: projeção de tags e properties autorais para o Query Planner. */
export interface WorkspaceQueryMetadata {
  readonly fileId: WorkspaceFileId;
  readonly tags: readonly string[];
  readonly properties: Readonly<Record<string, readonly string[]>>;
}

const textValues = (value: unknown): readonly string[] => {
  if (typeof value === 'string' || typeof value === 'number') return [String(value)];
  if (Array.isArray(value)) return value.flatMap(textValues);
  if (isRecord(value)) return Object.values(value).flatMap(textValues);
  return [];
};

export async function scanQueryMetadata(storage: WorkspaceStorage, files: readonly WorkspaceFile[]): Promise<readonly WorkspaceQueryMetadata[]> {
  const result: WorkspaceQueryMetadata[] = [];
  for (const file of files) {
    if (!isMarkdownPath(file.path)) continue;
    const { content } = await storage.read(file.id);
    const frontmatterMatch = FRONTMATTER_PATTERN.exec(content);
    let frontmatter: Record<string, unknown> = {};
    try {
      const parsed = frontmatterMatch === null ? undefined : parseYaml(frontmatterMatch[1] ?? '');
      if (isRecord(parsed)) frontmatter = parsed;
    } catch { /* metadata malformada continua responsabilidade dos diagnostics. */ }
    const body = frontmatterMatch === null ? content : content.slice(frontmatterMatch[0].length);
    const inlineTags = [...body.matchAll(/(?:^|[\s(])#([\p{L}\p{N}_/-]+)/gu)].map((match) => match[1] ?? '');
    const tags = [...new Set([...textValues(frontmatter.tags), ...inlineTags].map((tag) => tag.replace(/^#/u, '').trim()).filter(Boolean))];
    const properties: Record<string, readonly string[]> = {
      author: [...textValues(frontmatter.authors), ...textValues(frontmatter.author)],
      year: textValues(frontmatter.year),
      profile: textValues(frontmatter.profile),
      lang: [...textValues(frontmatter.language), ...textValues(frontmatter.lang)],
    };
    result.push({ fileId: file.id, tags, properties });
  }
  return result;
}

/** F47: campos de revisão vivem no frontmatter da literature note, não em outro modelo. */
export interface LiteratureReviewNoteMetadata {
  readonly file: WorkspaceFile;
  readonly referenceId: string;
  readonly review: {
    readonly topic?: string;
    readonly method?: string;
    readonly sample?: string;
    readonly result?: string;
  };
}

const optionalText = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;

export async function scanLiteratureReviewNotes(
  storage: WorkspaceStorage,
  files: readonly WorkspaceFile[],
): Promise<readonly LiteratureReviewNoteMetadata[]> {
  const notes: LiteratureReviewNoteMetadata[] = [];
  for (const file of files) {
    if (!isMarkdownPath(file.path)) continue;
    const { content } = await storage.read(file.id);
    const frontmatter = FRONTMATTER_PATTERN.exec(content)?.[1];
    if (frontmatter === undefined) continue;
    try {
      const parsed = parseYaml(frontmatter);
      if (!isRecord(parsed) || typeof parsed.sourceReference !== 'string' || parsed.sourceReference.trim() === '') continue;
      const review = isRecord(parsed.review) ? parsed.review : {};
      const topic = optionalText(review.topic);
      const method = optionalText(review.method);
      const sample = optionalText(review.sample);
      const result = optionalText(review.result);
      notes.push({
        file,
        referenceId: parsed.sourceReference.trim(),
        review: {
          ...(topic === undefined ? {} : { topic }),
          ...(method === undefined ? {} : { method }),
          ...(sample === undefined ? {} : { sample }),
          ...(result === undefined ? {} : { result }),
        },
      });
    } catch { /* YAML inválido continua responsabilidade dos diagnostics. */ }
  }
  return notes;
}
