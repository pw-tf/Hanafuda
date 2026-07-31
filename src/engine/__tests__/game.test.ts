import { describe, expect, it } from 'vitest';
import { CARD_IDS, DECK, idsOfMonth, type CardId } from '../cards';
import { STANDARD_RULES, type RuleConfig } from '../rules';
import { settleRound } from '../scoring';
import {
  applyMove,
  createGame,
  currentYaku,
  dealerFromSeed,
  legalMoves,
  matchesFor,
  other,
  type GameState,
  type PlayerIndex,
  type RoundState,
  IllegalMoveError,
} from '../game';

const monthIds = (m: number): CardId[] => idsOfMonth(m as never);

/**
 * Build a game positioned exactly where a test needs it. Anything not
 * specified is left empty so each test states only what it depends on.
 */
function makeState(over: {
  hand0?: CardId[];
  hand1?: CardId[];
  field?: CardId[];
  deck?: CardId[];
  captured0?: CardId[];
  captured1?: CardId[];
  current?: PlayerIndex;
  dealer?: PlayerIndex;
  koi0?: number;
  koi1?: number;
  baseAtCheck0?: number;
  rules?: RuleConfig;
  round?: number;
}): GameState {
  const rules = over.rules ?? STANDARD_RULES;
  const roundState: RoundState = {
    phase: 'play',
    current: over.current ?? 0,
    dealer: over.dealer ?? 0,
    month: 1,
    deck: over.deck ?? [],
    field: over.field ?? [],
    players: [
      {
        hand: over.hand0 ?? [],
        captured: over.captured0 ?? [],
        koiKoiCalls: over.koi0 ?? 0,
        yakuBaseAtLastCheck: over.baseAtCheck0 ?? 0,
      },
      {
        hand: over.hand1 ?? [],
        captured: over.captured1 ?? [],
        koiKoiCalls: over.koi1 ?? 0,
        yakuBaseAtLastCheck: 0,
      },
    ],
    pending: null,
    trace: { player: over.current ?? 0, handCard: null, handCaptured: [], drawnCard: null, drawnCaptured: [] },
    result: null,
  };
  return {
    rules,
    seed: 1,
    round: over.round ?? 1,
    scores: [0, 0],
    roundState,
    history: [],
    matchOver: false,
  };
}

describe('matchesFor', () => {
  it('finds field cards sharing a month', () => {
    const [jan0, jan1, jan2] = monthIds(1) as [CardId, CardId, CardId];
    expect(matchesFor(jan0, [jan1, jan2, ...monthIds(5)])).toEqual([jan1, jan2]);
  });

  it('returns nothing when no month matches', () => {
    expect(matchesFor(monthIds(1)[0]!, monthIds(5))).toEqual([]);
  });
});

