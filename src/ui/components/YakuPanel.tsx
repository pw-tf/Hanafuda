/**
 * Live yaku progress. Shows what a player has completed and how close they are
 * to the rest, so the scoring is never a mystery mid-round.
 */

import { CARD_IDS, getCard, type CardId, type Month } from '../../engine/cards';
import type { RuleConfig, YakuId } from '../../engine/rules';
import { YAKU_INFO } from '../../engine/rules';
import { countCaptures, evaluateYaku } from '../../engine/yaku';

interface Progress {
  id: YakuId;
  points: number;
  have: number;
  need: number;
  complete: boolean;
}

/** Progress toward every yaku that is currently reachable. */
function computeProgress(
  captured: readonly CardId[],
  rules: RuleConfig,
  month: Month,
): Progress[] {
  const counts = countCaptures(captured, rules);
  const ids = counts.ids;
  const scored = new Map(evaluateYaku(captured, rules, month).yaku.map((y) => [y.id, y.points]));

  const held = (required: readonly CardId[]) => required.filter((id) => ids.has(id)).length;

  const rows: Progress[] = [];
  const add = (id: YakuId, have: number, need: number, points: number) => {
    rows.push({ id, points: scored.get(id) ?? points, have, need, complete: scored.has(id) });
  };

  /*
   * Only the highest reachable Brights yaku is shown, since they are exclusive.
   *
   * The incomplete case has to respect the Rain Man rule or it tells the player
   * the opposite of what the scorer will do: it is excluded from Sanko, so
   * three brights that include it are not "Sanko 3/3" — they are worth nothing
   * until a fourth bright turns them into Ame-Shiko. So progress is counted
   * against Ame-Shiko when the Rain Man is held and against Sanko when it is
   * not, and the Rain Man itself never counts toward Sanko.
   */
  const brights = counts.brights.length;
  const plainBrights = brights - (counts.hasRainMan ? 1 : 0);
  if (scored.has('goko')) add('goko', 5, 5, rules.points.goko);
  else if (scored.has('shiko')) add('shiko', 4, 4, rules.points.shiko);
  else if (scored.has('ame-shiko')) add('ame-shiko', 4, 4, rules.points.ameShiko);
  else if (scored.has('sanko')) add('sanko', 3, 3, rules.points.sanko);
  else if (counts.hasRainMan) add('ame-shiko', brights, 4, rules.points.ameShiko);
  else if (plainBrights > 0) add('sanko', plainBrights, 3, rules.points.sanko);

  const isc = [CARD_IDS.BOAR, CARD_IDS.DEER, CARD_IDS.BUTTERFLIES];
  if (held(isc) > 0) add('ino-shika-cho', held(isc), 3, rules.points.inoShikaCho);

  const hanami = [CARD_IDS.CURTAIN, CARD_IDS.SAKE_CUP];
  if (held(hanami) > 0) add('hanami-zake', held(hanami), 2, rules.points.hanamiZake);

  const tsukimi = [CARD_IDS.MOON, CARD_IDS.SAKE_CUP];
  if (held(tsukimi) > 0) add('tsukimi-zake', held(tsukimi), 2, rules.points.tsukimiZake);

  const poetry = counts.tanzaku.filter((c) => c.ribbon === 'red-poetry').length;
  if (poetry > 0) add('akatan', poetry, 3, rules.points.akatan);

  const blue = counts.tanzaku.filter((c) => c.ribbon === 'blue').length;
  if (blue > 0) add('aotan', blue, 3, rules.points.aotan);

  if (counts.tane.length > 0) add('tane', counts.tane.length, rules.taneThreshold, rules.points.taneBase);
  if (counts.tanzaku.length > 0)
    add('tanzaku', counts.tanzaku.length, rules.tanzakuThreshold, rules.points.tanzakuBase);
  if (counts.kasu.length > 0) add('kasu', counts.kasu.length, rules.kasuThreshold, rules.points.kasuBase);

  if (rules.tsukiFudaEnabled) {
    const ofMonth = [...ids].filter((id) => getCard(id).month === month).length;
    if (ofMonth > 0) add('tsuki-fuda', ofMonth, 4, rules.points.tsukiFuda);
  }

  // Completed yaku first, then whichever is closest to completing.
  return rows.sort((a, b) => {
    if (a.complete !== b.complete) return a.complete ? -1 : 1;
    return b.have / b.need - a.have / a.need;
  });
}

export function YakuPanel({
  captured,
  rules,
  month,
  title,
}: {
  captured: readonly CardId[];
  rules: RuleConfig;
  /** The round's month. Needed so the optional Tsuki-fuda rule can be counted. */
  month: Month;
  title: string;
}) {
  const rows = computeProgress(captured, rules, month);
  const { base } = evaluateYaku(captured, rules, month);

  return (
    <div className="yaku">
      <div className="yaku__head">
        <h3>{title}</h3>
        <span className="yaku__total">{base} pts</span>
      </div>
      {rows.length === 0 ? (
        <p className="yaku__empty">Capture cards to start building yaku.</p>
      ) : (
        <ul className="yaku__list">
          {rows.map((row) => (
            <li key={row.id} className={row.complete ? 'yaku__row yaku__row--done' : 'yaku__row'}>
              <span className="yaku__name">
                {YAKU_INFO[row.id].name}
                <em>{YAKU_INFO[row.id].nameJa}</em>
              </span>
              <span className="yaku__count">
                {row.have}/{row.need}
              </span>
              <span className="yaku__pts">{row.complete ? `${row.points}` : '—'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
