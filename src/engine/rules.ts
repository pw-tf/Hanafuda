/**
 * Every tunable rule in one typed object.
 *
 * Koi-Koi has no single canonical scoring table — published sources genuinely
 * disagree, most visibly on the Brights yaku (Wikipedia and Board Game Arena
 * give Goko 10; gamedesign.jp gives Goko 15). Rather than pick one and call it
 * "correct", both ship as presets and nothing anywhere else in the codebase
 * hardcodes a point value.
 */

export type YakuId =
  | 'goko'
  | 'shiko'
  | 'ame-shiko'
  | 'sanko'
  | 'ino-shika-cho'
  | 'hanami-zake'
  | 'tsukimi-zake'
  | 'akatan'
  | 'aotan'
  | 'tane'
  | 'tanzaku'
  | 'kasu'
  | 'tsuki-fuda'
  | 'teshi'
  | 'kuttsuki';

/** How the Sake Cup (September, 菊に盃) is categorised. */
export type SakeCupMode =
  /** Tane only. The common modern default. */
  | 'tane-only'
  /** Also counts toward the Kasu total, while still being a Tane. */
  | 'tane-and-kasu';

export type KoiKoiMultiplierMode =
  /**
   * Board Game Arena's documented default, and the one the sources agree on.
   * Two separate mechanics: each koi-koi you call yourself adds one to your own
   * multiplier, and a koi-koi called by your opponent doubles what you finally
   * score — once, however many times they called it.
   *
   *     (1 + yourCalls) x (theirCalls > 0 ? 2 : 1)
   */
  | 'bga'
  /**
   * Multiplier = 1 + every koi-koi called this round by either player.
   *
   * A simplification, not a published rule: it agrees with `bga` when only one
   * player ever called, and diverges once both did (1 + 1 gives x3 here and x4
   * on BGA) or when the loser called more than once.
   */
  | 'sum'
  /** x2 if and only if the losing player called koi-koi at least once. */
  | 'opponentDoubleOnly';

/** What happens when both hands empty and nobody ever called shobu. */
export type DrawRule =
  /** Nobody scores. */
  | 'no-score'
  /**
   * Oya-ken, "dealer's privilege": the dealer takes a point. The deal staying
   * with the dealer is not part of this option — an unwon round never moves the
   * deal, whichever draw rule is in play.
   */
  | 'dealer-1';

export interface YakuPoints {
  goko: number;
  shiko: number;
  ameShiko: number;
  sanko: number;
  inoShikaCho: number;
  hanamiZake: number;
  tsukimiZake: number;
  akatan: number;
  aotan: number;
  /** Points awarded at the threshold count; each card beyond adds `+1`. */
  taneBase: number;
  tanzakuBase: number;
  kasuBase: number;
  tsukiFuda: number;
  teshi: number;
  kuttsuki: number;
}

export interface RuleConfig {
  readonly id: string;
  readonly label: string;
  /** Short form, for controls too narrow for the full label. */
  readonly shortLabel: string;
  readonly points: YakuPoints;

  /** Minimum cards needed for the counting yaku. */
  readonly taneThreshold: number;
  readonly tanzakuThreshold: number;
  readonly kasuThreshold: number;

  /** Base score at or above which the round total is multiplied. */
  readonly sevenPointThreshold: number;
  readonly sevenPointMultiplier: number;
  readonly koiKoiMultiplierMode: KoiKoiMultiplierMode;

  /** Optional rules. */
  readonly teyakuEnabled: boolean;
  readonly tsukiFudaEnabled: boolean;
  readonly sakeCupMode: SakeCupMode;

  /** Match structure. */
  readonly rounds: number;
  readonly drawRule: DrawRule;
}

const SHARED_POINTS = {
  inoShikaCho: 5,
  hanamiZake: 5,
  tsukimiZake: 5,
  akatan: 5,
  aotan: 5,
  taneBase: 1,
  tanzakuBase: 1,
  kasuBase: 1,
  tsukiFuda: 4,
  teshi: 6,
  kuttsuki: 6,
} as const;

const SHARED_RULES = {
  taneThreshold: 5,
  tanzakuThreshold: 5,
  kasuThreshold: 10,
  sevenPointThreshold: 7,
  sevenPointMultiplier: 2,
  koiKoiMultiplierMode: 'bga' as const,
  teyakuEnabled: true,
  // Ships off: the 4-point value for Tsuki-fuda is a house rule with weak
  // sourcing, so it is available but not on by default.
  tsukiFudaEnabled: false,
  sakeCupMode: 'tane-only' as const,
  rounds: 12,
  drawRule: 'no-score' as const,
};

