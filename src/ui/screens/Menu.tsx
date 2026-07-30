import { CardFace } from '../../art/CardFace';
import { CARD_IDS } from '../../engine/cards';
import { Attribution } from './Gallery';

/**
 * The home screen: what you want to do, and nothing about how.
 *
 * The two ways to play are the only choices here — the settings that shape a
 * game (which opponent, which device) live one level down, on the screen for
 * the mode they belong to, so the first screen stays a short list of
 * destinations rather than a form.
 */
export function Menu({
  onSinglePlayer,
  onTwoPlayer,
  onSettings,
  onGallery,
  onHowToPlay,
  resumable,
  onResume,
  onDiscardSave,
}: {
  onSinglePlayer(): void;
  onTwoPlayer(): void;
  onSettings(): void;
  onGallery(): void;
  onHowToPlay(): void;
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

        <button
          type="button"
          className="btn btn--primary btn--wide btn--stack"
          onClick={onSinglePlayer}
        >
          Single player
          <span className="btn__sub">Against the computer</span>
        </button>
        <button type="button" className="btn btn--wide btn--stack" onClick={onTwoPlayer}>
          Two players
          <span className="btn__sub">On this device, or online by room code</span>
        </button>

        <div className="menu__row">
          <button type="button" className="btn btn--ghost" onClick={onSettings}>
            Settings
          </button>
          <button type="button" className="btn btn--ghost" onClick={onGallery}>
            Card deck
          </button>
        </div>

        <button type="button" className="btn btn--ghost btn--wide" onClick={onHowToPlay}>
          How to play
        </button>

        <Attribution />
      </div>
    </div>
  );
}
