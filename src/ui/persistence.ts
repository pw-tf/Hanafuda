/**
 * Saving a game in progress to `localStorage`, so an accidental refresh does
 * not throw a match away.
 *
 * Two things this deliberately does NOT trust:
 *
 *  - **The stored payload.** It may be from an older build, hand-edited, or
 *    truncated by a full disk. It is validated against the engine's own
 *    invariants before being handed back — a save that fails is discarded
 *    rather than loaded into the game and crashing mid-round.
 *  - **`localStorage` existing at all.** Private-mode Safari and storage
 *    quotas both throw on write. Every access is guarded; persistence failing
 *    must never take the game down with it.
 */

import { ALL_CARD_IDS, type CardId } from '../engine/cards';
import type { GameState } from '../engine/game';
import type { Difficulty } from '../ai';
import type { SessionMode } from './useGameSession';
import type { Strategy } from '../net/protocol';

const KEY = 'hanafuda-koikoi:save';
/** Bump when the shape changes; older saves are then dropped, not migrated. */
const SCHEMA_VERSION = 1;

export interface SavedGame {
  version: number;
  savedAt: number;
  mode: SessionMode;
  difficulty: Difficulty;
  roomCode?: string;
  strategy?: Strategy;
  state: GameState;
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Structural check on a loaded state. This is the same card-conservation
 * invariant the engine's soak test asserts: all 48 cards present exactly
 * once across hands, field, deck, captures and any pending choice.
 */
function isCoherent(state: GameState): boolean {
  const r = state?.roundState;
  if (!r || !Array.isArray(r.field) || !Array.isArray(r.deck)) return false;
  if (!Array.isArray(r.players) || r.players.length !== 2) return false;

  const seen: CardId[] = [
    ...r.players[0].hand,
    ...r.players[1].hand,
    ...r.players[0].captured,
    ...r.players[1].captured,
    ...r.field,
    ...r.deck,
    ...(r.pending ? [r.pending.card] : []),
  ];

  if (seen.length !== 48 || new Set(seen).size !== 48) return false;
  const known = new Set<string>(ALL_CARD_IDS);
  return seen.every((id) => known.has(id));
}

export function saveGame(save: Omit<SavedGame, 'version' | 'savedAt'>): void {
  const store = storage();
  if (!store) return;
  try {
    const payload: SavedGame = { ...save, version: SCHEMA_VERSION, savedAt: Date.now() };
    store.setItem(KEY, JSON.stringify(payload));
  } catch {
    // Quota exceeded or storage disabled. A game that cannot be saved is
    // still a perfectly playable game.
  }
}

export function loadGame(): SavedGame | null {
  const store = storage();
  if (!store) return null;

  let raw: string | null;
  try {
    raw = store.getItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as SavedGame;
    if (parsed?.version !== SCHEMA_VERSION) {
      clearGame();
      return null;
    }
    if (!parsed.state || parsed.state.matchOver || !isCoherent(parsed.state)) {
      clearGame();
      return null;
    }
    return parsed;
  } catch {
    clearGame();
    return null;
  }
}

export function clearGame(): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(KEY);
  } catch {
    /* nothing useful to do */
  }
}

/** Human-readable summary for the resume button on the menu. */
export function describeSave(save: SavedGame): string {
  const where =
    save.mode === 'ai'
      ? `vs ${save.difficulty}`
      : save.mode === 'local'
        ? 'pass and play'
        : `room ${save.roomCode ?? '—'}`;
  const { round, rules, scores } = save.state;
  return `${where} · round ${round}/${rules.rounds} · ${scores[0]}–${scores[1]}`;
}
