/**
 * A player's captured cards, grouped by category with counts — the numbers a
 * player actually needs to track yaku progress.
 */

import { getCard, type CardId, type CardKind } from '../../engine/cards';
import { CardFace } from '../../art/CardFace';

const ORDER: CardKind[] = ['hikari', 'tane', 'tanzaku', 'kasu'];

const LABEL: Record<CardKind, string> = {
  hikari: 'Bright',
  tane: 'Animal',
  tanzaku: 'Ribbon',
  kasu: 'Chaff',
};

export function CapturePile({
  cards,
  compact = false,
  highlight,
}: {
  cards: readonly CardId[];
  compact?: boolean;
  /** Card ids to emphasise, e.g. the cards making up a scoring yaku. */
  highlight?: ReadonlySet<CardId>;
}) {
  const groups = ORDER.map((kind) => ({
    kind,
    cards: cards.filter((id) => getCard(id).kind === kind),
  })).filter((g) => g.cards.length > 0);

  if (groups.length === 0) {
    return <p className="pile__empty">No cards captured yet</p>;
  }

  return (
    <div className={`pile ${compact ? 'pile--compact' : ''}`}>
      {groups.map((group) => (
        <div key={group.kind} className="pile__group">
          <span className="pile__label">
            {LABEL[group.kind]} <b>{group.cards.length}</b>
          </span>
          <div className="pile__cards">
            {group.cards.map((id, i) => (
              <span
                key={id}
                className={`pile__card ${highlight?.has(id) ? 'pile__card--lit' : ''}`}
                style={{ marginLeft: i === 0 ? 0 : compact ? '-1.5rem' : '-1.1rem' }}
              >
                <CardFace id={id} width={compact ? 30 : 40} />
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
