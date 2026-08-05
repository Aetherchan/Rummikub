/**
 * 加入房间视图 —— 输入主机 Peer ID，连接并等待游戏开始。
 */

import { useState, useCallback, useRef } from 'react';
import { ClientRoom } from '../../p2p';
import { useGameStore } from '../../stores/game-store';
import type { PlayerInfo, GameState, TileInstance, ScoreEntry, GameStateDiff, TurnPhase } from '@rummikub/shared';
import type { P2PConnectionState } from '../../p2p';

interface JoinRoomViewProps {
  onConnected: () => void;
  onBack: () => void;
}

export default function JoinRoomView({ onConnected, onBack }: JoinRoomViewProps) {
  const setP2PGuestState = useGameStore(s => s.setP2PGuestState);
  const receiveP2PHand = useGameStore(s => s.receiveP2PHand);
  const receiveP2PStateUpdate = useGameStore(s => s.receiveP2PStateUpdate);
  const receiveP2PTurnChange = useGameStore(s => s.receiveP2PTurnChange);
  const receiveP2PGameOver = useGameStore(s => s.receiveP2PGameOver);
  const setClientRoom = useGameStore(s => s.setClientRoom);

  const clientRoomRef = useRef<ClientRoom | null>(null);
  const [hostPeerId, setHostPeerId] = useState('');
  const [state, setState] = useState<'idle' | 'connecting' | 'connected' | 'playing'>('idle');
  const [connectionState, setConnectionState] = useState<P2PConnectionState>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [players, setPlayers] = useState<PlayerInfo[]>([]);

  const connectToRoom = useCallback(async () => {
    if (!hostPeerId.trim()) {
      setError('请输入主机 ID');
      return;
    }

    setState('connecting');
    setError(null);

    const client = new ClientRoom({
      onConnected: (hostId) => {
        setState('connected');
        setConnectionState('connected');
        // 设置 P2P guest 模式
        useGameStore.getState().setP2PMode({ type: 'guest', clientRoom: client });
        // 通知 App 切换到游戏界面（显示加载中，等待主机开始游戏）
        onConnected();
      },
      onDisconnected: () => {
        setError('与主机的连接已断开');
        setState('idle');
        setConnectionState('disconnected');
      },
      onStateChange: (s) => setConnectionState(s),
      onError: (err) => {
        setError(typeof err === 'string' ? err : err.message);
        setState('idle');
      },
      // 游戏事件回调
      onGameState: (gameState, myPlayerIndex) => {
        setP2PGuestState(gameState, myPlayerIndex);
      },
      onStateUpdate: (diff) => {
        receiveP2PStateUpdate(diff);
      },
      onHandReceived: (tiles) => {
        receiveP2PHand(tiles);
      },
      onTurnChanged: (playerIndex, phase) => {
        receiveP2PTurnChange(playerIndex, phase);
      },
      onGameOver: (winnerId, scores) => {
        receiveP2PGameOver(winnerId, scores);
      },
      onRoomInfo: (roomPlayers, _hostId) => {
        setPlayers(roomPlayers);
      },
    });

    clientRoomRef.current = client;
    setClientRoom(client);

    try {
      await client.joinRoom(hostPeerId.trim());
    } catch (err: any) {
      setError(`连接失败: ${err.message}`);
      setState('idle');
    }
  }, [hostPeerId, onConnected, setP2PGuestState, receiveP2PHand, receiveP2PStateUpdate, receiveP2PTurnChange, receiveP2PGameOver]);

  // 等待主机开始游戏
  const waitingForHost = state === 'connected';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <button
        onClick={() => {
          clientRoomRef.current?.disconnect();
          onBack();
        }}
        className="absolute top-4 left-4 text-green-300 hover:text-white transition text-sm"
      >
        ← 返回
      </button>

      <h1 className="text-4xl font-bold mb-2 text-green-300 drop-shadow-lg">
        🚪 加入房间
      </h1>

      {error && (
        <div className="bg-red-600/80 text-white px-4 py-2 rounded-lg mb-4 max-w-md w-full">
          {error}
        </div>
      )}

      {state === 'idle' && (
        <div className="bg-green-800/80 rounded-2xl p-8 w-full max-w-md space-y-4">
          <p className="text-green-200 text-sm">
            输入主机分享给你的 <strong>完整 Peer ID</strong> 来加入房间。
          </p>

          <div>
            <label className="block text-green-200 text-sm mb-1">主机 ID</label>
            <input
              type="text"
              value={hostPeerId}
              onChange={e => setHostPeerId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && connectToRoom()}
              placeholder="例如: 1a2b3c4d-5e6f-..."
              className="w-full px-4 py-3 bg-green-700 border border-green-600 rounded-lg
                         text-white placeholder-green-400 focus:outline-none focus:border-yellow-500
                         font-mono text-sm"
            />
          </div>

          <button
            onClick={connectToRoom}
            disabled={!hostPeerId.trim()}
            className={`w-full py-3 font-bold text-xl rounded-xl transition shadow-lg ${
              hostPeerId.trim()
                ? 'bg-green-500 hover:bg-green-400 text-white'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            连接房间
          </button>
        </div>
      )}

      {state === 'connecting' && (
        <div className="text-center">
          <p className="text-green-300 text-xl animate-pulse">正在连接主机...</p>
          <p className="text-green-500 text-sm mt-2">建立 P2P WebRTC 连接</p>
        </div>
      )}

      {waitingForHost && (
        <div className="bg-green-800/80 rounded-2xl p-8 w-full max-w-md text-center space-y-4">
          <p className="text-green-200 text-xl">✅ 已连接到房间</p>
          <p className="text-yellow-300">等待主机开始游戏...</p>

          {players.length > 0 && (
            <div className="text-left">
              <h3 className="text-white font-bold mb-2">房间玩家:</h3>
              <ul className="space-y-1">
                {players.map(p => (
                  <li key={p.id} className="text-green-300 text-sm">
                    {p.name} {p.id === players[0]?.id ? '(主机)' : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
