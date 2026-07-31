import { useCallback, useEffect, useRef, useState } from 'react';
import type { CardId } from '../../engine/cards';
import { MONTH_NAMES } from '../../engine/cards';
import { currentYaku, matchesFor, other, type PlayerIndex } from '../../engine/game';
import type { RuleConfig } from '../../engine/rules';
import { settleRound } from '../../engine/scoring';
import { Board } from '../components/Board';
import { CardInfo } from '../components/CardInfo';
import { Connecting } from '../components/Connecting';
import { ScoreSheet } from '../components/ScoreSheet';
import { CapturePile, PileSummary } from '../components/CapturePile';
import { KoiKoiCall } from '../components/KoiKoiCall';
import { KoiKoiPrompt, RoundBreakdown, RoundEnd } from '../components/RoundEnd';
import { Sheet } from '../components/Sheet';
import { YakuPanel } from '../components/YakuPanel';
import { useGameSession, type SessionConfig } from '../useGameSession';
import { sanitizeName } from '../../net/protocol';

export interface GameScreenProps extends SessionConfig {
  rules: RuleConfig;
  names: readonly [string, string];
  onExit(): void;
}

export function Game({ names: defaultNames, onExit, ...config }: GameScreenProps) {
  const session = useGameSession(config);
  const [selected, setSelected] = useState<CardId | null>(null);
  /** Which player's capture detail is open, if any. */
  const [openPile, setOpenPile] = useState<PlayerIndex | null>(null);
  /** The card whose details are on screen, if any. */
  const [inspecting, setInspecting] = useState<CardId | null>(null);
  const [showScores, setShowScores] = useState(false);

  /** The other player's Koi-Koi, waiting to be announced. */
  const [koiCall, setKoiCall] = useState<{ id: number; by: PlayerIndex; calls: number } | null>(
    null,
  );

  const state = session.state;

  // Clear the selection whenever the position changes under us.
  useEffect(() => {
    setSelected(null);
    setInspecting(null);
  }, [state?.roundState.phase, state?.roundState.current]);

  /**
   * Watch for a Koi-Koi by anyone who is not us.
   *
   * The engine records the call as a counter rather than an event, so this
   * diffs it. Both seats are checked rather than "the opponent", because in
   * pass-and-play the seat this device shows follows whoever is to move — by
   * the time the call lands, the board has already swung round to the other
   * player, who is exactly the person who needs telling.
   */
  const calls0 = state?.roundState.players[0].koiKoiCalls ?? 0;
  const calls1 = state?.roundState.players[1].koiKoiCalls ?? 0;
  const seenCalls = useRef<[number, number]>([0, 0]);
  const nextCallId = useRef(0);
  const viewerSeat = config.mode === 'local' ? state?.roundState.current : session.mySeat;

  useEffect(() => {
    const now: [number, number] = [calls0, calls1];
    const before = seenCalls.current;
    seenCalls.current = now;
    for (const p of [0, 1] as const) {
      // Only an increase counts: a new round resets both counters to zero.
      if (now[p] > before[p] && p !== viewerSeat) {
        nextCallId.current += 1;
        setKoiCall({ id: nextCallId.current, by: p, calls: now[p] });
      }
    }
  }, [calls0, calls1, viewerSeat]);

  const clearKoiCall = useCallback(() => setKoiCall(null), []);

  const isNetwork = config.mode === 'host' || config.mode === 'guest';
  const strategy = config.strategy ?? 'nostr';

  // Both sides sit behind the overlay until the peers have actually found
  // each other. The host used to get a playable board immediately and could
  // take a turn into the void; the guest got a bare screen with no feedback.
  if (isNetwork && (session.connection !== 'connected' || !state)) {
    return (
      <Connecting
        status={session.connection}
        detail={session.connectionDetail}
        roomCode={config.roomCode}
        strategy={strategy}
        isHost={config.mode === 'host'}
        onCancel={onExit}
      />
    );
  }

  if (!state) {
    return (
      <div className="screen screen--center">
        <div className="spinner" aria-hidden="true" />
        <p className="muted small">Dealing…</p>
      </div>
    );
  }

  const round = state.roundState;

  /**
   * Who to call each player.
   *
   * In a room game the two nicknames arrive from opposite ends — mine from
   * this device, theirs over the wire — so they are stitched together by seat
   * here rather than fixed by the caller. Either falling back to the generic
   * label if it has not arrived, or is blank.
   */
  const names: readonly [string, string] = isNetwork
    ? config.mode === 'guest'
      ? [
          sanitizeName(session.peerName ?? '', defaultNames[0]),
          sanitizeName(config.nickname ?? '', defaultNames[1]),
        ]
      : [
          sanitizeName(config.nickname ?? '', defaultNames[0]),
          sanitizeName(session.peerName ?? '', defaultNames[1]),
        ]
    : defaultNames;

  /**
   * Which seat the board is drawn from. In pass-and-play both players share
   * one device, so the view has to follow whoever is to move — otherwise the
   * second player is shown the first player's hand and can never act.
   */
  const seat: PlayerIndex =
    config.mode === 'local' && round.phase !== 'round-end'
      ? round.current
      : (session.mySeat ?? 0);

  const opponent: PlayerIndex = seat === 0 ? 1 : 0;

  /**
   * Which seat "you" means, for text that addresses the reader. Pass-and-play
   * has no answer — both players share the screen and both are named — so it
   * speaks about them in the third person instead.
   */
  const youSeat: PlayerIndex | null = config.mode === 'local' ? null : seat;
  const result = round.result;
  const myYaku = currentYaku(state, seat);

  // Drives the status line: a forward card with no match is discarded by
  // tapping the table, and that instruction has to live here rather than
  // inside the field, where it grew the box and produced a scrollbar.
  const selectedHasMatch = selected !== null && matchesFor(selected, round.field).length > 0;

  /**
   * What calling shobu right now would actually pay.
   *
   * Settled with the same `settleRound` the engine uses, from the same
   * inputs, so the number on the prompt cannot drift from the number the
   * round-end sheet then awards.
   */
  const stoppingPays = settleRound(
    myYaku.base,
    {
      byWinner: round.players[seat].koiKoiCalls,
      byLoser: round.players[other(seat)].koiKoiCalls,
    },
    state.rules,
  );

  const showKoiKoi = round.phase === 'koikoi' && round.current === seat && session.canAct;
  const theirTurn = round.phase !== 'round-end' && round.current !== seat;

  const showRoundEnd = Boolean(result) && round.phase === 'round-end' && !state.matchOver;
  /**
   * Any sheet on screen suppresses the card-info panel. The panel is fixed at
   * the top of the viewport, so left up it would hang over a sheet and explain
   * a card nobody is looking at any more. Opening a sheet by hand clears the
   * inspected card outright; gating the render as well covers the sheets that
   * appear on their own, like the koi-koi prompt.
   */
  const sheetOpen = showKoiKoi || showRoundEnd || state.matchOver || showScores || openPile !== null;

  const openScores = () => {
    setInspecting(null);
    setShowScores(true);
  };
  const openPileFor = (who: PlayerIndex) => {
    setInspecting(null);
    setOpenPile(who);
  };

  return (
    <div className="screen screen--game">
      <header className="topbar">
        <button type="button" className="topbar__back" onClick={onExit} aria-label="Leave game">
          ‹
        </button>
        <div className="topbar__mid">
          <strong>
            Round {state.round}/{state.rules.rounds}
          </strong>
          <span className="topbar__sub">
            {MONTH_NAMES[round.month]}
            {round.dealer === seat ? ' · you deal' : ''}
          </span>
        </div>
        <div className="topbar__score">
          <span>{state.scores[seat]}</span>
          <i>·</i>
          <span className="topbar__them">{state.scores[opponent]}</span>
        </div>
      </header>

      {/* Only when something is wrong. A permanent "Connected · Nostr relays"
          strip cost the table a row to say nothing — you can see the game is
          working, because it is working. */}
      {isNetwork && session.connection !== 'connected' && (
        <div className={`netbar netbar--${session.connection}`}>
          {session.connection === 'peer-left'
            ? 'The other player disconnected'
            : (session.connectionDetail ?? 'Connecting…')}
        </div>
      )}

      <PileSummary
        name={names[opponent]}
        cards={round.players[opponent].captured}
        rules={state.rules}
        month={round.month}
        koiKoiCalls={round.players[opponent].koiKoiCalls}
        active={theirTurn}
        stack={{ count: round.players[opponent].hand.length, label: 'Cards in hand' }}
        onOpen={() => openPileFor(opponent)}
      />

      <Board
        state={state}
        seat={seat}
        canAct={session.canAct}
        selected={selected}
        onSelect={(card) => {
          setSelected(card);
          // Pulling a card forward is also the moment to say what it is.
          setInspecting(card);
        }}
        onInspect={setInspecting}
        onPlay={(card) => {
          session.submit({ type: 'play', card });
          setSelected(null);
          setInspecting(null);
        }}
        onChooseTarget={(target) => {
          session.submit({ type: 'chooseTarget', target });
          setSelected(null);
          setInspecting(null);
        }}
      />

      <PileSummary
        name={names[seat]}
        cards={round.players[seat].captured}
        rules={state.rules}
        month={round.month}
        koiKoiCalls={round.players[seat].koiKoiCalls}
        active={!theirTurn && round.phase !== 'round-end'}
        stack={{ count: round.deck.length, label: 'Cards left in the deck' }}
        onOpen={() => openPileFor(seat)}
      />

      <footer className="statusbar">
        {theirTurn
          ? session.busy
            ? `${names[opponent]} is thinking…`
            : `${names[opponent]}'s turn`
          : round.phase === 'draw'
            ? 'Flipping from the deck…'
            : round.phase === 'choose-hand-target' || round.phase === 'choose-draw-target'
              ? 'Choose which card to take'
              : selected
                ? selectedHasMatch
                  ? 'Tap a lit card to capture it'
                  : 'No match — tap the table to discard'
                : 'Slide across your hand, then tap a card'}
      </footer>

      {inspecting && !sheetOpen && (
        <CardInfo id={inspecting} rules={state.rules} onClose={() => setInspecting(null)} />
      )}

      {koiCall && (
        <KoiKoiCall
          callId={koiCall.id}
          name={names[koiCall.by]}
          calls={koiCall.calls}
          onDone={clearKoiCall}
        />
      )}

      {showKoiKoi && (
        <KoiKoiPrompt
          settlement={stoppingPays}
          rules={state.rules}
          onKoiKoi={() => session.submit({ type: 'koikoi' })}
          onShobu={() => session.submit({ type: 'shobu' })}
        />
      )}

      {result && showRoundEnd && (
        <RoundEnd
          result={result}
          rules={state.rules}
          names={[names[0], names[1]]}
          // Show the totals including this round, otherwise the sheet reads
          // "scores 4 points" next to an unchanged scoreline.
          scores={[state.scores[0] + result.awarded[0], state.scores[1] + result.awarded[1]]}
          youSeat={youSeat}
          onNext={() => session.submit({ type: 'nextRound' })}
        />
      )}

      {state.matchOver && (
        <Sheet label="Match result" dismissible={false}>
          <header className="sheet__head sheet__head--centre">
            <p className="sheet__kicker">Match over</p>
            <h2>
              {state.scores[seat] > state.scores[opponent]
                ? 'You win'
                : state.scores[seat] < state.scores[opponent]
                  ? `${names[opponent]} wins`
                  : 'A draw'}
            </h2>
          </header>
          <div className="sheet__scores">
            <div>
              <span>{names[seat]}</span>
              <b>{state.scores[seat]}</b>
            </div>
            <div>
              <span>{names[opponent]}</span>
              <b>{state.scores[opponent]}</b>
            </div>
          </div>

          {/* The last round settles straight into this sheet, so its scoring
              is shown here rather than behind a dismissed "next round". */}
          {result && (
            <>
              <p className="sheet__kicker">Final round {result.round}</p>
              <RoundBreakdown result={result} rules={state.rules} names={[names[0], names[1]]} />
            </>
          )}

          <div className="sheet__choices">
            <button type="button" className="btn btn--ghost btn--wide" onClick={onExit}>
              Back to menu
            </button>
            {config.mode !== 'guest' && (
              <button type="button" className="btn btn--primary btn--wide" onClick={session.restart}>
                Play again
              </button>
            )}
          </div>
        </Sheet>
      )}

      {showScores && (
        <Sheet label="Score guide" onDismiss={() => setShowScores(false)}>
          <header className="sheet__head">
            <p className="sheet__kicker">Reference</p>
            <h2>Score guide</h2>
          </header>
          <ScoreSheet rules={state.rules} />
          <button
            type="button"
            className="btn btn--ghost btn--wide"
            onClick={() => setShowScores(false)}
          >
            Close
          </button>
        </Sheet>
      )}

      {openPile !== null && (
        <Sheet label="Captured cards" onDismiss={() => setOpenPile(null)}>
          <header className="sheet__head">
            <p className="sheet__kicker">Captured</p>
            <h2>{names[openPile]}</h2>
          </header>
          <CapturePile cards={round.players[openPile].captured} />
          <YakuPanel
            captured={round.players[openPile].captured}
            rules={state.rules}
            month={round.month}
            title="Yaku progress"
          />
          <button
            type="button"
            className="btn btn--wide"
            onClick={() => {
              setOpenPile(null);
              openScores();
            }}
          >
            Score guide
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--wide"
            onClick={() => setOpenPile(null)}
          >
            Close
          </button>
        </Sheet>
      )}
    </div>
  );
}
