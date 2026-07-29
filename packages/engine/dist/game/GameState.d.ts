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
 * 这是一个纯函数，返回新的状态和事件列表。
 */
export declare function startGame(state: GameState, randomSeed?: () => number): {
    state: GameState;
    events: GameEvent[];
};
/**
 * 处理玩家走法。
 * 纯函数：验证走法 → 应用走法 → 检查胜负 → 推进回合。
 */
export declare function applyMove(state: GameState, batch: MoveBatch): {
    state: GameState;
    events: GameEvent[];
} | GameError;
/**
 * 玩家摸牌。
 */
export declare function drawTile(state: GameState, playerId: PlayerId): {
    state: GameState;
    events: GameEvent[];
    drawnTile: TileInstance | null;
} | GameError;
/**
 * 玩家跳过（摸牌后结束回合）。
 */
export declare function passTurn(state: GameState, playerId: PlayerId): {
    state: GameState;
    events: GameEvent[];
} | GameError;
/** 获取牌池数组（内部使用） */
export declare function getDeck(state: GameState): TileInstance[];
/** 设置牌池数组（内部使用） */
export declare function setDeck(state: GameState, deck: TileInstance[]): GameState;
//# sourceMappingURL=GameState.d.ts.map