import { describe, expect, it } from 'vitest';
import { createReferenceIntegritySet, parseReferenceIntegritySet, upsertReferenceIntegrity } from '@abnt/reference-integrity';

describe('F460 integridade bibliográfica operacional', () => {
  it('preserva evidência explícita fora da referência CSL-JSON', () => {
    const set = upsertReferenceIntegrity(createReferenceIntegritySet(), {
      referenceId: 'silva2024', status: 'retracted', provider: 'Crossmark', evidence: 'https://doi.org/10.1/example', checkedAt: '2026-09-12T00:00:00.000Z',
    });
    expect(set.records).toEqual([{ referenceId: 'silva2024', status: 'retracted', provider: 'Crossmark', evidence: 'https://doi.org/10.1/example', checkedAt: '2026-09-12T00:00:00.000Z' }]);
  });

  it('descarta registros corrompidos sem perder a auditoria válida', () => {
    expect(parseReferenceIntegritySet({ version: 1, records: [
      { referenceId: 'ok', status: 'normal', provider: 'Editora', evidence: 'registro 4', checkedAt: '2026-09-12T00:00:00.000Z' },
      { referenceId: '', status: 'inventado', provider: '', evidence: '', checkedAt: 'hoje' },
    ] }).records).toHaveLength(1);
  });
});
