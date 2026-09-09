import { describe, expect, it } from 'vitest';

import { templateSource } from '../apps/desktop/src/renderer/shell/authoring-source.js';
import { applyMetadata, metadataFromSource } from '../apps/desktop/src/renderer/shell/frontmatter.js';

describe('F23/F25 — autoria institucional', () => {
  it('gera TCC institucional como Markdown normal com metadados aceitos pelo parser', () => {
    const source = templateSource('institutional-tcc');
    expect(source).toContain('profile: institutional-tcc');
    expect(source).toContain('tcc:institution: Instituição');
    expect(source).toContain('role: advisor');
  });

  it('troca o profile exclusivamente pelo frontmatter YAML', () => {
    const source = '# Texto\n';
    const next = applyMetadata(source, { ...metadataFromSource(source), profile: 'abnt-artigo-numerico' });
    expect(next).toContain('profile: abnt-artigo-numerico');
    expect(next).toContain('# Texto');
  });
});
