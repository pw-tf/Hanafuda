/**
 * The player's hand, fanned into an arc.
 *
 * Browsing and committing are separate gestures, which is what makes this
 * work one-handed on a phone:
 *
 *   slide  — drag across the fan (or just move the cursor) to bring each card
 *            forward in turn, without committing to anything
 *   tap    — pull the focused card out of the fan and onto the table, ready
 *            to be matched against the field or discarded
 *
 * A tap is distinguished from a slide by how far the pointer travelled, so
 * dragging across the fan never accidentally plays a card.
 *
 * Both gestures stay live while the opponent is playing. Nothing about
 * browsing your own hand touches the game state, and thinking about your next
 * move during their turn is the whole of the waiting — the fan used to go
 * half-transparent and stop responding, which made the pause dead time. Only
 * the commit is withheld: `canPlay` says whether the card that is forward can
 * actually be put down, `canBrowse` whether the fan answers at all.
 */

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CardId } from '../../engine/cards';
import { CardFace } from '../../art/CardFace';

/** Movement beyond this many px is a slide, not a tap. */
const TAP_SLOP_PX = 8;

export interface HandProps {
  cards: readonly CardId[];
  /** Field-match count per card, for the badge. */
  matchCounts: ReadonlyMap<CardId, number>;
  /** The forward card can be played right now. */
  canPlay: boolean;
  /** The fan responds to slides and taps, whether or not a move can follow. */
  canBrowse: boolean;
  /** The card pulled forward, if any. */
  selected: CardId | null;
  onSelect(card: CardId | null): void;
}

