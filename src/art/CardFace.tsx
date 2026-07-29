/**
 * Card faces.
 *
 * The artwork is Louie Mantia, Jr.'s hanafuda deck, CC BY-SA 4.0, from
 * Wikimedia Commons. The 48 files live in `public/cards/<cardId>.svg`;
 * `public/cards/CREDITS.json` records which original Commons file each one
 * came from.
 *
 * They are rendered as <img>, deliberately, not inlined. Every file declares
 * the same element ids (`clip-path`, `Paper_Backing`, …) and the same CSS
 * class names (`.cls-1`, `.cls-2`, …) but with different colours per card.
 * Inlining several into one document would make each card's <style> block
 * repaint every other card, and `url(#clip-path)` would resolve to whichever
 * element came first. As <img> each file is an isolated document, so none of
 * that can happen — and the browser caches and lazy-loads them for free.
 */

import { useEffect, useState } from 'react';
import { ALL_CARD_IDS, getCard, type CardId } from '../engine/cards';
import { PALETTE } from './palette';

/** Native dimensions of the source artwork. */
export const CARD_W = 976;
export const CARD_H = 1600;
export const CARD_ASPECT = CARD_H / CARD_W;

/** Vite serves `public/` from the configured base, which differs on Pages. */
export function cardSrc(id: CardId): string {
  return `${import.meta.env.BASE_URL}cards/${id}.svg`;
}

export interface CardFaceProps {
  id: CardId;
  /** Rendered width in CSS pixels; height follows the card's aspect ratio. */
  width?: number;
  className?: string;
  /** Cards below the fold can defer loading. */
  eager?: boolean;
}

/**
 * How many times to re-request a face that failed to load.
 *
 * A card image that fails once never recovers on its own — the browser does
 * not retry a broken <img>, so the card stays invisible for the rest of the
 * game while its button carries on working: tappable, and playable, but not
 * there. Only a reload fixed it. Players hit this on the table and in hand,
 * and a dealt round requests a dozen faces at once over a mobile connection
 * that is also carrying the peer-to-peer traffic, so one of them failing is
 * not rare.
 */
const MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 250;

export function CardFace({ id, width = 120, className, eager = false }: CardFaceProps) {
  const card = getCard(id);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  // A different card in this slot starts over.
  useEffect(() => {
    setAttempt(0);
    setFailed(false);
  }, [id]);

  useEffect(() => {
    if (!failed || attempt >= MAX_ATTEMPTS) return;
    const timer = setTimeout(() => {
      setFailed(false);
      setAttempt((n) => n + 1);
    }, RETRY_BASE_MS * 2 ** attempt);
    return () => clearTimeout(timer);
  }, [failed, attempt]);

  // The retry carries a counter so it is a fresh request rather than a cache
  // hit on the failure.
  const src = attempt === 0 ? cardSrc(id) : `${cardSrc(id)}?retry=${attempt}`;

  return (
    <img
      // Keyed on the URL so a retry replaces the element instead of asking the
      // same broken one to try again.
      key={src}
      src={src}
      width={width}
      height={width * CARD_ASPECT}
      className={className}
      alt={`${card.name} — ${card.suit}`}
      title={`${card.name} (${card.nameJa}) — ${card.suit}`}
      loading={eager ? 'eager' : 'lazy'}
      // Decoding is left to the browser. Forcing it async buys nothing for
      // artwork this small and has its own history of images that load but
      // never paint.
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}

/**
 * The reverse of a card, for the opponent's hand and the draw pile. This one
 * is ours — the Commons set is faces only — drawn on the same 976×1600 grid
 * so backs and faces line up exactly.
 */
export function CardBack({ width = 120, className }: { width?: number; className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${CARD_W} ${CARD_H}`}
      width={width}
      height={width * CARD_ASPECT}
      className={className}
      aria-hidden="true"
    >
      <rect x="0" y="0" width={CARD_W} height={CARD_H} rx="80" fill={PALETTE.ink} />
      <rect x="16" y="16" width={CARD_W - 32} height={CARD_H - 32} rx="64" fill="#8c1f1a" />
      <rect
        x="56"
        y="56"
        width={CARD_W - 112}
        height={CARD_H - 112}
        rx="40"
        fill="none"
        stroke="#c3564a"
        strokeWidth="10"
      />
      <g fill="#a52d26">
        {Array.from({ length: 7 }, (_, row) =>
          Array.from({ length: 4 }, (_, col) => (
            <circle key={`${row}-${col}`} cx={178 + col * 205} cy={210 + row * 205} r={40} />
          )),
        )}
      </g>
    </svg>
  );
}

/**
 * Fetch every face into the browser cache, quietly, in the background.
 *
 * Faces are only requested when a card first appears, so each new deal fires
 * a burst of fresh requests at exactly the moment the connection is busiest.
 * Warming the cache first spreads the same bytes over idle time instead — the
 * whole deck is 1.6 MB and a full match shows all of it anyway, so this moves
 * the traffic rather than adding to it.
 *
 * Deliberately unhurried: a few at a time, each queued behind the last, so it
 * never competes with anything the player is waiting on.
 */
const PARALLEL_WARM = 3;
let warming = false;

export function warmCardCache(): void {
  if (warming || typeof window === 'undefined') return;
  warming = true;

  const queue = [...ALL_CARD_IDS];
  // Safari only shipped requestIdleCallback recently, so fall back to a timer.
  const ric = (window as Window & { requestIdleCallback?: typeof requestIdleCallback })
    .requestIdleCallback;
  const idle = (fn: () => void) => {
    if (ric) ric.call(window, fn, { timeout: 3000 });
    else window.setTimeout(fn, 60);
  };

  const next = () => {
    const id = queue.shift();
    if (!id) return;
    const img = new Image();
    // Failures are ignored: this is a cache warm, and CardFace retries for
    // real when a card is actually on screen.
    img.onload = () => idle(next);
    img.onerror = () => idle(next);
    img.src = cardSrc(id);
  };

  for (let i = 0; i < PARALLEL_WARM; i++) idle(next);
}
