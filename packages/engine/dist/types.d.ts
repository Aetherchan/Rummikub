import type { TileInstance, TileOnBoard, PlayerId, GameId, SetId, InstanceId, TileColor, TileValue, PlayerInfo, GameState } from '@rummikub/shared';
export type { TileInstance, TileOnBoard, PlayerId, GameId, SetId, InstanceId, TileColor, TileValue, PlayerInfo, };
export declare class GameError extends Error {
    code: string;
    constructor(message: string, code: string);
}
export type GameEvent = {
    type: 'GAME_STARTED';
    gameId: GameId;
} | {
    type: 'TURN_STARTED';
    playerId: PlayerId;
    turnNumber: number;
} | {
    type: 'TILES_PLAYED';
    playerId: PlayerId;
    tileCount: number;
    score: number;
} | {
    type: 'PLAYER_MELDED';
    playerId: PlayerId;
} | {
    type: 'TILE_DRAWN';
    playerId: PlayerId;
} | {
    type: 'TURN_PASSED';
    playerId: PlayerId;
} | {
    type: 'GAME_OVER';
    winnerId: PlayerId;
} | {
    type: 'ROUND_OVER';
};
export type GameResult = {
    ok: true;
    state: GameState;
    events: GameEvent[];
} | {
    ok: false;
    error: GameError;
};
//# sourceMappingURL=types.d.ts.map