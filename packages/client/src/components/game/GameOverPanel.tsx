/**
 * 游戏结束计分面板 —— 显示赢家、排名、各玩家得分和剩余手牌。
 */

import type { GameState } from '@rummikub/shared';
import { calculateScores } from '@rummikub/engine';
import type { ScoreEntry as EngineScoreEntry } from '@rummikub/engine';
import type { TileInstance } from '@rummikub/shared';
import TileFace from '../tiles/TileFace';

interface GameOverPanelProps {
  gameState: GameState;
  onBackToLobby: () => void;
}

/** 扩展引擎的 ScoreEntry，附加 UI 需要的字段 */
interface DisplayScoreEntry extends EngineScoreEntry {
  handTiles: TileInstance[];
  isBot: boolean;
  isWinner: boolean;
}

/** 从 GameState 计算排名和得分 */
function computeScores(state: GameState): DisplayScoreEntry[] {
  const engineEntries = calculateScores(state.players, state.winner ?? '');

  return engineEntries.map(entry => {
    const player = state.players.find(p => p.id === entry.playerId);
    return {
      ...entry,
      handTiles: player?.handTiles ?? [],
      isBot: player?.isBot ?? false,
      isWinner: entry.playerId === state.winner,
    };
  });
}

function rankEmoji(rank: number): string {
  switch (rank) {
    case 1: return '🥇';
    case 2: return '🥈';
    case 3: return '🥉';
    default: return `#${rank}`;
  }
}

export default function GameOverPanel({ gameState, onBackToLobby }: GameOverPanelProps) {
  const scores = computeScores(gameState);
  const winner = scores[0];
  const humanPlayer = gameState.players.find(p => !p.isBot);
  const humanResult = scores.find(s => s.playerId === humanPlayer?.id);
  const humanRank = humanResult?.rank ?? -1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 animate-fade-in">
      <div className="bg-green-800/95 border-2 border-yellow-500/50 rounded-3xl p-8 w-full max-w-2xl
                      max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-up">

        {/* 顶部标题 */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-4xl font-bold text-yellow-300 mb-2">
            游戏结束
          </h1>
          <div className="text-xl text-green-200">
            胜者: <span className="text-yellow-300 font-bold text-2xl">{winner?.playerName}</span>
            {winner?.isBot && <span className="text-sm ml-2 text-green-400">(AI)</span>}
          </div>
          {humanPlayer && (
            <div className="mt-2 text-lg">
              {humanRank === 1 ? (
                <span className="text-yellow-300 font-bold">🏆 恭喜你获得第一名！</span>
              ) : (
                <span className="text-green-300">
                  你的排名: <span className="text-white font-bold">{rankEmoji(humanRank)}</span>
                  &nbsp;分数: <span className="text-white font-bold">{humanResult?.score ?? 0}</span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* 排名表格 */}
        <div className="bg-green-700/50 rounded-2xl overflow-hidden mb-6">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-green-600">
                <th className="py-3 px-4 text-green-300 text-sm font-medium">排名</th>
                <th className="py-3 px-4 text-green-300 text-sm font-medium">玩家</th>
                <th className="py-3 px-4 text-green-300 text-sm font-medium text-right">失分</th>
                <th className="py-3 px-4 text-green-300 text-sm font-medium text-right">剩余手牌</th>
              </tr>
            </thead>
            <tbody>
              {scores.map((entry) => {
                const isHuman = entry.playerId === humanPlayer?.id;
                const isWinner = entry.isWinner;
                return (
                  <tr
                    key={entry.playerId}
                    className={[
                      'border-b border-green-600/50 transition',
                      isWinner ? 'bg-yellow-500/10' : '',
                      isHuman ? 'bg-blue-500/10' : '',
                    ].join(' ')}
                  >
                    <td className="py-3 px-4">
                      <span className="text-xl">{rankEmoji(entry.rank)}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className={isHuman ? 'text-cyan-300 font-bold' : 'text-white'}>
                          {entry.playerName}
                        </span>
                        {isWinner && <span className="text-xs text-yellow-400">🏆</span>}
                        {isHuman && <span className="text-xs text-cyan-400">(你)</span>}
                        {entry.isBot && <span className="text-xs text-green-400">AI</span>}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={[
                        'font-mono font-bold',
                        entry.rank === 1 ? 'text-yellow-300' : 'text-red-300',
                      ].join(' ')}>
                        {entry.score > 0 ? `+${entry.score}` : entry.score}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex justify-end gap-1 flex-wrap max-w-[200px]">
                        {entry.handTiles.length > 0 ? (
                          entry.handTiles.map(tile => (
                            <div key={tile.instanceId} className="scale-75 origin-right">
                              <TileFace
                                tile={tile}
                                selected={false}
                                hinted={false}
                                onClick={() => {}}
                              />
                            </div>
                          ))
                        ) : (
                          <span className="text-green-400 text-sm">0 张</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 游戏统计 */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-green-700/40 rounded-xl p-3 text-center">
            <div className="text-green-400 text-xs mb-1">回合数</div>
            <div className="text-white font-bold text-xl">{gameState.turnNumber}</div>
          </div>
          <div className="bg-green-700/40 rounded-xl p-3 text-center">
            <div className="text-green-400 text-xs mb-1">桌面牌组</div>
            <div className="text-white font-bold text-xl">{gameState.boardSets.length}</div>
          </div>
          <div className="bg-green-700/40 rounded-xl p-3 text-center">
            <div className="text-green-400 text-xs mb-1">牌池剩余</div>
            <div className="text-white font-bold text-xl">{gameState.poolTileCount}</div>
          </div>
        </div>

        {/* 按钮 */}
        <div className="flex justify-center gap-4">
          <button
            onClick={onBackToLobby}
            className="px-8 py-3 bg-yellow-500 hover:bg-yellow-400 text-green-900
                       font-bold text-xl rounded-2xl transition shadow-lg
                       hover:scale-105 active:scale-95"
          >
            ← 返回大厅
          </button>
        </div>
      </div>
    </div>
  );
}
