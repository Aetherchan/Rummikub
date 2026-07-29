// ============================================================
// 百搭牌（Joker）逻辑
// ============================================================
/** 判断是否为 joker */
export function isJoker(tile) {
    return tile.color === null && tile.value === null;
}
/** 获取 joker 在桌面上的实际表现颜色 */
export function effectiveColor(tile) {
    if (!isJoker(tile))
        return tile.color;
    return tile.jokerSubstitution?.substitutedColor ?? null;
}
/** 获取 joker 在桌面上的实际表现数值 */
export function effectiveValue(tile) {
    if (!isJoker(tile))
        return tile.value;
    return tile.jokerSubstitution?.substitutedValue ?? null;
}
/** 为 joker 创建替代信息 */
export function createSubstitution(tile, value, color) {
    if (!isJoker(tile))
        return null;
    return { substitutedValue: value, substitutedColor: color };
}
/** 将桌面上带替代的 joker 转为普通牌 */
export function toTileOnBoard(tile, substitution) {
    return {
        ...tile,
        jokerSubstitution: isJoker(tile) ? substitution : undefined,
    };
}
/**
 * 判断能否用某张牌替换 joker。
 * 只有当玩家手中有与 joker 替代值完全相同的牌时才能替换。
 */
export function canReplaceJoker(jokerTile, candidateTile) {
    if (!isJoker(jokerTile))
        return false;
    const sub = jokerTile.jokerSubstitution;
    if (!sub)
        return false;
    return (!isJoker(candidateTile) &&
        candidateTile.color === sub.substitutedColor &&
        candidateTile.value === sub.substitutedValue);
}
/**
 * 从一组桌面牌中"释放"joker。
 * 返回更新后的牌组和取出的 joker。
 */
export function freeJokerFromSet(setTiles, jokerIndex, replacementTile) {
    const joker = setTiles[jokerIndex];
    if (!joker || !isJoker(joker))
        return null;
    if (!canReplaceJoker(joker, replacementTile))
        return null;
    // 用真实牌替换 joker
    const freedJoker = {
        id: joker.id,
        color: null,
        value: null,
        instanceId: joker.instanceId,
    };
    const updatedSet = [...setTiles];
    updatedSet[jokerIndex] = {
        ...replacementTile,
        instanceId: replacementTile.instanceId,
    };
    return { updatedSet, freedJoker };
}
//# sourceMappingURL=JokerLogic.js.map