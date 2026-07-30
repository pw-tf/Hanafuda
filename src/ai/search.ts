/**
 * Determinized Monte Carlo search — the thinking the top tiers do.
 *
 * The AI cannot see the opponent's hand or the deck order, so it repeatedly
 * *determinizes*: samples a concrete assignment of the unseen cards consistent
 * with everything observable, plays it out with the greedy policy, and averages.
 * This is flat perfect-information Monte Carlo, not MCTS — there is no tree and
 * no UCT, and the file it replaced was called `mcts.ts` while doing exactly the
 * same thing.
 *
 * Three things changed from that version, in descending order of how much they
 * matter:
 *
 * **Worlds are the outer loop.** Every candidate move is now scored against the
 * *same* sampled worlds. Previously each move drew its own worlds, so the argmax
 * was taken over estimates whose noise was independent — comparing moves partly
 * on how lucky their deals were. Common random numbers make the comparison about
 * the move. It costs nothing.
 *
 * **Successive halving.** Once a few worlds have been played, the hopeless
 * candidates stop being simulated and the budget concentrates on the contenders.
 *
 * **A wall clock, not a sample count.** The search returns the best it has when
 * time is up, so a slow phone searches less rather than stalling. It is a
 * generator, so the caller can spread that time across frames instead of
 * blocking the UI.
 *
 * A known limit, so the next reader does not simply raise the sample count and
 * wonder why nothing improves: flat determinization suffers from strategy
 * fusion — each playout assumes the hidden cards are known from that point on,
 * so the search cannot value keeping its options open. Fixing that needs
 * information-set MCTS, which is a different program.
 */

import {
  applyMove,
  legalMoves,
  other,
  type GameState,
  type Move,
  type PlayerIndex,
} from '../engine/game';
import { createRng, type Rng } from '../engine/rng';
import { evaluateYaku } from '../engine/yaku';
import { settleRound } from '../engine/scoring';
import { sampleConsistentWorld, worldRng, type Belief } from './belief';
import { matchUtility, roundUtility } from './evaluate';
import { choosePolicyMove, scoreMove, type PolicyWeights } from './policy';

export interface SearchOptions {
  /** Wall-clock budget in milliseconds. */
  budgetMs: number;
  /** Ceiling on sampled worlds, so a fast device does not burn battery. */
  maxWorlds: number;
  /** Weights the playouts are run with, for both sides. */
  playout: PolicyWeights;
  /** Value the match, not just the round. */
  matchAware: boolean;
  /** Sample the opponent's hand from the belief rather than uniformly. */
  useBelief: boolean;
  /** Spread the choice over candidates within a standard error of the best. */
  rootTemp: number;
  /**
   * How many standard errors the search must beat the policy's own choice by
   * before it is allowed to overrule it. See `chooseRoot`.
   */
  confidence: number;
  /** Injectable for tests. */
  now?: () => number;
}

/** Worlds after which the field of candidates is halved. */
const HALVING_POINTS = [8, 16, 32, 64, 128];
/** A playout cannot exceed a round; this only catches a logic error. */
const PLAYOUT_GUARD = 400;

function clock(options: SearchOptions): () => number {
  return options.now ?? (() => Date.now());
}

/** Play a determinized world out to the end of the round. */
function playout(state: GameState, rng: Rng, weights: PolicyWeights): GameState {
  let s = state;
  let guard = 0;
  while (s.roundState.phase !== 'round-end' && guard++ < PLAYOUT_GUARD) {
    s = applyMove(s, choosePolicyMove(s, weights, rng));
  }
  return s;
}

/**
 * Value of a finished playout, from `seat`'s point of view.
 *
 * The round result already carries both multipliers, so this is real points. If
 * a playout was cut short, the round is settled by hand from the yaku on the
 * table rather than falling back to a raw base difference, which would ignore
 * the koi-koi multiplier the position had already accrued.
 */
