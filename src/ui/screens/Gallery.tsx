/**
 * Visual proof sheet for the deck. Renders all 48 faces grouped by month with
 * their name and category, so the whole deck can be checked against the card
 * table in one screen.
 */

import { DECK, MONTH_NAMES, type Month } from '../../engine/cards';
import { CardBack, CardFace } from '../../art/CardFace';

const KIND_LABEL: Record<string, string> = {
  hikari: 'Bright',
  tane: 'Animal',
  tanzaku: 'Ribbon',
  kasu: 'Chaff',
};

const RIBBON_LABEL: Record<string, string> = {
  'red-poetry': 'poetry',
  'red-plain': 'plain',
  blue: 'blue',
};

export function Gallery({ onBack }: { onBack(): void }) {
  const months = Array.from({ length: 12 }, (_, i) => (i + 1) as Month);

  return (
    <div className="gallery">
      <header className="topbar">
        <button type="button" className="topbar__back" onClick={onBack} aria-label="Back">
          ‹
        </button>
        <div className="topbar__mid">
          <strong>Card deck</strong>
        </div>
        <div className="topbar__score" />
      </header>

      <header className="gallery__head">
        <h1>Hanafuda deck</h1>
        <p>
          48 cards — {DECK.filter((c) => c.kind === 'hikari').length} bright,{' '}
          {DECK.filter((c) => c.kind === 'tane').length} animal,{' '}
          {DECK.filter((c) => c.kind === 'tanzaku').length} ribbon,{' '}
          {DECK.filter((c) => c.kind === 'kasu').length} chaff
        </p>
      </header>

      {months.map((month) => {
        const cards = DECK.filter((c) => c.month === month);
        const first = cards[0];
        return (
          <section key={month} className="gallery__month">
            <h2>
              <span className="gallery__num">{month}</span>
              {MONTH_NAMES[month]} — {first?.suit} <span className="gallery__ja">{first?.suitJa}</span>
            </h2>
            <div className="gallery__row">
              {cards.map((card) => (
                <figure key={card.id} className="gallery__card">
                  <CardFace id={card.id} width={104} />
                  <figcaption>
                    <strong>{card.name}</strong>
                    <span className="gallery__ja">{card.nameJa}</span>
                    <em>
                      {KIND_LABEL[card.kind]}
                      {card.ribbon ? ` · ${RIBBON_LABEL[card.ribbon]}` : ''} · {card.points}
                    </em>
                    <code>{card.id}</code>
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        );
      })}

      <section className="gallery__month">
        <h2>
          <span className="gallery__num">—</span>Card back
        </h2>
        <div className="gallery__row">
          <figure className="gallery__card">
            <CardBack width={104} />
            <figcaption>
              <strong>Reverse</strong>
              <em>opponent hand &amp; draw pile</em>
            </figcaption>
          </figure>
        </div>
      </section>

      <Attribution />
    </div>
  );
}

/**
 * Required by the artwork's licence, not decoration: CC BY-SA 4.0 obliges us
 * to credit the author, name the licence and link to it wherever the work is
 * shown. Also rendered in the menu footer.
 */
export function Attribution() {
  return (
    <footer className="credit">
      <p>
        Card artwork by{' '}
        <a href="https://commons.wikimedia.org/wiki/Special:ListFiles/Louiemantia" target="_blank" rel="noreferrer">
          Louie Mantia, Jr.
        </a>
        , from Wikimedia Commons, used unmodified under{' '}
        <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">
          CC BY-SA 4.0
        </a>
        .
      </p>
    </footer>
  );
}
