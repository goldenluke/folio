import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('CI.3 — annotation para extração', () => {
  it('encaminha annotation como rascunho auditável e exige registro explícito', () => {
    const source = readFileSync('apps/desktop/src/renderer/evidence-full-text.tsx', 'utf8');
    expect(source).toContain('annotationDraft');
    expect(source).toContain('setAnnotationId(annotationDraft.id)');
    expect(source).toContain('setPage(String(annotationDraft.page))');
    expect(source).toContain('Registrar extração');
    expect(source).toContain('recordExtraction');
  });
});
