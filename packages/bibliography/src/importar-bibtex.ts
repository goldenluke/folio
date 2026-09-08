import { parse, type ParsedEntry, type ParsedName } from '@retorquere/bibtex-parser';

import type {
  BibliographicEntity,
  CslDate,
  CslItemType,
  CslName,
  Diagnostic,
  JsonValue,
  Registry,
} from '@abnt/document-model';
import { asDocumentId, asReferenceId, IndiceDeLinhas } from '@abnt/document-model';

export interface OpcoesDeImportacaoBibtex {
  /** Nome usado nos source ranges dos diagnósticos. */
  readonly documentId?: string;
}

export interface ResultadoDaImportacaoBibtex {
  readonly references: Registry<BibliographicEntity>;
  readonly diagnostics: readonly Diagnostic[];
}

const MESES: Readonly<Record<string, number>> = {
  jan: 1,
  janeiro: 1,
  feb: 2,
  fev: 2,
  fevereiro: 2,
  mar: 3,
  março: 3,
  apr: 4,
  abr: 4,
  abril: 4,
  may: 5,
  mai: 5,
  maio: 5,
  jun: 6,
  junho: 6,
  jul: 7,
  julho: 7,
  aug: 8,
  ago: 8,
  agosto: 8,
  sep: 9,
  sept: 9,
  set: 9,
  setembro: 9,
  oct: 10,
  out: 10,
  outubro: 10,
  nov: 11,
  novembro: 11,
  dec: 12,
  dez: 12,
  dezembro: 12,
};

const scalar = (value: unknown): string | undefined => {
  if (typeof value === 'string' || typeof value === 'number') {
    // O parser representa chaves protetoras e alguns comandos LaTeX com
    // markup HTML. O modelo canônico desta versão guarda texto simples; o
    // original permanece disponível em `custom.bibtex:fields`.
    const normalizado = String(value).replace(/<[^>]+>/g, '').trim();
    return normalizado === '' ? undefined : normalizado;
  }
  if (Array.isArray(value)) {
    const partes = value
      .map((item) => (typeof item === 'string' || typeof item === 'number' ? String(item).trim() : ''))
      .filter(Boolean);
    return partes.length > 0 ? partes.join('; ') : undefined;
  }
  return undefined;
};

const campo = (entry: ParsedEntry, ...nomes: readonly string[]): string | undefined => {
  for (const nome of nomes) {
    const valor = scalar(entry.fields[nome]);
    if (valor !== undefined) return valor;
  }
  return undefined;
};

function nomes(value: unknown): readonly CslName[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const saida: CslName[] = [];

  for (const bruto of value as readonly ParsedName[]) {
    if (bruto === null || typeof bruto !== 'object') continue;
    if (typeof bruto.name === 'string' && bruto.name.trim() !== '') {
      saida.push({ literal: bruto.name.trim() });
      continue;
    }

    const family = scalar(bruto.lastName);
    const given = scalar(bruto.firstName);
    const particle = scalar(bruto.prefix);
    const suffix = scalar(bruto.suffix);
    if (family === undefined && given === undefined) continue;

    saida.push({
      ...(family !== undefined ? { family } : {}),
      ...(given !== undefined ? { given } : {}),
      ...(particle !== undefined ? { 'non-dropping-particle': particle } : {}),
      ...(suffix !== undefined ? { suffix } : {}),
    });
  }

  return saida.length > 0 ? saida : undefined;
}

