/**
 * The one-ply policy every tier is built from.
 *
 * It is a single scoring function with a weight vector in front of it. Easy and
 * Normal are two sets of weights; the same function is also the playout policy
 * inside the search, so improving it improves every tier at once.
 *
 * Two defects in the policy it replaces are worth naming, because both were
 * silent and both mattered:
 *
 * **The yaku term was dead exactly when it counted.** The old code measured a
 * play's yaku gain by calling `applyMove` and diffing the capture pile. For a
 * play matching *two* field cards, `resolveCard` returns `captured: []` and a
 * pending choice — the capture has not happened yet — so the difference was
 * always zero. The strongest term in the function was switched off for every
 * play where the AI actually had a decision to make. Two-match plays are now
 * scored as the best of the two targets, which is what the engine will let it
 * pick anyway.
 *
 * **Denial did not exist.** Threat was measured as "does this one card complete
 * a yaku right now", which is false for nearly every card in nearly every
 * position: an opponent holding four Tane, or two of the three blue ribbons,
 * registered as no threat at all. Progress is now measured smoothly by
 * `evaluate.ts`, so the AI can see a plan half-built and refuse to feed it.
 */

import { getCard, type CardId } from '../engine/cards';
import {
  legalMoves,
  matchesFor,
  other,
  type GameState,
  type Move,
  type PlayerIndex,
} from '../engine/game';
import type { Rng } from '../engine/rng';
import { evaluateYaku } from '../engine/yaku';
import {
  pileStats,
  pileValueOf,
  pileWith,
  staticCardValue,
  type PileStats,
} from './evaluate';

export interface PolicyWeights {
  /** Multiplier on the raw worth of what a play takes. */
  capture: number;
  /** Multiplier on yaku progress gained. */
  build: number;
  /** Multiplier on what a play hands to, or takes from, the opponent. */
  denial: number;
  /** Extra appetite for bright cards. Easy chases them; stronger tiers do not. */
  brightBias: number;
  /** Reluctance to discard a valuable card. */
  discardCost: number;
  /** Bonus for sweeping all four of a month. */
  sweepBonus: number;
  /** 0 picks the best move; higher spreads the choice over near-equal moves. */
  softmaxTemp: number;
  /** Chance of deciding with the degraded weights below instead. */
  blunderRate: number;
}

/**
 * What a blunder looks like.
 *
 * Deliberately not random. A beginner who misplays has still made a decision —
 * they grabbed the shiny card and forgot everything else — and that reads as a
 * person. Uniform noise reads as a bug, which is precisely how the old random
 * Easy came across.
 */
const BLUNDER_WEIGHTS: PolicyWeights = {
  capture: 1,
  build: 0,
  denial: 0,
  brightBias: 3,
  discardCost: 0,
  sweepBonus: 0,
  softmaxTemp: 0,
  blunderRate: 0,
};

/** Bright-chasing, expressed as a bonus on top of the ordinary card value. */
function appetite(id: CardId, weights: PolicyWeights): number {
  const base = staticCardValue(id);
  return getCard(id).kind === 'hikari' ? base * weights.brightBias : base;
}

/**
 * Probability the opponent can capture a card of `month` from the field.
 *
 * Counting only — no belief, no peeking. The cards of that month not visible
 * anywhere are split between the opponent's hand and the deck, so this is the
 * chance that at least one landed in the hand. Inside a playout the opponent's
 * hand is concrete, but the policy still reasons from counts: playing both
 * sides with the same honest model keeps simulated opponents realistic rather
 * than clairvoyant.
 */
function reachableByOpponent(state: GameState, seat: PlayerIndex, card: CardId): number {
  const round = state.roundState;
  const month = getCard(card).month;

  let visible = 0;
  for (const id of round.field) if (getCard(id).month === month) visible += 1;
  for (const id of round.players[seat].hand) if (getCard(id).month === month) visible += 1;
  for (const id of round.players[0].captured) if (getCard(id).month === month) visible += 1;
  for (const id of round.players[1].captured) if (getCard(id).month === month) visible += 1;

  const remaining = 4 - visible;
  if (remaining <= 0) return 0;

  const handSize = round.players[other(seat)].hand.length;
  const hidden = handSize + round.deck.length;
  if (hidden <= 0) return 0;
  if (handSize >= hidden) return 1;

  // P(at least one of `remaining` hidden cards is in the hand), sampling
  // without replacement.
  let noneInHand = 1;
  for (let i = 0; i < remaining; i++) {
    const deckLeft = hidden - handSize - i;
    const left = hidden - i;
    if (left <= 0) break;
    noneInHand *= Math.max(0, deckLeft) / left;
  }
  return 1 - noneInHand;
}

