import { describe, expect, it } from 'vitest';
import { CARD_IDS, DECK, type CardId } from '../cards';
import { GAMEDESIGN_RULES, STANDARD_RULES, type RuleConfig } from '../rules';
import { evaluateTeyaku, evaluateYaku, yakuForCard } from '../yaku';

const idsOfKind = (kind: string): CardId[] => DECK.filter((c) => c.kind === kind).map((c) => c.id);

const BRIGHTS = idsOfKind('hikari');
const TANE = idsOfKind('tane');
const TANZAKU = idsOfKind('tanzaku');
const KASU = idsOfKind('kasu');

const NON_RAIN_BRIGHTS = BRIGHTS.filter((id) => id !== CARD_IDS.RAIN_MAN);
const POETRY = DECK.filter((c) => c.ribbon === 'red-poetry').map((c) => c.id);
const BLUE = DECK.filter((c) => c.ribbon === 'blue').map((c) => c.id);
const PLAIN_RIBBONS = DECK.filter((c) => c.ribbon === 'red-plain').map((c) => c.id);

/** Points for one yaku id, or 0 when that yaku did not score. */
function pointsFor(captured: CardId[], id: string, rules: RuleConfig = STANDARD_RULES): number {
  return evaluateYaku(captured, rules).yaku.find((y) => y.id === id)?.points ?? 0;
}

function yakuIds(captured: CardId[], rules: RuleConfig = STANDARD_RULES): string[] {
  return evaluateYaku(captured, rules).yaku.map((y) => y.id).sort();
}

describe('brights yaku', () => {
  it('scores Goko for all five brights', () => {
    expect(pointsFor(BRIGHTS, 'goko')).toBe(10);
    expect(pointsFor(BRIGHTS, 'goko', GAMEDESIGN_RULES)).toBe(15);
  });

  it('scores Shiko for four brights without the Rain Man', () => {
    expect(pointsFor(NON_RAIN_BRIGHTS, 'shiko')).toBe(8);
    expect(pointsFor(NON_RAIN_BRIGHTS, 'shiko', GAMEDESIGN_RULES)).toBe(10);
  });

  it('scores Ame-Shiko for four brights including the Rain Man', () => {
    const four = [...NON_RAIN_BRIGHTS.slice(0, 3), CARD_IDS.RAIN_MAN];
    expect(pointsFor(four, 'ame-shiko')).toBe(7);
    expect(pointsFor(four, 'ame-shiko', GAMEDESIGN_RULES)).toBe(8);
    expect(pointsFor(four, 'shiko')).toBe(0);
  });

  it('scores Sanko for three brights without the Rain Man', () => {
    const three = NON_RAIN_BRIGHTS.slice(0, 3);
    expect(pointsFor(three, 'sanko')).toBe(5);
    expect(pointsFor(three, 'sanko', GAMEDESIGN_RULES)).toBe(6);
  });

  it('scores nothing for three brights that include the Rain Man', () => {
    const three = [...NON_RAIN_BRIGHTS.slice(0, 2), CARD_IDS.RAIN_MAN];
    expect(evaluateYaku(three, STANDARD_RULES).base).toBe(0);
  });

  it('scores nothing for two brights', () => {
    expect(evaluateYaku(NON_RAIN_BRIGHTS.slice(0, 2), STANDARD_RULES).base).toBe(0);
  });

  it('never awards two brights yaku at once (they are exclusive)', () => {
    for (const set of [BRIGHTS, NON_RAIN_BRIGHTS, NON_RAIN_BRIGHTS.slice(0, 3)]) {
      const brightYaku = evaluateYaku(set, STANDARD_RULES).yaku.filter((y) =>
        ['goko', 'shiko', 'ame-shiko', 'sanko'].includes(y.id),
      );
      expect(brightYaku).toHaveLength(1);
    }
  });

  it('does not also award Sanko when four brights are held', () => {
    expect(pointsFor(NON_RAIN_BRIGHTS, 'sanko')).toBe(0);
  });
});

