/**
 * Serialização da gramática autoral de citações já reconhecida pelo parser
 * Markdown. Não formata ABNT: isso continua sendo trabalho do compilador.
 */
export type CitationEditMode = 'parenthetical' | 'narrative' | 'suppress-author';

export interface CitationDraft {
  readonly referenceId: string;
  readonly mode: CitationEditMode;
  readonly locator?: string;
  readonly prefix?: string;
  readonly suffix?: string;
}

const locatorPart = (locator: string | undefined): string => locator?.trim() === '' || locator === undefined ? '' : `, ${locator.trim()}`;

export function citationSource(draft: CitationDraft): string {
  const prefix = draft.prefix?.trim();
  const suffix = draft.suffix?.trim();
  if (draft.mode === 'narrative') {
    // A forma explícita evita ambiguidade com a prosa: @chave [p. 42].
    return `${prefix === undefined || prefix === '' ? '' : `${prefix} `}@${draft.referenceId}${draft.locator?.trim() === '' || draft.locator === undefined ? '' : ` [${draft.locator.trim()}]`}${suffix === undefined || suffix === '' ? '' : ` ${suffix}`}`;
  }
  const key = draft.mode === 'suppress-author' ? `-@${draft.referenceId}` : `@${draft.referenceId}`;
  return `[${prefix === undefined || prefix === '' ? '' : `${prefix} `}${key}${locatorPart(draft.locator)}${suffix === undefined || suffix === '' ? '' : `, ${suffix}`}]`;
}

/**
 * Reconhece somente uma citação completa junto ao cursor para substituí-la em
 * uma transação. A interpretação acadêmica (AST, locator e validação) segue no
 * language-service/compilador após a edição.
 */
export function editableCitationAt(content: string, offset: number): { readonly range: { readonly start: number; readonly end: number }; readonly draft: CitationDraft } | undefined {
  const before = content.slice(0, offset);
  const start = before.lastIndexOf('[');
  const end = content.indexOf(']', Math.max(start, offset));
  if (start >= 0 && end >= offset) {
    const body = content.slice(start + 1, end);
    const match = /^(.*?)?\s*(-)?@([A-Za-z0-9_][A-Za-z0-9_:.#$%&+?<>~/-]*)(.*)$/su.exec(body);
    if (match !== null) {
      const prefix = (match[1] ?? '').trim();
      const tail = (match[4] ?? '').replace(/^,\s*/u, '');
      const separator = tail.indexOf(',');
      const locator = separator < 0 ? tail : tail.slice(0, separator).trim();
      const suffix = separator < 0 ? '' : tail.slice(separator + 1).trim();
      return {
        range: { start, end: end + 1 },
        draft: {
          referenceId: match[3] ?? '',
          mode: match[2] === '-' ? 'suppress-author' : 'parenthetical',
          ...(prefix === '' ? {} : { prefix }),
          ...(locator === '' ? {} : { locator }),
          ...(suffix === '' ? {} : { suffix }),
        },
      };
    }
  }
  const narrative = /@([A-Za-z0-9_][A-Za-z0-9_:.#$%&+?<>~/-]*)(?:\s+\[([^\]]+)\])?/gu;
  for (const match of content.matchAll(narrative)) {
    const startAt = match.index ?? -1;
    const endAt = startAt + match[0].length;
    if (startAt <= offset && offset <= endAt) {
      return { range: { start: startAt, end: endAt }, draft: { referenceId: match[1] ?? '', mode: 'narrative', ...(match[2] === undefined ? {} : { locator: match[2] }) } };
    }
  }
  return undefined;
}
