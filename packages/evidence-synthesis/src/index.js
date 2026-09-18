export function createEvidenceClaim(synthesis, input) {
    const label = input.label.trim();
    if (label === '')
        throw new Error('A claim precisa de um enunciado.');
    if (!synthesis.works.some((work) => work.id === input.workId))
        throw new Error('A claim precisa apontar para uma obra existente.');
    const id = input.id?.trim() || `claim:${slug(label)}`;
    if (synthesis.evidenceItems.some((item) => item.id === id))
        throw new Error('Já existe um item com esse identificador.');
    return { ...synthesis, evidenceItems: [...synthesis.evidenceItems, { id, workId: input.workId, label, kind: 'claim' }] };
}
export function linkClaimEvidence(synthesis, input) {
    const claim = synthesis.evidenceItems.find((item) => item.id === input.claimId);
    const evidence = synthesis.evidenceItems.find((item) => item.id === input.evidenceItemId);
    if (claim?.kind !== 'claim')
        throw new Error('O item de origem precisa ser uma claim.');
    if (evidence === undefined)
        throw new Error('Item de evidência não encontrado.');
    if (input.claimId === input.evidenceItemId)
        throw new Error('Uma claim não pode se relacionar consigo mesma.');
    const relations = synthesis.claimRelations ?? [];
    if (relations.some((item) => item.claimId === input.claimId && item.evidenceItemId === input.evidenceItemId && item.relation === input.relation))
        return synthesis;
    const relation = { ...input, id: input.id?.trim() || `claim-relation:${input.claimId}:${input.evidenceItemId}:${input.relation}` };
    return { ...synthesis, claimRelations: [...relations, relation] };
}
export function claimEvidenceRelations(synthesis, claimId) {
    return (synthesis.claimRelations ?? []).filter((relation) => relation.claimId === claimId);
}
/** Gera um rascunho de manuscrito para prévia; nunca altera o texto autoral. */
export function claimManuscriptDraft(synthesis, claimId) {
    const claim = synthesis.evidenceItems.find((item) => item.id === claimId && item.kind === 'claim');
    if (claim === undefined)
        throw new Error('Claim não encontrada.');
    const relations = claimEvidenceRelations(synthesis, claimId);
    const lines = [`**${claim.label}**`];
    if (relations.length === 0)
        return lines.join('\n');
    lines.push('', relations.map((relation) => { const item = synthesis.evidenceItems.find((entry) => entry.id === relation.evidenceItemId); const work = item === undefined ? undefined : synthesis.works.find((entry) => entry.id === item.workId); const marker = relation.relation === 'supports' ? 'Suportada' : 'Contradita'; return `- ${marker}: ${item?.label ?? relation.evidenceItemId}${work === undefined ? '' : ` (${work.title})`}`; }).join('\n'));
    return lines.join('\n');
}
/** Consolida a cadeia de origem da claim para auditoria e revisão editorial. */
export function claimProvenance(synthesis, claimId) {
    const claim = synthesis.evidenceItems.find((item) => item.id === claimId && item.kind === 'claim');
    if (claim === undefined)
        throw new Error('Claim não encontrada.');
    return claimEvidenceRelations(synthesis, claimId).flatMap((relation) => {
        const item = synthesis.evidenceItems.find((entry) => entry.id === relation.evidenceItemId);
        const work = item === undefined ? undefined : synthesis.works.find((entry) => entry.id === item.workId);
        if (item === undefined || work === undefined)
            return [];
        const extractions = synthesis.extractions.filter((extraction) => extraction.evidenceItemId === item.id);
        return [{ claimId, evidenceItemId: item.id, relation: relation.relation, workId: work.id, workTitle: work.title, extractionIds: extractions.map((extraction) => extraction.id), artifactIds: [...new Set(extractions.flatMap((extraction) => extraction.artifactId === undefined ? [] : [extraction.artifactId]))], pages: [...new Set(extractions.flatMap((extraction) => extraction.page === undefined ? [] : [extraction.page]))], annotationIds: [...new Set(extractions.flatMap((extraction) => extraction.annotationId === undefined ? [] : [extraction.annotationId]))] }];
    });
}
export function claimReadiness(synthesis, claimId) {
    const relations = claimEvidenceRelations(synthesis, claimId);
    const without = relations.filter((relation) => !synthesis.extractions.some((extraction) => extraction.evidenceItemId === relation.evidenceItemId)).length;
    return { ready: relations.length > 0 && without === 0, relationCount: relations.length, supportedRelations: relations.filter((relation) => relation.relation === 'supports').length, contradictedRelations: relations.filter((relation) => relation.relation === 'contradicts').length, relationsWithoutExtraction: without };
}
export function livingClaimStatus(synthesis, claimId, now = new Date(), staleAfterDays = 180) {
    const claim = synthesis.evidenceItems.find((item) => item.id === claimId && item.kind === 'claim');
    if (claim === undefined)
        throw new Error('Claim não encontrada.');
    const relations = claimEvidenceRelations(synthesis, claimId);
    const dates = relations.flatMap((relation) => synthesis.extractions.filter((extraction) => extraction.evidenceItemId === relation.evidenceItemId).map((extraction) => extraction.verifiedAt)).filter((date) => !Number.isNaN(Date.parse(date))).sort();
    const lastEvidenceAt = dates.at(-1);
    const state = lastEvidenceAt === undefined ? 'unverified' : now.getTime() - Date.parse(lastEvidenceAt) > staleAfterDays * 86_400_000 ? 'stale' : 'current';
    return { claimId, state, ...(lastEvidenceAt === undefined ? {} : { lastEvidenceAt }), evidenceCount: relations.length, staleAfterDays };
}
/** Compila uma AST pequena e auditável; providers não recebem strings autorais opacas. */
export function compileSearchQuery(ast, capabilities) {
    const terms = ast.terms.map((term) => term.trim()).filter(Boolean).map((term) => capabilities.supportsQuotedPhrases && /\s/u.test(term) ? `"${term.replaceAll('"', '')}"` : term.replaceAll('"', ''));
    if (terms.length === 0)
        return '';
    return capabilities.supportsBoolean ? terms.join(` ${ast.operator.toUpperCase()} `) : terms.join(' ');
}
/** Importação propositalmente não cria CSL-JSON: resultados entram primeiro na inbox revisável. */
export function addCandidatesToInbox(synthesis, candidates, format, importedAt, runId) {
    const seen = new Set(synthesis.inbox.map((item) => item.rawHash));
    const inbox = [...synthesis.inbox];
    for (const candidate of candidates) {
        const normalized = JSON.stringify({ title: candidate.title.trim(), authors: candidate.authors ?? [], year: candidate.year ?? '', identifiers: candidate.identifiers ?? [] });
        const rawHash = stableHash(normalized);
        if (candidate.title.trim() === '' || seen.has(rawHash))
            continue;
        seen.add(rawHash);
        inbox.push({ id: `inbox:${rawHash}`, ...(runId === undefined ? {} : { runId }), title: candidate.title.trim(), ...(candidate.authors === undefined ? {} : { authors: candidate.authors }), ...(candidate.year === undefined ? {} : { year: candidate.year }), identifiers: candidate.identifiers ?? [], importedAt, format, rawHash });
    }
    return { ...synthesis, inbox };
}
/** Leitura conservadora para intake: campos desconhecidos ficam fora até a revisão humana. */
export function parseEvidenceCandidates(input, format) {
    if (format === 'csv') {
        const [header = '', ...rows] = input.trim().split(/\r?\n/u);
        const columns = header.split(',').map((value) => value.trim().toLowerCase());
        const index = (name) => columns.indexOf(name);
        return rows.map((row) => { const cells = row.split(',').map((value) => value.trim()); const year = index('year') < 0 ? undefined : cells[index('year')]; return { title: cells[index('title')] ?? '', ...(index('author') < 0 ? {} : { authors: (cells[index('author')] ?? '').split(/\s*;\s*/u).filter(Boolean) }), ...(year === undefined || year === '' ? {} : { year }), ...(index('doi') < 0 ? {} : { identifiers: (cells[index('doi')] ?? '').split(/\s*;\s*/u).filter(Boolean) }) }; });
    }
    if (format === 'ris') {
        return input.split(/^ER  -.*$/mu).map((block) => {
            const value = (tag) => block.match(new RegExp(`^${tag}  - (.+)$`, 'mu'))?.[1]?.trim();
            const authors = [...block.matchAll(/^AU  - (.+)$/gmu)].map((item) => item[1]?.trim()).filter((author) => author !== undefined && author !== '');
            const doi = value('DO');
            return { title: value('TI') ?? value('T1') ?? '', ...(authors.length === 0 ? {} : { authors }), ...(value('PY') === undefined ? {} : { year: value('PY').slice(0, 4) }), ...(doi === undefined ? {} : { identifiers: [doi] }) };
        });
    }
    if (format === 'bibtex') {
        return [...input.matchAll(/@\w+\s*\{[^,]+,([\s\S]*?)\n?\}/gu)].map((match) => {
            const body = match[1] ?? '';
            const field = (name) => body.match(new RegExp(`${name}\\s*=\\s*[{"]([^}"]+)`, 'iu'))?.[1]?.trim();
            const author = field('author');
            const doi = field('doi');
            const year = field('year');
            return { title: field('title') ?? '', ...(author === undefined ? {} : { authors: author.split(/\s+and\s+/iu) }), ...(year === undefined ? {} : { year }), ...(doi === undefined ? {} : { identifiers: [doi] }) };
        });
    }
    if (format === 'csl-json') {
        try {
            const parsed = JSON.parse(input);
            const entries = Array.isArray(parsed) ? parsed : [parsed];
            return entries.flatMap((entry) => { if (entry === null || typeof entry !== 'object' || typeof entry.title !== 'string')
                return []; const data = entry; const firstDate = data.issued?.['date-parts']?.[0]?.[0]; const authors = Array.isArray(data.author) ? data.author.map((author) => author.literal ?? [author.family, author.given].filter(Boolean).join(', ')).filter(Boolean) : []; return [{ title: data.title, ...(authors.length === 0 ? {} : { authors }), ...(typeof firstDate === 'number' ? { year: String(firstDate) } : {}), ...(typeof data.DOI === 'string' ? { identifiers: [data.DOI] } : {}) }]; });
        }
        catch {
            return [];
        }
    }
    return input.split(/\r?\n/u).map((title) => ({ title: title.trim() })).filter((item) => item.title !== '');
}
export function createAssessmentStage(input) {
    if (input.label.trim() === '')
        throw new Error('O estágio precisa de um nome.');
    if (input.decisions.length === 0)
        throw new Error('Escolha ao menos uma decisão permitida.');
    return { ...input, id: input.id?.trim() || `stage:${slug(input.label)}`, label: input.label.trim(), reviewersRequired: Math.max(1, Math.floor(input.reviewersRequired)) };
}
export function createCriterion(input, stages) {
    if (!stages.some((stage) => stage.id === input.stageId))
        throw new Error('O critério precisa apontar para um estágio existente.');
    if (input.label.trim() === '')
        throw new Error('O critério precisa de um nome.');
    return { ...input, id: input.id?.trim() || `criterion:${slug(input.label)}`, label: input.label.trim() };
}
/** Admissão deliberada: um candidato vira item avaliável, mas não uma referência CSL-JSON. */
export function admitInboxItem(synthesis, inboxId) {
    const candidate = synthesis.inbox.find((item) => item.id === inboxId);
    if (candidate === undefined)
        throw new Error('Candidato não encontrado na inbox.');
    const workId = `work:${candidate.rawHash}`;
    const recordId = `record:${candidate.rawHash}`;
    const evidenceId = `evidence:${candidate.rawHash}`;
    if (synthesis.evidenceItems.some((item) => item.id === evidenceId))
        return { ...synthesis, inbox: synthesis.inbox.filter((item) => item.id !== inboxId) };
    return { ...synthesis, inbox: synthesis.inbox.filter((item) => item.id !== inboxId), records: [...synthesis.records, { id: recordId, title: candidate.title, ...(candidate.runId === undefined ? {} : { searchRunId: candidate.runId }), workId, identifiers: candidate.identifiers }], works: [...synthesis.works, { id: workId, title: candidate.title, recordIds: [recordId], artifactIds: [], fullText: 'not-requested' }], evidenceItems: [...synthesis.evidenceItems, { id: evidenceId, workId, label: candidate.title, kind: 'study' }] };
}
export function recordEvidenceDecision(synthesis, decision) {
    const stage = synthesis.stages.find((item) => item.id === decision.stageId);
    if (stage === undefined)
        throw new Error('Estágio de avaliação não encontrado.');
    if (!synthesis.evidenceItems.some((item) => item.id === decision.evidenceItemId))
        throw new Error('Item de evidência não encontrado.');
    if (!stage.decisions.includes(decision.decision))
        throw new Error('Essa decisão não é permitida neste estágio.');
    if (decision.decision === 'exclude' && stage.exclusionReasonRequired && (decision.reasonId?.trim() === '' || decision.reasonId === undefined))
        throw new Error('Esse estágio exige motivo para exclusão.');
    const decisions = synthesis.decisions.filter((item) => !(item.evidenceItemId === decision.evidenceItemId && item.stageId === decision.stageId && item.reviewerId === decision.reviewerId));
    return { ...synthesis, decisions: [...decisions, decision] };
}
/** Não infere maioria: divergências só terminam numa decisão explícita de reconciliação. */
export function reconcileEvidenceItem(synthesis, reconciliation) {
    const stage = synthesis.stages.find((item) => item.id === reconciliation.stageId);
    if (stage === undefined || !stage.decisions.includes(reconciliation.decision))
        throw new Error('Reconciliação inválida para o estágio.');
    return recordEvidenceDecision(synthesis, { evidenceItemId: reconciliation.evidenceItemId, stageId: reconciliation.stageId, reviewerId: `reconciled:${reconciliation.reconciledBy}`, decision: reconciliation.decision, at: reconciliation.reconciledAt, ...(reconciliation.note === undefined ? {} : { reasonId: reconciliation.note }) });
}
export function assessmentState(synthesis, evidenceItemId, stageId) {
    const decisions = synthesis.decisions.filter((item) => item.evidenceItemId === evidenceItemId && item.stageId === stageId);
    if (decisions.some((item) => item.reviewerId.startsWith('reconciled:')))
        return 'reconciled';
    const stage = synthesis.stages.find((item) => item.id === stageId);
    if (stage === undefined || decisions.length < stage.reviewersRequired)
        return 'pending';
    return new Set(decisions.map((item) => item.decision)).size === 1 ? 'agreement' : 'conflict';
}
export function linkWorkReference(synthesis, workId, referenceId) {
    if (!synthesis.works.some((work) => work.id === workId))
        throw new Error('Obra não encontrada.');
    return { ...synthesis, works: synthesis.works.map((work) => work.id === workId ? { ...work, referenceId } : work) };
}
export function recordExtraction(synthesis, extraction) {
    if (!synthesis.evidenceItems.some((item) => item.id === extraction.evidenceItemId))
        throw new Error('Item de evidência não encontrado.');
    if (extraction.fieldId.trim() === '' || extraction.reviewerId.trim() === '')
        throw new Error('Campo e revisor são obrigatórios.');
    if (extraction.page !== undefined && (!Number.isInteger(extraction.page) || extraction.page < 1))
        throw new Error('A página precisa ser um inteiro positivo.');
    if (extraction.artifactId !== undefined && !synthesis.artifacts.some((artifact) => artifact.id === extraction.artifactId))
        throw new Error('Artefato não encontrado.');
    const extractions = synthesis.extractions.filter((item) => item.id !== extraction.id);
    return { ...synthesis, extractions: [...extractions, extraction] };
}
export function evidenceOverview(synthesis) {
    const states = synthesis.evidenceItems.flatMap((item) => synthesis.stages.map((stage) => assessmentState(synthesis, item.id, stage.id)));
    return { sources: synthesis.sources.length, strategies: synthesis.strategies.length, runs: synthesis.runs.length, inbox: synthesis.inbox.length, records: synthesis.records.length, works: synthesis.works.length, fullTexts: synthesis.works.filter((work) => work.fullText === 'available').length, evidenceItems: synthesis.evidenceItems.length, pendingAssessments: states.filter((state) => state === 'pending').length, conflicts: states.filter((state) => state === 'conflict').length, extractions: synthesis.extractions.length };
}
export function narrativeSynthesis(synthesis) {
    const overview = evidenceOverview(synthesis);
    const fields = new Set(synthesis.extractions.map((item) => item.fieldId));
    const conflicts = overview.conflicts > 0 ? String(overview.conflicts) + ' conflito(s) de avaliação aguardam reconciliação manual.' : 'Não há conflitos de avaliação pendentes.';
    return 'A síntese reúne ' + String(overview.records) + ' registros, reconciliados em ' + String(overview.works) + ' obras e ' + String(overview.evidenceItems) + ' itens de evidência. ' + String(overview.fullTexts) + ' obra(s) possuem texto completo disponível. Foram registradas ' + String(overview.extractions) + ' extração(ões) em ' + String(fields.size) + ' campo(s). ' + conflicts;
}
export function evidenceTable(synthesis) {
    return synthesis.evidenceItems.map((item) => { const work = synthesis.works.find((entry) => entry.id === item.workId); const values = synthesis.extractions.filter((entry) => entry.evidenceItemId === item.id); return { evidenceItem: item.label, work: work?.title ?? '', fullText: work?.fullText ?? 'not-requested', ...Object.fromEntries(values.map((entry) => [entry.fieldId, typeof entry.value === 'string' || typeof entry.value === 'number' || typeof entry.value === 'boolean' ? String(entry.value) : JSON.stringify(entry.value)])) }; });
}
export function evidenceMap(synthesis) {
    return [...new Set(synthesis.extractions.map((entry) => entry.fieldId))].map((fieldId) => ({ fieldId, count: synthesis.extractions.filter((entry) => entry.fieldId === fieldId).length }));
}
export function exportEvidenceSynthesis(synthesis, format) {
    if (format === 'json')
        return JSON.stringify(synthesis, null, 2);
    const rows = evidenceTable(synthesis);
    const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    const separator = format === 'csv' ? ',' : '\t';
    const cell = (value) => format === 'csv' ? '"' + value.replaceAll('"', '""') + '"' : value.replaceAll('\t', ' ').replaceAll('\n', ' ');
    return [columns.join(separator), ...rows.map((row) => columns.map((column) => cell(row[column] ?? '')).join(separator))].join('\n');
}
/** Pacote leve e exportável: inclui rastreabilidade, nunca bytes de PDFs protegidos. */
export function reproducibilityPackage(synthesis, generatedAt = new Date().toISOString()) {
    const value = { version: 1, generatedAt, sources: synthesis.sources, strategies: synthesis.strategies, runs: synthesis.runs, decisions: synthesis.decisions, extractions: synthesis.extractions, claimRelations: synthesis.claimRelations ?? [], includedEvidenceItems: synthesis.evidenceItems.map((item) => item.id), excludedPdfArtifacts: synthesis.artifacts.filter((artifact) => artifact.kind === 'pdf').map((artifact) => artifact.id) };
    return { ...value, contentHash: `fnv1a:${stableHash(JSON.stringify(value))}` };
}
const slug = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/gu, '').toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '') || 'custom';
const stableHash = (text) => {
    let value = 2166136261;
    for (let index = 0; index < text.length; index += 1)
        value = Math.imul(value ^ text.charCodeAt(index), 16777619);
    return (value >>> 0).toString(16).padStart(8, '0');
};
const stages = [
    { id: 'identification', label: 'Identificação', decisions: ['include', 'exclude', 'maybe'], reviewersRequired: 1, blind: false, exclusionReasonRequired: false },
    { id: 'eligibility', label: 'Elegibilidade', decisions: ['include', 'exclude', 'maybe'], reviewersRequired: 1, blind: false, exclusionReasonRequired: true },
];
const stageFor = (value) => value === 'excluded' || value === 'included' || value === 'full-text' ? 'eligibility' : 'identification';
/** Converte sem mutar o legado e sem gerar novas identidades em uma segunda execução. */
export function migrateSystematicReview(legacy) {
    const sourceByLabel = new Map();
    const addSource = (label) => { const known = sourceByLabel.get(label); if (known !== undefined)
        return known; const source = { id: `legacy-source:${label || 'manual'}`, label: label || 'Importação manual', kind: 'manual-import' }; sourceByLabel.set(label, source); return source; };
    for (const database of legacy.protocol?.databases ?? [])
        addSource(database);
    for (const search of legacy.searches ?? [])
        addSource(search.database);
    const strategy = legacy.protocol?.searchStrategy.trim() === '' || legacy.protocol === undefined ? [] : [{ id: `legacy-strategy:${legacy.protocol.id}`, sourceId: addSource(legacy.protocol.databases[0] ?? 'Importação manual').id, label: 'Estratégia migrada', conceptualQuery: legacy.protocol.searchStrategy, compiledQuery: legacy.protocol.searchStrategy }];
    const runs = (legacy.searches ?? []).map((search) => ({ id: `legacy-run:${search.id}`, strategyId: strategy[0]?.id ?? `legacy-strategy:${search.id}`, executedAt: search.searchedAt, resultCount: Math.max(0, search.resultCount), importedCount: 0, query: search.query }));
    const records = legacy.studies.map((study) => ({ id: `legacy-record:${study.id}`, title: study.title, workId: `legacy-work:${study.id}`, identifiers: [], ...(study.referenceId === undefined ? {} : { referenceId: study.referenceId }) }));
    const works = legacy.studies.map((study) => ({ id: `legacy-work:${study.id}`, title: study.title, recordIds: [`legacy-record:${study.id}`], artifactIds: [], fullText: study.stage === 'full-text' ? 'manual-needed' : 'not-requested', ...(study.referenceId === undefined ? {} : { referenceId: study.referenceId }) }));
    const evidenceItems = legacy.studies.map((study) => ({ id: `legacy-evidence:${study.id}`, workId: `legacy-work:${study.id}`, label: study.title, kind: 'study' }));
    const decisions = legacy.studies.flatMap((study) => study.decisions.map((decision) => ({ evidenceItemId: `legacy-evidence:${study.id}`, stageId: stageFor(study.stage), ...decision })));
    const criteria = [...(legacy.protocol?.inclusionCriteria ?? []).map((label, index) => ({ id: `legacy-include:${index + 1}`, label, stageId: 'eligibility', polarity: 'include', required: false })), ...(legacy.protocol?.exclusionCriteria ?? []).map((label, index) => ({ id: `legacy-exclude:${index + 1}`, label, stageId: 'eligibility', polarity: 'exclude', required: false }))];
    return { version: 1, migratedFrom: 'systematic-review-v1', ...(legacy.protocol === undefined ? {} : { protocol: { id: legacy.protocol.id, title: legacy.protocol.title, question: legacy.protocol.question } }), sources: [...sourceByLabel.values()], strategies: strategy, runs, inbox: [], records, works, artifacts: [], evidenceItems, stages, criteria, decisions, extractions: [] };
}
//# sourceMappingURL=index.js.map