const STATUSES = ['normal', 'retracted', 'corrected', 'expression-of-concern', 'unknown'];
export function createReferenceIntegrityRecord(input) {
    if (input.referenceId.trim() === '')
        throw new Error('Integridade exige uma referência.');
    if (!STATUSES.includes(input.status))
        throw new Error('Status de integridade inválido.');
    if (input.provider.trim() === '')
        throw new Error('Informe a fonte da evidência.');
    if (input.evidence.trim() === '')
        throw new Error('Informe a evidência consultada.');
    if (Number.isNaN(Date.parse(input.checkedAt)))
        throw new Error('Data de verificação inválida.');
    return { ...input, referenceId: input.referenceId.trim(), provider: input.provider.trim(), evidence: input.evidence.trim() };
}
export function createReferenceIntegritySet(records = []) {
    const seen = new Set();
    const unique = [];
    for (const record of records) {
        const valid = createReferenceIntegrityRecord(record);
        if (seen.has(valid.referenceId))
            throw new Error(`Registro de integridade duplicado: ${valid.referenceId}.`);
        seen.add(valid.referenceId);
        unique.push(valid);
    }
    return { version: 1, records: unique.sort((left, right) => left.referenceId.localeCompare(right.referenceId)) };
}
/** Entradas corrompidas são isoladas: uma fonte ruim não invalida toda a auditoria. */
export function parseReferenceIntegritySet(value) {
    if (typeof value !== 'object' || value === null || value.version !== 1 || !Array.isArray(value.records))
        return createReferenceIntegritySet();
    const records = [];
    const seen = new Set();
    for (const candidate of value.records) {
        try {
            const record = createReferenceIntegrityRecord(candidate);
            if (!seen.has(record.referenceId)) {
                seen.add(record.referenceId);
                records.push(record);
            }
        }
        catch { /* ignora item corrompido */ }
    }
    return createReferenceIntegritySet(records);
}
export function upsertReferenceIntegrity(set, record) {
    const valid = createReferenceIntegrityRecord(record);
    return createReferenceIntegritySet([...set.records.filter((item) => item.referenceId !== valid.referenceId), valid]);
}
export function integrityForReference(set, referenceId) {
    return set.records.find((record) => record.referenceId === referenceId);
}
//# sourceMappingURL=index.js.map