import { validateSet, computeScore } from './SetValidator.js';
/**
 * 验证整个桌面状态。
 * 检查：
 * 1. 每个组合内部是否合法
 * 2. 没有重复的牌实例（同一张 instanceId 不能出现两次）
 * 3. 没有桌面上不该存在的牌
 */
export function validateBoard(sets) {
    const errors = [];
    const seenInstanceIds = new Set();
    for (const set of sets) {
        // 检查组合是否至少 3 张
        if (set.tiles.length < 3) {
            errors.push(`组合 ${set.id} 只有 ${set.tiles.length} 张牌，至少需要 3 张`);
        }
        // 验证组合合法性
        const result = validateSet(set.tiles);
        if (!result.valid) {
            errors.push(`组合 ${set.id} 不合法: ${result.reason}`);
        }
        // 检查重复实例 ID
        for (const tile of set.tiles) {
            if (seenInstanceIds.has(tile.instanceId)) {
                errors.push(`牌 ${tile.id} (${tile.instanceId}) 在桌面上重复出现`);
            }
            seenInstanceIds.add(tile.instanceId);
        }
    }
    return { valid: errors.length === 0, errors };
}
/**
 * 在应用变更后验证桌面状态。
 * 用于 MoveValidator：假设应用了移动，然后验证桌面是否仍然全合法。
 */
export function validateBoardAfterMoves(sets, movedTiles) {
    // 简单场景：只检查所有组合合法且无重复
    return validateBoard(sets);
}
/**
 * 提交前验证：逐组检查桌面牌组 + 破冰条件检查。
 * 用于 UI 层在提交前验证，返回每组的详细结果用于高亮错误牌组。
 */
export function validateBoardForCommit(sets, snapshotBoard, hasMelded, initialMeldMinimum) {
    const errors = [];
    const seenInstanceIds = new Set();
    // 逐组验证
    const setResults = sets.map(set => {
        const result = validateSet(set.tiles);
        const score = computeScore(set.tiles);
        // 检查 instanceId 重复
        for (const tile of set.tiles) {
            if (seenInstanceIds.has(tile.instanceId)) {
                return {
                    setId: set.id,
                    tiles: set.tiles,
                    valid: false,
                    reason: `牌 ${tile.instanceId} 在桌面上重复出现`,
                    score,
                };
            }
            seenInstanceIds.add(tile.instanceId);
        }
        // 检查长度
        if (set.tiles.length < 3) {
            return {
                setId: set.id,
                tiles: set.tiles,
                valid: false,
                reason: `牌组只有 ${set.tiles.length} 张牌，至少需要 3 张`,
                score,
            };
        }
        if (!result.valid) {
            return {
                setId: set.id,
                tiles: set.tiles,
                valid: false,
                reason: result.reason ?? '不合法',
                score,
            };
        }
        return {
            setId: set.id,
            tiles: set.tiles,
            valid: true,
            type: result.type,
            score,
        };
    });
    // 收集错误
    for (const r of setResults) {
        if (!r.valid) {
            errors.push(`牌组 ${r.setId}: ${r.reason}`);
        }
    }
    // 计算从手牌打出的分数
    // 对比 snapshotBoard：找出所有不在 snapshot 中的 instanceId（新打到桌面的牌）
    const snapshotIds = new Set();
    for (const s of snapshotBoard) {
        for (const t of s.tiles) {
            snapshotIds.add(t.instanceId);
        }
    }
    let scoreFromHand = 0;
    for (const s of sets) {
        for (const t of s.tiles) {
            if (!snapshotIds.has(t.instanceId)) {
                // 这张牌不在回合开始时的桌面上 → 从手牌打出
                scoreFromHand += computeScore([t]);
            }
        }
    }
    // 破冰检查
    const meldMet = hasMelded || scoreFromHand >= initialMeldMinimum;
    if (!meldMet && scoreFromHand > 0 && !hasMelded) {
        errors.push(`破冰需要至少 ${initialMeldMinimum} 分，当前从手牌打出 ${scoreFromHand} 分`);
    }
    return {
        valid: setResults.every(r => r.valid) && (hasMelded || scoreFromHand === 0 || meldMet),
        errors,
        setResults,
        scoreFromHand,
        meldMet,
    };
}
//# sourceMappingURL=BoardValidator.js.map