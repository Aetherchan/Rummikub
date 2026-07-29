import type { TileInstance } from '@rummikub/shared';
import type { SetOnBoard } from '@rummikub/shared';
/** 桌面验证结果 */
export interface BoardValidationResult {
    valid: boolean;
    errors: string[];
}
/**
 * 验证整个桌面状态。
 * 检查：
 * 1. 每个组合内部是否合法
 * 2. 没有重复的牌实例（同一张 instanceId 不能出现两次）
 * 3. 没有桌面上不该存在的牌
 */
export declare function validateBoard(sets: SetOnBoard[]): BoardValidationResult;
/**
 * 在应用变更后验证桌面状态。
 * 用于 MoveValidator：假设应用了移动，然后验证桌面是否仍然全合法。
 */
export declare function validateBoardAfterMoves(sets: SetOnBoard[], movedTiles: TileInstance[]): {
    valid: boolean;
    errors: string[];
};
//# sourceMappingURL=BoardValidator.d.ts.map