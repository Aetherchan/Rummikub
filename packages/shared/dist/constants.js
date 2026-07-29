// ============================================================
// 游戏常量
// ============================================================
/** 标准 Rummikub 牌组配置 */
export const DECK_CONFIG = {
    /** 每种颜色-数值组合的份数 */
    copiesPerTile: 2,
    /** 最小数值 */
    minValue: 1,
    /** 最大数值 */
    maxValue: 13,
    /** 颜色列表 */
    colors: ['red', 'blue', 'yellow', 'black'],
    /** 百搭牌数量 */
    jokerCount: 2,
    /** 总牌数 */
    get totalTiles() {
        return this.copiesPerTile * this.colors.length * (this.maxValue - this.minValue + 1) + this.jokerCount;
    },
};
/** 标准初始摸牌数 */
export const INITIAL_HAND_SIZE = 14;
/** 初次出牌最低分数（标准规则 30 分） */
export const INITIAL_MELD_MINIMUM = 30;
/** 有效组合的最小长度 */
export const MIN_SET_SIZE = 3;
/** Group（同数组）的最大长度（4 种颜色） */
export const MAX_GROUP_SIZE = 4;
/** 顺子的最小长度 */
export const MIN_RUN_SIZE = 3;
/** 顺子的最大长度（1-13） */
export const MAX_RUN_SIZE = 13;
/** 百搭牌在游戏结束时的罚分 */
export const JOKER_PENALTY = 30;
/** 每回合默认时间限制（秒），0 表示无限制 */
export const DEFAULT_TURN_TIME_LIMIT = 120;
//# sourceMappingURL=constants.js.map