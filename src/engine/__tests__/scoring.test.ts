import { describe, expect, it } from 'vitest';
import { RULE_PRESETS, STANDARD_RULES, migrateRules, type RuleConfig } from '../rules';
import { koiMultiplier, settleRound } from '../scoring';

const opponentOnly: RuleConfig = { ...STANDARD_RULES, koiKoiMultiplierMode: 'opponentDoubleOnly' };
const sumMode: RuleConfig = { ...STANDARD_RULES, koiKoiMultiplierMode: 'sum' };

describe('koiMultiplier — bga mode (the default)', () => {
  it('is 1 when nobody called koi-koi', () => {
    expect(koiMultiplier({ byWinner: 0, byLoser: 0 }, 'bga')).toBe(1);
  });

  it('adds one for each of the winner’s own calls', () => {
    expect(koiMultiplier({ byWinner: 1, byLoser: 0 }, 'bga')).toBe(2);
    expect(koiMultiplier({ byWinner: 3, byLoser: 0 }, 'bga')).toBe(4);
  });

  it('doubles once for the loser’s calls, however many there were', () => {
    expect(koiMultiplier({ byWinner: 0, byLoser: 1 }, 'bga')).toBe(2);
    expect(koiMultiplier({ byWinner: 0, byLoser: 2 }, 'bga')).toBe(2);
    expect(koiMultiplier({ byWinner: 0, byLoser: 5 }, 'bga')).toBe(2);
  });

  it('multiplies the two mechanics rather than adding them', () => {
    // The case that separates this from `sum`: one call each is x4, not x3.
    expect(koiMultiplier({ byWinner: 1, byLoser: 1 }, 'bga')).toBe(4);
    expect(koiMultiplier({ byWinner: 2, byLoser: 1 }, 'bga')).toBe(6);
    expect(koiMultiplier({ byWinner: 2, byLoser: 3 }, 'bga')).toBe(6);
  });

  it('is the mode both shipped presets use', () => {
    for (const preset of RULE_PRESETS) {
      expect(preset.koiKoiMultiplierMode, preset.id).toBe('bga');
    }
  });
});

describe('koiMultiplier — sum mode', () => {
  it('is 1 when nobody called koi-koi', () => {
    expect(koiMultiplier({ byWinner: 0, byLoser: 0 }, 'sum')).toBe(1);
  });

  it('adds one for each of the winner’s own calls', () => {
    expect(koiMultiplier({ byWinner: 1, byLoser: 0 }, 'sum')).toBe(2);
    expect(koiMultiplier({ byWinner: 3, byLoser: 0 }, 'sum')).toBe(4);
  });

  it('adds one for each of the loser’s calls', () => {
    expect(koiMultiplier({ byWinner: 0, byLoser: 1 }, 'sum')).toBe(2);
    expect(koiMultiplier({ byWinner: 0, byLoser: 2 }, 'sum')).toBe(3);
  });

  it('adds calls from both players together', () => {
    expect(koiMultiplier({ byWinner: 2, byLoser: 1 }, 'sum')).toBe(4);
  });
});

describe('koiMultiplier — opponentDoubleOnly mode', () => {
  it('doubles only when the loser called koi-koi', () => {
    expect(koiMultiplier({ byWinner: 0, byLoser: 0 }, 'opponentDoubleOnly')).toBe(1);
    expect(koiMultiplier({ byWinner: 0, byLoser: 1 }, 'opponentDoubleOnly')).toBe(2);
    expect(koiMultiplier({ byWinner: 0, byLoser: 5 }, 'opponentDoubleOnly')).toBe(2);
  });

  it('ignores the winner’s own calls', () => {
    expect(koiMultiplier({ byWinner: 4, byLoser: 0 }, 'opponentDoubleOnly')).toBe(1);
  });
});

describe('settleRound', () => {
  const none = { byWinner: 0, byLoser: 0 };

  it('awards the base unchanged below the seven-point threshold', () => {
    const s = settleRound(6, none, STANDARD_RULES);
    expect(s).toEqual({ base: 6, sevenPointMultiplier: 1, koiMultiplier: 1, total: 6 });
  });

  it('doubles at exactly seven points', () => {
    const s = settleRound(7, none, STANDARD_RULES);
    expect(s.sevenPointMultiplier).toBe(2);
    expect(s.total).toBe(14);
  });

  it('doubles above seven points', () => {
    expect(settleRound(10, none, STANDARD_RULES).total).toBe(20);
  });

  it('tests the seven-point threshold against the raw base, not a multiplied value', () => {
    // Base 4 with a x2 koi multiplier reaches 8 points, but 4 < 7 so the
    // doubling must NOT apply. Total is 4 x 1 x 2 = 8, not 4 x 2 x 2 = 16.
    const s = settleRound(4, { byWinner: 1, byLoser: 0 }, STANDARD_RULES);
    expect(s.sevenPointMultiplier).toBe(1);
    expect(s.koiMultiplier).toBe(2);
    expect(s.total).toBe(8);
  });

  it('applies both multipliers together', () => {
    // 7 base, opponent called koi-koi once: 7 x 2 x 2 = 28.
    const s = settleRound(7, { byWinner: 0, byLoser: 1 }, STANDARD_RULES);
    expect(s.total).toBe(28);
  });

  it('applies a deep koi-koi chain', () => {
    // 8 base, winner called twice and loser once: 8 x 2 x ((1+2) x 2) = 96.
    expect(settleRound(8, { byWinner: 2, byLoser: 1 }, STANDARD_RULES).total).toBe(96);
    // The same position under the sum simplification: 8 x 2 x (1+2+1) = 64.
    expect(settleRound(8, { byWinner: 2, byLoser: 1 }, sumMode).total).toBe(64);
  });

  it('returns zero for a base of zero', () => {
    expect(settleRound(0, { byWinner: 2, byLoser: 2 }, STANDARD_RULES)).toEqual({
      base: 0,
      sevenPointMultiplier: 1,
      koiMultiplier: 1,
      total: 0,
    });
  });

  it('honours the opponentDoubleOnly mode', () => {
    expect(settleRound(5, { byWinner: 3, byLoser: 0 }, opponentOnly).total).toBe(5);
    expect(settleRound(5, { byWinner: 3, byLoser: 1 }, opponentOnly).total).toBe(10);
  });
});

describe('migrateRules', () => {
  it('leaves a current config alone', () => {
    expect(migrateRules(STANDARD_RULES)).toEqual(STANDARD_RULES);
  });

  it('maps the retired dealer-6 draw rule onto oya-ken', () => {
    const stored = { ...STANDARD_RULES, drawRule: 'dealer-6' } as unknown as RuleConfig;
    expect(migrateRules(stored).drawRule).toBe('dealer-1');
  });

  it('falls back to the default for a mode this build does not know', () => {
    const stored = {
      ...STANDARD_RULES,
      koiKoiMultiplierMode: 'whatever',
      drawRule: 'whatever',
    } as unknown as RuleConfig;
    const migrated = migrateRules(stored);
    expect(migrated.koiKoiMultiplierMode).toBe(STANDARD_RULES.koiKoiMultiplierMode);
    expect(migrated.drawRule).toBe(STANDARD_RULES.drawRule);
    // A settled round from a migrated config is a number, not NaN.
    expect(settleRound(5, { byWinner: 1, byLoser: 0 }, migrated).total).toBe(10);
  });

  it('keeps a deliberately chosen non-default mode', () => {
    expect(migrateRules(sumMode).koiKoiMultiplierMode).toBe('sum');
    expect(migrateRules(opponentOnly).koiKoiMultiplierMode).toBe('opponentDoubleOnly');
  });
});
