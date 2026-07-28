/**
 * Koi-Koi game state machine. Pure and fully serializable: `applyMove` never
 * mutates its input, and a state object can be sent over the wire as-is.
 *
 * Turn structure (one turn = one hand card AND one deck flip):
 *   1. play a card from hand   -> match it against the field
 *   2. flip the top deck card  -> match it against the field
 *   3. if the player's yaku total went up, they choose koi-koi or shobu
 *
 * Matching, identical for both the hand card and the flipped card:
 *   0 field cards of that month -> the card stays on the field
 *   1                           -> capture both
 *   2                           -> the player chooses which one to take
 *   3                           -> capture all four
 *
 * A field can never hold four cards of one month (the deal re-deals if it
 * would, and in play the fourth card always triggers the capture-all rule),
 * so the match count is always 0-3.
 */

import { ALL_CARD_IDS, getCard, type CardId, type Month } from './cards';
import { createRng, shuffle } from './rng';
import type { RuleConfig } from './rules';
import { settleRound, type RoundSettlement } from './scoring';
import { evaluateTeyaku, evaluateYaku, type ScoredYaku } from './yaku';

export type PlayerIndex = 0 | 1;

export const HAND_SIZE = 8;
export const FIELD_SIZE = 8;

export interface PlayerState {
  readonly hand: readonly CardId[];
  readonly captured: readonly CardId[];
  readonly koiKoiCalls: number;
  /**
   * The player's yaku base the last time they were offered a koi-koi decision.
   * A capture only ever adds cards, so the base is monotonically
   * non-decreasing within a round; `base > yakuBaseAtLastCheck` is therefore
   * exactly the "formed a new yaku or improved an existing one" condition.
   */
  readonly yakuBaseAtLastCheck: number;
}

export type RoundPhase =
  /** Current player must play a card from hand. */
  | 'play'
  /** The played hand card matched two field cards; pick one. */
  | 'choose-hand-target'
  /** Hand card resolved; flip the top of the deck. */
  | 'draw'
  /** The flipped card matched two field cards; pick one. */
  | 'choose-draw-target'
  /** Current player's yaku improved; koi-koi or shobu. */
  | 'koikoi'
  | 'round-end';

export interface PendingChoice {
  readonly card: CardId;
  readonly source: 'hand' | 'deck';
  readonly options: readonly CardId[];
}

/** What happened in the current turn, for animation and the move log. */
export interface TurnTrace {
  readonly player: PlayerIndex;
  readonly handCard: CardId | null;
  readonly handCaptured: readonly CardId[];
  readonly drawnCard: CardId | null;
  readonly drawnCaptured: readonly CardId[];
}

export type RoundEndReason = 'shobu' | 'teyaku' | 'exhausted';

export interface RoundResult {
  readonly round: number;
  readonly reason: RoundEndReason;
  /** Points added to each player's match score. */
  readonly awarded: readonly [number, number];
  readonly winner: PlayerIndex | null;
  /** Multiplier arithmetic for the winner, so the UI can show its working. */
  readonly settlement: RoundSettlement | null;
  /** The winner's scoring yaku (or the teyaku, when the round ended at the deal). */
  readonly yaku: readonly ScoredYaku[];
  readonly teyaku: readonly [readonly ScoredYaku[], readonly ScoredYaku[]];
}

export interface RoundState {
  readonly phase: RoundPhase;
  readonly current: PlayerIndex;
  readonly dealer: PlayerIndex;
  /** Round number doubles as the round's month, for the Tsuki-fuda rule. */
  readonly month: Month;
  readonly deck: readonly CardId[];
  readonly field: readonly CardId[];
  readonly players: readonly [PlayerState, PlayerState];
  readonly pending: PendingChoice | null;
  readonly trace: TurnTrace;
  readonly result: RoundResult | null;
}

export interface GameState {
  readonly rules: RuleConfig;
  readonly seed: number;
  readonly round: number;
  readonly scores: readonly [number, number];
  readonly roundState: RoundState;
  readonly history: readonly RoundResult[];
  readonly matchOver: boolean;
}

export type Move =
  | { readonly type: 'play'; readonly card: CardId }
  | { readonly type: 'chooseTarget'; readonly target: CardId }
  | { readonly type: 'draw' }
  | { readonly type: 'koikoi' }
  | { readonly type: 'shobu' }
  | { readonly type: 'nextRound' };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function other(player: PlayerIndex): PlayerIndex {
  return player === 0 ? 1 : 0;
}

/** Field cards sharing a month with `card`. Always 0-3 entries. */
export function matchesFor(card: CardId, field: readonly CardId[]): CardId[] {
  const month = getCard(card).month;
  return field.filter((id) => getCard(id).month === month);
}

