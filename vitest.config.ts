import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { conditions: ['development'] },
  test: {
    include: ['packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.ts', 'tests/**/*.test.ts'],
    // Gerar PDF via Chromium é lento; o golden de ponta a ponta precisa de folga.
    testTimeout: 60_000,
  },
});