describe('playing a card from hand', () => {
  it('leaves an unmatched card on the field and moves to the draw phase', () => {
    const card = monthIds(1)[0]!;
    const s = applyMove(makeState({ hand0: [card], field: monthIds(5) }), { type: 'play', card });

    expect(s.roundState.phase).toBe('draw');
    expect(s.roundState.field).toContain(card);
    expect(s.roundState.field).toHaveLength(5);
    expect(s.roundState.players[0].captured).toEqual([]);
    expect(s.roundState.players[0].hand).toEqual([]);
  });

  it('captures both cards on a single match', () => {
    const [jan0, jan1] = monthIds(1) as [CardId, CardId];
    const s = applyMove(makeState({ hand0: [jan0], field: [jan1, ...monthIds(5)] }), {
      type: 'play',
      card: jan0,
    });

    expect(s.roundState.phase).toBe('draw');
    expect([...s.roundState.players[0].captured].sort()).toEqual([jan0, jan1].sort());
    expect(s.roundState.field).not.toContain(jan1);
  });

  it('asks the player to choose when two field cards match', () => {
    const [jan0, jan1, jan2] = monthIds(1) as [CardId, CardId, CardId];
    const s = applyMove(makeState({ hand0: [jan0], field: [jan1, jan2] }), { type: 'play', card: jan0 });

    expect(s.roundState.phase).toBe('choose-hand-target');
    expect(s.roundState.pending).toMatchObject({ card: jan0, source: 'hand' });
    expect([...(s.roundState.pending?.options ?? [])].sort()).toEqual([jan1, jan2].sort());
    // Nothing captured, and the played card is held in `pending`, not on the field.
    expect(s.roundState.players[0].captured).toEqual([]);
    expect(s.roundState.field).not.toContain(jan0);

    const chosen = applyMove(s, { type: 'chooseTarget', target: jan2 });
    expect(chosen.roundState.phase).toBe('draw');
    expect([...chosen.roundState.players[0].captured].sort()).toEqual([jan0, jan2].sort());
    expect(chosen.roundState.field).toEqual([jan1]);
  });

  it('captures all four when three field cards match', () => {
    const [jan0, jan1, jan2, jan3] = monthIds(1) as [CardId, CardId, CardId, CardId];
    const s = applyMove(makeState({ hand0: [jan0], field: [jan1, jan2, jan3, ...monthIds(5)] }), {
      type: 'play',
      card: jan0,
    });

    expect([...s.roundState.players[0].captured].sort()).toEqual([jan0, jan1, jan2, jan3].sort());
    expect(s.roundState.field).toEqual(monthIds(5));
    expect(s.roundState.phase).toBe('draw');
  });

  it('rejects playing a card that is not in hand', () => {
    const s = makeState({ hand0: [monthIds(1)[0]!] });
    expect(() => applyMove(s, { type: 'play', card: monthIds(5)[0]! })).toThrow(IllegalMoveError);
  });

  it('rejects playing outside the play phase', () => {
    const card = monthIds(1)[0]!;
    const drawn = applyMove(makeState({ hand0: [card], field: [], deck: [monthIds(5)[0]!] }), {
      type: 'play',
      card,
    });
    expect(() => applyMove(drawn, { type: 'play', card })).toThrow(IllegalMoveError);
  });
});

describe('the deck flip', () => {
  it('leaves an unmatched flipped card on the field and passes the turn', () => {
    const handCard = monthIds(1)[0]!;
    const deckCard = monthIds(7)[0]!;
    const afterPlay = applyMove(makeState({ hand0: [handCard], hand1: [monthIds(9)[0]!], deck: [deckCard] }), {
      type: 'play',
      card: handCard,
    });
    const s = applyMove(afterPlay, { type: 'draw' });

    expect([...s.roundState.field].sort()).toEqual([handCard, deckCard].sort());
    expect(s.roundState.deck).toEqual([]);
    expect(s.roundState.phase).toBe('play');
    expect(s.roundState.current).toBe(1);
  });

  it('captures on a single match', () => {
    const [jan0, jan1] = monthIds(1) as [CardId, CardId];
    const handCard = monthIds(5)[0]!;
    const afterPlay = applyMove(
      makeState({ hand0: [handCard], hand1: [monthIds(9)[0]!], field: [jan1], deck: [jan0] }),
      { type: 'play', card: handCard },
    );
    const s = applyMove(afterPlay, { type: 'draw' });

    expect([...s.roundState.players[0].captured].sort()).toEqual([jan0, jan1].sort());
  });

  it('asks the player to choose when the flipped card matches two', () => {
    const [jan0, jan1, jan2] = monthIds(1) as [CardId, CardId, CardId];
    const handCard = monthIds(5)[0]!;
    const afterPlay = applyMove(
      makeState({ hand0: [handCard], hand1: [monthIds(9)[0]!], field: [jan1, jan2], deck: [jan0] }),
      { type: 'play', card: handCard },
    );
    const s = applyMove(afterPlay, { type: 'draw' });

    expect(s.roundState.phase).toBe('choose-draw-target');
    expect(s.roundState.pending).toMatchObject({ card: jan0, source: 'deck' });

    const chosen = applyMove(s, { type: 'chooseTarget', target: jan1 });
    expect([...chosen.roundState.players[0].captured].sort()).toEqual([jan0, jan1].sort());
    expect(chosen.roundState.phase).toBe('play');
    expect(chosen.roundState.current).toBe(1);
  });

  it('captures all four when the flipped card matches three', () => {
    const [jan0, jan1, jan2, jan3] = monthIds(1) as [CardId, CardId, CardId, CardId];
    const handCard = monthIds(5)[0]!;
    const afterPlay = applyMove(
      makeState({
        hand0: [handCard],
        hand1: [monthIds(9)[0]!],
        field: [jan1, jan2, jan3],
        deck: [jan0],
      }),
      { type: 'play', card: handCard },
    );
    const s = applyMove(afterPlay, { type: 'draw' });

    expect([...s.roundState.players[0].captured].sort()).toEqual([jan0, jan1, jan2, jan3].sort());
  });

  it('can capture the card just placed on the field by the hand play', () => {
    const [jan0, jan1] = monthIds(1) as [CardId, CardId];
    const afterPlay = applyMove(
      makeState({ hand0: [jan0], hand1: [monthIds(9)[0]!], field: [], deck: [jan1] }),
      { type: 'play', card: jan0 },
    );
    expect(afterPlay.roundState.field).toEqual([jan0]);

    const s = applyMove(afterPlay, { type: 'draw' });
    expect([...s.roundState.players[0].captured].sort()).toEqual([jan0, jan1].sort());
    expect(s.roundState.field).toEqual([]);
  });
});

