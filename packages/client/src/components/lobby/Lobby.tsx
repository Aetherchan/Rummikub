import { useState } from 'react';
import type { GameConfig } from '@rummikub/shared';
import { TIME_LIMIT_OPTIONS } from '@rummikub/engine';
import { useGameStore } from '../../stores/game-store';

interface LobbyProps {
  onStartGame: () => void;
  onBack?: () => void;
}

export default function Lobby({ onStartGame, onBack }: LobbyProps) {
  const setPendingConfig = useGameStore(s => s.setPendingConfig);
  const startSinglePlayerGame = useGameStore(s => s.startSinglePlayerGame);

  const [playerCount, setPlayerCount] = useState(2);
  const [aiCount, setAiCount] = useState(1);
  const [aiDifficulty, setAiDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy');
  const [timeLimit, setTimeLimit] = useState(120);
  const [aiHint, setAiHint] = useState(false);

  const handleStart = () => {
    setPendingConfig({
      playerCount,
      aiCount,
      aiDifficulty,
      timeLimit,
      aiHintEnabled: aiHint,
    });
    startSinglePlayerGame();
    onStartGame();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      {onBack && (
        <button
          onClick={onBack}
          className="absolute top-4 left-4 text-green-300 hover:text-white transition text-sm"
        >
          ← 返回
        </button>
      )}
      <h1 className="text-5xl font-bold mb-2 text-yellow-300 drop-shadow-lg">
        🎴 Rummikub 拉密
      </h1>
      <p className="text-green-300 mb-8 text-lg">以色列麻将 · 单人模式</p>

      <div className="bg-green-800/80 backdrop-blur rounded-2xl p-8 shadow-2xl w-full max-w-md space-y-5">
        <h2 className="text-2xl font-bold text-center text-white mb-4">游戏设置</h2>

        {/* 玩家数量 */}
        <div>
          <label className="block text-green-200 text-sm mb-1">玩家数量（含自己）</label>
          <div className="flex gap-2">
            {[2, 3, 4].map(n => (
              <button
                key={n}
                onClick={() => {
                  setPlayerCount(n);
                  setAiCount(Math.min(aiCount, n - 1));
                }}
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

        {/* AI 数量 */}
        <div>
          <label className="block text-green-200 text-sm mb-1">
            AI 机器人数量（{aiCount} 个）
          </label>
          <input
            type="range"
            min={0}
            max={playerCount - 1}
            value={aiCount}
            onChange={e => setAiCount(Number(e.target.value))}
            className="w-full accent-yellow-500"
          />
          <div className="flex justify-between text-xs text-green-400">
            <span>0（纯真人）</span>
            <span>{playerCount - 1}（满AI）</span>
          </div>
        </div>

        {/* AI 难度 */}
        {aiCount > 0 && (
          <div>
            <label className="block text-green-200 text-sm mb-1">AI 难度</label>
            <div className="flex gap-2">
              {(['easy', 'medium', 'hard'] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setAiDifficulty(d)}
                  className={`flex-1 py-2 rounded-lg font-bold transition ${
                    aiDifficulty === d
                      ? 'bg-yellow-500 text-green-900'
                      : 'bg-green-700 text-green-200 hover:bg-green-600'
                  }`}
                >
                  {{ easy: '简单', medium: '中等', hard: '困难' }[d]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 时间限制 */}
        <div>
          <label className="block text-green-200 text-sm mb-1">回合时间限制</label>
          <div className="flex gap-2">
            {TIME_LIMIT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setTimeLimit(opt.value)}
                className={`flex-1 py-2 rounded-lg font-bold transition ${
                  timeLimit === opt.value
                    ? 'bg-yellow-500 text-green-900'
                    : 'bg-green-700 text-green-200 hover:bg-green-600'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* AI 提示开关 */}
        <div className="flex items-center justify-between">
          <label className="text-green-200 text-sm">AI 提示功能</label>
          <button
            onClick={() => setAiHint(!aiHint)}
            className={`w-12 h-6 rounded-full transition ${
              aiHint ? 'bg-yellow-500' : 'bg-green-700'
            } relative`}
          >
            <div
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition ${
                aiHint ? 'left-6' : 'left-0.5'
              }`}
            />
          </button>
        </div>

        {/* 开始按钮 */}
        <button
          onClick={handleStart}
          className="w-full py-3 mt-4 bg-yellow-500 hover:bg-yellow-400 text-green-900
                     font-bold text-xl rounded-xl transition shadow-lg"
        >
          开始游戏
        </button>
      </div>
    </div>
  );
}
