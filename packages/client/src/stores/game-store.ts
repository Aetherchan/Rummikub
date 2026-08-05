import { create } from 'zustand';
import type {
  GameState, PlayerState, TileInstance,
  SetOnBoard, TurnPhase, PlayerId,
  GameStateDiff, ScoreEntry, GameConfig,
  TileOnBoard, JokerSubstitution,
} from '@rummikub/shared';
import {
  createDefaultConfig, createPlayerState, createGameState,
  startGame, applyMove, drawTile, passTurn, handleTimeout,
  handleInvalidAttempt,
  createSnapshot, restoreSnapshot,
  createTimer, startTimer as startTimerFn, tickTimer, resetTimer,
  isExpired,
  sortTiles, isJoker,
  validateBoardForCommit, diffMoves,
  validateSet,
} from '@rummikub/engine';
import type { MoveBatch, AtomicMove } from '@rummikub/engine';
import type { TurnTimer } from '@rummikub/engine';
import { generateInstanceId, GameError } from '@rummikub/engine';
import { easyBotDecide, mediumBotDecide, hardBotDecide, generateMoveOptions } from '../bot';
import type { BotDecision } from '../bot';
import { useToastStore } from './toast-store';

// ---- 类型 ----

export type P2PGameMode = { type: 'host'; hostRoom: any } | { type: 'guest'; clientRoom: any };

interface LocalGameState {
  gameState: GameState | null;
  optimisticState: GameState | null;
  turnSnapshot: GameState | null;
  timer: TurnTimer;
  selectedHandIds: string[];
  selectedBoardIds: string[];
  hintedTileIds: string[];
  isComputingHint: boolean;
  aiHintEnabled: boolean;
  isBotThinking: boolean;
  pendingConfig: {
    playerCount: number;
    aiCount: number;
    aiDifficulty: 'easy' | 'medium' | 'hard';
    timeLimit: number;
    aiHintEnabled: boolean;
  };
  /** P2P 模式 */
  p2pMode: P2PGameMode | null;
  /** P2P 主机房间引用 */
  _hostRoom: any;
  /** P2P 客户端房间引用 */
  _clientRoom: any;
  /** P2P 连接是否断开 */
  p2pDisconnected: boolean;
  /** 游戏结束时的最终得分（P2P 客户端可能没有完整手牌数据） */
  finalScores: ScoreEntry[] | null;
  /** 提交验证失败时的牌组 ID 列表（用于 UI 高亮） */
  invalidSetIds: string[];
  /** Guest 已发送走法，等待 Host 响应 */
  isWaitingForHost: boolean;
}

interface GameActions {
  setPendingConfig: (config: Partial<LocalGameState['pendingConfig']>) => void;
  startSinglePlayerGame: () => void;
  toggleHandTile: (instanceId: string) => void;
  toggleBoardTile: (instanceId: string) => void;
  commitMove: (remoteMoves?: AtomicMove[]) => void;
  drawTileAction: () => void;
  passTurnAction: () => void;
  resetAttempt: () => void;
  requestHint: () => void;
  botMove: (moves: AtomicMove[]) => void;
  tickTimerAction: (delta?: number) => void;
  startTimerAction: () => void;
  sortHand: () => void;
  currentPlayer: () => PlayerState | null;
  currentHand: () => TileInstance[];
  canCommit: () => boolean;
  canDraw: () => boolean;
  backToLobby: () => void;
  // P2P 操作
  setP2PMode: (mode: P2PGameMode | null) => void;
  setHostRoom: (room: any) => void;
  setClientRoom: (room: any) => void;
  startP2PHostGame: () => void;
  setP2PGuestState: (gameState: GameState, myIndex: number) => void;
  receiveP2PHand: (tiles: TileInstance[]) => void;
  receiveP2PStateUpdate: (diff: GameStateDiff) => void;
  receiveP2PTurnChange: (playerIndex: number, phase: TurnPhase) => void;
  receiveP2PGameOver: (winnerId: string, scores: ScoreEntry[]) => void;
  sendP2PMove: (moves: AtomicMove[]) => void;
  sendP2PDrawTile: () => void;
  sendP2PPassTurn: () => void;
  setP2PDisconnected: (v: boolean) => void;
  p2pRoomClosed: (reason: string) => void;
  // 本地操作（直接修改 optimisticState，提交时用 diff 生成 AtomicMove）
  moveTileFromHandToNewSet: (instanceId: string) => void;
  moveTileFromHandToSet: (instanceId: string, targetSetId: string) => void;
  moveTileBetweenSets: (instanceId: string, sourceSetId: string, targetSetId: string) => void;
  moveTileFromBoardToHand: (instanceId: string, sourceSetId: string) => void;
  setJokerSubstitution: (instanceId: string, substitution: JokerSubstitution) => void;
}

export type GameStore = LocalGameState & GameActions;

// ---- helpers ----

function toggleInArray(arr: string[], id: string): string[] {
  const idx = arr.indexOf(id);
  if (idx >= 0) return [...arr.slice(0, idx), ...arr.slice(idx + 1)];
  return [...arr, id];
}

