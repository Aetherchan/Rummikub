import type {
  TileInstance, TileOnBoard, PlayerId, GameId, SetId,
  InstanceId, TileColor, TileValue, PlayerInfo, GameState,
} from '@rummikub/shared';

// 重新导出共享类型，方便引擎内部使用
export type {
  TileInstance, TileOnBoard, PlayerId, GameId, SetId,
  InstanceId, TileColor, TileValue, PlayerInfo,
};

// ---- 游戏错误 ----

export class GameError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = 'GameError';
  }
}

// ---- 游戏事件 ----

export type GameEvent =
  | { type: 'GAME_STARTED'; gameId: GameId }
  | { type: 'TURN_STARTED'; playerId: PlayerId; turnNumber: number }
  | { type: 'TILES_PLAYED'; playerId: PlayerId; tileCount: number; score: number }
  | { type: 'PLAYER_MELDED'; playerId: PlayerId }  // 完成首次出牌
  | { type: 'TILE_DRAWN'; playerId: PlayerId }
  | { type: 'TURN_PASSED'; playerId: PlayerId }
  | { type: 'GAME_OVER'; winnerId: PlayerId }
  | { type: 'ROUND_OVER' };

// ---- 游戏结果 ----

export type GameResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; error: GameError };