function data(entry: ParsedEntry, principal: 'issued' | 'accessed'): CslDate | undefined {
  const bruto =
    principal === 'issued'
      ? campo(entry, 'date')
      : campo(entry, 'urldate', 'accessed');

  if (bruto !== undefined) {
    const match = /^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/.exec(bruto);
    if (match !== null) {
      const year = Number(match[1]);
      const month = match[2] !== undefined ? Number(match[2]) : undefined;
      const day = match[3] !== undefined ? Number(match[3]) : undefined;
      const part: readonly [number, number?, number?] =
        day !== undefined && month !== undefined
          ? [year, month, day]
          : month !== undefined
            ? [year, month]
            : [year];
      return { 'date-parts': [part] };
    }
    return { raw: bruto };
  }

  if (principal === 'accessed') return undefined;
  const yearText = campo(entry, 'year');
  const year = yearText !== undefined ? Number.parseInt(yearText, 10) : Number.NaN;
  if (!Number.isFinite(year)) return yearText !== undefined ? { raw: yearText } : undefined;

  const monthText = campo(entry, 'month')?.toLocaleLowerCase('pt-BR').replace(/\.$/, '');
  const parsedMonth = monthText !== undefined ? Number.parseInt(monthText, 10) : Number.NaN;
  const month =
    monthText === undefined
      ? undefined
      : Number.isFinite(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12
        ? parsedMonth
        : MESES[monthText];
  const part: readonly [number, number?] = month !== undefined ? [year, month] : [year];
  return { 'date-parts': [part] };
}

function tipoCsl(entry: ParsedEntry): CslItemType {
  switch (entry.type.toLocaleLowerCase('en')) {
    case 'book':
    case 'booklet':
      return 'book';
    case 'inbook':
    case 'incollection':
      return 'chapter';
    case 'article':
      return 'article-journal';
    case 'conference':
    case 'inproceedings':
    case 'proceedings':
      return 'paper-conference';
    case 'mastersthesis':
    case 'phdthesis':
    case 'thesis':
      return 'thesis';
    case 'electronic':
    case 'online':
    case 'www':
      return 'webpage';
    case 'techreport':
    case 'report':
      return 'report';
    case 'misc':
      return campo(entry, 'url') !== undefined ? 'webpage' : 'document';
    default:
      return 'document';
  }
}

function jsonSeguro(value: unknown): JsonValue | undefined {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    const itens = value.map(jsonSeguro).filter((item): item is JsonValue => item !== undefined);
    return itens;
  }
  if (typeof value === 'object') {
    const obj: Record<string, JsonValue> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const seguro = jsonSeguro(item);
      if (seguro !== undefined) obj[key] = seguro;
    }
    return obj;
  }
  return undefined;
}

function converter(entry: ParsedEntry): BibliographicEntity {
  const author = nomes(entry.fields['author']);
  const editor = nomes(entry.fields['editor']);
  const translator = nomes(entry.fields['translator']);
  const issued = data(entry, 'issued');
  const accessed = data(entry, 'accessed');
  const original = jsonSeguro(entry.fields);
  const type = tipoCsl(entry);
  const title = campo(entry, 'title');
  const containerTitle = campo(entry, 'journal', 'journaltitle', 'booktitle');
  const collectionTitle = campo(entry, 'series');
  const eventTitle = campo(entry, 'eventtitle', 'event');
  const eventPlace = campo(entry, 'venue');
  const publisher = campo(entry, 'publisher', 'school', 'institution', 'organization');
  const publisherPlace = campo(entry, 'address', 'location');
  const edition = campo(entry, 'edition');
  const volume = campo(entry, 'volume');
  const issue = campo(entry, 'number', 'issue');
  const page = campo(entry, 'pages', 'page');
  const numberOfPages = campo(entry, 'pagetotal');
  const genre = campo(entry, 'type');
  const language = campo(entry, 'language', 'langid');
  const DOI = campo(entry, 'doi');
  const URL = campo(entry, 'url');
  const ISBN = campo(entry, 'isbn');
  const ISSN = campo(entry, 'issn');

  return {
    id: asReferenceId(entry.key.trim()),
    type,
    ...(title !== undefined ? { title } : {}),
    ...(author !== undefined ? { author } : {}),
    ...(editor !== undefined ? { editor } : {}),
    ...(translator !== undefined ? { translator } : {}),
    ...(issued !== undefined ? { issued } : {}),
    ...(accessed !== undefined ? { accessed } : {}),
    ...(containerTitle !== undefined ? { 'container-title': containerTitle } : {}),
    ...(collectionTitle !== undefined ? { 'collection-title': collectionTitle } : {}),
    ...(eventTitle !== undefined ? { 'event-title': eventTitle } : {}),
    ...(eventPlace !== undefined ? { 'event-place': eventPlace } : {}),
    ...(publisher !== undefined ? { publisher } : {}),
    ...(publisherPlace !== undefined ? { 'publisher-place': publisherPlace } : {}),
    ...(edition !== undefined ? { edition } : {}),
    ...(volume !== undefined ? { volume } : {}),
    ...(issue !== undefined ? { issue } : {}),
    ...(page !== undefined ? { page } : {}),
    ...(numberOfPages !== undefined ? { 'number-of-pages': numberOfPages } : {}),
    ...(genre !== undefined ? { genre } : {}),
    ...(language !== undefined ? { language } : {}),
    ...(DOI !== undefined ? { DOI } : {}),
    ...(URL !== undefined ? { URL } : {}),
    ...(ISBN !== undefined ? { ISBN } : {}),
    ...(ISSN !== undefined ? { ISSN } : {}),
    custom: {
      'bibtex:type': entry.type,
      ...(original !== undefined ? { 'bibtex:fields': original } : {}),
    },
  };
}

