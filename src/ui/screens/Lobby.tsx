import { useState } from 'react';
import {
  generateRoomCode,
  isValidRoomCode,
  MAX_NAME_LENGTH,
  normalizeRoomCode,
  ROOM_CODE_LENGTH,
} from '../../net/protocol';
import { STRATEGY_LABEL, type Strategy } from '../../net/protocol';

export function Lobby({
  onHost,
  onJoin,
  onBack,
  nickname,
  onNickname,
}: {
  onHost(code: string, strategy: Strategy): void;
  onJoin(code: string, strategy: Strategy): void;
  onBack(): void;
  nickname: string;
  onNickname(name: string): void;
}) {
  const [code, setCode] = useState('');
  const [hostCode, setHostCode] = useState(() => generateRoomCode());
  const [strategy, setStrategy] = useState<Strategy>('nostr');
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(hostCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access can be denied; the code is on screen regardless.
      setCopied(false);
    }
  };

  return (
    <div className="screen screen--lobby">
      <header className="topbar">
        <button type="button" className="topbar__back" onClick={onBack} aria-label="Back">
          ‹
        </button>
        <div className="topbar__mid">
          <strong>Play a friend</strong>
        </div>
        <div className="topbar__score" />
      </header>

      {/* Above both halves: it applies whether you host or join, and asking
          after the code has been typed would be one step too late. */}
      <section className="card">
        <h2>Your name</h2>
        <p className="muted small">What the other player sees on the table.</p>
        <input
          className="input input--text"
          value={nickname}
          onChange={(e) => onNickname(e.target.value)}
          placeholder="Player"
          maxLength={MAX_NAME_LENGTH}
          autoComplete="nickname"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Your nickname"
        />
      </section>

      <section className="card">
        <h2>Start a room</h2>
        <p className="muted small">
          Share this code. Your device deals and keeps score; you play first.
        </p>
        <div className="roomcode">
          {hostCode.split('').map((ch, i) => (
            <span key={i}>{ch}</span>
          ))}
        </div>
        <div className="menu__row">
          <button type="button" className="btn btn--ghost" onClick={() => setHostCode(generateRoomCode())}>
            New code
          </button>
          <button type="button" className="btn btn--ghost" onClick={copy}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <button
          type="button"
          className="btn btn--primary btn--wide"
          onClick={() => onHost(hostCode, strategy)}
        >
          Open room
        </button>
      </section>

      <section className="card">
        <h2>Join a room</h2>
        <input
          className="input"
          value={code}
          onChange={(e) => setCode(normalizeRoomCode(e.target.value))}
          placeholder={'—'.repeat(ROOM_CODE_LENGTH)}
          inputMode="text"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          maxLength={ROOM_CODE_LENGTH}
          aria-label="Room code"
        />
        <button
          type="button"
          className="btn btn--primary btn--wide"
          disabled={!isValidRoomCode(code)}
          onClick={() => onJoin(code, strategy)}
        >
          Join
        </button>
      </section>

      <section className="card">
        <h2>Connection</h2>
        <p className="muted small">
          Both players must pick the same one. Try the other if you cannot connect — some
          networks block one relay type but not the other.
        </p>
        <div className="segmented" role="group" aria-label="Connection method">
          {(['nostr', 'mqtt'] as Strategy[]).map((s) => (
            <button
              key={s}
              type="button"
              className={`segmented__btn ${strategy === s ? 'is-on' : ''}`}
              onClick={() => setStrategy(s)}
              aria-pressed={strategy === s}
            >
              {STRATEGY_LABEL[s]}
            </button>
          ))}
        </div>
        <p className="menu__hint">
          Game data goes directly between the two devices and is end-to-end encrypted; the
          relay is only used to introduce you.
        </p>
      </section>
    </div>
  );
}
