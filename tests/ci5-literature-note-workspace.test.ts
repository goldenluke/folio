import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('CI.5 — Literature Note Workspace', () => {
  it('mantém PDF, nota e evidência em seus fluxos existentes', () => {
    const pdf = readFileSync('apps/desktop/src/renderer/pdf-workspace-pane.tsx', 'utf8');
    expect(pdf).toContain('createLiteratureNote');
    expect(pdf).toContain('onOpenNote(result.value.literatureNote.fileId');
    expect(pdf).toContain('onUseInEvidence(item)');
    expect(pdf).toContain('markdownPdfLink(path, item.page, item.id)');
  });
});
