/**
 * The score guide: every yaku, what it is worth, and which cards make it.
 *
 * Point values come from the active `RuleConfig`, never a hardcoded table —
 * the game ships two published scoring presets that disagree on the Brights,
 * so a fixed list here would quietly lie to half the players.
 *
 * The card pictures matter more than the names. "Ino-Shika-Cho" means nothing
 * to a new player; three specific cards laid out side by side is the whole
 * explanation.
 */

import { CARD_IDS, DECK, type CardId } from '../../engine/cards';
import { YAKU_INFO, type RuleConfig, type YakuId } from '../../engine/rules';
import { CardFace } from '../../art/CardFace';

const byKind = (kind: string): CardId[] => DECK.filter((c) => c.kind === kind).map((c) => c.id);
const byRibbon = (ribbon: string): CardId[] =>
  DECK.filter((c) => c.ribbon === ribbon).map((c) => c.id);
const monthCards = (month: number): CardId[] =>
  DECK.filter((c) => c.month === month).map((c) => c.id);

const BRIGHTS = byKind('hikari');
const NON_RAIN = BRIGHTS.filter((id) => id !== CARD_IDS.RAIN_MAN);

interface Row {
  id: YakuId;
  points: string;
  /** Cards that illustrate the combination. */
  cards: CardId[];
  /** True when the combination is "any N of a type" and these are examples. */
  examples?: boolean;
}

function groupsFor(rules: RuleConfig): { group: string; note?: string; rows: Row[] }[] {
  const p = rules.points;
  const each = (base: number, threshold: number) => `${base} at ${threshold}, +1 each`;

  const groups: { group: string; note?: string; rows: Row[] }[] = [
    {
      group: 'Brights',
      note: 'Only the highest of these counts — they do not stack with each other.',
      rows: [
        { id: 'goko', points: String(p.goko), cards: BRIGHTS },
        { id: 'shiko', points: String(p.shiko), cards: NON_RAIN },
        {
          id: 'ame-shiko',
          points: String(p.ameShiko),
          cards: [...NON_RAIN.slice(0, 3), CARD_IDS.RAIN_MAN],
        },
        { id: 'sanko', points: String(p.sanko), cards: NON_RAIN.slice(0, 3) },
      ],
    },
    {
      group: 'Named combinations',
      note: 'These all stack with each other and with the counting yaku below.',
      rows: [
        {
          id: 'ino-shika-cho',
          points: String(p.inoShikaCho),
          cards: [CARD_IDS.BOAR, CARD_IDS.DEER, CARD_IDS.BUTTERFLIES],
        },
        {
          id: 'hanami-zake',
          points: String(p.hanamiZake),
          cards: [CARD_IDS.CURTAIN, CARD_IDS.SAKE_CUP],
        },
        {
          id: 'tsukimi-zake',
          points: String(p.tsukimiZake),
          cards: [CARD_IDS.MOON, CARD_IDS.SAKE_CUP],
        },
        { id: 'akatan', points: String(p.akatan), cards: byRibbon('red-poetry') },
        { id: 'aotan', points: String(p.aotan), cards: byRibbon('blue') },
      ],
    },
    {
      group: 'By the card',
      note: 'Any cards of the type — these are just examples.',
      rows: [
        {
          id: 'tane',
          points: each(p.taneBase, rules.taneThreshold),
          cards: byKind('tane').slice(0, 5),
          examples: true,
        },
        {
          id: 'tanzaku',
          points: each(p.tanzakuBase, rules.tanzakuThreshold),
          cards: byKind('tanzaku').slice(0, 5),
          examples: true,
        },
        {
          id: 'kasu',
          points: each(p.kasuBase, rules.kasuThreshold),
          cards: byKind('kasu').slice(0, 6),
          examples: true,
        },
      ],
    },
  ];

  const optional: Row[] = [];
  if (rules.teyakuEnabled) {
    optional.push(
      { id: 'teshi', points: String(p.teshi), cards: monthCards(1), examples: true },
      {
        id: 'kuttsuki',
        points: String(p.kuttsuki),
        cards: [...monthCards(1).slice(0, 2), ...monthCards(3).slice(0, 2)],
        examples: true,
      },
    );
  }
  if (rules.tsukiFudaEnabled) {
    optional.push({ id: 'tsuki-fuda', points: String(p.tsukiFuda), cards: monthCards(3), examples: true });
  }
  if (optional.length > 0) {
    groups.push({
      group: 'Optional rules in play',
      note: 'Turned on in Settings. Hand yaku are checked at the deal and end the round at once. Any month works — the cards below are one example each.',
      rows: optional,
    });
  }

  return groups;
}

export function ScoreSheet({ rules }: { rules: RuleConfig }) {
  const groups = groupsFor(rules);

  return (
    <div className="score">
      <p className="score__preset">
        Scoring table: <b>{rules.label}</b>
      </p>

      {groups.map((g) => (
        <section key={g.group} className="score__group">
          <h4>{g.group}</h4>
          {g.note && <p className="score__note">{g.note}</p>}
          <ul>
            {g.rows.map((row) => (
              <li key={row.id}>
                <div className="score__head">
                  <span className="score__name">
                    {YAKU_INFO[row.id].name} <em>{YAKU_INFO[row.id].nameJa}</em>
                  </span>
                  <b className="score__pts">{row.points}</b>
                </div>
                <p className="score__desc">{YAKU_INFO[row.id].description}</p>
                <div className="score__cards">
                  {row.cards.map((id) => (
                    <CardFace key={id} id={id} width={34} />
                  ))}
                  {row.examples && <span className="score__more">…</span>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="score__group">
        <h4>Multipliers</h4>
        <ul>
          <li>
            <div className="score__head">
              <span className="score__name">Big hand</span>
              <b className="score__pts">
                ×{rules.sevenPointMultiplier} at {rules.sevenPointThreshold}+
              </b>
            </div>
            <p className="score__desc">
              Applied to the raw yaku total, before any other multiplier.
            </p>
          </li>
          <li>
            <div className="score__head">
              <span className="score__name">Koi-Koi</span>
              <b className="score__pts">
                {rules.koiKoiMultiplierMode === 'sum' ? '+1 each' : '×2'}
              </b>
            </div>
            <p className="score__desc">
              {rules.koiKoiMultiplierMode === 'sum'
                ? 'Every koi-koi called this round, by either player, adds one.'
                : 'Doubles only if your opponent called koi-koi.'}
            </p>
          </li>
        </ul>
        <p className="score__formula">
          total = base × ({rules.sevenPointThreshold}+ ? ×{rules.sevenPointMultiplier} : ×1) × koi-koi
        </p>
      </section>
    </div>
  );
}
