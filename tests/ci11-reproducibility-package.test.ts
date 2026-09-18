import { describe, expect, it } from 'vitest';
import { reproducibilityPackage, type EvidenceSynthesis } from '@abnt/evidence-synthesis';
const synthesis: EvidenceSynthesis = { version: 1, sources: [], strategies: [], runs: [], inbox: [], records: [], works: [], artifacts: [{ id: 'pdf', workId: 'w', kind: 'pdf' }], evidenceItems: [], stages: [], criteria: [], decisions: [], extractions: [] };
describe('CI.11 reproducibility package', () => { it('gera hash e exclui bytes de PDF', () => { const result = reproducibilityPackage(synthesis, '2026-01-01T00:00:00Z'); expect(result.contentHash).toMatch(/^fnv1a:/u); expect(result.excludedPdfArtifacts).toEqual(['pdf']); expect(JSON.stringify(result)).not.toContain('bytes'); }); });
