import { useState, useCallback } from 'react';
import Lobby from './components/lobby/Lobby';
import MultiplayerLobby from './components/lobby/MultiplayerLobby';
import HostRoomView from './components/lobby/HostRoomView';
import JoinRoomView from './components/lobby/JoinRoomView';
import GameBoard from './components/game/GameBoard';
import ToastContainer from './components/ui/Toast';
import { useGameStore } from './stores/game-store';
import type { P2PGameMode } from './stores/game-store';

type AppMode = 'lobby' | 'single-setup' | 'multi-lobby' | 'host-room' | 'join-room' | 'playing';

export default function App() {
  const [mode, setMode] = useState<AppMode>('lobby');

  const backToLobby = useGameStore(s => s.backToLobby);

  const handleBackToMain = useCallback(() => {
    backToLobby();
    setMode('lobby');
  }, [backToLobby]);

  const handleStartSingleSetup = useCallback(() => setMode('single-setup'), []);
  const handleStartMultiLobby = useCallback(() => setMode('multi-lobby'), []);

  const handleHostRoom = useCallback(() => setMode('host-room'), []);
  const handleJoinRoom = useCallback(() => setMode('join-room'), []);

  const handleStartPlaying = useCallback((p2pMode?: P2PGameMode) => {
    // 启动游戏（store 中的 startSinglePlayerGame 或 startP2PHostGame）
    setMode('playing');
  }, []);

  switch (mode) {
    case 'single-setup':
      return (
        <>
          <Lobby
            onStartGame={handleStartPlaying}
            onBack={handleBackToMain}
          />
          <ToastContainer />
        </>
      );

    case 'multi-lobby':
      return (
        <>
          <MultiplayerLobby
            onHostRoom={handleHostRoom}
            onJoinRoom={handleJoinRoom}
            onBack={handleBackToMain}
          />
          <ToastContainer />
        </>
      );

    case 'host-room':
      return (
        <>
          <HostRoomView
            onStartGame={handleStartPlaying}
            onBack={() => setMode('multi-lobby')}
          />
          <ToastContainer />
        </>
      );

    case 'join-room':
      return (
        <>
          <JoinRoomView
            onConnected={() => setMode('playing')}
            onBack={() => setMode('multi-lobby')}
          />
          <ToastContainer />
        </>
      );

    case 'playing':
      return (
        <>
          <GameBoard onBackToLobby={handleBackToMain} />
          <ToastContainer />
        </>
      );

    default:
      // Main lobby
      return (
        <>
          <div className="min-h-screen flex flex-col items-center justify-center p-4">
            <h1 className="text-6xl font-bold mb-2 text-yellow-300 drop-shadow-lg">
              🎴 Rummikub 拉密
            </h1>
            <p className="text-green-300 mb-12 text-xl">以色列麻将 · 轻量线上版</p>

            <div className="flex flex-col gap-4 w-full max-w-sm">
              <button
                onClick={handleStartSingleSetup}
                className="w-full py-4 bg-yellow-500 hover:bg-yellow-400 text-green-900
                           font-bold text-2xl rounded-2xl transition shadow-xl"
              >
                🤖 单人模式
              </button>
              <button
                onClick={handleStartMultiLobby}
                className="w-full py-4 bg-blue-500 hover:bg-blue-400 text-white
                           font-bold text-2xl rounded-2xl transition shadow-xl"
              >
                🌐 多人联机
              </button>
            </div>

            <p className="mt-12 text-green-500 text-sm opacity-60">
              v0.3 · P2P WebRTC · GitHub Pages
            </p>
          </div>
          <ToastContainer />
        </>
      );
  }
}