/** Wikipedia / Board Game Arena values. The default. */
export const STANDARD_RULES: RuleConfig = {
  id: 'standard',
  label: 'Standard (Wikipedia / BGA)',
  shortLabel: 'Standard',
  points: {
    goko: 10,
    shiko: 8,
    ameShiko: 7,
    sanko: 5,
    ...SHARED_POINTS,
  },
  ...SHARED_RULES,
};

/** The higher Brights values used by the long-running gamedesign.jp Koi-Koi. */
export const GAMEDESIGN_RULES: RuleConfig = {
  id: 'gamedesign',
  label: 'gamedesign.jp',
  shortLabel: 'gamedesign.jp',
  points: {
    goko: 15,
    shiko: 10,
    ameShiko: 8,
    sanko: 6,
    ...SHARED_POINTS,
  },
  ...SHARED_RULES,
};

export const RULE_PRESETS: readonly RuleConfig[] = [STANDARD_RULES, GAMEDESIGN_RULES];

export const DEFAULT_RULES = STANDARD_RULES;

export function getPreset(id: string): RuleConfig {
  return RULE_PRESETS.find((p) => p.id === id) ?? DEFAULT_RULES;
}

/**
 * Bring a stored `RuleConfig` up to date.
 *
 * Saved games and saved preferences both carry a whole `RuleConfig`, so an
 * option that has since been renamed comes back from storage as a string this
 * build no longer understands. Left alone it reaches `koiMultiplier` and falls
 * off the end of the switch, returning `undefined` and turning a round total
 * into `NaN`. Every value is mapped here instead — to the option that means the
 * same thing where there is one, and to the default otherwise.
 */
export function migrateRules(stored: RuleConfig): RuleConfig {
  const koi = stored.koiKoiMultiplierMode as string;
  const koiKoiMultiplierMode: KoiKoiMultiplierMode =
    koi === 'bga' || koi === 'sum' || koi === 'opponentDoubleOnly'
      ? koi
      : DEFAULT_RULES.koiKoiMultiplierMode;

  // 'dealer-6' was this app's own spelling of oya-ken, at an unsourced 6 points.
  const draw = stored.drawRule as string;
  const drawRule: DrawRule =
    draw === 'no-score' || draw === 'dealer-1'
      ? draw
      : draw === 'dealer-6'
        ? 'dealer-1'
        : DEFAULT_RULES.drawRule;

  return { ...stored, koiKoiMultiplierMode, drawRule };
}

/** Display metadata for the yaku list in the UI. Points come from `RuleConfig`. */
export const YAKU_INFO: Record<YakuId, { name: string; nameJa: string; description: string }> = {
  goko: { name: 'Five Brights', nameJa: '五光', description: 'All 5 bright cards' },
  shiko: { name: 'Four Brights', nameJa: '四光', description: '4 brights, without the Rain Man' },
  'ame-shiko': { name: 'Rainy Four Brights', nameJa: '雨四光', description: '4 brights including the Rain Man' },
  sanko: { name: 'Three Brights', nameJa: '三光', description: '3 brights, without the Rain Man' },
  'ino-shika-cho': { name: 'Boar, Deer, Butterfly', nameJa: '猪鹿蝶', description: 'Boar + Deer + Butterflies' },
  'hanami-zake': { name: 'Flower Viewing', nameJa: '花見で一杯', description: 'Camp Curtain + Sake Cup' },
  'tsukimi-zake': { name: 'Moon Viewing', nameJa: '月見で一杯', description: 'Full Moon + Sake Cup' },
  akatan: { name: 'Red Poetry Ribbons', nameJa: '赤短', description: 'All 3 poetry ribbons' },
  aotan: { name: 'Blue Ribbons', nameJa: '青短', description: 'All 3 blue ribbons' },
  tane: { name: 'Animals', nameJa: 'タネ', description: '5 animals, +1 point each extra' },
  tanzaku: { name: 'Ribbons', nameJa: '短冊', description: '5 ribbons, +1 point each extra' },
  kasu: { name: 'Chaff', nameJa: 'カス', description: '10 chaff, +1 point each extra' },
  'tsuki-fuda': { name: 'Month Cards', nameJa: '月札', description: "All 4 cards of the round's month" },
  teshi: { name: 'Four of a Month', nameJa: '手四', description: 'Dealt 4 cards of one month' },
  kuttsuki: { name: 'Four Pairs', nameJa: 'くっつき', description: 'Dealt 4 pairs' },
};
