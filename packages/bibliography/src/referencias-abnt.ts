import type { BibliographicEntity, CslDate, CslName } from '@abnt/document-model';

export interface TrechoBibliografico {
  readonly text: string;
  readonly style?: 'emphasis' | 'strong';
}

export type ReferenciaFormatada = readonly TrechoBibliografico[];

const maiusculas = (text: string): string => text.toLocaleUpperCase('pt-BR');

function nomeReferencia(nome: CslName): string {
  if (nome.literal !== undefined) return maiusculas(nome.literal);
  const familia = [nome['non-dropping-particle'], nome.family].filter(Boolean).join(' ').trim();
  const sufixo = nome.suffix !== undefined ? `, ${nome.suffix}` : '';
  const prenome = nome.given?.trim();
  return `${maiusculas(familia || prenome || '[autor desconhecido]')}${sufixo}${prenome !== undefined && familia !== '' ? `, ${prenome}` : ''}`;
}

function autoria(nomes: readonly CslName[] | undefined): string | undefined {
  if (nomes === undefined || nomes.length === 0) return undefined;
  if (nomes.length > 3) return `${nomeReferencia(nomes[0] as CslName)} et al.`;
  return nomes.map(nomeReferencia).join('; ');
}

const ano = (item: BibliographicEntity): string => {
  const value = item.issued?.['date-parts']?.[0]?.[0];
  return value !== undefined ? String(value) : '[s. d.]';
};

const pontuar = (value: string | undefined, sufixo = '.'): string =>
  value !== undefined && value.trim() !== '' ? `${value.trim()}${sufixo}` : '';

const publicacao = (item: BibliographicEntity): string => {
  const place = item['publisher-place']?.trim();
  const publisher = item.publisher?.trim();
  if (place !== undefined && publisher !== undefined) return `${place}: ${publisher}`;
  if (place !== undefined) return place;
  if (publisher !== undefined) return publisher;
  return '[S. l.: s. n.]';
};

const edicao = (item: BibliographicEntity): string => {
  if (item.edition === undefined) return '';
  const text = String(item.edition).trim();
  return /^\d+$/.test(text) ? `${text}. ed. ` : `${text}. `;
};

const inicio = (item: BibliographicEntity): string => {
  const nome = autoria(item.author);
  return nome !== undefined ? `${nome}. ` : '';
};

function acesso(data: CslDate | undefined): string | undefined {
  const part = data?.['date-parts']?.[0];
  if (part === undefined) return data?.raw ?? data?.literal;
  const [year, month, day] = part;
  if (month === undefined || day === undefined) return String(year);
  const meses = ['jan.', 'fev.', 'mar.', 'abr.', 'maio', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
  return `${day} ${meses[month - 1] ?? month} ${year}`;
}

function disponibilidade(item: BibliographicEntity): string {
  if (item.URL === undefined) return '';
  const acessado = acesso(item.accessed);
  return ` Disponível em: ${item.URL}.${acessado !== undefined ? ` Acesso em: ${acessado}.` : ''}`;
}

const titulo = (item: BibliographicEntity): TrechoBibliografico => ({
  text: item.title?.trim() || '[Sem título]',
  style: 'strong',
});

function livro(item: BibliographicEntity): ReferenciaFormatada {
  return [
    { text: inicio(item) },
    titulo(item),
    { text: `. ${edicao(item)}${publicacao(item)}, ${ano(item)}.${disponibilidade(item)}` },
  ];
}

function capitulo(item: BibliographicEntity): ReferenciaFormatada {
  const editor = autoria(item.editor);
  const inText = editor !== undefined ? `In: ${editor} (org.). ` : 'In: ';
  return [
    { text: inicio(item) },
    { text: `${item.title?.trim() || '[Sem título]'}. ${inText}` },
    { text: item['container-title']?.trim() || '[Obra não informada]', style: 'strong' },
    { text: `. ${edicao(item)}${publicacao(item)}, ${ano(item)}.${item.page !== undefined ? ` p. ${item.page}.` : ''}${disponibilidade(item)}` },
  ];
}

function artigo(item: BibliographicEntity): ReferenciaFormatada {
  const detalhes = [
    item.volume !== undefined ? `v. ${item.volume}` : undefined,
    item.issue !== undefined ? `n. ${item.issue}` : undefined,
    item.page !== undefined ? `p. ${item.page}` : undefined,
  ].filter((v): v is string => v !== undefined);
  return [
    { text: `${inicio(item)}${pontuar(item.title)} ` },
    { text: item['container-title']?.trim() || '[Periódico não informado]', style: 'strong' },
    {
      text: `${item['publisher-place'] !== undefined ? `, ${item['publisher-place']}` : ''}${detalhes.length > 0 ? `, ${detalhes.join(', ')}` : ''}, ${ano(item)}.${disponibilidade(item)}`,
    },
  ];
}

function evento(item: BibliographicEntity): ReferenciaFormatada {
  const eventoNome = item['event-title'] ?? item['container-title'] ?? '[Evento não informado]';
  const local = item['event-place'] ?? item['publisher-place'];
  return [
    { text: `${inicio(item)}${pontuar(item.title)} In: ${maiusculas(eventoNome)}, ${ano(item)}${local !== undefined ? `, ${local}` : ''}. ` },
    { text: item['container-title'] ?? 'Anais [...]', style: 'strong' },
    { text: `. ${publicacao(item)}, ${ano(item)}.${item.page !== undefined ? ` p. ${item.page}.` : ''}${disponibilidade(item)}` },
  ];
}

function tese(item: BibliographicEntity): ReferenciaFormatada {
  const genero = item.genre?.trim() ?? 'Trabalho acadêmico';
  const instituicao = item.publisher?.trim() ?? '[Instituição não informada]';
  const local = item['publisher-place']?.trim();
  return [
    { text: inicio(item) },
    titulo(item),
    { text: `. ${ano(item)}. ${genero} - ${instituicao}${local !== undefined ? `, ${local}` : ''}, ${ano(item)}.${disponibilidade(item)}` },
  ];
}

function eletronico(item: BibliographicEntity): ReferenciaFormatada {
  return [
    { text: inicio(item) },
    titulo(item),
    { text: `. ${item.publisher !== undefined ? `${item.publisher}, ` : ''}${ano(item)}.${disponibilidade(item)}` },
  ];
}

/** Formata os seis tipos centrais do M2 conforme o profile ABNT. */
export function formatarReferenciaAbnt(item: BibliographicEntity): ReferenciaFormatada {
  switch (item.type) {
    case 'book':
      return livro(item);
    case 'chapter':
      return capitulo(item);
    case 'article-journal':
      return artigo(item);
    case 'paper-conference':
      return evento(item);
    case 'thesis':
      return tese(item);
    case 'webpage':
      return eletronico(item);
    default:
      return livro(item);
  }
}

export function referenciaComoTexto(trechos: ReferenciaFormatada): string {
  return trechos.map((trecho) => trecho.text).join('');
}
