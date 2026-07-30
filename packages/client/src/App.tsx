import { useState } from 'react';
import Lobby from './components/lobby/Lobby';
import GameBoard from './components/game/GameBoard';

type AppMode = 'lobby' | 'playing';

export default function App() {
  const [mode, setMode] = useState<AppMode>('lobby');

  if (mode === 'lobby') {
    return <Lobby onStartGame={() => setMode('playing')} />;
  }

  return <GameBoard onBackToLobby={() => setMode('lobby')} />;
}
