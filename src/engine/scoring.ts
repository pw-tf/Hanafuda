/**
 * Turning a yaku base score into the points actually awarded for a round.
 *
 * Order of operations is fixed here, in one place, so the two multipliers can
 * never be applied the wrong way round:
 *
 *     final = base
 *           x (base >= sevenPointThreshold ? sevenPointMultiplier : 1)
 *           x koiMultiplier
 *
 * The seven-point test reads the RAW base, not a partially multiplied value.
 */

import type { KoiKoiMultiplierMode, RuleConfig } from './rules';

export interface RoundSettlement {
  /** Sum of the winner's yaku, before multipliers. */
  readonly base: number;
  /** 2 when the base met the seven-point threshold, else 1. */
  readonly sevenPointMultiplier: number;
  /** Multiplier contributed by koi-koi declarations. */
  readonly koiMultiplier: number;
  /** Points actually awarded. */
  readonly total: number;
}

export interface KoiKoiCounts {
  /** Koi-koi declarations made by the player who is scoring the round. */
  readonly byWinner: number;
  /** Koi-koi declarations made by the other player. */
  readonly byLoser: number;
}

export function koiMultiplier(counts: KoiKoiCounts, mode: KoiKoiMultiplierMode): number {
  switch (mode) {
    case 'bga':
      // Two separate mechanics, not one. Calling koi-koi yourself adds one to
      // your own multiplier each time; the opponent calling it doubles whatever
      // you finally score, once, no matter how often they called.
      return (1 + counts.byWinner) * (counts.byLoser > 0 ? 2 : 1);
    case 'sum':
      return 1 + counts.byWinner + counts.byLoser;
    case 'opponentDoubleOnly':
      return counts.byLoser > 0 ? 2 : 1;
  }
}

export function settleRound(
  base: number,
  counts: KoiKoiCounts,
  rules: RuleConfig,
): RoundSettlement {
  if (base <= 0) {
    return { base: 0, sevenPointMultiplier: 1, koiMultiplier: 1, total: 0 };
  }

  const seven = base >= rules.sevenPointThreshold ? rules.sevenPointMultiplier : 1;
  const koi = koiMultiplier(counts, rules.koiKoiMultiplierMode);

  return {
    base,
    sevenPointMultiplier: seven,
    koiMultiplier: koi,
    total: base * seven * koi,
  };
}
