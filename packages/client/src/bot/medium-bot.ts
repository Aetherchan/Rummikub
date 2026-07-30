/**
 * 中等机器人 —— 启发式评估。
 * 策略：
 * 1. 优先打出高分组合（高数值、含 Joker 利用率高的）
 * 2. 优先破冰
 * 3. 优先打出更多张牌
 * 4. 避免在早期浪费 Joker
 * 5. 1步前瞻：考虑打出后剩余手牌的组合潜力
 */

import type { GameState, TileInstance } from '@rummikub/shared';
import type { AtomicMove } from '@rummikub/engine';
import { isJoker, tileScore, computeScore } from '@rummikub/engine';
import { generateMoveOptions, type MoveOption } from './move-generator';

export interface BotDecision {
  moves: AtomicMove[];
  playerId: string;
}

export function mediumBotDecide(
  state: GameState,
  playerIndex: number,
): BotDecision {
  const player = state.players[playerIndex];
  if (!player) return { moves: [], playerId: '' };

  const options = generateMoveOptions(state, playerIndex);
  if (options.length === 0) {
    return { moves: [], playerId: player.id };
  }

  // 启发式评分
  const scored = options.map(opt => ({
    option: opt,
    score: evaluateMove(opt, player.handTiles, state),
  }));

  // 按评分降序排列
  scored.sort((a, b) => b.score - a.score);

  return {
    moves: scored[0].option.moves,
    playerId: player.id,
  };
}

/**
 * 启发式评估一个走法。
 * 返回评分（越高越好）。
 */
function evaluateMove(
  option: MoveOption,
  fullHand: TileInstance[],
  _state: GameState,
): number {
  let score = 0;

  // 1. 打出分数：每分 +1
  score += option.score;

  // 2. 打出张数：每张额外 +2
  score += option.tilesPlayed.length * 2;

  // 3. Joker 使用惩罚：出牌中包含 Joker 扣分（保留 Joker 更好）
  const playedJokers = option.tilesPlayed.filter(isJoker);
  score -= playedJokers.length * 10;

  // 4. 剩余手牌潜在组合：对高数值手牌（7-13）保留 +1 分
  const remaining = fullHand.filter(
    t => !option.tilesPlayed.some(p => p.instanceId === t.instanceId),
  );
  for (const tile of remaining) {
    if (!isJoker(tile) && (tile.value ?? 0) >= 7) {
      score += 1; // 保留高价值牌给后续回合
    }
  }

  // 5. 打出高价值牌：鼓励打高分牌（快速减少手牌分数）
  for (const tile of option.tilesPlayed) {
    if (!isJoker(tile) && (tile.value ?? 0) >= 10) {
      score += 3; // 高价值牌优先打出
    }
  }

  return score;
}
