import { describe, expect, it } from 'vitest';
import { applyMove, createGame, legalMoves, type GameState, type Move } from '../../engine/game';
import { createRng } from '../../engine/rng';
import { STANDARD_RULES } from '../../engine/rules';
import {
  decodeMove,
  decodeRules,
  decodeState,
  encodeMove,
  encodeRules,
  encodeState,
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
  ROOM_CODE_LENGTH,
  seedFromRoomCode,
} from '../protocol';

describe('room codes', () => {
  it('generates valid codes of the right length', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateRoomCode();
      expect(code).toHaveLength(ROOM_CODE_LENGTH);
      expect(isValidRoomCode(code), code).toBe(true);
    }
  });

  it('excludes glyphs that are easy to confuse when read aloud', () => {
    const codes = Array.from({ length: 500 }, generateRoomCode).join('');
    for (const ambiguous of ['0', 'O', '1', 'I']) {
      expect(codes, `contains ${ambiguous}`).not.toContain(ambiguous);
    }
  });

  it('normalises pasted input', () => {
    // 'O' and 'I' are dropped as ambiguous, the rest is kept and truncated.
    expect(normalizeRoomCode('koi-4f2a bz')).toBe('K4F2AB');
    expect(normalizeRoomCode('abcdef')).toBe('ABCDEF');
    expect(normalizeRoomCode('ABCDEFGHIJ')).toHaveLength(ROOM_CODE_LENGTH);
    // Ambiguous characters are dropped rather than silently mapped.
    expect(normalizeRoomCode('A0O1IB')).toBe('AB');
  });

  it('rejects codes of the wrong shape', () => {
    expect(isValidRoomCode('ABC')).toBe(false);
    expect(isValidRoomCode('ABCDE0')).toBe(false);
    expect(isValidRoomCode('')).toBe(false);
  });

  it('derives a stable seed from a code', () => {
    expect(seedFromRoomCode('ABCDEF')).toBe(seedFromRoomCode('ABCDEF'));
    expect(seedFromRoomCode('ABCDEF')).not.toBe(seedFromRoomCode('ABCDEG'));
    expect(Number.isInteger(seedFromRoomCode('ZZZZZZ'))).toBe(true);
  });
});

describe('wire encoding', () => {
  it('round-trips a full game state without losing anything', () => {
    let state = createGame(STANDARD_RULES, 4242, 0);
    const rng = createRng(1);
    // Advance into a mid-round position with captures and a pending choice.
    for (let i = 0; i < 40 && state.roundState.phase !== 'round-end'; i++) {
      const moves = legalMoves(state);
      state = applyMove(state, moves[rng.nextInt(moves.length)] as Move);
    }
    const decoded = decodeState(encodeState(state));
    expect(decoded).toEqual(state);
  });

  it('round-trips every kind of move', () => {
    const moves: Move[] = [
      { type: 'play', card: 'm1-0' },
      { type: 'chooseTarget', target: 'm5-2' },
      { type: 'draw' },
      { type: 'koikoi' },
      { type: 'shobu' },
      { type: 'nextRound' },
    ];
    for (const move of moves) {
      expect(decodeMove(encodeMove(move))).toEqual(move);
    }
  });

  it('round-trips a rule config', () => {
    const rules = { ...STANDARD_RULES, tsukiFudaEnabled: true, rounds: 6 };
    expect(decodeRules(encodeRules(rules))).toEqual(rules);
  });
});

/**
 * The host-authoritative rule, exercised without any network: the host only
 * accepts an intent that is (a) the guest's turn and (b) a move the engine
 * already offered. This is the check that stops a modified guest client from
 * making the engine do anything the rules disallow.
 */
function hostAcceptsIntent(state: GameState, move: Move): boolean {
  if (state.roundState.phase !== 'round-end' && state.roundState.current !== 1) return false;
  return legalMoves(state).some((m) => JSON.stringify(m) === JSON.stringify(move));
}

describe('host-authoritative validation', () => {
  it('rejects a guest move made out of turn', () => {
    const state = createGame(STANDARD_RULES, 11, 0); // seat 0 (host) deals and leads
    expect(state.roundState.current).toBe(0);
    const hostsCard = state.roundState.players[0].hand[0] as string;
    expect(hostAcceptsIntent(state, { type: 'play', card: hostsCard })).toBe(false);
  });

  it('accepts a legal guest move on the guest’s turn', () => {
    // Deal with seat 1 leading, so the guest is to move.
    const state = createGame(STANDARD_RULES, 11, 1);
    expect(state.roundState.current).toBe(1);
    const guestsCard = state.roundState.players[1].hand[0] as string;
    expect(hostAcceptsIntent(state, { type: 'play', card: guestsCard })).toBe(true);
  });

  it('rejects a card the guest does not hold', () => {
    const state = createGame(STANDARD_RULES, 11, 1);
    const notInHand = state.roundState.players[0].hand[0] as string;
    expect(state.roundState.players[1].hand).not.toContain(notInHand);
    expect(hostAcceptsIntent(state, { type: 'play', card: notInHand })).toBe(false);
  });

  it('rejects a fabricated move type for the current phase', () => {
    const state = createGame(STANDARD_RULES, 11, 1);
    expect(hostAcceptsIntent(state, { type: 'shobu' })).toBe(false);
    expect(hostAcceptsIntent(state, { type: 'koikoi' })).toBe(false);
    expect(hostAcceptsIntent(state, { type: 'nextRound' })).toBe(false);
  });
});

describe('host/guest replication', () => {
  it('keeps the guest an exact mirror of the host across a whole round', () => {
    const rng = createRng(99);
    let host = createGame(STANDARD_RULES, 2024, 0);

    // The guest starts with nothing and only ever adopts host snapshots.
    let guest: GameState | null = null;
    let seq = 0;
    let lastSeen = -1;

    /** The host broadcasting, and the guest applying, exactly as in the app. */
    const broadcast = (state: GameState) => {
      const message = { seq: ++seq, json: encodeState(state) };
      if (message.seq <= lastSeen) return;
      lastSeen = message.seq;
      guest = decodeState(message.json);
    };

    broadcast(host);

    for (let i = 0; i < 200 && host.roundState.phase !== 'round-end'; i++) {
      const moves = legalMoves(host);
      const move = moves[rng.nextInt(moves.length)] as Move;

      if (host.roundState.current === 1) {
        // Guest proposes; host validates before applying.
        expect(hostAcceptsIntent(host, move)).toBe(true);
      }
      host = applyMove(host, move);
      broadcast(host);

      expect(guest).toEqual(host);
    }

    expect(guest).not.toBeNull();
    expect(guest).toEqual(host);
  });

  it('discards a stale snapshot that arrives out of order', () => {
    const first = createGame(STANDARD_RULES, 7, 0);
    const second = applyMove(first, legalMoves(first)[0] as Move);

    let lastSeen = -1;
    let guest: GameState | null = null;
    const receive = (seq: number, state: GameState) => {
      if (seq <= lastSeen) return;
      lastSeen = seq;
      guest = decodeState(encodeState(state));
    };

    receive(2, second);
    receive(1, first); // late delivery of the older snapshot
    expect(guest).toEqual(second);
  });
});
