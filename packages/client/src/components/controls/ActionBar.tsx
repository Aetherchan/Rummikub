import type { TurnPhase } from '@rummikub/shared';
import { formatTime, type TurnTimer } from '@rummikub/engine';

interface ActionBarProps {
  isCurrentPlayer: boolean;
  turnPhase: TurnPhase;
  timer: TurnTimer;
  hasMelded: boolean;
  canCommit: boolean;
  canDraw: boolean;
  aiHintEnabled: boolean;
  isComputingHint: boolean;
  onCommit: () => void;
  onDraw: () => void;
  onPass: () => void;
  onReset: () => void;
  onHint: () => void;
  onSort: () => void;
}

export default function ActionBar({
  isCurrentPlayer,
  turnPhase,
  timer,
  hasMelded,
  canCommit,
  canDraw,
  aiHintEnabled,
  isComputingHint,
  onCommit,
  onDraw,
  onPass,
  onReset,
  onHint,
  onSort,
}: ActionBarProps) {
  if (!isCurrentPlayer || turnPhase === 'WAITING') {
    return (
      <div className="flex items-center gap-4 px-4 py-3 bg-green-800/50">
        <span className="text-green-300 text-sm">等待其他玩家操作...</span>
      </div>
    );
  }

  const isArranging = turnPhase === 'ARRANGING';
  const timerClass = !timer.isUnlimited && timer.secondsRemaining <= 10
    ? 'text-red-400 animate-pulse font-bold'
    : 'text-yellow-300';

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-green-800/80 border-t border-green-700 flex-wrap">
      {/* 计时器 */}
      <div className={`text-xl font-mono ${timerClass} mr-2`}>
        {formatTime(timer)}
      </div>

      {/* 破冰状态 */}
      {!hasMelded && (
        <span className="text-orange-400 text-xs bg-orange-400/10 px-2 py-1 rounded">
          需破冰 ≥30分
        </span>
      )}

      <div className="flex-1" />

      {/* 操作按钮 */}
      <div className="flex gap-2">
        {/* 排序 */}
        <button
          onClick={onSort}
          className="px-3 py-2 text-sm bg-green-700 hover:bg-green-600 rounded-lg transition text-green-200"
        >
          🔀 排序
        </button>

        {/* 重置（试错回退） */}
        <button
          onClick={onReset}
          className="px-3 py-2 text-sm bg-red-700/50 hover:bg-red-700 rounded-lg transition text-red-200"
          title="恢复回合开始前的状态"
        >
          ↩ 重置
        </button>

        {isArranging && (
          <>
            {/* 摸牌 */}
            <button
              onClick={onDraw}
              disabled={!canDraw}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800
                         disabled:text-blue-400 rounded-lg transition font-bold"
            >
              🎴 摸牌
            </button>

            {/* 出牌 */}
            <button
              onClick={onCommit}
              disabled={!canCommit}
              className="px-6 py-2 text-sm bg-yellow-500 hover:bg-yellow-400 disabled:bg-yellow-800
                         disabled:text-yellow-600 rounded-lg transition font-bold text-green-900"
            >
              ✅ 出牌
            </button>
          </>
        )}

        {!isArranging && (
          <button
            onClick={onPass}
            className="px-6 py-2 text-sm bg-yellow-500 hover:bg-yellow-400 rounded-lg transition font-bold text-green-900"
          >
            ➡ 跳过
          </button>
        )}

        {/* AI 提示 */}
        {aiHintEnabled && (
          <button
            onClick={onHint}
            disabled={isComputingHint}
            className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800
                       rounded-lg transition font-bold"
          >
            {isComputingHint ? '🤔 计算中...' : '💡 提示'}
          </button>
        )}
      </div>
    </div>
  );
}