function origemDoErro(
  mensagem: string,
  fonte: string,
  documentId: string,
): Diagnostic['source'] | undefined {
  const match = /line\s+(\d+),\s*column\s+(\d+)/i.exec(mensagem);
  if (match === null) return undefined;
  const line = Number(match[1]);
  const column = Number(match[2]);
  const indice = new IndiceDeLinhas(fonte);
  const linhas = fonte.split(/\r?\n/);
  let offset = 0;
  for (let i = 0; i < line - 1; i += 1) offset += (linhas[i]?.length ?? 0) + 1;
  offset += Math.max(0, column - 1);
  return {
    documentId: asDocumentId(documentId),
    start: { offset: Math.min(offset, fonte.length), ...indice.posicaoDe(Math.min(offset, fonte.length)) },
    end: { offset: Math.min(offset + 1, fonte.length), ...indice.posicaoDe(Math.min(offset + 1, fonte.length)) },
  };
}

/**
 * Importa BibTeX/BibLaTeX para o registry CSL-JSON canônico.
 *
 * Este é o único módulo que conhece nomes de campo e tipos de entrada BibTeX.
 * Depois desta fronteira, o restante do compilador só vê CSL-JSON.
 */
export function importarBibtex(
  fonte: string,
  opcoes: OpcoesDeImportacaoBibtex = {},
): ResultadoDaImportacaoBibtex {
  const parsed = parse(fonte);
  const references: Record<string, BibliographicEntity> = {};
  const diagnostics: Diagnostic[] = [];
  const documentId = opcoes.documentId ?? 'references.bib';

  for (const erro of parsed.errors) {
    const source = origemDoErro(erro.error, fonte, documentId);
    diagnostics.push({
      id: 'BIBTEX-SINTAXE',
      severity: 'error',
      message: erro.error,
      ...(source !== undefined ? { source } : {}),
    });
  }

  for (const entry of parsed.entries) {
    const key = entry.key.trim();
    if (key === '') {
      diagnostics.push({
        id: 'BIBTEX-CHAVE-AUSENTE',
        severity: 'error',
        message: `Entrada BibTeX do tipo "${entry.type}" não possui chave.`,
      });
      continue;
    }
    if (references[key] !== undefined) {
      diagnostics.push({
        id: 'BIBTEX-CHAVE-DUPLICADA',
        severity: 'error',
        message: `A chave BibTeX "${key}" foi declarada mais de uma vez.`,
      });
      continue;
    }
    references[key] = converter(entry);
  }

  return { references, diagnostics };
}
