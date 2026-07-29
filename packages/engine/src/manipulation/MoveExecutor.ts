import type { TileInstance, SetId, SetOnBoard, PlayerState, TileOnBoard } from '@rummikub/shared';
import type { GameState } from '@rummikub/shared';
import type { AtomicMove } from './MoveTypes.js';
import { GameError } from '../types.js';
import { tileScore, createTileInstance } from '../tile/Tile.js';
import { computeScore, validateSet } from '../validation/SetValidator.js';

// ============================================================
// 走法执行器 —— 将原子操作应用到游戏状态
// ============================================================

/** 执行单个原子操作 */
export function executeAtomicMove(state: GameState, move: AtomicMove): GameState {
  switch (move.type) {
    case 'ADD_TILES_TO_SET':
      return executeAddTiles(state, move.setId, move.tiles);
    case 'REMOVE_TILES_FROM_SET':
      return executeRemoveTiles(state, move.setId, move.instanceIds);
    case 'SPLIT_SET':
      return executeSplitSet(state, move.sourceSetId, move.atIndex, move.newSetId);
    case 'MERGE_SETS':
      return executeMergeSets(state, move.sourceSetId, move.targetSetId, move.position);
    case 'CREATE_SET':
      return executeCreateSet(state, move.setId, move.tiles);
    case 'DISMISS_SET':
      return executeDismissSet(state, move.setId);
    default:
      throw new GameError(`未知的原子操作类型`, 'UNKNOWN_MOVE_TYPE');
  }
}

/** 执行完整的走法批次 */
export function executeMoveBatch(state: GameState, moves: AtomicMove[]): GameState {
  let currentState = state;
  for (const move of moves) {
    currentState = executeAtomicMove(currentState, move);
  }
  return currentState;
}

// ---- 各操作的实现 ----

function executeAddTiles(state: GameState, setId: SetId, tiles: TileInstance[]): GameState {
  const set = state.boardSets.find((s: SetOnBoard) => s.id === setId);
  if (!set) throw new GameError(`组合 ${setId} 不存在`, 'SET_NOT_FOUND');

  const boardTiles: TileOnBoard[] = tiles.map((t: TileInstance): TileOnBoard => {
    if (t.color === null && t.value === null) {
      return { ...t, jokerSubstitution: undefined } as TileOnBoard;
    }
    return { ...t, jokerSubstitution: undefined } as TileOnBoard;
  });

  const updatedSet: SetOnBoard = {
    ...set,
    tiles: [...set.tiles, ...boardTiles],
  };

  // 从手牌移除
  const player: PlayerState = state.players[state.currentPlayerIndex];
  const instanceIdsToRemove = new Set(tiles.map((t: TileInstance) => t.instanceId));
  const remainingHand = player.handTiles.filter((t: TileInstance) => !instanceIdsToRemove.has(t.instanceId));

  return {
    ...state,
    boardSets: state.boardSets.map((s: SetOnBoard) => (s.id === setId ? updatedSet : s)),
    players: state.players.map((p: PlayerState, i: number) =>
      i === state.currentPlayerIndex
        ? { ...p, handTiles: remainingHand, handTileCount: remainingHand.length }
        : p
    ),
  };
}

function executeRemoveTiles(state: GameState, setId: SetId, instanceIds: string[]): GameState {
  const set = state.boardSets.find((s: SetOnBoard) => s.id === setId);
  if (!set) throw new GameError(`组合 ${setId} 不存在`, 'SET_NOT_FOUND');

  const idsToRemove = new Set(instanceIds);
  const removedTiles: TileInstance[] = [];
  const remainingTiles = set.tiles.filter((t: TileOnBoard) => {
    if (idsToRemove.has(t.instanceId)) {
      removedTiles.push(t);
      return false;
    }
    return true;
  });

  if (removedTiles.length !== instanceIds.length) {
    throw new GameError('部分要移除的牌不在组合中', 'TILE_NOT_IN_SET');
  }

  // 将移除的牌退回当前玩家手牌
  const player: PlayerState = state.players[state.currentPlayerIndex];
  const newHand: TileInstance[] = [
    ...player.handTiles,
    ...removedTiles.map((t: TileOnBoard): TileInstance => ({
      id: t.id,
      color: t.color,
      value: t.value,
      instanceId: t.instanceId,
    })),
  ];

  const updatedSets = remainingTiles.length >= 3
    ? state.boardSets.map((s: SetOnBoard) => (s.id === setId ? { ...s, tiles: remainingTiles } : s))
    : state.boardSets.filter((s: SetOnBoard) => s.id !== setId); // 小于 3 张则移除整个组合

  return {
    ...state,
    boardSets: updatedSets,
    players: state.players.map((p: PlayerState, i: number) =>
      i === state.currentPlayerIndex
        ? { ...p, handTiles: newHand, handTileCount: newHand.length }
        : p
    ),
  };
}

