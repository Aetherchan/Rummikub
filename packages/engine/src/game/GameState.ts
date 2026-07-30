import type {
  TileInstance, PlayerId, GameId, SetOnBoard,
  PlayerState, GameState, GameConfig, TurnPhase, MoveSummary, TileOnBoard,
} from '@rummikub/shared';
import type { GamePhase } from '@rummikub/shared';
import type { GameEvent } from '../types.js';
import { GameError } from '../types.js';
import { INITIAL_HAND_SIZE, INITIAL_MELD_MINIMUM } from '@rummikub/shared';
import { createDeck, shuffleDeck, drawTiles, drawOneTile } from '../tile/TileDeck.js';
import { sortTiles } from '../tile/Tile.js';
import { validateMoveBatch } from '../manipulation/MoveValidator.js';
import { executeMoveBatch } from '../manipulation/MoveExecutor.js';
import type { MoveBatch } from '../manipulation/MoveTypes.js';
import { validateBoard } from '../validation/BoardValidator.js';
import { handTotalScore } from './ScoreKeeper.js';

// ============================================================
// 游戏状态机
// ============================================================

// 类型从 @rummikub/shared 导出，使用时直接从 shared 导入

/** 创建默认游戏配置 */
export function createDefaultConfig(overrides?: Partial<GameConfig>): GameConfig {
  return {
    maxPlayers: 4,
    initialMeldMinimum: INITIAL_MELD_MINIMUM,
    turnTimeLimitSeconds: 120,  // 0 = 无限制
    aiPlayers: 0,
    aiDifficulty: 'easy',
    ...overrides,
  };
}

/** 创建玩家初始状态 */
export function createPlayerState(
  id: PlayerId,
  name: string,
  isBot: boolean = false,
): PlayerState {
  return {
    id,
    name,
    handTileCount: 0,
    handTiles: [],
    score: 0,
    hasMelded: false,
    isBot,
    isConnected: true,
  };
}

/** 创建游戏初始状态 */
export function createGameState(
  id: GameId,
  players: PlayerState[],
  config: GameConfig,
): GameState {
  return {
    id,
    phase: 'WAITING_FOR_PLAYERS',
    turnPhase: 'WAITING',
    players,
    boardSets: [],
    poolTileCount: 0,
    currentPlayerIndex: 0,
    turnNumber: 0,
    config,
    consecutivePasses: 0,
  } as any;
}

/**
 * 开始游戏：洗牌、发牌、进入第一回合。
 */
export function startGame(
  state: GameState,
): { state: GameState; events: GameEvent[] } {
  if (state.phase !== 'WAITING_FOR_PLAYERS') {
    throw new GameError('游戏已在进行中', 'GAME_ALREADY_STARTED');
  }

  if (state.players.length < 2) {
    throw new GameError('至少需要 2 名玩家', 'NOT_ENOUGH_PLAYERS');
  }

  const events: GameEvent[] = [];

  // 创建并洗牌
  let deck = createDeck();
  deck = shuffleDeck(deck);

  // 发牌：每人 14 张
  const playersWithHands: PlayerState[] = [];
  let remainingDeck = [...deck];

  for (const player of state.players) {
    const { drawn, remaining } = drawTiles(remainingDeck, INITIAL_HAND_SIZE);
    playersWithHands.push({
      ...player,
      handTiles: sortTiles(drawn),
      handTileCount: drawn.length,
    });
    remainingDeck = remaining;
  }

  const newState: GameState = {
    ...state,
    phase: 'IN_PROGRESS',
    turnPhase: 'ARRANGING',
    players: playersWithHands,
    poolTileCount: remainingDeck.length,
    currentPlayerIndex: 0,
    turnNumber: 1,
    _deck: remainingDeck,
    consecutivePasses: 0,
  } as any;

  events.push({ type: 'GAME_STARTED', gameId: state.id });
  events.push({ type: 'TURN_STARTED', playerId: state.players[0].id, turnNumber: 1 });

  return { state: newState, events };
}

/**
 * 处理玩家确认出牌。
 * 验证通过后执行走法，检查胜负或推进回合。
 */
