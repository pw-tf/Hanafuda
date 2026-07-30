import { DIFFICULTIES, DIFFICULTY_BLURB, DIFFICULTY_LABEL, type Difficulty } from '../../ai';

/**
 * Setup for a game against the computer.
 *
 * The opponent is chosen here rather than on the home screen because it only
 * means anything for this mode, and because it is remembered between games —
 * on the home screen it read as a decision to make every visit.
 */
export function SinglePlayer({
  difficulty,
  onDifficulty,
  onStart,
  onBack,
}: {
  difficulty: Difficulty;
  onDifficulty(next: Difficulty): void;
  onStart(): void;
  onBack(): void;
}) {
  return (
    <div className="screen screen--setup">
      <header className="topbar">
        <button type="button" className="topbar__back" onClick={onBack} aria-label="Back">
          ‹
        </button>
        <div className="topbar__mid">
          <strong>Single player</strong>
        </div>
        <div className="topbar__score" />
      </header>

      <section className="card">
        <h2>Opponent</h2>
        <p className="muted small">
          They differ in what they pay attention to, not in how long they think about it.
        </p>
        <div className="segmented" role="group" aria-label="Difficulty">
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              type="button"
              className={`segmented__btn ${difficulty === d ? 'is-on' : ''}`}
              onClick={() => onDifficulty(d)}
              aria-pressed={difficulty === d}
            >
              {DIFFICULTY_LABEL[d]}
            </button>
          ))}
        </div>
        <p className="menu__hint">{DIFFICULTY_BLURB[difficulty]}</p>
      </section>

      <button type="button" className="btn btn--primary btn--wide" onClick={onStart}>
        Start game
      </button>
    </div>
  );
}
