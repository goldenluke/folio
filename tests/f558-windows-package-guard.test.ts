import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('F558 — pacote Windows', () => {
  it('exige runner Windows x64 e só aceita instalador produzido pelo builder', () => {
    const source = readFileSync('apps/desktop/scripts/package-windows.ts', 'utf8');
    expect(source).toContain("process.platform !== 'win32' || process.arch !== 'x64'");
    expect(source).toContain("FOLIO_NATIVE_TARGET: 'win32-x64'");
    expect(source).toContain("'--win', 'nsis', '--x64'");
    expect(source).toContain("name.endsWith('.exe')");
  });
});
