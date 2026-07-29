import type { PlayerState, PlayerId } from '@rummikub/shared';
/** 分数条目 */
export interface ScoreEntry {
    playerId: PlayerId;
    playerName: string;
    /** 该局得分（正分为赢家，负分为输家） */
    score: number;
    /** 排名（1 为第一名） */
    rank: number;
}
/**
 * 计算游戏结束时的分数。
 *
 * 经典 Rummikub 计分规则：
 * - 赢家获得所有其他玩家剩余手牌的分数之和（正分）
 * - 每个其他玩家获得其剩余手牌分数的负值
 * - 手中 joker 计 30 分
 */
export declare function calculateScores(players: PlayerState[], winnerId: PlayerId): ScoreEntry[];
/**
 * 计算玩家手牌总分（用于显示）
 */
export declare function handTotalScore(player: PlayerState): number;
//# sourceMappingURL=ScoreKeeper.d.ts.map