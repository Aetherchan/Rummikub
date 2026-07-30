/**
 * 走法生成器 —— 从手牌和桌面生成所有合法走法。
 * 被所有级别 Bot 和 AI 提示功能共用。
 */

import type {
  TileInstance, SetOnBoard, GameState, PlayerState,
} from '@rummikub/shared';
import {
  isValidGroup, isValidRun, validateSet, computeScore,
  isJoker, generateInstanceId,
} from '@rummikub/engine';
import type { AtomicMove, CreateSetMove, AddTilesMove } from '@rummikub/engine';

// ---- 走法选项 ----

export interface MoveOption {
  /** 原子走法列表 */
  moves: AtomicMove[];
  /** 从手牌打出的牌 */
  tilesPlayed: TileInstance[];
  /** 打出的总分 */
  score: number;
  /** 走法的文字描述 */
  description: string;
}

// ---- 主入口 ----

/**
 * 为指定玩家生成所有可能的合法走法。
 * 如果未破冰，只生成手牌自身的组合（≥30 分）。
 * 如果已破冰，还包括加入桌面已有组合的操作。
 */
export function generateMoveOptions(
  state: GameState,
  playerIndex: number,
): MoveOption[] {
  const player = state.players[playerIndex];
  if (!player) return [];

  const hand = player.handTiles;
  const hasMelded = player.hasMelded;
  const options: MoveOption[] = [];

  // 1. 从手牌生成新的组合（CREATE_SET）
  const newSets = generateNewSets(hand);
  for (const set of newSets) {
    const score = computeScore(set);
    // 破冰检查
    if (!hasMelded && score < state.config.initialMeldMinimum) continue;

    const setId = generateInstanceId();
    const move: CreateSetMove = {
      type: 'CREATE_SET',
      setId,
      tiles: set,
    };
    options.push({
      moves: [move],
      tilesPlayed: set,
      score,
      description: `创建${set.length}张组合 (${score}分)`,
    });
  }

  // 2. 如果没有可创建的新组合，尝试加入桌面已有组合
  if (hasMelded && state.boardSets.length > 0) {
    for (const boardSet of state.boardSets) {
      const addOptions = generateAddToSet(hand, boardSet);
      for (const opt of addOptions) {
        options.push(opt);
      }
    }
  }

  // 3. 多组合走法（已破冰后可以同时打多组）
  if (hasMelded) {
    const multiOptions = generateMultiSetMoves(hand, newSets);
    for (const opt of multiOptions) {
      options.push(opt);
    }
  }

  return options;
}

// ---- 组合发现 ----

/** 从手牌中找出所有可能的合法组合（group + run） */
function generateNewSets(hand: TileInstance[]): TileInstance[][] {
  const results: TileInstance[][] = [];
  const usedIndices = new Set<number>();

  // 找 groups: 同数字不同颜色
  findGroups(hand, usedIndices, results);

  // 找 runs: 同色连续
  findRuns(hand, usedIndices, results);

  // 找 run 中包含 joker 的更多组合
  findRunsWithJokers(hand, results);

  // 去重（按 instanceId 集合）
  return deduplicateSets(results);
}

/** 找所有 groups */
function findGroups(
  hand: TileInstance[],
  _used: Set<number>,
  results: TileInstance[][],
): void {
  // 按数值分组
  const byValue = new Map<number, TileInstance[]>();
  let jokers: TileInstance[] = [];

  for (const tile of hand) {
    if (isJoker(tile)) {
      jokers.push(tile);
    } else {
      const v = tile.value!;
      if (!byValue.has(v)) byValue.set(v, []);
      byValue.get(v)!.push(tile);
    }
  }

  // 对每个数值，找出颜色不同的组合
  for (const [value, tiles] of byValue) {
    const colors = new Set(tiles.map(t => t.color));
    // 至少需要 3 种不同颜色（含 joker）
    const uniqueColors = colors.size;
    const availableJokers = jokers.length;

    // 生成所有 3-4 张的组合
    if (uniqueColors + availableJokers >= 3) {
      // 取至多 4 种颜色（group 最多 4 张）
      const colorList = [...new Set(tiles.map(t => t.color))];
      const selected: TileInstance[] = [];

      // 每种颜色取一张
      for (const color of colorList.slice(0, 4)) {
        const tile = tiles.find(t => t.color === color);
        if (tile) selected.push(tile);
      }

      // 不足 3 张则用 joker 补
      while (selected.length < 3 && jokers.length > 0) {
        selected.push({ ...jokers[0], instanceId: generateInstanceId() });
      }

      if (selected.length >= 3 && selected.length <= 4) {
        // 检查合法性
        const result = isValidGroup(selected);
        if (result.valid) {
          results.push(selected);

          // 如果有第4种颜色，尝试4张的group
          if (selected.length === 3 && colorList.length >= 4) {
            const four = [...selected];
            const extra = tiles.find(t => !selected.some(s => s.instanceId === t.instanceId));
            if (extra) four.push(extra);
            if (isValidGroup(four).valid) results.push(four);
          }
        }
      }
    }
  }
}

