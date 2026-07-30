/**
 * How the AI values a position.
 *
 * Two ideas live here, and both replace something that was quietly broken.
 *
 * **The match, not the round.** The old value was `awarded[me] - awarded[them]`
 * for the current round, so the AI never once looked at the scoreline. Twenty
 * points ahead going into the last round it would still gamble; twenty behind
 * it would still bank three points and lose. Value is now the probability of
 * winning the *match*, which makes risk appetite fall out of the arithmetic
 * instead of needing rules bolted on.
 *
 * **Progress, not completion.** The old threat measure asked "does this one
 * card complete a yaku right now?", which is false for almost every card in
 * almost every position — an opponent sitting on four Tane or two blue ribbons
 * registered as no threat at all. Yaku are now scored by how close they are,
 * so the AI can see a plan forming and get in the way of it.
 */

import { CARD_IDS, DECK, getCard, type CardId, type Month } from '../engine/cards';
import { other, type GameState, type PlayerIndex } from '../engine/game';
import type { RuleConfig } from '../engine/rules';

// ---------------------------------------------------------------------------
// Match-aware utility
// ---------------------------------------------------------------------------

/**
 * Rough spread of a single round's point difference. Used to judge how
 * recoverable a deficit is with N rounds left. Calibrated from self-play; the
 * benchmark reports the empirical figure so this can be re-checked.
 */
const ROUND_SD = 9;

/**
 * Rounds remaining at which the match stops being a points race. Below this,
 * securing the win matters more than the margin.
 */
const ENDGAME_ROUNDS = 2;

/**
 * How loudly the win probability speaks in the endgame, in points-equivalent
 * units, and how much of a nudge the raw margin still gives.
 *
 * The tilt is not decoration: a probability alone saturates, so once the match
 * is decided every move scores the same and the choice becomes arbitrary — the
 * AI would visibly stop trying in the last round.
 */
const ENDGAME_SCALE = 40;
const POINT_TILT = 0.3;

/** Logistic approximation to the normal CDF. */
function winProbability(margin: number, roundsLeft: number): number {
  if (roundsLeft <= 0) return margin > 0 ? 1 : margin < 0 ? 0 : 0.5;
  const sd = ROUND_SD * Math.sqrt(roundsLeft);
  return 1 / (1 + Math.exp((-1.702 * margin) / sd));
}

/**
 * Value of finishing the current round `awardedDiff` points up, given where the
 * match already stands.
 *
 * Narrower than it first looks, and deliberately so. With rounds to spare,
 * points and win probability point the same way — more points now is more
 * likely to win later — and running everything through a logistic only
 * compresses real differences toward the noise floor. Measured, a search that
 * did that scored 28 points fewer per match than one maximising points, and won
 * exactly as often: all cost, no benefit.
 *
 * Where the two genuinely diverge is the endgame. With one round left and a
 * decisive lead, extra points are worth nothing and losing points is fatal; a
 * player behind needs a swing and should take on variance to get one. So the
 * win-probability view is applied only there, and points carry the rest of the
 * match.
 */
export function matchUtility(
  state: GameState,
  seat: PlayerIndex,
  awardedDiff: number,
): number {
  // Rounds *after* this one.
  const roundsLeft = Math.max(0, state.rules.rounds - state.round);
  if (roundsLeft >= ENDGAME_ROUNDS) return awardedDiff;

  const margin = state.scores[seat] - state.scores[other(seat)];
  // Scaled so the probability leads and points only break ties within it. Every
  // candidate in a single decision uses the same branch, so the change of units
  // between the two is never compared against itself.
  return (
    ENDGAME_SCALE * winProbability(margin + awardedDiff, roundsLeft) +
    POINT_TILT * awardedDiff
  );
}

/** Round-local value, for the tiers that do not track the match. */
export function roundUtility(awardedDiff: number): number {
  return awardedDiff;
}

// ---------------------------------------------------------------------------
// Yaku progress
// ---------------------------------------------------------------------------

/**
 * What a yaku is worth when it still needs N more cards. Index is the number
 * missing, so `[0]` is complete. The steep fall-off is deliberate: a yaku three
 * cards away is a daydream, not a plan.
 */
const MISSING_WEIGHT = [1, 0.55, 0.18, 0.05, 0];

function weightFor(missing: number): number {
  return MISSING_WEIGHT[Math.min(Math.max(missing, 0), MISSING_WEIGHT.length - 1)] ?? 0;
}

const BRIGHTS: readonly CardId[] = [
  CARD_IDS.CRANE,
  CARD_IDS.CURTAIN,
  CARD_IDS.MOON,
  CARD_IDS.PHOENIX,
  CARD_IDS.RAIN_MAN,
];
const NON_RAIN_BRIGHTS = BRIGHTS.filter((id) => id !== CARD_IDS.RAIN_MAN);

