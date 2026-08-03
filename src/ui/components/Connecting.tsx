/**
 * Blocking overlay shown until both peers are actually connected.
 *
 * Relay bootstrap is not instant — Nostr in particular can take several
 * seconds to find a working relay and complete the handshake. Without this
 * the host is handed a playable table straight away and can take a turn
 * before anyone is on the other end, and the guest stares at a bare screen
 * with no sign anything is happening.
 *
 * The elapsed counter matters: a spinner alone gives no way to tell "still
 * working" from "quietly stuck".
 *
 * A drop mid-game is *not* the end of the game. Trystero writes a peer off
 * after five seconds in the `disconnected` state, which a phone reaches just
 * by having its browser put in the background, and the room stays joined and
 * keeps redialling throughout. So this says "reconnecting", counts, and
 * offers leaving as a choice rather than as the only button on screen.
 */

import { useEffect, useState } from 'react';
import type { ConnectionStatus } from '../../net/room';
import { STRATEGY_LABEL, type Strategy } from '../../net/protocol';

const HEADLINE: Record<ConnectionStatus, string> = {
  idle: 'Starting up…',
  connecting: 'Connecting…',
  waiting: 'Waiting for the other player',
  connected: 'Connected',
  'peer-left': 'Reconnecting…',
  error: 'Could not connect',
};

/** How long a drop goes on before it is worth saying they may not be coming. */
const LIKELY_GONE_S = 45;

export function Connecting({
  status,
  detail,
  roomCode,
  strategy,
  isHost,
  onCancel,
}: {
  status: ConnectionStatus;
  detail: string | null;
  roomCode: string | undefined;
  strategy: Strategy;
  isHost: boolean;
  onCancel(): void;
}) {
  const [elapsed, setElapsed] = useState(0);

  /** A drop after play started, as opposed to never having connected at all. */
  const dropped = status === 'peer-left';
  const failed = status === 'error';

  // Counted from the drop, not from mount: on a table that has been up for ten
  // minutes, "600s" says nothing about how long the reconnect has been going.
  useEffect(() => {
    setElapsed(0);
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [dropped]);

  return (
    <div className="connecting" role="status" aria-live="polite">
      {!failed && <div className="spinner" aria-hidden="true" />}

      <h2>{HEADLINE[status]}</h2>

      {roomCode && (
        <div className="connecting__code" aria-label={`Room code ${roomCode.split('').join(' ')}`}>
          {roomCode.split('').map((ch, i) => (
            <span key={i}>{ch}</span>
          ))}
        </div>
      )}

      <p>
        {dropped
          ? 'Switching apps is usually all it takes. The room is still open and the game is held where it was — this normally sorts itself out.'
          : isHost
            ? 'Share this code with the other player. The game starts as soon as they join.'
            : 'Finding the host. Make sure you both picked the same connection method.'}
      </p>

      <p>
        Via {STRATEGY_LABEL[strategy]}
        {detail ? ` · ${detail}` : ''}
      </p>

      {!failed && elapsed > 4 && (
        <p className="connecting__elapsed">
          {dropped
            ? `${elapsed}s — still holding the room open${
                elapsed > LIKELY_GONE_S
                  ? '. They may have closed the game; the code still works if they come back.'
                  : '…'
              }`
            : `${elapsed}s — relays can take a while to find each other${
                elapsed > 25 ? '. Still trying; the other connection method may work better.' : '…'
              }`}
        </p>
      )}

      <button type="button" className="btn btn--ghost" onClick={onCancel}>
        {failed ? 'Back' : dropped ? 'Leave game' : 'Cancel'}
      </button>
    </div>
  );
}
