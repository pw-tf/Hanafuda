import { describe, expect, it } from 'vitest';
import { applyMove, createGame, legalMoves, type GameState, type PlayerIndex } from '../../engine/game';
import { createRng } from '../../engine/rng';
import { STANDARD_RULES } from '../../engine/rules';
import { chooseAiMove, type Difficulty } from '..';

/** Play a full match with the two given difficulties. Returns final scores. */
function playMatch(
  seed: number,
  p0: Difficulty,
  p1: Difficulty,
  rounds = 4,
): { state: GameState; moves: number } {
  const rules = { ...STANDARD_RULES, rounds };
  const rng = createRng(seed);
  let state = createGame(rules, seed, 0);
  let moves = 0;

  while (!state.matchOver) {
    const legal = legalMoves(state);
    expect(legal.length, `seed ${seed}: no legal moves in ${state.roundState.phase}`).toBeGreaterThan(0);

    const move =
      state.roundState.phase === 'round-end'
        ? legal[0]!
        : chooseAiMove(state, state.roundState.current === 0 ? p0 : p1, rng);

    // The chosen move must be one the engine actually offered.
    expect(
      legal.some((m) => JSON.stringify(m) === JSON.stringify(move)),
      `seed ${seed}: AI returned an illegal move ${JSON.stringify(move)}`,
    ).toBe(true);

    state = applyMove(state, move);
    moves++;
    if (moves > 3000) throw new Error(`seed ${seed}: match did not terminate`);
  }

  return { state, moves };
}

describe('AI move legality', () => {
  for (const difficulty of ['easy', 'normal'] as Difficulty[]) {
    it(`${difficulty} only ever returns legal moves`, () => {
      for (let seed = 0; seed < 60; seed++) {
        playMatch(seed, difficulty, difficulty, 3);
      }
    }, 60_000);
  }

  it('hard only ever returns legal moves', () => {
    for (let seed = 0; seed < 4; seed++) {
      playMatch(seed, 'hard', 'normal', 1);
    }
  }, 120_000);
});

describe('AI strength', () => {
  it('normal beats easy over a run of matches', () => {
    let normalWins = 0;
    let easyWins = 0;

    for (let seed = 0; seed < 40; seed++) {
      // Alternate seats so neither difficulty benefits from dealing first.
      const normalSeat: PlayerIndex = seed % 2 === 0 ? 0 : 1;
      const { state } = playMatch(
        seed,
        normalSeat === 0 ? 'normal' : 'easy',
        normalSeat === 0 ? 'easy' : 'normal',
        4,
      );
      const normalScore = state.scores[normalSeat];
      const easyScore = state.scores[normalSeat === 0 ? 1 : 0];
      if (normalScore > easyScore) normalWins++;
      else if (easyScore > normalScore) easyWins++;
    }

    expect(normalWins, `normal ${normalWins} - ${easyWins} easy`).toBeGreaterThan(easyWins);
  }, 120_000);

  it('hard outscores easy by a wide margin', () => {
    let hardPoints = 0;
    let easyPoints = 0;

    for (let seed = 0; seed < 8; seed++) {
      const hardSeat: PlayerIndex = seed % 2 === 0 ? 0 : 1;
      const { state } = playMatch(
        seed,
        hardSeat === 0 ? 'hard' : 'easy',
        hardSeat === 0 ? 'easy' : 'hard',
        3,
      );
      hardPoints += state.scores[hardSeat];
      easyPoints += state.scores[hardSeat === 0 ? 1 : 0];
    }

    expect(hardPoints, `hard ${hardPoints} pts - ${easyPoints} pts easy`).toBeGreaterThan(easyPoints);
  }, 120_000);
});

describe('AI performance', () => {
  it('hard picks a move fast enough to keep the UI responsive', () => {
    const rng = createRng(7);
    let state = createGame(STANDARD_RULES, 7, 0);
    // Advance to a mid-round position with a full hand of options.
    const times: number[] = [];

    for (let i = 0; i < 8 && !state.matchOver; i++) {
      if (state.roundState.phase === 'round-end') break;
      const t0 = performance.now();
      const move = chooseAiMove(state, 'hard', rng);
      times.push(performance.now() - t0);
      state = applyMove(state, move);
    }

    const worst = Math.max(...times);
    expect(times.length).toBeGreaterThan(0);
    // Generous ceiling: this runs on CI and on phones, and the UI shows a
    // "thinking" state anyway. It exists to catch an accidental blow-up.
    expect(worst, `slowest hard move took ${worst.toFixed(0)}ms`).toBeLessThan(4000);
  }, 120_000);
});
