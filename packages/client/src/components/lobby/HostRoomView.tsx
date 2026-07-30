/**
 * 主机房间视图 —— 显示房间码、等待玩家加入、配置游戏、开始游戏。
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { HostRoom } from '../../p2p';
import { useGameStore } from '../../stores/game-store';
import type { PeerConnectionInfo, P2PConnectionState } from '../../p2p';
import type { PlayerInfo } from '@rummikub/shared';
import { TIME_LIMIT_OPTIONS } from '@rummikub/engine';

interface HostRoomViewProps {
  onStartGame: (p2pMode?: any) => void;
  onBack: () => void;
}

export default function HostRoomView({ onStartGame, onBack }: HostRoomViewProps) {
  const setPendingConfig = useGameStore(s => s.setPendingConfig);
  const setHostRoom = useGameStore(s => s.setHostRoom);
  const startP2PHostGame = useGameStore(s => s.startP2PHostGame);

  const hostRoomRef = useRef<HostRoom | null>(null);
  const [roomCode, setRoomCode] = useState('');
  const [peerId, setPeerId] = useState('');
  const [connectedPlayers, setConnectedPlayers] = useState<PlayerInfo[]>([]);
  const [connStates, setConnStates] = useState<PeerConnectionInfo[]>([]);
  const [p2pState, setP2pState] = useState<P2PConnectionState>('disconnected');
  const [error, setError] = useState<string | null>(null);

  // 游戏配置
  const [playerCount, setPlayerCount] = useState(2);
  const [aiCount, setAiCount] = useState(0);
  const [aiDifficulty, setAiDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy');
  const [timeLimit, setTimeLimit] = useState(120);

  // 创建房间
  useEffect(() => {
    const host = new HostRoom({
      onRoomReady: (code, pid) => {
        setRoomCode(code);
        setPeerId(pid);
        setP2pState('connected');
      },
      onPlayerJoined: (player) => {
        setConnectedPlayers(prev => [...prev, player]);
      },
      onPlayerLeft: (playerId) => {
        setConnectedPlayers(prev => prev.filter(p => p.id !== playerId));
      },
      onStateChange: (state) => {
        setConnStates(state.connections);
      },
      onClientMove: (playerId, data) => {
        // 客户端发送走法 → 通过 store 处理
        const s = useGameStore.getState();
        if (!s.optimisticState) return;
        // 验证：必须是该玩家的回合
        const cp = s.optimisticState.players[s.optimisticState.currentPlayerIndex];
        if (cp?.id !== playerId) {
          host.sendError(playerId, '不是你的回合');
          return;
        }
        s.commitMove(data.moves);
      },
      onClientDraw: (playerId) => {
        const s = useGameStore.getState();
        if (!s.optimisticState) return;
        const cp = s.optimisticState.players[s.optimisticState.currentPlayerIndex];
        if (cp?.id !== playerId) return;
        s.drawTileAction();
      },
      onClientPass: (playerId) => {
        const s = useGameStore.getState();
        if (!s.optimisticState) return;
        const cp = s.optimisticState.players[s.optimisticState.currentPlayerIndex];
        if (cp?.id !== playerId) return;
        s.passTurnAction();
      },
      onError: (err) => {
        setError(err.message);
      },
    });

    hostRoomRef.current = host;
    setHostRoom(host);

    host.createRoom().catch(err => {
      setError(`创建房间失败: ${err.message}`);
    });

    return () => {
      // 如果用户离开页面，关闭房间
      host.closeRoom();
    };
  }, [setHostRoom]);

  // 当 peerId 就绪后，添加主机玩家
  useEffect(() => {
    if (!peerId || !hostRoomRef.current) return;
    const hostPlayer: PlayerInfo = {
      id: 'host-player',
      name: '你（主机）',
      isBot: false,
      seat: 0,
    };
    hostRoomRef.current.addHostPlayer(hostPlayer);
    setConnectedPlayers(prev => [hostPlayer, ...prev]);
  }, [peerId]);

  // 复制房间码
  const copyRoomCode = useCallback(() => {
    if (peerId) {
      navigator.clipboard.writeText(peerId).then(() => {
        alert('主机 ID 已复制！发送给好友即可加入。');
      }).catch(() => {
        // fallback: show the id
      });
    }
  }, [peerId]);

  // 开始游戏
  const handleStartGame = useCallback(() => {
    setPendingConfig({
      playerCount,
      aiCount,
      aiDifficulty,
      timeLimit,
      aiHintEnabled: false,
    });

    // 启动 P2P 主机游戏
    startP2PHostGame();
    onStartGame({ type: 'host' as const, hostRoom: hostRoomRef.current });
  }, [playerCount, aiCount, aiDifficulty, timeLimit, setPendingConfig, startP2PHostGame, onStartGame]);

  const canStart = connectedPlayers.length >= 2;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <button
        onClick={() => {
          hostRoomRef.current?.closeRoom();
          onBack();
        }}
        className="absolute top-4 left-4 text-green-300 hover:text-white transition text-sm"
      >
        ← 返回
      </button>

      <h1 className="text-4xl font-bold mb-2 text-blue-300 drop-shadow-lg">
        🏠 创建房间
      </h1>

      {error && (
        <div className="bg-red-600/80 text-white px-4 py-2 rounded-lg mb-4">
          错误: {error}
        </div>
      )}

      {/* 房间码显示 */}
      <div className="bg-blue-800/60 rounded-2xl p-6 mb-6 text-center w-full max-w-md">
        <p className="text-blue-200 text-sm mb-2">房间码（分享给好友）</p>
        <div className="flex items-center justify-center gap-3">
          <span className="text-4xl font-mono font-bold text-yellow-300 tracking-widest">
            {roomCode || '------'}
          </span>
          <button
            onClick={copyRoomCode}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition"
          >
            复制
          </button>
        </div>
        <p className="text-blue-300 text-xs mt-2 break-all">
          完整 ID: {peerId || '等待中...'}
        </p>
        <p className="text-blue-400 text-xs mt-1">
          状态: {p2pState === 'connected' ? '✅ 已在线' : p2pState === 'connecting' ? '⏳ 连接中...' : '❌ 未连接'}
        </p>
      </div>

      {/* 已连接玩家列表 */}
      <div className="bg-green-800/60 rounded-2xl p-6 mb-6 w-full max-w-md">
        <h3 className="text-white font-bold mb-3">
          已连接玩家 ({connectedPlayers.length})
        </h3>
        {connectedPlayers.length === 0 ? (
          <p className="text-green-400 text-sm">等待玩家加入...</p>
        ) : (
          <ul className="space-y-2">
            {connectedPlayers.map(player => (
              <li
                key={player.id}
                className="flex items-center justify-between bg-green-700/50 rounded-lg px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-white">{player.name}</span>
                  {player.id === 'host-player' && (
                    <span className="text-xs text-yellow-300 bg-yellow-700/50 px-1 rounded">主机</span>
                  )}
                </div>
                <span className="w-2 h-2 rounded-full bg-green-400" />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 游戏配置 */}
      <div className="bg-green-800/80 rounded-2xl p-6 w-full max-w-md space-y-4">
        <h3 className="text-white font-bold">游戏配置</h3>

        <div>
          <label className="block text-green-200 text-sm mb-1">人数（含 AI）</label>
          <div className="flex gap-2">
            {[2, 3, 4].map(n => (
              <button
                key={n}
                onClick={() => { setPlayerCount(n); setAiCount(Math.min(aiCount, n - connectedPlayers.length)); }}
                className={`flex-1 py-2 rounded-lg font-bold transition ${
                  playerCount === n
                    ? 'bg-yellow-500 text-green-900'
                    : 'bg-green-700 text-green-200 hover:bg-green-600'
                }`}
              >
                {n} 人
              </button>
            ))}
          </div>
        </div>

        {playerCount - connectedPlayers.length > 0 && (
          <div>
            <label className="block text-green-200 text-sm mb-1">
              AI 机器人数量（{aiCount} 个）
            </label>
            <input
              type="range"
              min={0}
              max={playerCount - connectedPlayers.length}
              value={aiCount}
              onChange={e => setAiCount(Number(e.target.value))}
              className="w-full accent-yellow-500"
            />
          </div>
        )}

        {aiCount > 0 && (
          <div>
            <label className="block text-green-200 text-sm mb-1">AI 难度</label>
            <div className="flex gap-2">
              {(['easy', 'medium', 'hard'] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setAiDifficulty(d)}
                  className={`flex-1 py-2 rounded-lg font-bold transition ${
                    aiDifficulty === d ? 'bg-yellow-500 text-green-900' : 'bg-green-700 text-green-200 hover:bg-green-600'
                  }`}
                >
                  {{ easy: '简单', medium: '中等', hard: '困难' }[d]}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="block text-green-200 text-sm mb-1">回合时间限制</label>
          <div className="flex gap-2">
            {TIME_LIMIT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setTimeLimit(opt.value)}
                className={`flex-1 py-2 rounded-lg font-bold transition ${
                  timeLimit === opt.value ? 'bg-yellow-500 text-green-900' : 'bg-green-700 text-green-200 hover:bg-green-600'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleStartGame}
          disabled={!canStart}
          className={`w-full py-3 mt-4 font-bold text-xl rounded-xl transition shadow-lg ${
            canStart
              ? 'bg-yellow-500 hover:bg-yellow-400 text-green-900'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
        >
          {canStart ? '开始游戏' : '等待至少一位玩家加入...'}
        </button>
      </div>
    </div>
  );
}
