import {
  asReferenceId,
  type BibliographicEntity,
  type CslDate,
  type CslItemType,
  type CslName,
  type Diagnostic,
  type Registry,
} from '@abnt/document-model';

export interface OpcoesDeImportacaoRis {
  readonly documentId?: string;
}

export interface ResultadoDaImportacaoRis {
  readonly references: Registry<BibliographicEntity>;
  readonly diagnostics: readonly Diagnostic[];
}

const RIS_TYPE_TO_CSL: Readonly<Record<string, CslItemType>> = {
  JOUR: 'article-journal',
  BOOK: 'book',
  CHAP: 'chapter',
  CONF: 'paper-conference',
  CPAPER: 'paper-conference',
  THES: 'thesis',
  ELEC: 'webpage',
  WEB: 'webpage',
  BLOG: 'post-weblog',
  RPRT: 'report',
  REPORT: 'report',
};

const CSL_TYPE_TO_RIS: Partial<Record<CslItemType, string>> = {
  'article-journal': 'JOUR',
  book: 'BOOK',
  chapter: 'CHAP',
  'paper-conference': 'CONF',
  thesis: 'THES',
  webpage: 'ELEC',
  'post-weblog': 'BLOG',
  report: 'RPRT',
};

interface RisRecord {
  readonly fields: Map<string, string[]>;
}

const RIS_TAG_PATTERN = /^([A-Z][A-Z0-9])\s{0,2}-\s?(.*)$/u;

function parseRisRecords(source: string): readonly RisRecord[] {
  const records: RisRecord[] = [];
  let current: Map<string, string[]> | undefined;
  for (const rawLine of source.split(/\r?\n/u)) {
    const line = rawLine.replace(/\s+$/u, '');
    if (line.trim() === '') continue;
    const match = RIS_TAG_PATTERN.exec(line);
    if (match === null) continue;
    const tag = match[1] ?? '';
    const value = (match[2] ?? '').trim();
    if (tag === 'TY') {
      current = new Map();
      records.push({ fields: current });
      current.set(tag, [value]);
      continue;
    }
    if (tag === 'ER') {
      current = undefined;
      continue;
    }
    if (current === undefined) continue;
    const list = current.get(tag) ?? [];
    list.push(value);
    current.set(tag, list);
  }
  return records;
}

const first = (fields: ReadonlyMap<string, string[]>, ...tags: readonly string[]): string | undefined => {
  for (const tag of tags) {
    const value = fields.get(tag)?.[0];
    if (value !== undefined && value !== '') return value;
  }
  return undefined;
};

const personNameFromRis = (value: string): CslName => {
  const [family, given] = value.split(',').map((part) => part.trim());
  if (family !== undefined && family !== '' && given !== undefined && given !== '') return { family, given };
  return { literal: value.trim() };
};

const namesFromRis = (fields: ReadonlyMap<string, string[]>, ...tags: readonly string[]): CslName[] | undefined => {
  const values = tags.flatMap((tag) => fields.get(tag) ?? []).filter((value) => value !== '');
  return values.length === 0 ? undefined : values.map(personNameFromRis);
};

const issuedFromRis = (fields: ReadonlyMap<string, string[]>): CslDate | undefined => {
  const raw = first(fields, 'PY', 'Y1', 'DA');
  if (raw === undefined) return undefined;
  const match = /^(\d{4})(?:[/-](\d{1,2}))?(?:[/-](\d{1,2}))?/u.exec(raw);
  if (match === null) return { raw };
  const year = Number(match[1]);
  const month = match[2] !== undefined ? Number(match[2]) : undefined;
  const day = match[3] !== undefined ? Number(match[3]) : undefined;
  const parts: readonly [number, number?, number?] =
    day !== undefined && month !== undefined ? [year, month, day] : month !== undefined ? [year, month] : [year];
  return { 'date-parts': [parts] };
};

const pageRange = (fields: ReadonlyMap<string, string[]>): string | undefined => {
  const start = first(fields, 'SP');
  const end = first(fields, 'EP');
  if (start === undefined) return undefined;
  return end === undefined ? start : `${start}-${end}`;
};

const stripDiacritics = (value: string): string => value.normalize('NFKD').replace(/[\u0300-\u036f]/gu, '');

const generateKey = (entry: Omit<BibliographicEntity, 'id'>, used: ReadonlySet<string>): string => {
  const family = entry.author?.[0]?.family ?? entry.author?.[0]?.literal ?? entry.title?.split(/\s+/u)[0] ?? 'ref';
  const year = entry.issued?.['date-parts']?.[0]?.[0];
  const base = stripDiacritics(`${family}${year ?? ''}`)
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/gu, '');
  let candidate = base === '' ? 'ref' : base;
  let suffix = 0;
  while (used.has(candidate)) {
    suffix += 1;
    candidate = `${base}${String.fromCharCode(96 + suffix)}`;
  }
  return candidate;
};

