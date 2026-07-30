/**
 * The two ways two people can play: one device passed between them, or two
 * devices joined by a room code. Both are the same game — the choice is only
 * about where the second player is sitting.
 */
export function TwoPlayer({
  onPassAndPlay,
  onOnline,
  onBack,
}: {
  onPassAndPlay(): void;
  onOnline(): void;
  onBack(): void;
}) {
  return (
    <div className="screen screen--setup">
      <header className="topbar">
        <button type="button" className="topbar__back" onClick={onBack} aria-label="Back">
          ‹
        </button>
        <div className="topbar__mid">
          <strong>Two players</strong>
        </div>
        <div className="topbar__score" />
      </header>

      <section className="card">
        <h2>Same device</h2>
        <p className="muted small">
          Pass and play. The hand on screen is whoever's turn it is; hand the phone over when the
          turn ends.
        </p>
        <button type="button" className="btn btn--primary btn--wide" onClick={onPassAndPlay}>
          Start game
        </button>
      </section>

      <section className="card">
        <h2>Online</h2>
        <p className="muted small">
          Share a room code with a friend. Cards go directly between the two devices, end-to-end
          encrypted.
        </p>
        <button type="button" className="btn btn--wide" onClick={onOnline}>
          Room code
        </button>
      </section>
    </div>
  );
}
