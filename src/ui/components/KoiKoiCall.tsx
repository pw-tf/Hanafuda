/**
 * The announcement that fires when the *other* player calls Koi-Koi.
 *
 * Their decision changes the stakes for you — the multiplier just went up and
 * they are still hunting — so it cannot be left to a quietly incremented
 * counter on their capture bar. It plays over the table, blocks nothing, and
 * clears itself.
 *
 * It is announcement, not dialogue: `pointer-events: none` throughout, so a
 * tap aimed at the board during the ~1.7s it is up still reaches the board.
 */

import { useEffect, useState } from 'react';

/** Must outlast the CSS animation; see .koicall in the stylesheet. */
const HOLD_MS = 1700;

export function KoiKoiCall({
  /** Changes every time a call happens, which is what re-triggers the banner. */
  callId,
  name,
  calls,
  onDone,
}: {
  callId: number;
  name: string;
  /** How many times they have called this round. */
  calls: number;
  onDone(): void;
}) {
  // Keyed remount would be the other way to restart the animation, but the
  // timer has to restart too, so the id drives both from one effect.
  const [shown, setShown] = useState(callId);

  useEffect(() => {
    setShown(callId);
    const timer = setTimeout(onDone, HOLD_MS);
    return () => clearTimeout(timer);
  }, [callId, onDone]);

  return (
    <div className="koicall" role="status" aria-live="polite" key={shown}>
      <div className="koicall__inner">
        <span className="koicall__ja" aria-hidden="true">
          こいこい
        </span>
        <strong className="koicall__word">Koi-Koi!</strong>
        <span className="koicall__who">
          {name} is playing on{calls > 1 ? ` · call ${calls}` : ''}
        </span>
      </div>
    </div>
  );
}