export function Hand({ cards, matchCounts, canPlay, canBrowse, selected, onSelect }: HandProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const [width, setWidth] = useState(360);

  const pointer = useRef<{ id: number; startX: number; startY: number; moved: boolean } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const n = cards.length;
  const slots = useMemo(() => fanLayout(n, width), [n, width]);

  /** Index of the card nearest a clientX position. */
  const indexAt = useCallback(
    (clientX: number): number | null => {
      const el = ref.current;
      if (!el || slots.length === 0) return null;
      const rect = el.getBoundingClientRect();
      return nearestSlot(slots, clientX - rect.left - rect.width / 2);
    },
    [slots],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (!canBrowse) return;
    pointer.current = { id: e.pointerId, startX: e.clientX, startY: e.clientY, moved: false };
    setFocus(indexAt(e.clientX));
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!canBrowse) return;
    const p = pointer.current;
    if (p && e.pointerId === p.id) {
      if (Math.abs(e.clientX - p.startX) > TAP_SLOP_PX || Math.abs(e.clientY - p.startY) > TAP_SLOP_PX) {
        p.moved = true;
      }
      setFocus(indexAt(e.clientX));
      // Once this is a slide, stop the page from scrolling under the gesture.
      if (p.moved) e.preventDefault();
    } else if (e.pointerType === 'mouse') {
      // Hover browsing on desktop.
      setFocus(indexAt(e.clientX));
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const p = pointer.current;
    pointer.current = null;
    if (!canBrowse || !p || e.pointerId !== p.id) return;

    if (!p.moved) {
      const i = indexAt(e.clientX);
      const card = i === null ? null : cards[i];
      if (card) onSelect(selected === card ? null : card);
    }
  };

  const onPointerLeave = () => {
    if (!pointer.current) setFocus(null);
  };

  return (
    <div
      ref={ref}
      className={
        'hand' +
        (canBrowse ? '' : ' hand--idle') +
        // Browsable but not playable: the fan is live, so it stays legible —
        // only the "you could put this down" rim is toned back, so a lit card
        // is never read as an invitation to move out of turn.
        (canBrowse && !canPlay ? ' hand--preview' : '')
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (pointer.current = null)}
      onPointerLeave={onPointerLeave}
      role="group"
      aria-label="Your hand"
    >
      {n === 0 && <p className="hand__empty">Hand empty</p>}

      {cards.map((id, i) => {
        const isSelected = selected === id;
        const isFocus = focus === i && !isSelected;
        const matches = matchCounts.get(id) ?? 0;

        return (
          <button
            key={id}
            type="button"
            className={
              'hand__card' +
              (isSelected ? ' hand__card--selected' : '') +
              (isFocus ? ' hand__card--focus' : '') +
              (matches > 0 ? ' hand__card--playable' : '')
            }
            style={cardStyle(slots[i] ?? { x: 0, y: 0, rotate: 0 }, i, isSelected, isFocus)}
            disabled={!canBrowse}
            // Pointer handling lives on the container so a drag that starts on
            // one card and ends on another still reads as one gesture.
            onClick={(e) => e.preventDefault()}
            onFocus={() => setFocus(i)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(isSelected ? null : id);
              }
            }}
            aria-pressed={isSelected}
          >
            <CardFace id={id} width={cardWidthFor(n)} eager />
            {matches > 0 && (isFocus || isSelected) && (
              <span className="hand__match" aria-label={`${matches} matching field cards`}>
                {matches}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Card width shrinks as the hand grows, so a full hand still fits. */
function cardWidthFor(n: number): number {
  if (n <= 4) return 92;
  if (n <= 6) return 84;
  return 76;
}

const CARD_RATIO = 1600 / 976;
/** Rotation pivot, as a multiple of card height below the card's centre. */
const PIVOT = 1.4;

export interface FanSlot {
  x: number;
  y: number;
  rotate: number;
}

/**
 * Fan geometry, solved rather than guessed.
 *
 * Cards rotate about a pivot well below the card, which is what gives a real
 * fan its shape — but that same pivot swings the outer cards sideways, on top
 * of whatever horizontal offset they already have. Ignoring that is how the
 * fan ended up 512px wide on a 390px screen.
 *
 * So: lay the fan out, measure its true extent including the swing, and if it
 * is too wide for the container, scale the whole thing down until it fits.
 * The result is a fan that always sits inside the screen, at any hand size.
 */
export function fanLayout(n: number, width: number): FanSlot[] {
  if (n === 0) return [];
  const cardW = cardWidthFor(n);
  const cardH = cardW * CARD_RATIO;
  const centre = (n - 1) / 2;
  const pivot = cardH * PIVOT;
  const spread = Math.min(6, 40 / Math.max(n, 1));

  const raw = Array.from({ length: n }, (_, i) => {
    const offset = i - centre;
    const rotate = offset * spread;
    const rad = (rotate * Math.PI) / 180;
    return {
      // Position comes from swinging about the pivot, plus a little extra
      // spacing so a small hand does not bunch up in the middle.
      x: pivot * Math.sin(rad) + offset * cardW * 0.26,
      y: pivot * (1 - Math.cos(rad)),
      rotate,
    };
  });

  // Half-width of a rotated card's bounding box, so the clamp accounts for
  // the corners rather than just the centre point.
  const maxRad = (Math.abs(centre * spread) * Math.PI) / 180;
  const halfSpan = (cardW * Math.cos(maxRad) + cardH * Math.sin(maxRad)) / 2;
  const extent = Math.max(...raw.map((s) => Math.abs(s.x))) + halfSpan;
  const limit = width / 2 - 4;
  const scale = extent > limit && extent > 0 ? limit / extent : 1;

  // Bottom-align the arc so the lowest card rests on the container floor
  // instead of sinking into the row beneath.
  const maxY = Math.max(...raw.map((s) => s.y));

  return raw.map((s) => ({ x: s.x * scale, y: s.y - maxY, rotate: s.rotate }));
}

/** Index of the slot nearest a horizontal position, in container coordinates. */
export function nearestSlot(slots: readonly FanSlot[], relX: number): number {
  let best = 0;
  let bestDist = Infinity;
  slots.forEach((s, i) => {
    const d = Math.abs(s.x - relX);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  });
  return best;
}

function cardStyle(
  slot: FanSlot,
  i: number,
  isSelected: boolean,
  isFocus: boolean,
): React.CSSProperties {
  let { x, y, rotate } = slot;
  let scale = 1;

  if (isSelected) {
    y = -84;
    rotate = 0;
    scale = 1.22;
  } else if (isFocus) {
    y -= 28;
    rotate *= 0.35;
    scale = 1.12;
  }

  return {
    transform: `translateX(calc(-50% + ${x}px)) translateY(${y}px) rotate(${rotate}deg) scale(${scale})`,
    zIndex: isSelected ? 60 : isFocus ? 50 : i,
  };
}
