/**
 * The "Hard" opponent: determinized Monte Carlo search.
 *
 * Koi-Koi is a game of imperfect information — the AI cannot see the
 * opponent's hand or the deck order. So instead of searching the true game
 * tree, it repeatedly *determinizes*: it samples a concrete assignment of the
 * unseen cards that is consistent with everything it has observed, plays that
 * world out to the end of the round with the greedy policy, and averages the
 * outcome. The move with the best average is chosen.
 *
 * This is honest about the hidden information rather than cheating by reading
 * the opponent's hand.
 */

import { ALL_CARD_IDS, type CardId } from '../engine/cards';
import { applyMove, legalMoves, other, type GameState, type Move, type PlayerIndex } from '../engine/game';
import { createRng, shuffle, type Rng } from '../engine/rng';
import { evaluateYaku } from '../engine/yaku';
import { chooseHeuristicMove, shouldCallKoiKoi } from './heuristic';

export interface SearchOptions {
  /** Playouts per candidate move. Higher is stronger and slower. */
  samplesPerMove: number;
  /** Hard cap on total playouts, so a wide move list cannot stall the UI. */
  maxPlayouts: number;
}

export const DEFAULT_SEARCH: SearchOptions = { samplesPerMove: 40, maxPlayouts: 400 };

/**
 * Replace the opponent's hand and the deck with one random assignment of the
 * cards `player` cannot see. Everything `player` knows is left untouched.
 */
function determinize(state: GameState, player: PlayerIndex, rng: Rng): GameState {
  const round = state.roundState;
  const opp = other(player);

  const known = new Set<CardId>([
    ...round.players[player].hand,
    ...round.players[0].captured,
    ...round.players[1].captured,
    ...round.field,
    ...(round.pending ? [round.pending.card] : []),
  ]);

  const unseen = shuffle(
    ALL_CARD_IDS.filter((id) => !known.has(id)),
    rng,
  );

  const oppHandSize = round.players[opp].hand.length;
  const oppHand = unseen.slice(0, oppHandSize);
  const deck = unseen.slice(oppHandSize);

  const players: [typeof round.players[0], typeof round.players[1]] = [
    round.players[0],
    round.players[1],
  ];
  players[opp] = { ...round.players[opp], hand: oppHand };

  return { ...state, roundState: { ...round, players, deck } };
}

/**
 * Value of a finished round from `player`'s point of view. Falls back to the
 * yaku difference if the playout was cut short.
 */
function evaluateOutcome(state: GameState, player: PlayerIndex): number {
  const result = state.roundState.result;
  if (result) {
    return result.awarded[player] - result.awarded[other(player)];
  }
  const mine = evaluateYaku(state.roundState.players[player].captured, state.rules, state.roundState.month).base;
  const theirs = evaluateYaku(
    state.roundState.players[other(player)].captured,
    state.rules,
    state.roundState.month,
  ).base;
  return mine - theirs;
}

/** Play a determinized world to the end of the round with the greedy policy. */
function playout(state: GameState, rng: Rng): GameState {
  let s = state;
  let guard = 0;
  while (s.roundState.phase !== 'round-end' && guard++ < 400) {
    s = applyMove(s, chooseHeuristicMove(s, rng));
  }
  return s;
}

export function chooseMonteCarloMove(
  state: GameState,
  rng: Rng,
  options: SearchOptions = DEFAULT_SEARCH,
): Move {
  const moves = legalMoves(state);
  if (moves.length === 0) throw new Error('No legal moves available');
  if (moves.length === 1) return moves[0] as Move;

  const player = state.roundState.current;

  // The koi-koi decision is a risk judgement about the rest of the round, so
  // it is answered by simulating both branches rather than by a rule of thumb.
  if (moves.some((m) => m.type === 'koikoi')) {
    return chooseKoiKoi(state, player, rng, options);
  }

  const samples = Math.max(
    8,
    Math.min(options.samplesPerMove, Math.floor(options.maxPlayouts / moves.length)),
  );

  let bestMove: Move = moves[0] as Move;
  let bestScore = -Infinity;

  for (const move of moves) {
    let total = 0;
    for (let i = 0; i < samples; i++) {
      const world = determinize(state, player, createRng(rng.nextInt(0xffffffff)));
      let next: GameState;
      try {
        next = applyMove(world, move);
      } catch {
        // The move can be illegal in a determinized world only if the sampling
        // is wrong; skip rather than crash the turn.
        continue;
      }
      total += evaluateOutcome(playout(next, rng), player);
    }
    const score = total / samples;
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}

/** Simulate continuing versus stopping, and take whichever pays more. */
function chooseKoiKoi(
  state: GameState,
  player: PlayerIndex,
  rng: Rng,
  options: SearchOptions,
): Move {
  const moves = legalMoves(state);
  const shobu = moves.find((m) => m.type === 'shobu');
  const koikoi = moves.find((m) => m.type === 'koikoi');
  if (!shobu || !koikoi) return moves[0] as Move;

  // Stopping is deterministic — the round settles immediately.
  const stopValue = evaluateOutcome(applyMove(state, shobu), player);

  const samples = Math.max(12, Math.floor(options.maxPlayouts / 2));
  let total = 0;
  for (let i = 0; i < samples; i++) {
    const world = determinize(state, player, createRng(rng.nextInt(0xffffffff)));
    total += evaluateOutcome(playout(applyMove(world, koikoi), rng), player);
  }
  const continueValue = total / samples;

  // Require a real edge before gambling, and keep the heuristic as a guard
  // against obviously reckless continuations (e.g. an empty hand).
  if (!shouldCallKoiKoi(state, player) && continueValue <= stopValue + 2) return shobu;
  return continueValue > stopValue + 0.75 ? koikoi : shobu;
}