// Derived from the deck rather than written out, so these cannot drift from
// the card table if it ever changes.
const RED_POETRY: readonly CardId[] = DECK.filter((c) => c.ribbon === 'red-poetry').map(
  (c) => c.id,
);
const BLUE_RIBBONS: readonly CardId[] = DECK.filter((c) => c.ribbon === 'blue').map((c) => c.id);
const INO_SHIKA_CHO: readonly CardId[] = [CARD_IDS.BOAR, CARD_IDS.DEER, CARD_IDS.BUTTERFLIES];

/**
 * A pile, reduced to what the value function actually asks of it.
 *
 * Everything here is a number or a bitmask, and building one is a single pass
 * with no allocation beyond the struct itself. That matters: this is the
 * hottest function in the program by a wide margin — a playout evaluates it
 * several times per ply, and search quality is bounded by how many playouts fit
 * in the budget. The obvious implementation, `new Set(...)` plus
 * `countCaptures`'s five filtered arrays, cost more than the search it fed.
 */
export interface PileStats {
  /** Membership of cards 0-31 and 32-47. */
  lo: number;
  hi: number;
  tane: number;
  tanzaku: number;
  kasu: number;
  /** Cards held of each month, indexed 1-12. */
  months: Int8Array;
}

const CARD_INDEX = new Map<CardId, number>(DECK.map((c, i) => [c.id, i]));

function indexOf(id: CardId): number {
  return CARD_INDEX.get(id) ?? -1;
}

/** Bitmask for a fixed set of cards, precomputed once. */
function maskOf(ids: readonly CardId[]): { lo: number; hi: number; size: number } {
  let lo = 0;
  let hi = 0;
  for (const id of ids) {
    const i = indexOf(id);
    if (i < 32) lo |= 1 << i;
    else hi |= 1 << (i - 32);
  }
  return { lo, hi, size: ids.length };
}

export function emptyPile(): PileStats {
  return { lo: 0, hi: 0, tane: 0, tanzaku: 0, kasu: 0, months: new Int8Array(13) };
}

/** Fold one card into a pile, in place. */
function addCard(stats: PileStats, id: CardId, rules: RuleConfig): void {
  const index = indexOf(id);
  if (index < 0) return;
  if (index < 32) stats.lo |= 1 << index;
  else stats.hi |= 1 << (index - 32);

  const card = getCard(id);
  stats.months[card.month] = (stats.months[card.month] ?? 0) + 1;
  switch (card.kind) {
    case 'tane':
      stats.tane += 1;
      // Under the alternate rule the Sake Cup is a Tane that *also* adds one to
      // the chaff total; it never stops being a Tane.
      if (rules.sakeCupMode === 'tane-and-kasu' && id === CARD_IDS.SAKE_CUP) stats.kasu += 1;
      break;
    case 'tanzaku':
      stats.tanzaku += 1;
      break;
    case 'kasu':
      stats.kasu += 1;
      break;
    default:
      break;
  }
}

export function pileStats(captured: readonly CardId[], rules: RuleConfig): PileStats {
  const stats = emptyPile();
  for (const id of captured) addCard(stats, id, rules);
  return stats;
}

/** A copy with `cards` added — no array spread of the original pile. */
export function pileWith(
  stats: PileStats,
  cards: readonly CardId[],
  rules: RuleConfig,
): PileStats {
  const next: PileStats = {
    lo: stats.lo,
    hi: stats.hi,
    tane: stats.tane,
    tanzaku: stats.tanzaku,
    kasu: stats.kasu,
    months: stats.months.slice(),
  };
  for (const id of cards) addCard(next, id, rules);
  return next;
}

interface YakuMask {
  lo: number;
  hi: number;
  size: number;
  points: (rules: RuleConfig) => number;
}

const M_BRIGHTS = { ...maskOf(BRIGHTS), points: (r: RuleConfig) => r.points.goko };
const M_SHIKO = { ...maskOf(NON_RAIN_BRIGHTS), points: (r: RuleConfig) => r.points.shiko };
const M_AME_SHIKO = {
  ...maskOf([...NON_RAIN_BRIGHTS.slice(0, 3), CARD_IDS.RAIN_MAN]),
  points: (r: RuleConfig) => r.points.ameShiko,
};
const M_SANKO = {
  ...maskOf(NON_RAIN_BRIGHTS.slice(0, 3)),
  points: (r: RuleConfig) => r.points.sanko,
};
const M_ISC = { ...maskOf(INO_SHIKA_CHO), points: (r: RuleConfig) => r.points.inoShikaCho };
const M_HANAMI = {
  ...maskOf([CARD_IDS.CURTAIN, CARD_IDS.SAKE_CUP]),
  points: (r: RuleConfig) => r.points.hanamiZake,
};
const M_TSUKIMI = {
  ...maskOf([CARD_IDS.MOON, CARD_IDS.SAKE_CUP]),
  points: (r: RuleConfig) => r.points.tsukimiZake,
};
const M_AKATAN = { ...maskOf(RED_POETRY), points: (r: RuleConfig) => r.points.akatan };
const M_AOTAN = { ...maskOf(BLUE_RIBBONS), points: (r: RuleConfig) => r.points.aotan };

