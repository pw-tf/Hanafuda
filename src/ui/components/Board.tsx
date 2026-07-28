/**
 * The playing surface: the field, and your hand.
 *
 * Interaction is two-stage. Sliding across the fan browses; tapping pulls a
 * card forward onto the table. Once a card is forward, the field cards it can
 * take light up — tap one to capture. If it can take nothing, the table itself
 * becomes the target and tapping it discards.
 *
 * The ambiguous two-match case therefore needs no special modal: it is just
 * the normal "two things lit up, pick one" flow.
 *
 * The draw pile and the opponent's hand are not drawn here. They used to be
 * full rows of card backs above and below the field, which cost the table a
 * lot of height to communicate two numbers; both now live as a small stack on
 * the corresponding capture summary bar.
 */

import { useLayoutEffect, useRef, useState } from 'react';
import { getCard, type CardId } from '../../engine/cards';
import { matchesFor, type GameState, type PlayerIndex } from '../../engine/game';
import { CardFace } from '../../art/CardFace';
import { Hand } from './Hand';

export interface BoardProps {
  state: GameState;
  /** The seat this device plays. */
  seat: PlayerIndex;
  canAct: boolean;
  selected: CardId | null;
  onSelect(card: CardId | null): void;
  onPlay(card: CardId): void;
  onChooseTarget(card: CardId): void;
  /** Show what a card is. Never fires when the tap means something in play. */
  onInspect(card: CardId): void;
}

export function Board({
  state,
  seat,
  canAct,
  selected,
  onSelect,
  onPlay,
  onChooseTarget,
  onInspect,
}: BoardProps) {
  const round = state.roundState;
  const myHand = round.players[seat].hand;

  const choosing = round.phase === 'choose-hand-target' || round.phase === 'choose-draw-target';
  const choiceOptions = new Set(choosing ? (round.pending?.options ?? []) : []);

  const selectedMatches = selected ? matchesFor(selected, round.field) : [];
  const selectableTargets = new Set(selectedMatches);
  /** A forward card with nowhere to go is discarded by tapping the table. */
  const discardArmed = Boolean(selected) && selectedMatches.length === 0;

  const matchCounts = new Map<CardId, number>(
    myHand.map((id) => [id, matchesFor(id, round.field).length]),
  );

  /**
   * A tap on the table means capture while a card is forward, and "what is
   * this?" when nothing is. Keeping those apart is what stops the info panel
   * from ever getting in the way of a move.
   */
  const handleField = (id: CardId) => {
    if (choosing && choiceOptions.has(id)) {
      onChooseTarget(id);
      return;
    }
    if (selected) {
      if (selectableTargets.has(id)) onPlay(selected);
      return;
    }
    onInspect(id);
  };

  const pending = round.pending;
  const drawn = round.trace.drawnCard;

  // Captures are made by whoever is on turn, so a card leaving the field
  // travels towards their side of the table.
  const captureDirection = round.trace.player === seat ? 'down' : 'up';
  const { order, arriving, leaving } = useFieldAnimation(round.field, captureDirection);

  return (
    <div className="board">
      <div
        className={`board__field${discardArmed ? ' board__field--discard' : ''}`}
        onClick={discardArmed && selected ? () => onPlay(selected) : undefined}
      >
        {order.map((id) => {
          const isTarget = selectableTargets.has(id) || choiceOptions.has(id);
          const goes = leaving.get(id);
          return (
            <button
              key={id}
              type="button"
              className={
                'board__slot' +
                (isTarget ? ' board__slot--target' : '') +
                (arriving.has(id) ? ' board__slot--enter' : '') +
                (goes ? ` board__slot--leave board__slot--leave-${goes}` : '')
              }
              onClick={() => handleField(id)}
              // Tappable either as a capture target or, with nothing forward,
              // to ask what the card is.
              disabled={Boolean(goes) || (selected ? !isTarget : false)}
              aria-hidden={Boolean(goes)}
              aria-label={`${getCard(id).name}, ${getCard(id).suit}`}
            >
              <CardFace id={id} width={56} eager />
            </button>
          );
        })}

        {order.length === 0 && <p className="board__fieldEmpty">The field is clear</p>}

        {/* The card in flight, overlaid so it costs the field no height. */}
        {pending && (
          <div className="board__flight board__flight--pending">
            <CardFace id={pending.card} width={44} eager />
            <span>Pick one</span>
          </div>
        )}
        {!pending && drawn && (
          <div className="board__flight">
            <CardFace id={drawn} width={44} eager />
            <span>Drawn</span>
          </div>
        )}
      </div>

      <Hand
        cards={myHand}
        matchCounts={matchCounts}
        canAct={canAct && round.phase === 'play'}
        selected={selected}
        onSelect={onSelect}
      />
    </div>
  );
}

