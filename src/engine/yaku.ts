/**
 * Yaku evaluation. Pure: captured card ids in, scored yaku out.
 *
 * Two rules here are the ones people most often get wrong, so they are stated
 * explicitly:
 *
 *  1. The Brights yaku are MUTUALLY EXCLUSIVE — only the single highest one
 *     scores. Every other yaku stacks. (Board Game Arena: "All the yaku are
 *     combinative, except the 'Bright' cards yaku, which are exclusive".)
 *  2. Three brights that INCLUDE the Rain Man is not Sanko, and scores nothing.
 *     Sanko and Shiko both require the Rain Man to be absent; once a fourth
 *     bright is present the Rain Man downgrades Shiko to Ame-Shiko instead of
 *     cancelling it.
 */

import { CARD_IDS, getCards, type Card, type CardId, type Month } from './cards';
import type { RuleConfig, YakuId } from './rules';

export interface ScoredYaku {
  readonly id: YakuId;
  readonly points: number;
  /** The captured cards that satisfy this yaku, for UI highlighting. */
  readonly cards: readonly CardId[];
}

export interface YakuBreakdown {
  readonly yaku: readonly ScoredYaku[];
  /** Sum of `yaku[].points`, before any multiplier. */
  readonly base: number;
}

const RED_POETRY_MONTHS: readonly Month[] = [1, 2, 3];
const BLUE_RIBBON_MONTHS: readonly Month[] = [6, 9, 10];

/**
 * Counts derived from a capture pile. Exposed because the AI scores partial
 * progress with the same numbers the scorer uses.
 */
export interface CaptureCounts {
  readonly brights: Card[];
  readonly tane: Card[];
  readonly tanzaku: Card[];
  readonly kasu: Card[];
  readonly hasRainMan: boolean;
  readonly ids: ReadonlySet<CardId>;
}

export function countCaptures(captured: readonly CardId[], rules: RuleConfig): CaptureCounts {
  const cards = getCards(captured);
  const ids = new Set(captured);

  const kasu = cards.filter((c) => c.kind === 'kasu');
  // In `tane-and-kasu` the Sake Cup is a Tane that ALSO adds one to the chaff
  // total. It never stops being a Tane, and it still satisfies both -zake yaku.
  if (rules.sakeCupMode === 'tane-and-kasu' && ids.has(CARD_IDS.SAKE_CUP)) {
    const cup = cards.find((c) => c.id === CARD_IDS.SAKE_CUP);
    if (cup) kasu.push(cup);
  }

  return {
    brights: cards.filter((c) => c.kind === 'hikari'),
    tane: cards.filter((c) => c.kind === 'tane'),
    tanzaku: cards.filter((c) => c.kind === 'tanzaku'),
    kasu,
    hasRainMan: ids.has(CARD_IDS.RAIN_MAN),
    ids,
  };
}

/** The one Brights yaku that applies, or null. Exclusive by construction. */
function brightsYaku(counts: CaptureCounts, rules: RuleConfig): ScoredYaku | null {
  const n = counts.brights.length;
  const cards = counts.brights.map((c) => c.id);
  const p = rules.points;

  if (n === 5) return { id: 'goko', points: p.goko, cards };
  if (n === 4) {
    return counts.hasRainMan
      ? { id: 'ame-shiko', points: p.ameShiko, cards }
      : { id: 'shiko', points: p.shiko, cards };
  }
  // Three brights only scores when the Rain Man is not one of them.
  if (n === 3 && !counts.hasRainMan) {
    return { id: 'sanko', points: p.sanko, cards };
  }
  return null;
}

/** A counting yaku: `base` points at `threshold`, +1 for every card beyond it. */
function countingYaku(
  id: YakuId,
  cards: readonly Card[],
  threshold: number,
  base: number,
): ScoredYaku | null {
  if (cards.length < threshold) return null;
  return {
    id,
    points: base + (cards.length - threshold),
    cards: cards.map((c) => c.id),
  };
}

function hasAll(ids: ReadonlySet<CardId>, required: readonly CardId[]): boolean {
  return required.every((id) => ids.has(id));
}

/**
 * Score a capture pile.
 *
 * @param currentMonth Round month, only used by the optional Tsuki-fuda rule.
 */