function without<T>(items: readonly T[], remove: readonly T[]): T[] {
  const drop = new Set(remove);
  return items.filter((i) => !drop.has(i));
}

const emptyTrace = (player: PlayerIndex): TurnTrace => ({
  player,
  handCard: null,
  handCaptured: [],
  drawnCard: null,
  drawnCaptured: [],
});

function updatePlayer(
  players: readonly [PlayerState, PlayerState],
  index: PlayerIndex,
  patch: Partial<PlayerState>,
): [PlayerState, PlayerState] {
  const next: [PlayerState, PlayerState] = [players[0], players[1]];
  next[index] = { ...players[index], ...patch };
  return next;
}

// ---------------------------------------------------------------------------
// Dealing
// ---------------------------------------------------------------------------

/** True if the field shows all four cards of any single month — requires a re-deal. */
function fieldNeedsRedeal(field: readonly CardId[]): boolean {
  const counts = new Map<Month, number>();
  for (const id of field) {
    const m = getCard(id).month;
    counts.set(m, (counts.get(m) ?? 0) + 1);
  }
  return [...counts.values()].some((n) => n >= 4);
}

function dealRound(seed: number, round: number, dealer: PlayerIndex, rules: RuleConfig): RoundState {
  let hands: CardId[][] = [];
  let field: CardId[] = [];
  let deck: CardId[] = [];

  // Re-deal until the field is legal. Each attempt mixes into the seed so the
  // deal stays a pure function of (seed, round).
  for (let attempt = 0; attempt < 100; attempt++) {
    const rng = createRng((seed ^ (round * 0x9e3779b1) ^ (attempt * 0x85ebca6b)) >>> 0);
    const shuffled = shuffle(ALL_CARD_IDS, rng);

    // Traditional deal order: 8 to each player, then 8 to the field.
    hands = [shuffled.slice(0, HAND_SIZE), shuffled.slice(HAND_SIZE, HAND_SIZE * 2)];
    field = shuffled.slice(HAND_SIZE * 2, HAND_SIZE * 2 + FIELD_SIZE);
    deck = shuffled.slice(HAND_SIZE * 2 + FIELD_SIZE);

    if (!fieldNeedsRedeal(field)) break;
  }

  const makePlayer = (i: number): PlayerState => ({
    hand: hands[i] ?? [],
    captured: [],
    koiKoiCalls: 0,
    yakuBaseAtLastCheck: 0,
  });

  const base: RoundState = {
    phase: 'play',
    current: dealer, // the dealer leads
    dealer,
    month: (((round - 1) % 12) + 1) as Month,
    deck,
    field,
    players: [makePlayer(0), makePlayer(1)],
    pending: null,
    trace: emptyTrace(dealer),
    result: null,
  };

  // Hand yaku are checked once, against the cards as dealt, and end the round
  // immediately when present.
  const teyaku: [ScoredYaku[], ScoredYaku[]] = [
    evaluateTeyaku(base.players[0].hand, rules),
    evaluateTeyaku(base.players[1].hand, rules),
  ];

  if (teyaku[0].length > 0 || teyaku[1].length > 0) {
    const points = (list: ScoredYaku[]): number => list.reduce((s, y) => s + y.points, 0);
    const awarded: [number, number] = [points(teyaku[0]), points(teyaku[1])];
    // Both players can qualify; each simply takes their own hand yaku.
    const winner: PlayerIndex | null =
      awarded[0] > awarded[1] ? 0 : awarded[1] > awarded[0] ? 1 : null;

    return {
      ...base,
      phase: 'round-end',
      result: {
        round,
        reason: 'teyaku',
        awarded,
        winner,
        settlement: null,
        yaku: winner === null ? [] : teyaku[winner],
        teyaku,
      },
    };
  }

  return base;
}

export function createGame(rules: RuleConfig, seed: number, firstDealer: PlayerIndex = 0): GameState {
  return {
    rules,
    seed,
    round: 1,
    scores: [0, 0],
    roundState: dealRound(seed, 1, firstDealer, rules),
    history: [],
    matchOver: false,
  };
}

// ---------------------------------------------------------------------------
// Capture resolution
// ---------------------------------------------------------------------------

interface CaptureOutcome {
  field: CardId[];
  captured: CardId[];
  pending: PendingChoice | null;
}

/**
 * Resolve one card against the field.
 * `target` is only consulted in the two-match case.
 */
