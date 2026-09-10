import { describe, expect, it } from 'vitest';

import { parseBrowserCapture } from '../apps/desktop/src/main/browser-bridge.js';

describe('F342–F343 — Browser Bridge', () => {
  it('aceita somente DTO HTTP(S) antes de qualquer encaminhamento ao desktop', () => {
    expect(parseBrowserCapture({ version: 1, url: 'https://example.org', title: 'Example', capturedAt: '2026-09-09T12:00:00Z' })).toMatchObject({ url: 'https://example.org' });
    expect(parseBrowserCapture({ version: 1, url: 'file:///etc/passwd', capturedAt: '2026-09-09T12:00:00Z' })).toBeUndefined();
  });
});
