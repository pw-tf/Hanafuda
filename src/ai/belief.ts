/**
 * What the AI thinks is in the opponent's hand, and how it samples worlds.
 *
 * Strictly honest. Nothing here reads `players[opponent].hand` or `state.seed`,
 * and the `honesty` block in `src/ai/__tests__/ai.test.ts` holds that in place
 * by asserting the chosen move is unchanged when the hidden state is permuted
 * behind identical observations.
 *
 * Koi-Koi has no follow-suit, so there is never a *proof* that a player lacks a
 * month — every belief here is soft, and the sampler keeps every consistent
 * world reachable. What there is instead is the decline signal: a player who
 * could have taken a card off the table and did not probably could not. Card
 * counting needs no belief at all; the sampler draws from unseen cards, which
 * already respects how many of each month remain.
 *
 * The belief is per-card log-odds, neutral at zero. Negative means "less likely
 * to be holding this than chance".
 */

import { getCard, ALL_CARD_IDS, type CardId, type Month } from '../engine/cards';
import { other, type GameState, type PlayerIndex } from '../engine/game';
import { createRng, shuffle, type Rng } from '../engine/rng';
import { evaluateTeyaku } from '../engine/yaku';
import { staticCardValue } from './evaluate';

/** How hard a single declined month pushes the log-odds down. */
const DECLINE_BASE = 0.55;
/** Extra push when the turn captured nothing at all. */
const PURE_DISCARD_EXTRA = 0.25;
/** Per-turn nudge used by the stateless fallback, which has no history. */
const STATELESS_PER_TURN = 0.12;

/**
 * Log-odds are clamped, and so are the weights derived from them. Koi-Koi has
 * no hard voids, so no card may ever become impossible — an over-confident
 * belief that samples worlds excluding the truth is worse than no belief at
 * all, because the search then explores the wrong branch with conviction.
 */
const L_MIN = -1.6;
const L_MAX = 1.1;
const W_MIN = 0.2;
const W_MAX = 4;

export interface Belief {
  /** Card id → log-odds of being in the opponent's hand. */
  readonly odds: ReadonlyMap<CardId, number>;
  /** Round this belief describes, so a new round resets it. */
  readonly round: number;
  /** Opponent turns already folded in, so each is counted exactly once. */
  readonly turns: number;
}

export function neutralBelief(round = 0): Belief {
  return { odds: new Map(), round, turns: 0 };
}

/** Opponent turns completed, inferred from how many cards they have left. */
function opponentTurns(state: GameState, seat: PlayerIndex): number {
  return Math.max(0, 8 - state.roundState.players[other(seat)].hand.length);
}

/**
 * The field as it stood when the opponent chose, unwound from the trace.
 *
 * `resolveCard` always returns the played card first in `captured`, on both the
 * direct and the `chooseTarget` path, so filtering by identity recovers exactly
 * the field cards that were taken.
 */
function fieldBeforeTheirTurn(state: GameState): Set<CardId> {
  const round = state.roundState;
  const trace = round.trace;
  const field = new Set(round.field);

  // Undo the deck flip.
  if (trace.drawnCaptured.length > 0) {
    for (const id of trace.drawnCaptured) if (id !== trace.drawnCard) field.add(id);
  } else if (trace.drawnCard !== null) {
    field.delete(trace.drawnCard);
  }

  // Undo the hand play.
  if (trace.handCaptured.length > 0) {
    for (const id of trace.handCaptured) if (id !== trace.handCard) field.add(id);
  } else if (trace.handCard !== null) {
    field.delete(trace.handCard);
  }

  return field;
}

/**
 * Fold the opponent's just-finished turn into the belief.
 *
 * Safe to call on every state: it only acts when the trace describes a complete
 * opponent turn that has not been counted yet, and it restarts from neutral if
 * the state is not a legal successor of what it last saw — which is what makes
 * it survive a reload, a resumed save or a restart with no lifecycle to manage.
 */
export function foldObservation(
  belief: Belief,
  state: GameState,
  seat: PlayerIndex,
): Belief {
  const round = state.roundState;
  const trace = round.trace;
  const turns = opponentTurns(state, seat);

  // A new round, or a state that cannot follow the one we last saw.
  const roundNow = state.round;
  let base: Belief =
    belief.round === roundNow && turns >= belief.turns ? belief : neutralBelief(roundNow);

  if (trace.player === seat || trace.handCard === null) return base;
  if (turns <= base.turns) return base;

  const declinedField = fieldBeforeTheirTurn(state);
  const playedMonth = getCard(trace.handCard).month;
  const capturedNothing = trace.handCaptured.length === 0;

  // The strongest month they passed over, by month.
  const bestOnField = new Map<Month, number>();
  for (const id of declinedField) {
    const month = getCard(id).month;
    if (month === playedMonth) continue;
    bestOnField.set(month, Math.max(bestOnField.get(month) ?? 0, staticCardValue(id)));
  }

  const odds = new Map(base.odds);
  const visible = new Set<CardId>([
    ...round.field,
    ...round.players[0].captured,
    ...round.players[1].captured,
    ...round.players[seat].hand,
  ]);

  for (const [month, bestValue] of bestOnField) {
    // Declining a bright is far stronger evidence than declining a chaff, and
    // it is what makes the AI's later play legible: it stops feeding the months
    // you have visibly given up on.
    const attractiveness = 0.55 + 0.45 * (bestValue / 20);
    const push = DECLINE_BASE * attractiveness + (capturedNothing ? PURE_DISCARD_EXTRA : 0);

    for (const id of ALL_CARD_IDS) {
      if (visible.has(id)) continue;
      if (getCard(id).month !== month) continue;
      const next = (odds.get(id) ?? 0) - push;
      odds.set(id, Math.max(L_MIN, Math.min(L_MAX, next)));
    }
  }

  base = { odds, round: roundNow, turns };
  return base;
}