function resolveCard(
  card: CardId,
  field: readonly CardId[],
  source: 'hand' | 'deck',
  target?: CardId,
): CaptureOutcome {
  const matches = matchesFor(card, field);

  if (matches.length === 0) {
    return { field: [...field, card], captured: [], pending: null };
  }

  if (matches.length === 1) {
    const [only] = matches as [CardId];
    return { field: without(field, [only]), captured: [card, only], pending: null };
  }

  if (matches.length === 2) {
    if (target === undefined || !matches.includes(target)) {
      return { field: [...field], captured: [], pending: { card, source, options: matches } };
    }
    return { field: without(field, [target]), captured: [card, target], pending: null };
  }

  // Three on the field: the played card takes all four.
  return { field: without(field, matches), captured: [card, ...matches], pending: null };
}

// ---------------------------------------------------------------------------
// Turn progression
// ---------------------------------------------------------------------------

/**
 * After the flipped card has been resolved: score the current player, then
 * either offer a koi-koi decision, end the round, or pass the turn.
 */
function finishTurn(state: GameState, round: RoundState): RoundState {
  const player = round.players[round.current];
  const { base } = evaluateYaku(player.captured, state.rules, round.month);
  const handsEmpty = round.players[0].hand.length === 0 && round.players[1].hand.length === 0;

  if (base > player.yakuBaseAtLastCheck) {
    // On the very last turn there is nothing left to gain from continuing —
    // calling koi-koi could only forfeit the points — so the round is settled
    // automatically rather than offering a choice that is always wrong.
    if (handsEmpty) {
      return settleForWinner(state, round, round.current, 'shobu');
    }
    return { ...round, phase: 'koikoi' };
  }

  if (handsEmpty) {
    return endWithoutYaku(state, round);
  }

  return {
    ...round,
    phase: 'play',
    current: other(round.current),
    pending: null,
    trace: emptyTrace(other(round.current)),
  };
}

function settleForWinner(
  state: GameState,
  round: RoundState,
  winner: PlayerIndex,
  reason: RoundEndReason,
): RoundState {
  const { yaku, base } = evaluateYaku(round.players[winner].captured, state.rules, round.month);
  const settlement = settleRound(
    base,
    {
      byWinner: round.players[winner].koiKoiCalls,
      byLoser: round.players[other(winner)].koiKoiCalls,
    },
    state.rules,
  );

  const awarded: [number, number] = [0, 0];
  awarded[winner] = settlement.total;

  return {
    ...round,
    phase: 'round-end',
    pending: null,
    result: {
      round: state.round,
      reason,
      awarded,
      winner,
      settlement,
      yaku,
      teyaku: [[], []],
    },
  };
}

/** Both hands are empty and nobody called shobu. */
function endWithoutYaku(state: GameState, round: RoundState): RoundState {
  const awarded: [number, number] = [0, 0];
  let winner: PlayerIndex | null = null;

  if (state.rules.drawRule === 'dealer-6') {
    awarded[round.dealer] = 6;
    winner = round.dealer;
  }

  return {
    ...round,
    phase: 'round-end',
    pending: null,
    result: {
      round: state.round,
      reason: 'exhausted',
      awarded,
      winner,
      settlement: null,
      yaku: [],
      teyaku: [[], []],
    },
  };
}

// ---------------------------------------------------------------------------
// Moves
// ---------------------------------------------------------------------------

export function legalMoves(state: GameState): Move[] {
  const round = state.roundState;

  switch (round.phase) {
    case 'play':
      return round.players[round.current].hand.map((card) => ({ type: 'play', card }));
    case 'choose-hand-target':
    case 'choose-draw-target':
      return (round.pending?.options ?? []).map((target) => ({ type: 'chooseTarget', target }));
    case 'draw':
      return [{ type: 'draw' }];
    case 'koikoi':
      return [{ type: 'koikoi' }, { type: 'shobu' }];
    case 'round-end':
      return state.matchOver ? [] : [{ type: 'nextRound' }];
  }
}

export class IllegalMoveError extends Error {}

