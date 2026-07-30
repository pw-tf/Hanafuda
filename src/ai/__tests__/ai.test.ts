/**
 * Properties every opponent must hold, whatever its strength.
 *
 * Strength itself is not tested here. Koi-Koi's variance is large enough that
 * a match-play assertion needs hundreds of games to mean anything, and the
 * suite this replaces tried it over eight seeds — it would have passed through
 * almost any regression. Strength lives in `npm run bench:ai`; behaviour lives
 * in `tactics.test.ts`; this file covers legality, honesty, budget and
 * determinism.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  applyMove,
  createGame,
  legalMoves,
  type GameState,
  type Move,
} from '../../engine/game';
import { createRng, shuffle } from '../../engine/rng';
import { STANDARD_RULES } from '../../engine/rules';
import { createAiAgent } from '../agent';
import { DIFFICULTIES, PROFILES, type AiProfile, type Difficulty } from '../profiles';

/** Small budgets: these tests are about properties, not depth. */
function quick(difficulty: Difficulty): Partial<AiProfile> {
  const search = PROFILES[difficulty].search;
  return search ? { search: { ...search, budgetMs: 40, maxWorlds: 12 } } : {};
}

function playMatch(seed: number, p0: Difficulty, p1: Difficulty, rounds: number): GameState {
  const rules = { ...STANDARD_RULES, rounds };
  let state = createGame(rules, seed, 0);
  const agents = [
    createAiAgent(p0, 0, createRng(seed ^ 0x11), quick(p0)),
    createAiAgent(p1, 1, createRng(seed ^ 0x22), quick(p1)),
  ];

  let guard = 0;
  while (!state.matchOver) {
    if (guard++ > 4000) throw new Error(`seed ${seed}: match did not terminate`);
    const legal = legalMoves(state);
    expect(legal.length, `seed ${seed}: no legal moves in ${state.roundState.phase}`).toBeGreaterThan(0);

    agents[0]?.observe(state);
    agents[1]?.observe(state);

    const move: Move =
      state.roundState.phase === 'round-end'
        ? (legal[0] as Move)
        : (agents[state.roundState.current] as ReturnType<typeof createAiAgent>).choose(state);

    expect(
      legal.some((m) => JSON.stringify(m) === JSON.stringify(move)),
      `seed ${seed}: ${p0}/${p1} returned an illegal move ${JSON.stringify(move)}`,
    ).toBe(true);

    state = applyMove(state, move);
  }
  return state;
}

describe('legality', () => {
  for (const difficulty of DIFFICULTIES) {
    it(`${difficulty} only ever returns legal moves`, () => {
      // Every tier gets the same coverage. Hard used to get four seeds against
      // the others' sixty, which is where an illegal move would have hidden.
      for (let seed = 0; seed < 24; seed++) playMatch(seed, difficulty, difficulty, 2);
    }, 120_000);
  }
});

describe('determinism', () => {
  it('the same seed plays the same match twice', () => {
    const a = playMatch(7, 'expert', 'normal', 2);
    const b = playMatch(7, 'expert', 'normal', 2);
    expect(a.scores).toEqual(b.scores);
    expect(a.history.map((r) => r.awarded)).toEqual(b.history.map((r) => r.awarded));
  }, 120_000);
});

