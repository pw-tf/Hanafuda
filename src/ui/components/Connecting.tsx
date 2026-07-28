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
 */

import { useEffect, useState } from 'react';
import type { ConnectionStatus } from '../../net/room';
import { STRATEGY_LABEL, type Strategy } from '../../net/protocol';

const HEADLINE: Record<ConnectionStatus, string> = {
  idle: 'Starting up…',
  connecting: 'Connecting…',
  waiting: 'Waiting for the other player',
  connected: 'Connected',
  'peer-left': 'The other player disconnected',
  error: 'Could not connect',
};

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

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);

  const failed = status === 'error' || status === 'peer-left';

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
        {isHost
          ? 'Share this code with the other player. The game starts as soon as they join.'
          : 'Finding the host. Make sure you both picked the same connection method.'}
      </p>

      <p>
        Via {STRATEGY_LABEL[strategy]}
        {detail ? ` · ${detail}` : ''}
      </p>

      {!failed && elapsed > 4 && (
        <p className="connecting__elapsed">
          {elapsed}s — relays can take a while to find each other
          {elapsed > 25 ? '. Still trying; the other connection method may work better.' : '…'}
        </p>
      )}

      <button type="button" className="btn btn--ghost" onClick={onCancel}>
        {failed ? 'Back' : 'Cancel'}
      </button>
    </div>
  );
}
