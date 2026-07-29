import type { TurnPhase, GameState } from '@rummikub/shared';
/** 检查回合阶段转换是否合法 */
export declare function canTransition(from: TurnPhase, to: TurnPhase): boolean;
/** 转换回合阶段 */
export declare function transitionTurnPhase(state: GameState, to: TurnPhase): GameState;
/** 检查游戏是否在等待特定玩家操作 */
export declare function isPlayerTurn(state: GameState, playerId: string): boolean;
/** 检查是否可以进行走法提交 */
export declare function canCommitMove(state: GameState): boolean;
/** 检查是否可以摸牌 */
export declare function canDraw(state: GameState): boolean;
//# sourceMappingURL=PhaseManager.d.ts.map