/**
 * Measuring how strong the opponents actually are.
 *
 * Koi-Koi has enormous deal variance, so a naive "play N matches and count
 * wins" needs an impractical N to say anything. Two things fix that:
 *
 * **Paired play.** Every seed is played twice with the seats swapped and the
 * *same* deal, exactly as duplicate bridge does it. Comparing the paired point
 * differences cancels most of the luck, and cuts the matches needed for a given
 * confidence by roughly an order of magnitude.
 *
 * **Intervals, not point estimates.** A win rate without an interval cannot
 * tell a real improvement from a lucky run, which is precisely the mistake the
 * test suite this replaces was making with eight seeds.
 */

import { applyMove, createGame, legalMoves, type Move } from '../../engine/game';
import { createRng } from '../../engine/rng';
import { STANDARD_RULES, type RuleConfig } from '../../engine/rules';
import { createAiAgent, type AiAgent } from '../agent';
import type { AiProfile, Difficulty } from '../profiles';

export interface Contestant {
  readonly name: string;
  readonly difficulty: Difficulty;
  readonly overrides?: Partial<AiProfile>;
}

export interface MatchOutcome {
  /** Final scores, indexed by seat. */
  readonly scores: readonly [number, number];
  readonly koiKoiCalls: readonly [number, number];
  readonly decisions: number;
  readonly worstDecisionMs: number;
  readonly totalMs: number;
}

/** One match. `seats[0]` plays seat 0. */
export function playMatch(
  seed: number,
  seats: readonly [Contestant, Contestant],
  rounds: number,
  rules: RuleConfig = STANDARD_RULES,
): MatchOutcome {
  const config = { ...rules, rounds };
  let state = createGame(config, seed, 0);

  const agents: [AiAgent, AiAgent] = [
    createAiAgent(seats[0].difficulty, 0, createRng(seed ^ 0x1a2b3c4d), seats[0].overrides),
    createAiAgent(seats[1].difficulty, 1, createRng(seed ^ 0x5e6f7a8b), seats[1].overrides),
  ];

  const koiKoiCalls: [number, number] = [0, 0];
  let decisions = 0;
  let worstDecisionMs = 0;
  const started = performance.now();
  let guard = 0;

  while (!state.matchOver) {
    if (guard++ > 5000) throw new Error(`seed ${seed}: match did not terminate`);

    const moves = legalMoves(state);
    if (moves.length === 0) throw new Error(`seed ${seed}: no legal moves`);

    // Both agents watch every position — the belief is built from the *other*
    // player's turns, so skipping states would blind it.
    agents[0].observe(state);
    agents[1].observe(state);

    let move: Move;
    if (state.roundState.phase === 'round-end') {
      move = moves[0] as Move;
    } else {
      const seat = state.roundState.current;
      const t0 = performance.now();
      move = agents[seat].choose(state);
      const took = performance.now() - t0;
      if (took > worstDecisionMs) worstDecisionMs = took;
      decisions += 1;
      if (move.type === 'koikoi') koiKoiCalls[seat] += 1;
    }

    state = applyMove(state, move);
  }

  return {
    scores: [state.scores[0], state.scores[1]],
    koiKoiCalls,
    decisions,
    worstDecisionMs,
    totalMs: performance.now() - started,
  };
}

export interface PairedResult {
  readonly a: string;
  readonly b: string;
  readonly matches: number;
  /** Wins for A, counting a draw as half. */
  readonly aScore: number;
  readonly winRate: number;
  readonly winRateLow: number;
  readonly winRateHigh: number;
  /** Mean paired point difference (A − B), and its 95% interval. */
  readonly pointDiff: number;
  readonly pointDiffLow: number;
  readonly pointDiffHigh: number;
  readonly koiKoiPerMatch: readonly [number, number];
  readonly worstDecisionMs: number;
  readonly totalMs: number;
  /** Spread of per-round point differences, which calibrates ROUND_SD. */
  readonly roundSd: number;
}