/**
 * Everything about a position that does not change between candidate moves.
 *
 * Both capture piles get summarised once per decision rather than once per
 * candidate. Rebuilding them inside the loop was the single largest cost in a
 * playout, and playout count is what bounds how well the search plays.
 */
interface Context {
  readonly state: GameState;
  readonly seat: PlayerIndex;
  readonly mine: PileStats;
  readonly theirs: PileStats;
  /** Value of each pile as it stands, so only the delta is recomputed. */
  readonly mineValue: number;
  readonly theirsValue: number;
}

function contextFor(state: GameState, seat: PlayerIndex): Context {
  const round = state.roundState;
  const mine = pileStats(round.players[seat].captured, state.rules);
  const theirs = pileStats(round.players[other(seat)].captured, state.rules);
  return {
    state,
    seat,
    mine,
    theirs,
    mineValue: pileValueOf(mine, theirs, state.rules, round.month),
    theirsValue: pileValueOf(theirs, mine, state.rules, round.month),
  };
}

/** What those cards would be worth in the opponent's pile instead of ours. */
function worthToThem(ctx: Context, cards: readonly CardId[]): number {
  const { state } = ctx;
  return (
    pileValueOf(
      pileWith(ctx.theirs, cards, state.rules),
      ctx.mine,
      state.rules,
      state.roundState.month,
    ) - ctx.theirsValue
  );
}

/** Worth of taking `cards` into my pile, and of not leaving them for them. */
function captureWorth(ctx: Context, cards: readonly CardId[], weights: PolicyWeights): number {
  const { state } = ctx;

  let worth = 0;
  for (const id of cards) worth += appetite(id, weights) * weights.capture;

  // Yaku progress, measured on the whole capture at once so a pair that
  // completes something is valued as a pair.
  const after = pileValueOf(
    pileWith(ctx.mine, cards, state.rules),
    ctx.theirs,
    state.rules,
    state.roundState.month,
  );
  worth += (after - ctx.mineValue) * weights.build;

  // Taking a card the opponent wanted is worth more than its face value.
  if (weights.denial !== 0) worth += worthToThem(ctx, cards) * weights.denial;

  return worth;
}

/** Score one `play`. */
function scorePlay(ctx: Context, card: CardId, weights: PolicyWeights): number {
  const round = ctx.state.roundState;
  const matches = matchesFor(card, round.field);

  if (matches.length === 0) {
    // A discard. It costs whatever the card was worth, and it puts that card on
    // the table where the opponent may take it — the risk the old policy
    // claimed to price and never did.
    let score = -appetite(card, weights) * weights.discardCost;
    if (weights.denial !== 0) {
      const handover = worthToThem(ctx, [card]);
      score -= handover * reachableByOpponent(ctx.state, ctx.seat, card) * weights.denial;
    }
    return score;
  }

  if (matches.length === 3) {
    // All four of the month at once.
    return captureWorth(ctx, [card, ...matches], weights) + weights.sweepBonus;
  }

  // One or two matches. With two, the engine will ask which to take, so the
  // play is worth the better of them — not zero, which is what diffing the
  // capture pile after `applyMove` produced.
  let best = -Infinity;
  for (const target of matches) {
    best = Math.max(best, captureWorth(ctx, [card, target], weights));
  }
  return best;
}

/** Score one `chooseTarget`. */
function scoreTarget(ctx: Context, target: CardId, weights: PolicyWeights): number {
  const pending = ctx.state.roundState.pending;
  return captureWorth(ctx, pending ? [pending.card, target] : [target], weights);
}

/**
 * How much of the banked score is written off when a round is likely to end
 * without improving. Below 1 because a koi-koi caller still sometimes improves
 * on the very last card.
 */
const FORFEIT_RISK = 0.7;

/**
 * Whether continuing looks better than banking, cheaply.
 *
 * The searching tiers answer this by simulating both branches; this is the
 * version the playout policy uses, where it is called constantly and has to be
 * fast. Left unanswered it is worse than useless: with every koi-koi move
 * scoring zero the policy would call koi-koi every single time, and every
 * simulation would be built on an opponent who never stops.
 *
 * The trade is stated directly — risk what is banked to win what is not.
 */
