/** Onda BR: evidência de integridade é operacional e nunca altera o CSL-JSON. */
export type ReferenceIntegrityStatus = 'normal' | 'retracted' | 'corrected' | 'expression-of-concern' | 'unknown';

const STATUSES: readonly ReferenceIntegrityStatus[] = ['normal', 'retracted', 'corrected', 'expression-of-concern', 'unknown'];

export interface ReferenceIntegrityRecord {
  readonly referenceId: string;
  readonly status: ReferenceIntegrityStatus;
  /** Fonte declarada pelo pesquisador, por exemplo Crossmark ou editora. */
  readonly provider: string;
  /** URL ou identificador da evidência consultada; não é buscado silenciosamente. */
  readonly evidence: string;
  readonly checkedAt: string;
}

export interface ReferenceIntegritySet { readonly version: 1; readonly records: readonly ReferenceIntegrityRecord[]; }

export function createReferenceIntegrityRecord(input: ReferenceIntegrityRecord): ReferenceIntegrityRecord {
  if (input.referenceId.trim() === '') throw new Error('Integridade exige uma referência.');
  if (!STATUSES.includes(input.status)) throw new Error('Status de integridade inválido.');
  if (input.provider.trim() === '') throw new Error('Informe a fonte da evidência.');
  if (input.evidence.trim() === '') throw new Error('Informe a evidência consultada.');
  if (Number.isNaN(Date.parse(input.checkedAt))) throw new Error('Data de verificação inválida.');
  return { ...input, referenceId: input.referenceId.trim(), provider: input.provider.trim(), evidence: input.evidence.trim() };
}

export function createReferenceIntegritySet(records: readonly ReferenceIntegrityRecord[] = []): ReferenceIntegritySet {
  const seen = new Set<string>();
  const unique: ReferenceIntegrityRecord[] = [];
  for (const record of records) {
    const valid = createReferenceIntegrityRecord(record);
    if (seen.has(valid.referenceId)) throw new Error(`Registro de integridade duplicado: ${valid.referenceId}.`);
    seen.add(valid.referenceId); unique.push(valid);
  }
  return { version: 1, records: unique.sort((left, right) => left.referenceId.localeCompare(right.referenceId)) };
}

/** Entradas corrompidas são isoladas: uma fonte ruim não invalida toda a auditoria. */
export function parseReferenceIntegritySet(value: unknown): ReferenceIntegritySet {
  if (typeof value !== 'object' || value === null || (value as { version?: unknown }).version !== 1 || !Array.isArray((value as { records?: unknown }).records)) return createReferenceIntegritySet();
  const records: ReferenceIntegrityRecord[] = [];
  const seen = new Set<string>();
  for (const candidate of (value as { records: readonly unknown[] }).records) {
    try {
      const record = createReferenceIntegrityRecord(candidate as ReferenceIntegrityRecord);
      if (!seen.has(record.referenceId)) { seen.add(record.referenceId); records.push(record); }
    } catch { /* ignora item corrompido */ }
  }
  return createReferenceIntegritySet(records);
}

export function upsertReferenceIntegrity(set: ReferenceIntegritySet, record: ReferenceIntegrityRecord): ReferenceIntegritySet {
  const valid = createReferenceIntegrityRecord(record);
  return createReferenceIntegritySet([...set.records.filter((item) => item.referenceId !== valid.referenceId), valid]);
}

export function integrityForReference(set: ReferenceIntegritySet, referenceId: string): ReferenceIntegrityRecord | undefined {
  return set.records.find((record) => record.referenceId === referenceId);
}