describe('the turn trace', () => {
  /**
   * The trace has to outlive the turn it describes. The flip and the capture
   * it makes both happen on the move that also hands over the turn, so if the
   * trace reset there, the UI would never once observe the flip and could not
   * animate it.
   */
  it('still describes the finished turn after the turn passes', () => {
    const [jan0, jan1] = monthIds(1) as [CardId, CardId];
    const handCard = monthIds(5)[0]!;
    const afterPlay = applyMove(
      makeState({ hand0: [handCard], hand1: [monthIds(9)[0]!], field: [jan1], deck: [jan0] }),
      { type: 'play', card: handCard },
    );
    const s = applyMove(afterPlay, { type: 'draw' });

    expect(s.roundState.current).toBe(1);
    // ...but the trace still belongs to player 0, who just played.
    expect(s.roundState.trace.player).toBe(0);
    expect(s.roundState.trace.handCard).toBe(handCard);
    expect(s.roundState.trace.drawnCard).toBe(jan0);
    expect([...s.roundState.trace.drawnCaptured].sort()).toEqual([jan0, jan1].sort());
  });

  it('survives a koi-koi call, which does not end the turn it describes', () => {
    // Player 0 is one bright away from Sanko, so the flip triggers the prompt.
    const nearSanko = makeState({
      hand0: [CARD_IDS.MOON],
      hand1: [monthIds(9)[0]!, monthIds(9)[1]!],
      field: [monthIds(8)[2]!],
      deck: [monthIds(6)[2]!, monthIds(6)[3]!],
      captured0: [CARD_IDS.CRANE, CARD_IDS.CURTAIN],
    });
    const s = applyMove(nearSanko, { type: 'play', card: CARD_IDS.MOON });
    const drawn = applyMove(s, { type: 'draw' });
    expect(drawn.roundState.phase).toBe('koikoi');

    const after = applyMove(drawn, { type: 'koikoi' });
    expect(after.roundState.current).toBe(1);
    expect(after.roundState.trace.player).toBe(0);
    expect(after.roundState.trace.handCard).toBe(CARD_IDS.MOON);
  });

  it('is replaced wholesale when the next player plays', () => {
    const [jan0, jan1] = monthIds(1) as [CardId, CardId];
    const handCard = monthIds(5)[0]!;
    const p1Card = monthIds(9)[0]!;
    const afterPlay = applyMove(
      makeState({ hand0: [handCard], hand1: [p1Card], field: [jan1], deck: [jan0, monthIds(11)[0]!] }),
      { type: 'play', card: handCard },
    );
    const passed = applyMove(afterPlay, { type: 'draw' });
    const next = applyMove(passed, { type: 'play', card: p1Card });

    // No trace of player 0's flip may leak into player 1's turn.
    expect(next.roundState.trace.player).toBe(1);
    expect(next.roundState.trace.handCard).toBe(p1Card);
    expect(next.roundState.trace.drawnCard).toBeNull();
    expect(next.roundState.trace.drawnCaptured).toEqual([]);
  });
});

