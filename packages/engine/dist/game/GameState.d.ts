import type { TileInstance, PlayerId, GameId, PlayerState, GameState, GameConfig } from '@rummikub/shared';
import type { GameEvent } from '../types.js';
import { GameError } from '../types.js';
import type { MoveBatch } from '../manipulation/MoveTypes.js';
/** 创建默认游戏配置 */
export declare function createDefaultConfig(overrides?: Partial<GameConfig>): GameConfig;
/** 创建玩家初始状态 */
export declare function createPlayerState(id: PlayerId, name: string, isBot?: boolean): PlayerState;
/** 创建游戏初始状态 */
export declare function createGameState(id: GameId, players: PlayerState[], config: GameConfig): GameState;
/**
 * 开始游戏：洗牌、发牌、进入第一回合。
 */
export declare function startGame(state: GameState): {
    state: GameState;
    events: GameEvent[];
};
/**
 * 处理玩家确认出牌。
 * 验证通过后执行走法，检查胜负或推进回合。
 */
export declare function applyMove(state: GameState, batch: MoveBatch): {
    state: GameState;
    events: GameEvent[];
} | GameError;
/**
 * 试错失败后的处理：
 * - 无时间限制 → 恢复快照，无惩罚
 * - 有时间限制 → 恢复快照 + 罚摸 3 张牌
 */
export declare function handleInvalidAttempt(snapshot: GameState, hasTimeLimit: boolean): {
    state: GameState;
    events: GameEvent[];
};
/**
 * 玩家摸牌（主动摸牌，回合中）。
 * 牌池为空时返回 null，不抛异常（配合牌池耗尽机制）。
 */
export declare function drawTile(state: GameState, playerId: PlayerId): {
    state: GameState;
    events: GameEvent[];
    drawnTile: TileInstance | null;
} | GameError;
/**
 * 玩家跳过（摸牌后或无法出牌时结束回合）。
 * 牌池为空时检查是否所有玩家都无法出牌 → 终局。
 */
export declare function passTurn(state: GameState, playerId: PlayerId): {
    state: GameState;
    events: GameEvent[];
} | GameError;
/**
 * 超时处理：自动摸牌 + 推进回合。
 * 返回是否有牌可摸（牌池为空时返回 null）。
 */
export declare function handleTimeout(state: GameState): {
    state: GameState;
    events: GameEvent[];
    timedOut: boolean;
};
/** 获取牌池数组 */
export declare function getDeck(state: GameState): TileInstance[];
/** 设置牌池数组 */
export declare function setDeck(state: GameState, deck: TileInstance[]): GameState;
/** 获取连续跳过计数 */
export declare function getConsecutivePasses(state: GameState): number;
//# sourceMappingURL=GameState.d.ts.map