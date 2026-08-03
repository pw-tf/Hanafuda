/**
 * Reactions, for room games.
 *
 * Two halves that never talk to each other: a picker in the top bar that
 * sends, and a burst over the table that shows what arrived. Sending your own
 * shows it on your side too — a reaction you cannot see yourself send is
 * indistinguishable from one that never left.
 *
 * The burst is announcement, not dialogue: `pointer-events: none` throughout,
 * so a reaction landing mid-turn cannot swallow a tap meant for a card. This
 * is the same rule the Koi-Koi banner follows, and for the same reason.
 */

import { useEffect, useRef, useState } from 'react';
import { EMOTES, EMOTE_COOLDOWN_MS, emote, type EmoteId } from '../../net/protocol';

/** Must outlast the CSS animation; see .emote in the stylesheet. */
const BURST_MS = 2000;

export function EmotePicker({
  disabled,
  onSend,
}: {
  disabled: boolean;
  onSend(id: EmoteId): void;
}) {
  const [open, setOpen] = useState(false);
  /** Set on send, cleared when the cooldown expires. */
  const [cooling, setCooling] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  // A disconnect mid-pick would otherwise leave the tray open over a table
  // nobody can react to.
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const choose = (id: EmoteId) => {
    onSend(id);
    setOpen(false);
    setCooling(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCooling(false), EMOTE_COOLDOWN_MS);
  };

  return (
    <div className="emotes">
      <button
        type="button"
        className={`emotes__toggle${open ? ' emotes__toggle--open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        disabled={disabled || cooling}
        aria-expanded={open}
        aria-label={cooling ? 'Reactions — wait a moment' : 'Send a reaction'}
      >
        <span aria-hidden="true">😀</span>
      </button>

      {open && (
        <>
          {/* Catches the tap that closes the tray. Sits under it, over
              everything else, so the first tap outside dismisses rather than
              landing on a card. */}
          <button
            type="button"
            className="emotes__scrim"
            tabIndex={-1}
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <div className="emotes__tray" role="group" aria-label="Reactions">
            {EMOTES.map((e) => (
              <button
                key={e.id}
                type="button"
                className="emotes__pick"
                onClick={() => choose(e.id)}
                aria-label={e.label}
              >
                <span aria-hidden="true">{e.glyph}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * One reaction, played over the table and then gone.
 *
 * Keyed on the nonce rather than the id so the same face sent twice replays
 * instead of sitting there — restarting a CSS animation means a new element.
 */
export function EmoteBurst({
  nonce,
  id,
  from,
  name,
  onDone,
}: {
  nonce: number;
  id: EmoteId;
  /** Which side of the table it rises from. */
  from: 'me' | 'them';
  name: string;
  onDone(): void;
}) {
  useEffect(() => {
    const t = setTimeout(onDone, BURST_MS);
    return () => clearTimeout(t);
  }, [nonce, onDone]);

  const { glyph, label } = emote(id);

  return (
    <div className={`emote emote--${from}`} key={nonce} role="status" aria-live="polite">
      <span className="emote__glyph" aria-hidden="true">
        {glyph}
      </span>
      <span className="emote__who">
        {name}: {label}
      </span>
    </div>
  );
}
