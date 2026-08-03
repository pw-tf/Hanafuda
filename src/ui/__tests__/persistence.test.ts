import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyMove, createGame, legalMoves, type GameState, type Move } from '../../engine/game';
import { createRng } from '../../engine/rng';
import { STANDARD_RULES } from '../../engine/rules';
import {
  clearGame,
  describeSave,
  loadGame,
  resumeLabel,
  saveGame,
  type SavedGame,
} from '../persistence';

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
      'vs Hard · round 1/12 · 0–0',
    );
    expect(describeSave({ version: 1, savedAt: 0, mode: 'local', difficulty: 'easy', state })).toContain(
      'pass and play',
    );
    expect(
      describeSave({ version: 1, savedAt: 0, mode: 'host', difficulty: 'easy', roomCode: 'QQ2233', state }),
    ).toContain('room QQ2233');
  });
});

/**
 * A guest mirrors the host rather than owning a position, so its save is the
 * room and nothing else. The point is the one slot: a guest that wrote
 * nothing left whatever was there before in place, so the menu would offer to
 * resume some older game — with an older room code — while the player was
 * trying to get back into the one they had just been thrown out of.
 */
describe('a guest’s save', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    installStorage();
  });

  it('keeps the room, and no board', () => {
    saveGame({ mode: 'guest', difficulty: 'normal', roomCode: 'XYZ789', strategy: 'mqtt' });
    const loaded = loadGame();
    expect(loaded?.mode).toBe('guest');
    expect(loaded?.roomCode).toBe('XYZ789');
    expect(loaded?.strategy).toBe('mqtt');
    expect(loaded?.state).toBeUndefined();
  });

  it('replaces an earlier game rather than leaving its code to be offered', () => {
    saveGame({ mode: 'host', difficulty: 'normal', roomCode: 'ABC234', state: createGame(STANDARD_RULES, 5, 0) });
    saveGame({ mode: 'guest', difficulty: 'normal', roomCode: 'XYZ789' });

    const loaded = loadGame();
    expect(loaded?.roomCode).toBe('XYZ789');
    expect(describeSave(loaded as SavedGame)).not.toContain('ABC234');
  });

  it('is offered as a rejoin, and says the host has the board', () => {
    const save: SavedGame = {
      version: 1,
      savedAt: 0,
      mode: 'guest',
      difficulty: 'normal',
      roomCode: 'XYZ789',
    };
    expect(resumeLabel(save)).toBe('Rejoin room');
    expect(describeSave(save)).toContain('room XYZ789');
    expect(describeSave(save)).toContain('host has the board');
  });

  it('everyone else is still offered a resume', () => {
    const state = createGame(STANDARD_RULES, 3, 0);
    for (const mode of ['ai', 'local', 'host'] as const) {
      expect(resumeLabel({ version: 1, savedAt: 0, mode, difficulty: 'easy', state })).toBe(
        'Resume game',
      );
    }
  });

  it('is discarded when there is no room code to go back to', () => {
    const data = installStorage();
    saveGame({ mode: 'guest', difficulty: 'normal', roomCode: 'XYZ789' });
    const raw = JSON.parse(data.get('hanafuda-koikoi:save') as string) as Record<string, unknown>;
    delete raw.roomCode;
    data.set('hanafuda-koikoi:save', JSON.stringify(raw));

    expect(loadGame()).toBeNull();
    expect(data.has('hanafuda-koikoi:save')).toBe(false);
  });

  it('drops a board that somehow came with it, rather than showing a stale one', () => {
    const data = installStorage();
    saveGame({ mode: 'guest', difficulty: 'normal', roomCode: 'XYZ789' });
    const raw = JSON.parse(data.get('hanafuda-koikoi:save') as string) as Record<string, unknown>;
    raw.state = createGame(STANDARD_RULES, 5, 0);
    data.set('hanafuda-koikoi:save', JSON.stringify(raw));

    const loaded = loadGame();
    expect(loaded?.roomCode).toBe('XYZ789');
    expect(loaded?.state).toBeUndefined();
  });
});
