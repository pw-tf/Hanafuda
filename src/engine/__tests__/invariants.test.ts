import { describe, expect, it } from 'vitest';
import { ALL_CARD_IDS, getCard, type CardId } from '../cards';
import { createRng } from '../rng';
import { GAMEDESIGN_RULES, STANDARD_RULES, type RuleConfig } from '../rules';
import { applyMove, createGame, legalMoves, type GameState } from '../game';

/**
 * These checks run millions of times, so they throw plain Errors rather than
 * calling `expect` — vitest's matchers are far too slow for a hot loop and
 * would turn a 15-second soak into a 15-minute one.
 */

/**
 * Every one of the 48 cards must be in exactly one place at every step:
 * a hand, the field, the deck, a capture pile, or held in `pending` while a
 * player chooses which of two field cards to take.
 */
function checkCardConservation(state: GameState, context: string): void {
  const r = state.roundState;
  const seen: CardId[] = [
    ...r.players[0].hand,
    ...r.players[1].hand,
    ...r.players[0].captured,
    ...r.players[1].captured,
    ...r.field,
    ...r.deck,
    ...(r.pending ? [r.pending.card] : []),
  ];

  if (seen.length !== 48 || new Set(seen).size !== 48) {
    const counts = new Map<CardId, number>();
    for (const id of seen) counts.set(id, (counts.get(id) ?? 0) + 1);
    const duplicated = [...counts].filter(([, n]) => n > 1).map(([id]) => id);
    const missing = ALL_CARD_IDS.filter((id) => !counts.has(id));
    throw new Error(
      `${context}: card conservation broken — ${seen.length} slots, ` +
        `${new Set(seen).size} unique; duplicated=[${duplicated}] missing=[${missing}]`,
    );
  }
}

function checkStructure(state: GameState, context: string): void {
  const r = state.roundState;

  if (r.players[0].hand.length > 8 || r.players[1].hand.length > 8) {
    throw new Error(`${context}: a hand grew beyond 8 cards`);
  }

  // A pending choice always offers exactly two options — one match resolves
  // automatically and three trigger the capture-all rule.
  if (r.pending && r.pending.options.length !== 2) {
    throw new Error(`${context}: pending choice had ${r.pending.options.length} options, expected 2`);
  }

  // The field can never hold all four cards of a month.
  const byMonth = new Map<number, number>();
  for (const id of r.field) {
    const m = getCard(id).month;
    const n = (byMonth.get(m) ?? 0) + 1;
    if (n >= 4) throw new Error(`${context}: field holds 4 cards of month ${m}`);
    byMonth.set(m, n);
  }

  if (r.players[0].koiKoiCalls < 0 || r.players[1].koiKoiCalls < 0) {
    throw new Error(`${context}: negative koi-koi count`);
  }
}

/** Play a whole match with random legal moves, checking invariants at every step. */
function playRandomMatch(seed: number, rules: RuleConfig): GameState {
  const rng = createRng(seed);
  let state = createGame(rules, seed, seed % 2 === 0 ? 0 : 1);
  let steps = 0;

  checkCardConservation(state, `seed ${seed} deal`);

  while (!state.matchOver) {
    const moves = legalMoves(state);
    if (moves.length === 0) {
      throw new Error(`seed ${seed} step ${steps}: no legal moves in phase ${state.roundState.phase}`);
    }

    const move = moves[rng.nextInt(moves.length)]!;
    state = applyMove(state, move);
    steps++;

    const context = `seed ${seed} step ${steps} (${move.type})`;
    checkCardConservation(state, context);
    checkStructure(state, context);

    if (steps > 5000) throw new Error(`seed ${seed}: match failed to terminate`);
  }

  // Match totals must equal the sum of what each round awarded.
  const summed = state.history.reduce(
    (acc, r) => [acc[0] + r.awarded[0], acc[1] + r.awarded[1]] as [number, number],
    [0, 0] as [number, number],
  );
  if (summed[0] !== state.scores[0] || summed[1] !== state.scores[1]) {
    throw new Error(`seed ${seed}: match score ${state.scores} != sum of rounds ${summed}`);
  }
  if (state.history.length !== rules.rounds) {
    throw new Error(`seed ${seed}: played ${state.history.length} rounds, expected ${rules.rounds}`);
  }

  return state;
}

describe('engine invariants under random play', () => {
  it('holds across 10,000 random matches (120,000 rounds)', () => {
    let rounds = 0;
    for (let seed = 0; seed < 10_000; seed++) {
      const final = playRandomMatch(seed, STANDARD_RULES);
      rounds += final.history.length;
    }
    // A single assertion outside the hot loop, proving the soak actually ran.
    expect(rounds).toBe(10_000 * STANDARD_RULES.rounds);
  }, 300_000);

  it('holds under the alternate preset and every optional rule', () => {
    const variants: RuleConfig[] = [
      GAMEDESIGN_RULES,
      { ...STANDARD_RULES, sakeCupMode: 'tane-and-kasu' },
      { ...STANDARD_RULES, tsukiFudaEnabled: true },
      { ...STANDARD_RULES, teyakuEnabled: false },
      { ...STANDARD_RULES, drawRule: 'dealer-6' },
      { ...STANDARD_RULES, koiKoiMultiplierMode: 'opponentDoubleOnly' },
    ];

    for (const rules of variants) {
      for (let seed = 0; seed < 500; seed++) {
        playRandomMatch(seed, rules);
      }
    }
    expect(variants).toHaveLength(6);
  }, 120_000);

  it('never mutates the state passed to applyMove', () => {
    let state = createGame(STANDARD_RULES, 4242, 0);
    const rng = createRng(1);

    for (let i = 0; i < 300 && !state.matchOver; i++) {
      const before = JSON.stringify(state);
      const moves = legalMoves(state);
      const next = applyMove(state, moves[rng.nextInt(moves.length)]!);
      expect(JSON.stringify(state), `step ${i}`).toBe(before);
      state = next;
    }
  });

  it('produces identical matches from identical seeds and move choices', () => {
    const run = () => {
      const rng = createRng(31337);
      let state = createGame(STANDARD_RULES, 31337, 0);
      while (!state.matchOver) {
        const moves = legalMoves(state);
        state = applyMove(state, moves[rng.nextInt(moves.length)]!);
      }
      return state;
    };
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
  });
});