export function applyMove(
  state: GameState,
  batch: MoveBatch,
): { state: GameState; events: GameEvent[] } | GameError {
  if (state.phase !== 'IN_PROGRESS') {
    return new GameError('游戏未在进行中', 'GAME_NOT_IN_PROGRESS');
  }

  const currentPlayer = state.players[state.currentPlayerIndex];
  if (batch.playerId !== currentPlayer.id) {
    return new GameError('不是你的回合', 'NOT_YOUR_TURN');
  }

  // 验证走法
  const validation = validateMoveBatch(state, batch);
  if (!validation.valid) {
    return new GameError(validation.reason ?? '无效走法', 'INVALID_MOVE');
  }

  const events: GameEvent[] = [];

  // 应用走法
  let newState = executeMoveBatch(state, batch.moves);

  // 重置连续跳过计数（有人出牌了）
  newState = setConsecutivePasses(newState, 0);

  // 检查是否破冰
  const updatedPlayer = newState.players[state.currentPlayerIndex];
  if (!updatedPlayer.hasMelded && (validation.scoreFromHand ?? 0) >= state.config.initialMeldMinimum) {
    newState = {
      ...newState,
      players: newState.players.map((p: PlayerState, i: number) =>
        i === state.currentPlayerIndex ? { ...p, hasMelded: true } : p
      ),
    } as any;
    events.push({ type: 'PLAYER_MELDED', playerId: updatedPlayer.id });
  }

  // 记录走法
  const tilesPlayed = batch.moves.reduce((count: number, m: any) => {
    if (m.type === 'ADD_TILES_TO_SET' || m.type === 'CREATE_SET') {
      return count + m.tiles.length;
    }
    return count;
  }, 0);

  events.push({
    type: 'TILES_PLAYED',
    playerId: updatedPlayer.id,
    tileCount: tilesPlayed,
    score: validation.scoreFromHand ?? 0,
  });

  // 检查是否清空手牌（胜利）
  if (updatedPlayer.handTiles.length === 0) {
    return endGame(newState, updatedPlayer.id, events);
  }

  // 推进到下一位玩家
  return advanceTurn(newState, events);
}

/**
 * 试错失败后的处理：
 * - 无时间限制 → 恢复快照，无惩罚
 * - 有时间限制 → 恢复快照 + 罚摸 3 张牌
 */
export function handleInvalidAttempt(
  snapshot: GameState,
  hasTimeLimit: boolean,
): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];

  if (!hasTimeLimit) {
    // 无惩罚恢复
    return { state: snapshot, events };
  }

  // 有时限 → 恢复 + 罚摸 3 张
  let state = snapshot;
  const deck: TileInstance[] = getDeck(state);
  const { drawn, remaining } = drawTiles(deck, 3);

  if (drawn.length > 0) {
    state = {
      ...state,
      players: state.players.map((p: PlayerState, i: number) =>
        i === state.currentPlayerIndex
          ? { ...p, handTiles: sortTiles([...p.handTiles, ...drawn]), handTileCount: p.handTileCount + drawn.length }
          : p
      ),
      poolTileCount: remaining.length,
      _deck: remaining,
    } as any;

    events.push({
      type: 'TILE_DRAWN' as any,
      playerId: state.players[state.currentPlayerIndex].id,
    });
  }

  // 罚摸后推进回合
  return advanceTurn(state, events);
}

/**
 * 玩家摸牌（主动摸牌，回合中）。
 * 牌池为空时返回 null，不抛异常（配合牌池耗尽机制）。
 */
export function drawTile(
  state: GameState,
  playerId: PlayerId,
): { state: GameState; events: GameEvent[]; drawnTile: TileInstance | null } | GameError {
  if (state.phase !== 'IN_PROGRESS') {
    return new GameError('游戏未在进行中', 'GAME_NOT_IN_PROGRESS');
  }

  const currentPlayer = state.players[state.currentPlayerIndex];
  if (playerId !== currentPlayer.id) {
    return new GameError('不是你的回合', 'NOT_YOUR_TURN');
  }

  const deck: TileInstance[] = getDeck(state);
  const { tile, remaining } = drawOneTile(deck);

  if (!tile) {
    // 牌池已空，返回 null（由调用方处理牌池耗尽逻辑）
    return { state, events: [], drawnTile: null };
  }

  const events: GameEvent[] = [{ type: 'TILE_DRAWN', playerId }];

  const newState: GameState = {
    ...state,
    players: state.players.map((p: PlayerState, i: number) =>
      i === state.currentPlayerIndex
        ? { ...p, handTiles: sortTiles([...p.handTiles, tile]), handTileCount: p.handTileCount + 1 }
        : p
    ),
    poolTileCount: remaining.length,
    turnPhase: 'WAITING',
    _deck: remaining,
  } as any;

  return { state: newState, events, drawnTile: tile };
}

/**
 * 玩家跳过（摸牌后或无法出牌时结束回合）。
 * 牌池为空时检查是否所有玩家都无法出牌 → 终局。
 */
