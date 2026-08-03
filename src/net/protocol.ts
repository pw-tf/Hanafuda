/**
 * Wire protocol for room-code multiplayer.
 *
 * The connection is host-authoritative: the host owns the one true
 * `GameState` and broadcasts snapshots; the guest sends intents and renders
 * whatever the host last sent. That removes any possibility of the two sides
 * diverging, and means a guest cannot fabricate a move the engine would
 * reject — the host validates every intent against `legalMoves`.
 */

import type { GameState, Move } from '../engine/game';
import type { RuleConfig } from '../engine/rules';

export const PROTOCOL_VERSION = 1;

/**
 * Payloads travel as JSON strings. Trystero's `DataPayload` type only accepts
 * plain JSON shapes, and our state is full of readonly arrays and literal
 * unions that do not structurally satisfy it — encoding once at the boundary
 * is simpler and keeps the wire format explicit.
 */

/** Host -> guest: the authoritative state after every change. */
export type StateMessage = {
  v: number;
  /** Monotonic, so an out-of-order delivery can be discarded. */
  seq: number;
  /** JSON-encoded `GameState`. */
  json: string;
}

/** Guest -> host: "I would like to make this move". */
export type IntentMessage = {
  v: number;
  /** JSON-encoded `Move`. */
  json: string;
}

/**
 * Either side, on connect: what to call me.
 *
 * Sent separately from `hello` because it travels both ways — the host tells
 * the guest the rules, but a nickname is something each player has for
 * themselves.
 */
export type NameMessage = {
  v: number;
  name: string;
}

/** Nicknames are shown on the table, so they are kept short and single-line. */
export const MAX_NAME_LENGTH = 14;

/**
 * Nicknames arrive from the other device, so they are untrusted input: they
 * are rendered as text on this player's screen. Control characters are
 * stripped, whitespace collapsed, and the result capped — an empty or
 * all-blank name falls back to the caller's default rather than rendering a
 * gap where a player's name should be.
 */
export function sanitizeName(raw: string, fallback: string): string {
  const cleaned = [...String(raw ?? '')]
    // Control characters become spaces rather than being dropped: deleting a
    // newline outright would silently splice two words into one.
    .map((ch) => {
      const c = ch.codePointAt(0) ?? 0;
      return c < 0x20 || c === 0x7f ? ' ' : ch;
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  // Sliced by code point, so a name of emoji is not cut through the middle of
  // a surrogate pair.
  const capped = [...cleaned].slice(0, MAX_NAME_LENGTH).join('').trim();
  return capped.length > 0 ? capped : fallback;
}

/**
 * Emote reactions.
 *
 * A closed set, and it is the *id* that travels — never the glyph. A modified
 * client can therefore only ever make one of these five faces appear on the
 * other player's table, rather than painting arbitrary text over it. Anything
 * unrecognised is dropped at the boundary, the same way a nickname is
 * sanitized.
 */
export const EMOTES = [
  { id: 'smirk', glyph: '😏', label: 'Smug' },
  { id: 'watch', glyph: '👀', label: 'Watching you' },
  { id: 'angry', glyph: '😡', label: 'Furious' },
  { id: 'think', glyph: '🤔', label: 'Thinking' },
  { id: 'wow', glyph: '😮', label: 'Wow' },
] as const;

export type Emote = (typeof EMOTES)[number];
export type EmoteId = Emote['id'];

const EMOTE_BY_ID = new Map<string, Emote>(EMOTES.map((e) => [e.id, e]));

export function isEmoteId(value: unknown): value is EmoteId {
  return typeof value === 'string' && EMOTE_BY_ID.has(value);
}

export function emote(id: EmoteId): Emote {
  // Every caller has already passed the id through `isEmoteId`, so the
  // non-null is a statement about the type rather than a hope.
  return EMOTE_BY_ID.get(id) as Emote;
}

/**
 * How long a player must wait between reactions.
 *
 * Enforced on both ends: the sender's picker greys out, and the receiver
 * drops anything that arrives sooner. One player cannot turn the other's
 * table into a flipbook.
 */
export const EMOTE_COOLDOWN_MS = 1500;

/**
 * Whether a reaction at `now` clears the cooldown that started at `lastAt`.
 *
 * One function for both ends, so the sender's greyed-out button and the
 * receiver's drop rule cannot drift apart and leave a player wondering why
 * their reaction went nowhere.
 */
export function emoteAllowed(lastAt: number, now: number): boolean {
  return now - lastAt >= EMOTE_COOLDOWN_MS;
}

/** Either side, any time: "here is how I feel about that". */
export type EmoteMessage = {
  v: number;
  /** An `EmoteId`. Untrusted until checked with `isEmoteId`. */
  id: string;
}

/** Host -> guest, once on connect, so both sides agree on the rules. */
export type HelloMessage = {
  v: number;
  /** JSON-encoded `RuleConfig`. */
  json: string;
  /** Which seat the guest occupies. The host always takes seat 0. */
  guestSeat: 1;
}

export const encodeState = (state: GameState): string => JSON.stringify(state);
export const decodeState = (json: string): GameState => JSON.parse(json) as GameState;
export const encodeMove = (move: Move): string => JSON.stringify(move);
export const decodeMove = (json: string): Move => JSON.parse(json) as Move;
export const encodeRules = (rules: RuleConfig): string => JSON.stringify(rules);
export const decodeRules = (json: string): RuleConfig => JSON.parse(json) as RuleConfig;

export type RejectReason = 'not-your-turn' | 'illegal-move' | 'version-mismatch';

export type RejectMessage = {
  v: number;
  reason: RejectReason;
  detail?: string;
}

/** Which relay network is used to introduce the two peers. */
export type Strategy = 'nostr' | 'mqtt';

export const STRATEGY_LABEL: Record<Strategy, string> = {
  nostr: 'Nostr relays',
  mqtt: 'MQTT brokers',
};

/** Trystero action names. Each is capped at 12 bytes by the library. */
export const ACTIONS = {
  hello: 'hello',
  name: 'name',
  state: 'state',
  intent: 'intent',
  reject: 'reject',
  emote: 'emote',
} as const;

/**
 * Room codes are 6 characters from an alphabet with no visually ambiguous
 * glyphs, so a code read aloud or copied by hand round-trips reliably.
 */
const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;

export function generateRoomCode(): string {
  const bytes = new Uint8Array(ROOM_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ROOM_ALPHABET[b % ROOM_ALPHABET.length]).join('');
}

/** Uppercase, strip anything not in the alphabet. Lets users paste "koi-4f2a". */
export function normalizeRoomCode(input: string): string {
  return input
    .toUpperCase()
    .split('')
    .filter((ch) => ROOM_ALPHABET.includes(ch))
    .join('')
    .slice(0, ROOM_CODE_LENGTH);
}

export function isValidRoomCode(code: string): boolean {
  return code.length === ROOM_CODE_LENGTH && [...code].every((ch) => ROOM_ALPHABET.includes(ch));
}

/**
 * Derive a deterministic seed from the room code so both peers could, in
 * principle, verify the host's deal. The host is authoritative regardless,
 * but a reproducible seed makes desync debuggable.
 */
export function seedFromRoomCode(code: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < code.length; i++) {
    h ^= code.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
