/**
 * The scoring reference: every yaku and what it is worth.
 *
 * Values come from the active `RuleConfig`, never from a hardcoded table —
 * the game ships two published scoring presets that disagree on the Brights,
 * so a fixed list here would quietly lie to half the players.
 */

import { YAKU_INFO, type RuleConfig, type YakuId } from '../../engine/rules';

interface Row {
  id: YakuId;
  points: string;
}

function rowsFor(rules: RuleConfig): { group: string; rows: Row[] }[] {
  const p = rules.points;
  const each = (base: number, threshold: number) => `${base} at ${threshold}, +1 each extra`;

  const groups: { group: string; rows: Row[] }[] = [
    {
      group: 'Brights — only the highest counts',
      rows: [
        { id: 'goko', points: String(p.goko) },
        { id: 'shiko', points: String(p.shiko) },
        { id: 'ame-shiko', points: String(p.ameShiko) },
        { id: 'sanko', points: String(p.sanko) },
      ],
    },
    {
      group: 'Named combinations',
      rows: [
        { id: 'ino-shika-cho', points: String(p.inoShikaCho) },
        { id: 'hanami-zake', points: String(p.hanamiZake) },
        { id: 'tsukimi-zake', points: String(p.tsukimiZake) },
        { id: 'akatan', points: String(p.akatan) },
        { id: 'aotan', points: String(p.aotan) },
      ],
    },
    {
      group: 'By the card',
      rows: [
        { id: 'tane', points: each(p.taneBase, rules.taneThreshold) },
        { id: 'tanzaku', points: each(p.tanzakuBase, rules.tanzakuThreshold) },
        { id: 'kasu', points: each(p.kasuBase, rules.kasuThreshold) },
      ],
    },
  ];

  const optional: Row[] = [];
  if (rules.teyakuEnabled) {
    optional.push({ id: 'teshi', points: String(p.teshi) }, { id: 'kuttsuki', points: String(p.kuttsuki) });
  }
  if (rules.tsukiFudaEnabled) optional.push({ id: 'tsuki-fuda', points: String(p.tsukiFuda) });
  if (optional.length > 0) groups.push({ group: 'Optional rules in play', rows: optional });

  return groups;
}

export function ScoreSheet({ rules }: { rules: RuleConfig }) {
  const groups = rowsFor(rules);

  return (
    <div className="score">
      <p className="score__preset">
        Scoring table: <b>{rules.label}</b>
      </p>

      {groups.map((g) => (
        <section key={g.group} className="score__group">
          <h4>{g.group}</h4>
          <ul>
            {g.rows.map((row) => (
              <li key={row.id}>
                <span className="score__name">
                  {YAKU_INFO[row.id].name} <em>{YAKU_INFO[row.id].nameJa}</em>
                  <small>{YAKU_INFO[row.id].description}</small>
                </span>
                <b className="score__pts">{row.points}</b>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="score__group">
        <h4>Multipliers</h4>
        <ul>
          <li>
            <span className="score__name">
              Big hand
              <small>Applied to the raw yaku total, before any other multiplier</small>
            </span>
            <b className="score__pts">
              ×{rules.sevenPointMultiplier} at {rules.sevenPointThreshold}+
            </b>
          </li>
          <li>
            <span className="score__name">
              Koi-Koi
              <small>
                {rules.koiKoiMultiplierMode === 'sum'
                  ? 'Every koi-koi called this round, by either player, adds one'
                  : 'Doubles only if your opponent called koi-koi'}
              </small>
            </span>
            <b className="score__pts">
              {rules.koiKoiMultiplierMode === 'sum' ? '+1 each' : '×2'}
            </b>
          </li>
        </ul>
        <p className="score__formula">
          total = base × ({rules.sevenPointThreshold}+ ? ×{rules.sevenPointMultiplier} : ×1) × koi-koi
        </p>
      </section>
    </div>
  );
}