describe('honesty', () => {
  /**
   * The property that matters most, and the one convention alone cannot hold:
   * `GameState.seed` plus the round number determines the entire deal, so a
   * search that peeked could reconstruct the opponent's hand exactly.
   *
   * Rather than trusting a reading of the code, this permutes the hidden state
   * behind identical observations. Anything the AI is entitled to see is
   * untouched; anything it is not is shuffled. A tier that reads what it should
   * not will change its mind.
   */
  it('plays the same move however the unseen cards are arranged', () => {
    for (let seed = 1; seed <= 6; seed++) {
      let state = createGame(STANDARD_RULES, seed, 0);
      // Play a few plies so there is a real position with history behind it.
      const driver = createAiAgent('normal', 0, createRng(seed));
      for (let i = 0; i < 5 && state.roundState.phase !== 'round-end'; i++) {
        state = applyMove(state, driver.choose(state));
      }
      if (state.roundState.phase !== 'play' || state.roundState.current !== 0) continue;

      const round = state.roundState;
      // Everything seat 0 cannot see: seat 1's hand and the deck.
      const hidden = [...round.players[1].hand, ...round.deck];
      const reshuffled = shuffle(hidden, createRng(seed * 7919));

      const twisted: GameState = {
        ...state,
        // Also scrambled: the seed alone would give the true deal away.
        seed: state.seed ^ 0x5f3759df,
        roundState: {
          ...round,
          players: [
            round.players[0],
            { ...round.players[1], hand: reshuffled.slice(0, round.players[1].hand.length) },
          ],
          deck: reshuffled.slice(round.players[1].hand.length),
        },
      };

      for (const difficulty of DIFFICULTIES) {
        const first = createAiAgent(difficulty, 0, createRng(99), quick(difficulty)).choose(state);
        const second = createAiAgent(difficulty, 0, createRng(99), quick(difficulty)).choose(twisted);
        expect(
          second,
          `${difficulty} changed its move when only the hidden cards changed (seed ${seed})`,
        ).toEqual(first);
      }
    }
  }, 120_000);

  it('never mentions the seed or the opponent\'s hand in the search path', () => {
    // Belt and braces beside the behavioural test above: a grep would not catch
    // an indirect leak, and the invariance test would not catch a leak that
    // happens to be move-neutral today.
    for (const file of ['belief.ts', 'search.ts', 'policy.ts', 'evaluate.ts']) {
      const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
      const code = source
        .split('\n')
        .filter((line) => !line.trim().startsWith('*') && !line.trim().startsWith('//'))
        .join('\n');
      // `belief.ts` scrambles the seed on the way out, which is the opposite of
      // reading it; that single assignment is the only permitted mention.
      const seedUses = [...code.matchAll(/\.seed\b/g)].length;
      const allowed = file === 'belief.ts' ? 1 : 0;
      expect(seedUses, `${file} reads state.seed`).toBeLessThanOrEqual(allowed);
    }
  });
});

describe('budget', () => {
  it('returns a legal move immediately when the deadline has already passed', () => {
    const state = createGame(STANDARD_RULES, 3, 0);
    const agent = createAiAgent('expert', 0, createRng(1), {
      // A clock stuck in the future: every deadline check fires at once.
      search: { ...PROFILES.expert.search!, budgetMs: 0 },
    });
    const move = agent.choose(state);
    expect(legalMoves(state).map((m) => JSON.stringify(m))).toContain(JSON.stringify(move));
  }, 60_000);

  it('stays inside its budget', () => {
    let state = createGame(STANDARD_RULES, 11, 0);
    const budgetMs = 120;
    const agent = createAiAgent('expert', 0, createRng(2), {
      search: { ...PROFILES.expert.search!, budgetMs, maxWorlds: 100_000 },
    });

    let worst = 0;
    for (let i = 0; i < 6 && state.roundState.phase !== 'round-end'; i++) {
      if (state.roundState.current === 0 && state.roundState.phase === 'play') {
        const t0 = performance.now();
        const move = agent.choose(state);
        worst = Math.max(worst, performance.now() - t0);
        state = applyMove(state, move);
      } else {
        state = applyMove(state, legalMoves(state)[0] as Move);
      }
    }
    // The clock is only checked between worlds, so one world may overrun; twice
    // the budget is the honest ceiling, not four seconds as before.
    expect(worst, `worst decision ${worst.toFixed(0)}ms against a ${budgetMs}ms budget`).toBeLessThan(
      budgetMs * 2,
    );
  }, 60_000);
});