/** 检查引擎返回值是否为 GameError */
function isE(result: unknown): result is GameError {
  return result instanceof GameError
    || (typeof result === 'object' && result !== null && 'code' in result && !('state' in result));
}

/** 推断牌组类型（用于显示"群组"还是"顺子"） */
function inferSetType(tiles: TileInstance[]): 'group' | 'run' {
  if (tiles.length >= 3) {
    const result = validateSet(tiles);
    if (result.valid && result.type) return result.type;
  }
  // 少于 3 张时用启发式：所有非Joker牌同数值 → group，否则 → run
  const nonJokers = tiles.filter(t => !isJoker(t));
  if (nonJokers.length >= 2 && nonJokers.every(t => t.value === nonJokers[0].value)) {
    return 'group';
  }
  return 'run';
}

/** 如果是 P2P 主机模式，广播游戏状态给所有客户端 */
function broadcastIfHost(state: GameState, hostRoom: any): void {
  if (hostRoom && typeof hostRoom.broadcastGameState === 'function') {
    hostRoom.broadcastGameState(state);
    // 也广播回合变更
    if (typeof hostRoom.broadcastTurnChange === 'function') {
      hostRoom.broadcastTurnChange(
        state.currentPlayerIndex,
        state.turnPhase,
      );
    }
  }
}