/** Must match the animation durations in the stylesheet. */
const ENTER_MS = 440;
const LEAVE_MS = 418;

interface FieldAnimation {
  /** Field cards plus any still animating out, in stable display order. */
  order: CardId[];
  arriving: ReadonlySet<CardId>;
  leaving: ReadonlyMap<CardId, 'up' | 'down'>;
}

/**
 * Tracks cards entering and leaving the field.
 *
 * The engine hands over a flat list with no history, so both are derived by
 * diffing against the previous render. Departing cards are held in the layout
 * for the length of their animation and rendered in their old position —
 * without that they vanish instantly and the field reflows underneath, which
 * is exactly the jump that made captures hard to follow.
 *
 * The display order is state rather than something recomputed during render.
 * Deriving it inline drops a captured card on the very render the engine
 * removes it — before the effect has had any chance to mark it as leaving —
 * so the animation never gets a frame to run in.
 *
 * `useLayoutEffect` matters too: it runs before paint, so the departing card
 * is still on screen for the frame in which its animation starts.
 */
function useFieldAnimation(field: readonly CardId[], direction: 'up' | 'down'): FieldAnimation {
  const previous = useRef<readonly CardId[]>(field);
  const [order, setOrder] = useState<CardId[]>(() => [...field]);
  const [arriving, setArriving] = useState<ReadonlySet<CardId>>(new Set());
  const [leaving, setLeaving] = useState<ReadonlyMap<CardId, 'up' | 'down'>>(new Map());

  useLayoutEffect(() => {
    const before = previous.current;
    const beforeSet = new Set(before);
    const nowSet = new Set(field);

    const fresh = field.filter((id) => !beforeSet.has(id));
    const gone = before.filter((id) => !nowSet.has(id));
    previous.current = field;

    if (fresh.length === 0 && gone.length === 0) {
      // Order can still differ (e.g. a fresh deal), so resync.
      setOrder((current) =>
        current.length === field.length && current.every((id, i) => id === field[i])
          ? current
          : [...field],
      );
      return;
    }

    const goneSet = new Set(gone);
    setOrder((current) => {
      const kept = current.filter((id) => nowSet.has(id) || goneSet.has(id));
      const missing = field.filter((id) => !kept.includes(id));
      return [...kept, ...missing];
    });

    const timers: ReturnType<typeof setTimeout>[] = [];

    if (fresh.length > 0) {
      setArriving(new Set(fresh));
      timers.push(setTimeout(() => setArriving(new Set()), ENTER_MS));
    }

    if (gone.length > 0) {
      // Merge, so a second capture while one is still animating does not
      // cancel the first.
      setLeaving((current) => {
        const next = new Map(current);
        for (const id of gone) next.set(id, direction);
        return next;
      });
      timers.push(
        setTimeout(() => {
          setLeaving((current) => {
            const next = new Map(current);
            for (const id of gone) next.delete(id);
            return next;
          });
          setOrder((current) => current.filter((id) => !goneSet.has(id)));
        }, LEAVE_MS),
      );
    }

    return () => timers.forEach(clearTimeout);
  }, [field, direction]);

  return { order, arriving, leaving };
}