export function applyMove(state: GameState, move: Move): GameState {
  const round = state.roundState;

  switch (move.type) {
    case 'play': {
      if (round.phase !== 'play') throw new IllegalMoveError(`Cannot play in phase ${round.phase}`);
      const player = round.players[round.current];
      if (!player.hand.includes(move.card)) {
        throw new IllegalMoveError(`Card ${move.card} is not in the current player's hand`);
      }

      const outcome = resolveCard(move.card, round.field, 'hand');
      const players = updatePlayer(round.players, round.current, {
        hand: without(player.hand, [move.card]),
        captured: [...player.captured, ...outcome.captured],
      });

      return {
        ...state,
        roundState: {
          ...round,
          phase: outcome.pending ? 'choose-hand-target' : 'draw',
          field: outcome.field,
          players,
          pending: outcome.pending,
          trace: {
            ...round.trace,
            player: round.current,
            handCard: move.card,
            handCaptured: outcome.captured,
          },
        },
      };
    }

    case 'chooseTarget': {
      const pending = round.pending;
      if (!pending || (round.phase !== 'choose-hand-target' && round.phase !== 'choose-draw-target')) {
        throw new IllegalMoveError(`No pending capture choice in phase ${round.phase}`);
      }
      if (!pending.options.includes(move.target)) {
        throw new IllegalMoveError(`${move.target} is not one of the matching field cards`);
      }

      const outcome = resolveCard(pending.card, round.field, pending.source, move.target);
      const player = round.players[round.current];
      const players = updatePlayer(round.players, round.current, {
        captured: [...player.captured, ...outcome.captured],
      });

      const fromHand = pending.source === 'hand';
      const nextRound: RoundState = {
        ...round,
        field: outcome.field,
        players,
        pending: null,
        trace: fromHand
          ? { ...round.trace, handCaptured: outcome.captured }
          : { ...round.trace, drawnCaptured: outcome.captured },
      };

      if (fromHand) {
        return { ...state, roundState: { ...nextRound, phase: 'draw' } };
      }
      return { ...state, roundState: finishTurn(state, nextRound) };
    }

    case 'draw': {
      if (round.phase !== 'draw') throw new IllegalMoveError(`Cannot draw in phase ${round.phase}`);

      // The deck holds 24 cards and a full round uses at most 16, so this is a
      // guard rather than a reachable branch.
      const drawn = round.deck[0];
      if (drawn === undefined) {
        return { ...state, roundState: finishTurn(state, { ...round, phase: 'draw' }) };
      }

      const outcome = resolveCard(drawn, round.field, 'deck');
      const player = round.players[round.current];
      const players = updatePlayer(round.players, round.current, {
        captured: [...player.captured, ...outcome.captured],
      });

      const nextRound: RoundState = {
        ...round,
        deck: round.deck.slice(1),
        field: outcome.field,
        players,
        pending: outcome.pending,
        trace: { ...round.trace, drawnCard: drawn, drawnCaptured: outcome.captured },
      };

      if (outcome.pending) {
        return { ...state, roundState: { ...nextRound, phase: 'choose-draw-target' } };
      }
      return { ...state, roundState: finishTurn(state, nextRound) };
    }

    case 'koikoi': {
      if (round.phase !== 'koikoi') throw new IllegalMoveError(`Cannot call koi-koi in phase ${round.phase}`);
      const player = round.players[round.current];
      const { base } = evaluateYaku(player.captured, state.rules, round.month);
      const players = updatePlayer(round.players, round.current, {
        koiKoiCalls: player.koiKoiCalls + 1,
        yakuBaseAtLastCheck: base,
      });
      const next = other(round.current);

      return {
        ...state,
        roundState: {
          ...round,
          phase: 'play',
          current: next,
          players,
          pending: null,
          trace: emptyTrace(next),
        },
      };
    }

    case 'shobu': {
      if (round.phase !== 'koikoi') throw new IllegalMoveError(`Cannot call shobu in phase ${round.phase}`);
      return { ...state, roundState: settleForWinner(state, round, round.current, 'shobu') };
    }

    case 'nextRound': {
      if (round.phase !== 'round-end' || !round.result) {
        throw new IllegalMoveError(`Round is not over (phase ${round.phase})`);
      }
      if (state.matchOver) throw new IllegalMoveError('Match is already over');

      const result = round.result;
      const scores: [number, number] = [
        state.scores[0] + result.awarded[0],
        state.scores[1] + result.awarded[1],
      ];
      const history = [...state.history, result];
      const nextRoundNumber = state.round + 1;

      if (nextRoundNumber > state.rules.rounds) {
        return { ...state, scores, history, matchOver: true };
      }

      return {
        ...state,
        round: nextRoundNumber,
        scores,
        history,
        // The deal alternates every round.
        roundState: dealRound(state.seed, nextRoundNumber, other(round.dealer), state.rules),
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Read-only views for the UI and AI
// ---------------------------------------------------------------------------

/** A player's currently completed yaku. */
export function currentYaku(state: GameState, player: PlayerIndex) {
  return evaluateYaku(state.roundState.players[player].captured, state.rules, state.roundState.month);
}

/** True when the round is finished and the match can advance. */
export function isRoundOver(state: GameState): boolean {
  return state.roundState.phase === 'round-end';
}

/** Whether it is `player`'s turn to submit a move. */
export function isTurnOf(state: GameState, player: PlayerIndex): boolean {
  const { phase, current } = state.roundState;
  if (phase === 'round-end') return false;
  return current === player;
}
