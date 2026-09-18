import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('F407 — integração dos formulários', () => {
  it('expõe os três fluxos pelo comando e usa validação/DTOs do host', async () => {
    const app = await readFile('apps/desktop/src/renderer/app.tsx', 'utf8');
    const forms = await readFile('apps/desktop/src/renderer/academic-forms.tsx', 'utf8');
    expect(app).toContain("id: 'forms.open'");
    expect(app).toContain('AcademicFormsDialog');
    expect(forms).toContain('referenceReviewForm');
    expect(forms).toContain('datasetMetadataForm');
    expect(forms).toContain('systematicReviewExtractionForm');
    expect(forms).toContain('validateForm');
    expect(forms).toContain('window.academic.research.setSystematicReview');
  });
});
