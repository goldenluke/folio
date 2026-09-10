import { expect, it } from 'vitest';

import { submissionIsReady, submissionPreflight } from '../apps/desktop/src/renderer/submission-workflow.js';

it('F131–F137 — preflight agrega projeções de projeto e saúde bibliográfica sem revalidar Markdown', () => {
  const report = submissionPreflight({ documents: [{ fileId: 'm', path: 'metodo.md', revision: 7, contentHash: 'sha256:fonte', words: 800, citations: 4, figures: 2, tables: 1, errors: 0, warnings: 3, unresolvedCrossReferences: 0 }] }, { total: 12, cited: 4, unused: 8, missing: [], withoutDoi: 1, audit: [] }, '2026-09-09T12:00:00.000Z');
  expect(report).toMatchObject({ documents: 1, errors: 0, warnings: 3, citations: 4, figures: 2, tables: 1, unresolvedCitations: 0 });
  expect(submissionIsReady(report)).toBe(true);
  expect(submissionIsReady({ ...report, unresolvedCrossReferences: 1 })).toBe(false);
});
