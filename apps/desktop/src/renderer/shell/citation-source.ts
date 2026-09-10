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

const LOCATOR_KIND_BY_INPUT_PREFIX: Record<string, CitationLocatorKind> = { 'p.': 'page', 'cap.': 'chapter', 'seção': 'section', 'par.': 'paragraph', 'vol.': 'volume', 'n.': 'issue', 'fig.': 'figure', 'tab.': 'table' };

/**
 * Reconhece "p. 42, grifo nosso" em locator + sufixo livre — a mesma
 * gramática de abreviação que `editableCitationAt` já usava embutida para
 * reabrir uma citação existente. Extraída (Onda BP/F507) para que o
 * quick-add do picker reaproveite, em vez de duplicar a tabela de novo.
 */
export function parseLocatorSuffix(tail: string): { readonly locatorKind?: CitationLocatorKind; readonly locator?: string; readonly suffix?: string } {
  const [locatorRaw = '', ...suffixParts] = tail.split(',');
  const locatorMatch = /^(p\.|cap\.|seção|par\.|vol\.|n\.|fig\.|tab\.)\s*(.+)$/iu.exec(locatorRaw.trim());
  const locatorKind = locatorMatch === null ? undefined : LOCATOR_KIND_BY_INPUT_PREFIX[locatorMatch[1]!.toLocaleLowerCase('pt-BR')];
  const locator = locatorMatch === null ? locatorRaw.trim() : locatorMatch[2]!.trim();
  const suffix = suffixParts.join(',').trim();
  return { ...(locator === '' ? {} : { locator }), ...(locatorKind === undefined ? {} : { locatorKind }), ...(suffix === '' ? {} : { suffix }) };
}

/**
 * Reconhece somente uma citação completa junto ao cursor para substituí-la em
 * uma transação. A interpretação acadêmica (AST, locator e validação) segue no
 * language-service/compilador após a edição.
 */
export function editableCitationAt(content: string, offset: number): { readonly range: { readonly start: number; readonly end: number }; readonly draft: CitationDraft } | undefined {
  // A posição precisa estar dentro do mesmo par de colchetes. Procurar o `]`
  // a partir do cursor fazia uma citação anterior alcançar texto comum até o
  // próximo `]` do documento, abrindo o editor em cliques aleatórios.
  const start = content.lastIndexOf('[', Math.max(0, offset));
  const end = start < 0 ? -1 : content.indexOf(']', start + 1);
  if (start >= 0 && end >= 0 && start <= offset && offset <= end) {
    const body = content.slice(start + 1, end);
    if (body.includes('[')) return undefined;
    const match = /^(.*?)?\s*(-)?@([A-Za-z0-9_][A-Za-z0-9_:.#$%&+?<>~/-]*)(.*)$/su.exec(body);
    if (match !== null) {
      const parseItem = (raw: string): CitationItemDraft | undefined => {
        const item = /^(.*?)?\s*(-)?@([A-Za-z0-9_][A-Za-z0-9_:.#$%&+?<>~/-]*)(.*)$/su.exec(raw);
        if (item === null) return undefined;
        const prefix = (item[1] ?? '').trim(); const tail = (item[4] ?? '').replace(/^,\s*/u, '');
        return { referenceId: item[3] ?? '', ...(prefix === '' ? {} : { prefix }), ...parseLocatorSuffix(tail) };
      };
      const rawItems = body.split(';');
      const items = rawItems.flatMap((item) => { const parsed = parseItem(item); return parsed === undefined ? [] : [parsed]; });
      if (items.length === 0 || items.length !== rawItems.length) return undefined;
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
    // `contato@universidade.edu` não é uma citação narrativa. A gramática só
    // aceita `@chave` após início, espaço ou pontuação, nunca no meio de uma palavra.
    const previous = startAt <= 0 ? undefined : content[startAt - 1];
    if (previous !== undefined && /[\p{L}\p{N}_]/u.test(previous)) continue;
    if (startAt <= offset && offset < endAt) {
      return { range: { start: startAt, end: endAt }, draft: { mode: 'narrative', items: [{ referenceId: match[1] ?? '', ...(match[2] === undefined ? {} : { locator: match[2] }) }] } };
    }
  }
  return undefined;
}

const PREVIEW_LOCATOR_LABEL: Record<CitationLocatorKind, string> = {
  page: 'p.', chapter: 'cap.', section: 'seção', paragraph: '§', volume: 'v.', issue: 'n.', figure: 'fig.', table: 'tab.',
};

/** Só os três rótulos que o motor ABNT (`@abnt/standards`) já extrai por referência — o suficiente para montar uma prévia sem recompilar. */
export interface CitationPreviewReference {
  readonly narrativeAuthor: string;
  readonly parentheticalAuthor: string;
  readonly year: string;
}

const previewLocator = (item: CitationItemDraft): string => {
  const value = item.locator?.trim();
  return value === undefined || value === '' ? '' : `${PREVIEW_LOCATOR_LABEL[item.locatorKind ?? 'page']} ${value}`;
};
const previewDecorate = (item: CitationItemDraft, core: string): string => {
  const prefix = item.prefix?.trim(); const suffix = item.suffix?.trim();
  return `${prefix === undefined || prefix === '' ? '' : `${prefix} `}${core}${suffix === undefined || suffix === '' ? '' : `, ${suffix}`}`;
};

/**
 * Prévia aproximada — mesma composição autor/ano/locator do motor ABNT
 * (`itemAutorData` em `@abnt/standards`), mas sem sufixo de ano (2020a/2020b):
 * isso exigiria resolver o documento inteiro, e o renderer não pode importar
 * o Compiler Service (isolamento de processo, ver ADR 0081). O texto final na
 * compilação é sempre a fonte da verdade; isto é só um guia ao escolher.
 */
export function citationPreviewText(draft: CitationDraft, referenceById: ReadonlyMap<string, CitationPreviewReference>): string | undefined {
  const items = draft.items.filter((item) => item.referenceId.trim() !== '');
  if (items.length === 0) return undefined;
  const values = items.map((item) => {
    const reference = referenceById.get(item.referenceId);
    if (reference === undefined) return `[?${item.referenceId}]`;
    const year = reference.year;
    const locator = previewLocator(item);
    if (draft.mode === 'narrative') {
      const inside = [year, locator].filter((part) => part !== '').join(', ');
      return previewDecorate(item, `${reference.narrativeAuthor} (${inside})`);
    }
    const author = draft.mode === 'suppress-author' ? undefined : reference.parentheticalAuthor;
    const core = [author, year, locator].filter((part): part is string => part !== undefined && part !== '').join(', ');
    return previewDecorate(item, core);
  });
  const joined = values.join('; ');
  return draft.mode === 'narrative' ? joined : `(${joined})`;
}
