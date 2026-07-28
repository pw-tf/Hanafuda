/**
 * Binds the authored art to card ids and renders a card at any size.
 *
 * `ART_BY_ID` is built from the month modules and checked against `DECK` at
 * module load, so a missing or extra face is a loud startup failure rather
 * than a blank card discovered later.
 */

import type { ReactNode } from 'react';
import { DECK, getCard, type CardId } from '../engine/cards';
import { CARD_H, CARD_W, CardBase, PALETTE, VIEWBOX } from './primitives';
import { month01 } from './month01';
import { month02 } from './month02';
import { month03 } from './month03';
import { month04 } from './month04';
import { month05 } from './month05';
import { month06 } from './month06';
import { month07 } from './month07';
import { month08 } from './month08';
import { month09 } from './month09';
import { month10 } from './month10';
import { month11 } from './month11';
import { month12 } from './month12';

const MONTH_ART: ReactNode[][] = [
  month01, month02, month03, month04, month05, month06,
  month07, month08, month09, month10, month11, month12,
];

function buildArtIndex(): Map<CardId, ReactNode> {
  const index = new Map<CardId, ReactNode>();
  MONTH_ART.forEach((faces, monthIndex) => {
    faces.forEach((face, cardIndex) => {
      index.set(`m${monthIndex + 1}-${cardIndex}`, face);
    });
  });

  const missing = DECK.filter((c) => !index.has(c.id)).map((c) => c.id);
  if (missing.length > 0) {
    throw new Error(`Card art missing for: ${missing.join(', ')}`);
  }
  if (index.size !== DECK.length) {
    const extra = [...index.keys()].filter((id) => !DECK.some((c) => c.id === id));
    throw new Error(`Card art defined for unknown ids: ${extra.join(', ')}`);
  }
  return index;
}

export const ART_BY_ID = buildArtIndex();

export interface CardFaceProps {
  id: CardId;
  /** Rendered width in CSS pixels; height follows the 3:5 card ratio. */
  width?: number;
  className?: string;
  /** Adds a title element for screen readers and native tooltips. */
  labelled?: boolean;
}

export const CARD_ASPECT = CARD_H / CARD_W;

export function CardFace({ id, width = CARD_W, className, labelled = true }: CardFaceProps) {
  const card = getCard(id);
  return (
    <svg
      viewBox={VIEWBOX}
      width={width}
      height={width * CARD_ASPECT}
      className={className}
      role="img"
      aria-label={`${card.name} — ${card.suit}`}
    >
      {labelled && <title>{`${card.name} (${card.nameJa}) — ${card.suit}`}</title>}
      <CardBase>{ART_BY_ID.get(id)}</CardBase>
    </svg>
  );
}

/** The reverse of a card, for the opponent's hand and the draw pile. */
export function CardBack({ width = CARD_W, className }: { width?: number; className?: string }) {
  return (
    <svg viewBox={VIEWBOX} width={width} height={width * CARD_ASPECT} className={className} aria-hidden="true">
      <rect x="0" y="0" width={CARD_W} height={CARD_H} rx="10" fill={PALETTE.ink} />
      <rect x="3" y="3" width={CARD_W - 6} height={CARD_H - 6} rx="8" fill="#8c1f1a" />
      <rect x="9" y="9" width={CARD_W - 18} height={CARD_H - 18} rx="5" fill="none" stroke="#c3564a" strokeWidth="1.4" />
      <g fill="#a52d26">
        {Array.from({ length: 7 }, (_, row) =>
          Array.from({ length: 4 }, (_, col) => (
            <circle key={`${row}-${col}`} cx={22 + col * 25} cy={26 + row * 25} r={5} />
          )),
        )}
      </g>
    </svg>
  );
}