export function evaluateOutcome(
  terminal: GameState,
  seat: PlayerIndex,
  root: GameState,
  matchAware: boolean,
): number {
  const them = other(seat);
  const result = terminal.roundState.result;

  let diff: number;
  if (result) {
    diff = result.awarded[seat] - result.awarded[them];
  } else {
    const round = terminal.roundState;
    const mine = evaluateYaku(round.players[seat].captured, terminal.rules, round.month).base;
    const theirs = evaluateYaku(round.players[them].captured, terminal.rules, round.month).base;
    const calls = {
      byWinner: round.players[seat].koiKoiCalls,
      byLoser: round.players[them].koiKoiCalls,
    };
    diff =
      settleRound(mine, calls, terminal.rules).total -
      settleRound(theirs, { byWinner: calls.byLoser, byLoser: calls.byWinner }, terminal.rules)
        .total;
  }

  return matchAware ? matchUtility(root, seat, diff) : roundUtility(diff);
}

interface Candidate {
  move: Move;
  sum: number;
  /** Sum of squares, so the standard error is real rather than guessed at. */
  sumSq: number;
  n: number;
  /**
   * Value *relative to the policy's own pick*, accumulated per world.
   *
   * The paired difference is the number that matters. Both candidates saw the
   * same deal, so most of the variance cancels and what is left is the effect
   * of the move — the same reason the benchmark plays every seed twice with the
   * seats swapped.
   */
  diffSum: number;
  diffSumSq: number;
  /** This world's value, so the paired difference can be taken after the fact. */
  lastValue?: number;
}

/** Mean value of a candidate, or -Infinity if it was never simulated. */
function mean(c: Candidate): number {
  return c.n === 0 ? -Infinity : c.sum / c.n;
}

/**
 * Standard error of a candidate's *advantage over the baseline*.
 *
 * Measured, never estimated from the magnitude of the value: the utility is a
 * probability for the searching tiers and raw points for the ablation, so any
 * scale-derived fudge is wildly wrong for one of them. And it is the paired
 * difference rather than the absolute value, because both candidates saw the
 * same deal — the shared luck cancels, and what is left is the move.
 */
function diffStderr(c: Candidate): number {
  if (c.n < 2) return Infinity;
  const m = c.diffSum / c.n;
  const variance = Math.max(0, c.diffSumSq / c.n - m * m) * (c.n / (c.n - 1));
  return Math.sqrt(variance / c.n);
}

/**
 * Search for the best move. Yields between worlds, so a caller that cares about
 * frame time can spread the work; a caller that does not can drive it straight
 * to completion.
 */
export function* searchMove(
  state: GameState,
  seat: PlayerIndex,
  belief: Belief | null,
  options: SearchOptions,
  rng: Rng,
): Generator<void, Move, void> {
  const moves = legalMoves(state);
  if (moves.length === 0) throw new Error('No legal moves available');
  if (moves.length === 1) return moves[0] as Move;

  const now = clock(options);
  const deadline = now() + options.budgetMs;

  let live: Candidate[] = moves.map((move) => ({
    move,
    sum: 0,
    sumSq: 0,
    n: 0,
    diffSum: 0,
    diffSumSq: 0,
  }));

  /**
   * The policy's own choice, and the yardstick the search has to beat.
   *
   * Without one, the search simply takes the highest sampled mean — and with a
   * round outcome spread of ~10 points and a few dozen samples, the gap between
   * a good move and a mediocre one is the same size as the noise. Measured,
   * that search lost to the very policy driving its playouts. Anchoring it here
   * makes the search a refinement rather than a replacement: it may overrule
   * the policy, but only when the evidence says so.
   */
  /*
   * Koi-koi is the one decision the policy must not anchor.
   *
   * The anchor exists because with seven or eight candidates and a few dozen
   * samples the best sampled mean is mostly noise. Neither half of that applies
   * here: there are two branches, so each gets several times the samples, and
   * one of them — stopping — is exact, since the round settles immediately. The
   * policy's rule is also match-blind by construction, and reading the
   * scoreboard is precisely what the search is for. Anchoring it would hand the
   * decision back to the rule it is meant to improve on.
   */
  const anchored = !moves.some((m) => m.type === 'koikoi');
  const baselineMove = anchored ? bestByPolicy(state, options.playout) : null;
  const baseline = baselineMove
    ? (live.find((c) => sameMove(c.move, baselineMove)) ?? (live[0] as Candidate))
    : null;

  for (let w = 0; w < options.maxWorlds; w++) {
    if (w > 0 && now() >= deadline) break;

    const world = sampleConsistentWorld(
      state,
      seat,
      options.useBelief ? belief : null,
      worldRng(rng),
    );
    // One policy stream per world, reused across candidates, so early
    // tie-breaks inside the playouts are correlated too.
    const policySeed = rng.nextInt(0xffffffff);

    let baselineValue = 0;
    let haveBaseline = false;

    for (const candidate of live) {
      let next: GameState;
      try {
        next = applyMove(world, candidate.move);
      } catch {
        // Unreachable: determinization only rewrites the opponent's hand and
        // the deck, neither of which can make our own move illegal. Guarded
        // rather than trusted, and never counted — the old code divided by the
        // full sample count here, quietly dragging that move towards zero.
        continue;
      }
      const value = evaluateOutcome(
        playout(next, createRng(policySeed), options.playout),
        seat,
        state,
        options.matchAware,
      );
      candidate.sum += value;
      candidate.sumSq += value * value;
      candidate.n += 1;

      if (baseline !== null && candidate === baseline) {
        baselineValue = value;
        haveBaseline = true;
      }
      candidate.lastValue = value;
    }

    if (haveBaseline) {
      for (const candidate of live) {
        const d = (candidate.lastValue ?? baselineValue) - baselineValue;
        candidate.diffSum += d;
        candidate.diffSumSq += d * d;
      }
    }

    if (live.length > 2 && HALVING_POINTS.includes(w + 1)) {
      const survivors = [...live]
        .sort((a, b) => mean(b) - mean(a))
        .slice(0, Math.ceil(live.length / 2));
      // The baseline always survives: it is the yardstick, and dropping it
      // would leave the paired difference measured against nothing.
      if (baseline !== null && !survivors.includes(baseline)) survivors.push(baseline);
      live = survivors;
    }

    yield;
  }

  return chooseRoot(live, baseline, options, rng);
}

