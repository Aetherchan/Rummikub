import type { TileInstance } from '@rummikub/shared';
/**
 * 验证首次出牌是否满足最低分数要求。
 * 玩家第一次出牌必须从自己手中打出 ≥30 分的牌（不能使用桌面上已有的牌）。
 */
export declare function validateInitialMeld(tilesPlayedFromHand: TileInstance[], minimum?: number): {
    valid: boolean;
    score: number;
    reason?: string;
};
/**
 * 判断玩家是否可以操作桌面上的牌。
 * 只有已完成破冰的玩家才能操作桌面牌。
 */
export declare function canManipulateBoard(hasMelded: boolean): boolean;
//# sourceMappingURL=MeldValidator.d.ts.map