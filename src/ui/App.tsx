import { useCallback, useEffect, useState } from 'react';
import type { GameState } from '../engine/game';
import { warmCardCache } from '../art/CardFace';
import { clearGame, describeSave, loadGame } from './persistence';
import type { Difficulty } from '../ai';
import { DEFAULT_RULES, type RuleConfig } from '../engine/rules';
import { MAX_NAME_LENGTH, sanitizeName, type Strategy } from '../net/protocol';
import { Game } from './screens/Game';
import { Gallery } from './screens/Gallery';
import { Lobby } from './screens/Lobby';
import { Menu } from './screens/Menu';
import { Settings } from './screens/Settings';
import { useHashRoute } from './useHashRoute';
import type { SessionMode } from './useGameSession';

interface PlaySetup {
  mode: SessionMode;
  roomCode?: string;
  strategy?: Strategy;
  resume?: GameState;
}

const NAMES: Record<SessionMode, readonly [string, string]> = {
  ai: ['You', 'Computer'],
  local: ['Player 1', 'Player 2'],
  host: ['You', 'Friend'],
  guest: ['Host', 'You'],
};

/** Remembered across sessions, so a nickname is typed once, not every game. */
const NICKNAME_KEY = 'hanafuda-koikoi:nickname';

function readNickname(): string {
  try {
    return sanitizeName(window.localStorage.getItem(NICKNAME_KEY) ?? '', '');
  } catch {
    // Private-mode Safari throws on access rather than returning null.
    return '';
  }
}

export function App() {
  const [route, navigate] = useHashRoute();

  // Pull the deck into cache while the player is still on the menu, so a deal
  // is not the first time a dozen faces are requested at once.
  useEffect(() => {
    warmCardCache();
  }, []);

  const [rules, setRules] = useState<RuleConfig>(DEFAULT_RULES);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [setup, setSetup] = useState<PlaySetup | null>(null);
  const [nickname, setNickname] = useState(readNickname);
  // Read once on mount: a stale save is worse than no save, and the value is
  // only consulted when the menu is on screen.
  const [saved, setSaved] = useState(() => loadGame());

  const startPlay = useCallback(
    (next: PlaySetup) => {
      setSetup(next);
      navigate('play');
    },
    [navigate],
  );

  const exit = useCallback(() => {
    setSetup(null);
    // Leaving mid-match keeps the save, so the game is still there on return.
    setSaved(loadGame());
    navigate('menu');
  }, [navigate]);

  if (route === 'gallery') {
    return <Gallery />;
  }

  if (route === 'settings') {
    return <Settings rules={rules} onChange={setRules} onBack={() => navigate('menu')} />;
  }

  if (route === 'multiplayer') {
    return (
      <Lobby
        nickname={nickname}
        onNickname={(name) => {
          // Stored raw so the field stays editable mid-typing; it is sanitized
          // on the way out to the wire and on the way back in at startup.
          setNickname(name.slice(0, MAX_NAME_LENGTH));
          try {
            window.localStorage.setItem(NICKNAME_KEY, name);
          } catch {
            // Not being able to remember it is not a reason to refuse it.
          }
        }}
        onHost={(code, strategy) => startPlay({ mode: 'host', roomCode: code, strategy })}
        onJoin={(code, strategy) => startPlay({ mode: 'guest', roomCode: code, strategy })}
        onBack={() => navigate('menu')}
      />
    );
  }

  if (route === 'play' && setup) {
    return (
      <Game
        key={`${setup.mode}-${setup.roomCode ?? 'solo'}`}
        mode={setup.mode}
        rules={rules}
        difficulty={difficulty}
        {...(setup.roomCode ? { roomCode: setup.roomCode } : {})}
        {...(setup.strategy ? { strategy: setup.strategy } : {})}
        {...(nickname ? { nickname } : {})}
        {...(setup.resume ? { resume: setup.resume } : {})}
        names={NAMES[setup.mode]}
        onExit={exit}
      />
    );
  }

  return (
    <Menu
      difficulty={difficulty}
      onDifficulty={setDifficulty}
      onPlayAi={() => {
        clearGame();
        setSaved(null);
        startPlay({ mode: 'ai' });
      }}
      onPlayLocal={() => {
        clearGame();
        setSaved(null);
        startPlay({ mode: 'local' });
      }}
      onMultiplayer={() => navigate('multiplayer')}
      onSettings={() => navigate('settings')}
      onGallery={() => navigate('gallery')}
      resumable={saved ? describeSave(saved) : null}
      onResume={() => {
        if (!saved) return;
        setDifficulty(saved.difficulty);
        startPlay({
          mode: saved.mode,
          resume: saved.state,
          ...(saved.roomCode ? { roomCode: saved.roomCode } : {}),
          ...(saved.strategy ? { strategy: saved.strategy } : {}),
        });
      }}
      onDiscardSave={() => {
        clearGame();
        setSaved(null);
      }}
    />
  );
}
