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

import { getCard, type CardId } from '../engine/cards';
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

export function CardFace({ id, width = 120, className, eager = false }: CardFaceProps) {
  const card = getCard(id);
  return (
    <img
      src={cardSrc(id)}
      width={width}
      height={width * CARD_ASPECT}
      className={className}
      alt={`${card.name} — ${card.suit}`}
      title={`${card.name} (${card.nameJa}) — ${card.suit}`}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
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
