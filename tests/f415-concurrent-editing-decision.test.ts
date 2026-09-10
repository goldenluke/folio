import { describe, expect, it } from 'vitest';

import { DocumentLeaseLocks, summarizeConcurrentEditingTelemetry } from '../packages/collaboration/src/index.js';

describe('F415–F418 — decisão de edição concorrente', () => {
  it('agrega telemetria local sem reter conteúdo ou caminhos', () => {
    expect(summarizeConcurrentEditingTelemetry([
      { kind: 'lock-acquired', documentId: 'a', at: 1 },
      { kind: 'lock-denied', documentId: 'a', at: 2 },
      { kind: 'sync-conflict', documentId: 'b', at: 3 },
      { kind: 'manual-merge', documentId: 'b', at: 4 },
    ])).toEqual({ events: 4, lockDenied: 1, expired: 0, syncConflicts: 1, manualMerges: 1 });
  });

  it('oferece lease opt-in com expiração, renovação e liberação pelo titular', () => {
    const locks = new DocumentLeaseLocks();
    expect(locks.acquire('texto.md', 'ana', 0, 100)?.holderId).toBe('ana');
    expect(locks.acquire('texto.md', 'bia', 20, 100)).toBeUndefined();
    expect(locks.renew('texto.md', 'ana', 50, 100)?.expiresAt).toBe(150);
    expect(locks.release('texto.md', 'bia')).toBe(false);
    expect(locks.release('texto.md', 'ana')).toBe(true);
    expect(locks.acquire('texto.md', 'bia', 160, 100)?.holderId).toBe('bia');
  });
});
