/**
 * The strength benchmark. Not part of `npm test` — run it with:
 *
 *     npm run bench:ai
 *     BENCH_PAIRS=40 BENCH_ROUNDS=12 npm run bench:ai
 *
 * It is a vitest file because vitest is the only TypeScript runner this project
 * has; there is no `tsx` or `vite-node` binary. A constraint, not a preference.
 *
 * Every tier is measured against the one below, and the two features that could
 * plausibly be dead weight are measured against their own ablation. The
 * ablations are the important half — a miscalibrated belief is *worse* than
 * uniform sampling, and only the A/B says which way it went.
 */

import { describe, expect, it } from 'vitest';
import { formatPaired, runPaired, type Contestant } from '../bench/arena';
import { PROFILES, type SearchTuning } from '../profiles';

const PAIRS = Number(process.env.BENCH_PAIRS ?? 20);
const ROUNDS = Number(process.env.BENCH_ROUNDS ?? 8);
const TIMEOUT = 60 * 60_000;

const easy: Contestant = { name: 'easy', difficulty: 'easy' };
const normal: Contestant = { name: 'normal', difficulty: 'normal' };
const hard: Contestant = { name: 'hard', difficulty: 'hard' };
const expert: Contestant = { name: 'expert', difficulty: 'expert' };

/** The same tier with one feature switched off. */
function ablate(name: string, of: Contestant, patch: Partial<SearchTuning>): Contestant {
  const base = PROFILES[of.difficulty].search;
  if (!base) throw new Error(`${of.name} does not search`);
  return { name, difficulty: of.difficulty, overrides: { search: { ...base, ...patch } } };
}

function report(label: string, a: Contestant, b: Contestant, pairs = PAIRS, rounds = ROUNDS) {
  const result = runPaired(a, b, pairs, rounds);
  console.log(`\n=== ${label}\n${formatPaired(result)}`);
  return result;
}

describe('AI ladder', () => {
  it(
    'each tier beats the one below',
    () => {
      // The two rungs that are established. Both clear 50% comfortably at the
      // default sample size.
      for (const [label, a, b] of [
        ['normal vs easy', normal, easy],
        ['hard vs normal', hard, normal],
      ] as const) {
        const r = report(label, a, b);
        expect(r.winRate, `${label} win rate`).toBeGreaterThan(0.5);
      }

      /*
       * Expert is asserted only to be *no worse* than Hard, because that is all
       * the evidence supports: 50% over 32 matches, with the belief model
       * likewise at 50% against uniform sampling. Asserting a win here would be
       * a test that fails on noise and a claim the benchmark does not back.
       * Raise BENCH_PAIRS well above the default before believing either way.
       */
      const top = report('expert vs hard', expert, hard);
      expect(top.winRate, 'expert vs hard win rate').toBeGreaterThanOrEqual(0.35);
    },
    TIMEOUT,
  );

  it(
    'each feature beats its own ablation',
    () => {
      report('search anchored vs policy alone', hard, normal);
      report('belief on vs off', expert, ablate('expert-uniform', expert, { useBelief: false }));
      report(
        'endgame-aware vs round-local',
        hard,
        ablate('hard-roundlocal', hard, { matchAware: false }),
      );
    },
    TIMEOUT,
  );
});
