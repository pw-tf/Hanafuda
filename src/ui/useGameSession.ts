/**
 * One controller for all three ways to play.
 *
 *   'ai'    — you are seat 0, the computer plays seat 1
 *   'local' — both seats on this device (pass and play)
 *   'host'  — you are seat 0 and own the authoritative state
 *   'guest' — you are seat 1 and render whatever the host sends
 *
 * The engine is the same in every mode; only who is allowed to submit a move
 * changes. In P2P the host validates every guest intent against
 * `legalMoves`, so a modified client cannot make the engine do anything the
 * rules disallow.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createAiAgent, type AiAgent, type Difficulty } from '../ai';
import {
  applyMove,
  createGame,
  legalMoves,
  type GameState,
  type Move,
  type PlayerIndex,
} from '../engine/game';
import { createRng, randomSeed } from '../engine/rng';
import type { RuleConfig } from '../engine/rules';
import {
  decodeMove,
  decodeRules,
  decodeState,
  sanitizeName,
  seedFromRoomCode,
  type RejectReason,
  type Strategy,
} from '../net/protocol';
import type { ConnectionStatus, RoomHandle, RoomHandlers } from '../net/room';
import { clearGame, saveGame } from './persistence';

export type SessionMode = 'ai' | 'local' | 'host' | 'guest';

export interface SessionConfig {
  mode: SessionMode;
  rules: RuleConfig;
  difficulty: Difficulty;
  roomCode?: string;
  strategy?: Strategy;
  /** What this player asked to be called, in a room game. */
  nickname?: string;
  /** A game restored from storage, resumed instead of dealt fresh. */
  resume?: GameState;
}

export interface Session {
  state: GameState | null;
  /** The seat this device controls, or null while a guest waits for the host. */
  mySeat: PlayerIndex | null;
  /** True when this device may submit a move right now. */
  canAct: boolean;
  /** The AI or the remote player is thinking. */
  busy: boolean;
  connection: ConnectionStatus;
  connectionDetail: string | null;
  /** The other player's nickname, once they have sent it. */
  peerName: string | null;
  lastRejection: RejectReason | null;
  submit(move: Move): void;
  restart(): void;
}

/**
 * Beat between the hand card resolving and the deck being flipped.
 *
 * It used to be 850ms of nothing — the flip had not happened yet, so there was
 * nothing on screen to look at, and then the flip and its capture resolved in
 * a single frame. The waiting now happens *after* the flip, where there is
 * something to see, so this is only long enough to separate the two halves of
 * the turn.
 */
const DRAW_REVEAL_MS = 500;

/**
 * Pause before the AI acts. This is also the window the flipped card's
 * animation plays in — the player's flip resolves and hands straight over to
 * the AI — so it must outlast that animation or the AI moves over the top of
 * it. See FLIGHT_* in Board.tsx.
 */
const AI_THINK_MS = 1250;

/**
 * How long the search may hold the main thread before handing it back.
 * Comfortably inside a 60fps frame, so the table keeps animating while the
 * opponent thinks.
 */
const SLICE_MS = 8;

