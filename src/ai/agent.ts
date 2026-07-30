/**
 * An opponent, with a memory.
 *
 * The old entry point was a bare function taking only a `GameState`, which
 * meant it could never learn anything across a round — and inference is exactly
 * the thing that separates a strong Koi-Koi player from a calculating one. The
 * agent watches every position it is shown, folds the opponent's turns into a
 * belief, and searches from that.
 *
 * It also picks up a *style* at construction: a small random drift on its
 * weights, held for the whole match. The same position will not always draw the
 * same game out of it, which is what stops a strong opponent feeling like a
 * lookup table.
 */

import { legalMoves, type GameState, type Move, type PlayerIndex } from '../engine/game';
import { createRng, type Rng } from '../engine/rng';
import {
  foldObservation,
  neutralBelief,
  statelessBelief,
  type Belief,
} from './belief';
import { choosePolicyMove, koiKoiScore, type PolicyWeights } from './policy';
import {
  PLAYOUT_WEIGHTS,
  PROFILES,
  type AiProfile,
  type Difficulty,
} from './profiles';
import { searchMove, type SearchOptions } from './search';

export interface AiAgent {
  readonly difficulty: Difficulty;
  /** Fold a position into the belief. Safe to call on any state, repeatedly. */
  observe(state: GameState): void;
  /**
   * Choose a move. The generator yields between sampled worlds so a caller can
   * spread the work across frames; `next()` until done to run it straight
   * through.
   */
  plan(state: GameState): Generator<void, Move, void>;
  /** Run `plan` to completion. For tests, benchmarks and non-searching tiers. */
  choose(state: GameState): Move;
}

/** Nudge every weight by up to `drift`, once, for the life of the agent. */
function applyStyle(weights: PolicyWeights, drift: number, rng: Rng): PolicyWeights {
  if (drift <= 0) return weights;
  const jitter = (value: number) => value * (1 + (rng.next() * 2 - 1) * drift);
  return {
    ...weights,
    capture: jitter(weights.capture),
    build: jitter(weights.build),
    denial: jitter(weights.denial),
    discardCost: jitter(weights.discardCost),
  };
}

/**
 * Easy's koi-koi: a whim, weighted toward carrying on.
 *
 * Over-calling is exactly what beginners do. It is a real weakness — the
 * opponent gets a chance to take the round, and the multiplier rises for
 * whoever finally scores — and it makes rounds against Easy dramatic rather
 * than tidy.
 */
function impulsiveKoiKoi(state: GameState, seat: PlayerIndex, rng: Rng): boolean {
  const hand = state.roundState.players[seat].hand.length;
  if (hand === 0) return false;
  return rng.next() < 0.75;
}

function koiKoiMove(moves: readonly Move[], call: boolean): Move {
  const wanted = call ? 'koikoi' : 'shobu';
  return (moves.find((m) => m.type === wanted) ?? moves[0]) as Move;
}

export function createAiAgent(
  difficulty: Difficulty,
  seat: PlayerIndex,
  rng: Rng,
  overrides?: Partial<AiProfile>,
): AiAgent {
  const profile: AiProfile = { ...PROFILES[difficulty], ...overrides };
  const weights = applyStyle(profile.weights, profile.styleDrift, rng);

  let belief: Belief = neutralBelief();
  let observed = false;

  const searchOptions = (): SearchOptions => {
    const tuning = profile.search;
    if (!tuning) throw new Error('This profile does not search');
    return {
      budgetMs: tuning.budgetMs,
      maxWorlds: tuning.maxWorlds,
      matchAware: tuning.matchAware,
      useBelief: tuning.useBelief,
      rootTemp: tuning.rootTemp,
      confidence: tuning.confidence,
      playout: PLAYOUT_WEIGHTS,
    };
  };

  /**
   * The belief to search with. Folded observations are strictly better, so the
   * single-state estimate is only used when this agent has not been watching —
   * a resumed save, or the stateless entry point. Using both would count the
   * same evidence twice.
   */
  const beliefFor = (state: GameState): Belief =>
    observed ? belief : statelessBelief(state, seat);

  function* plan(state: GameState): Generator<void, Move, void> {
    const moves = legalMoves(state);
    if (moves.length === 0) throw new Error('No legal moves available');
    if (moves.length === 1) return moves[0] as Move;

    const isKoiKoi = moves.some((m) => m.type === 'koikoi');

    if (isKoiKoi && profile.koikoi === 'impulsive') {
      return koiKoiMove(moves, impulsiveKoiKoi(state, seat, rng));
    }
    if (isKoiKoi && profile.koikoi === 'rule') {
      return koiKoiMove(moves, koiKoiScore(state, seat, weights) > 0);
    }

    if (!profile.search) return choosePolicyMove(state, weights, rng);

    // Koi-koi has two branches rather than eight, so the same budget buys far
    // more worlds per branch — it is the cheapest place to be accurate, and the
    // most expensive place to be wrong.
    return yield* searchMove(state, seat, beliefFor(state), searchOptions(), rng);
  }

  return {
    difficulty,

    observe(state: GameState) {
      const next = foldObservation(belief, state, seat);
      if (next !== belief) {
        belief = next;
        observed = true;
      }
    },

    plan,

    choose(state: GameState): Move {
      const iter = plan(state);
      let step = iter.next();
      while (!step.done) step = iter.next();
      return step.value;
    },
  };
}

/**
 * Pick a move with no memory between calls.
 *
 * Kept because the tests, the benchmark and any caller that just wants a move
 * are better served by a function than by a lifecycle. It falls back to the
 * single-state belief, so it is weaker than a watching agent — which is the
 * honest cost of statelessness, not a bug.
 */
export function chooseAiMove(state: GameState, difficulty: Difficulty, rng: Rng): Move {
  const agent = createAiAgent(difficulty, state.roundState.current, rng);
  return agent.choose(state);
}

export { createRng };