const entityFromRecord = (record: RisRecord): Omit<BibliographicEntity, 'id'> => {
  const { fields } = record;
  const risType = first(fields, 'TY') ?? '';
  const type = RIS_TYPE_TO_CSL[risType] ?? 'document';
  const author = namesFromRis(fields, 'AU', 'A1');
  const editor = namesFromRis(fields, 'ED', 'A2');
  const title = first(fields, 'TI', 'T1');
  const containerTitle = first(fields, 'T2', 'JO', 'JF');
  const publisher = first(fields, 'PB');
  const publisherPlace = first(fields, 'CY', 'PP');
  const volume = first(fields, 'VL');
  const issue = first(fields, 'IS');
  const page = pageRange(fields);
  const doi = first(fields, 'DO');
  const url = first(fields, 'UR', 'L1', 'L2');
  const isbn = first(fields, 'SN');
  const language = first(fields, 'LA');
  const issued = issuedFromRis(fields);

  return {
    type,
    ...(title !== undefined ? { title } : {}),
    ...(author !== undefined ? { author } : {}),
    ...(editor !== undefined ? { editor } : {}),
    ...(issued !== undefined ? { issued } : {}),
    ...(containerTitle !== undefined ? { 'container-title': containerTitle } : {}),
    ...(publisher !== undefined ? { publisher } : {}),
    ...(publisherPlace !== undefined ? { 'publisher-place': publisherPlace } : {}),
    ...(volume !== undefined ? { volume } : {}),
    ...(issue !== undefined ? { issue } : {}),
    ...(page !== undefined ? { page } : {}),
    ...(doi !== undefined ? { DOI: doi } : {}),
    ...(url !== undefined ? { URL: url } : {}),
    ...(isbn !== undefined ? { ISBN: isbn } : {}),
    ...(language !== undefined ? { language } : {}),
  };
};

/**
 * Importa RIS (Zotero/Mendeley/EndNote exportam neste formato) para o
 * registry CSL-JSON canônico. RIS não tem uma chave de citação como BibTeX —
 * usa a tag `ID` quando presente (comum em exports do Mendeley), senão gera
 * uma chave a partir de autor+ano, com sufixo alfabético em colisão.
 */
export function importarRis(fonte: string, _opcoes: OpcoesDeImportacaoRis = {}): ResultadoDaImportacaoRis {
  const records = parseRisRecords(fonte);
  const references: Record<string, BibliographicEntity> = {};
  const diagnostics: Diagnostic[] = [];
  const used = new Set<string>();

  for (const record of records) {
    const entity = entityFromRecord(record);
    const explicitId = first(record.fields, 'ID');
    const key = explicitId !== undefined && explicitId.trim() !== '' ? explicitId.trim() : generateKey(entity, used);
    if (references[key] !== undefined) {
      diagnostics.push({ id: 'RIS-CHAVE-DUPLICADA', severity: 'error', message: `A chave "${key}" aparece mais de uma vez.` });
      continue;
    }
    used.add(key);
    references[key] = { ...entity, id: asReferenceId(key) };
  }

  if (records.length === 0) {
    diagnostics.push({ id: 'RIS-VAZIO', severity: 'warning', message: 'Nenhuma entrada RIS reconhecida (TY.../ER faltando?).' });
  }

  return { references, diagnostics };
}

const risNameOf = (name: CslName): string => {
  if (name.literal !== undefined) return name.literal;
  const family = [name['non-dropping-particle'], name.family].filter((part) => part !== undefined).join(' ');
  return name.given !== undefined ? `${family}, ${name.given}` : family;
};

function exportarEntradaRis(id: string, entry: BibliographicEntity): string {
  const lines: string[] = [`TY  - ${CSL_TYPE_TO_RIS[entry.type] ?? 'GEN'}`];
  for (const author of entry.author ?? []) lines.push(`AU  - ${risNameOf(author)}`);
  for (const editor of entry.editor ?? []) lines.push(`ED  - ${risNameOf(editor)}`);
  if (entry.title !== undefined) lines.push(`TI  - ${entry.title}`);
  if (entry['container-title'] !== undefined) lines.push(`T2  - ${entry['container-title']}`);
  const year = entry.issued?.['date-parts']?.[0]?.[0];
  if (year !== undefined) lines.push(`PY  - ${year}`);
  if (entry.publisher !== undefined) lines.push(`PB  - ${entry.publisher}`);
  if (entry['publisher-place'] !== undefined) lines.push(`CY  - ${entry['publisher-place']}`);
  if (entry.volume !== undefined) lines.push(`VL  - ${entry.volume}`);
  if (entry.issue !== undefined) lines.push(`IS  - ${entry.issue}`);
  if (entry.page !== undefined) {
    const [start, end] = entry.page.split('-');
    if (start !== undefined) lines.push(`SP  - ${start}`);
    if (end !== undefined) lines.push(`EP  - ${end}`);
  }
  if (entry.DOI !== undefined) lines.push(`DO  - ${entry.DOI}`);
  if (entry.URL !== undefined) lines.push(`UR  - ${entry.URL}`);
  if (entry.ISBN !== undefined) lines.push(`SN  - ${entry.ISBN}`);
  if (entry.language !== undefined) lines.push(`LA  - ${entry.language}`);
  lines.push(`ID  - ${id}`, 'ER  - ', '');
  return lines.join('\n');
}

export function exportarRis(entries: Registry<BibliographicEntity>): string {
  return Object.entries(entries)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, entry]) => exportarEntradaRis(id, entry))
    .join('\n');
}
