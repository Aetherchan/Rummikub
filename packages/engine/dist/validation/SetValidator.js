import { MIN_SET_SIZE, MAX_GROUP_SIZE, MIN_RUN_SIZE, MAX_RUN_SIZE } from '@rummikub/shared';
import { isJoker } from '../tile/JokerLogic.js';
/** 判断一组牌是否构成合法的 Group（同数不同色，3-4 张） */
export function isValidGroup(tiles) {
    const score = computeScore(tiles);
    // 长度检查
    if (tiles.length < MIN_SET_SIZE) {
        return { valid: false, score, reason: `Group 需要至少 ${MIN_SET_SIZE} 张牌，当前 ${tiles.length} 张` };
    }
    if (tiles.length > MAX_GROUP_SIZE) {
        return { valid: false, score, reason: `Group 最多 ${MAX_GROUP_SIZE} 张牌，当前 ${tiles.length} 张` };
    }
    // 提取所有牌的"有效"属性
    const nonJokers = [];
    let jokerCount = 0;
    for (const tile of tiles) {
        if (isJoker(tile)) {
            jokerCount++;
            continue;
        }
        nonJokers.push({
            value: tile.value,
            color: tile.color,
        });
    }
    // Joker 数量检查
    if (jokerCount >= tiles.length) {
        return { valid: false, score, reason: '不能全部是百搭牌' };
    }
    if (jokerCount >= 3) {
        return { valid: false, score, reason: '百搭牌不能超过 2 张' };
    }
    // Group: 所有非 joker 牌必须同数值
    const value = nonJokers[0]?.value;
    for (const nt of nonJokers) {
        if (nt.value !== value) {
            return { valid: false, score, reason: `Group 要求所有牌数值相同，发现 ${nt.value} ≠ ${value}` };
        }
    }
    // Group: 所有非 joker 牌必须不同颜色
    const colors = new Set();
    for (const nt of nonJokers) {
        if (colors.has(nt.color)) {
            return { valid: false, score, reason: `Group 中颜色 ${nt.color} 重复` };
        }
        colors.add(nt.color);
    }
    return { valid: true, type: 'group', score };
}
/** 判断一组牌是否构成合法的 Run（同色连续数，3+ 张） */
export function isValidRun(tiles) {
    const score = computeScore(tiles);
    // 长度检查
    if (tiles.length < MIN_RUN_SIZE) {
        return { valid: false, score, reason: `Run 需要至少 ${MIN_RUN_SIZE} 张牌，当前 ${tiles.length} 张` };
    }
    if (tiles.length > MAX_RUN_SIZE) {
        return { valid: false, score, reason: `Run 最多 ${MAX_RUN_SIZE} 张牌，当前 ${tiles.length} 张` };
    }
    // 提取有效属性
    const effective = tiles.map(t => {
        const tOnBoard = t;
        return {
            value: tOnBoard.jokerSubstitution?.substitutedValue ?? t.value,
            color: tOnBoard.jokerSubstitution?.substitutedColor ?? t.color,
            isJoker: isJoker(t),
        };
    });
    // 检查颜色一致性
    const color = effective.find(e => e.color !== null)?.color;
    if (!color) {
        return { valid: false, score, reason: '无法确定 Run 的颜色' };
    }
    const jokers = effective.filter(e => e.isJoker);
    const nonJokers = effective.filter(e => !e.isJoker);
    for (const nj of nonJokers) {
        if (nj.color !== color) {
            return { valid: false, score, reason: `Run 要求所有牌同色，发现 ${nj.color} ≠ ${color}` };
        }
    }
    // 按数值排序非 joker 牌
    const sorted = [...nonJokers].sort((a, b) => (a.value ?? 0) - (b.value ?? 0));
    // 检查连续性（考虑 joker 可以填补空隙）
    if (sorted.length === 0) {
        return { valid: false, score, reason: 'Run 中至少需要一张非百搭牌' };
    }
    // 检查非 joker 牌是否有重复数值（Run 中每张牌数值必须唯一）
    const seenValues = new Set();
    for (const nj of sorted) {
        if (seenValues.has(nj.value)) {
            return { valid: false, score, reason: `Run 中数值 ${nj.value} 重复（顺子每张牌数值必须唯一）` };
        }
        seenValues.add(nj.value);
    }
    const minValue = sorted[0].value;
    const maxValue = sorted[sorted.length - 1].value;
    const expectedLength = maxValue - minValue + 1;
    const actualLength = effective.length;
    // joker 数量必须足以填补空隙
    const gaps = expectedLength - nonJokers.length;
    if (gaps < 0 || gaps > jokers.length) {
        return { valid: false, score, reason: `Run 数值不连续（区间 ${minValue}-${maxValue}，非百搭牌 ${nonJokers.length} 张，百搭牌 ${jokers.length} 张）` };
    }
    return { valid: true, type: 'run', score };
}
/** 判断一组牌是否合法（自动检测是 group 还是 run） */
export function validateSet(tiles) {
    if (tiles.length < MIN_SET_SIZE) {
        return { valid: false, score: computeScore(tiles), reason: `组合至少需要 ${MIN_SET_SIZE} 张牌` };
    }
    // 先尝试作为 group 验证
    const groupResult = isValidGroup(tiles);
    if (groupResult.valid)
        return groupResult;
    // 再尝试作为 run 验证
    const runResult = isValidRun(tiles);
    if (runResult.valid)
        return runResult;
    // 都失败了
    return {
        valid: false,
        score: computeScore(tiles),
        reason: `不是有效的 Group（${groupResult.reason}），也不是有效的 Run（${runResult.reason}）`,
    };
}
/** 计算一组牌的分数 */
export function computeScore(tiles) {
    let score = 0;
    for (const tile of tiles) {
        if (isJoker(tile)) {
            // joker 按其替代值计分
            const t = tile;
            score += t.jokerSubstitution?.substitutedValue ?? 0;
        }
        else {
            score += tile.value ?? 0;
        }
    }
    return score;
}
//# sourceMappingURL=SetValidator.js.map