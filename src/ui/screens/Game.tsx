import { useEffect, useState } from 'react';
import type { CardId } from '../../engine/cards';
import { MONTH_NAMES } from '../../engine/cards';
import { currentYaku, type PlayerIndex } from '../../engine/game';
import type { RuleConfig } from '../../engine/rules';
import { Board } from '../components/Board';
import { CapturePile, PileSummary } from '../components/CapturePile';
import { KoiKoiPrompt, RoundEnd } from '../components/RoundEnd';
import { YakuPanel } from '../components/YakuPanel';
import { useGameSession, type SessionConfig } from '../useGameSession';
import { STRATEGY_LABEL } from '../../net/protocol';

export interface GameScreenProps extends SessionConfig {
  rules: RuleConfig;
  names: readonly [string, string];
  onExit(): void;
}

export function Game({ names, onExit, ...config }: GameScreenProps) {
  const session = useGameSession(config);
  const [selected, setSelected] = useState<CardId | null>(null);
  /** Which player's capture detail is open, if any. */
  const [openPile, setOpenPile] = useState<PlayerIndex | null>(null);

  const state = session.state;

  // Clear the selection whenever the position changes under us.
  useEffect(() => {
    setSelected(null);
  }, [state?.roundState.phase, state?.roundState.current]);

  // A guest has no state until the host's first snapshot arrives, so this
  // screen has to carry the connection status on its own — it is the only
  // feedback the joining player gets while the relay handshake happens.
  if (!state) {
    const waiting: Record<string, string> = {
      connecting: 'Connecting…',
      waiting: 'Looking for the host…',
      connected: 'Connected — waiting for the host to deal…',
      'peer-left': 'The host disconnected.',
      error: 'Could not connect.',
      idle: 'Connecting…',
    };
    return (
      <div className="screen screen--center">
        <div className={`netbar netbar--${session.connection}`}>
          {waiting[session.connection] ?? 'Connecting…'}
        </div>
        <p className="muted small">Room {config.roomCode}</p>
        {session.connectionDetail && <p className="muted small">{session.connectionDetail}</p>}
        {session.connection !== 'connected' && (
          <p className="muted small">
            Both players must choose the same connection method. If this does not connect,
            go back and try the other one.
          </p>
        )}
        <button type="button" className="btn btn--ghost" onClick={onExit}>
          Leave
        </button>
      </div>
    );
  }

  const round = state.roundState;

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
  const result = round.result;
  const myYaku = currentYaku(state, seat);

  const showKoiKoi = round.phase === 'koikoi' && round.current === seat && session.canAct;
  const theirTurn = round.phase !== 'round-end' && round.current !== seat;

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

      {config.mode !== 'ai' && config.mode !== 'local' && (
        <div className={`netbar netbar--${session.connection}`}>
          {session.connection === 'connected'
            ? `Connected · ${STRATEGY_LABEL[config.strategy ?? 'nostr']}`
            : session.connection === 'peer-left'
              ? 'The other player disconnected'
              : (session.connectionDetail ?? 'Connecting…')}
        </div>
      )}

      <PileSummary
        name={names[opponent]}
        cards={round.players[opponent].captured}
        rules={state.rules}
        koiKoiCalls={round.players[opponent].koiKoiCalls}
        active={theirTurn}
        onOpen={() => setOpenPile(opponent)}
      />

      <Board
        state={state}
        seat={seat}
        canAct={session.canAct}
        selected={selected}
        onSelect={setSelected}
        onPlay={(card) => {
          session.submit({ type: 'play', card });
          setSelected(null);
        }}
        onChooseTarget={(target) => {
          session.submit({ type: 'chooseTarget', target });
          setSelected(null);
        }}
      />

      <PileSummary
        name={names[seat]}
        cards={round.players[seat].captured}
        rules={state.rules}
        koiKoiCalls={round.players[seat].koiKoiCalls}
        active={!theirTurn && round.phase !== 'round-end'}
        onOpen={() => setOpenPile(seat)}
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
                ? 'Tap a lit card to capture it'
                : 'Slide across your hand, then tap a card'}
      </footer>

      {showKoiKoi && (
        <KoiKoiPrompt
          base={myYaku.base}
          onKoiKoi={() => session.submit({ type: 'koikoi' })}
          onShobu={() => session.submit({ type: 'shobu' })}
        />
      )}

      {result && round.phase === 'round-end' && !state.matchOver && (
        <RoundEnd
          result={result}
          rules={state.rules}
          names={[names[0], names[1]]}
          // Show the totals including this round, otherwise the sheet reads
          // "scores 4 points" next to an unchanged scoreline.
          scores={[state.scores[0] + result.awarded[0], state.scores[1] + result.awarded[1]]}
          matchOver={false}
          onNext={() => session.submit({ type: 'nextRound' })}
        />
      )}

      {state.matchOver && (
        <div className="sheet" role="dialog" aria-modal="true" aria-label="Match result">
          <div className="sheet__inner sheet__inner--tight">
            <p className="sheet__kicker">Match over</p>
            <h2>
              {state.scores[seat] > state.scores[opponent]
                ? 'You win'
                : state.scores[seat] < state.scores[opponent]
                  ? `${names[opponent]} wins`
                  : 'A draw'}
            </h2>
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
          </div>
        </div>
      )}

      {openPile !== null && (
        <div className="sheet" role="dialog" aria-modal="true" aria-label="Captured cards">
          <div className="sheet__inner">
            <header className="sheet__head">
              <p className="sheet__kicker">Captured</p>
              <h2>{names[openPile]}</h2>
            </header>
            <CapturePile cards={round.players[openPile].captured} />
            <YakuPanel
              captured={round.players[openPile].captured}
              rules={state.rules}
              title="Yaku progress"
            />
            <button type="button" className="btn btn--ghost btn--wide" onClick={() => setOpenPile(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
