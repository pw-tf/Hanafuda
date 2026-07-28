import { DIFFICULTY_BLURB, DIFFICULTY_LABEL, type Difficulty } from '../../ai';
import { CardFace } from '../../art/CardFace';
import { CARD_IDS } from '../../engine/cards';
import { Attribution } from './Gallery';

export function Menu({
  difficulty,
  onDifficulty,
  onPlayAi,
  onPlayLocal,
  onMultiplayer,
  onSettings,
  onGallery,
  resumable,
  onResume,
  onDiscardSave,
}: {
  difficulty: Difficulty;
  onDifficulty(next: Difficulty): void;
  onPlayAi(): void;
  onPlayLocal(): void;
  onMultiplayer(): void;
  onSettings(): void;
  onGallery(): void;
  /** Description of a saved game in progress, if there is one. */
  resumable: string | null;
  onResume(): void;
  onDiscardSave(): void;
}) {
  return (
    <div className="screen screen--menu">
      <div className="hero">
        <div className="hero__cards">
          <CardFace id={CARD_IDS.CRANE} width={72} />
          <CardFace id={CARD_IDS.CURTAIN} width={72} />
          <CardFace id={CARD_IDS.MOON} width={72} />
        </div>
        <h1>
          Hanafuda
          <em>こいこい</em>
        </h1>
        <p className="hero__sub">Koi-Koi for two players</p>
      </div>

      <div className="menu">
        {resumable && (
          <div className="resume">
            <button type="button" className="btn btn--primary btn--wide" onClick={onResume}>
              Resume game
              <span className="resume__detail">{resumable}</span>
            </button>
            <button type="button" className="resume__discard" onClick={onDiscardSave}>
              Discard saved game
            </button>
          </div>
        )}

        <div className="menu__group">
          <label className="menu__label" id="difficulty-label">
            Opponent
          </label>
          <div className="segmented" role="group" aria-labelledby="difficulty-label">
            {(['easy', 'normal', 'hard'] as Difficulty[]).map((d) => (
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
        </div>

        <button type="button" className="btn btn--primary btn--wide" onClick={onPlayAi}>
          Play the computer
        </button>
        <button type="button" className="btn btn--wide" onClick={onMultiplayer}>
          Play a friend by room code
        </button>
        <button type="button" className="btn btn--wide" onClick={onPlayLocal}>
          Pass and play
        </button>

        <div className="menu__row">
          <button type="button" className="btn btn--ghost" onClick={onSettings}>
            Rules
          </button>
          <button type="button" className="btn btn--ghost" onClick={onGallery}>
            Card deck
          </button>
        </div>

        <Attribution />
      </div>
    </div>
  );
}