export function passTurn(
  state: GameState,
  playerId: PlayerId,
): { state: GameState; events: GameEvent[] } | GameError {
  if (state.phase !== 'IN_PROGRESS') {
    return new GameError('游戏未在进行中', 'GAME_NOT_IN_PROGRESS');
  }

  const currentPlayer = state.players[state.currentPlayerIndex];
  if (playerId !== currentPlayer.id) {
    return new GameError('不是你的回合', 'NOT_YOUR_TURN');
  }

  const events: GameEvent[] = [{ type: 'TURN_PASSED', playerId }];

  // 递增连续跳过计数
  const newConsecutivePasses = (getConsecutivePasses(state) + 1);
  let newState = setConsecutivePasses(state, newConsecutivePasses);

  // 牌池为空 + 所有玩家连续一轮跳过 → 终局
  const poolEmpty = getDeck(state).length === 0;
  if (poolEmpty && newConsecutivePasses >= state.players.length) {
    return endGameByPoolExhaustion(newState, events);
  }

  return advanceTurn(newState, events);
}

/**
 * 超时处理：自动摸牌 + 推进回合。
 * 返回是否有牌可摸（牌池为空时返回 null）。
 */
export function handleTimeout(
  state: GameState,
): { state: GameState; events: GameEvent[]; timedOut: boolean } {
  const events: GameEvent[] = [];
  const playerId = state.players[state.currentPlayerIndex].id;

  // 尝试自动摸一张牌
  const deck: TileInstance[] = getDeck(state);
  const { tile, remaining } = drawOneTile(deck);

  let newState = {
    ...state,
    _deck: remaining,
    poolTileCount: remaining.length,
  } as any;

  if (tile) {
    newState = {
      ...newState,
      players: newState.players.map((p: PlayerState, i: number) =>
        i === state.currentPlayerIndex
          ? { ...p, handTiles: sortTiles([...p.handTiles, tile]), handTileCount: p.handTileCount + 1 }
          : p
      ),
    };
    events.push({ type: 'TILE_DRAWN', playerId });
  }

  return { ...advanceTurn(newState, events), timedOut: true };
}

// ---- 内部辅助函数 ----

function advanceTurn(
  state: GameState,
  events: GameEvent[],
): { state: GameState; events: GameEvent[] } {
  const nextPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
  const newState: GameState = {
    ...state,
    currentPlayerIndex: nextPlayerIndex,
    turnNumber: nextPlayerIndex === 0 ? state.turnNumber + 1 : state.turnNumber,
    turnPhase: 'ARRANGING',
    lastMove: state.lastMove,
  } as any;

  events.push({
    type: 'TURN_STARTED',
    playerId: state.players[nextPlayerIndex].id,
    turnNumber: newState.turnNumber,
  });

  return { state: newState, events };
}

function endGame(
  state: GameState,
  winnerId: PlayerId,
  events: GameEvent[],
): { state: GameState; events: GameEvent[] } {
  events.push({ type: 'GAME_OVER', winnerId });

  const finalState: GameState = {
    ...state,
    phase: 'GAME_OVER',
    winner: winnerId,
  } as any;

  return { state: finalState, events };
}

/**
 * 牌池耗尽终局：比较每人剩余手牌失分，失分最少者获胜。
 */
function endGameByPoolExhaustion(
  state: GameState,
  events: GameEvent[],
): { state: GameState; events: GameEvent[] } {
  // 找出失分最少的人（即手牌总分最小）
  let minScore = Infinity;
  let winnerId: PlayerId = state.players[0].id;

  for (const player of state.players) {
    const handScore = handTotalScore(player);
    if (handScore < minScore) {
      minScore = handScore;
      winnerId = player.id;
    }
  }

  events.push({ type: 'GAME_OVER', winnerId });

  const finalState: GameState = {
    ...state,
    phase: 'GAME_OVER',
    winner: winnerId,
  } as any;

  return { state: finalState, events };
}

// ---- 牌池/内部状态访问 ----

/** 获取牌池数组 */
export function getDeck(state: GameState): TileInstance[] {
  return (state as any)._deck ?? [];
}

/** 设置牌池数组 */
export function setDeck(state: GameState, deck: TileInstance[]): GameState {
  return { ...state, _deck: deck, poolTileCount: deck.length } as any;
}

/** 获取连续跳过计数 */
export function getConsecutivePasses(state: GameState): number {
  return (state as any).consecutivePasses ?? 0;
}

/** 设置连续跳过计数 */
function setConsecutivePasses(state: GameState, count: number): GameState {
  return { ...state, consecutivePasses: count } as any;
}
