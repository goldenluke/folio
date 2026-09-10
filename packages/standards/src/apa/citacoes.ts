import type { BibliographicEntity, CitationItem, CitationNode } from '@abnt/document-model';
import type { ContextoDeCitacao, MotorDeCitacao, ResultadoDeCitacao } from '@abnt/publication';

const year = (entry: BibliographicEntity): string => String(entry.issued?.['date-parts']?.[0]?.[0] ?? 'n.d.');
const family = (entry: BibliographicEntity): string => entry.author?.[0]?.family ?? entry.author?.[0]?.literal ?? entry.title ?? 'Unknown';
const names = (entry: BibliographicEntity): string => {
  const authors = entry.author ?? [];
  if (authors.length === 0) return entry.title ?? 'Unknown';
  if (authors.length === 1) return family(entry);
  if (authors.length === 2) return `${family(entry)} & ${authors[1]?.family ?? authors[1]?.literal ?? 'Unknown'}`;
  return `${family(entry)} et al.`;
};
const locator = (item: CitationItem): string => item.locator === undefined ? '' : `, ${item.locator.type === 'page' || item.locator.type === 'page-range' ? 'p. ' : ''}${item.locator.value}`;

/** APA 7 author-date; mantém a regra no profile, fora da AST e do renderer. */
export const motorAutorDataApa: MotorDeCitacao = {
  id: 'apa:7/author-date',
  formatar(citation: CitationNode, context: ContextoDeCitacao): ResultadoDeCitacao {
    const items = citation.items.map((item) => ({ item, entry: context.references[item.referenceId] })).sort((left, right) => (left.entry === undefined ? 1 : right.entry === undefined ? -1 : family(left.entry).localeCompare(family(right.entry))));
    const rendered = items.map(({ item, entry }) => {
      if (entry === undefined) return `?${item.referenceId}`;
      const author = names(entry); const issued = `${year(entry)}${context.yearSuffixByReference.get(item.referenceId) ?? ''}`; const where = locator(item);
      if (citation.mode === 'author-only') return author;
      if (citation.mode === 'year-only') return `${issued}${where}`;
      if (citation.mode === 'narrative') return item.suppressAuthor === true ? `(${issued}${where})` : `${author} (${issued}${where})`;
      return `${item.suppressAuthor === true ? '' : `${author}, `}${issued}${where}`;
    });
    const text = rendered.join('; ');
    return { conteudo: [{ type: 'text', value: citation.mode === 'parenthetical' ? `(${text})` : text }] };
  },
};
