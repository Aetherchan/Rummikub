import { GameError } from '../types.js';
import { INITIAL_HAND_SIZE, INITIAL_MELD_MINIMUM } from '@rummikub/shared';
import { createDeck, shuffleDeck, drawTiles, drawOneTile } from '../tile/TileDeck.js';
import { sortTiles } from '../tile/Tile.js';
import { validateMoveBatch } from '../manipulation/MoveValidator.js';
import { executeMoveBatch } from '../manipulation/MoveExecutor.js';
// ============================================================
// 游戏状态机
// ============================================================
// 类型从 @rummikub/shared 导出，使用时直接从 shared 导入
/** 创建默认游戏配置 */
export function createDefaultConfig(overrides) {
    return {
        maxPlayers: 4,
        initialMeldMinimum: INITIAL_MELD_MINIMUM,
        turnTimeLimitSeconds: 120,
        aiPlayers: 0,
        aiDifficulty: 'easy',
        ...overrides,
    };
}
/** 创建玩家初始状态 */
export function createPlayerState(id, name, isBot = false) {
    return {
        id,
        name,
        handTileCount: 0,
        handTiles: [],
        score: 0,
        hasMelded: false,
        isBot,
        isConnected: true,
    };
}
/** 创建游戏初始状态 */
export function createGameState(id, players, config) {
    return {
        id,
        phase: 'WAITING_FOR_PLAYERS',
        turnPhase: 'WAITING',
        players,
        boardSets: [],
        poolTileCount: 0,
        currentPlayerIndex: 0,
        turnNumber: 0,
        config,
    };
}
/**
 * 开始游戏：洗牌、发牌、进入第一回合。
 * 这是一个纯函数，返回新的状态和事件列表。
 */
export function startGame(state, randomSeed) {
    if (state.phase !== 'WAITING_FOR_PLAYERS') {
        throw new GameError('游戏已在进行中', 'GAME_ALREADY_STARTED');
    }
    if (state.players.length < 2) {
        throw new GameError('至少需要 2 名玩家', 'NOT_ENOUGH_PLAYERS');
    }
    const events = [];
    // 创建并洗牌
    let deck = createDeck();
    deck = shuffleDeck(deck);
    // 发牌：每人 14 张
    const playersWithHands = [];
    let remainingDeck = [...deck];
    for (const player of state.players) {
        const { drawn, remaining } = drawTiles(remainingDeck, INITIAL_HAND_SIZE);
        playersWithHands.push({
            ...player,
            handTiles: sortTiles(drawn),
            handTileCount: drawn.length,
        });
        remainingDeck = remaining;
    }
    const newState = {
        ...state,
        phase: 'IN_PROGRESS',
        turnPhase: 'ARRANGING',
        players: playersWithHands,
        poolTileCount: remainingDeck.length,
        currentPlayerIndex: 0,
        turnNumber: 1,
        _deck: remainingDeck, // 内部牌池（不对外暴露）
    };
    events.push({ type: 'GAME_STARTED', gameId: state.id });
    events.push({ type: 'TURN_STARTED', playerId: state.players[0].id, turnNumber: 1 });
    return { state: newState, events };
}
/**
 * 处理玩家走法。
 * 纯函数：验证走法 → 应用走法 → 检查胜负 → 推进回合。
 */
