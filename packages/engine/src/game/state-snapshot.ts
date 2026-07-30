import type { GameState, PlayerState, SetOnBoard, TileInstance, TileOnBoard } from '@rummikub/shared';

// ============================================================
// 游戏状态快照 —— 试错机制的核心
// ============================================================

/**
 * 创建游戏状态的深拷贝快照。
 * 玩家在当前回合内自由尝试操作，如果最终无法形成合法组合，
 * 可通过 restoreSnapshot 恢复到回合开始前的状态。
 */
export function createSnapshot(state: GameState): GameState {
  return {
    id: state.id,
    phase: state.phase,
    turnPhase: state.turnPhase,
    players: state.players.map(clonePlayerState),
    boardSets: state.boardSets.map(cloneSetOnBoard),
    poolTileCount: state.poolTileCount,
    currentPlayerIndex: state.currentPlayerIndex,
    turnNumber: state.turnNumber,
    lastMove: state.lastMove ? { ...state.lastMove } : undefined,
    winner: state.winner,
    config: { ...state.config },
    _deck: (state as any)._deck ? [...(state as any)._deck.map(cloneTileInstance)] : undefined,
  } as any;
}

/**
 * 恢复快照。
 * 返回的快照状态中，turnPhase 重置为 'ARRANGING'，确保玩家可以重新操作。
 */
export function restoreSnapshot(snapshot: GameState): GameState {
  return {
    ...snapshot,
    turnPhase: 'ARRANGING' as const,
    players: snapshot.players.map(p => ({
      ...p,
      handTiles: p.handTiles.map(cloneTileInstance),
      handTileCount: p.handTileCount,
    })),
    boardSets: snapshot.boardSets.map(cloneSetOnBoard),
    _deck: (snapshot as any)._deck ? [...(snapshot as any)._deck.map(cloneTileInstance)] : undefined,
  } as any;
}

// ---- 内部克隆辅助函数 ----

function clonePlayerState(p: PlayerState): PlayerState {
  return {
    id: p.id,
    name: p.name,
    handTileCount: p.handTileCount,
    handTiles: p.handTiles.map(cloneTileInstance),
    score: p.score,
    hasMelded: p.hasMelded,
    isBot: p.isBot,
    isConnected: p.isConnected,
  };
}

function cloneSetOnBoard(s: SetOnBoard): SetOnBoard {
  return {
    id: s.id,
    type: s.type,
    tiles: s.tiles.map(cloneTileOnBoard),
  };
}

function cloneTileInstance(t: TileInstance): TileInstance {
  return {
    id: t.id,
    color: t.color,
    value: t.value,
    instanceId: t.instanceId,
  };
}

function cloneTileOnBoard(t: TileOnBoard): TileOnBoard {
  return {
    id: t.id,
    color: t.color,
    value: t.value,
    instanceId: t.instanceId,
    jokerSubstitution: t.jokerSubstitution ? { ...t.jokerSubstitution } : undefined,
  };
}
