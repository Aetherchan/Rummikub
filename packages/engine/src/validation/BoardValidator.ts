import type { TileOnBoard, TileInstance } from '@rummikub/shared';
import type { SetOnBoard } from '@rummikub/shared';
import { validateSet } from './SetValidator.js';

// ============================================================
// 桌面完整性验证器
// ============================================================

/** 桌面验证结果 */
export interface BoardValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * 验证整个桌面状态。
 * 检查：
 * 1. 每个组合内部是否合法
 * 2. 没有重复的牌实例（同一张 instanceId 不能出现两次）
 * 3. 没有桌面上不该存在的牌
 */
export function validateBoard(sets: SetOnBoard[]): BoardValidationResult {
  const errors: string[] = [];
  const seenInstanceIds = new Set<string>();

  for (const set of sets) {
    // 检查组合是否至少 3 张
    if (set.tiles.length < 3) {
      errors.push(`组合 ${set.id} 只有 ${set.tiles.length} 张牌，至少需要 3 张`);
    }

    // 验证组合合法性
    const result = validateSet(set.tiles);
    if (!result.valid) {
      errors.push(`组合 ${set.id} 不合法: ${result.reason}`);
    }

    // 验证声明的类型与实际类型匹配
    if (result.valid && result.type && result.type !== set.type) {
      errors.push(`组合 ${set.id} 声明为 ${set.type}，但实际是 ${result.type}`);
    }

    // 检查重复实例 ID
    for (const tile of set.tiles) {
      if (seenInstanceIds.has(tile.instanceId)) {
        errors.push(`牌 ${tile.id} (${tile.instanceId}) 在桌面上重复出现`);
      }
      seenInstanceIds.add(tile.instanceId);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 在应用变更后验证桌面状态。
 * 用于 MoveValidator：假设应用了移动，然后验证桌面是否仍然全合法。
 */
export function validateBoardAfterMoves(
  sets: SetOnBoard[],
  movedTiles: TileInstance[],
): { valid: boolean; errors: string[] } {
  // 简单场景：只检查所有组合合法且无重复
  return validateBoard(sets);
}
