/**
 * Config for the AI strength benchmark, kept apart from `npm test`.
 *
 * The default config only picks up `*.test.ts`, so the bench files are invisible
 * to CI by construction. They take minutes, not milliseconds, and their job is
 * to answer "is this actually stronger?", which is not a question a test suite
 * should be asked on every commit.
 *
 *     npm run bench:ai
 *     BENCH_PAIRS=60 BENCH_ROUNDS=12 npm run bench:ai
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/ai/__bench__/**/*.bench.ts'],
    // A full ladder run is long by design; never let the runner cut it short.
    testTimeout: 60 * 60_000,
    hookTimeout: 60 * 60_000,
    // Benchmarks print their results, so keep them on stdout.
    disableConsoleIntercept: true,
  },
});
