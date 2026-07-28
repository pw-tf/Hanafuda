import { useCallback, useState } from 'react';
import type { Difficulty } from '../ai';
import { DEFAULT_RULES, type RuleConfig } from '../engine/rules';
import type { Strategy } from '../net/protocol';
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
}

const NAMES: Record<SessionMode, readonly [string, string]> = {
  ai: ['You', 'Computer'],
  local: ['Player 1', 'Player 2'],
  host: ['You', 'Friend'],
  guest: ['Host', 'You'],
};

export function App() {
  const [route, navigate] = useHashRoute();
  const [rules, setRules] = useState<RuleConfig>(DEFAULT_RULES);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [setup, setSetup] = useState<PlaySetup | null>(null);

  const startPlay = useCallback(
    (next: PlaySetup) => {
      setSetup(next);
      navigate('play');
    },
    [navigate],
  );

  const exit = useCallback(() => {
    setSetup(null);
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
        names={NAMES[setup.mode]}
        onExit={exit}
      />
    );
  }

  return (
    <Menu
      difficulty={difficulty}
      onDifficulty={setDifficulty}
      onPlayAi={() => startPlay({ mode: 'ai' })}
      onPlayLocal={() => startPlay({ mode: 'local' })}
      onMultiplayer={() => navigate('multiplayer')}
      onSettings={() => navigate('settings')}
      onGallery={() => navigate('gallery')}
    />
  );
}