/**
 * What a single state permits, with no history to draw on.
 *
 * Used when the agent has not been watching — a resumed save, or the stateless
 * `chooseAiMove` entry point. A crude proxy for "that has been sitting there a
 * while and they never took it". Strictly better than uniform, and switched off
 * as soon as real observations exist so the evidence is not counted twice.
 */
export function statelessBelief(state: GameState, seat: PlayerIndex): Belief {
  const round = state.roundState;
  const turns = Math.min(5, opponentTurns(state, seat));
  if (turns <= 0) return neutralBelief(state.round);

  const visible = new Set<CardId>([
    ...round.field,
    ...round.players[0].captured,
    ...round.players[1].captured,
    ...round.players[seat].hand,
  ]);
  const onField = new Set<Month>(round.field.map((id) => getCard(id).month));

  const odds = new Map<CardId, number>();
  for (const id of ALL_CARD_IDS) {
    if (visible.has(id)) continue;
    if (!onField.has(getCard(id).month)) continue;
    odds.set(id, Math.max(L_MIN, -STATELESS_PER_TURN * turns));
  }
  return { odds, round: state.round, turns: 0 };
}

/**
 * One concrete assignment of the cards `seat` cannot see.
 *
 * Weighted sampling without replacement by the exponential-race method: each
 * candidate draws a key `Exp(1) / weight` and the smallest keys win. Linear,
 * never rejects, and no acceptance-rate cliff as the belief sharpens.
 *
 * `seed` is deliberately scrambled. `dealRound` is a pure function of the seed
 * and the round number, so a world that kept the real seed would still carry
 * the true deal inside it — this makes the hidden state unrecoverable even by a
 * future code path that tried.
 */
export function sampleWorld(
  state: GameState,
  seat: PlayerIndex,
  belief: Belief | null,
  rng: Rng,
): GameState {
  const round = state.roundState;
  const opp = other(seat);

  const known = new Set<CardId>([
    ...round.players[seat].hand,
    ...round.players[0].captured,
    ...round.players[1].captured,
    ...round.field,
    ...(round.pending ? [round.pending.card] : []),
  ]);

  const unseen = ALL_CARD_IDS.filter((id) => !known.has(id));
  const handSize = round.players[opp].hand.length;

  let oppHand: CardId[];
  let rest: CardId[];

  if (!belief || belief.odds.size === 0) {
    const shuffled = shuffle(unseen, rng);
    oppHand = shuffled.slice(0, handSize);
    rest = shuffled.slice(handSize);
  } else {
    const keyed = unseen.map((id) => {
      const weight = Math.max(W_MIN, Math.min(W_MAX, Math.exp(belief.odds.get(id) ?? 0)));
      // -ln(U) is Exp(1); U is never 0 from `next()` shifted off the boundary.
      const u = 1 - rng.next();
      return { id, key: -Math.log(u <= 0 ? Number.MIN_VALUE : u) / weight };
    });
    keyed.sort((a, b) => a.key - b.key);
    oppHand = keyed.slice(0, handSize).map((k) => k.id);
    rest = shuffle(
      keyed.slice(handSize).map((k) => k.id),
      rng,
    );
  }

  const players: [GameState['roundState']['players'][0], GameState['roundState']['players'][1]] = [
    round.players[0],
    round.players[1],
  ];
  players[opp] = { ...round.players[opp], hand: oppHand };

  return {
    ...state,
    seed: state.seed ^ 0x9e3779b1,
    roundState: { ...round, players, deck: rest },
  };
}

/**
 * A world that also respects what the deal already told us.
 *
 * With hand yaku enabled and the round still running, the opponent's dealt hand
 * provably was not four of a month and was not four pairs — the engine would
 * have ended the round at the deal. Exact, cheap, and only checkable while
 * their hand is still whole.
 */
export function sampleConsistentWorld(
  state: GameState,
  seat: PlayerIndex,
  belief: Belief | null,
  rng: Rng,
  attempts = 8,
): GameState {
  const opp = other(seat);
  const checkable =
    state.rules.teyakuEnabled && state.roundState.players[opp].hand.length === 8;

  let world = sampleWorld(state, seat, belief, rng);
  if (!checkable) return world;

  for (let i = 0; i < attempts; i++) {
    if (evaluateTeyaku(world.roundState.players[opp].hand, state.rules).length === 0) return world;
    world = sampleWorld(state, seat, belief, rng);
  }
  // Give up rather than loop: a rejected world is still a legal world to search.
  return world;
}

/** A decorrelated child stream, so each world is drawn independently. */
export function worldRng(rng: Rng): Rng {
  return createRng(rng.nextInt(0xffffffff));
}