export function useGameSession(config: SessionConfig): Session {
  const { mode, rules, difficulty, roomCode, strategy = 'nostr', nickname, resume } = config;

  const isNetwork = mode === 'host' || mode === 'guest';
  const mySeat: PlayerIndex | null = mode === 'guest' ? 1 : 0;

  const initialSeed = useMemo(
    () => (roomCode ? seedFromRoomCode(roomCode) : randomSeed()),
    [roomCode],
  );

  const [state, setState] = useState<GameState | null>(() => {
    if (resume) return resume;
    // No dealer argument: who deals first is drawn from the seed, so it is not
    // always this device.
    return mode === 'guest' ? null : createGame(rules, initialSeed);
  });
  const [connection, setConnection] = useState<ConnectionStatus>(isNetwork ? 'connecting' : 'idle');
  const [connectionDetail, setConnectionDetail] = useState<string | null>(null);
  const [lastRejection, setLastRejection] = useState<RejectReason | null>(null);
  const [busy, setBusy] = useState(false);
  const [peerName, setPeerName] = useState<string | null>(null);

  const roomRef = useRef<RoomHandle | null>(null);
  const stateRef = useRef<GameState | null>(state);
  const seqRef = useRef(0);
  const lastSeenSeq = useRef(-1);
  const aiRng = useRef(createRng(initialSeed ^ 0x5bf03635));
  // The AI sits in seat 1 and keeps a belief about seat 0's hand, so it has to
  // survive across turns rather than being rebuilt per decision.
  const agentRef = useRef<AiAgent | null>(null);
  if (mode === 'ai' && (!agentRef.current || agentRef.current.difficulty !== difficulty)) {
    agentRef.current = createAiAgent(difficulty, 1, aiRng.current);
  }
  // Read inside the room effect without making it a dependency, which would
  // tear down and rejoin the room every time the rules object changed.
  const rulesRef = useRef(rules);
  rulesRef.current = rules;

  stateRef.current = state;

  /** Host: adopt a new state locally and push it to the guest. */
  const commit = useCallback(
    (next: GameState) => {
      stateRef.current = next;
      setState(next);
      if (mode === 'host' && roomRef.current) {
        roomRef.current.sendState(next, ++seqRef.current);
      }
    },
    [mode],
  );

  /** Whether `seat` is controlled by this device. */
  const controls = useCallback(
    (seat: PlayerIndex): boolean => {
      switch (mode) {
        case 'local':
          return true;
        case 'ai':
        case 'host':
          return seat === 0;
        case 'guest':
          return seat === 1;
      }
    },
    [mode],
  );

  // ---------------------------------------------------------------------
  // Networking
  // ---------------------------------------------------------------------

  useEffect(() => {
    if (!isNetwork || !roomCode) return;

    // The P2P stack (WebRTC + relay crypto) is a large dependency that solo
    // play never touches, so it is loaded only when a room is actually joined.
    let cancelled = false;
    let opened: RoomHandle | null = null;

    const handlers: RoomHandlers = {
        onStatus: (status, detail) => {
          setConnection(status);
          setConnectionDetail(detail ?? null);
        },
        onHello: (message) => {
          // The guest scores from the rules carried inside each state
          // snapshot, so hello is only a compatibility check: warn loudly if
          // the host is playing a different table than this client shows.
          if (mode !== 'guest') return;
          const hostRules = decodeRules(message.json);
          if (hostRules.id !== rulesRef.current.id) {
            setConnectionDetail(`Host is using the "${hostRules.label}" scoring table.`);
          }
        },
        onName: (message) => {
          // Straight from the other device, so it is sanitized here rather
          // than trusted anywhere downstream.
          setPeerName(sanitizeName(message.name, ''));
        },
        onState: (message) => {
          if (mode !== 'guest') return;
          // Snapshots can arrive out of order; only ever move forward.
          if (message.seq <= lastSeenSeq.current) return;
          lastSeenSeq.current = message.seq;
          const next = decodeState(message.json);
          stateRef.current = next;
          setState(next);
        },
        onIntent: (message, peerId) => {
          if (mode !== 'host') return;
          const current = stateRef.current;
          if (!current) return;

          const move = decodeMove(message.json);

          // The guest owns seat 1 and nothing else.
          if (current.roundState.phase !== 'round-end' && current.roundState.current !== 1) {
            roomRef.current?.sendReject({ reason: 'not-your-turn' });
            return;
          }
          const legal = legalMoves(current).some((m) => JSON.stringify(m) === JSON.stringify(move));
          if (!legal) {
            roomRef.current?.sendReject({ reason: 'illegal-move', detail: JSON.stringify(move) });
            return;
          }

          void peerId;
          commit(applyMove(current, move));
        },
      onReject: (message) => setLastRejection(message.reason),
    };

    void import('../net/room')
      .then(({ connectRoom }) => {
        if (cancelled) return;
        opened = connectRoom(roomCode, handlers, strategy);
        roomRef.current = opened;
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setConnection('error');
        setConnectionDetail(`Could not load the multiplayer module: ${String(error)}`);
      });

    // The host announces the ruleset and the opening position as soon as the
    // guest appears; `onPeerJoin` fires after this effect has wired up.
    return () => {
      cancelled = true;
      opened?.leave();
      roomRef.current = null;
    };
  }, [isNetwork, roomCode, mode, strategy, commit]);

  // Host: push the rules and the current position whenever a peer connects.
  useEffect(() => {
    if (mode !== 'host' || connection !== 'connected') return;
    const room = roomRef.current;
    const current = stateRef.current;
    if (!room || !current) return;
    room.sendHello(rules);
    room.sendState(current, ++seqRef.current);
  }, [mode, connection, rules]);

  // Both sides introduce themselves — a nickname travels in both directions,
  // unlike the rules, which only the host is authoritative about.
  useEffect(() => {
    if (!isNetwork || connection !== 'connected') return;
    roomRef.current?.sendName(nickname ?? '');
  }, [isNetwork, connection, nickname]);

  // ---------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------

  // A guest owns no state — it mirrors the host — so there is nothing
  // meaningful for it to restore, and saving would resurrect a stale
  // position on refresh. Everyone else saves after every change.
  useEffect(() => {
    if (mode === 'guest' || !state) return;
    if (state.matchOver) {
      clearGame();
      return;
    }
    saveGame({
      mode,
      difficulty,
      state,
      ...(roomCode ? { roomCode } : {}),
      ...(strategy ? { strategy } : {}),
    });
  }, [state, mode, difficulty, roomCode, strategy]);

  // ---------------------------------------------------------------------
  // Automatic progression: the deck flip, and the AI's turns
  // ---------------------------------------------------------------------

  const phase = state?.roundState.phase;
  const currentSeat = state?.roundState.current;

  useEffect(() => {
    if (!state || state.matchOver) return;
    // Only the authority advances the game automatically; a guest never does.
    if (mode === 'guest') return;
    if (phase !== 'draw') return;

    const timer = setTimeout(() => {
      const current = stateRef.current;
      if (!current || current.roundState.phase !== 'draw') return;
      commit(applyMove(current, { type: 'draw' }));
    }, DRAW_REVEAL_MS);

    return () => clearTimeout(timer);
  }, [state, phase, mode, commit]);

  /**
   * The final round settles straight into the match result.
   *
   * There is no next round to move on to, so asking the player to press
   * "Next round" before being told who won was a button that existed only to
   * be dismissed. The round's own breakdown is not lost — the match result
   * carries it, read from the round state this move leaves in place.
   */
  useEffect(() => {
    if (!state || state.matchOver || mode === 'guest') return;
    if (state.roundState.phase !== 'round-end' || !state.roundState.result) return;
    if (state.round < state.rules.rounds) return;
    commit(applyMove(state, { type: 'nextRound' }));
  }, [state, mode, commit]);

  // The AI watches every position, not only its own turns — inference comes
  // from what the *other* player did, so a state it never saw is evidence lost.
  useEffect(() => {
    if (mode !== 'ai' || !state) return;
    agentRef.current?.observe(state);
  }, [mode, state]);

  /**
   * The AI's turn.
   *
   * The search starts immediately and runs in slices, rather than starting
   * after the thinking pause and adding its cost on top. The player waits
   * exactly as long as before, the deck-flip animation keeps its frames, and
   * the stronger tiers get most of a second of real compute for free.
   */
  useEffect(() => {
    if (mode !== 'ai' || !state || state.matchOver) return;
    if (phase === 'round-end' || phase === 'draw') return;
    if (currentSeat !== 1) return;

    const agent = agentRef.current;
    if (!agent) return;

    setBusy(true);
    let cancelled = false;
    const startedFrom = state;
    const plan = agent.plan(state);
    const readyAt = Date.now() + AI_THINK_MS;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const finish = (move: Move) => {
      // States are immutable, so identity is an exact "nothing has moved on"
      // test — the position must still be the one we planned against.
      if (cancelled || stateRef.current !== startedFrom) {
        setBusy(false);
        return;
      }
      commit(applyMove(startedFrom, move));
      setBusy(false);
    };

    // One slice: search until it would cost a frame, then hand the thread back.
    const step = () => {
      if (cancelled) return;
      const sliceEnd = Date.now() + SLICE_MS;
      let result = plan.next();
      while (!result.done && Date.now() < sliceEnd) result = plan.next();

      if (result.done) {
        const move = result.value;
        const wait = Math.max(0, readyAt - Date.now());
        timer = setTimeout(() => finish(move), wait);
        return;
      }
      timer = setTimeout(step, 0);
    };

    step();

    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
      setBusy(false);
    };
  }, [mode, state, phase, currentSeat, commit]);

  // ---------------------------------------------------------------------
  // Submitting a move
  // ---------------------------------------------------------------------

  const submit = useCallback(
    (move: Move) => {
      const current = stateRef.current;
      if (!current) return;
      setLastRejection(null);

      if (mode === 'guest') {
        roomRef.current?.sendIntent(move);
        return;
      }

      const seat = current.roundState.current;
      const isRoundEnd = current.roundState.phase === 'round-end';
      if (!isRoundEnd && !controls(seat)) return;

      const legal = legalMoves(current).some((m) => JSON.stringify(m) === JSON.stringify(move));
      if (!legal) return;

      commit(applyMove(current, move));
    },
    [mode, controls, commit],
  );

  const restart = useCallback(() => {
    if (mode === 'guest') return;
    clearGame();
    commit(createGame(rules, randomSeed()));
  }, [mode, rules, commit]);

  const canAct = (() => {
    if (!state || state.matchOver) return false;
    const { phase: p, current } = state.roundState;
    if (p === 'draw') return false;
    if (p === 'round-end') return mode !== 'guest';
    if (mode === 'guest') return current === 1 && connection === 'connected';
    if (mode === 'host') return current === 0 && connection === 'connected';
    return controls(current);
  })();

  return {
    state,
    mySeat,
    canAct,
    busy: busy || phase === 'draw',
    connection,
    connectionDetail,
    peerName,
    lastRejection,
    submit,
    restart,
  };
}
