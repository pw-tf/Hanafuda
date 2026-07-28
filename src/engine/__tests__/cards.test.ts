import { describe, expect, it } from 'vitest';
import { ALL_CARD_IDS, CARD_IDS, DECK, getCard, idsOfMonth, type Month } from '../cards';

/**
 * Structural guards on the deck. If someone edits `cards.ts` and breaks the
 * composition, this fails here rather than producing quietly wrong scores.
 */
describe('deck structure', () => {
  it('has exactly 48 cards with unique ids', () => {
    expect(DECK).toHaveLength(48);
    expect(new Set(ALL_CARD_IDS).size).toBe(48);
  });

  it('splits 5 hikari / 9 tane / 10 tanzaku / 24 kasu', () => {
    const count = (kind: string) => DECK.filter((c) => c.kind === kind).length;
    expect(count('hikari')).toBe(5);
    expect(count('tane')).toBe(9);
    expect(count('tanzaku')).toBe(10);
    expect(count('kasu')).toBe(24);
    expect(count('hikari') + count('tane') + count('tanzaku') + count('kasu')).toBe(48);
  });

  it('has exactly 4 cards in every month', () => {
    for (let m = 1 as Month; m <= 12; m = (m + 1) as Month) {
      expect(idsOfMonth(m), `month ${m}`).toHaveLength(4);
    }
  });

  it('places the five brights in Jan, Mar, Aug, Nov and Dec', () => {
    const brightMonths = DECK.filter((c) => c.kind === 'hikari').map((c) => c.month).sort((a, b) => a - b);
    expect(brightMonths).toEqual([1, 3, 8, 11, 12]);
  });

  it('places the nine tane in Feb, Apr, May, Jun, Jul, Aug, Sep, Oct and Nov', () => {
    const taneMonths = DECK.filter((c) => c.kind === 'tane').map((c) => c.month).sort((a, b) => a - b);
    expect(taneMonths).toEqual([2, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it('has 3 poetry ribbons, 4 plain ribbons and 3 blue ribbons', () => {
    const ribbons = DECK.filter((c) => c.kind === 'tanzaku');
    expect(ribbons).toHaveLength(10);
    expect(ribbons.filter((c) => c.ribbon === 'red-poetry').map((c) => c.month).sort((a, b) => a - b))
      .toEqual([1, 2, 3]);
    expect(ribbons.filter((c) => c.ribbon === 'blue').map((c) => c.month).sort((a, b) => a - b))
      .toEqual([6, 9, 10]);
    expect(ribbons.filter((c) => c.ribbon === 'red-plain').map((c) => c.month).sort((a, b) => a - b))
      .toEqual([4, 5, 7, 11]);
  });

  it('only tanzaku carry a ribbon colour', () => {
    for (const card of DECK) {
      if (card.kind === 'tanzaku') expect(card.ribbon, card.id).toBeDefined();
      else expect(card.ribbon, card.id).toBeUndefined();
    }
  });

  // The two months that are most often transcribed wrongly.
  it('gives November one card of each kind', () => {
    const kinds = idsOfMonth(11).map((id) => getCard(id).kind).sort();
    expect(kinds).toEqual(['hikari', 'kasu', 'tane', 'tanzaku']);
  });

  it('gives December one bright and three chaff', () => {
    const kinds = idsOfMonth(12).map((id) => getCard(id).kind).sort();
    expect(kinds).toEqual(['hikari', 'kasu', 'kasu', 'kasu']);
  });

  it('assigns 20/10/5/1 card points by kind', () => {
    for (const card of DECK) {
      const expected = { hikari: 20, tane: 10, tanzaku: 5, kasu: 1 }[card.kind];
      expect(card.points, card.id).toBe(expected);
    }
  });

  it('points the named card ids at the right cards', () => {
    expect(getCard(CARD_IDS.CRANE)).toMatchObject({ month: 1, kind: 'hikari' });
    expect(getCard(CARD_IDS.CURTAIN)).toMatchObject({ month: 3, kind: 'hikari' });
    expect(getCard(CARD_IDS.BUTTERFLIES)).toMatchObject({ month: 6, kind: 'tane' });
    expect(getCard(CARD_IDS.BOAR)).toMatchObject({ month: 7, kind: 'tane' });
    expect(getCard(CARD_IDS.MOON)).toMatchObject({ month: 8, kind: 'hikari' });
    expect(getCard(CARD_IDS.SAKE_CUP)).toMatchObject({ month: 9, kind: 'tane' });
    expect(getCard(CARD_IDS.DEER)).toMatchObject({ month: 10, kind: 'tane' });
    expect(getCard(CARD_IDS.RAIN_MAN)).toMatchObject({ month: 11, kind: 'hikari' });
    expect(getCard(CARD_IDS.PHOENIX)).toMatchObject({ month: 12, kind: 'hikari' });
  });

  it('throws on an unknown card id', () => {
    expect(() => getCard('nope')).toThrow(/Unknown card id/);
  });
});
