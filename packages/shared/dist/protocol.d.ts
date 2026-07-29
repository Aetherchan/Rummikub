import type { PlayerId, TileInstance } from './tile-types.js';
import type { GameConfig, GameState, TurnPhase, SetOnBoard } from './game-types.js';
export type AtomicMove = {
    type: 'ADD_TILES_TO_SET';
    setId: string;
    tiles: TileInstance[];
} | {
    type: 'REMOVE_TILES_FROM_SET';
    setId: string;
    tileIds: string[];
} | {
    type: 'SPLIT_SET';
    sourceSetId: string;
    atIndex: number;
    newSetId: string;
} | {
    type: 'MERGE_SETS';
    sourceSetId: string;
    targetSetId: string;
    position: 'start' | 'end';
} | {
    type: 'CREATE_SET';
    tiles: TileInstance[];
} | {
    type: 'DISMISS_SET';
    setId: string;
};
export type ClientMessage = {
    type: 'room:create';
    payload: CreateRoomPayload;
} | {
    type: 'room:join';
    payload: {
        roomCode: string;
    };
} | {
    type: 'room:leave';
    payload: {
        roomId: string;
    };
} | {
    type: 'room:ready';
    payload: {
        roomId: string;
    };
} | {
    type: 'game:start';
    payload: {
        roomId: string;
    };
} | {
    type: 'game:commitMove';
    payload: {
        gameId: string;
        moves: AtomicMove[];
        moveId: string;
    };
} | {
    type: 'game:drawTile';
    payload: {
        gameId: string;
    };
} | {
    type: 'game:pass';
    payload: {
        gameId: string;
    };
};
export interface CreateRoomPayload {
    name: string;
    maxPlayers: 2 | 3 | 4;
    aiPlayers: number;
    aiDifficulty: 'easy' | 'medium' | 'hard';
    turnTimeLimitSeconds: number;
}
export type ServerMessage = {
    type: 'room:joined';
    payload: RoomState;
} | {
    type: 'room:playerJoined';
    payload: {
        playerId: string;
        playerName: string;
        seat: number;
    };
} | {
    type: 'room:playerLeft';
    payload: {
        playerId: string;
    };
} | {
    type: 'room:updated';
    payload: RoomState;
} | {
    type: 'game:started';
    payload: {
        gameId: string;
        players: PlayerInfo[];
    };
} | {
    type: 'game:stateUpdate';
    payload: GameStateDiff;
} | {
    type: 'game:yourHand';
    payload: {
        tiles: TileInstance[];
    };
} | {
    type: 'game:moveAccepted';
    payload: {
        moveId: string;
        state: GameState;
    };
} | {
    type: 'game:moveRejected';
    payload: {
        moveId: string;
        reason: string;
    };
} | {
    type: 'game:drawResult';
    payload: {
        tile: TileInstance;
    };
} | {
    type: 'game:turnChanged';
    payload: {
        playerId: string;
        turnPhase: TurnPhase;
        secondsRemaining: number;
    };
} | {
    type: 'game:playerMelded';
    payload: {
        playerId: string;
    };
} | {
    type: 'game:over';
    payload: {
        winnerId: string;
        finalScores: ScoreEntry[];
    };
} | {
    type: 'game:timerTick';
    payload: {
        secondsRemaining: number;
    };
} | {
    type: 'error';
    payload: {
        code: string;
        message: string;
    };
};
export interface PlayerInfo {
    id: PlayerId;
    name: string;
    isBot: boolean;
    seat: number;
}
export interface RoomState {
    id: string;
    code: string;
    name: string;
    hostId: string;
    maxPlayers: number;
    players: PlayerInfo[];
    config: GameConfig;
    status: 'waiting' | 'playing' | 'finished';
}
export interface ScoreEntry {
    playerId: string;
    playerName: string;
    score: number;
    rank: number;
}
/** 棋盘差异更新（优化传输） */
export interface GameStateDiff {
    /** 当前回合玩家索引 */
    currentPlayerIndex: number;
    /** 回合阶段 */
    turnPhase: TurnPhase;
    /** 新增的组合 */
    newSets: SetOnBoard[];
    /** 已修改的组合（完整替换） */
    modifiedSets: SetOnBoard[];
    /** 已移除的组合 ID */
    removedSetIds: string[];
    /** 牌池剩余数量 */
    poolTileCount: number;
    /** 走法摘要 */
    lastMove?: {
        playerId: string;
        tilesPlayed: number;
        scoreContributed: number;
    };
    /** 胜者（游戏结束时） */
    winner?: string;
    /** 玩家是否已破冰 */
    playerMelded?: string;
}
//# sourceMappingURL=protocol.d.ts.map