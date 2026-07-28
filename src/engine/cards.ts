/**
 * The 48-card hanafuda deck — the single source of truth for the whole app.
 *
 * Structure (verified against Wikipedia "Hanafuda", Fuda Wiki, and
 * hanafudalegends.com):
 *   5 Hikari (brights) + 9 Tane (animals) + 10 Tanzaku (ribbons) + 24 Kasu (chaff) = 48
 *   12 months x 4 cards each.
 *
 * Two months are irregular and are the usual source of transcription errors:
 *   November (Yanagi) = 1 bright / 1 tane / 1 ribbon / 1 chaff
 *   December (Kiri)   = 1 bright / 0 tane / 0 ribbon / 3 chaff
 *
 * `src/engine/__tests__/cards.test.ts` asserts every one of these invariants,
 * so an accidental edit here fails the test suite rather than silently
 * corrupting scoring.
 */

export type Month =
  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export type CardKind = 'hikari' | 'tane' | 'tanzaku' | 'kasu';

/**
 * Ribbon colours matter for scoring:
 *   'red-poetry' — the three ribbons bearing written characters (Jan/Feb/Mar) -> Akatan
 *   'blue'       — the three blue/purple ribbons (Jun/Sep/Oct)                -> Aotan
 *   'red-plain'  — plain ribbons with no writing (Apr/May/Jul/Nov)            -> neither
 */
export type RibbonColor = 'red-poetry' | 'red-plain' | 'blue';

export interface Card {
  /** Stable identifier, `m<month>-<indexWithinMonth>`. Used as a React key and on the wire. */
  readonly id: CardId;
  readonly month: Month;
  readonly kind: CardKind;
  /** Suit (the month's plant), romaji. */
  readonly suit: string;
  /** Suit in Japanese. */
  readonly suitJa: string;
  /** English name of this specific card. */
  readonly name: string;
  /** Japanese name of this specific card. */
  readonly nameJa: string;
  /** Present only on `kind: 'tanzaku'`. */
  readonly ribbon?: RibbonColor;
  /**
   * Traditional "card point" value (20/10/5/1). Koi-Koi does not score with
   * these — they exist for display and for AI heuristics only. Yaku scoring
   * lives in `yaku.ts` and never reads this field.
   */
  readonly points: 20 | 10 | 5 | 1;
}

export type CardId = string;

/** Card ids referenced by name in yaku rules, so no rule has to hardcode a raw string twice. */
export const CARD_IDS = {
  /** January — Crane and Sun (bright). */
  CRANE: 'm1-0',
  /** March — Camp Curtain (bright). Half of Hanami-zake. */
  CURTAIN: 'm3-0',
  /** June — Butterflies (tane). Part of Ino-Shika-Cho. */
  BUTTERFLIES: 'm6-0',
  /** July — Boar (tane). Part of Ino-Shika-Cho. */
  BOAR: 'm7-0',
  /** August — Full Moon (bright). Half of Tsukimi-zake. */
  MOON: 'm8-0',
  /** September — Sake Cup (tane). Half of both -zake yaku. */
  SAKE_CUP: 'm9-0',
  /** October — Deer (tane). Part of Ino-Shika-Cho. */
  DEER: 'm10-0',
  /** November — Rain Man / Ono no Michikaze (bright). Excluded from Shiko and Sanko. */
  RAIN_MAN: 'm11-0',
  /** December — Chinese Phoenix (bright). */
  PHOENIX: 'm12-0',
} as const;

const POINTS_BY_KIND: Record<CardKind, Card['points']> = {
  hikari: 20,
  tane: 10,
  tanzaku: 5,
  kasu: 1,
};

interface CardSpec {
  kind: CardKind;
  name: string;
  nameJa: string;
  ribbon?: RibbonColor;
}

interface MonthSpec {
  month: Month;
  suit: string;
  suitJa: string;
  cards: CardSpec[];
}

const kasu = (name: string, nameJa: string): CardSpec => ({
  kind: 'kasu',
  name,
  nameJa,
});

/**
 * The deck, transcribed month by month. Order within a month is significant
 * only in that it fixes card ids; index 0 is always the month's "highest"
 * card so `m<n>-0` is the bright/animal where one exists.
 */
