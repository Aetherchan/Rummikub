import { GameError } from '../types.js';
import { executeMoveBatch } from './MoveExecutor.js';
import { validateBoard } from '../validation/BoardValidator.js';
import { validateSet, computeScore } from '../validation/SetValidator.js';
import { validateInitialMeld } from '../validation/MeldValidator.js';
/**
 * 三阶段验证走法批次：
 * 1. 语法验证：每个原子操作引用合法的 ID
 * 2. 应用走法到状态副本
 * 3. 结构验证：最终桌面状态所有组合合法
 */
export function validateMoveBatch(state, batch) {
    const player = state.players[state.currentPlayerIndex];
    if (!player) {
        return { valid: false, reason: '无效的玩家' };
    }
    if (player.id !== batch.playerId) {
        return { valid: false, reason: '不是当前玩家的回合' };
    }
    try {
        // 阶段1：语法验证
        const syntaxResult = validateSyntax(state, batch.moves);
        if (!syntaxResult.valid)
            return syntaxResult;
        // 阶段2：应用走法到副本
        const newState = executeMoveBatch(state, batch.moves);
        // 阶段3：验证最终桌面状态
        const boardResult = validateBoard(newState.boardSets);
        if (!boardResult.valid) {
            return { valid: false, reason: `桌面状态不合法: ${boardResult.errors.join('; ')}` };
        }
        // 阶段3b：验证每个新建/修改的组合
        for (const set of newState.boardSets) {
            const setResult = validateSet(set.tiles);
            if (!setResult.valid) {
                return { valid: false, reason: `组合 ${set.id} 不合法: ${setResult.reason}` };
            }
        }
        // 阶段3c：如果玩家尚未破冰，验证是否满足首次出牌要求
        const scoreFromHand = computeScoreFromBatch(state, batch.moves);
        if (!player.hasMelded) {
            const meldResult = validateInitialMeld(getTilesPlayedFromHand(state, batch.moves));
            if (!meldResult.valid) {
                return { valid: false, reason: meldResult.reason, scoreFromHand };
            }
        }
        // 验证手牌数量一致
        const newPlayer = newState.players[state.currentPlayerIndex];
        if (newPlayer.handTiles.length !== newPlayer.handTileCount) {
            return { valid: false, reason: '手牌数量不一致' };
        }
        return { valid: true, scoreFromHand };
    }
    catch (error) {
        if (error instanceof GameError) {
            return { valid: false, reason: error.message };
        }
        return { valid: false, reason: '走法验证时发生未知错误' };
    }
}
/**
 * 阶段1：语法验证
 */
function validateSyntax(state, moves) {
    for (const move of moves) {
        switch (move.type) {
            case 'ADD_TILES_TO_SET':
            case 'REMOVE_TILES_FROM_SET':
            case 'DISMISS_SET':
                if (!state.boardSets.some((s) => s.id === move.setId)) {
                    return { valid: false, reason: `组合 ${move.setId} 不存在` };
                }
                break;
            case 'SPLIT_SET':
                if (!state.boardSets.some((s) => s.id === move.sourceSetId)) {
                    return { valid: false, reason: `源组合 ${move.sourceSetId} 不存在` };
                }
                break;
            case 'MERGE_SETS':
                if (!state.boardSets.some((s) => s.id === move.sourceSetId)) {
                    return { valid: false, reason: `源组合 ${move.sourceSetId} 不存在` };
                }
                if (!state.boardSets.some((s) => s.id === move.targetSetId)) {
                    return { valid: false, reason: `目标组合 ${move.targetSetId} 不存在` };
                }
                break;
        }
    }
    return { valid: true };
}
/**
 * 计算走法批次中从手牌打出的分数
 */
function computeScoreFromBatch(state, moves) {
    const tilesFromHand = getTilesPlayedFromHand(state, moves);
    return computeScore(tilesFromHand);
}
/**
 * 获取走法批次中从手牌打出的牌
 */
function getTilesPlayedFromHand(state, moves) {
    const playerHand = state.players[state.currentPlayerIndex].handTiles;
    const handInstanceIds = new Set(playerHand.map((t) => t.instanceId));
    const tilesFromHand = [];
    for (const move of moves) {
        if (move.type === 'ADD_TILES_TO_SET' || move.type === 'CREATE_SET') {
            for (const tile of move.tiles) {
                if (handInstanceIds.has(tile.instanceId)) {
                    tilesFromHand.push(tile);
                }
            }
        }
    }
    return tilesFromHand;
}
/**
 * 判断走法操作是否涉及桌面牌操作。
 * 未破冰的玩家不能操弄桌面牌。
 */
export function involvesBoardManipulation(moves) {
    return moves.some(m => m.type === 'SPLIT_SET' ||
        m.type === 'MERGE_SETS' ||
        m.type === 'REMOVE_TILES_FROM_SET' ||
        m.type === 'DISMISS_SET');
}
//# sourceMappingURL=MoveValidator.js.map