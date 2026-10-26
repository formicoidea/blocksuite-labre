/**
 * Timing helpers for the budget tests that run inside `yarn test:unit`.
 *
 * Every unit project runs in parallel there, so a worker can be starved for
 * the whole of a sweep: the selection pane's 820-model build reads 5–6 ms
 * alone and 17–18 ms on its BEST sample under the full run. The best sample
 * is the one number a short burst of load cannot inflate, but sustained load
 * inflates every sample, the best one included. What cancels sustained load
 * is a REFERENCE workload sampled in the same sweep, interleaved with the
 * measured one: both pay the same starvation, so their ratio is a statement
 * about the code rather than about the runner.
 *
 * Same method as the Wardley validation bench
 * (`gfx/wardley/src/__tests__/validation.bench.unit.spec.ts`, `sweepEachMs`),
 * which keeps its own copy for now.
 */

/** Median and best sample of one variant of an interleaved sweep, in ms. */
export interface BenchSample {
  median: number;
  best: number;
}

/**
 * One median and one best per variant, measured on INTERLEAVED samples: the
 * variants are rotated every iteration, so none systematically pays for
 * warming the cache the next one reads, and all of them go through the same
 * GC pauses and the same neighbouring test files.
 */
export function sweepEachMs(
  runs: readonly (() => unknown)[],
  samples = 21,
  warmup = 5
): BenchSample[] {
  for (let i = 0; i < warmup; i++) for (const run of runs) run();

  const buckets: number[][] = runs.map(() => []);
  for (let i = 0; i < samples; i++) {
    for (let k = 0; k < runs.length; k++) {
      const index = (k + i) % runs.length;
      const start = performance.now();
      runs[index]();
      buckets[index].push(performance.now() - start);
    }
  }

  return buckets.map(bucket => {
    bucket.sort((x, y) => x - y);
    return { median: bucket[Math.floor(bucket.length / 2)], best: bucket[0] };
  });
}

/**
 * A fixed, code-independent CPU workload — a few hundred string sorts and map
 * writes — to sample beside a measured one. It reads nothing of the library,
 * so a regression in the code under test never moves it: only the machine
 * does.
 */
export function referenceWorkload(size = 1000): () => number {
  const keys = Array.from(
    { length: size },
    (_, i) => `k${((i * 7919) % size).toString(36).padStart(4, '0')}`
  );
  return () => {
    const sorted = [...keys].sort();
    const seen = new Map<string, number>();
    for (let i = 0; i < sorted.length; i++) seen.set(sorted[i], i);
    return seen.size;
  };
}
