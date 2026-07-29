import type { GameState } from '@rummikub/shared';
import type { AtomicMove, MoveBatch } from './MoveTypes.js';
/** 单次走法验证结果 */
export interface MoveValidationResult {
    valid: boolean;
    reason?: string;
    /** 玩家从手牌打出的分数（用于破冰检查） */
    scoreFromHand?: number;
}
/**
 * 三阶段验证走法批次：
 * 1. 语法验证：每个原子操作引用合法的 ID
 * 2. 应用走法到状态副本
 * 3. 结构验证：最终桌面状态所有组合合法
 */
export declare function validateMoveBatch(state: GameState, batch: MoveBatch): MoveValidationResult;
/**
 * 判断走法操作是否涉及桌面牌操作。
 * 未破冰的玩家不能操弄桌面牌。
 */
export declare function involvesBoardManipulation(moves: AtomicMove[]): boolean;
//# sourceMappingURL=MoveValidator.d.ts.map