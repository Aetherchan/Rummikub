/** 标准 Rummikub 牌组配置 */
export declare const DECK_CONFIG: {
    /** 每种颜色-数值组合的份数 */
    readonly copiesPerTile: 2;
    /** 最小数值 */
    readonly minValue: 1;
    /** 最大数值 */
    readonly maxValue: 13;
    /** 颜色列表 */
    readonly colors: readonly ["red", "blue", "yellow", "black"];
    /** 百搭牌数量 */
    readonly jokerCount: 2;
    /** 总牌数 */
    readonly totalTiles: number;
};
/** 标准初始摸牌数 */
export declare const INITIAL_HAND_SIZE = 14;
/** 初次出牌最低分数（标准规则 30 分） */
export declare const INITIAL_MELD_MINIMUM = 30;
/** 有效组合的最小长度 */
export declare const MIN_SET_SIZE = 3;
/** Group（同数组）的最大长度（4 种颜色） */
export declare const MAX_GROUP_SIZE = 4;
/** 顺子的最小长度 */
export declare const MIN_RUN_SIZE = 3;
/** 顺子的最大长度（1-13） */
export declare const MAX_RUN_SIZE = 13;
/** 百搭牌在游戏结束时的罚分 */
export declare const JOKER_PENALTY = 30;
/** 每回合默认时间限制（秒），0 表示无限制 */
export declare const DEFAULT_TURN_TIME_LIMIT = 120;
//# sourceMappingURL=constants.d.ts.map