/**
 * Take the best candidate, or one indistinguishable from it.
 *
 * `rootTemp` above zero lets any candidate within that many standard errors of
 * the leader win the toss. It costs almost nothing in strength and stops the
 * opponent playing the identical line from the identical position every game.
 */
function chooseRoot(
  live: Candidate[],
  baseline: Candidate | null,
  options: SearchOptions,
  rng: Rng,
): Move {
  let best = live[0] as Candidate;
  for (const c of live) if (mean(c) > mean(best)) best = c;

  // Unanchored: take the search's answer outright.
  if (baseline === null) return best.move;

  if (best === baseline || best.n < 4) return baseline.move;

  // Overrule the policy only on evidence. The paired standard error is the
  // right yardstick: it is the spread of this move's *advantage*, not of its
  // absolute value, and the two differ by a lot once common random numbers have
  // cancelled the shared luck.
  const advantage = best.diffSum / best.n;
  const se = diffStderr(best);
  if (!Number.isFinite(se) || advantage <= se * options.confidence) return baseline.move;

  if (options.rootTemp <= 0) return best.move;

  // Among moves that also clearly beat the policy, any is a fair pick — which
  // is what stops a strong opponent replaying the identical line every game.
  const contenders = live.filter(
    (c) =>
      c.n >= 4 &&
      c.diffSum / c.n > diffStderr(c) * options.confidence &&
      advantage - c.diffSum / c.n <= diffStderr(best) * options.rootTemp,
  );
  if (contenders.length <= 1) return best.move;
  return (contenders[rng.nextInt(contenders.length)] as Candidate).move;
}

/** The policy's preferred move, taken deterministically. */
function bestByPolicy(state: GameState, weights: PolicyWeights): Move {
  const moves = legalMoves(state);
  let best = moves[0] as Move;
  let bestScore = -Infinity;
  for (const move of moves) {
    const score = scoreMove(state, move, weights);
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }
  return best;
}

function sameMove(a: Move, b: Move): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'play' && b.type === 'play') return a.card === b.card;
  if (a.type === 'chooseTarget' && b.type === 'chooseTarget') return a.target === b.target;
  return true;
}

/** Drive a search to completion without yielding. For tests and the bench. */
export function searchMoveSync(
  state: GameState,
  seat: PlayerIndex,
  belief: Belief | null,
  options: SearchOptions,
  rng: Rng,
): Move {
  const iter = searchMove(state, seat, belief, options, rng);
  let step = iter.next();
  while (!step.done) step = iter.next();
  return step.value;
}