describe('ino-shika-cho', () => {
  const ISC: CardId[] = [CARD_IDS.BOAR, CARD_IDS.DEER, CARD_IDS.BUTTERFLIES];

  it('scores 5 for boar + deer + butterflies', () => {
    expect(pointsFor(ISC, 'ino-shika-cho')).toBe(5);
  });

  it('does not score with only two of the three', () => {
    expect(pointsFor([CARD_IDS.BOAR, CARD_IDS.DEER], 'ino-shika-cho')).toBe(0);
    expect(pointsFor([CARD_IDS.BOAR, CARD_IDS.BUTTERFLIES], 'ino-shika-cho')).toBe(0);
    expect(pointsFor([CARD_IDS.DEER, CARD_IDS.BUTTERFLIES], 'ino-shika-cho')).toBe(0);
  });

  it('stacks with the Tane yaku', () => {
    const five = [...ISC, TANE.find((t) => !ISC.includes(t))!, TANE.filter((t) => !ISC.includes(t))[1]!];
    expect(pointsFor(five, 'ino-shika-cho')).toBe(5);
    expect(pointsFor(five, 'tane')).toBe(1);
  });
});

describe('drinking yaku', () => {
  it('scores Hanami-zake for curtain + sake cup', () => {
    expect(pointsFor([CARD_IDS.CURTAIN, CARD_IDS.SAKE_CUP], 'hanami-zake')).toBe(5);
  });

  it('scores Tsukimi-zake for moon + sake cup', () => {
    expect(pointsFor([CARD_IDS.MOON, CARD_IDS.SAKE_CUP], 'tsukimi-zake')).toBe(5);
  });

  it('scores both when curtain, moon and sake cup are all held', () => {
    const held = [CARD_IDS.CURTAIN, CARD_IDS.MOON, CARD_IDS.SAKE_CUP];
    expect(pointsFor(held, 'hanami-zake')).toBe(5);
    expect(pointsFor(held, 'tsukimi-zake')).toBe(5);
    // Two brights alone are not a brights yaku, so the base is exactly 5 + 5.
    expect(evaluateYaku(held, STANDARD_RULES).base).toBe(10);
  });

  it('does not score either without the sake cup', () => {
    expect(pointsFor([CARD_IDS.CURTAIN, CARD_IDS.MOON], 'hanami-zake')).toBe(0);
    expect(pointsFor([CARD_IDS.CURTAIN, CARD_IDS.MOON], 'tsukimi-zake')).toBe(0);
  });
});

describe('ribbon yaku', () => {
  it('scores Akatan for the three poetry ribbons', () => {
    expect(POETRY).toHaveLength(3);
    expect(pointsFor(POETRY, 'akatan')).toBe(5);
  });

  it('scores Aotan for the three blue ribbons', () => {
    expect(BLUE).toHaveLength(3);
    expect(pointsFor(BLUE, 'aotan')).toBe(5);
  });

  it('does not score Akatan from plain red ribbons', () => {
    expect(pointsFor(PLAIN_RIBBONS.slice(0, 3), 'akatan')).toBe(0);
  });

  it('stacks Akatan + Aotan + Tanzaku(6) to 12 points', () => {
    const six = [...POETRY, ...BLUE];
    const result = evaluateYaku(six, STANDARD_RULES);
    expect(pointsFor(six, 'akatan')).toBe(5);
    expect(pointsFor(six, 'aotan')).toBe(5);
    expect(pointsFor(six, 'tanzaku')).toBe(2); // 1 at five ribbons, +1 for the sixth
    expect(result.base).toBe(12);
  });
});

describe('counting yaku', () => {
  it('scores Tane from five animals, +1 per extra', () => {
    expect(pointsFor(TANE.slice(0, 4), 'tane')).toBe(0);
    expect(pointsFor(TANE.slice(0, 5), 'tane')).toBe(1);
    expect(pointsFor(TANE.slice(0, 6), 'tane')).toBe(2);
    expect(pointsFor(TANE, 'tane')).toBe(5); // all nine animals
  });

  it('scores Tanzaku from five ribbons, +1 per extra', () => {
    expect(pointsFor(TANZAKU.slice(0, 4), 'tanzaku')).toBe(0);
    expect(pointsFor(TANZAKU.slice(0, 5), 'tanzaku')).toBe(1);
    expect(pointsFor(TANZAKU.slice(0, 7), 'tanzaku')).toBe(3);
    expect(pointsFor(TANZAKU, 'tanzaku')).toBe(6); // all ten ribbons
  });

  it('scores Kasu from ten chaff, +1 per extra', () => {
    expect(pointsFor(KASU.slice(0, 9), 'kasu')).toBe(0);
    expect(pointsFor(KASU.slice(0, 10), 'kasu')).toBe(1);
    expect(pointsFor(KASU.slice(0, 14), 'kasu')).toBe(5);
    expect(pointsFor(KASU, 'kasu')).toBe(15); // all 24 chaff
  });
});

