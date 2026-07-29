import { INITIAL_MELD_MINIMUM } from '@rummikub/shared';
import { computeScore } from './SetValidator.js';
// ============================================================
// 破冰（首次出牌）验证器
// ============================================================
/**
 * 验证首次出牌是否满足最低分数要求。
 * 玩家第一次出牌必须从自己手中打出 ≥30 分的牌（不能使用桌面上已有的牌）。
 */
export function validateInitialMeld(tilesPlayedFromHand, minimum = INITIAL_MELD_MINIMUM) {
    const score = computeScore(tilesPlayedFromHand);
    if (tilesPlayedFromHand.length === 0) {
        return { valid: false, score: 0, reason: '未打出任何牌' };
    }
    if (score < minimum) {
        return {
            valid: false,
            score,
            reason: `首次出牌需要至少 ${minimum} 分，当前打出 ${score} 分`,
        };
    }
    return { valid: true, score };
}
/**
 * 判断玩家是否可以操作桌面上的牌。
 * 只有已完成破冰的玩家才能操作桌面牌。
 */
export function canManipulateBoard(hasMelded) {
    return hasMelded;
}
//# sourceMappingURL=MeldValidator.js.map