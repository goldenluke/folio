import { describe, expect, it } from 'vitest';

import {
  appendPerformanceSample,
  clearPerformanceSamples,
  recordPerformanceSample,
  subscribePerformanceSamples,
  summarizePerformanceSamples,
  timePerformance,
  timePerformanceSync,
  type PerformanceSample,
} from '../apps/desktop/src/renderer/shell/performance.js';

describe('F146 — Performance Observatory', () => {
  it('mantém no máximo 500 amostras, descartando as mais antigas', () => {
    let samples: readonly PerformanceSample[] = [];
    for (let index = 0; index < 520; index += 1) {
      samples = appendPerformanceSample(samples, { operation: 'search', durationMs: index, timestamp: index });
    }
    expect(samples).toHaveLength(500);
    expect(samples[0]!.durationMs).toBe(20);
    expect(samples[499]!.durationMs).toBe(519);
  });

  it('resume amostras por operação com min/média/máx/última, ordenado por nome', () => {
    const samples: readonly PerformanceSample[] = [
      { operation: 'search', durationMs: 10, timestamp: 1 },
      { operation: 'search', durationMs: 30, timestamp: 2 },
      { operation: 'graph', durationMs: 100, timestamp: 3 },
    ];
    const stats = summarizePerformanceSamples(samples);
    expect(stats).toEqual([
      { operation: 'graph', count: 1, minMs: 100, avgMs: 100, maxMs: 100, lastMs: 100, lastAt: 3 },
      { operation: 'search', count: 2, minMs: 10, avgMs: 20, maxMs: 30, lastMs: 30, lastAt: 2 },
    ]);
  });

  it('timePerformance grava a duração mesmo quando a operação rejeita', async () => {
    const recorded: { operation: string; durationMs: number }[] = [];
    clearPerformanceSamples();
    const unsubscribe = subscribePerformanceSamples((current) => {
      recorded.length = 0;
      recorded.push(...current.map((sample) => ({ operation: sample.operation, durationMs: sample.durationMs })));
    });
    try {
      await expect(timePerformance('export-pdf', async () => { throw new Error('falhou'); })).rejects.toThrow('falhou');
      expect(recorded).toHaveLength(1);
      expect(recorded[0]!.operation).toBe('export-pdf');

      recordPerformanceSample('noop', 0);
      expect(timePerformanceSync('pdf-search', () => 'ok')).toBe('ok');
      expect(recorded.map((entry) => entry.operation)).toEqual(['export-pdf', 'noop', 'pdf-search']);
    } finally {
      unsubscribe();
      clearPerformanceSamples();
    }
  });
});