describe('sake cup modes', () => {
  const nineChaffPlusCup = [...KASU.slice(0, 9), CARD_IDS.SAKE_CUP];

  it('tane-only: the cup does not complete a Kasu yaku', () => {
    expect(pointsFor(nineChaffPlusCup, 'kasu', STANDARD_RULES)).toBe(0);
  });

  it('tane-and-kasu: the cup completes a Kasu yaku', () => {
    const rules: RuleConfig = { ...STANDARD_RULES, sakeCupMode: 'tane-and-kasu' };
    expect(pointsFor(nineChaffPlusCup, 'kasu', rules)).toBe(1);
  });

  it('tane-and-kasu: the cup still counts as an animal and still makes Tsukimi-zake', () => {
    const rules: RuleConfig = { ...STANDARD_RULES, sakeCupMode: 'tane-and-kasu' };
    const held = [...TANE.slice(0, 4), CARD_IDS.SAKE_CUP, CARD_IDS.MOON];
    expect(TANE).toContain(CARD_IDS.SAKE_CUP);
    expect(pointsFor(held, 'tane', rules)).toBe(1);
    expect(pointsFor(held, 'tsukimi-zake', rules)).toBe(5);
  });
});

describe('tsuki-fuda', () => {
  const marchCards = DECK.filter((c) => c.month === 3).map((c) => c.id);

  it('is off by default', () => {
    expect(pointsFor(marchCards, 'tsuki-fuda')).toBe(0);
  });

  it('scores 4 for all four cards of the round month when enabled', () => {
    const rules: RuleConfig = { ...STANDARD_RULES, tsukiFudaEnabled: true };
    expect(evaluateYaku(marchCards, rules, 3).yaku.find((y) => y.id === 'tsuki-fuda')?.points).toBe(4);
  });

  it('does not score for a different month', () => {
    const rules: RuleConfig = { ...STANDARD_RULES, tsukiFudaEnabled: true };
    expect(evaluateYaku(marchCards, rules, 4).yaku.find((y) => y.id === 'tsuki-fuda')).toBeUndefined();
  });

  it('does not score with only three of the month', () => {
    const rules: RuleConfig = { ...STANDARD_RULES, tsukiFudaEnabled: true };
    expect(evaluateYaku(marchCards.slice(0, 3), rules, 3).yaku.find((y) => y.id === 'tsuki-fuda')).toBeUndefined();
  });
});

describe('combined hands', () => {
  it('scores an empty capture pile as zero', () => {
    expect(evaluateYaku([], STANDARD_RULES)).toEqual({ yaku: [], base: 0 });
  });

  it('scores a realistic mixed hand correctly', () => {
    // Goko(10) + Ino-Shika-Cho(5) + Hanami(5) + Tsukimi(5) + Tane(5 animals = 1)
    const named: CardId[] = [CARD_IDS.BOAR, CARD_IDS.DEER, CARD_IDS.BUTTERFLIES, CARD_IDS.SAKE_CUP];
    const held = [...BRIGHTS, ...named, TANE.find((t) => !named.includes(t))!];
    expect(yakuIds(held)).toEqual(
      ['goko', 'hanami-zake', 'ino-shika-cho', 'tane', 'tsukimi-zake'].sort(),
    );
    expect(evaluateYaku(held, STANDARD_RULES).base).toBe(10 + 5 + 5 + 5 + 1);
  });

  it('scores the whole deck identically under both presets except the brights', () => {
    const all = DECK.map((c) => c.id);
    const standard = evaluateYaku(all, STANDARD_RULES).base;
    const gamedesign = evaluateYaku(all, GAMEDESIGN_RULES).base;
    expect(gamedesign - standard).toBe(GAMEDESIGN_RULES.points.goko - STANDARD_RULES.points.goko);
  });
});