/** Wilson score interval — honest at small N, unlike the normal approximation. */
function wilson(successes: number, n: number, z = 1.96): [number, number] {
  if (n === 0) return [0, 1];
  const p = successes / n;
  const d = 1 + (z * z) / n;
  const centre = p + (z * z) / (2 * n);
  const spread = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, (centre - spread) / d), Math.min(1, (centre + spread) / d)];
}

function meanAndInterval(values: readonly number[]): [number, number, number] {
  const n = values.length;
  if (n === 0) return [0, 0, 0];
  const mean = values.reduce((s, v) => s + v, 0) / n;
  if (n < 2) return [mean, mean, mean];
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
  const se = Math.sqrt(variance / n);
  return [mean, mean - 1.96 * se, mean + 1.96 * se];
}

/**
 * Play `pairs` seeds, each twice with the seats swapped, and report the result
 * with intervals. `a` and `b` are compared on the same deals throughout.
 */
export function runPaired(
  a: Contestant,
  b: Contestant,
  pairs: number,
  rounds = 6,
  rules: RuleConfig = STANDARD_RULES,
): PairedResult {
  let aScore = 0;
  const diffs: number[] = [];
  const koi: [number, number] = [0, 0];
  let worstDecisionMs = 0;
  let totalMs = 0;
  const roundDiffs: number[] = [];

  for (let i = 0; i < pairs; i++) {
    const seed = 1000 + i;
    for (const aSeat of [0, 1] as const) {
      const seats: [Contestant, Contestant] = aSeat === 0 ? [a, b] : [b, a];
      const out = playMatch(seed, seats, rounds, rules);
      const aPts = out.scores[aSeat];
      const bPts = out.scores[aSeat === 0 ? 1 : 0];

      diffs.push(aPts - bPts);
      roundDiffs.push((aPts - bPts) / rounds);
      if (aPts > bPts) aScore += 1;
      else if (aPts === bPts) aScore += 0.5;

      koi[0] += out.koiKoiCalls[aSeat];
      koi[1] += out.koiKoiCalls[aSeat === 0 ? 1 : 0];
      worstDecisionMs = Math.max(worstDecisionMs, out.worstDecisionMs);
      totalMs += out.totalMs;
    }
  }

  const matches = pairs * 2;
  const [low, high] = wilson(aScore, matches);
  const [pointDiff, pdLow, pdHigh] = meanAndInterval(diffs);
  const rdMean = roundDiffs.reduce((s, v) => s + v, 0) / Math.max(1, roundDiffs.length);
  const roundSd = Math.sqrt(
    roundDiffs.reduce((s, v) => s + (v - rdMean) ** 2, 0) / Math.max(1, roundDiffs.length - 1),
  );

  return {
    a: a.name,
    b: b.name,
    matches,
    aScore,
    winRate: aScore / matches,
    winRateLow: low,
    winRateHigh: high,
    pointDiff,
    pointDiffLow: pdLow,
    pointDiffHigh: pdHigh,
    koiKoiPerMatch: [koi[0] / matches, koi[1] / matches],
    worstDecisionMs,
    totalMs,
    roundSd,
  };
}

export function formatPaired(r: PairedResult): string {
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
  const sig = r.pointDiffLow > 0 ? '  ***' : r.pointDiffHigh < 0 ? '  (worse)' : '  (ns)';
  return [
    `${r.a} vs ${r.b}  — ${r.matches} matches (paired)`,
    `  win rate   ${pct(r.winRate)}  [${pct(r.winRateLow)}, ${pct(r.winRateHigh)}]`,
    `  point diff ${r.pointDiff >= 0 ? '+' : ''}${r.pointDiff.toFixed(2)}` +
      `  [${r.pointDiffLow.toFixed(2)}, ${r.pointDiffHigh.toFixed(2)}]${sig}`,
    `  koi-koi/match  ${r.koiKoiPerMatch[0].toFixed(2)} vs ${r.koiKoiPerMatch[1].toFixed(2)}`,
    `  worst decision ${r.worstDecisionMs.toFixed(0)}ms   total ${(r.totalMs / 1000).toFixed(1)}s`,
    `  round point sd ${r.roundSd.toFixed(1)}  (calibrates ROUND_SD)`,
  ].join('\n');
}
