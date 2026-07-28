import { useEffect, useState } from 'react';
import type { CardId } from '../../engine/cards';
import { MONTH_NAMES } from '../../engine/cards';
import { currentYaku, type PlayerIndex } from '../../engine/game';
import type { RuleConfig } from '../../engine/rules';
import { Board } from '../components/Board';
import { CapturePile } from '../components/CapturePile';
import { KoiKoiPrompt, RoundEnd } from '../components/RoundEnd';
import { YakuPanel, YakuStrip } from '../components/YakuPanel';
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
  const [sheet, setSheet] = useState<'none' | 'yaku'>('none');

  const state = session.state;
  const seat: PlayerIndex = session.mySeat ?? 0;

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

      <section className="tray tray--them">
        <div className="tray__head">
          <span>{names[opponent]}</span>
          {round.players[opponent].koiKoiCalls > 0 && (
            <span className="tray__koi">Koi-Koi ×{round.players[opponent].koiKoiCalls}</span>
          )}
        </div>
        <CapturePile cards={round.players[opponent].captured} compact />
      </section>

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

      <section className="tray tray--me">
        <div className="tray__head">
          <span>{names[seat]}</span>
          {round.players[seat].koiKoiCalls > 0 && (
            <span className="tray__koi">Koi-Koi ×{round.players[seat].koiKoiCalls}</span>
          )}
          <button type="button" className="tray__more" onClick={() => setSheet('yaku')}>
            Yaku
          </button>
        </div>
        <YakuStrip captured={round.players[seat].captured} rules={state.rules} />
        <CapturePile cards={round.players[seat].captured} compact />
      </section>

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
                ? 'Tap a matching field card, or tap again to discard'
                : 'Tap a card from your hand'}
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
          // "scores 4 points" next to an unchanged scoreline. The engine only
          // banks the award when the next round is dealt.
          scores={[
            state.scores[0] + result.awarded[0],
            state.scores[1] + result.awarded[1],
          ]}
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

      {sheet === 'yaku' && (
        <div className="sheet" role="dialog" aria-modal="true" aria-label="Yaku progress">
          <div className="sheet__inner">
            <YakuPanel captured={round.players[seat].captured} rules={state.rules} title="Your yaku" />
            <YakuPanel
              captured={round.players[opponent].captured}
              rules={state.rules}
              title={`${names[opponent]}'s yaku`}
            />
            <button type="button" className="btn btn--ghost btn--wide" onClick={() => setSheet('none')}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
