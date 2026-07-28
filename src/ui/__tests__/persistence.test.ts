import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyMove, createGame, legalMoves, type GameState, type Move } from '../../engine/game';
import { createRng } from '../../engine/rng';
import { STANDARD_RULES } from '../../engine/rules';
import { clearGame, describeSave, loadGame, saveGame } from '../persistence';

/** Minimal in-memory localStorage, since these tests run under node. */
function installStorage(impl?: Partial<Storage>): Map<string, string> {
  const data = new Map<string, string>();
  const store: Storage = {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, v),
    ...impl,
  };
  vi.stubGlobal('window', { localStorage: store });
  return data;
}

const base = { mode: 'ai' as const, difficulty: 'normal' as const };

describe('game persistence', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    installStorage();
  });

  it('round-trips a game in progress', () => {
    const state = createGame(STANDARD_RULES, 1234, 0);
    saveGame({ ...base, state });

    const loaded = loadGame();
    expect(loaded?.mode).toBe('ai');
    expect(loaded?.difficulty).toBe('normal');
    expect(loaded?.state).toEqual(state);
  });

  it('round-trips a state from the middle of a round', () => {
    const rng = createRng(7);
    let state = createGame(STANDARD_RULES, 7, 0);
    for (let i = 0; i < 25 && !state.matchOver; i++) {
      const moves = legalMoves(state);
      state = applyMove(state, moves[rng.nextInt(moves.length)] as Move);
    }
    saveGame({ ...base, state });
    expect(loadGame()?.state).toEqual(state);
  });

  it('returns null when nothing is saved', () => {
    expect(loadGame()).toBeNull();
  });

  it('clears the save', () => {
    saveGame({ ...base, state: createGame(STANDARD_RULES, 1, 0) });
    expect(loadGame()).not.toBeNull();
    clearGame();
    expect(loadGame()).toBeNull();
  });

  it('refuses a finished match', () => {
    const state: GameState = { ...createGame(STANDARD_RULES, 1, 0), matchOver: true };
    saveGame({ ...base, state });
    expect(loadGame()).toBeNull();
  });

  it('refuses a save from a different schema version', () => {
    const data = installStorage();
    saveGame({ ...base, state: createGame(STANDARD_RULES, 1, 0) });
    const raw = JSON.parse(data.get('hanafuda-koikoi:save') as string) as Record<string, unknown>;
    data.set('hanafuda-koikoi:save', JSON.stringify({ ...raw, version: 999 }));

    expect(loadGame()).toBeNull();
    // A rejected save is dropped, not left to be re-read forever.
    expect(data.has('hanafuda-koikoi:save')).toBe(false);
  });

  it('refuses corrupt JSON', () => {
    const data = installStorage();
    data.set('hanafuda-koikoi:save', '{not json');
    expect(loadGame()).toBeNull();
  });

  /**
   * The important one: a payload that parses but describes an impossible
   * position must never reach the engine. This is the same card-conservation
   * invariant the engine soak test asserts.
   */
  it('refuses a state whose cards do not add up', () => {
    const data = installStorage();
    const state = createGame(STANDARD_RULES, 1, 0);
    saveGame({ ...base, state });

    const raw = JSON.parse(data.get('hanafuda-koikoi:save') as string) as {
      state: { roundState: { deck: string[] } };
    };
    raw.state.roundState.deck.pop(); // 47 cards now
    data.set('hanafuda-koikoi:save', JSON.stringify(raw));

    expect(loadGame()).toBeNull();
  });

  it('refuses a state containing an unknown card id', () => {
    const data = installStorage();
    const state = createGame(STANDARD_RULES, 1, 0);
    saveGame({ ...base, state });

    const raw = JSON.parse(data.get('hanafuda-koikoi:save') as string) as {
      state: { roundState: { deck: string[] } };
    };
    raw.state.roundState.deck[0] = 'm99-9';
    data.set('hanafuda-koikoi:save', JSON.stringify(raw));

    expect(loadGame()).toBeNull();
  });

  it('survives storage being unavailable', () => {
    vi.stubGlobal('window', {
      get localStorage(): Storage {
        throw new Error('SecurityError: storage disabled');
      },
    });
    expect(() => saveGame({ ...base, state: createGame(STANDARD_RULES, 1, 0) })).not.toThrow();
    expect(loadGame()).toBeNull();
    expect(() => clearGame()).not.toThrow();
  });

  it('survives a write that throws, e.g. quota exceeded', () => {
    installStorage({
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    });
    expect(() => saveGame({ ...base, state: createGame(STANDARD_RULES, 1, 0) })).not.toThrow();
  });

  it('keeps the room details for a hosted game', () => {
    saveGame({
      mode: 'host',
      difficulty: 'hard',
      roomCode: 'ABC234',
      strategy: 'mqtt',
      state: createGame(STANDARD_RULES, 5, 0),
    });
    const loaded = loadGame();
    expect(loaded?.roomCode).toBe('ABC234');
    expect(loaded?.strategy).toBe('mqtt');
  });

  it('describes a save for the resume button', () => {
    const state = createGame(STANDARD_RULES, 3, 0);
    expect(describeSave({ version: 1, savedAt: 0, mode: 'ai', difficulty: 'hard', state })).toBe(
      'vs hard · round 1/12 · 0–0',
    );
    expect(describeSave({ version: 1, savedAt: 0, mode: 'local', difficulty: 'easy', state })).toContain(
      'pass and play',
    );
    expect(
      describeSave({ version: 1, savedAt: 0, mode: 'host', difficulty: 'easy', roomCode: 'QQ2233', state }),
    ).toContain('room QQ2233');
  });
});
