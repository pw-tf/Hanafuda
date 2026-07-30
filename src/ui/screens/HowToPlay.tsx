/**
 * How to play, in outline.
 *
 * Deliberately short for now: it covers the loop a first-time player needs to
 * take a turn without guessing. The full rules — every yaku, teyaku, the
 * scoring tables and the optional variants — are still being written, and the
 * yaku list is already readable in-game from the capture summary.
 */
export function HowToPlay({ onBack }: { onBack(): void }) {
  return (
    <div className="screen screen--howto">
      <header className="topbar">
        <button type="button" className="topbar__back" onClick={onBack} aria-label="Back">
          ‹
        </button>
        <div className="topbar__mid">
          <strong>How to play</strong>
        </div>
        <div className="topbar__score" />
      </header>

      <section className="card">
        <h2>The idea</h2>
        <p className="muted small">
          A 48-card flower deck: twelve months, four cards each. You collect cards by matching
          months, and sets of the cards you collect — yaku — are what score. Reach one and you
          choose to stop and bank it, or call koi-koi and play on for more.
        </p>
      </section>

      <section className="card">
        <h2>A turn</h2>
        <ol className="steps">
          <li>Play a card from your hand. If a field card shares its month, you take both.</li>
          <li>
            Flip the top card of the deck onto the field. It matches the same way, and anything it
            takes is yours too.
          </li>
          <li>The turn passes. The round ends when both hands are empty.</li>
        </ol>
      </section>

      <section className="card">
        <h2>Matching</h2>
        <p className="muted small">Both the card you play and the card you flip follow this rule.</p>
        <dl className="deflist deflist--wide">
          <div>
            <dt>No field card of that month</dt>
            <dd>It stays on the field</dd>
          </div>
          <div>
            <dt>One</dt>
            <dd>Take both</dd>
          </div>
          <div>
            <dt>Two</dt>
            <dd>Choose which to take</dd>
          </div>
          <div>
            <dt>Three</dt>
            <dd>Take all four</dd>
          </div>
        </dl>
      </section>

      <section className="card">
        <h2>Koi-koi</h2>
        <p className="muted small">
          Complete a yaku and the round stops for your decision. Bank it and the round ends at that
          score. Call koi-koi and play on: your total keeps climbing, but if your opponent scores
          first they take the round — and every koi-koi called multiplies whatever is finally won.
        </p>
      </section>

      <section className="card">
        <h2>More to come</h2>
        <p className="muted small">
          The full rules — every yaku and its point value, hand yaku, and the optional variants in
          Settings — are being written and will land here. In the meantime, the capture summary at
          the table lists the yaku and how close you are to each.
        </p>
      </section>
    </div>
  );
}
