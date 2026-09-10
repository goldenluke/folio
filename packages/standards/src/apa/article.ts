import type { BibliographicEntity } from '@abnt/document-model';
import type { PublicationBlock, PublicationInline, PublicationProfile, StyleTokenRegistry, TokensDoProfile, UtilitariosDoProfile } from '@abnt/publication';
import type { ResolvedDocument } from '@abnt/semantics';
import { motorAutorDataApa } from './citacoes.js';

const SERIF = '"Times New Roman", Times, serif';
const styles: StyleTokenRegistry = {
  body: { fontFamily: SERIF, fontSize: '12pt', lineHeight: 2, textAlign: 'left', marginBottom: '0' },
  h1: { fontFamily: SERIF, fontSize: '12pt', fontWeight: 'bold', textAlign: 'center', lineHeight: 2, marginTop: '1.5em', marginBottom: '0.5em' },
  h2: { fontFamily: SERIF, fontSize: '12pt', fontWeight: 'bold', textAlign: 'left', lineHeight: 2, marginTop: '1.2em', marginBottom: '0.4em' },
  h3: { fontFamily: SERIF, fontSize: '12pt', fontWeight: 'bold', lineHeight: 2, marginTop: '1em', marginBottom: '0.3em' },
  title: { fontFamily: SERIF, fontSize: '12pt', fontWeight: 'bold', textAlign: 'center', lineHeight: 2, marginBottom: '1em' },
  authors: { fontFamily: SERIF, fontSize: '12pt', textAlign: 'center', lineHeight: 2, marginBottom: '1em' },
  abstract: { fontFamily: SERIF, fontSize: '12pt', lineHeight: 2, textAlign: 'left', marginBottom: '1em' },
  keywords: { fontFamily: SERIF, fontSize: '12pt', lineHeight: 2, textAlign: 'left', marginBottom: '1em' },
  quote: { fontFamily: SERIF, fontSize: '12pt', lineHeight: 2, marginLeft: '1.27cm', textIndent: '0', marginTop: '1em', marginBottom: '1em' },
  list: { fontFamily: SERIF, fontSize: '12pt', lineHeight: 2 }, item: { fontFamily: SERIF, fontSize: '12pt', lineHeight: 2 }, figure: { textAlign: 'left', marginTop: '1em', marginBottom: '1em' }, table: { marginTop: '1em', marginBottom: '1em' }, code: { fontFamily: 'monospace', fontSize: '10pt', lineHeight: 1.4, whiteSpace: 'pre-wrap' }, equation: { textAlign: 'center' }, separator: { marginTop: '1em', marginBottom: '1em' }, caption: { fontFamily: SERIF, fontSize: '12pt', lineHeight: 2 }, source: { fontFamily: SERIF, fontSize: '10pt', lineHeight: 1.5 }, note: { fontFamily: SERIF, fontSize: '10pt', lineHeight: 1.5 }, reference: { fontFamily: SERIF, fontSize: '12pt', lineHeight: 2, textAlign: 'left', marginBottom: '0.5em', marginLeft: '1.27cm', textIndent: '-1.27cm' },
};
const tokens: TokensDoProfile = { paragrafo: 'body', citacaoEmBloco: 'quote', lista: 'list', itemDeLista: 'item', figura: 'figure', tabela: 'table', codigo: 'code', equacao: 'equation', separador: 'separator', legenda: 'caption', fonte: 'source', nota: 'note', referencia: 'reference' };
const fullName = (entry: BibliographicEntity): string => (entry.author ?? []).map((name) => `${name.family ?? name.literal ?? 'Unknown'}${name.given === undefined ? '' : `, ${name.given.split(/\s+/u).map((part) => `${part[0]}.`).join(' ')}`}`).join(', ') || 'Unknown';
const year = (entry: BibliographicEntity): string => String(entry.issued?.['date-parts']?.[0]?.[0] ?? 'n.d.');
const reference = (entry: BibliographicEntity): readonly PublicationInline[] => [{ type: 'text', value: `${fullName(entry)} (${year(entry)}). ` }, { type: 'emphasis', children: [{ type: 'text', value: entry.title ?? '[Untitled]' }] }, { type: 'text', value: `${entry['container-title'] === undefined ? '' : `. ${entry['container-title']}`}${entry.volume === undefined ? '' : `, ${entry.volume}`}${entry.issue === undefined ? '' : `(${entry.issue})`}${entry.page === undefined ? '' : `, ${entry.page}`}.${entry.DOI === undefined ? entry.URL === undefined ? '' : ` ${entry.URL}` : ` https://doi.org/${entry.DOI.replace(/^https?:\/\/doi.org\//u, '')}`}` }];
const frontMatter = (doc: ResolvedDocument, utils: UtilitariosDoProfile): readonly PublicationBlock[] => {
  const metadata = doc.ast.document.metadata; const result: PublicationBlock[] = [];
  if (metadata.title !== undefined) result.push({ type: 'front-matter', role: 'doc:title', style: 'title', children: [{ type: 'paragraph', style: 'title', children: utils.inline(metadata.title) }] });
  const contributors = metadata.contributors ?? []; if (contributors.length > 0) result.push({ type: 'front-matter', role: 'doc:authors', style: 'authors', children: contributors.map((item) => ({ type: 'paragraph' as const, style: 'authors', children: [{ type: 'text' as const, value: item.name.literal ?? [...(item.name.given ?? []), ...(item.name.family ?? [])].join(' ') }] })) });
  if (metadata.abstract !== undefined) result.push({ type: 'front-matter', role: 'doc:abstract', style: 'abstract', label: 'Abstract', children: utils.blocos(metadata.abstract).map((block) => block.type === 'paragraph' ? { ...block, style: 'abstract' } : block) });
  if (metadata.keywords !== undefined && metadata.keywords.length > 0) result.push({ type: 'front-matter', role: 'doc:keywords', style: 'keywords', label: 'Keywords', children: [{ type: 'paragraph', style: 'keywords', children: [{ type: 'text', value: metadata.keywords.join(', ') }] }] });
  return result;
};
const backMatter = (doc: ResolvedDocument): readonly PublicationBlock[] => { const entries = doc.citations.citedReferenceIds.map((id) => doc.bibliography[id]).filter((item): item is BibliographicEntity => item !== undefined).sort((a, b) => fullName(a).localeCompare(fullName(b))); return entries.length === 0 ? [] : [{ type: 'heading', level: 1, style: 'h1', children: [{ type: 'text', value: 'References' }] }, ...entries.map((entry) => ({ type: 'paragraph' as const, style: 'reference', children: reference(entry) }))]; };
export const perfilArtigoApa: PublicationProfile = { id: 'apa:7/article', page: { size: 'Letter', margin: { top: '2.54cm', right: '2.54cm', bottom: '2.54cm', left: '2.54cm' }, pageNumber: 'top-right' }, styles, tokens, secoesSemNumeracao: new Set(['doc:abstract', 'academic:references']), frontMatter, backMatter, motorDeCitacao: motorAutorDataApa, estiloDeTitulo: (level) => level <= 1 ? 'h1' : level === 2 ? 'h2' : 'h3', formatarLegenda: (type, number, text) => ({ conteudo: [{ type: 'text', value: `${type === 'figure' ? 'Figure' : type === 'table' ? 'Table' : type === 'code' ? 'Listing' : 'Equation'}${number === undefined ? '' : ` ${number}`}. ` }, ...text], position: 'below' }) };
