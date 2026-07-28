/**
 * Trystero wrapper: joins a room by code and exposes a small typed surface.
 *
 * Trystero handles signalling over a public relay network and then upgrades
 * to a direct, end-to-end encrypted WebRTC data channel. There is no
 * signalling server of our own, so the app stays purely static-hostable.
 *
 * Relay reachability varies by network, so the strategy is selectable and the
 * lobby can retry on MQTT when the default Nostr relays are blocked.
 */

import { joinRoom as joinNostr, selfId } from 'trystero';
import { joinRoom as joinMqtt } from '@trystero-p2p/mqtt';
import type { GameState, Move } from '../engine/game';
import type { RuleConfig } from '../engine/rules';
import {
  ACTIONS,
  PROTOCOL_VERSION,
  type Strategy,
  encodeMove,
  encodeRules,
  encodeState,
  type HelloMessage,
  type IntentMessage,
  type RejectMessage,
  type StateMessage,
} from './protocol';

export type { Strategy };
export { STRATEGY_LABEL } from './protocol';

const APP_ID = 'hanafuda-koikoi-p2p';

export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'waiting'
  | 'connected'
  | 'peer-left'
  | 'error';

export interface RoomHandlers {
  onStatus(status: ConnectionStatus, detail?: string): void;
  onHello(message: HelloMessage): void;
  onState(message: StateMessage): void;
  onIntent(message: IntentMessage, peerId: string): void;
  onReject(message: RejectMessage): void;
}

export interface RoomHandle {
  readonly selfId: string;
  readonly strategy: Strategy;
  sendHello(rules: RuleConfig): void;
  sendState(state: GameState, seq: number): void;
  sendIntent(move: Move): void;
  sendReject(message: Omit<RejectMessage, 'v'>): void;
  peers(): string[];
  leave(): void;
}

/** How long to wait for a peer before suggesting the relay may be blocked. */
const BOOTSTRAP_TIMEOUT_MS = 15_000;

/**
 * Join `code`. The room password is derived from the code, so only someone
 * holding the code can complete the handshake.
 */
export function connectRoom(
  code: string,
  handlers: RoomHandlers,
  strategy: Strategy = 'nostr',
): RoomHandle {
  const config = { appId: APP_ID, password: `koikoi-${code}` };
  const join = strategy === 'mqtt' ? joinMqtt : joinNostr;
  const room = join(config, code);

  handlers.onStatus('connecting');

  const hello = room.makeAction<HelloMessage>(ACTIONS.hello);
  const state = room.makeAction<StateMessage>(ACTIONS.state);
  const intent = room.makeAction<IntentMessage>(ACTIONS.intent);
  const reject = room.makeAction<RejectMessage>(ACTIONS.reject);

  const connected = new Set<string>();
  let bootstrapped = false;

  const bootstrapTimer = setTimeout(() => {
    if (!bootstrapped) {
      handlers.onStatus(
        'waiting',
        'Still looking for the other player. Double-check the code — or if your network blocks peer-to-peer relays, try the alternate connection method.',
      );
    }
  }, BOOTSTRAP_TIMEOUT_MS);

  room.onPeerJoin = (peerId: string) => {
    bootstrapped = true;
    clearTimeout(bootstrapTimer);
    connected.add(peerId);
    handlers.onStatus('connected');
  };

  room.onPeerLeave = (peerId: string) => {
    connected.delete(peerId);
    handlers.onStatus(connected.size === 0 ? 'peer-left' : 'connected');
  };

  hello.onMessage = (message) => {
    if (message.v !== PROTOCOL_VERSION) {
      handlers.onStatus(
        'error',
        `The other player is running protocol v${message.v}; this build speaks v${PROTOCOL_VERSION}.`,
      );
      return;
    }
    handlers.onHello(message);
  };

  state.onMessage = (message) => {
    if (message.v === PROTOCOL_VERSION) handlers.onState(message);
  };

  intent.onMessage = (message, context) => {
    if (message.v === PROTOCOL_VERSION) handlers.onIntent(message, context.peerId);
  };

  reject.onMessage = (message) => handlers.onReject(message);

  handlers.onStatus('waiting');

  // Sends reject if the channel drops mid-flight; nothing the player can act
  // on, and the host re-broadcasts state on every change, so failures are
  // logged rather than surfaced.
  const fireAndForget = (promise: Promise<void>) => {
    void promise.catch((error: unknown) => console.warn('[net] send failed', error));
  };

  return {
    selfId,
    strategy,
    sendHello: (rules) =>
      fireAndForget(hello.send({ v: PROTOCOL_VERSION, json: encodeRules(rules), guestSeat: 1 })),
    sendState: (gameState, seq) =>
      fireAndForget(state.send({ v: PROTOCOL_VERSION, seq, json: encodeState(gameState) })),
    sendIntent: (move) => fireAndForget(intent.send({ v: PROTOCOL_VERSION, json: encodeMove(move) })),
    sendReject: (message) => fireAndForget(reject.send({ ...message, v: PROTOCOL_VERSION })),
    peers: () => [...connected],
    leave: () => {
      clearTimeout(bootstrapTimer);
      void room.leave();
    },
  };
}
