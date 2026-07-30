/**
 * The fast pile summary is a second way of counting a capture pile, and the
 * engine's `countCaptures` is the authority. This holds the two together.
 *
 * It matters because `pileStats` exists purely for speed — a playout evaluates
 * it several times per ply — and a summary that drifts from the real rules
 * would make the AI confidently wrong rather than slow.
 */

import { describe, expect, it } from 'vitest';
import { ALL_CARD_IDS, CARD_IDS, type CardId } from '../../engine/cards';
import { createRng, shuffle } from '../../engine/rng';
import { GAMEDESIGN_RULES, STANDARD_RULES, type RuleConfig } from '../../engine/rules';
import { countCaptures, evaluateYaku } from '../../engine/yaku';
import { pileStats, pileValue, pileWith, pileValueOf } from '../evaluate';

const PRESETS: RuleConfig[] = [
  STANDARD_RULES,
  GAMEDESIGN_RULES,
  { ...STANDARD_RULES, sakeCupMode: 'tane-and-kasu' },
  { ...STANDARD_RULES, tsukiFudaEnabled: true },
];

describe('pile summary', () => {
  it('counts every kind the way the engine does, across rule presets', () => {
    const rng = createRng(4242);
    for (const rules of PRESETS) {
      for (let trial = 0; trial < 400; trial++) {
        const size = rng.nextInt(20);
        const pile = shuffle(ALL_CARD_IDS, rng).slice(0, size);

        const engine = countCaptures(pile, rules);
        const fast = pileStats(pile, rules);

        expect(fast.tane, `tane, size ${size}`).toBe(engine.tane.length);
        expect(fast.tanzaku, `tanzaku, size ${size}`).toBe(engine.tanzaku.length);
        expect(fast.kasu, `kasu, size ${size}`).toBe(engine.kasu.length);
      }
    }
  });

  it('tracks the sake cup as both Tane and chaff under the alternate rule', () => {
    const rules: RuleConfig = { ...STANDARD_RULES, sakeCupMode: 'tane-and-kasu' };
    const fast = pileStats([CARD_IDS.SAKE_CUP], rules);
    expect(fast.tane).toBe(1);
    expect(fast.kasu).toBe(1);

    const plain = pileStats([CARD_IDS.SAKE_CUP], STANDARD_RULES);
    expect(plain.tane).toBe(1);
    expect(plain.kasu).toBe(0);
  });

  it('adds cards incrementally to the same answer as counting from scratch', () => {
    const rng = createRng(99);
    for (let trial = 0; trial < 200; trial++) {
      const deck = shuffle(ALL_CARD_IDS, rng);
      const base = deck.slice(0, 6);
      const extra = deck.slice(6, 9);

      const incremental = pileWith(pileStats(base, STANDARD_RULES), extra, STANDARD_RULES);
      const scratch = pileStats([...base, ...extra], STANDARD_RULES);

      expect(incremental.lo).toBe(scratch.lo);
      expect(incremental.hi).toBe(scratch.hi);
      expect(incremental.tane).toBe(scratch.tane);
      expect(incremental.tanzaku).toBe(scratch.tanzaku);
      expect(incremental.kasu).toBe(scratch.kasu);
      expect([...incremental.months]).toEqual([...scratch.months]);
    }
  });
});

describe('pile value', () => {
  const value = (pile: CardId[], opp: CardId[] = []) =>
    pileValue(pile, opp, STANDARD_RULES, 1);

  it('is at least the real score once a yaku is complete', () => {
    // Sanko: three brights, no Rain Man.
    const sanko = [CARD_IDS.CRANE, CARD_IDS.CURTAIN, CARD_IDS.MOON];
    expect(evaluateYaku(sanko, STANDARD_RULES, 1).base).toBe(STANDARD_RULES.points.sanko);
    expect(value(sanko)).toBeGreaterThanOrEqual(STANDARD_RULES.points.sanko);
  });

  it('rises as a yaku gets closer', () => {
    const none = value([CARD_IDS.CRANE]);
    const closer = value([CARD_IDS.CRANE, CARD_IDS.CURTAIN]);
    const done = value([CARD_IDS.CRANE, CARD_IDS.CURTAIN, CARD_IDS.MOON]);
    expect(closer).toBeGreaterThan(none);
    expect(done).toBeGreaterThan(closer);
  });

  it('writes off a yaku the opponent has already broken', () => {
    // Two of the three blue ribbons, with the third in the opponent's pile.
    const blue = ['m6-1', 'm9-1'] as CardId[];
    const live = value(blue);
    const dead = value(blue, ['m10-1'] as CardId[]);
    expect(dead).toBeLessThan(live);
  });

  it('never counts the exclusive Brights yaku more than once', () => {
    // All five brights score Goko and nothing else on top of it.
    const all = [
      CARD_IDS.CRANE,
      CARD_IDS.CURTAIN,
      CARD_IDS.MOON,
      CARD_IDS.PHOENIX,
      CARD_IDS.RAIN_MAN,
    ];
    const stats = pileStats(all, STANDARD_RULES);
    const empty = pileStats([], STANDARD_RULES);
    const brightsOnly = pileValueOf(stats, empty, STANDARD_RULES, 1);
    // Goko plus the chaff/tane counting terms, but never Goko + Shiko + Sanko.
    expect(brightsOnly).toBeLessThan(
      STANDARD_RULES.points.goko + STANDARD_RULES.points.shiko,
    );
    expect(brightsOnly).toBeGreaterThanOrEqual(STANDARD_RULES.points.goko);
  });
});
