/**
 * 简单机器人 —— 随机选择合法走法。
 * 策略：从手牌中随机选一组能打出的牌，没有则摸牌跳过。
 */

import type { GameState } from '@rummikub/shared';
import type { AtomicMove, MoveBatch } from '@rummikub/engine';
import { generateInstanceId } from '@rummikub/engine';
import { generateMoveOptions, pickBestMove } from './move-generator';

export interface BotDecision {
  moves: AtomicMove[];
  playerId: string;
}

/**
 * 简单 Bot 决策：随机选择。
 * 如果没有任何合法走法，返回空 moves（需要外部处理摸牌+跳过）。
 */
export function easyBotDecide(
  state: GameState,
  playerIndex: number,
): BotDecision {
  const player = state.players[playerIndex];
  if (!player) return { moves: [], playerId: '' };

  const options = generateMoveOptions(state, playerIndex);
  const choice = pickBestMove(options, 'random');

  return {
    moves: choice?.moves ?? [],
    playerId: player.id,
  };
}
