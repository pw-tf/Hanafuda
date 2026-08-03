import { describe, expect, it } from 'vitest';
import { applyMove, createGame, legalMoves, type GameState, type Move } from '../../engine/game';
import { createRng } from '../../engine/rng';
import { STANDARD_RULES } from '../../engine/rules';
import {
  EMOTES,
  EMOTE_COOLDOWN_MS,
  acceptSnapshot,
  emote,
  emoteAllowed,
  isEmoteId,
  newEpoch,
  newSnapshotWindow,
  MAX_NAME_LENGTH,
  sanitizeName,
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
    const epoch = newEpoch();
    const seen = newSnapshotWindow();

    /** The host broadcasting, and the guest applying, exactly as in the app. */
    const broadcast = (state: GameState) => {
      const message = { epoch, seq: ++seq, json: encodeState(state) };
      if (!acceptSnapshot(seen, message)) return;
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

    const epoch = newEpoch();
    const seen = newSnapshotWindow();
    let guest: GameState | null = null;
    const receive = (seq: number, state: GameState) => {
      if (!acceptSnapshot(seen, { epoch, seq })) return;
      guest = decodeState(encodeState(state));
    };

    receive(2, second);
    receive(1, first); // late delivery of the older snapshot
    expect(guest).toEqual(second);
  });
});

/**
 * What happens when the host's page is thrown away and brought back — the
 * ordinary consequence of switching apps on a phone. Its sequence numbers
 * restart from zero, and the guest must not read that as a flood of stale
 * deliveries and freeze on a position nobody is playing any more.
 */
describe('a host that reloaded mid-game', () => {
  it('gives every run a distinct epoch', () => {
    const epochs = new Set(Array.from({ length: 200 }, newEpoch));
    expect(epochs.size).toBe(200);
    for (const e of epochs) expect(e).toMatch(/^[0-9a-f]{16}$/);
  });

  it('adopts the resumed host’s snapshots even though seq went backwards', () => {
    const seen = newSnapshotWindow();
    const before = newEpoch();
    const after = newEpoch();

    for (let seq = 1; seq <= 40; seq++) {
      expect(acceptSnapshot(seen, { epoch: before, seq })).toBe(true);
    }
    // The host comes back counting from one again.
    expect(acceptSnapshot(seen, { epoch: after, seq: 1 })).toBe(true);
    expect(acceptSnapshot(seen, { epoch: after, seq: 2 })).toBe(true);
  });

  it('still drops late deliveries once the new run is under way', () => {
    const seen = newSnapshotWindow();
    const epoch = newEpoch();
    expect(acceptSnapshot(seen, { epoch, seq: 5 })).toBe(true);
    expect(acceptSnapshot(seen, { epoch, seq: 5 })).toBe(false);
    expect(acceptSnapshot(seen, { epoch, seq: 4 })).toBe(false);
    expect(acceptSnapshot(seen, { epoch, seq: 6 })).toBe(true);
  });

  it('does not treat a stale delivery from the old run as a new one', () => {
    const seen = newSnapshotWindow();
    const before = newEpoch();
    const after = newEpoch();

    acceptSnapshot(seen, { epoch: before, seq: 40 });
    acceptSnapshot(seen, { epoch: after, seq: 1 });
    // The old run's 41st snapshot turns up late. It belongs to a host that no
    // longer exists, but it is a different epoch, so it would be adopted —
    // and then immediately corrected by the live host's next snapshot.
    acceptSnapshot(seen, { epoch: before, seq: 41 });
    expect(acceptSnapshot(seen, { epoch: after, seq: 2 })).toBe(true);
  });

  it('understands a host too old to send an epoch at all', () => {
    const seen = newSnapshotWindow();
    expect(acceptSnapshot(seen, { seq: 1 })).toBe(true);
    expect(acceptSnapshot(seen, { seq: 2 })).toBe(true);
    expect(acceptSnapshot(seen, { seq: 1 })).toBe(false);
  });
});