describe('koi-koi and shobu', () => {
  /** Position player 0 one card away from Sanko (three brights, no Rain Man). */
  function nearSanko() {
    return makeState({
      hand0: [CARD_IDS.MOON],
      hand1: [monthIds(9)[0]!, monthIds(9)[1]!],
      field: [monthIds(8)[2]!],
      deck: [monthIds(6)[2]!, monthIds(6)[3]!],
      captured0: [CARD_IDS.CRANE, CARD_IDS.CURTAIN],
    });
  }

  it('offers the choice when a yaku is formed', () => {
    const afterPlay = applyMove(nearSanko(), { type: 'play', card: CARD_IDS.MOON });
    const s = applyMove(afterPlay, { type: 'draw' });

    expect(s.roundState.phase).toBe('koikoi');
    expect(legalMoves(s).map((m) => m.type).sort()).toEqual(['koikoi', 'shobu']);
  });

  it('shobu ends the round and awards the winner', () => {
    const afterPlay = applyMove(nearSanko(), { type: 'play', card: CARD_IDS.MOON });
    const atChoice = applyMove(afterPlay, { type: 'draw' });
    const s = applyMove(atChoice, { type: 'shobu' });

    expect(s.roundState.phase).toBe('round-end');
    expect(s.roundState.result?.reason).toBe('shobu');
    expect(s.roundState.result?.winner).toBe(0);
    expect(s.roundState.result?.settlement?.base).toBe(5); // Sanko
    expect(s.roundState.result?.awarded).toEqual([5, 0]);
  });

  it('koi-koi passes the turn, records the call and raises the multiplier', () => {
    const afterPlay = applyMove(nearSanko(), { type: 'play', card: CARD_IDS.MOON });
    const atChoice = applyMove(afterPlay, { type: 'draw' });
    const s = applyMove(atChoice, { type: 'koikoi' });

    expect(s.roundState.phase).toBe('play');
    expect(s.roundState.current).toBe(1);
    expect(s.roundState.players[0].koiKoiCalls).toBe(1);
    expect(s.roundState.players[0].yakuBaseAtLastCheck).toBe(5);
  });

  it('does not re-prompt until the yaku total actually improves', () => {
    // Player 0 already holds Sanko and has acknowledged it (base 5). Capturing
    // a chaff card does not improve the total, so no prompt.
    const s0 = makeState({
      hand0: [monthIds(4)[2]!],
      hand1: [monthIds(9)[0]!, monthIds(9)[1]!],
      field: [monthIds(4)[3]!],
      deck: [monthIds(6)[2]!],
      captured0: [CARD_IDS.CRANE, CARD_IDS.CURTAIN, CARD_IDS.MOON],
      baseAtCheck0: 5,
    });
    const s = applyMove(applyMove(s0, { type: 'play', card: monthIds(4)[2]! }), { type: 'draw' });
    expect(s.roundState.phase).toBe('play');
    expect(s.roundState.current).toBe(1);
  });

  it('applies the koi-koi multiplier when the caller later wins', () => {
    // Player 0 holds Sanko, has called koi-koi once, and now completes Shiko.
    const s0 = makeState({
      hand0: [CARD_IDS.PHOENIX],
      hand1: [monthIds(9)[0]!, monthIds(9)[1]!],
      field: [monthIds(12)[1]!],
      deck: [monthIds(6)[2]!],
      captured0: [CARD_IDS.CRANE, CARD_IDS.CURTAIN, CARD_IDS.MOON],
      koi0: 1,
      baseAtCheck0: 5,
    });
    const atChoice = applyMove(applyMove(s0, { type: 'play', card: CARD_IDS.PHOENIX }), { type: 'draw' });
    expect(atChoice.roundState.phase).toBe('koikoi');

    const s = applyMove(atChoice, { type: 'shobu' });
    const settlement = s.roundState.result?.settlement;
    // Shiko = 8, base >= 7 so x2, plus one koi-koi call so x2 again: 8 x 2 x 2 = 32.
    expect(settlement?.base).toBe(8);
    expect(settlement?.sevenPointMultiplier).toBe(2);
    expect(settlement?.koiMultiplier).toBe(2);
    expect(settlement?.total).toBe(32);
  });

  /**
   * The number the koi-koi prompt has to show.
   *
   * `Game.tsx` prices the Stop button by settling the current base itself, so
   * that it can say what stopping actually banks rather than the raw yaku
   * total. This pins the two together: whatever that arithmetic produces at the
   * decision must be exactly what shobu then awards.
   */
  it('pays exactly what settling the position at the decision predicts', () => {
    const s0 = makeState({
      hand0: [CARD_IDS.PHOENIX],
      hand1: [monthIds(9)[0]!, monthIds(9)[1]!],
      field: [monthIds(12)[1]!],
      deck: [monthIds(6)[2]!],
      captured0: [CARD_IDS.CRANE, CARD_IDS.CURTAIN, CARD_IDS.MOON],
      koi0: 1,
      koi1: 1,
      baseAtCheck0: 5,
    });
    const atChoice = applyMove(applyMove(s0, { type: 'play', card: CARD_IDS.PHOENIX }), {
      type: 'draw',
    });
    expect(atChoice.roundState.phase).toBe('koikoi');

    const predicted = settleRound(
      currentYaku(atChoice, 0).base,
      {
        byWinner: atChoice.roundState.players[0].koiKoiCalls,
        byLoser: atChoice.roundState.players[1].koiKoiCalls,
      },
      atChoice.rules,
    );
    // Shiko 8, x2 for reaching seven, then (1 + one call of mine) x 2 for
    // theirs: 8 x 2 x 4 = 64. Emphatically not the raw base of 8.
    expect(predicted.total).toBe(64);

    const settled = applyMove(atChoice, { type: 'shobu' });
    expect(settled.roundState.result?.settlement).toEqual(predicted);
    expect(settled.roundState.result?.awarded).toEqual([64, 0]);
  });

  it('settles automatically instead of prompting when both hands are empty', () => {
    const s0 = makeState({
      hand0: [CARD_IDS.MOON],
      hand1: [],
      field: [monthIds(8)[2]!],
      deck: [monthIds(6)[2]!],
      captured0: [CARD_IDS.CRANE, CARD_IDS.CURTAIN],
    });
    const s = applyMove(applyMove(s0, { type: 'play', card: CARD_IDS.MOON }), { type: 'draw' });

    expect(s.roundState.phase).toBe('round-end');
    expect(s.roundState.result?.winner).toBe(0);
    expect(s.roundState.result?.settlement?.total).toBe(5);
  });
});

