import type { PlayerState, PlayerId } from '@rummikub/shared';
import { JOKER_PENALTY } from '@rummikub/shared';
import { tileScore } from '../tile/Tile.js';
import { isJoker } from '../tile/JokerLogic.js';

// ============================================================
// 计分器 —— 游戏结束时的分数计算
// ============================================================

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
export function calculateScores(
  players: PlayerState[],
  winnerId: PlayerId,
): ScoreEntry[] {
  // 计算每个玩家手中剩余牌的分数
  const handScores = new Map<PlayerId, number>();
  let winnerHandScore = 0;

  for (const player of players) {
    let score = 0;
    for (const tile of player.handTiles) {
      score += tileScore(tile);
    }
    handScores.set(player.id, score);
  }

  const winnerScore = players
    .filter(p => p.id !== winnerId)
    .reduce((sum, p) => sum + (handScores.get(p.id) ?? 0), 0);

  const entries: ScoreEntry[] = players.map((player, index) => {
    if (player.id === winnerId) {
      return {
        playerId: player.id,
        playerName: player.name,
        score: winnerScore,
        rank: 1,
      };
    }
    return {
      playerId: player.id,
      playerName: player.name,
      score: -(handScores.get(player.id) ?? 0),
      rank: 0, // 稍后排序
    };
  });

  // 对非赢家按分数排序（分数高者排名靠前）
  const nonWinners = entries
    .filter(e => e.playerId !== winnerId)
    .sort((a, b) => b.score - a.score);

  nonWinners.forEach((entry, i) => {
    entry.rank = i + 2;
  });

  // 重建排序后的列表
  const result: ScoreEntry[] = [
    entries.find(e => e.playerId === winnerId)!,
    ...nonWinners,
  ];

  return result;
}

/**
 * 计算玩家手牌总分（用于显示）
 */
export function handTotalScore(player: PlayerState): number {
  return player.handTiles.reduce((sum, tile) => sum + tileScore(tile), 0);
}
