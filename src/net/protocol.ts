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
  state: 'state',
  intent: 'intent',
  reject: 'reject',
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