describe('round ending without a yaku', () => {
  it('scores nobody under the default draw rule', () => {
    const s0 = makeState({ hand0: [monthIds(1)[0]!], hand1: [], deck: [monthIds(5)[0]!] });
    const s = applyMove(applyMove(s0, { type: 'play', card: monthIds(1)[0]! }), { type: 'draw' });

    expect(s.roundState.phase).toBe('round-end');
    expect(s.roundState.result?.reason).toBe('exhausted');
    expect(s.roundState.result?.awarded).toEqual([0, 0]);
    expect(s.roundState.result?.winner).toBeNull();
  });

  it('awards the dealer 1 under the oya-ken rule', () => {
    const rules: RuleConfig = { ...STANDARD_RULES, drawRule: 'dealer-1' };
    const s0 = makeState({
      hand0: [monthIds(1)[0]!],
      hand1: [],
      deck: [monthIds(5)[0]!],
      dealer: 1,
      rules,
    });
    const s = applyMove(applyMove(s0, { type: 'play', card: monthIds(1)[0]! }), { type: 'draw' });

    expect(s.roundState.result?.awarded).toEqual([0, 1]);
    // Naming the dealer is what keeps the deal with them, which is the other
    // half of oya-ken.
    expect(s.roundState.result?.winner).toBe(1);
  });
});

