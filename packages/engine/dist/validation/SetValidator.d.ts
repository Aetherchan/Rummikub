import type { TileInstance, TileOnBoard } from '@rummikub/shared';
/** 验证结果 */
export interface SetValidationResult {
    valid: boolean;
    type?: 'group' | 'run';
    score: number;
    reason?: string;
}
/** 判断一组牌是否构成合法的 Group（同数不同色，3-4 张） */
export declare function isValidGroup(tiles: (TileInstance | TileOnBoard)[]): SetValidationResult;
/** 判断一组牌是否构成合法的 Run（同色连续数，3+ 张） */
export declare function isValidRun(tiles: (TileInstance | TileOnBoard)[]): SetValidationResult;
/** 判断一组牌是否合法（自动检测是 group 还是 run） */
export declare function validateSet(tiles: (TileInstance | TileOnBoard)[]): SetValidationResult;
/** 计算一组牌的分数 */
export declare function computeScore(tiles: (TileInstance | TileOnBoard)[]): number;
//# sourceMappingURL=SetValidator.d.ts.map