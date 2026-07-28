import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DECK } from '../../engine/cards';

/**
 * The card faces are static files rather than compiled modules, so nothing in
 * the type system notices if one goes missing or is renamed. These tests are
 * what stands between a bad asset sync and a deck of broken-image icons.
 */

const CARDS_DIR = join(process.cwd(), 'public', 'cards');

describe('card face assets', () => {
  it('has exactly one SVG per card and no strays', () => {
    const files = readdirSync(CARDS_DIR).filter((f) => f.endsWith('.svg'));
    expect(files).toHaveLength(48);
    expect(new Set(files).size).toBe(48);

    const expected = new Set(DECK.map((c) => `${c.id}.svg`));
    expect(new Set(files)).toEqual(expected);
  });

  it('every card id resolves to a file', () => {
    for (const card of DECK) {
      expect(existsSync(join(CARDS_DIR, `${card.id}.svg`)), card.id).toBe(true);
    }
  });

  it('every file is non-trivial, valid-looking SVG', () => {
    for (const card of DECK) {
      const svg = readFileSync(join(CARDS_DIR, `${card.id}.svg`), 'utf8');
      expect(svg.slice(0, 200), card.id).toContain('<svg');
      expect(svg.trimEnd().endsWith('</svg>'), `${card.id} is truncated`).toBe(true);
      // The smallest genuine card (August chaff) is ~5 kB; anything much
      // under that is a placeholder or a failed download.
      expect(svg.length, `${card.id} is suspiciously small`).toBeGreaterThan(2000);
    }
  });

  it('every card shares the same viewBox, so the deck is dimensionally uniform', () => {
    for (const card of DECK) {
      const svg = readFileSync(join(CARDS_DIR, `${card.id}.svg`), 'utf8');
      expect(svg, card.id).toContain('viewBox="0 0 976 1600"');
    }
  });

  it('contains no embedded raster images', () => {
    for (const card of DECK) {
      const svg = readFileSync(join(CARDS_DIR, `${card.id}.svg`), 'utf8');
      expect(svg, `${card.id} embeds a bitmap`).not.toMatch(/data:image\/(png|jpe?g)/);
    }
  });

  it('records provenance for every card, so attribution stays traceable', () => {
    const credits = JSON.parse(readFileSync(join(CARDS_DIR, 'CREDITS.json'), 'utf8')) as {
      author: string;
      license: string;
      cards: Record<string, { originalFile: string }>;
    };

    expect(credits.author).toBe('Louie Mantia, Jr.');
    expect(credits.license).toBe('CC BY-SA 4.0');
    expect(Object.keys(credits.cards)).toHaveLength(48);

    for (const card of DECK) {
      const entry = credits.cards[card.id];
      expect(entry, `no credit entry for ${card.id}`).toBeDefined();
      expect(entry?.originalFile, card.id).toMatch(/^Hanafuda_[A-Z][a-z]+_(Hikari|Tane|Tanzaku|Kasu)(_\d)?\.svg$/);
    }

    // Each source file must be claimed by exactly one card.
    const originals = Object.values(credits.cards).map((c) => c.originalFile);
    expect(new Set(originals).size).toBe(48);
  });

  it('maps each card to the source file matching its month and kind', () => {
    const credits = JSON.parse(readFileSync(join(CARDS_DIR, 'CREDITS.json'), 'utf8')) as {
      cards: Record<string, { originalFile: string }>;
    };
    const MONTHS = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    const KIND = { hikari: 'Hikari', tane: 'Tane', tanzaku: 'Tanzaku', kasu: 'Kasu' } as const;

    for (const card of DECK) {
      const file = credits.cards[card.id]?.originalFile ?? '';
      expect(file, card.id).toContain(`_${MONTHS[card.month - 1]}_`);
      expect(file, card.id).toContain(`_${KIND[card.kind]}`);
    }
  });
});
