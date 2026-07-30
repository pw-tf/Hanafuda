/**
 * What the opponents should actually *do*, tested one behaviour at a time.
 *
 * Match play is far too noisy to be a CI test — the suite this replaces tried
 * it over eight seeds and could not have caught any regression short of a
 * crash. Strength belongs in `npm run bench:ai`. These are hand-built positions
 * with a right answer, they run in milliseconds, and each one maps to a
 * specific defect that was fixed.
 */

import { describe, expect, it } from 'vitest';
import { CARD_IDS, idsOfMonth, type CardId, type Month } from '../../engine/cards';
import {
  legalMoves,
  matchesFor,
  type GameState,
  type PlayerIndex,
  type RoundState,
} from '../../engine/game';
import { createRng } from '../../engine/rng';
import { STANDARD_RULES, type RuleConfig } from '../../engine/rules';
import { createAiAgent } from '../agent';
import { NORMAL_WEIGHTS, PROFILES, type Difficulty } from '../profiles';
import { scoreMove } from '../policy';

const monthIds = (m: number): CardId[] => idsOfMonth(m as Month);

interface Over {
  hand0?: CardId[];
  hand1?: CardId[];
  field?: CardId[];
  deck?: CardId[];
  captured0?: CardId[];
  captured1?: CardId[];
  current?: PlayerIndex;
  phase?: RoundState['phase'];
  scores?: [number, number];
  round?: number;
  rules?: RuleConfig;
  koi0?: number;
}

function makeState(over: Over): GameState {
  const rules = over.rules ?? STANDARD_RULES;
  const roundState: RoundState = {
    phase: over.phase ?? 'play',
    current: over.current ?? 0,
    dealer: 0,
    month: 1,
    deck: over.deck ?? [],
    field: over.field ?? [],
    players: [
      {
        hand: over.hand0 ?? [],
        captured: over.captured0 ?? [],
        koiKoiCalls: over.koi0 ?? 0,
        yakuBaseAtLastCheck: 0,
      },
      { hand: over.hand1 ?? [], captured: over.captured1 ?? [], koiKoiCalls: 0, yakuBaseAtLastCheck: 0 },
    ],
    pending: null,
    trace: {
      player: over.current ?? 0,
      handCard: null,
      handCaptured: [],
      drawnCard: null,
      drawnCaptured: [],
    },
    result: null,
  };
  return {
    rules,
    seed: 1,
    round: over.round ?? 1,
    scores: over.scores ?? [0, 0],
    roundState,
    history: [],
    matchOver: false,
  };
}

/** Deterministic decision from a fresh agent. */
function decide(state: GameState, difficulty: Difficulty, seed = 5) {
  const seat = state.roundState.current;
  return createAiAgent(difficulty, seat, createRng(seed), {
    // Small budgets: these positions are about direction, not depth.
    search: PROFILES[difficulty].search
      ? { ...PROFILES[difficulty].search!, budgetMs: 250, maxWorlds: 60 }
      : null,
  }).choose(state);
}

const THINKERS: Difficulty[] = ['normal', 'hard', 'expert'];

describe('taking the card that scores', () => {
  /**
   * The regression guard for the worst bug in the old policy.
   *
   * It measured a play's yaku gain by applying the move and diffing the capture
   * pile — but a play matching *two* field cards resolves to a pending choice
   * with `captured: []`, so the difference was always zero. The strongest term
   * in the evaluation was switched off for exactly the plays where the AI had a
   * decision to make.
   *
   * Asserted on the score rather than the chosen move, deliberately. Whether to
   * take a capture *now* is a tempo question the search is entitled to answer
   * differently — it will happily play a spare card first and collect the bright
   * next turn when nobody can take it. What must never happen again is the
   * completing play being valued at nothing.
   */
  it('values a two-match play that completes Sanko above a worthless discard', () => {
    const [jan0, jan1, jan2] = monthIds(1) as [CardId, CardId, CardId];
    expect(jan0).toBe(CARD_IDS.CRANE);

    const junk = monthIds(12)[1] as CardId;
    const state = makeState({
      hand0: [jan0, junk],
      hand1: [monthIds(7)[0] as CardId],
      // Two January cards, so playing the Crane takes the two-match path.
      field: [jan1, jan2, monthIds(6)[3] as CardId],
      captured0: [CARD_IDS.CURTAIN, CARD_IDS.MOON],
      deck: monthIds(5),
    });

    expect(matchesFor(jan0, state.roundState.field)).toHaveLength(2);

    const crane = scoreMove(state, { type: 'play', card: jan0 }, NORMAL_WEIGHTS);
    const discard = scoreMove(state, { type: 'play', card: junk }, NORMAL_WEIGHTS);
    expect(crane, 'completing Sanko must beat throwing a chaff away').toBeGreaterThan(discard);
    // And by a lot — this is a five-point yaku, not a coin toss.
    expect(crane - discard).toBeGreaterThan(STANDARD_RULES.points.sanko);
  });

  it('actually takes the bright when it cannot be kept for later', () => {
    const [jan0, jan1] = monthIds(1) as [CardId, CardId];
    const state = makeState({
      // One card in hand: no tempo choice, just take it.
      hand0: [jan0],
      hand1: [monthIds(7)[0] as CardId],
      field: [jan1, monthIds(6)[3] as CardId],
      captured0: [CARD_IDS.CURTAIN, CARD_IDS.MOON],
      deck: monthIds(5),
    });
    for (const difficulty of THINKERS) {
      const move = decide(state, difficulty);
      expect(move.type === 'play' && move.card, difficulty).toBe(jan0);
    }
  });
});

