/**
 * Greedy heuristic policy — the "Normal" opponent, and the playout policy the
 * Monte Carlo search uses inside its simulations.
 *
 * It plays off the same engine as the human, so it can only ever pick a move
 * that `legalMoves` produced.
 */

import { CARD_IDS, getCard, type Card, type CardId } from '../engine/cards';
import {
  applyMove,
  legalMoves,
  matchesFor,
  other,
  type GameState,
  type Move,
  type PlayerIndex,
} from '../engine/game';
import type { Rng } from '../engine/rng';
import type { RuleConfig } from '../engine/rules';
import { evaluateYaku } from '../engine/yaku';

/**
 * Rough worth of holding a card, independent of yaku. Brights dominate,
 * then the cards that appear in specific yaku, then bulk.
 */
function cardValue(card: Card): number {
  switch (card.kind) {
    case 'hikari':
      // The Rain Man is worth noticeably less: it is excluded from Sanko and
      // downgrades Shiko to Ame-Shiko.
      return card.id === CARD_IDS.RAIN_MAN ? 14 : 20;
    case 'tane':
      if (card.id === CARD_IDS.SAKE_CUP) return 13; // feeds both -zake yaku
      if ([CARD_IDS.BOAR, CARD_IDS.DEER, CARD_IDS.BUTTERFLIES].includes(card.id as never)) return 11;
      return 8;
    case 'tanzaku':
      return card.ribbon === 'red-poetry' || card.ribbon === 'blue' ? 9 : 6;
    case 'kasu':
      return 2;
  }
}

/** Total value of the cards a move would capture. */
function captureValue(cards: readonly CardId[]): number {
  return cards.reduce((sum, id) => sum + cardValue(getCard(id)), 0);
}

/**
 * Score a candidate `play` move by simulating just that play (not the deck
 * flip, which is unknowable) and measuring what it wins and what it exposes.
 */
function scorePlay(state: GameState, move: Extract<Move, { type: 'play' }>): number {
  const round = state.roundState;
  const me = round.current;
  const matches = matchesFor(move.card, round.field);

  let score = 0;

  if (matches.length === 0) {
    // Discarding. Prefer to shed low-value cards, and penalise handing the
    // opponent a card they can pair with something already on the field.
    score -= cardValue(getCard(move.card)) * 1.4;
    const monthOnField = round.field.filter(
      (id) => getCard(id).month === getCard(move.card).month,
    ).length;
    score -= monthOnField * 3;
  } else {
    // Take the most valuable available match; three-card matches take all four.
    const best =
      matches.length === 3
        ? captureValue([move.card, ...matches])
        : cardValue(getCard(move.card)) + Math.max(...matches.map((id) => cardValue(getCard(id))));
    score += best;
    if (matches.length === 3) score += 6; // sweeping the month is worth extra
  }

  // Measure the actual yaku gain by applying the move.
  try {
    const after = applyMove(state, move);
    const beforeBase = evaluateYaku(round.players[me].captured, state.rules, round.month).base;
    const afterBase = evaluateYaku(
      after.roundState.players[me].captured,
      state.rules,
      round.month,
    ).base;
    score += (afterBase - beforeBase) * 12;
  } catch {
    // A pending choice or any other non-applicable move: fall back to the
    // static estimate above.
  }

  // Denial: leaving a card on the field that completes an opponent yaku is bad.
  score -= opponentThreat(state, move.card) * 2;

  return score;
}

/** How much the opponent would gain from the month of `card` being available. */
function opponentThreat(state: GameState, card: CardId): number {
  const round = state.roundState;
  const opp = other(round.current);
  const oppCaptured = round.players[opp].captured;
  const beforeBase = evaluateYaku(oppCaptured, state.rules, round.month).base;
  const afterBase = evaluateYaku([...oppCaptured, card], state.rules, round.month).base;
  return afterBase - beforeBase;
}

/** Choosing which of two matching field cards to take: take the better card. */
function scoreTarget(state: GameState, move: Extract<Move, { type: 'chooseTarget' }>): number {
  return cardValue(getCard(move.target)) + opponentThreat(state, move.target) * 2;
}

/**
 * Koi-koi or shobu. Continue only when the upside justifies the risk: the
 * opponent gets a chance to steal the round, and their multiplier grows too.
 */
export function shouldCallKoiKoi(state: GameState, player: PlayerIndex): boolean {
  const round = state.roundState;
  const { base } = evaluateYaku(round.players[player].captured, state.rules, round.month);
  const oppBase = evaluateYaku(round.players[other(player)].captured, state.rules, round.month).base;

  const cardsLeft = round.players[player].hand.length;

  // Nothing left to play: taking the points is the only sane move.
  if (cardsLeft === 0) return false;
  // A strong hand already doubles; do not risk it.
  if (base >= state.rules.sevenPointThreshold) return false;
  // The opponent is close to scoring — bank it.
  if (oppBase >= 3) return false;
  // Late in the round there is little room to improve.
  if (cardsLeft <= 2) return false;

  // Small yaku early on are worth pushing.
  return base <= 3 && cardsLeft >= 4;
}

/** Pick a move greedily. Never returns a move outside `legalMoves`. */
export function chooseHeuristicMove(state: GameState, rng: Rng): Move {
  const moves = legalMoves(state);
  if (moves.length === 0) throw new Error('No legal moves available');
  if (moves.length === 1) return moves[0] as Move;

  const first = moves[0] as Move;

  if (first.type === 'koikoi' || first.type === 'shobu') {
    const koi = shouldCallKoiKoi(state, state.roundState.current);
    return (moves.find((m) => m.type === (koi ? 'koikoi' : 'shobu')) ?? first) as Move;
  }

  const scored = moves.map((move) => {
    let score: number;
    if (move.type === 'play') score = scorePlay(state, move);
    else if (move.type === 'chooseTarget') score = scoreTarget(state, move);
    else score = 0;
    // A whisker of noise so the AI is not perfectly predictable across games.
    return { move, score: score + rng.next() * 0.5 };
  });

  scored.sort((a, b) => b.score - a.score);
  return (scored[0] as { move: Move }).move;
}

/** Play a state to the end of the current round with the greedy policy. */
export function playoutRound(state: GameState, rng: Rng, rules: RuleConfig): GameState {
  let s = state;
  let guard = 0;
  while (s.roundState.phase !== 'round-end' && guard++ < 400) {
    s = applyMove(s, chooseHeuristicMove(s, rng));
  }
  void rules;
  return s;
}