export function evaluateYaku(
  captured: readonly CardId[],
  rules: RuleConfig,
  currentMonth?: Month,
): YakuBreakdown {
  const counts = countCaptures(captured, rules);
  const p = rules.points;
  const yaku: ScoredYaku[] = [];

  const brights = brightsYaku(counts, rules);
  if (brights) yaku.push(brights);

  // Ino-Shika-Cho: Boar (Jul) + Deer (Oct) + Butterflies (Jun).
  const isc = [CARD_IDS.BOAR, CARD_IDS.DEER, CARD_IDS.BUTTERFLIES];
  if (hasAll(counts.ids, isc)) {
    yaku.push({ id: 'ino-shika-cho', points: p.inoShikaCho, cards: isc });
  }

  // The two drinking yaku. Both stack with the Brights yaku and with each
  // other — holding Curtain + Moon + Sake Cup scores Hanami AND Tsukimi.
  if (hasAll(counts.ids, [CARD_IDS.CURTAIN, CARD_IDS.SAKE_CUP])) {
    yaku.push({
      id: 'hanami-zake',
      points: p.hanamiZake,
      cards: [CARD_IDS.CURTAIN, CARD_IDS.SAKE_CUP],
    });
  }
  if (hasAll(counts.ids, [CARD_IDS.MOON, CARD_IDS.SAKE_CUP])) {
    yaku.push({
      id: 'tsukimi-zake',
      points: p.tsukimiZake,
      cards: [CARD_IDS.MOON, CARD_IDS.SAKE_CUP],
    });
  }

  // Ribbon-colour yaku. These also feed the plain Tanzaku count below, so
  // holding all six scores Akatan + Aotan + Tanzaku(6) = 5 + 5 + 2.
  const akatanCards = counts.tanzaku.filter((c) => c.ribbon === 'red-poetry');
  if (akatanCards.length === RED_POETRY_MONTHS.length) {
    yaku.push({ id: 'akatan', points: p.akatan, cards: akatanCards.map((c) => c.id) });
  }
  const aotanCards = counts.tanzaku.filter((c) => c.ribbon === 'blue');
  if (aotanCards.length === BLUE_RIBBON_MONTHS.length) {
    yaku.push({ id: 'aotan', points: p.aotan, cards: aotanCards.map((c) => c.id) });
  }

  const tane = countingYaku('tane', counts.tane, rules.taneThreshold, p.taneBase);
  if (tane) yaku.push(tane);

  const tanzaku = countingYaku('tanzaku', counts.tanzaku, rules.tanzakuThreshold, p.tanzakuBase);
  if (tanzaku) yaku.push(tanzaku);

  const kasu = countingYaku('kasu', counts.kasu, rules.kasuThreshold, p.kasuBase);
  if (kasu) yaku.push(kasu);

  if (rules.tsukiFudaEnabled && currentMonth !== undefined) {
    const monthCards = getCards(captured).filter((c) => c.month === currentMonth);
    if (monthCards.length === 4) {
      yaku.push({ id: 'tsuki-fuda', points: p.tsukiFuda, cards: monthCards.map((c) => c.id) });
    }
  }

  return { yaku, base: yaku.reduce((sum, y) => sum + y.points, 0) };
}

/**
 * Hand yaku, checked once against the 8 cards dealt to a player.
 * Teshi: all four cards of a single month. Kuttsuki: four distinct pairs.
 */
export function evaluateTeyaku(hand: readonly CardId[], rules: RuleConfig): ScoredYaku[] {
  if (!rules.teyakuEnabled) return [];

  const byMonth = new Map<Month, CardId[]>();
  for (const card of getCards(hand)) {
    const bucket = byMonth.get(card.month);
    if (bucket) bucket.push(card.id);
    else byMonth.set(card.month, [card.id]);
  }

  const result: ScoredYaku[] = [];

  for (const [, ids] of byMonth) {
    if (ids.length === 4) {
      result.push({ id: 'teshi', points: rules.points.teshi, cards: ids });
    }
  }

  // Kuttsuki needs the hand to be exactly four pairs — four months, two of each.
  const groups = [...byMonth.values()];
  if (groups.length === 4 && groups.every((g) => g.length === 2)) {
    result.push({ id: 'kuttsuki', points: rules.points.kuttsuki, cards: [...hand] });
  }

  return result;
}