describe('dealing', () => {
  it('deals 8 / 8 / 8 and leaves 24 in the deck', () => {
    const g = createGame(STANDARD_RULES, 12345);
    const r = g.roundState;
    expect(r.players[0].hand).toHaveLength(8);
    expect(r.players[1].hand).toHaveLength(8);
    expect(r.field).toHaveLength(8);
    expect(r.deck).toHaveLength(24);
  });

  it('never deals a field holding all four cards of a month', () => {
    for (let seed = 0; seed < 3000; seed++) {
      const field = createGame(STANDARD_RULES, seed).roundState.field;
      const counts = new Map<number, number>();
      for (const id of field) {
        const m = DECK.find((c) => c.id === id)!.month;
        counts.set(m, (counts.get(m) ?? 0) + 1);
      }
      expect(Math.max(...counts.values()), `seed ${seed}`).toBeLessThan(4);
    }
  });

  it('is deterministic for a given seed', () => {
    expect(createGame(STANDARD_RULES, 777).roundState).toEqual(createGame(STANDARD_RULES, 777).roundState);
  });

  it('starts the dealer on lead', () => {
    expect(createGame(STANDARD_RULES, 42, 1).roundState.current).toBe(1);
    expect(createGame(STANDARD_RULES, 42, 0).roundState.current).toBe(0);
  });

  describe('the first dealer', () => {
    it('is drawn from the seed rather than always seat 0', () => {
      const seats = new Set<PlayerIndex>();
      for (let seed = 0; seed < 200; seed++) seats.add(dealerFromSeed(seed));
      expect([...seats].sort()).toEqual([0, 1]);
    });

    it('is close to an even split', () => {
      let ones = 0;
      for (let seed = 0; seed < 20000; seed++) ones += dealerFromSeed(seed);
      // Well inside the ~1.4% that a fair coin over 20,000 draws would wander.
      expect(Math.abs(ones / 20000 - 0.5)).toBeLessThan(0.03);
    });

    it('is what createGame uses when no dealer is named', () => {
      for (let seed = 0; seed < 50; seed++) {
        expect(createGame(STANDARD_RULES, seed).roundState.dealer, `seed ${seed}`).toBe(
          dealerFromSeed(seed),
        );
      }
    });

    it('is stable for a seed, so a match stays replayable', () => {
      expect(dealerFromSeed(9001)).toBe(dealerFromSeed(9001));
      expect(createGame(STANDARD_RULES, 9001).roundState).toEqual(
        createGame(STANDARD_RULES, 9001).roundState,
      );
    });

    it('does not change the cards dealt', () => {
      // Only who leads. Both peers in a room game deal the same 48 cards
      // whichever way the draw went.
      const a = createGame(STANDARD_RULES, 555, 0).roundState;
      const b = createGame(STANDARD_RULES, 555, 1).roundState;
      expect(b.field).toEqual(a.field);
      expect(b.deck).toEqual(a.deck);
      expect(b.players[0].hand).toEqual(a.players[0].hand);
      expect(b.players[1].hand).toEqual(a.players[1].hand);
    });
  });

  it('ends the round immediately on a hand yaku, paying only its holder', () => {
    // Seed 41 deals player 0 a Teshi and player 1 nothing.
    const g = createGame(STANDARD_RULES, 41);
    expect(g.roundState.phase).toBe('round-end');
    expect(g.roundState.result?.reason).toBe('teyaku');
    expect(g.roundState.result?.winner).toBe(0);
    expect(g.roundState.result?.awarded).toEqual([STANDARD_RULES.points.teshi, 0]);
  });

  it('treats a hand yaku on both sides as a draw', () => {
    // Seed 31956 deals both players a Teshi — about 1 deal in 24,000.
    const g = createGame(STANDARD_RULES, 31956);
    const result = g.roundState.result;

    expect(result?.reason).toBe('teyaku');
    expect(result?.teyaku[0].map((y) => y.id)).toEqual(['teshi']);
    expect(result?.teyaku[1].map((y) => y.id)).toEqual(['teshi']);
    // Neither player takes the round, so neither is paid.
    expect(result?.awarded).toEqual([0, 0]);
    expect(result?.winner).toBeNull();
    expect(result?.yaku).toEqual([]);
  });

  it('leaves the deal with the dealer after a hand-yaku draw', () => {
    const rules: RuleConfig = { ...STANDARD_RULES, rounds: 2 };
    const g = applyMove(createGame(rules, 31956, 1), { type: 'nextRound' });

    expect(g.scores).toEqual([0, 0]);
    expect(g.roundState.dealer).toBe(1);
  });

  it('never pays both players for a hand yaku', () => {
    // The invariant behind the two cases above, over every teyaku deal in a
    // wide seed range: a hand yaku is an instant win, so at most one side is
    // ever paid, and an unwon round pays nobody.
    let found = 0;
    for (let seed = 0; seed < 20000; seed++) {
      const result = createGame(STANDARD_RULES, seed).roundState.result;
      if (result?.reason !== 'teyaku') continue;
      found++;
      const [a, b] = result.awarded;
      expect(a === 0 || b === 0, `seed ${seed}`).toBe(true);
      if (result.winner === null) expect(result.awarded, `seed ${seed}`).toEqual([0, 0]);
      else expect(result.awarded[result.winner], `seed ${seed}`).toBeGreaterThan(0);
    }
    expect(found, 'expected teyaku deals in 20000 seeds').toBeGreaterThan(0);
  });
});

