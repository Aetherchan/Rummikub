import { create } from 'zustand';
import type {
  GameState, PlayerState, TileInstance,
  SetOnBoard, TurnPhase, PlayerId,
  GameStateDiff, ScoreEntry, GameConfig,
} from '@rummikub/shared';
import {
  createDefaultConfig, createPlayerState, createGameState,
  startGame, applyMove, drawTile, passTurn, handleTimeout,
  handleInvalidAttempt,
  createSnapshot, restoreSnapshot,
  createTimer, startTimer as startTimerFn, tickTimer, resetTimer,
  isExpired,
  sortTiles, isJoker,
} from '@rummikub/engine';
import type { MoveBatch, AtomicMove } from '@rummikub/engine';
import type { TurnTimer } from '@rummikub/engine';
import { generateInstanceId, GameError } from '@rummikub/engine';
import { easyBotDecide, mediumBotDecide, hardBotDecide, generateMoveOptions } from '../bot';
import type { BotDecision } from '../bot';

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
}

interface GameActions {
  setPendingConfig: (config: Partial<LocalGameState['pendingConfig']>) => void;
  startSinglePlayerGame: () => void;
  toggleHandTile: (instanceId: string) => void;
  toggleBoardTile: (instanceId: string) => void;
  commitMove: (moves: AtomicMove[]) => void;
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
    aiDifficulty: 'easy',
    timeLimit: 120,
    aiHintEnabled: false,
  },
  p2pMode: null,
  _hostRoom: null,
  _clientRoom: null,
  p2pDisconnected: false,
  finalScores: null,

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
  })),

  toggleBoardTile: (instanceId) => set(s => ({
    selectedBoardIds: toggleInArray(s.selectedBoardIds, instanceId),
  })),

  commitMove: (moves) => {
    const { optimisticState } = get();
    if (!optimisticState) return;

    const cp = optimisticState.players[optimisticState.currentPlayerIndex];
    const batch: MoveBatch = {
      moveId: generateInstanceId(),
      playerId: cp.id,
      moves,
    };

    const result = applyMove(optimisticState, batch);
    if (isE(result)) {
      const { turnSnapshot } = get();
      if (!turnSnapshot) return;

      const hasTimeLimit = optimisticState.config.turnTimeLimitSeconds > 0;
      const recovery = handleInvalidAttempt(turnSnapshot, hasTimeLimit);
      const ns = recovery.state;
      const newSnapshot = createSnapshot(ns);

      set({
        gameState: ns,
        optimisticState: ns,
        turnSnapshot: newSnapshot,
        selectedHandIds: [],
        selectedBoardIds: [],
        hintedTileIds: [],
        timer: createTimer(ns.config.turnTimeLimitSeconds),
      });

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
      timer: newTimer,
    });

    broadcastIfHost(ns, get()._hostRoom);

    if (ns.phase !== 'GAME_OVER' && ns.players[ns.currentPlayerIndex]?.isBot) {
      setTimeout(() => get().botMove([]), 500);
    }
  },

  drawTileAction: () => {
    const { optimisticState } = get();
    if (!optimisticState) return;

    const cp = optimisticState.players[optimisticState.currentPlayerIndex];
    const result = drawTile(optimisticState, cp.id);
    if (isE(result)) return;

    if (!result.drawnTile) {
      // pool empty → auto pass
      const pr = passTurn(optimisticState, cp.id);
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
    const { gameState } = get();
    if (!gameState) return;

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
    const os = get().optimisticState;
    if (!os) return false;
    const p = os.players[os.currentPlayerIndex];
    if (!p || p.isBot) return false;
    return os.turnPhase === 'ARRANGING';
  },

  canDraw: () => {
    const os = get().optimisticState;
    if (!os) return false;
    const p = os.players[os.currentPlayerIndex];
    if (!p || p.isBot) return false;
    return os.turnPhase === 'ARRANGING' || os.turnPhase === 'DRAW_REQUIRED';
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
    set({
      gameState: maskedState,
      optimisticState: maskedState,
      turnSnapshot: snapshot,
      selectedHandIds: [],
      selectedBoardIds: [],
      hintedTileIds: [],
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
    set({ gameState: newState, optimisticState: newState });
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
