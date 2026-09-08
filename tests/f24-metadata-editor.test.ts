import { expect, it } from 'vitest';
import { applyMetadata, metadataFromSource } from '../apps/desktop/src/renderer/shell/frontmatter.js';
it('edita frontmatter e preserva o corpo', () => {
 const source='---\ntitle: Antigo\nproperties:\n  "tcc:institution": X\nextra: preservado\n---\n# Corpo\n';
 const next=applyMetadata(source,{...metadataFromSource(source),title:'Novo',advisor:'Ana',year:'2026'});
 expect(next).toContain('title: Novo'); expect(next).toContain('extra: preservado'); expect(next).toContain('role: advisor'); expect(next).toContain('# Corpo');
});
