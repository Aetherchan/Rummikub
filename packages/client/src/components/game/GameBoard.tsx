import { useEffect, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  pointerWithin,
  closestCenter,
} from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useGameStore } from '../../stores/game-store';
import BoardArea from './BoardArea';
import PlayerHand from '../hand/PlayerHand';
import ActionBar from '../controls/ActionBar';
import GameOverPanel from './GameOverPanel';
import JokerPicker from '../tiles/JokerPicker';
import TileFace from '../tiles/TileFace';
import { isJoker } from '@rummikub/engine';
import type { JokerSubstitution, TileInstance, TileOnBoard } from '@rummikub/shared';

interface GameBoardProps {
  onBackToLobby: () => void;
}

interface DragActiveData {
  tile: TileInstance;
  instanceId: string;
  isHandTile: boolean;
  setId?: string;
  index?: number;
}

export default function GameBoard({ onBackToLobby }: GameBoardProps) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const gameState = useGameStore(s => s.gameState);
  const optimisticState = useGameStore(s => s.optimisticState);
  const timer = useGameStore(s => s.timer);
  const selectedHandIds = useGameStore(s => s.selectedHandIds);
  const selectedBoardIds = useGameStore(s => s.selectedBoardIds);
  const hintedTileIds = useGameStore(s => s.hintedTileIds);
  const invalidSetIds = useGameStore(s => s.invalidSetIds);
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

  const moveTileFromHandToNewSet = useGameStore(s => s.moveTileFromHandToNewSet);
  const moveTileFromHandToSet = useGameStore(s => s.moveTileFromHandToSet);
  const moveTileBetweenSets = useGameStore(s => s.moveTileBetweenSets);
  const moveTileFromBoardToHand = useGameStore(s => s.moveTileFromBoardToHand);
  const setJokerSubstitution = useGameStore(s => s.setJokerSubstitution);

  // 拖拽状态
  const [activeTile, setActiveTile] = useState<DragActiveData | null>(null);
  // Joker 替代值弹窗
  const [pendingJoker, setPendingJoker] = useState<{
    instanceId: string;
    tile: TileInstance;
    action: () => void; // 设置替代值后执行的操作
  } | null>(null);

  // 配置传感器
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

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

  // ---- 拖拽事件 ----

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as DragActiveData | undefined;
    if (data) {
      setActiveTile(data);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTile(null);

    if (!active || !over) return;

    const activeData = active.data.current as DragActiveData | undefined;
    const overData = over.data.current as Record<string, unknown> | undefined;

    if (!activeData || !overData) return;

    const isHandTile = activeData.isHandTile;
    const sourceSetId = activeData.setId;
    const targetType = overData.type as string | undefined;
    const targetSetId = overData.setId as string | undefined;

    // 不是自己的回合 → 忽略
    if (!isMyTurn) return;

    if (isHandTile) {
      // 手牌拖出
      if (targetType === 'board-set' && targetSetId) {
        // 手牌 → 已有牌组
        applyMoveOrPromptJoker(activeData, () =>
          moveTileFromHandToSet(activeData.instanceId, targetSetId),
        );
      } else if (targetType === 'empty-board') {
        // 手牌 → 空白区域（创建新牌组）
        applyMoveOrPromptJoker(activeData, () =>
          moveTileFromHandToNewSet(activeData.instanceId),
        );
      }
      // 手牌拖回手牌区 → 忽略
    } else {
      // 桌面牌拖出
      if (!sourceSetId) return;

      if (targetType === 'board-set' && targetSetId && targetSetId !== sourceSetId) {
        // 桌面牌 → 另一个牌组
        applyMoveOrPromptJoker(activeData, () =>
          moveTileBetweenSets(activeData.instanceId, sourceSetId, targetSetId),
        );
      } else if (targetType === 'hand-area') {
        // 桌面牌 → 手牌
        moveTileFromBoardToHand(activeData.instanceId, sourceSetId);
      } else if (targetType === 'empty-board') {
        // 桌面牌 → 空白区域（从原牌组分离到新牌组）
        // 从源牌组移除 + 创建新牌组
        const os = useGameStore.getState().optimisticState;
        if (!os) return;
        const sourceSet = os.boardSets.find(s => s.id === sourceSetId);
        if (!sourceSet) return;
        const tile = sourceSet.tiles.find(t => t.instanceId === activeData.instanceId);
        if (!tile) return;

        // 先从源牌组移除，再创建新牌组
        moveTileFromBoardToHand(activeData.instanceId, sourceSetId);
        // 把退回手牌的牌立即放到空白区域形成新牌组
        setTimeout(() => {
          moveTileFromHandToNewSet(activeData.instanceId);
        }, 0);
      }
      // 桌面牌拖回同一个牌组 → 忽略
    }
  };

  /**
   * 如果被拖的牌是 Joker（从手牌），弹出 JokerPicker 设置替代值后再执行操作。
   * 桌面 Joker 已有替代值，不需要再次弹出。
   */
  const applyMoveOrPromptJoker = (data: DragActiveData, action: () => void) => {
    const tile = data.tile;
    if (isJoker(tile) && data.isHandTile) {
      // 从手牌拖出 Joker → 弹出设置
      setPendingJoker({
        instanceId: data.instanceId,
        tile,
        action: () => {
          // 先执行操作（把 Joker 放到桌面）
          action();
          // 获取新创建的 instanceId 对应的桌面牌...
          // 实际上操作后 tile 在 boardSets 中，instanceId 不变
        },
      });
      // 先执行操作（放到桌面），然后再设置替代值
      action();
    } else {
      action();
    }
  };

  /** JokerPicker 确认：设置替代值 */
  const handleJokerConfirm = (substitution: JokerSubstitution) => {
    if (!pendingJoker) return;
    setJokerSubstitution(pendingJoker.instanceId, substitution);
    setPendingJoker(null);
  };

  /** JokerPicker 取消：把 Joker 退回手牌 */
  const handleJokerCancel = () => {
    if (!pendingJoker) return;
    // 找到 Joker 所在的牌组并退回手牌
    const os = useGameStore.getState().optimisticState;
    if (os) {
      for (const set of os.boardSets) {
        const tile = set.tiles.find(t => t.instanceId === pendingJoker.instanceId);
        if (tile) {
          moveTileFromBoardToHand(pendingJoker.instanceId, set.id);
          break;
        }
      }
    }
    setPendingJoker(null);
  };

  /** 点击桌面上已有的 Joker 牌（编辑替代值） */
  const handleBoardJokerEdit = (tile: TileOnBoard) => {
    if (!isMyTurn) return;
    // 找到该 Joker 所在的牌组
    const os = useGameStore.getState().optimisticState;
    if (!os) return;
    for (const set of os.boardSets) {
      const found = set.tiles.find(t => t.instanceId === tile.instanceId);
      if (found) {
        setPendingJoker({
          instanceId: tile.instanceId,
          tile,
          action: () => {}, // 已在桌面上，无需额外操作
        });
        break;
      }
    }
  };

  const handleCommit = () => {
    commitMove();
  };

  const handleBackToLobby = () => {
    backToLobby();
    onBackToLobby();
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={(args) => {
        // 优先检测指针是否在 droppable 区域内
        const pointerCollisions = pointerWithin(args);
        if (pointerCollisions.length > 0) return pointerCollisions;
        // 回退到最近的中心点检测
        return closestCenter(args);
      }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
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
          invalidSetIds={invalidSetIds}
          onTileClick={(tile) => toggleBoardTile(tile.instanceId)}
          onJokerEdit={handleBoardJokerEdit}
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

      {/* 拖动幽灵牌 */}
      <DragOverlay>
        {activeTile ? (
          <div className="opacity-80 scale-110">
            <TileFace tile={activeTile.tile} />
          </div>
        ) : null}
      </DragOverlay>

      {/* Joker 替代值选择器 */}
      {pendingJoker && (
        <JokerPicker
          tile={pendingJoker.tile}
          onConfirm={handleJokerConfirm}
          onCancel={handleJokerCancel}
        />
      )}
    </DndContext>
  );
}
