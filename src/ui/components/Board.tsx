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

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getCard, type CardId } from '../../engine/cards';
import { matchesFor, type GameState, type PlayerIndex } from '../../engine/game';
import { CardFace } from '../../art/CardFace';
import {
  fieldKey,
  initialField,
  nextFieldDeadline,
  reconcileField,
  sweepField,
  type FieldAnimation,
} from '../fieldAnimation';
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

  /** Whether the card that is forward can actually be put down right now. */
  const canPlay = canAct && round.phase === 'play';

  /**
   * Whether the fan answers at all.
   *
   * Wider than `canPlay` on purpose: while the opponent is playing, or while
   * the Koi-Koi decision is open, you can still slide through your hand, pull
   * a card forward and read what it is. None of that touches the state. It is
   * only shut off where a tap on the fan would fight the tap the game is
   * actually waiting for — picking which of two field cards to take — or where
   * there is no live hand to browse.
   */
  const canBrowse = round.phase !== 'round-end' && !choosing;

  const selectedMatches = selected ? matchesFor(selected, round.field) : [];
  const selectableTargets = new Set(selectedMatches);
  /**
   * A forward card with nowhere to go is discarded by tapping the table — but
   * only on your own turn. Out of turn the table is just the table, or a card
   * held ready while the opponent thinks would be thrown away by a stray tap.
   */
  const discardArmed = canPlay && Boolean(selected) && selectedMatches.length === 0;

  const matchCounts = new Map<CardId, number>(
    myHand.map((id) => [id, matchesFor(id, round.field).length]),
  );

  /**
   * A tap on the table means capture while a card is forward *and* it is your
   * turn, and "what is this?" the rest of the time. Keeping those apart is
   * what stops the info panel from ever getting in the way of a move — and it
   * is what lets the field stay readable out of turn, where the lit cards are
   * a preview of what the held card would take rather than a live target.
   */
  const handleField = (id: CardId) => {
    if (choosing && choiceOptions.has(id)) {
      onChooseTarget(id);
      return;
    }
    if (selected && canPlay) {
      if (selectableTargets.has(id)) onPlay(selected);
      return;
    }
    onInspect(id);
  };

  const pending = round.pending;
  const drawn = round.trace.drawnCard;

  /**
   * A flipped card that took something never touches the field, so without
   * this it would go from the deck to a capture pile with nothing drawn in
   * between — the whole second half of the turn happening invisibly. A flip
   * that takes nothing needs no overlay: it lands on the field, and the field's
   * own arrival animation already slides it up from the deck's side.
   */
  const deckCapture = round.trace.drawnCaptured.length > 0;
  const flight = useDrawFlight(pending ? null : drawn, deckCapture);

  // Captures are made by whoever is on turn, so a card leaving the field
  // travels towards their side of the table. `trace.player` is the player who
  // just acted, which after a deck capture is no longer the player on turn.
  const captureDirection = round.trace.player === seat ? 'down' : 'up';

  // Cards taken by the flip wait for the flipped card to arrive, so the pair
  // leaves together instead of the field card vanishing on its own.
  const { order, arriving, leaving } = useFieldAnimation(
    round.field,
    captureDirection,
    deckCapture ? FLIGHT_RISE_MS + FLIGHT_HOLD_MS : 0,
  );

  return (
    <div className="board">
      <div
        className={
          'board__field' +
          (discardArmed ? ' board__field--discard' : '') +
          // Lit cards out of turn are "this is what it would take", so they
          // are drawn back from the solid gold that means "tap me".
          (selected && !canPlay ? ' board__field--preview' : '')
        }
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
                (goes ? ` board__slot--leave board__slot--leave-${goes.direction}` : '')
              }
              // Held still until the flipped card has risen from the deck.
              style={goes && goes.delay > 0 ? { animationDelay: `${goes.delay}ms` } : undefined}
              onClick={() => handleField(id)}
              // Tappable either as a capture target or, when no move can
              // follow the tap, to ask what the card is.
              disabled={Boolean(goes) || (selected && canPlay ? !isTarget : false)}
              aria-hidden={Boolean(goes)}
              aria-label={`${getCard(id).name}, ${getCard(id).suit}`}
            >
              <CardFace id={id} width={56} eager />
            </button>
          );
        })}

        {order.length === 0 && <p className="board__fieldEmpty">The field is clear</p>}

        {/* Overlaid rather than given a row, so it costs the field no height. */}
        {pending && (
          <div className="board__flight board__flight--pending">
            <CardFace id={pending.card} width={44} eager />
            <span>Pick one</span>
          </div>
        )}
        {flight && (
          <div
            className={
              'board__flight board__flight--draw' +
              ` board__flight--${flight.stage}` +
              (flight.stage === 'out' ? ` board__flight--out-${captureDirection}` : '')
            }
          >
            <CardFace id={flight.card} width={52} eager />
            <span>From the deck</span>
          </div>
        )}
      </div>

      <Hand
        cards={myHand}
        matchCounts={matchCounts}
        canPlay={canPlay}
        canBrowse={canBrowse}
        selected={selected}
        onSelect={onSelect}
      />
    </div>
  );
}