describe('match structure', () => {
  /** End the current round with a given result, so the match can advance. */
  function forceEnd(g: GameState, winner: PlayerIndex | null): GameState {
    const awarded: [number, number] = [0, 0];
    if (winner !== null) awarded[winner] = 5;
    return {
      ...g,
      roundState: {
        ...g.roundState,
        phase: 'round-end',
        result: {
          round: g.round,
          reason: winner === null ? 'exhausted' : 'shobu',
          awarded,
          winner,
          settlement: null,
          yaku: [],
          teyaku: [[], []],
        },
      },
    };
  }

  it('gives the deal to the winner of each round', () => {
    const rules: RuleConfig = { ...STANDARD_RULES, rounds: 4, teyakuEnabled: false };
    let g = createGame(rules, 99, 0);
    const dealers: PlayerIndex[] = [];

    // Player 1 wins rounds 1 and 2, player 0 wins round 3.
    for (const winner of [1, 1, 0] as const) {
      dealers.push(g.roundState.dealer);
      g = applyMove(forceEnd(g, winner), { type: 'nextRound' });
    }
    dealers.push(g.roundState.dealer);

    expect(dealers).toEqual([0, 1, 1, 0]);
  });

  it('leaves the deal where it is after a round nobody won', () => {
    const rules: RuleConfig = { ...STANDARD_RULES, rounds: 3, teyakuEnabled: false };
    let g = createGame(rules, 99, 1);

    expect(g.roundState.dealer).toBe(1);
    g = applyMove(forceEnd(g, null), { type: 'nextRound' });
    expect(g.roundState.dealer).toBe(1);
    g = applyMove(forceEnd(g, null), { type: 'nextRound' });
    expect(g.roundState.dealer).toBe(1);
  });

  it('ends after the configured rounds', () => {
    const rules: RuleConfig = { ...STANDARD_RULES, rounds: 3, teyakuEnabled: false };
    let g = createGame(rules, 99, 0);

    for (let i = 0; i < 3; i++) g = applyMove(forceEnd(g, null), { type: 'nextRound' });

    expect(g.matchOver).toBe(true);
    expect(legalMoves(g)).toEqual([]);
    expect(() => applyMove(g, { type: 'nextRound' })).toThrow(IllegalMoveError);
  });

  it('accumulates scores across rounds', () => {
    const rules: RuleConfig = { ...STANDARD_RULES, rounds: 2, teyakuEnabled: false };
    let g = createGame(rules, 5, 0);
    g = { ...g, roundState: { ...g.roundState, phase: 'round-end', result: {
      round: 1, reason: 'shobu', awarded: [7, 0], winner: 0,
      settlement: null, yaku: [], teyaku: [[], []],
    } } };
    g = applyMove(g, { type: 'nextRound' });

    expect(g.scores).toEqual([7, 0]);
    expect(g.history).toHaveLength(1);
    expect(g.round).toBe(2);
  });
});

describe('helpers', () => {
  it('other() flips the player index', () => {
    expect(other(0)).toBe(1);
    expect(other(1)).toBe(0);
  });
});
