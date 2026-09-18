import { describe, expect, it } from 'vitest';
import { createCitationIntent, parseCitationIntentSet, removeCitationIntent, upsertCitationIntent } from '../packages/citation-intents/src/index.js';

describe('F78 — citation intents', () => {
  it('mantém intenção operacional separada do texto publicado', () => {
    const intent = createCitationIntent({ id: 'i1', fileId: 'f1', start: 2, end: 9, referenceIds: ['ref-1'], kind: 'support' });
    const set = upsertCitationIntent({ version: 1, intents: [] }, intent);
    expect(parseCitationIntentSet(set).intents[0]?.kind).toBe('support');
    expect(removeCitationIntent(set, 'i1').intents).toHaveLength(0);
  });
});
