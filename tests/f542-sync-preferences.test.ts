import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';

import { readLocalSyncPreference, writeLocalSyncPreference } from '../apps/desktop/src/workspace/sync-preferences.js';

describe('F542 — destino de sync é preferência local', () => {
  it('persiste o espelho fora do estado portátil e o restaura por vault', async () => {
    const root = await mkdtemp(join(tmpdir(), 'folio-sync-preference-'));
    try {
      await writeLocalSyncPreference(root, { version: 1, mirrorRootPath: '/tmp/espelho-folio' });
      await expect(readLocalSyncPreference(root)).resolves.toEqual({ version: 1, mirrorRootPath: '/tmp/espelho-folio' });
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