// ---- Store ----

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: null,
  optimisticState: null,
  turnSnapshot: null,
  timer: createTimer(120),
  selectedHandIds: [],
  selectedBoardIds: [],
  hintedTileIds: [],
  isComputingHint: false,
  aiHintEnabled: false,
  isBotThinking: false,
  pendingConfig: {
    playerCount: 2,
    aiCount: 1,
    aiDifficulty: 'hard',
    timeLimit: 0,
    aiHintEnabled: false,
  },
  p2pMode: null,
  _hostRoom: null,
  _clientRoom: null,
  p2pDisconnected: false,
  finalScores: null,
  invalidSetIds: [],
  isWaitingForHost: false,

  setPendingConfig: (partial) => set(s => ({
    pendingConfig: { ...s.pendingConfig, ...partial },
  })),

  startSinglePlayerGame: () => {
    const { pendingConfig } = get();
    const config = createDefaultConfig({
      maxPlayers: pendingConfig.playerCount as 2 | 3 | 4,
      turnTimeLimitSeconds: pendingConfig.timeLimit,
      aiPlayers: pendingConfig.aiCount,
      aiDifficulty: pendingConfig.aiDifficulty,
    });

    const players: PlayerState[] = [];
    players.push(createPlayerState('player-0', '你', false));
    for (let i = 0; i < pendingConfig.aiCount; i++) {
      const diffLabel = { easy: '简单', medium: '中等', hard: '困难' }[pendingConfig.aiDifficulty];
      players.push(createPlayerState(`player-${i + 1}`, `AI-${diffLabel} #${i + 1}`, true));
    }
    for (let i = pendingConfig.aiCount + 1; i < pendingConfig.playerCount; i++) {
      players.push(createPlayerState(`player-${i}`, `玩家 ${i + 1}`, false));
    }

    const result = startGame(createGameState('single-game', players, config));
    const state = result.state;
    const snapshot = createSnapshot(state);
    const timer = createTimer(pendingConfig.timeLimit);

    set({
      gameState: state,
      optimisticState: state,
      turnSnapshot: snapshot,
      timer: startTimerFn(timer),
      selectedHandIds: [],
      selectedBoardIds: [],
      hintedTileIds: [],
      aiHintEnabled: pendingConfig.aiHintEnabled,
      isBotThinking: false,
    });

    if (state.players[state.currentPlayerIndex]?.isBot) {
      setTimeout(() => get().botMove([]), 500);
    }
  },

  toggleHandTile: (instanceId) => set(s => ({
    selectedHandIds: toggleInArray(s.selectedHandIds, instanceId),
    hintedTileIds: [], // 点击牌时自动清除提示
    invalidSetIds: [], // 操作时清除错误状态
  })),

  toggleBoardTile: (instanceId) => set(s => ({
    selectedBoardIds: toggleInArray(s.selectedBoardIds, instanceId),
    invalidSetIds: [],
  })),

  // ---- 本地操作（直接修改 optimisticState） ----

  moveTileFromHandToNewSet: (instanceId) => {
    const os = get().optimisticState;
    if (!os) return;
    const playerIdx = os.currentPlayerIndex;
    const tile = os.players[playerIdx].handTiles.find(t => t.instanceId === instanceId);
    if (!tile) return;

    const newSetId = generateInstanceId();
    const boardTile = { ...tile, jokerSubstitution: undefined } as TileOnBoard;
    const newSet: SetOnBoard = {
      id: newSetId,
      tiles: [boardTile],
      type: 'run', // 单张牌暂定为 run，后续添加牌时会重新推断
    };

    set({
      optimisticState: {
        ...os,
        boardSets: [...os.boardSets, newSet],
        players: os.players.map((p, i) =>
          i === playerIdx
            ? {
              ...p,
              handTiles: p.handTiles.filter(t => t.instanceId !== instanceId),
              handTileCount: p.handTileCount - 1,
            }
            : p,
        ),
      } as GameState,
      invalidSetIds: [],
    });
  },

  moveTileFromHandToSet: (instanceId, targetSetId) => {
    const os = get().optimisticState;
    if (!os) return;
    const playerIdx = os.currentPlayerIndex;
    const tile = os.players[playerIdx].handTiles.find(t => t.instanceId === instanceId);
    if (!tile) return;

    const targetSet = os.boardSets.find(s => s.id === targetSetId);
    if (!targetSet) return;

    const boardTile = { ...tile, jokerSubstitution: undefined } as TileOnBoard;

    set({
      optimisticState: {
        ...os,
        boardSets: os.boardSets.map(s => {
          if (s.id !== targetSetId) return s;
          const newTiles = [...s.tiles, boardTile];
          return { ...s, tiles: newTiles, type: inferSetType(newTiles) };
        }),
        players: os.players.map((p, i) =>
          i === playerIdx
            ? {
              ...p,
              handTiles: p.handTiles.filter(t => t.instanceId !== instanceId),
              handTileCount: p.handTileCount - 1,
            }
            : p,
        ),
      } as GameState,
      invalidSetIds: [],
    });
  },

  moveTileBetweenSets: (instanceId, sourceSetId, targetSetId) => {
    const os = get().optimisticState;
    if (!os) return;

    const sourceSet = os.boardSets.find(s => s.id === sourceSetId);
    if (!sourceSet) return;
    const tile = sourceSet.tiles.find(t => t.instanceId === instanceId);
    if (!tile) return;

    // 从源牌组移除，加入目标牌组
    const newSourceTiles = sourceSet.tiles.filter(t => t.instanceId !== instanceId);
    let newBoardSets = os.boardSets.map(s => {
      if (s.id === sourceSetId) {
        return { ...s, tiles: newSourceTiles, type: inferSetType(newSourceTiles) };
      }
      if (s.id === targetSetId) {
        const newTiles = [...s.tiles, tile];
        return { ...s, tiles: newTiles, type: inferSetType(newTiles) };
      }
      return s;
    });

    // 过滤空牌组
    newBoardSets = newBoardSets.filter(s => s.tiles.length > 0);

    set({
      optimisticState: {
        ...os,
        boardSets: newBoardSets,
      } as GameState,
      invalidSetIds: [],
    });
  },

  moveTileFromBoardToHand: (instanceId, sourceSetId) => {
    const os = get().optimisticState;
    if (!os) return;
    const playerIdx = os.currentPlayerIndex;

    const sourceSet = os.boardSets.find(s => s.id === sourceSetId);
    if (!sourceSet) return;
    const tile = sourceSet.tiles.find(t => t.instanceId === instanceId);
    if (!tile) return;

    // 从牌组移除，退回手牌（清除 Joker 替代值）
    const newSourceTiles = sourceSet.tiles.filter(t => t.instanceId !== instanceId);
    let newBoardSets = os.boardSets
      .map(s => s.id === sourceSetId ? { ...s, tiles: newSourceTiles, type: inferSetType(newSourceTiles) } : s)
      .filter(s => s.tiles.length > 0);

    const handTile: TileInstance = {
      id: tile.id,
      color: tile.color,
      value: tile.value,
      instanceId: tile.instanceId,
    };

    set({
      optimisticState: {
        ...os,
        boardSets: newBoardSets,
        players: os.players.map((p, i) =>
          i === playerIdx
            ? {
              ...p,
              handTiles: [...p.handTiles, handTile],
              handTileCount: p.handTileCount + 1,
            }
            : p,
        ),
      } as GameState,
      invalidSetIds: [],
    });
  },

  setJokerSubstitution: (instanceId, substitution) => {
    const os = get().optimisticState;
    if (!os) return;
    set({
      optimisticState: {
        ...os,
        boardSets: os.boardSets.map(set => ({
          ...set,
          tiles: set.tiles.map(tile =>
            tile.instanceId === instanceId
              ? { ...tile, jokerSubstitution: substitution }
              : tile,
          ),
        })),
      } as GameState,
    });
  },

  // ---- 提交走法（三路径：远程/guest/本地） ----

  /**
   * 提交走法。
   * - remoteMoves 提供时：Host 处理 Guest 发来的走法（跳过本地 diff，直接应用）
   * - p2pMode === 'guest' 时：生成走法 → 发送给 Host（不本地执行引擎）
   * - 否则（Host/单机）：本地 diff → 引擎验证 → 广播
   */
  commitMove: (remoteMoves?: AtomicMove[]) => {
    const { optimisticState, turnSnapshot, gameState, p2pMode } = get();
    if (!optimisticState || !turnSnapshot || !gameState) return;

    const cp = optimisticState.players[optimisticState.currentPlayerIndex];

    // ---- 路径 A：Host 处理远程 Guest 走法 ----
    if (remoteMoves && remoteMoves.length > 0) {
      const batch: MoveBatch = {
        moveId: generateInstanceId(),
        playerId: cp.id,
        moves: remoteMoves,
      };

      const result = applyMove(gameState, batch);
      if (isE(result)) {
        // 走法不合法 → 通知该 Guest 并恢复（不罚摸，因为 Guest 已做本地验证）
        const recovery = handleInvalidAttempt(turnSnapshot, false);
        const ns = recovery.state;
        const newSnapshot = createSnapshot(ns);
        set({
          gameState: ns,
          optimisticState: ns,
          turnSnapshot: newSnapshot,
          selectedHandIds: [],
          selectedBoardIds: [],
          hintedTileIds: [],
          invalidSetIds: [],
          timer: createTimer(ns.config.turnTimeLimitSeconds),
        });
        // 向 Guest 发送错误（HostRoomView 的 onClientMove 持有 host ref，
        // 这里通过 _hostRoom 发错误消息）
        const hostRoom = get()._hostRoom;
        if (hostRoom) {
          // 找到发送者的 peerId
          // 由于 store 没有直接的 peerId→playerId 映射，通过 hostRoom 广播错误状态
          // 实际做法：广播 full_state 让所有客户端同步到正确状态
          hostRoom.broadcastGameState(ns);
        }
        useToastStore.getState().toast({
          type: 'error',
          message: `玩家走法无效：${result.message}`,
          duration: 4000,
        });
        return;
      }

      // 成功 → 广播
      const ns = result.state;
      const newSnapshot = createSnapshot(ns);
      const newTimer = startTimerFn(resetTimer(createTimer(ns.config.turnTimeLimitSeconds)));
      set({
        gameState: ns,
        optimisticState: ns,
        turnSnapshot: newSnapshot,
        selectedHandIds: [],
        selectedBoardIds: [],
        hintedTileIds: [],
        invalidSetIds: [],
        timer: newTimer,
      });
      broadcastIfHost(ns, get()._hostRoom);
      if (ns.phase !== 'GAME_OVER' && ns.players[ns.currentPlayerIndex]?.isBot) {
        setTimeout(() => get().botMove([]), 500);
      }
      return;
    }

    // ---- 本地验证（Guest 和 Host/单机共用） ----

    const hasMelded = cp.hasMelded;

    // 1. 检查当前玩家新放下的 Joker 是否都有替代值
    const snapshotBoardInstanceIds = new Set<string>();
    for (const ss of turnSnapshot.boardSets) {
      for (const tile of ss.tiles) {
        snapshotBoardInstanceIds.add(tile.instanceId);
      }
    }

    for (const boardSet of optimisticState.boardSets) {
      for (const tile of boardSet.tiles) {
        if (isJoker(tile)
          && !snapshotBoardInstanceIds.has(tile.instanceId)
          && !(tile as TileOnBoard).jokerSubstitution) {
          useToastStore.getState().toast({
            type: 'error',
            message: '百搭牌 (Joker) 需要设置替代值，请点击 Joker 牌设置',
            duration: 4000,
          });
          set({ invalidSetIds: [boardSet.id] });
          return;
        }
      }
    }

    // 2. 本地验证桌面牌组
    const validation = validateBoardForCommit(
      optimisticState.boardSets,
      turnSnapshot.boardSets,
      hasMelded,
      optimisticState.config.initialMeldMinimum,
    );

    if (!validation.valid) {
      const firstError = validation.errors[0] ?? '牌组不合法';
      useToastStore.getState().toast({
        type: 'error',
        message: `出牌无效: ${firstError}`,
        duration: 5000,
      });
      const invalidIds = validation.setResults
        .filter(r => !r.valid)
        .map(r => r.setId);
      set({ invalidSetIds: invalidIds.length > 0 ? invalidIds : [] });
      return;
    }

    // 如果玩家尚未破冰，额外检查破冰分数
    if (!hasMelded && validation.scoreFromHand > 0 && !validation.meldMet) {
      useToastStore.getState().toast({
        type: 'error',
        message: `破冰需要至少 ${optimisticState.config.initialMeldMinimum} 分，当前从手牌打出 ${validation.scoreFromHand} 分`,
        duration: 5000,
      });
      set({ invalidSetIds: optimisticState.boardSets.map(s => s.id) });
      return;
    }

    // 3. 生成走法
    const moves = diffMoves(
      turnSnapshot.boardSets,
      optimisticState.boardSets,
      turnSnapshot.players[turnSnapshot.currentPlayerIndex].handTiles,
      optimisticState.players[optimisticState.currentPlayerIndex].handTiles,
    );

    if (moves.length === 0) {
      useToastStore.getState().toast({
        type: 'warning',
        message: '没有打出任何牌，请先操作牌组或选择摸牌/跳过',
        duration: 3000,
      });
      return;
    }

    if (validation.scoreFromHand === 0) {
      useToastStore.getState().toast({
        type: 'warning',
        message: '仅移动桌面牌组不能出牌，请至少从手牌打出一张牌，或选择摸牌',
        duration: 4000,
      });
      return;
    }

    // ---- 路径 B：Guest 模式 — 发送走法给 Host，不本地执行 ----
    if (p2pMode?.type === 'guest') {
      get().sendP2PMove(moves);
      useToastStore.getState().toast({
        type: 'info',
        message: '走法已发送，等待主机确认...',
        duration: 2000,
      });
      set({ isWaitingForHost: true });
      return;
    }

    // ---- 路径 C：Host/单机 — 本地引擎执行 ----

    const batch: MoveBatch = {
      moveId: generateInstanceId(),
      playerId: cp.id,
      moves,
    };

    const result = applyMove(gameState, batch);
    if (isE(result)) {
      const snapshot = turnSnapshot;
      if (!snapshot) return;

      const hasTimeLimit = optimisticState.config.turnTimeLimitSeconds > 0;
      const recovery = handleInvalidAttempt(snapshot, hasTimeLimit);
      const ns = recovery.state;
      const newSnapshot = createSnapshot(ns);

      set({
        gameState: ns,
        optimisticState: ns,
        turnSnapshot: newSnapshot,
        selectedHandIds: [],
        selectedBoardIds: [],
        hintedTileIds: [],
        invalidSetIds: [],
        timer: createTimer(ns.config.turnTimeLimitSeconds),
      });

      if (hasTimeLimit) {
        useToastStore.getState().toast({
          type: 'error',
          message: `出牌无效：${result.message}。罚摸 3 张牌`,
          duration: 5000,
        });
      } else {
        useToastStore.getState().toast({
          type: 'error',
          message: `出牌无效：${result.message}。已恢复回合开始状态`,
          duration: 5000,
        });
      }

      if (ns.phase !== 'GAME_OVER' && ns.players[ns.currentPlayerIndex]?.isBot) {
        setTimeout(() => get().botMove([]), 500);
      }
      return;
    }

    // success
    const ns = result.state;
    const newSnapshot = createSnapshot(ns);
    const newTimer = startTimerFn(resetTimer(createTimer(ns.config.turnTimeLimitSeconds)));

    set({
      gameState: ns,
      optimisticState: ns,
      turnSnapshot: newSnapshot,
      selectedHandIds: [],
      selectedBoardIds: [],
      hintedTileIds: [],
      invalidSetIds: [],
      timer: newTimer,
    });

    broadcastIfHost(ns, get()._hostRoom);

    if (ns.phase !== 'GAME_OVER' && ns.players[ns.currentPlayerIndex]?.isBot) {
      setTimeout(() => get().botMove([]), 500);
    }
  },

  drawTileAction: () => {
    const { gameState, p2pMode } = get();
    if (!gameState) return;

    // Guest 模式：发送摸牌请求给 Host
    if (p2pMode?.type === 'guest') {
      get().sendP2PDrawTile();
      useToastStore.getState().toast({
        type: 'info',
        message: '摸牌请求已发送，等待主机确认...',
        duration: 2000,
      });
      set({ isWaitingForHost: true });
      return;
    }

    // 使用 gameState（最后提交的状态）而非 optimisticState，
    // 这样摸牌时玩家未提交的桌面操作会被丢弃（摸牌 = 放弃出牌）。
    const cp = gameState.players[gameState.currentPlayerIndex];
    const result = drawTile(gameState, cp.id);
    if (isE(result)) return;

    if (!result.drawnTile) {
      // pool empty → auto pass
      const pr = passTurn(result.state, cp.id);
      if (isE(pr)) return;
      const ns = pr.state;
      const newSnapshot = createSnapshot(ns);
      set({
        gameState: ns,
        optimisticState: ns,
        turnSnapshot: newSnapshot,
        selectedHandIds: [],
        selectedBoardIds: [],
        hintedTileIds: [],
        timer: startTimerFn(resetTimer(createTimer(ns.config.turnTimeLimitSeconds))),
      });
      broadcastIfHost(ns, get()._hostRoom);

      if (ns.phase !== 'GAME_OVER' && ns.players[ns.currentPlayerIndex]?.isBot) {
        setTimeout(() => get().botMove([]), 500);
      }
      return;
    }

    // 摸牌后自动跳过（摸牌总是结束回合）
    const pr = passTurn(result.state, cp.id);
    if (isE(pr)) return;
    const ns = pr.state;
    const newSnapshot = createSnapshot(ns);
    set({
      gameState: ns,
      optimisticState: ns,
      turnSnapshot: newSnapshot,
      selectedHandIds: [],
      selectedBoardIds: [],
      hintedTileIds: [],
      timer: startTimerFn(resetTimer(createTimer(ns.config.turnTimeLimitSeconds))),
    });

    broadcastIfHost(ns, get()._hostRoom);

    if (ns.phase !== 'GAME_OVER' && ns.players[ns.currentPlayerIndex]?.isBot) {
      setTimeout(() => get().botMove([]), 500);
    }
  },

  passTurnAction: () => {
    const { gameState, p2pMode } = get();
    if (!gameState) return;

    // Guest 模式：发送跳过请求给 Host
    if (p2pMode?.type === 'guest') {
      get().sendP2PPassTurn();
      useToastStore.getState().toast({
        type: 'info',
        message: '跳过请求已发送，等待主机确认...',
        duration: 2000,
      });
      set({ isWaitingForHost: true });
      return;
    }

    const cp = gameState.players[gameState.currentPlayerIndex];
    const pr = passTurn(gameState, cp.id);
    if (isE(pr)) return;

    const ns = pr.state;
    const newSnapshot = createSnapshot(ns);
    set({
      gameState: ns,
      optimisticState: ns,
      turnSnapshot: newSnapshot,
      selectedHandIds: [],
      selectedBoardIds: [],
      hintedTileIds: [],
      timer: startTimerFn(resetTimer(createTimer(ns.config.turnTimeLimitSeconds))),
    });

    broadcastIfHost(ns, get()._hostRoom);

    if (ns.phase !== 'GAME_OVER' && ns.players[ns.currentPlayerIndex]?.isBot) {
      setTimeout(() => get().botMove([]), 500);
    }
  },

  resetAttempt: () => {
    const { turnSnapshot } = get();
    if (!turnSnapshot) return;

    const restored = restoreSnapshot(turnSnapshot);
    const newSnapshot = createSnapshot(restored);
    set({
      optimisticState: restored,
      turnSnapshot: newSnapshot,
      selectedHandIds: [],
      selectedBoardIds: [],
      hintedTileIds: [],
      invalidSetIds: [],
    });
  },

  requestHint: () => {
    const { gameState, isComputingHint } = get();
    if (!gameState || isComputingHint) return;

    const humanIdx = gameState.players.findIndex(p => !p.isBot);
    if (humanIdx < 0) return;

    set({ isComputingHint: true });

    // 在微任务中计算（避免阻塞 UI）
    setTimeout(() => {
      const s = get().gameState;
      if (!s) { set({ isComputingHint: false }); return; }
      const idx = s.players.findIndex(p => !p.isBot);
      if (idx < 0) { set({ isComputingHint: false }); return; }

      const options = generateMoveOptions(s, idx);
      if (options.length > 0) {
        // 取最优走法（按分数排序）
        const best = options.reduce((a, b) => a.score > b.score ? a : b, options[0]);
        const hintedIds = best.tilesPlayed.map(t => t.instanceId);
        set({ hintedTileIds: hintedIds });
      }

      set({ isComputingHint: false });
    }, 100);
  },

  botMove: (_moves) => {
    const state = get().gameState;
    if (!state) return;
    const playerIndex = state.currentPlayerIndex;
    const cp = state.players[playerIndex];
    if (!cp?.isBot) return;

    set({ isBotThinking: true });

    // 在下一个微任务中执行（给 UI 时间渲染 "thinking" 状态）
    setTimeout(() => {
      const s = get().gameState;
      if (!s) { set({ isBotThinking: false }); return; }
      const idx = s.currentPlayerIndex;
      const player = s.players[idx];
      if (!player?.isBot) { set({ isBotThinking: false }); return; }

      // 根据难度选择 bot
      const difficulty = s.config.aiDifficulty;
      let decision: BotDecision;
      switch (difficulty) {
        case 'hard':
          decision = hardBotDecide(s, idx);
          break;
        case 'medium':
          decision = mediumBotDecide(s, idx);
          break;
        default:
          decision = easyBotDecide(s, idx);
      }

      // 如果有走法，尝试执行
      if (decision.moves.length > 0) {
        const batch: MoveBatch = {
          moveId: generateInstanceId(),
          playerId: player.id,
          moves: decision.moves,
        };

        const result = applyMove(s, batch);
        if (!isE(result)) {
          const ns = result.state;
          const newSnapshot = createSnapshot(ns);
          set({
            gameState: ns,
            optimisticState: ns,
            turnSnapshot: newSnapshot,
            isBotThinking: false,
            timer: startTimerFn(resetTimer(createTimer(ns.config.turnTimeLimitSeconds))),
          });

          broadcastIfHost(ns, get()._hostRoom);

          if (ns.phase !== 'GAME_OVER' && ns.players[ns.currentPlayerIndex]?.isBot) {
            setTimeout(() => get().botMove([]), 800);
          }
          return;
        }

        // Bot 走法不合法（不应该发生），fallthrough 到摸牌跳过
        console.warn('Bot generated invalid move, falling back to draw+pass');
      }

      // 无走法或走法失败 → 摸牌 + 跳过
      const dr = drawTile(s, player.id);
      const target = isE(dr) ? s : dr.state;
      const pr = passTurn(target, player.id);
      if (isE(pr)) { set({ isBotThinking: false }); return; }

      const ns = pr.state;
      const newSnapshot = createSnapshot(ns);
      set({
        gameState: ns,
        optimisticState: ns,
        turnSnapshot: newSnapshot,
        isBotThinking: false,
        timer: startTimerFn(resetTimer(createTimer(ns.config.turnTimeLimitSeconds))),
      });

      broadcastIfHost(ns, get()._hostRoom);

      if (ns.phase !== 'GAME_OVER' && ns.players[ns.currentPlayerIndex]?.isBot) {
        setTimeout(() => get().botMove([]), 800);
      }
    }, 800);
  },

  tickTimerAction: (delta = 1) => {
    const { timer, optimisticState } = get();
    if (timer.isUnlimited || timer.state !== 'RUNNING') return;

    const newTimer = tickTimer(timer, delta);
    set({ timer: newTimer });

    if (isExpired(newTimer) && optimisticState) {
      const result = handleTimeout(optimisticState);
      const ns = result.state;
      const newSnapshot = createSnapshot(ns);
      set({
        gameState: ns,
        optimisticState: ns,
        turnSnapshot: newSnapshot,
        selectedHandIds: [],
        selectedBoardIds: [],
        hintedTileIds: [],
        timer: startTimerFn(resetTimer(createTimer(ns.config.turnTimeLimitSeconds))),
      });

      // Host 超时也需要广播给 Guest
      broadcastIfHost(ns, get()._hostRoom);

      if (ns.phase !== 'GAME_OVER' && ns.players[ns.currentPlayerIndex]?.isBot) {
        setTimeout(() => get().botMove([]), 500);
      }
    }
  },

  startTimerAction: () => set(s => ({ timer: startTimerFn(s.timer) })),

  sortHand: () => set(s => {
    const os = s.optimisticState;
    if (!os) return {};
    const idx = os.currentPlayerIndex;
    const p = os.players[idx];
    const newPlayers = [...os.players];
    newPlayers[idx] = { ...p, handTiles: sortTiles([...p.handTiles]) };
    return { optimisticState: { ...os, players: newPlayers } };
  }),

  currentPlayer: () => {
    const os = get().optimisticState;
    if (!os) return null;
    return os.players[os.currentPlayerIndex] ?? null;
  },

  currentHand: () => {
    const os = get().optimisticState;
    if (!os) return [];
    return os.players[os.currentPlayerIndex]?.handTiles ?? [];
  },

  canCommit: () => {
    const { optimisticState, isWaitingForHost, p2pMode } = get();
    if (!optimisticState || isWaitingForHost) return false;
    // P2P Host: 只有轮到主机自己时才能出牌
    if (p2pMode?.type === 'host') {
      const hostIdx = optimisticState.players.findIndex(player => player.id === 'host-player');
      if (hostIdx >= 0 && optimisticState.currentPlayerIndex !== hostIdx) return false;
    }
    const p = optimisticState.players[optimisticState.currentPlayerIndex];
    if (!p || p.isBot) return false;
    return optimisticState.turnPhase === 'ARRANGING';
  },

  canDraw: () => {
    const { optimisticState, isWaitingForHost, p2pMode } = get();
    if (!optimisticState || isWaitingForHost) return false;
    // P2P Host: 只有轮到主机自己时才能摸牌
    if (p2pMode?.type === 'host') {
      const hostIdx = optimisticState.players.findIndex(player => player.id === 'host-player');
      if (hostIdx >= 0 && optimisticState.currentPlayerIndex !== hostIdx) return false;
    }
    const p = optimisticState.players[optimisticState.currentPlayerIndex];
    if (!p || p.isBot) return false;
    return optimisticState.turnPhase === 'ARRANGING' || optimisticState.turnPhase === 'DRAW_REQUIRED';
  },

  // ---- P2P 操作 ----

  setP2PMode: (mode) => set({ p2pMode: mode }),

  setHostRoom: (room) => set({ _hostRoom: room }),

  setClientRoom: (room) => set({ _clientRoom: room }),

  startP2PHostGame: () => {
    const { pendingConfig, _hostRoom } = get();
    const hostRoom = _hostRoom;
    if (!hostRoom) return;

    const config = createDefaultConfig({
      maxPlayers: pendingConfig.playerCount as 2 | 3 | 4,
      turnTimeLimitSeconds: pendingConfig.timeLimit,
      aiPlayers: pendingConfig.aiCount,
      aiDifficulty: pendingConfig.aiDifficulty,
    });

    const roomPlayers = hostRoom.getPlayers() as any[];
    const players: PlayerState[] = [];

    // 为房间中的每个玩家创建 PlayerState
    for (const info of roomPlayers) {
      const isBot = false;
      players.push(createPlayerState(info.id, info.name, isBot));
    }

    // 补充 AI 玩家
    for (let i = 0; i < pendingConfig.aiCount; i++) {
      const diffLabel = { easy: '简单', medium: '中等', hard: '困难' }[pendingConfig.aiDifficulty];
      players.push(createPlayerState(`ai-p2p-${i}`, `AI-${diffLabel} #${i + 1}`, true));
    }

    const result = startGame(createGameState('p2p-game', players, config));
    const state = result.state;
    const snapshot = createSnapshot(state);
    const timer = createTimer(pendingConfig.timeLimit);

    set({
      gameState: state,
      optimisticState: state,
      turnSnapshot: snapshot,
      timer: startTimerFn(timer),
      selectedHandIds: [],
      selectedBoardIds: [],
      hintedTileIds: [],
      aiHintEnabled: false,
      isBotThinking: false,
      p2pMode: { type: 'host', hostRoom },
    });

    // 广播游戏状态给所有客户端
    hostRoom.broadcastGameState(state);

    // 如果当前是 AI 回合，触发 bot
    if (state.players[state.currentPlayerIndex]?.isBot) {
      setTimeout(() => get().botMove([]), 500);
    }
  },

  setP2PGuestState: (gameState, myIndex) => {
    // 在客户端隐藏其他玩家的手牌
    const maskedPlayers = gameState.players.map((p, i) => {
      if (i === myIndex) return p; // 自己的手牌可见
      return { ...p, handTiles: [] }; // 对手手牌隐藏
    });
    const maskedState: GameState = { ...gameState, players: maskedPlayers };

    const snapshot = createSnapshot(maskedState);
    // 根据主机配置初始化计时器（修复 Guest 始终显示 120s 的问题）
    const timer = createTimer(gameState.config.turnTimeLimitSeconds);
    set({
      gameState: maskedState,
      optimisticState: maskedState,
      turnSnapshot: snapshot,
      timer: startTimerFn(timer),
      selectedHandIds: [],
      selectedBoardIds: [],
      hintedTileIds: [],
      isWaitingForHost: false, // 收到权威状态，清除等待标志
    });
  },

  receiveP2PHand: (tiles) => {
    const os = get().optimisticState;
    if (!os) return;
    const myIdx = os.players.findIndex(p => !p.isBot);
    if (myIdx < 0) return;
    const newPlayers = [...os.players];
    newPlayers[myIdx] = { ...newPlayers[myIdx], handTiles: tiles, handTileCount: tiles.length };
    const newState: GameState = { ...os, players: newPlayers };
    set({ gameState: newState, optimisticState: newState });
  },

  receiveP2PStateUpdate: (diff) => {
    const os = get().optimisticState;
    if (!os) return;

    const newState: GameState = {
      ...os,
      currentPlayerIndex: diff.currentPlayerIndex,
      turnPhase: diff.turnPhase,
      poolTileCount: diff.poolTileCount,
      lastMove: diff.lastMove ?? os.lastMove,
    };

    // 应用棋盘差异
    if (diff.modifiedSets.length > 0 || diff.removedSetIds.length > 0 || diff.newSets.length > 0) {
      let boardSets = [...newState.boardSets];

      // 移除已删除的组合
      if (diff.removedSetIds.length > 0) {
        boardSets = boardSets.filter(s => !diff.removedSetIds.includes(s.id));
      }

      // 更新/替换修改的组合
      if (diff.modifiedSets.length > 0) {
        for (const modSet of diff.modifiedSets) {
          const idx = boardSets.findIndex(s => s.id === modSet.id);
          if (idx >= 0) {
            boardSets[idx] = modSet;
          } else {
            boardSets.push(modSet);
          }
        }
      }

      // 添加新组合
      if (diff.newSets.length > 0) {
        boardSets.push(...diff.newSets);
      }

      newState.boardSets = boardSets;
    }

    if (diff.playerMelded) {
      const player = newState.players.find(p => p.id === diff.playerMelded);
      if (player) player.hasMelded = true;
    }

    if (diff.winner) {
      newState.winner = diff.winner;
    }

    set({ gameState: newState, optimisticState: newState });
  },

  receiveP2PTurnChange: (playerIndex, phase) => {
    const os = get().optimisticState;
    if (!os) return;
    const newState: GameState = {
      ...os,
      currentPlayerIndex: playerIndex,
      turnPhase: phase,
    };
    // 重置计时器（修复 Guest 计时器不随回合重置的问题）
    const newTimer = startTimerFn(resetTimer(createTimer(os.config.turnTimeLimitSeconds)));
    set({ gameState: newState, optimisticState: newState, timer: newTimer });
  },

  receiveP2PGameOver: (winnerId, scores) => {
    const os = get().gameState;
    if (!os) return;
    const newState: GameState = {
      ...os,
      phase: 'GAME_OVER',
      winner: winnerId,
    };
    set({ gameState: newState, optimisticState: newState, finalScores: scores });
  },

  sendP2PMove: (moves) => {
    const { _clientRoom } = get();
    if (_clientRoom) {
      _clientRoom.sendMove(moves);
    }
  },

  sendP2PDrawTile: () => {
    const { _clientRoom } = get();
    if (_clientRoom) {
      _clientRoom.sendDrawTile();
    }
  },

  sendP2PPassTurn: () => {
    const { _clientRoom } = get();
    if (_clientRoom) {
      _clientRoom.sendPassTurn();
    }
  },

  setP2PDisconnected: (v) => set({ p2pDisconnected: v }),

  /** P2P 房间被解散（有玩家离开） */
  p2pRoomClosed: (reason: string) => {
    const { _hostRoom, _clientRoom } = get();
    if (_hostRoom) _hostRoom.closeRoom();
    if (_clientRoom) _clientRoom.disconnect();
    set({
      gameState: null,
      optimisticState: null,
      turnSnapshot: null,
      timer: createTimer(120),
      selectedHandIds: [],
      selectedBoardIds: [],
      hintedTileIds: [],
      isComputingHint: false,
      isBotThinking: false,
      p2pMode: null,
      _hostRoom: null,
      _clientRoom: null,
      p2pDisconnected: false,
      finalScores: null,
    });
  },

  backToLobby: () => {
    const { _hostRoom, _clientRoom } = get();
    if (_hostRoom) _hostRoom.closeRoom();
    if (_clientRoom) _clientRoom.disconnect();
    set({
      gameState: null,
      optimisticState: null,
      turnSnapshot: null,
      timer: createTimer(120),
      selectedHandIds: [],
      selectedBoardIds: [],
      hintedTileIds: [],
      isComputingHint: false,
      isBotThinking: false,
      p2pMode: null,
      _hostRoom: null,
      _clientRoom: null,
      p2pDisconnected: false,
      finalScores: null,
    });
  },
}));
