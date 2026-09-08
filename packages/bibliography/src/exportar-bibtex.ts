import type { BibliographicEntity, CslItemType, CslName, Registry } from '@abnt/document-model';

const BIBTEX_TYPE_BY_CSL: Partial<Record<CslItemType, string>> = {
  book: 'book',
  chapter: 'incollection',
  'article-journal': 'article',
  'paper-conference': 'inproceedings',
  thesis: 'phdthesis',
  webpage: 'online',
  report: 'techreport',
};

const nameToBibtex = (name: CslName): string => {
  if (name.literal !== undefined) return name.literal;
  const family = [name['non-dropping-particle'], name.family].filter((part) => part !== undefined).join(' ');
  return name.given !== undefined ? `${family}, ${name.given}` : family;
};

const namesField = (names: readonly CslName[] | undefined): string | undefined =>
  names === undefined || names.length === 0 ? undefined : names.map(nameToBibtex).join(' and ');

const yearOf = (entry: BibliographicEntity): string | undefined => {
  const year = entry.issued?.['date-parts']?.[0]?.[0];
  return year === undefined ? undefined : String(year);
};

const monthOf = (entry: BibliographicEntity): string | undefined => {
  const month = entry.issued?.['date-parts']?.[0]?.[1];
  return month === undefined ? undefined : String(month);
};

const escapeBibtex = (value: string): string => value.replace(/([{}])/gu, '\\$1');

const field = (name: string, value: string | undefined): string | undefined =>
  value === undefined || value.trim() === '' ? undefined : `  ${name} = {${escapeBibtex(value)}}`;

/** Chaves duplas protegem capitalização — sem isso, reimportar sentence-casa o título (comportamento padrão de estilos BibTeX). */
const titleField = (value: string | undefined): string | undefined =>
  value === undefined || value.trim() === '' ? undefined : `  title = {{${escapeBibtex(value)}}}`;

/**
 * Serializa de volta para BibTeX — o caminho inverso de `importarBibtex`.
 * Não tenta reproduzir bit-a-bit um `.bib` original (comentários, formatação
 * de campo customizada ficam em `custom['bibtex:fields']` e não voltam); é um
 * round-trip semântico, suficiente para exportar a biblioteca gerenciada
 * (F6) para ferramentas externas.
 */
export function exportarEntradaBibtex(id: string, entry: BibliographicEntity): string {
  const type = BIBTEX_TYPE_BY_CSL[entry.type] ?? 'misc';
  const isJournal = entry.type === 'article-journal';
  const fields = [
    titleField(entry.title),
    field('author', namesField(entry.author)),
    field('editor', namesField(entry.editor)),
    field('year', yearOf(entry)),
    field('month', monthOf(entry)),
    field('journal', isJournal ? entry['container-title'] : undefined),
    field('booktitle', isJournal ? undefined : entry['container-title']),
    field('series', entry['collection-title']),
    field('publisher', entry.publisher),
    field('address', entry['publisher-place']),
    field('edition', entry.edition === undefined ? undefined : String(entry.edition)),
    field('volume', entry.volume === undefined ? undefined : String(entry.volume)),
    field('number', entry.issue === undefined ? undefined : String(entry.issue)),
    field('pages', entry.page),
    field('doi', entry.DOI),
    field('url', entry.URL),
    field('isbn', entry.ISBN),
    field('issn', entry.ISSN),
    field('language', entry.language),
  ].filter((line): line is string => line !== undefined);

  return `@${type}{${id},\n${fields.join(',\n')}\n}\n`;
}

export function exportarBibtex(entries: Registry<BibliographicEntity>): string {
  return Object.entries(entries)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, entry]) => exportarEntradaBibtex(id, entry))
    .join('\n');
}