export function koiKoiScore(
  state: GameState,
  seat: PlayerIndex,
  weights: PolicyWeights,
): number {
  const round = state.roundState;
  const mine = round.players[seat].captured;
  const theirs = round.players[other(seat)].captured;
  const rules = state.rules;

  const mineStats = pileStats(mine, rules);
  const theirsStats = pileStats(theirs, rules);

  const banked = evaluateYaku(mine, rules, round.month).base;
  const potential = pileValueOf(mineStats, theirsStats, rules, round.month);
  // Progress that is not scoring yet — the reason to keep playing.
  const unrealised = Math.max(0, potential - banked);

  const cardsLeft = round.players[seat].hand.length;
  if (cardsLeft === 0) return -Infinity; // nothing left to play; take the points
  const room = cardsLeft / 8;

  // How close the opponent looks to taking the round off us.
  const pressure = Math.min(
    1,
    pileValueOf(theirsStats, mineStats, rules, round.month) /
      Math.max(1, rules.sevenPointThreshold),
  );

  // Crossing the threshold doubles the round, so the last point or two before
  // it is worth far more than its face value.
  const toThreshold = rules.sevenPointThreshold - banked;
  const doubleBonus =
    banked > 0 && toThreshold > 0 && toThreshold <= 2
      ? banked * (rules.sevenPointMultiplier - 1) * 0.5
      : 0;

  // Every koi-koi already called raises the stakes for whoever finally scores,
  // so a caller who is behind on progress has more to lose each time.
  const carried = round.players[seat].koiKoiCalls;

  /*
   * The risk that actually bites, and the one this rule originally missed: a
   * player who calls koi-koi and then fails to improve before the hands run out
   * scores *nothing at all*. That is a far commoner way to lose the points than
   * the opponent taking them, and pricing only the opponent left the rule
   * calling koi-koi on the last card of the round with a completed Sanko in
   * hand — throwing away five guaranteed points for one draw. Because this rule
   * also drives every playout, the search inherited the mistake and learned to
   * avoid the plays that led to it.
   */
  const chanceOfNothing = 1 - room;

  const gain = (unrealised + doubleBonus) * room * (1 + weights.build * 0.1);
  const loss =
    banked * (chanceOfNothing * FORFEIT_RISK + pressure * (1 + carried * 0.6));

  return gain - loss;
}


function scoreWith(ctx: Context, move: Move, weights: PolicyWeights): number {
  switch (move.type) {
    case 'play':
      return scorePlay(ctx, move.card, weights);
    case 'chooseTarget':
      return scoreTarget(ctx, move.target, weights);
    case 'koikoi':
      return koiKoiScore(ctx.state, ctx.seat, weights);
    case 'shobu':
      // The baseline every koi-koi score is measured against.
      return 0;
    default:
      return 0;
  }
}

/** Score any move the engine offered. */
export function scoreMove(state: GameState, move: Move, weights: PolicyWeights): number {
  const seat = state.roundState.current;
  return scoreWith(contextFor(state, seat), move, weights);
}

/**
 * Pick among scored moves. `softmaxTemp` 0 takes the best; above that, moves
 * within reach of the best share the choice, so the same position does not
 * always produce the same move.
 */
function pick(scored: { move: Move; score: number }[], temp: number, rng: Rng): Move {
  let best = scored[0] as { move: Move; score: number };
  for (const entry of scored) if (entry.score > best.score) best = entry;
  if (temp <= 0) return best.move;

  let total = 0;
  const weights = scored.map((entry) => {
    const w = Math.exp((entry.score - best.score) / temp);
    total += w;
    return w;
  });

  let roll = rng.next() * total;
  for (let i = 0; i < scored.length; i++) {
    roll -= weights[i] ?? 0;
    if (roll <= 0) return (scored[i] as { move: Move }).move;
  }
  return best.move;
}

/**
 * Choose a move with the given weights. Never returns a move the engine did not
 * offer. Koi-koi decisions are not handled here — each tier answers those its
 * own way, in `profiles.ts` or by search.
 */
export function choosePolicyMove(state: GameState, weights: PolicyWeights, rng: Rng): Move {
  const moves = legalMoves(state);
  if (moves.length === 0) throw new Error('No legal moves available');
  if (moves.length === 1) return moves[0] as Move;

  const effective =
    weights.blunderRate > 0 && rng.next() < weights.blunderRate ? BLUNDER_WEIGHTS : weights;

  const ctx = contextFor(state, state.roundState.current);
  const scored = moves.map((move) => ({ move, score: scoreWith(ctx, move, effective) }));
  return pick(scored, effective.softmaxTemp, rng);
}