export function applyMove(state, batch) {
    if (state.phase !== 'IN_PROGRESS') {
        return new GameError('游戏未在进行中', 'GAME_NOT_IN_PROGRESS');
    }
    const currentPlayer = state.players[state.currentPlayerIndex];
    if (batch.playerId !== currentPlayer.id) {
        return new GameError('不是你的回合', 'NOT_YOUR_TURN');
    }
    // 验证走法
    const validation = validateMoveBatch(state, batch);
    if (!validation.valid) {
        return new GameError(validation.reason ?? '无效走法', 'INVALID_MOVE');
    }
    const events = [];
    // 应用走法
    let newState = executeMoveBatch(state, batch.moves);
    // 检查是否破冰
    const updatedPlayer = newState.players[state.currentPlayerIndex];
    if (!updatedPlayer.hasMelded && (validation.scoreFromHand ?? 0) >= state.config.initialMeldMinimum) {
        newState = {
            ...newState,
            players: newState.players.map((p, i) => i === state.currentPlayerIndex ? { ...p, hasMelded: true } : p),
        };
        events.push({ type: 'PLAYER_MELDED', playerId: updatedPlayer.id });
    }
    // 记录走法
    const tilesPlayed = batch.moves.reduce((count, m) => {
        if (m.type === 'ADD_TILES_TO_SET' || m.type === 'CREATE_SET') {
            return count + m.tiles.length;
        }
        return count;
    }, 0);
    events.push({
        type: 'TILES_PLAYED',
        playerId: updatedPlayer.id,
        tileCount: tilesPlayed,
        score: validation.scoreFromHand ?? 0,
    });
    // 检查是否清空手牌（胜利）
    if (updatedPlayer.handTiles.length === 0) {
        return endGame(newState, updatedPlayer.id, events);
    }
    // 推进到下一位玩家
    return advanceTurn(newState, events);
}
/**
 * 玩家摸牌。
 */
export function drawTile(state, playerId) {
    if (state.phase !== 'IN_PROGRESS') {
        return new GameError('游戏未在进行中', 'GAME_NOT_IN_PROGRESS');
    }
    const currentPlayer = state.players[state.currentPlayerIndex];
    if (playerId !== currentPlayer.id) {
        return new GameError('不是你的回合', 'NOT_YOUR_TURN');
    }
    const deck = state._deck ?? [];
    const { tile, remaining } = drawOneTile(deck);
    if (!tile) {
        return new GameError('牌池已空', 'POOL_EMPTY');
    }
    const events = [{ type: 'TILE_DRAWN', playerId }];
    const newState = {
        ...state,
        players: state.players.map((p, i) => i === state.currentPlayerIndex
            ? { ...p, handTiles: sortTiles([...p.handTiles, tile]), handTileCount: p.handTileCount + 1 }
            : p),
        poolTileCount: remaining.length,
        turnPhase: 'WAITING',
        _deck: remaining,
    };
    return { state: newState, events, drawnTile: tile };
}
/**
 * 玩家跳过（摸牌后结束回合）。
 */
export function passTurn(state, playerId) {
    if (state.phase !== 'IN_PROGRESS') {
        return new GameError('游戏未在进行中', 'GAME_NOT_IN_PROGRESS');
    }
    const currentPlayer = state.players[state.currentPlayerIndex];
    if (playerId !== currentPlayer.id) {
        return new GameError('不是你的回合', 'NOT_YOUR_TURN');
    }
    const events = [{ type: 'TURN_PASSED', playerId }];
    return advanceTurn(state, events);
}
// ---- 内部辅助函数 ----
function advanceTurn(state, events) {
    const nextPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
    const newState = {
        ...state,
        currentPlayerIndex: nextPlayerIndex,
        turnNumber: nextPlayerIndex === 0 ? state.turnNumber + 1 : state.turnNumber,
        turnPhase: 'ARRANGING',
        lastMove: state.lastMove,
    };
    events.push({
        type: 'TURN_STARTED',
        playerId: state.players[nextPlayerIndex].id,
        turnNumber: newState.turnNumber,
    });
    return { state: newState, events };
}
function endGame(state, winnerId, events) {
    events.push({ type: 'GAME_OVER', winnerId });
    const finalState = {
        ...state,
        phase: 'GAME_OVER',
        winner: winnerId,
    };
    return { state: finalState, events };
}
/** 获取牌池数组（内部使用） */
export function getDeck(state) {
    return state._deck ?? [];
}
/** 设置牌池数组（内部使用） */
export function setDeck(state, deck) {
    return { ...state, _deck: deck, poolTileCount: deck.length };
}
//# sourceMappingURL=GameState.js.map