// ============================================================
// 牌面基础类型 —— 所有包共享
// ============================================================

/** 牌的颜色（joker 没有颜色） */
export const COLORS = ['red', 'blue', 'yellow', 'black'] as const;
export type TileColor = (typeof COLORS)[number];

/** 牌的数值 1-13（joker 没有数值） */
export type TileValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

/** 牌的定义 ID（如 "red-7"、"joker-1"） */
export type TileId = string;

/** 牌的实例 ID（每张物理牌唯一，UUID） */
export type InstanceId = string;

/** 组合 ID */
export type SetId = string;

/** 玩家 ID */
export type PlayerId = string;

/** 游戏 ID */
export type GameId = string;

// ---- 牌定义 ----

/** 牌的类型定义（逻辑模板） */
export interface TileDefinition {
  id: TileId;
  color: TileColor | null;   // null 表示 joker
  value: TileValue | null;   // null 表示 joker
}

/** 牌的具体实例（一张物理牌） */
export interface TileInstance extends TileDefinition {
  instanceId: InstanceId;
}

/** 百搭牌（joker）的替代信息 */
export interface JokerSubstitution {
  substitutedValue: TileValue;
  substitutedColor: TileColor;
}

/** 桌面上的牌 */
export interface TileOnBoard extends TileInstance {
  /** 仅当此牌是 joker 且在桌面上有替代值时定义 */
  jokerSubstitution?: JokerSubstitution;
}

// ---- 位置 ----

/** 牌的位置 */
export type TileLocation =
  | { type: 'hand'; playerId: PlayerId }
  | { type: 'board'; setId: SetId; index: number }
  | { type: 'pool' };

// PlayerInfo 类型在 protocol.ts 中定义（包含 seat 字段）
