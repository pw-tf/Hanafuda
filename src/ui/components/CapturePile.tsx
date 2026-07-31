/**
 * Captured cards.
 *
 * `PileSummary` is the on-table representation: a fixed-height button, so the
 * capture piles can never grow and squeeze the playing field. The full pile
 * lives behind it in a sheet, via `CapturePile`.
 */

import { getCard, type CardId, type CardKind, type Month } from '../../engine/cards';
import { CardBack, CardFace } from '../../art/CardFace';
import type { RuleConfig } from '../../engine/rules';
import { evaluateYaku } from '../../engine/yaku';
import { plural } from '../text';

const ORDER: CardKind[] = ['hikari', 'tane', 'tanzaku', 'kasu'];

const LABEL: Record<CardKind, string> = {
  hikari: 'Bright',
  tane: 'Animal',
  tanzaku: 'Ribbon',
  kasu: 'Chaff',
};

const SHORT: Record<CardKind, string> = {
  hikari: 'B',
  tane: 'A',
  tanzaku: 'R',
  kasu: 'C',
};

function countByKind(cards: readonly CardId[]): Array<{ kind: CardKind; n: number }> {
  return ORDER.map((kind) => ({ kind, n: cards.filter((id) => getCard(id).kind === kind).length })).filter(
    (g) => g.n > 0,
  );
}

/**
 * One fixed-height row per player. Height must not depend on how many cards
 * have been captured — that was what made the field shrink turn by turn.
 */
export function PileSummary({
  name,
  cards,
  rules,
  month,
  koiKoiCalls,
  active,
  stack,
  onOpen,
}: {
  name: string;
  cards: readonly CardId[];
  rules: RuleConfig;
  /** The round's month, so the optional Tsuki-fuda rule is counted. */
  month: Month;
  koiKoiCalls: number;
  /** True when it is this player's turn. */
  active?: boolean;
  /**
   * A face-down pile to show on the left — the opponent's hand, or the draw
   * pile. These used to sit above and below the field as full rows of card
   * backs, which cost the table a lot of height for two numbers.
   */
  stack?: { count: number; label: string };
  onOpen(): void;
}) {
  const groups = countByKind(cards);
  const { base } = evaluateYaku(cards, rules, month);

  return (
    <button
      type="button"
      className={`summary${active ? ' summary--active' : ''}`}
      onClick={onOpen}
      aria-label={`${name}: ${plural(cards.length, 'card')} captured, ${plural(base, 'point')}. Open details.`}
    >
      {stack && (
        <span className="summary__stack" title={`${stack.label}: ${stack.count}`}>
          <CardBack width={20} />
          <b aria-label={`${stack.label}: ${stack.count}`}>{stack.count}</b>
        </span>
      )}

      <span className="summary__name">{name}</span>

      {koiKoiCalls > 0 && <span className="summary__koi">Koi-Koi ×{koiKoiCalls}</span>}

      <span className="summary__counts">
        {groups.length === 0 ? (
          <em>no captures</em>
        ) : (
          groups.map((g) => (
            <span key={g.kind} className={`summary__chip summary__chip--${g.kind}`}>
              <i>{SHORT[g.kind]}</i>
              {g.n}
            </span>
          ))
        )}
      </span>

      <span className={`summary__pts${base > 0 ? ' summary__pts--on' : ''}`}>{base}</span>
      <span className="summary__more" aria-hidden="true">
        ›
      </span>
    </button>
  );
}

/** The full pile, grouped by category. Shown inside a sheet. */
export function CapturePile({
  cards,
  highlight,
}: {
  cards: readonly CardId[];
  /** Card ids to emphasise, e.g. those making up a scoring yaku. */
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
    <div className="pile">
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
                style={{ marginLeft: i === 0 ? 0 : '-1.1rem' }}
              >
                <CardFace id={id} width={44} />
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
