import { useEffect, useRef } from 'react';
import { useGameStore } from '../../stores/game-store';
import BoardArea from './BoardArea';
import PlayerHand from '../hand/PlayerHand';
import ActionBar from '../controls/ActionBar';
import GameOverPanel from './GameOverPanel';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';

interface GameBoardProps {
  onBackToLobby: () => void;
}

export default function GameBoard({ onBackToLobby }: GameBoardProps) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const gameState = useGameStore(s => s.gameState);
  const optimisticState = useGameStore(s => s.optimisticState);
  const timer = useGameStore(s => s.timer);
  const selectedHandIds = useGameStore(s => s.selectedHandIds);
  const selectedBoardIds = useGameStore(s => s.selectedBoardIds);
  const hintedTileIds = useGameStore(s => s.hintedTileIds);
  const aiHintEnabled = useGameStore(s => s.aiHintEnabled);
  const isComputingHint = useGameStore(s => s.isComputingHint);
  const isBotThinking = useGameStore(s => s.isBotThinking);
  const p2pMode = useGameStore(s => s.p2pMode);

  const toggleHandTile = useGameStore(s => s.toggleHandTile);
  const toggleBoardTile = useGameStore(s => s.toggleBoardTile);
  const commitMove = useGameStore(s => s.commitMove);
  const drawTileAction = useGameStore(s => s.drawTileAction);
  const passTurnAction = useGameStore(s => s.passTurnAction);
  const resetAttempt = useGameStore(s => s.resetAttempt);
  const requestHint = useGameStore(s => s.requestHint);
  const tickTimerAction = useGameStore(s => s.tickTimerAction);
  const startTimerAction = useGameStore(s => s.startTimerAction);
  const sortHand = useGameStore(s => s.sortHand);
  const canCommit = useGameStore(s => s.canCommit);
  const canDraw = useGameStore(s => s.canDraw);
  const backToLobby = useGameStore(s => s.backToLobby);

  // 启动计时器
  useEffect(() => {
    if (!gameState || timer.isUnlimited) return;
    if (timer.state !== 'RUNNING') {
      startTimerAction();
    }
  }, [gameState?.currentPlayerIndex, gameState?.turnNumber]);

  // 每秒 tick
  useEffect(() => {
    if (timer.isUnlimited) return;
    timerRef.current = setInterval(() => {
      tickTimerAction(1);
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timer.isUnlimited]);

  if (!optimisticState || !gameState) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <p className="text-green-300 text-xl">正在加载游戏...</p>
      </div>
    );
  }

  const isMyTurn = (() => {
    const cp = optimisticState.players[optimisticState.currentPlayerIndex];
    return cp && !cp.isBot;
  })();

  const humanPlayer = optimisticState.players.find(p => !p.isBot);
  const currentPlayer = optimisticState.players[optimisticState.currentPlayerIndex];
  const myHand = humanPlayer ? humanPlayer.handTiles : [];
  const hasMelded = humanPlayer ? humanPlayer.hasMelded : false;

  const handleDragStart = (_event: DragStartEvent) => {
    // 拖拽开始
  };

  const handleDragEnd = (_event: DragEndEvent) => {
    // 拖拽结束 → 后期处理为走法
  };

  const handleReorder = (_activeId: string, _overId: string) => {
    // 手牌重新排序 → 后期实现
  };

  const handleCommit = () => {
    const hand = myHand.filter(t => selectedHandIds.includes(t.instanceId));
    if (hand.length > 0) {
      // 从选中的手牌构建 CREATE_SET 走法
      const setId = `set-${Date.now()}`;
      const moves = [{ type: 'CREATE_SET' as const, setId, tiles: hand }];
      commitMove(moves);
    } else {
      // 无选中手牌 — 可能是在操作桌面牌组后确认
      commitMove([]);
    }
  };

  const handleBackToLobby = () => {
    backToLobby();
    onBackToLobby();
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* 顶部信息栏 */}
      <header className="bg-green-800/90 border-b border-green-700 px-4 py-2 flex items-center gap-4">
        <button
          onClick={handleBackToLobby}
          className="text-sm text-green-300 hover:text-white transition"
        >
          ← 大厅
        </button>
        <h1 className="text-yellow-300 font-bold">Rummikub</h1>

        {/* P2P 状态指示 */}
        {p2pMode && (
          <span className={[
            'text-xs px-2 py-0.5 rounded-full',
            p2pMode.type === 'host'
              ? 'bg-blue-600/50 text-blue-200'
              : 'bg-purple-600/50 text-purple-200',
          ].join(' ')}>
            {p2pMode.type === 'host' ? '🏠 主机' : '🔗 已连接'}
          </span>
        )}

        <div className="flex-1" />

        {/* 所有玩家信息 */}
        <div className="flex gap-3">
          {optimisticState.players.map((p, i) => {
            const isCurrent = i === optimisticState.currentPlayerIndex;
            return (
              <div
                key={p.id}
                className={[
                  'px-3 py-1 rounded-lg text-sm border transition',
                  isCurrent
                    ? 'bg-yellow-500/20 border-yellow-500 text-yellow-300'
                    : 'bg-green-700/50 border-green-600 text-green-300',
                ].join(' ')}
              >
                <span>{p.name}</span>
                <span className="ml-2 text-xs opacity-70">{p.handTileCount}张</span>
                {p.hasMelded && <span className="ml-1 text-xs">✓</span>}
                {isBotThinking && isCurrent && (
                  <span className="ml-1 animate-pulse">🤔</span>
                )}
              </div>
            );
          })}
        </div>
      </header>

      {/* 桌面区域 */}
      <BoardArea
        boardSets={optimisticState.boardSets}
        poolTileCount={optimisticState.poolTileCount}
        selectedTileIds={selectedBoardIds}
        onTileClick={(tile) => toggleBoardTile(tile.instanceId)}
      />

      <div className="flex-1" />

      {/* 手牌区域 */}
      <div className="bg-green-800/60 border-t border-green-700 pt-2">
        <PlayerHand
          tiles={myHand}
          selectedTileIds={selectedHandIds}
          hintedTileIds={hintedTileIds}
          isCurrentPlayer={isMyTurn}
          onTileClick={(tile) => toggleHandTile(tile.instanceId)}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onReorder={handleReorder}
        />
      </div>

      {/* 操作栏 */}
      <ActionBar
        isCurrentPlayer={isMyTurn}
        turnPhase={optimisticState.turnPhase}
        timer={timer}
        hasMelded={hasMelded}
        canCommit={canCommit()}
        canDraw={canDraw()}
        aiHintEnabled={aiHintEnabled}
        isComputingHint={isComputingHint}
        onCommit={handleCommit}
        onDraw={drawTileAction}
        onPass={passTurnAction}
        onReset={resetAttempt}
        onHint={requestHint}
        onSort={sortHand}
      />

      {/* 游戏结束面板 */}
      {optimisticState.phase === 'GAME_OVER' && (
        <GameOverPanel
          gameState={gameState}
          onBackToLobby={handleBackToLobby}
        />
      )}
    </div>
  );
}
