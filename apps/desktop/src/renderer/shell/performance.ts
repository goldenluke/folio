/**
 * F146 — Performance Observatory. Só memória do processo renderer, nunca
 * disco nem rede: reiniciar o app limpa a amostra. "Sem telemetria remota"
 * também significa sem persistência local disfarçada de telemetria.
 */
export interface PerformanceSample {
  readonly operation: string;
  readonly durationMs: number;
  readonly timestamp: number;
}

export interface PerformanceStats {
  readonly operation: string;
  readonly count: number;
  readonly minMs: number;
  readonly avgMs: number;
  readonly maxMs: number;
  readonly lastMs: number;
  readonly lastAt: number;
}

const MAX_SAMPLES = 500;

export const appendPerformanceSample = (
  samples: readonly PerformanceSample[],
  sample: PerformanceSample,
): readonly PerformanceSample[] => {
  const next = [...samples, sample];
  return next.length > MAX_SAMPLES ? next.slice(next.length - MAX_SAMPLES) : next;
};

export const summarizePerformanceSamples = (samples: readonly PerformanceSample[]): readonly PerformanceStats[] => {
  const byOperation = new Map<string, PerformanceSample[]>();
  for (const sample of samples) {
    const list = byOperation.get(sample.operation);
    if (list === undefined) byOperation.set(sample.operation, [sample]);
    else list.push(sample);
  }
  return [...byOperation.entries()]
    .map(([operation, list]) => {
      const durations = list.map((entry) => entry.durationMs);
      const last = list[list.length - 1]!;
      return {
        operation,
        count: list.length,
        minMs: Math.min(...durations),
        avgMs: durations.reduce((sum, value) => sum + value, 0) / durations.length,
        maxMs: Math.max(...durations),
        lastMs: last.durationMs,
        lastAt: last.timestamp,
      };
    })
    .sort((left, right) => left.operation.localeCompare(right.operation));
};

let samples: readonly PerformanceSample[] = [];
const listeners = new Set<(samples: readonly PerformanceSample[]) => void>();

const notify = (): void => { for (const listener of listeners) listener(samples); };

export function recordPerformanceSample(operation: string, durationMs: number): void {
  samples = appendPerformanceSample(samples, { operation, durationMs, timestamp: Date.now() });
  notify();
}

/** Envolve uma operação assíncrona; a duração é gravada mesmo se `run` rejeitar. */
export async function timePerformance<T>(operation: string, run: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    return await run();
  } finally {
    recordPerformanceSample(operation, performance.now() - start);
  }
}

/** Envolve uma operação síncrona (ex.: busca em memória num `useMemo`). */
export function timePerformanceSync<T>(operation: string, run: () => T): T {
  const start = performance.now();
  try {
    return run();
  } finally {
    recordPerformanceSample(operation, performance.now() - start);
  }
}

export function subscribePerformanceSamples(listener: (samples: readonly PerformanceSample[]) => void): () => void {
  listeners.add(listener);
  listener(samples);
  return () => { listeners.delete(listener); };
}

export function clearPerformanceSamples(): void {
  samples = [];
  notify();
}