const popcount = (n: number): number => {
  let v = n - ((n >>> 1) & 0x55555555);
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
  return (((v + (v >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
};

/**
 * Progress towards one fixed set of cards.
 *
 * A yaku with any of its cards in the *opponent's* pile is dead and scores
 * zero. Cheap, and it pays for itself twice over: it stops the AI coveting the
 * third blue ribbon when the opponent holds one, and stops it "denying" a yaku
 * that can no longer happen.
 */
function setProgress(
  yaku: YakuMask,
  mine: PileStats,
  theirs: PileStats,
  rules: RuleConfig,
): number {
  if ((theirs.lo & yaku.lo) !== 0 || (theirs.hi & yaku.hi) !== 0) return 0;
  const held = popcount(mine.lo & yaku.lo) + popcount(mine.hi & yaku.hi);
  return yaku.points(rules) * weightFor(yaku.size - held);
}

/** Progress towards a counting yaku (any N of a kind). */
function countProgress(
  held: number,
  threshold: number,
  base: number,
  available: number,
): number {
  if (held >= threshold) return base + (held - threshold);
  const missing = threshold - held;
  // Impossible if there are not enough of that kind left in play at all.
  if (missing > available) return 0;
  return base * weightFor(missing);
}

/**
 * How much a capture pile is worth, counting yaku that have not happened yet.
 *
 * Not a score, and it never claims to be — it is a smooth stand-in for "how
 * well is this player doing", which is what the build and denial terms need and
 * what `evaluateYaku` deliberately does not provide.
 */
export function pileValueOf(
  mine: PileStats,
  theirs: PileStats,
  rules: RuleConfig,
  month: Month,
): number {
  const p = rules.points;

  // The Brights yaku are mutually exclusive, so take the best rather than
  // summing — otherwise a pile of brights is counted several times over.
  let total = Math.max(
    setProgress(M_BRIGHTS, mine, theirs, rules),
    setProgress(M_SHIKO, mine, theirs, rules),
    setProgress(M_AME_SHIKO, mine, theirs, rules),
    setProgress(M_SANKO, mine, theirs, rules),
  );

  total += setProgress(M_ISC, mine, theirs, rules);
  total += setProgress(M_HANAMI, mine, theirs, rules);
  total += setProgress(M_TSUKIMI, mine, theirs, rules);
  total += setProgress(M_AKATAN, mine, theirs, rules);
  total += setProgress(M_AOTAN, mine, theirs, rules);

  // `available` is how many of that kind the opponent does not already hold, so
  // a kind that has been hoovered up stops being a prospect.
  total += countProgress(mine.tane, rules.taneThreshold, p.taneBase, 9 - theirs.tane);
  total += countProgress(mine.tanzaku, rules.tanzakuThreshold, p.tanzakuBase, 10 - theirs.tanzaku);
  total += countProgress(mine.kasu, rules.kasuThreshold, p.kasuBase, 24 - theirs.kasu);

  if (rules.tsukiFudaEnabled) {
    const ofMonth = mine.months[month] ?? 0;
    const theirsOfMonth = theirs.months[month] ?? 0;
    total += countProgress(ofMonth, 4, p.tsukiFuda, 4 - theirsOfMonth);
  }

  return total;
}

/** Convenience wrapper for callers that only have card lists. */
export function pileValue(
  captured: readonly CardId[],
  opponentCaptured: readonly CardId[],
  rules: RuleConfig,
  month: Month,
): number {
  return pileValueOf(
    pileStats(captured, rules),
    pileStats(opponentCaptured, rules),
    rules,
    month,
  );
}

/** What adding `card` to a pile is worth to its owner. */
export function gainFor(
  card: CardId,
  captured: readonly CardId[],
  opponentCaptured: readonly CardId[],
  rules: RuleConfig,
  month: Month,
): number {
  const mine = pileStats(captured, rules);
  const theirs = pileStats(opponentCaptured, rules);
  return (
    pileValueOf(pileWith(mine, [card], rules), theirs, rules, month) -
    pileValueOf(mine, theirs, rules, month)
  );
}

// ---------------------------------------------------------------------------
// Static card worth
// ---------------------------------------------------------------------------

/**
 * Rough worth of a card independent of any yaku, for tempo and tie-breaking —
 * and the lever Easy's bright-chasing is built on.
 */
export function staticCardValue(id: CardId): number {
  const card = getCard(id);
  switch (card.kind) {
    case 'hikari':
      // The Rain Man is worth noticeably less: it is excluded from Sanko and
      // downgrades Shiko to Ame-Shiko.
      return id === CARD_IDS.RAIN_MAN ? 14 : 20;
    case 'tane':
      if (id === CARD_IDS.SAKE_CUP) return 13; // feeds both -zake yaku
      if (INO_SHIKA_CHO.includes(id)) return 11;
      return 8;
    case 'tanzaku':
      return card.ribbon === 'red-poetry' || card.ribbon === 'blue' ? 9 : 6;
    case 'kasu':
      return 2;
  }
}
