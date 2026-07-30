/**
 * 走法生成器 —— 从手牌和桌面生成所有合法走法。
 * 被所有级别 Bot 和 AI 提示功能共用。
 */

import type {
  TileInstance, SetOnBoard, GameState, PlayerState,
  TileColor, TileValue, JokerSubstitution, TileOnBoard,
} from '@rummikub/shared';
import {
  isValidGroup, isValidRun, validateSet, computeScore,
  isJoker, generateInstanceId,
} from '@rummikub/engine';
import type { AtomicMove, CreateSetMove, AddTilesMove } from '@rummikub/engine';

// ---- Joker 工具 ----

const ALL_COLORS: TileColor[] = ['red', 'blue', 'yellow', 'black'];

/** 找出一组颜色中缺失的颜色（用于 Joker 在 group 中的替代） */
function getMissingColor(presentColors: TileColor[]): TileColor {
  for (const c of ALL_COLORS) {
    if (!presentColors.includes(c)) return c;
  }
  return 'red'; // fallback
}

/**
 * 为 Joker 牌设置替代值。
 * 对于 run：color=顺子颜色，value=序列中缺失的位置
 * 对于 group：color=缺失的颜色，value=群组的数值
 */
function setJokerSub(
  tile: TileInstance,
  sub: JokerSubstitution,
): TileInstance & { jokerSubstitution: JokerSubstitution } {
  return { ...tile, jokerSubstitution: sub };
}

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
      let jokerIdx = 0;
      while (selected.length < 3 && jokerIdx < jokers.length) {
        const missingColor = getMissingColor(selected.map(t => t.color!));
        selected.push(setJokerSub(jokers[jokerIdx], {
          substitutedValue: value as TileValue,
          substitutedColor: missingColor,
        }));
        jokerIdx++;
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
  const jokers: TileInstance[] = [];

  for (const tile of hand) {
    if (isJoker(tile)) {
      jokers.push(tile);
    } else {
      const c = tile.color!;
      if (!byColor.has(c)) byColor.set(c, []);
      byColor.get(c)!.push(tile);
    }
  }

  // 对每种颜色，找连续序列（仅非Joker）
  for (const [_color, tiles] of byColor) {
    const sorted = [...tiles].sort((a, b) => (a.value ?? 0) - (b.value ?? 0));
    if (sorted.length < 2) continue;

    // 滑动窗口找连续段
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 2; j < sorted.length; j++) {
        const segment = sorted.slice(i, j + 1);
        const result = isValidRun(segment);
        if (result.valid) {
          results.push(segment);
        }
      }
    }
  }
}

/**
 * 为一组包含 Joker 的牌计算并设置 Joker 的替代值（针对 run）。
 * 自动确定每个 Joker 应该替代的颜色（顺子颜色）和数值（缺失的位置）。
 */
function computeAndSetJokerSubsForRun(run: TileInstance[]): TileInstance[] {
  const nonJokers = run.filter(t => !isJoker(t));
  if (nonJokers.length === 0) return run; // 全是 Joker，无法确定

  const runColor = nonJokers[0].color!;
  const nonJokerValues = nonJokers.map(t => t.value!).sort((a, b) => a - b);
  const minV = nonJokerValues[0];
  const maxV = nonJokerValues[nonJokerValues.length - 1];

  // 收集 [minV, maxV] 范围内未被非Joker覆盖的数值
  const covered = new Set(nonJokerValues);
  const missingValues: number[] = [];
  for (let v = minV; v <= maxV; v++) {
    if (!covered.has(v)) missingValues.push(v);
  }

  // 如果 Joker 数量多于 gaps，在两端延伸
  const jokerCount = run.filter(t => isJoker(t)).length;
  let extendLow = minV - 1;
  let extendHigh = maxV + 1;
  while (missingValues.length < jokerCount) {
    if (extendLow >= 1) {
      missingValues.unshift(extendLow--);
    } else if (extendHigh <= 13) {
      missingValues.push(extendHigh++);
    } else {
      break;
    }
  }
  missingValues.sort((a, b) => a - b);

  let jIdx = 0;
  return run.map(t => {
    if (!isJoker(t)) return t;
    if (jIdx < missingValues.length) {
      const sub: JokerSubstitution = {
        substitutedValue: missingValues[jIdx] as TileValue,
        substitutedColor: runColor,
      };
      jIdx++;
      return setJokerSub(t, sub);
    }
    return t;
  });
}

/**
 * 找包含 joker 的 runs。
 * 使用真实的手牌 Joker（保留 instanceId），并计算 jokerSubstitution。
 */
function findRunsWithJokers(
  hand: TileInstance[],
  results: TileInstance[][],
): void {
  const jokers = hand.filter(isJoker);
  if (jokers.length === 0) return;

  const nonJokers = hand.filter(t => !isJoker(t));
  const byColor = new Map<string, TileInstance[]>();
  for (const tile of nonJokers) {
    const c = tile.color!;
    if (!byColor.has(c)) byColor.set(c, []);
    byColor.get(c)!.push(tile);
  }

  for (const [_color, tiles] of byColor) {
    const sorted = [...tiles].sort((a, b) => (a.value ?? 0) - (b.value ?? 0));
    if (sorted.length === 0) continue;

    // 记录此颜色已使用的 joker 索引，避免同一张 joker 被多次使用
    let jokerIdx = 0;

    // 对每个连续子段，尝试用 Joker 填充 gaps
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i; j < sorted.length; j++) {
        const segment = sorted.slice(i, j + 1);
        const values = segment.map(t => t.value!);

        if (new Set(values).size !== values.length) continue;

        const minV = Math.min(...values);
        const maxV = Math.max(...values);
        const span = maxV - minV + 1;
        const needed = span - segment.length;
        const extraJokers = jokers.length - needed;

        if (needed < 0) continue;
        if (needed > jokers.length) continue;

        // 基本 run：填充内部 gaps
        if (needed <= jokers.length) {
          const totalLength = span;
          if (totalLength >= 3 && totalLength <= 13) {
            const run = [...segment];
            for (let k = 0; k < needed; k++) {
              run.push(jokers[jokerIdx + k]);
            }
            const withSubs = computeAndSetJokerSubsForRun(run);
            if (isValidRun(withSubs).valid) {
              results.push(withSubs);
            }
          }
        }

        // Joker 在末尾延伸
        if (extraJokers > 0 && span >= 2) {
          if (span + 1 >= 3 && span + 1 <= 13) {
            const run = [...segment];
            for (let k = 0; k < needed + 1; k++) {
              run.push(jokers[jokerIdx + k]);
            }
            const withSubs = computeAndSetJokerSubsForRun(run);
            if (isValidRun(withSubs).valid) {
              results.push(withSubs);
            }
          }
          if (span + 1 >= 3 && span + 1 <= 13 && extraJokers >= 2) {
            const run = [...segment];
            for (let k = 0; k < needed + 2; k++) {
              run.push(jokers[jokerIdx + k]);
            }
            const withSubs = computeAndSetJokerSubsForRun(run);
            if (isValidRun(withSubs).valid) {
              results.push(withSubs);
            }
          }
        }
      }
    }

    // 1张牌 + 2 Jokers
    if (sorted.length >= 1 && jokers.length >= 2) {
      for (const tile of sorted) {
        const run1 = [tile, jokers[0], jokers[1]];
        const withSubs = computeAndSetJokerSubsForRun(run1);
        if (isValidRun(withSubs).valid) results.push(withSubs);
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
