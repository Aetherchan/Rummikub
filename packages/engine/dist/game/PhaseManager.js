import { GameError } from '../types.js';
// ============================================================
// 回合阶段管理器
// ============================================================
/**
 * 阶段转换验证：
 * ARRANGING → COMMITTING (玩家点击出牌)
 * ARRANGING → DRAW_REQUIRED (玩家选择摸牌)
 * COMMITTING → ARRANGING (服务器拒绝走法)
 * COMMITTING → WAITING (走法已接受，等待他人)
 * DRAW_REQUIRED → ARRANGING (摸牌后继续出牌 — 可选规则)
 * DRAW_REQUIRED → WAITING (摸牌后跳过)
 */
const VALID_TRANSITIONS = {
    ARRANGING: ['COMMITTING', 'DRAW_REQUIRED'],
    COMMITTING: ['ARRANGING', 'WAITING'],
    DRAW_REQUIRED: ['ARRANGING', 'WAITING'],
    WAITING: ['ARRANGING'],
};
/** 检查回合阶段转换是否合法 */
export function canTransition(from, to) {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
/** 转换回合阶段 */
export function transitionTurnPhase(state, to) {
    const from = state.turnPhase;
    if (!canTransition(from, to)) {
        throw new GameError(`不能从 ${from} 转换到 ${to}`, 'INVALID_PHASE_TRANSITION');
    }
    return { ...state, turnPhase: to };
}
/** 检查游戏是否在等待特定玩家操作 */
export function isPlayerTurn(state, playerId) {
    const currentPlayer = state.players[state.currentPlayerIndex];
    return currentPlayer?.id === playerId && state.turnPhase === 'ARRANGING';
}
/** 检查是否可以进行走法提交 */
export function canCommitMove(state) {
    return (state.phase === 'IN_PROGRESS' &&
        (state.turnPhase === 'ARRANGING' || state.turnPhase === 'COMMITTING'));
}
/** 检查是否可以摸牌 */
export function canDraw(state) {
    return (state.phase === 'IN_PROGRESS' &&
        state.turnPhase === 'ARRANGING' &&
        state.poolTileCount > 0);
}
//# sourceMappingURL=PhaseManager.js.map