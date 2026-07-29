import type { TileInstance, TileOnBoard, TileColor, TileValue, JokerSubstitution } from '@rummikub/shared';
/** 判断是否为 joker */
export declare function isJoker(tile: TileInstance | TileOnBoard): boolean;
/** 获取 joker 在桌面上的实际表现颜色 */
export declare function effectiveColor(tile: TileOnBoard): TileColor | null;
/** 获取 joker 在桌面上的实际表现数值 */
export declare function effectiveValue(tile: TileOnBoard): TileValue | null;
/** 为 joker 创建替代信息 */
export declare function createSubstitution(tile: TileInstance, value: TileValue, color: TileColor): JokerSubstitution | null;
/** 将桌面上带替代的 joker 转为普通牌 */
export declare function toTileOnBoard(tile: TileInstance, substitution?: JokerSubstitution): TileOnBoard;
/**
 * 判断能否用某张牌替换 joker。
 * 只有当玩家手中有与 joker 替代值完全相同的牌时才能替换。
 */
export declare function canReplaceJoker(jokerTile: TileOnBoard, candidateTile: TileInstance): boolean;
/**
 * 从一组桌面牌中"释放"joker。
 * 返回更新后的牌组和取出的 joker。
 */
export declare function freeJokerFromSet(setTiles: TileOnBoard[], jokerIndex: number, replacementTile: TileInstance): {
    updatedSet: TileOnBoard[];
    freedJoker: TileInstance;
} | null;
//# sourceMappingURL=JokerLogic.d.ts.map