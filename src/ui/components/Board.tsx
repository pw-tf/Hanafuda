/**
 * The playing surface: opponent's hand, the field, the draw pile, your hand.
 *
 * Interaction is two-stage. Sliding across the fan browses; tapping pulls a
 * card forward onto the table. Once a card is forward, the field cards it can
 * take light up — tap one to capture. If it can take nothing, the table itself
 * becomes the target and tapping it discards.
 *
 * The ambiguous two-match case therefore needs no special modal: it is just
 * the normal "two things lit up, pick one" flow.
 */

import { useEffect, useRef, useState } from 'react';
import { getCard, type CardId } from '../../engine/cards';
import { matchesFor, type GameState, type PlayerIndex } from '../../engine/game';
import { CardBack, CardFace } from '../../art/CardFace';
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
}

export function Board({ state, seat, canAct, selected, onSelect, onPlay, onChooseTarget }: BoardProps) {
  const round = state.roundState;
  const opponent: PlayerIndex = seat === 0 ? 1 : 0;
  const myHand = round.players[seat].hand;
  const theirHand = round.players[opponent].hand;

  const choosing = round.phase === 'choose-hand-target' || round.phase === 'choose-draw-target';
  const choiceOptions = new Set(choosing ? (round.pending?.options ?? []) : []);

  const selectedMatches = selected ? matchesFor(selected, round.field) : [];
  const selectableTargets = new Set(selectedMatches);
  /** A forward card with nowhere to go is discarded by tapping the table. */
  const discardArmed = Boolean(selected) && selectedMatches.length === 0;

  const matchCounts = new Map<CardId, number>(
    myHand.map((id) => [id, matchesFor(id, round.field).length]),
  );

  const handleField = (id: CardId) => {
    if (choosing && choiceOptions.has(id)) {
      onChooseTarget(id);
      return;
    }
    if (selected && selectableTargets.has(id)) onPlay(selected);
  };

  const pending = round.pending;
  const drawn = round.trace.drawnCard;

  // Cards that have just arrived on the field, so they can slide in from the
  // direction they were played from rather than blinking into existence.
  const arriving = useArrivals(round.field);

  return (
    <div className="board">
      {/* Opponent's hand, face down. */}
      <div className="board__oppHand" aria-label={`Opponent holds ${theirHand.length} cards`}>
        {theirHand.map((id, i) => (
          <span key={id} className="board__oppCard" style={{ marginLeft: i === 0 ? 0 : '-1.5rem' }}>
            <CardBack width={30} />
          </span>
        ))}
      </div>

      {/* The field. */}
      <div
        className={`board__field${discardArmed ? ' board__field--discard' : ''}`}
        onClick={discardArmed && selected ? () => onPlay(selected) : undefined}
      >
        {round.field.map((id) => {
          const isTarget = selectableTargets.has(id) || choiceOptions.has(id);
          return (
            <button
              key={id}
              type="button"
              className={
                'board__slot' +
                (isTarget ? ' board__slot--target' : '') +
                (arriving.has(id) ? ' board__slot--enter' : '')
              }
              onClick={() => handleField(id)}
              disabled={!isTarget}
              aria-label={`${getCard(id).name}, ${getCard(id).suit}`}
            >
              <CardFace id={id} width={56} eager />
            </button>
          );
        })}
        {round.field.length === 0 && <p className="board__fieldEmpty">The field is clear</p>}
      </div>

      {/* Draw pile and the card currently in flight. */}
      <div className="board__deck">
        <div className="board__deckStack">
          <CardBack width={40} />
          <span className="board__deckCount">{round.deck.length}</span>
        </div>
        <div className="board__flight">
          {pending && (
            <div className="board__flightCard board__flightCard--pending">
              <CardFace id={pending.card} width={44} eager />
              <span>Pick one</span>
            </div>
          )}
          {!pending && drawn && (
            <div className="board__flightCard">
              <CardFace id={drawn} width={44} eager />
              <span>Drawn</span>
            </div>
          )}
        </div>
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

/**
 * Tracks which field cards are new since the previous render.
 *
 * The engine hands us a flat list of field cards with no history, so "did this
 * card just land?" has to be derived by diffing against the last list. The
 * arrival flag is cleared on a timer so the animation runs once and the card
 * then sits still.
 */
function useArrivals(field: readonly CardId[]): ReadonlySet<CardId> {
  const previous = useRef<readonly CardId[]>(field);
  const [arriving, setArriving] = useState<ReadonlySet<CardId>>(new Set());

  useEffect(() => {
    const before = new Set(previous.current);
    const fresh = field.filter((id) => !before.has(id));
    previous.current = field;
    if (fresh.length === 0) return;

    setArriving(new Set(fresh));
    const timer = setTimeout(() => setArriving(new Set()), ENTER_MS);
    return () => clearTimeout(timer);
  }, [field]);

  return arriving;
}

/** Must match the `card-land` animation duration in the stylesheet. */
const ENTER_MS = 420;