describe('not feeding the opponent', () => {
  /**
   * The other silent defect: threat was measured as "does this card complete a
   * yaku right now", which is false for nearly every card. An opponent two
   * thirds of the way to Aotan registered as no threat at all, so nothing ever
   * stopped the AI discarding the card that finished it.
   */
  it('discards the card that does not hand over Aotan', () => {
    const [blue6, blue9, blue10] = ['m6-1', 'm9-1', 'm10-1'] as CardId[] as [
      CardId,
      CardId,
      CardId,
    ];
    const safe = monthIds(12)[1] as CardId; // a chaff nobody wants

    const state = makeState({
      // Neither card can capture, so both plays are discards.
      hand0: [blue10, safe],
      hand1: [monthIds(7)[0] as CardId],
      field: [monthIds(5)[0] as CardId],
      // The opponent already holds two of the three blue ribbons.
      captured1: [blue6, blue9],
      // Their partner for month 10 is unaccounted for, so they may well take it.
      deck: [monthIds(10)[2] as CardId, monthIds(10)[3] as CardId],
    });

    for (const difficulty of THINKERS) {
      const move = decide(state, difficulty);
      expect(move.type === 'play' && move.card, `${difficulty} fed the opponent Aotan`).toBe(safe);
    }
  });
});

describe('playing the scoreboard', () => {
  /**
   * The last round, holding Sanko, with the opponent one capture away from a
   * yaku of their own — the Boar on the table completes their fifth Tane.
   *
   * Both halves of the risk have to be real for this to test anything. An
   * opponent with an empty pile cannot punish a koi-koi in four turns, so
   * playing on there is nearly free and stopping proves nothing.
   */
  const endgame = (scores: [number, number]) =>
    makeState({
      phase: 'koikoi',
      current: 0,
      round: STANDARD_RULES.rounds,
      scores,
      // Hands stay the same length: the deal alternates, so a position with
      // uneven hands is unreachable, and a playout entering one finds a `play`
      // phase with nothing to play.
      // Nothing in hand captures anything: no upside beyond what is banked.
      hand0: ['m10-2', 'm10-3'] as CardId[],
      // Either July card takes the Boar and completes their fifth Tane.
      hand1: ['m7-2', 'm7-3'] as CardId[],
      field: [CARD_IDS.BOAR, 'm9-2' as CardId],
      captured0: [CARD_IDS.CRANE, CARD_IDS.CURTAIN, CARD_IDS.MOON],
      captured1: ['m2-0', 'm4-0', 'm5-0', 'm6-0'] as CardId[],
      deck: ['m12-1', 'm12-2', 'm12-3', 'm11-3'] as CardId[],
    });

  it('stops when banking wins the match', () => {
    // One ahead. Banking Sanko settles the match; playing on lets them complete
    // their Tane, and the koi-koi multiplier turns their one point into enough
    // to take the match away.
    const state = endgame([1, 0]);
    expect(legalMoves(state).map((m) => m.type).sort()).toEqual(['koikoi', 'shobu']);
    for (const difficulty of ['hard', 'expert'] as Difficulty[]) {
      expect(decide(state, difficulty).type, `${difficulty} gambled a won match`).toBe('shobu');
    }
  });

  it('pushes when banking still loses the match', () => {
    // The same risky position, eight behind: banking five leaves it three short
    // and beaten, so the risk is the only thing that can still win.
    const state = endgame([0, 8]);
    for (const difficulty of ['hard', 'expert'] as Difficulty[]) {
      expect(decide(state, difficulty).type, `${difficulty} banked a lost match`).toBe('koikoi');
    }
  });
});

describe('the beginner', () => {
  it('still takes an obvious capture', () => {
    // A bright is sitting there for the taking. Easy is weak, not blind.
    const state = makeState({
      hand0: [CARD_IDS.CRANE, monthIds(4)[3] as CardId],
      hand1: [monthIds(7)[0] as CardId],
      field: [monthIds(1)[2] as CardId, monthIds(6)[3] as CardId],
      deck: monthIds(5),
    });

    let took = 0;
    for (let seed = 0; seed < 40; seed++) {
      const move = decide(state, 'easy', seed);
      if (move.type === 'play' && move.card === CARD_IDS.CRANE) took += 1;
    }
    // Not always — it blunders, and that is the point — but usually.
    expect(took, `easy took the bright ${took}/40 times`).toBeGreaterThan(24);
  });

  it('only ever returns a move the engine offered', () => {
    const state = makeState({
      hand0: monthIds(1).slice(0, 3),
      hand1: [monthIds(7)[0] as CardId],
      field: [monthIds(1)[3] as CardId, monthIds(6)[3] as CardId],
      deck: monthIds(5),
    });
    const legal = legalMoves(state).map((m) => JSON.stringify(m));
    for (let seed = 0; seed < 60; seed++) {
      expect(legal).toContain(JSON.stringify(decide(state, 'easy', seed)));
    }
  });
});
