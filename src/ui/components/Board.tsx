/**
 * The playing surface: the field, the draw pile, the two hands.
 *
 * Interaction is deliberately two-tap. Tapping a hand card selects it and
 * lights up the field cards it can take; tapping one of those confirms. That
 * makes the ambiguous two-match case a normal part of the flow rather than a
 * special modal, and it suits a phone far better than drag and drop.
 */

import { getCard, type CardId } from '../../engine/cards';
import { matchesFor, type GameState, type PlayerIndex } from '../../engine/game';
import { CardBack, CardFace } from '../../art/CardFace';

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
  const choiceOptions = new Set(choosing ? round.pending?.options ?? [] : []);

  // Field cards the selected hand card could take.
  const selectableTargets = new Set(selected ? matchesFor(selected, round.field) : []);

  const handleField = (id: CardId) => {
    if (choosing && choiceOptions.has(id)) {
      onChooseTarget(id);
      return;
    }
    if (selected && selectableTargets.has(id)) {
      onPlay(selected);
    }
  };

  const handleHand = (id: CardId) => {
    if (!canAct || round.phase !== 'play') return;
    if (selected === id) {
      // Second tap on a card with no matches discards it to the field.
      if (matchesFor(id, round.field).length === 0) onPlay(id);
      else onSelect(null);
      return;
    }
    onSelect(id);
  };

  const pending = round.pending;
  const drawn = round.trace.drawnCard;

  return (
    <div className="board">
      {/* Opponent's hand, face down. */}
      <div className="board__oppHand" aria-label={`Opponent holds ${theirHand.length} cards`}>
        {theirHand.map((id, i) => (
          <span key={id} className="board__oppCard" style={{ marginLeft: i === 0 ? 0 : '-1.6rem' }}>
            <CardBack width={34} />
          </span>
        ))}
      </div>

      {/* The field. */}
      <div className="board__field">
        {round.field.map((id) => {
          const isTarget = selectableTargets.has(id) || choiceOptions.has(id);
          return (
            <button
              key={id}
              type="button"
              className={`board__slot ${isTarget ? 'board__slot--target' : ''}`}
              onClick={() => handleField(id)}
              disabled={!isTarget}
              aria-label={`${getCard(id).name}, ${getCard(id).suit}`}
            >
              <CardFace id={id} width={52} />
            </button>
          );
        })}
        {round.field.length === 0 && <p className="board__fieldEmpty">The field is clear</p>}
      </div>

      {/* Draw pile and the card currently in flight. */}
      <div className="board__deck">
        <div className="board__deckStack">
          <CardBack width={44} />
          <span className="board__deckCount">{round.deck.length}</span>
        </div>
        <div className="board__flight">
          {pending && (
            <div className="board__flightCard board__flightCard--pending">
              <CardFace id={pending.card} width={48} />
              <span>Pick one</span>
            </div>
          )}
          {!pending && drawn && (
            <div className="board__flightCard">
              <CardFace id={drawn} width={48} />
              <span>Drawn</span>
            </div>
          )}
        </div>
      </div>

      {/* Your hand. */}
      <div className="board__hand">
        {myHand.map((id) => {
          const matches = matchesFor(id, round.field).length;
          return (
            <button
              key={id}
              type="button"
              className={`board__handCard ${selected === id ? 'board__handCard--sel' : ''}`}
              onClick={() => handleHand(id)}
              disabled={!canAct || round.phase !== 'play'}
            >
              <CardFace id={id} width={62} />
              {matches > 0 && <span className="board__matchDot">{matches}</span>}
            </button>
          );
        })}
        {myHand.length === 0 && <p className="board__handEmpty">Hand empty</p>}
      </div>
    </div>
  );
}
