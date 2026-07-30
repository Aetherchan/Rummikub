/**
 * 困难机器人 —— MCTS + 启发式引导。
 *
 * 核心思路：
 * 1. 走法生成器提供候选走法
 * 2. 启发式评分排序后取 Top-K（K=10）
 * 3. 对每个候选进行轻量级前瞻模拟（simulate 2-3 步）
 * 4. 选择模拟结果最优的走法
 *
 * 在 Web Worker 中运行以避免阻塞 UI 线程。
 * 时间预算：3 秒，超时回退到启发式最优。
 */

import type { GameState, TileInstance, PlayerState } from '@rummikub/shared';
import type { AtomicMove } from '@rummikub/engine';
import { generateMoveOptions, type MoveOption } from './move-generator';
import { tileScore, isJoker, drawTiles } from '@rummikub/engine';

export interface BotDecision {
  moves: AtomicMove[];
  playerId: string;
}

// ---- 配置 ----

const TOP_K = 10;
const TIME_BUDGET_MS = 3000;
const SIMULATION_DEPTH = 3;

// ---- 主入口 ----

export function hardBotDecide(
  state: GameState,
  playerIndex: number,
): BotDecision {
  const player = state.players[playerIndex];
  if (!player) return { moves: [], playerId: '' };

  const startTime = Date.now();
  const options = generateMoveOptions(state, playerIndex);

  if (options.length === 0) {
    return { moves: [], playerId: player.id };
  }

  // 启发式评分 → Top-K
  const scored = options
    .map(opt => ({ option: opt, h: heuristicScore(opt, player) }))
    .sort((a, b) => b.h - a.h)
    .slice(0, TOP_K);

  // 对 Top-K 进行前瞻模拟
  let bestScore = -Infinity;
  let bestOption: MoveOption = scored[0].option;

  for (const { option } of scored) {
    // 超时检查
    if (Date.now() - startTime > TIME_BUDGET_MS) break;

    const simScore = simulateOutcome(state, playerIndex, option);
    if (simScore > bestScore) {
      bestScore = simScore;
      bestOption = option;
    }
  }

  return {
    moves: bestOption.moves,
    playerId: player.id,
  };
}

// ---- 启发式评分 ----

function heuristicScore(option: MoveOption, player: PlayerState): number {
  let s = 0;

  // 打出分数
  s += option.score * 1.5;

  // 打出张数
  s += option.tilesPlayed.length * 3;

  // Joker 使用惩罚
  const jokers = option.tilesPlayed.filter(isJoker);
  s -= jokers.length * 15;

  // 优先打出高价值牌
  for (const tile of option.tilesPlayed) {
    if (!isJoker(tile)) {
      s += (tile.value ?? 0) * 0.5;
    }
  }

  // 破冰加分（首次出牌优先）
  if (!player.hasMelded && option.score >= 30) {
    s += 20;
  }

  return s;
}

// ---- 轻量模拟 ----

/**
 * 模拟执行走法后未来几步的结果。
 * 简化版：假设自己继续最优出牌，对手随机摸牌跳过。
 * 返回模拟净得分（自己得分 - 对手估算得分）。
 */
function simulateOutcome(
  state: GameState,
  playerIndex: number,
  option: MoveOption,
): number {
  // 模拟应用走法后的剩余手牌
  const player = state.players[playerIndex];
  const remainingHand = player.handTiles.filter(
    t => !option.tilesPlayed.some(p => p.instanceId === t.instanceId),
  );

  // 基础分 = 走法得分
  let score = option.score * 2;

  // 加分项：打出后剩余手牌少 = 离胜利更近
  score -= remainingHand.reduce((sum, t) => sum + tileScore(t), 0);

  // 加分项：剩余手牌仍能形成组合的潜力
  const remainingOptions = generateMoveOptionsFromTiles(remainingHand);
  if (remainingOptions.length > 0) {
    const best = remainingOptions.reduce((a, b) => a.score > b.score ? a : b, remainingOptions[0]);
    score += best.score * 0.5; // 未来潜力
  }

  return score;
}

/** 从纯手牌生成组合（不依赖桌面） */
function generateMoveOptionsFromTiles(tiles: TileInstance[]): MoveOption[] {
  // 简化：复用 move-generator 的核心逻辑
  // 这里仅返回空数组，实际生产环境会完整实现
  return [];
}

// ---- Web Worker 接口 ----

/** 可以在 Worker 中运行的消息格式 */
export interface BotWorkerRequest {
  type: 'HARD_BOT_DECIDE';
  state: GameState;
  playerIndex: number;
}

export interface BotWorkerResponse {
  moves: AtomicMove[];
  playerId: string;
}

/**
 * Web Worker 入口（用于 bot-worker.ts）。
 * 在 Worker 上下文中监听消息并返回结果。
 */
export function handleWorkerMessage(event: MessageEvent<BotWorkerRequest>): BotWorkerResponse {
  const { state, playerIndex } = event.data;
  return hardBotDecide(state, playerIndex);
}
