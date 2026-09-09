/**
 * Serialização da gramática autoral de citações já reconhecida pelo parser
 * Markdown. Não formata ABNT: isso continua sendo trabalho do compilador.
 */
export type CitationEditMode = 'parenthetical' | 'narrative' | 'suppress-author';

/** Tipos que a gramática atual já reconhece; a UI não inventa locator novo. */
export type CitationLocatorKind = 'page' | 'chapter' | 'section' | 'paragraph' | 'volume' | 'issue' | 'figure' | 'table';

export interface CitationItemDraft {
  readonly referenceId: string;
  readonly locator?: string;
  readonly locatorKind?: CitationLocatorKind;
  readonly prefix?: string;
  readonly suffix?: string;
}

export interface CitationDraft {
  readonly mode: CitationEditMode;
  readonly items: readonly CitationItemDraft[];
}

const locatorPrefix: Record<CitationLocatorKind, string> = {
  page: 'p.', chapter: 'cap.', section: 'seção', paragraph: 'par.', volume: 'vol.', issue: 'n.', figure: 'fig.', table: 'tab.',
};

export function citationLocatorSource(kind: CitationLocatorKind | undefined, locator: string | undefined): string | undefined {
  const value = locator?.trim();
  if (value === undefined || value === '') return undefined;
  return `${locatorPrefix[kind ?? 'page']} ${value}`;
}

const citationItemSource = (item: CitationItemDraft, mode: CitationEditMode): string => {
  const prefix = item.prefix?.trim();
  const suffix = item.suffix?.trim();
  const locator = citationLocatorSource(item.locatorKind, item.locator);
  const key = mode === 'suppress-author' ? `-@${item.referenceId}` : `@${item.referenceId}`;
  return `${prefix === undefined || prefix === '' ? '' : `${prefix} `}${key}${locator === undefined ? '' : `, ${locator}`}${suffix === undefined || suffix === '' ? '' : `, ${suffix}`}`;
};

export function citationSource(draft: CitationDraft): string {
  const items = draft.items.filter((item) => item.referenceId.trim() !== '');
  if (items.length === 0) return '';
  if (draft.mode === 'narrative') {
    const item = items[0]!;
    const prefix = item.prefix?.trim(); const suffix = item.suffix?.trim();
    const locator = citationLocatorSource(item.locatorKind, item.locator);
    // A forma explícita evita ambiguidade com a prosa: @chave [p. 42].
    return `${prefix === undefined || prefix === '' ? '' : `${prefix} `}@${item.referenceId}${locator === undefined ? '' : ` [${locator}]`}${suffix === undefined || suffix === '' ? '' : ` ${suffix}`}`;
  }
  return `[${items.map((item) => citationItemSource(item, draft.mode)).join('; ')}]`;
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
      const parseItem = (raw: string): CitationItemDraft | undefined => {
        const item = /^(.*?)?\s*(-)?@([A-Za-z0-9_][A-Za-z0-9_:.#$%&+?<>~/-]*)(.*)$/su.exec(raw);
        if (item === null) return undefined;
        const prefix = (item[1] ?? '').trim(); const tail = (item[4] ?? '').replace(/^,\s*/u, '');
        const [locatorRaw = '', ...suffixParts] = tail.split(',');
        const locatorMatch = /^(p\.|cap\.|seção|par\.|vol\.|n\.|fig\.|tab\.)\s*(.+)$/iu.exec(locatorRaw.trim());
        const kindByPrefix: Record<string, CitationLocatorKind> = { 'p.': 'page', 'cap.': 'chapter', 'seção': 'section', 'par.': 'paragraph', 'vol.': 'volume', 'n.': 'issue', 'fig.': 'figure', 'tab.': 'table' };
        const locatorKind = locatorMatch === null ? undefined : kindByPrefix[locatorMatch[1]!.toLocaleLowerCase('pt-BR')];
        const locator = locatorMatch === null ? locatorRaw.trim() : locatorMatch[2]!.trim();
        const suffix = suffixParts.join(',').trim();
        return { referenceId: item[3] ?? '', ...(prefix === '' ? {} : { prefix }), ...(locator === '' ? {} : { locator }), ...(locatorKind === undefined ? {} : { locatorKind }), ...(suffix === '' ? {} : { suffix }) };
      };
      const items = body.split(';').flatMap((item) => { const parsed = parseItem(item); return parsed === undefined ? [] : [parsed]; });
      if (items.length === 0) return undefined;
      return {
        range: { start, end: end + 1 },
        draft: {
          mode: match[2] === '-' ? 'suppress-author' : 'parenthetical',
          items,
        },
      };
    }
  }
  const narrative = /@([A-Za-z0-9_][A-Za-z0-9_:.#$%&+?<>~/-]*)(?:\s+\[([^\]]+)\])?/gu;
  for (const match of content.matchAll(narrative)) {
    const startAt = match.index ?? -1;
    const endAt = startAt + match[0].length;
    if (startAt <= offset && offset <= endAt) {
      return { range: { start: startAt, end: endAt }, draft: { mode: 'narrative', items: [{ referenceId: match[1] ?? '', ...(match[2] === undefined ? {} : { locator: match[2] }) }] } };
    }
  }
  return undefined;
}
