/**
 * What a card actually is: month, plant, category, and the yaku it feeds.
 *
 * Hanafuda gives a beginner almost nothing to go on — the artwork carries the
 * suit, and nothing on the card states its category or worth. This is the
 * panel that answers "what am I holding".
 *
 * It is fixed above the status bar rather than inline, so it costs the field
 * no height, and it never covers the table: when a hand card is forward you
 * still need to reach a lit field card to capture it.
 */

import { getCard, MONTH_NAMES, type CardId } from '../../engine/cards';
import { YAKU_INFO, type RuleConfig } from '../../engine/rules';
import { yakuForCard } from '../../engine/yaku';
import { CardFace } from '../../art/CardFace';

const KIND_LABEL = {
  hikari: 'Bright',
  tane: 'Animal',
  tanzaku: 'Ribbon',
  kasu: 'Chaff',
} as const;

const RIBBON_LABEL = {
  'red-poetry': 'poetry ribbon',
  'red-plain': 'plain ribbon',
  blue: 'blue ribbon',
} as const;

export function CardInfo({
  id,
  rules,
  onClose,
}: {
  id: CardId;
  rules: RuleConfig;
  onClose(): void;
}) {
  const card = getCard(id);
  const yaku = yakuForCard(id, rules);

  return (
    <aside className="cardinfo" role="status" aria-live="polite">
      <CardFace id={id} width={46} eager />

      <div className="cardinfo__text">
        <p className="cardinfo__name">
          {card.name} <em>{card.nameJa}</em>
        </p>
        <p className="cardinfo__meta">
          {MONTH_NAMES[card.month]} · {card.suit} <em>{card.suitJa}</em>
        </p>
        <p className="cardinfo__meta">
          <b className={`cardinfo__kind cardinfo__kind--${card.kind}`}>{KIND_LABEL[card.kind]}</b>
          {card.ribbon ? ` · ${RIBBON_LABEL[card.ribbon]}` : ''} · {card.points} pts
        </p>
        {yaku.length > 0 && (
          <p className="cardinfo__yaku">
            {yaku.map((y) => (
              <span key={y} title={YAKU_INFO[y].description}>
                {YAKU_INFO[y].name}
              </span>
            ))}
          </p>
        )}
      </div>

      <button type="button" className="cardinfo__close" onClick={onClose} aria-label="Close card info">
        ×
      </button>
    </aside>
  );
}