const MONTHS: MonthSpec[] = [
  {
    month: 1,
    suit: 'Matsu (Pine)',
    suitJa: '松',
    cards: [
      { kind: 'hikari', name: 'Crane and Sun', nameJa: '松に鶴' },
      { kind: 'tanzaku', name: 'Poetry Ribbon', nameJa: '松に赤短', ribbon: 'red-poetry' },
      kasu('Pine', '松のカス'),
      kasu('Pine', '松のカス'),
    ],
  },
  {
    month: 2,
    suit: 'Ume (Plum Blossom)',
    suitJa: '梅',
    cards: [
      { kind: 'tane', name: 'Bush Warbler', nameJa: '梅に鶯' },
      { kind: 'tanzaku', name: 'Poetry Ribbon', nameJa: '梅に赤短', ribbon: 'red-poetry' },
      kasu('Plum Blossom', '梅のカス'),
      kasu('Plum Blossom', '梅のカス'),
    ],
  },
  {
    month: 3,
    suit: 'Sakura (Cherry Blossom)',
    suitJa: '桜',
    cards: [
      { kind: 'hikari', name: 'Camp Curtain', nameJa: '桜に幕' },
      { kind: 'tanzaku', name: 'Poetry Ribbon', nameJa: '桜に赤短', ribbon: 'red-poetry' },
      kasu('Cherry Blossom', '桜のカス'),
      kasu('Cherry Blossom', '桜のカス'),
    ],
  },
  {
    month: 4,
    suit: 'Fuji (Wisteria)',
    suitJa: '藤',
    cards: [
      { kind: 'tane', name: 'Cuckoo', nameJa: '藤に不如帰' },
      { kind: 'tanzaku', name: 'Red Ribbon', nameJa: '藤に短冊', ribbon: 'red-plain' },
      kasu('Wisteria', '藤のカス'),
      kasu('Wisteria', '藤のカス'),
    ],
  },
  {
    month: 5,
    suit: 'Ayame (Iris)',
    suitJa: '菖蒲',
    cards: [
      { kind: 'tane', name: 'Eight-plank Bridge', nameJa: '菖蒲に八ツ橋' },
      { kind: 'tanzaku', name: 'Red Ribbon', nameJa: '菖蒲に短冊', ribbon: 'red-plain' },
      kasu('Iris', '菖蒲のカス'),
      kasu('Iris', '菖蒲のカス'),
    ],
  },
  {
    month: 6,
    suit: 'Botan (Peony)',
    suitJa: '牡丹',
    cards: [
      { kind: 'tane', name: 'Butterflies', nameJa: '牡丹に蝶' },
      { kind: 'tanzaku', name: 'Blue Ribbon', nameJa: '牡丹に青短', ribbon: 'blue' },
      kasu('Peony', '牡丹のカス'),
      kasu('Peony', '牡丹のカス'),
    ],
  },
  {
    month: 7,
    suit: 'Hagi (Bush Clover)',
    suitJa: '萩',
    cards: [
      { kind: 'tane', name: 'Boar', nameJa: '萩に猪' },
      { kind: 'tanzaku', name: 'Red Ribbon', nameJa: '萩に短冊', ribbon: 'red-plain' },
      kasu('Bush Clover', '萩のカス'),
      kasu('Bush Clover', '萩のカス'),
    ],
  },
  {
    month: 8,
    suit: 'Susuki (Pampas Grass)',
    suitJa: '芒',
    cards: [
      { kind: 'hikari', name: 'Full Moon', nameJa: '芒に月' },
      { kind: 'tane', name: 'Geese', nameJa: '芒に雁' },
      kasu('Pampas Grass', '芒のカス'),
      kasu('Pampas Grass', '芒のカス'),
    ],
  },
  {
    month: 9,
    suit: 'Kiku (Chrysanthemum)',
    suitJa: '菊',
    cards: [
      { kind: 'tane', name: 'Sake Cup', nameJa: '菊に盃' },
      { kind: 'tanzaku', name: 'Blue Ribbon', nameJa: '菊に青短', ribbon: 'blue' },
      kasu('Chrysanthemum', '菊のカス'),
      kasu('Chrysanthemum', '菊のカス'),
    ],
  },
  {
    month: 10,
    suit: 'Momiji (Maple)',
    suitJa: '紅葉',
    cards: [
      { kind: 'tane', name: 'Deer', nameJa: '紅葉に鹿' },
      { kind: 'tanzaku', name: 'Blue Ribbon', nameJa: '紅葉に青短', ribbon: 'blue' },
      kasu('Maple', '紅葉のカス'),
      kasu('Maple', '紅葉のカス'),
    ],
  },
  {
    // November is irregular: one of each kind.
    month: 11,
    suit: 'Yanagi (Willow)',
    suitJa: '柳',
    cards: [
      { kind: 'hikari', name: 'Rain Man', nameJa: '柳に小野道風' },
      { kind: 'tane', name: 'Swallow', nameJa: '柳に燕' },
      { kind: 'tanzaku', name: 'Red Ribbon', nameJa: '柳に短冊', ribbon: 'red-plain' },
      kasu('Lightning', '柳のカス'),
    ],
  },
  {
    // December is irregular: one bright and three chaff, no tane or tanzaku.
    month: 12,
    suit: 'Kiri (Paulownia)',
    suitJa: '桐',
    cards: [
      { kind: 'hikari', name: 'Chinese Phoenix', nameJa: '桐に鳳凰' },
      kasu('Paulownia', '桐のカス'),
      kasu('Paulownia', '桐のカス'),
      kasu('Paulownia (Yellow)', '桐のカス'),
    ],
  },
];

/** All 48 cards, in canonical order (month ascending, then index within month). */
export const DECK: readonly Card[] = MONTHS.flatMap((m) =>
  m.cards.map((spec, i): Card => {
    const card: Card = {
      id: `m${m.month}-${i}`,
      month: m.month,
      kind: spec.kind,
      suit: m.suit,
      suitJa: m.suitJa,
      name: spec.name,
      nameJa: spec.nameJa,
      points: POINTS_BY_KIND[spec.kind],
      ...(spec.ribbon ? { ribbon: spec.ribbon } : {}),
    };
    return card;
  }),
);

const CARD_BY_ID: ReadonlyMap<CardId, Card> = new Map(DECK.map((c) => [c.id, c]));

/** Look up a card by id. Throws on an unknown id — ids only ever come from `DECK`. */
export function getCard(id: CardId): Card {
  const card = CARD_BY_ID.get(id);
  if (!card) throw new Error(`Unknown card id: ${id}`);
  return card;
}

export function getCards(ids: readonly CardId[]): Card[] {
  return ids.map(getCard);
}

/** All card ids of a given month. Always exactly 4. */
export function idsOfMonth(month: Month): CardId[] {
  return DECK.filter((c) => c.month === month).map((c) => c.id);
}

export const ALL_CARD_IDS: readonly CardId[] = DECK.map((c) => c.id);

export const MONTH_NAMES: Record<Month, string> = {
  1: 'January',
  2: 'February',
  3: 'March',
  4: 'April',
  5: 'May',
  6: 'June',
  7: 'July',
  8: 'August',
  9: 'September',
  10: 'October',
  11: 'November',
  12: 'December',
};