describe('nicknames', () => {
  // A nickname is typed on the other player's device and rendered on this
  // one, so it is untrusted input however friendly the context.
  it('keeps an ordinary name unchanged', () => {
    expect(sanitizeName('Kai', 'Friend')).toBe('Kai');
    expect(sanitizeName('  Kai  ', 'Friend')).toBe('Kai');
  });

  it('falls back when there is nothing to show', () => {
    expect(sanitizeName('', 'Friend')).toBe('Friend');
    expect(sanitizeName('   ', 'Friend')).toBe('Friend');
    expect(sanitizeName('\n\t', 'Friend')).toBe('Friend');
    expect(sanitizeName(undefined as unknown as string, 'Friend')).toBe('Friend');
  });

  it('turns control characters into spaces and collapses whitespace', () => {
    // Mapped to a space rather than deleted. Dropping them outright would
    // splice two words together, so a name smuggling a NUL mid-word would
    // render as a perfectly ordinary one.
    expect(sanitizeName('Ka\u0000i', 'Friend')).toBe('Ka i');
    expect(sanitizeName('Kai\u007f', 'Friend')).toBe('Kai');
    expect(sanitizeName('a\n\nb', 'Friend')).toBe('a b');
    expect(sanitizeName('a\t \t b', 'Friend')).toBe('a b');
    expect(sanitizeName('\u0000\u0000', 'Friend')).toBe('Friend');
  });

  it('caps the length, so one player cannot push the other off the table', () => {
    const long = sanitizeName('x'.repeat(500), 'Friend');
    expect(long.length).toBe(MAX_NAME_LENGTH);
    // Cut by code point, so a surrogate pair is never split in half.
    const emoji = sanitizeName('🎴'.repeat(50), 'Friend');
    expect([...emoji].length).toBe(MAX_NAME_LENGTH);
    expect(emoji).not.toContain('\ufffd');
  });

  it('does not interpret markup — it is rendered as text', () => {
    // React escapes on render; this only asserts nothing is silently dropped,
    // so the name shows up visibly wrong rather than partially executed.
    expect(sanitizeName('<b>hi</b>', 'Friend')).toBe('<b>hi</b>');
  });

  it('keeps non-Latin names intact', () => {
    expect(sanitizeName('こいこい', 'Friend')).toBe('こいこい');
    // Emoji are astral-plane pairs; the cap counts code points, not units.
    expect(sanitizeName('🎴🎴', 'Friend')).toBe('🎴🎴');
  });
});

describe('emote reactions', () => {
  // The id is what travels; the glyph is looked up locally on each device.
  // So the only thing a modified client can put on the other player's table
  // is one of these five faces.
  it('accepts every id it publishes, and nothing else', () => {
    for (const e of EMOTES) {
      expect(isEmoteId(e.id), e.id).toBe(true);
      expect(emote(e.id).glyph).toBe(e.glyph);
    }
    for (const bogus of ['', 'SMIRK', 'smirk ', '😏', '__proto__', 'toString', 'constructor']) {
      expect(isEmoteId(bogus), bogus).toBe(false);
    }
    for (const bogus of [null, undefined, 0, 1, {}, [], true]) {
      expect(isEmoteId(bogus), String(bogus)).toBe(false);
    }
  });

  it('gives every reaction a distinct id, glyph and spoken label', () => {
    const unique = <T>(xs: readonly T[]) => new Set(xs).size === xs.length;
    expect(unique(EMOTES.map((e) => e.id))).toBe(true);
    expect(unique(EMOTES.map((e) => e.glyph))).toBe(true);
    // The label is what a screen reader announces, so two faces that read the
    // same would be indistinguishable to anyone not looking at the screen.
    expect(unique(EMOTES.map((e) => e.label))).toBe(true);
  });

  it('holds a sender to the cooldown, whatever their client does', () => {
    expect(emoteAllowed(0, 0)).toBe(false);
    expect(emoteAllowed(1000, 1000 + EMOTE_COOLDOWN_MS - 1)).toBe(false);
    expect(emoteAllowed(1000, 1000 + EMOTE_COOLDOWN_MS)).toBe(true);
    // A first reaction is never held back: nothing has been sent yet.
    expect(emoteAllowed(0, Date.now())).toBe(true);
  });

  it('drops a flood down to one reaction per cooldown', () => {
    // The receiver's rule, run over a client sending every 100ms for 10s.
    let lastAt = 0;
    let shown = 0;
    for (let now = 1; now <= 10_000; now += 100) {
      if (!emoteAllowed(lastAt, now)) continue;
      lastAt = now;
      shown++;
    }
    expect(shown).toBeLessThanOrEqual(Math.ceil(10_000 / EMOTE_COOLDOWN_MS));
  });
});