const FLIGHT_RISE_MS = 320;
const FLIGHT_HOLD_MS = 450;
const FLIGHT_LEAVE_MS = 418;

interface DrawFlight {
  card: CardId;
  /** Rising from the deck, or travelling on to the capture pile. */
  stage: 'in' | 'out';
}

/**
 * The flipped card's journey: up from the deck, a beat to read it, then away
 * to the pile of whoever flipped it.
 *
 * Driven off the card's identity rather than a phase, because the flip and the
 * hand-over happen on the same move — by the time this renders, the turn has
 * already passed and there is no phase left that means "a card was just
 * flipped". The trace outlives the turn precisely so this can work.
 */
function useDrawFlight(drawn: CardId | null, captured: boolean): DrawFlight | null {
  const [flight, setFlight] = useState<DrawFlight | null>(null);
  const shown = useRef<CardId | null>(null);

  useEffect(() => {
    if (drawn === null) {
      // The next turn started. Clear the overlay rather than leaving it to its
      // timers: this effect's cleanup cancels them, so a trace that reset
      // mid-flight would strand the card in the middle of the table for the
      // rest of the round. Also lets the same card animate again in a later
      // round.
      shown.current = null;
      setFlight(null);
      return;
    }
    if (!captured || drawn === shown.current) return;
    shown.current = drawn;

    setFlight({ card: drawn, stage: 'in' });
    const only = (fn: (f: DrawFlight | null) => DrawFlight | null) =>
      setFlight((f) => (f && f.card === drawn ? fn(f) : f));

    const timers = [
      setTimeout(() => only(() => ({ card: drawn, stage: 'out' })), FLIGHT_RISE_MS + FLIGHT_HOLD_MS),
      setTimeout(
        () => only(() => null),
        FLIGHT_RISE_MS + FLIGHT_HOLD_MS + FLIGHT_LEAVE_MS,
      ),
    ];
    return () => timers.forEach(clearTimeout);
  }, [drawn, captured]);

  return flight;
}

/**
 * Drives the field's enter/leave bookkeeping.
 *
 * All of the state lives in `fieldAnimation.ts`, which expresses "this card
 * may leave the layout at time T" as a deadline rather than a timer. The
 * component only has to keep one timer pointed at the next deadline, and if
 * that timer is ever cancelled — by a re-render, a prop change, anything — the
 * deadline is still in the state and the next sweep honours it.
 *
 * `useLayoutEffect` matters: it runs before paint, so a departing card is
 * still on screen for the frame in which its animation starts.
 */
function useFieldAnimation(
  field: readonly CardId[],
  direction: 'up' | 'down',
  leaveDelay = 0,
): FieldAnimation {
  const [animation, setAnimation] = useState(() => initialField(field));
  const key = fieldKey(field);

  useLayoutEffect(() => {
    setAnimation((previous) => reconcileField(previous, field, direction, leaveDelay, Date.now()));
    // Keyed on the field's *contents*, not the array. A guest rebuilds its
    // state from JSON on every snapshot, so the array is new each time even
    // when the same cards are on the table; diffing that against itself is
    // pure churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, direction, leaveDelay]);

  const deadline = nextFieldDeadline(animation);
  useEffect(() => {
    if (deadline === null) return;
    const timer = setTimeout(
      () => setAnimation((previous) => sweepField(previous, Date.now())),
      Math.max(0, deadline - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [deadline]);

  return animation;
}