/** 找所有 runs */
function findRuns(
  hand: TileInstance[],
  _used: Set<number>,
  results: TileInstance[][],
): void {
  // 按颜色分组
  const byColor = new Map<string, TileInstance[]>();
  let jokers: TileInstance[] = [];

  for (const tile of hand) {
    if (isJoker(tile)) {
      jokers.push(tile);
    } else {
      const c = tile.color!;
      if (!byColor.has(c)) byColor.set(c, []);
      byColor.get(c)!.push(tile);
    }
  }

  // 对每种颜色，找连续序列
  for (const [_color, tiles] of byColor) {
    const sorted = [...tiles].sort((a, b) => (a.value ?? 0) - (b.value ?? 0));
    if (sorted.length < 2) continue; // 至少需要 2 张非 joker 才能形成 run

    // 滑动窗口找连续段
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 2; j < sorted.length; j++) {
        // i..j 应该连续
        const segment = sorted.slice(i, j + 1);
        const result = isValidRun(segment);
        if (result.valid) {
          results.push(segment);
        }
      }
    }
  }
}

/** 找包含 joker 的 runs */
function findRunsWithJokers(
  hand: TileInstance[],
  results: TileInstance[][],
): void {
  const jokers = hand.filter(isJoker);
  if (jokers.length === 0) return;

  // 简单策略：joker 可替代任意一张缺失的牌
  // 在 runs 中，尝试在各种位置插入 joker
  const nonJokers = hand.filter(t => !isJoker(t));
  const byColor = new Map<string, TileInstance[]>();
  for (const tile of nonJokers) {
    const c = tile.color!;
    if (!byColor.has(c)) byColor.set(c, []);
    byColor.get(c)!.push(tile);
  }

  for (const [_color, tiles] of byColor) {
    const sorted = [...tiles].sort((a, b) => (a.value ?? 0) - (b.value ?? 0));
    if (sorted.length < 1) continue;

    // 单张牌 + 2 joker 也可以形成最小 run
    if (sorted.length === 1 && jokers.length >= 2) {
      const run = [sorted[0], jokers[0], { ...jokers[0], instanceId: generateInstanceId() }];
      if (isValidRun(run).valid) results.push(run);
    }

    // 两张连续牌 + 1 joker
    if (sorted.length >= 2) {
      for (let i = 0; i < sorted.length - 1; i++) {
        const gap = (sorted[i + 1].value ?? 0) - (sorted[i].value ?? 0);
        if (gap === 2 && jokers.length >= 1) {
          // joker 填补中间
          const run = [sorted[i], jokers[0], sorted[i + 1]];
          if (isValidRun(run).valid) results.push(run);
        }
      }
    }
  }
}

/** 生成加入已有组合的走法 */
function generateAddToSet(
  hand: TileInstance[],
  boardSet: SetOnBoard,
): MoveOption[] {
  const options: MoveOption[] = [];

  // 逐张尝试添加手牌到已有组合
  for (const tile of hand) {
    const trial = [...boardSet.tiles, tile];
    const result = validateSet(trial);
    if (result.valid) {
      options.push({
        moves: [{ type: 'ADD_TILES_TO_SET', setId: boardSet.id, tiles: [tile] }],
        tilesPlayed: [tile],
        score: computeScore([tile]),
        description: `添加 ${tile.color}${tile.value} 到${result.type === 'group' ? '群组' : '顺子'}`,
      });
    }
  }

  return options;
}

/** 生成多组合走法（同时打多组） */
function generateMultiSetMoves(
  hand: TileInstance[],
  _newSets: TileInstance[][],
): MoveOption[] {
  // 简化：返回空。多组合走法在完整实现中用排列组合生成。
  // 当前至少保证单组走法可用。
  return [];
}

// ---- 工具 ----

function deduplicateSets(sets: TileInstance[][]): TileInstance[][] {
  const seen = new Set<string>();
  const result: TileInstance[][] = [];

  for (const set of sets) {
    // 按 instanceId 排序后生成 key
    const key = set.map(t => t.instanceId).sort().join(',');
    if (!seen.has(key)) {
      seen.add(key);
      result.push(set);
    }
  }

  return result;
}

// ---- Bot 接口 ----

/** 为 Bot 选择最优走法（被具体 Bot 调用） */
export function pickBestMove(
  options: MoveOption[],
  strategy: 'random' | 'maxScore' | 'maxTiles',
): MoveOption | null {
  if (options.length === 0) return null;

  switch (strategy) {
    case 'random':
      return options[Math.floor(Math.random() * options.length)];
    case 'maxScore':
      return options.reduce((best, cur) => cur.score > best.score ? cur : best, options[0]);
    case 'maxTiles':
      return options.reduce((best, cur) => cur.tilesPlayed.length > best.tilesPlayed.length ? cur : best, options[0]);
  }
}