describe('teyaku', () => {
  const monthCards = (m: number) => DECK.filter((c) => c.month === m).map((c) => c.id);
  const pair = (m: number) => monthCards(m).slice(0, 2);

  it('scores Teshi for four cards of one month', () => {
    const hand = [...monthCards(1), ...pair(5), ...pair(9)];
    expect(hand).toHaveLength(8);
    const result = evaluateTeyaku(hand, STANDARD_RULES);
    expect(result.map((y) => y.id)).toEqual(['teshi']);
    expect(result[0]!.points).toBe(6);
  });

  it('scores Teshi once when the hand is two complete months', () => {
    // Teyaku is a flat instant win, not a per-combination total: a hand that is
    // two whole months is still one Teshi, not twelve points.
    const hand = [...monthCards(1), ...monthCards(2)];
    const result = evaluateTeyaku(hand, STANDARD_RULES);
    expect(result.map((y) => y.id)).toEqual(['teshi']);
    expect(result.reduce((s, y) => s + y.points, 0)).toBe(STANDARD_RULES.points.teshi);
  });

  it('scores Kuttsuki for four pairs', () => {
    const hand = [...pair(1), ...pair(3), ...pair(7), ...pair(12)];
    expect(hand).toHaveLength(8);
    const result = evaluateTeyaku(hand, STANDARD_RULES);
    expect(result.map((y) => y.id)).toEqual(['kuttsuki']);
    expect(result[0]!.points).toBe(6);
  });

  it('does not score a hand of three pairs and two singles', () => {
    const hand = [...pair(1), ...pair(3), ...pair(7), monthCards(9)[0]!, monthCards(12)[0]!];
    expect(evaluateTeyaku(hand, STANDARD_RULES)).toEqual([]);
  });

  it('returns nothing when teyaku are disabled', () => {
    const rules: RuleConfig = { ...STANDARD_RULES, teyakuEnabled: false };
    expect(evaluateTeyaku([...monthCards(1), ...pair(5), ...pair(9)], rules)).toEqual([]);
  });
});

describe('yakuForCard', () => {
  const of = (id: CardId, rules: RuleConfig = STANDARD_RULES) => yakuForCard(id, rules).sort();

  it('offers every brights yaku to an ordinary bright', () => {
    // Ame-Shiko included: it is the Rain Man plus any three of the others, so
    // every bright is a candidate for it.
    expect(of(CARD_IDS.CRANE)).toEqual(['ame-shiko', 'goko', 'sanko', 'shiko']);
    expect(of(CARD_IDS.PHOENIX)).toEqual(['ame-shiko', 'goko', 'sanko', 'shiko']);
  });

  it('excludes the Rain Man from Shiko and Sanko', () => {
    // The rule the UI most needs to convey: this bright is worth less.
    expect(of(CARD_IDS.RAIN_MAN)).toEqual(['ame-shiko', 'goko']);
    expect(of(CARD_IDS.RAIN_MAN)).not.toContain('shiko');
    expect(of(CARD_IDS.RAIN_MAN)).not.toContain('sanko');
  });

  it('names Ino-Shika-Cho for its three cards only', () => {
    for (const id of [CARD_IDS.BOAR, CARD_IDS.DEER, CARD_IDS.BUTTERFLIES]) {
      expect(of(id), id).toContain('ino-shika-cho');
    }
    expect(of(CARD_IDS.SAKE_CUP)).not.toContain('ino-shika-cho');
  });

  it('gives the Sake Cup both drinking yaku', () => {
    expect(of(CARD_IDS.SAKE_CUP)).toEqual(['hanami-zake', 'tane', 'tsukimi-zake']);
  });

  it('gives the Curtain and Moon their own drinking yaku', () => {
    expect(of(CARD_IDS.CURTAIN)).toContain('hanami-zake');
    expect(of(CARD_IDS.CURTAIN)).not.toContain('tsukimi-zake');
    expect(of(CARD_IDS.MOON)).toContain('tsukimi-zake');
    expect(of(CARD_IDS.MOON)).not.toContain('hanami-zake');
  });

  it('separates poetry, blue and plain ribbons', () => {
    expect(of(POETRY[0] as CardId)).toEqual(['akatan', 'tanzaku']);
    expect(of(BLUE[0] as CardId)).toEqual(['aotan', 'tanzaku']);
    expect(of(PLAIN_RIBBONS[0] as CardId)).toEqual(['tanzaku']);
  });

  it('gives chaff only the Kasu yaku', () => {
    const chaff = KASU[0] as CardId;
    expect(of(chaff)).toEqual(['kasu']);
  });

  it('adds Kasu to the Sake Cup only under the tane-and-kasu rule', () => {
    const rules: RuleConfig = { ...STANDARD_RULES, sakeCupMode: 'tane-and-kasu' };
    expect(of(CARD_IDS.SAKE_CUP)).not.toContain('kasu');
    expect(of(CARD_IDS.SAKE_CUP, rules)).toContain('kasu');
  });

  it('covers every card in the deck without throwing', () => {
    for (const card of DECK) {
      const list = yakuForCard(card.id, STANDARD_RULES);
      expect(list.length, card.id).toBeGreaterThan(0);
      expect(new Set(list).size, `${card.id} lists a yaku twice`).toBe(list.length);
    }
  });
});
