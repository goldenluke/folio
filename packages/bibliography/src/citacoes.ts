import type { BibliographicEntity, CslName } from '@abnt/document-model';

const collation = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

export function anoDaReferencia(item: BibliographicEntity): string {
  const year = item.issued?.['date-parts']?.[0]?.[0];
  return year !== undefined ? String(year) : 's.d.';
}

function particulaENome(nome: CslName): string {
  if (nome.literal !== undefined) return nome.literal;
  return [nome['non-dropping-particle'], nome.family].filter(Boolean).join(' ').trim();
}

export function autorDaChamada(item: BibliographicEntity): string {
  const autores = item.author ?? [];
  if (autores.length === 0) {
    const titulo = item.title?.trim() ?? 'Sem título';
    const primeira = titulo.split(/[:.!?]/, 1)[0]?.trim() ?? titulo;
    return primeira.length > 24 ? `${primeira.slice(0, 21).trimEnd()}...` : primeira;
  }

  const nomes = autores.map(particulaENome);
  if (nomes.length === 1) return nomes[0] ?? '';
  if (nomes.length === 2) return `${nomes[0]} e ${nomes[1]}`;
  if (nomes.length === 3) return `${nomes[0]}, ${nomes[1]} e ${nomes[2]}`;
  return `${nomes[0]} et al.`;
}

/** Forma usada dentro de parênteses: coautores são separados por ponto e vírgula. */
export function autorDaChamadaParentetica(item: BibliographicEntity): string {
  const autores = item.author ?? [];
  if (autores.length === 0) return autorDaChamada(item);
  const nomes = autores.map(particulaENome);
  if (nomes.length <= 3) return nomes.join('; ');
  return `${nomes[0]} et al.`;
}

export function chaveDeAutor(item: BibliographicEntity): string {
  const autores = item.author ?? [];
  if (autores.length === 0) return item.title?.trim().toLocaleLowerCase('pt-BR') ?? '';
  return autores.map(particulaENome).join('|').toLocaleLowerCase('pt-BR');
}

export function compararReferencias(a: BibliographicEntity, b: BibliographicEntity): number {
  return (
    collation.compare(chaveDeAutor(a), chaveDeAutor(b)) ||
    collation.compare(anoDaReferencia(a), anoDaReferencia(b)) ||
    collation.compare(a.title ?? '', b.title ?? '') ||
    collation.compare(a.id, b.id)
  );
}
