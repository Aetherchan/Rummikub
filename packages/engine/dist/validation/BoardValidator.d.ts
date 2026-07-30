import type { TileOnBoard, TileInstance } from '@rummikub/shared';
import type { SetOnBoard } from '@rummikub/shared';
/** 桌面验证结果 */
export interface BoardValidationResult {
    valid: boolean;
    errors: string[];
}
/** 单个牌组的提交前验证结果（与 SetValidator.SetValidationResult 区分） */
export interface PerSetCommitResult {
    setId: string;
    tiles: TileOnBoard[];
    valid: boolean;
    reason?: string;
    type?: 'group' | 'run';
    score: number;
}
/** 提交前完整验证结果 */
export interface BoardCommitValidationResult {
    valid: boolean;
    errors: string[];
    setResults: PerSetCommitResult[];
    scoreFromHand: number;
    meldMet: boolean;
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
/**
 * 提交前验证：逐组检查桌面牌组 + 破冰条件检查。
 * 用于 UI 层在提交前验证，返回每组的详细结果用于高亮错误牌组。
 */
export declare function validateBoardForCommit(sets: SetOnBoard[], snapshotBoard: SetOnBoard[], hasMelded: boolean, initialMeldMinimum: number): BoardCommitValidationResult;
//# sourceMappingURL=BoardValidator.d.ts.map