function executeSplitSet(state: GameState, sourceSetId: SetId, atIndex: number, newSetId: SetId): GameState {
  const set = state.boardSets.find((s: SetOnBoard) => s.id === sourceSetId);
  if (!set) throw new GameError(`组合 ${sourceSetId} 不存在`, 'SET_NOT_FOUND');
  if (atIndex < 1 || atIndex >= set.tiles.length) {
    throw new GameError(`拆分点 ${atIndex} 不合法（组合有 ${set.tiles.length} 张牌）`, 'INVALID_SPLIT_POINT');
  }

  const firstPart = set.tiles.slice(0, atIndex);
  const secondPart = set.tiles.slice(atIndex);

  const newSets: SetOnBoard[] = [...state.boardSets.filter((s: SetOnBoard) => s.id !== sourceSetId)];

  if (firstPart.length >= 3) {
    newSets.push({ ...set, tiles: firstPart, id: set.id });
  }
  if (secondPart.length >= 3) {
    newSets.push({ id: newSetId, tiles: secondPart, type: set.type });
  }

  return { ...state, boardSets: newSets };
}

function executeMergeSets(
  state: GameState,
  sourceSetId: SetId,
  targetSetId: SetId,
  position: 'start' | 'end',
): GameState {
  const sourceSet = state.boardSets.find((s: SetOnBoard) => s.id === sourceSetId);
  const targetSet = state.boardSets.find((s: SetOnBoard) => s.id === targetSetId);
  if (!sourceSet) throw new GameError(`源组合 ${sourceSetId} 不存在`, 'SET_NOT_FOUND');
  if (!targetSet) throw new GameError(`目标组合 ${targetSetId} 不存在`, 'SET_NOT_FOUND');

  const mergedTiles = position === 'start'
    ? [...sourceSet.tiles, ...targetSet.tiles]
    : [...targetSet.tiles, ...sourceSet.tiles];

  const mergedSet: SetOnBoard = { ...targetSet, tiles: mergedTiles };

  return {
    ...state,
    boardSets: state.boardSets
      .filter((s: SetOnBoard) => s.id !== sourceSetId && s.id !== targetSetId)
      .concat(mergedSet),
  };
}

function executeCreateSet(state: GameState, setId: SetId, tiles: TileInstance[]): GameState {
  // 从手牌移除这些牌
  const player: PlayerState = state.players[state.currentPlayerIndex];
  const instanceIdsToRemove = new Set(tiles.map((t: TileInstance) => t.instanceId));
  const remainingHand = player.handTiles.filter((t: TileInstance) => !instanceIdsToRemove.has(t.instanceId));

  // 推断组合类型
  const setValidation = validateSet(tiles);
  const setType: 'group' | 'run' = setValidation.valid && setValidation.type
    ? setValidation.type
    : 'run';  // 回退默认值

  // 创建新组合
  const boardTiles: TileOnBoard[] = tiles.map((t: TileInstance): TileOnBoard => {
    if (t.color === null && t.value === null) {
      return { ...t, jokerSubstitution: undefined } as TileOnBoard;
    }
    return { ...t, jokerSubstitution: undefined } as TileOnBoard;
  });

  const newSet: SetOnBoard = {
    id: setId,
    tiles: boardTiles,
    type: setType,
  };

  return {
    ...state,
    boardSets: [...state.boardSets, newSet],
    players: state.players.map((p: PlayerState, i: number) =>
      i === state.currentPlayerIndex
        ? { ...p, handTiles: remainingHand, handTileCount: remainingHand.length }
        : p
    ),
  };
}

function executeDismissSet(state: GameState, setId: SetId): GameState {
  const set = state.boardSets.find((s: SetOnBoard) => s.id === setId);
  if (!set) throw new GameError(`组合 ${setId} 不存在`, 'SET_NOT_FOUND');

  // 将牌退回手牌
  const player: PlayerState = state.players[state.currentPlayerIndex];
  const returnedTiles: TileInstance[] = set.tiles.map((t: TileOnBoard): TileInstance => ({
    id: t.id,
    color: t.color,
    value: t.value,
    instanceId: t.instanceId,
  }));

  return {
    ...state,
    boardSets: state.boardSets.filter((s: SetOnBoard) => s.id !== setId),
    players: state.players.map((p: PlayerState, i: number) =>
      i === state.currentPlayerIndex
        ? { ...p, handTiles: [...p.handTiles, ...returnedTiles], handTileCount: p.handTileCount + returnedTiles.length }
        : p
    ),
  };
}
