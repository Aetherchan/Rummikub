import type { TileInstance, TileOnBoard, PlayerId, GameId, SetId } from './tile-types.js';

// ============================================================
// 游戏状态类型 —— 引擎与客户端/服务器共享
// ============================================================

/** 游戏阶段 */
export type GamePhase =
  | 'WAITING_FOR_PLAYERS'
  | 'IN_PROGRESS'
  | 'ROUND_OVER'
  | 'GAME_OVER';

/** 回合阶段 */
export type TurnPhase =
  | 'ARRANGING'        // 当前玩家在整理出牌
  | 'COMMITTING'       // 玩家提交出牌，等待服务器验证
  | 'DRAW_REQUIRED'    // 玩家必须摸牌
  | 'WAITING';         // 等待他人操作

/** 桌面上的组合 */
export interface SetOnBoard {
  id: SetId;
  tiles: TileOnBoard[];
  type: 'group' | 'run';
}

/** 玩家状态 */
export interface PlayerState {
  id: PlayerId;
  name: string;
  handTileCount: number;         // 客户端不显示对手的具体牌
  handTiles: TileInstance[];     // 仅当前玩家可看到内容
  score: number;
  hasMelded: boolean;            // 是否已完成首次出牌（≥30 分）
  isBot: boolean;
  isConnected: boolean;
}

/** 走法摘要 */
export interface MoveSummary {
  playerId: PlayerId;
  tilesPlayed: number;
  scoreContributed: number;
}

/** 完整游戏状态 */
export interface GameState {
  id: GameId;
  phase: GamePhase;
  turnPhase: TurnPhase;
  players: PlayerState[];
  boardSets: SetOnBoard[];
  poolTileCount: number;
  currentPlayerIndex: number;
  turnNumber: number;
  lastMove?: MoveSummary;
  winner?: PlayerId;
  config: GameConfig;
}

/** 游戏配置 */
export interface GameConfig {
  maxPlayers: 2 | 3 | 4;
  initialMeldMinimum: number;
  turnTimeLimitSeconds: number;
  aiPlayers: number;
  aiDifficulty: 'easy' | 'medium' | 'hard';
}
