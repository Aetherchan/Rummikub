import type { TileInstance, SetOnBoard } from '@rummikub/shared';
import type { AtomicMove, CreateSetMove, AddTilesMove, RemoveTilesMove, SplitSetMove, MergeSetsMove, DismissSetMove } from './MoveTypes.js';
import { generateInstanceId } from '../tile/Tile.js';

// ============================================================
// MoveDiffer — 对比回合快照与当前状态，自动生成 AtomicMove[]
// ============================================================

/**
 * 对比回合开始时快照和当前状态，生成原子走法序列。
 * 用于玩家自由拖拽后提交时自动构建 AtomicMove[]。
 *
 * @param snapshotBoard 回合开始时的桌面牌组
 * @param currentBoard 当前桌面牌组
 * @param snapshotHand 回合开始时的手牌
 * @param currentHand 当前手牌
 * @returns 原子走法数组
 */
export function diffMoves(
  snapshotBoard: SetOnBoard[],
  currentBoard: SetOnBoard[],
  _snapshotHand?: TileInstance[],
  _currentHand?: TileInstance[],
): AtomicMove[] {
  // 快照桌面为空 → 所有当前牌组都是新创建的
  if (snapshotBoard.length === 0) {
    return currentBoard
      .filter(set => set.tiles.length > 0)
      .map(set => ({
        type: 'CREATE_SET' as const,
        setId: set.id,
        tiles: set.tiles,
      }));
  }

  // 当前桌面为空 → 所有快照牌组都被解散
  if (currentBoard.length === 0) {
    // 将所有牌退回手牌：对每个快照牌组使用 DISMISS_SET
    // 所有牌的 instanceId 来自快照
    return snapshotBoard.map(set => ({
      type: 'DISMISS_SET' as const,
      setId: set.id,
    }));
  }

  // 构建 instanceId → set 的映射
  const snapshotTileToSet = new Map<string, string>();
  const snapshotSetTiles = new Map<string, Set<string>>();
  for (const s of snapshotBoard) {
    const ids = new Set(s.tiles.map(t => t.instanceId));
    snapshotSetTiles.set(s.id, ids);
    for (const t of s.tiles) {
      snapshotTileToSet.set(t.instanceId, s.id);
    }
  }

  const currentTileToSet = new Map<string, string>();
  const currentSetTiles = new Map<string, Set<string>>();
  for (const s of currentBoard) {
    const ids = new Set(s.tiles.map(t => t.instanceId));
    currentSetTiles.set(s.id, ids);
    for (const t of s.tiles) {
      currentTileToSet.set(t.instanceId, s.id);
    }
  }

  // 收集所有 instanceId
  const allInstanceIds = new Set([
    ...snapshotTileToSet.keys(),
    ...currentTileToSet.keys(),
  ]);

  const moves: AtomicMove[] = [];
  const matchedSnapshotSets = new Set<string>();
  const handledInstanceIds = new Set<string>();

  // 对于每个当前牌组，找到最匹配的快照牌组（按重叠 instanceId 数量）
  for (const currSet of currentBoard) {
    const currIds = currentSetTiles.get(currSet.id)!;
    if (currIds.size === 0) continue; // 空牌组跳过

    // 找重叠最多的快照牌组
    let bestSnapshotId: string | null = null;
    let bestOverlap = 0;
    for (const [snapId, snapIds] of snapshotSetTiles) {
      const overlap = [...currIds].filter(id => snapIds.has(id)).length;
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestSnapshotId = snapId;
      }
    }

    if (bestSnapshotId && bestOverlap > 0) {
      matchedSnapshotSets.add(bestSnapshotId);
      const snapIds = snapshotSetTiles.get(bestSnapshotId)!;

      // 检查关系：祖先 + 当前 = ?
      const allSnapTilesInCurr = [...snapIds].every(id => currIds.has(id));
      const allCurrTilesInSnap = [...currIds].every(id => snapIds.has(id));

      if (allSnapTilesInCurr && allCurrTilesInSnap) {
        // 完全相同 → 无操作
        for (const id of currIds) handledInstanceIds.add(id);
        continue;
      }

      if (allSnapTilesInCurr && !allCurrTilesInSnap) {
        // 当前牌组是快照牌组的超集 → ADD_TILES_TO_SET
        const newTiles = currSet.tiles.filter(t => !snapIds.has(t.instanceId));
        for (const id of currIds) handledInstanceIds.add(id);
        if (newTiles.length > 0) {
          moves.push({
            type: 'ADD_TILES_TO_SET',
            setId: currSet.id,
            tiles: newTiles,
          });
        }
        continue;
      }

      if (!allSnapTilesInCurr && allCurrTilesInSnap) {
        // 当前牌组是快照牌组的子集 → REMOVE_TILES_FROM_SET
        const removedIds = [...snapIds].filter(id => !currIds.has(id));
        for (const id of currIds) handledInstanceIds.add(id);
        if (removedIds.length > 0) {
          moves.push({
            type: 'REMOVE_TILES_FROM_SET',
            setId: bestSnapshotId,
            instanceIds: removedIds,
          });
        }
        continue;
      }

      // 部分重叠（既不是超集也不是子集）→ 检查是否是拆分
      // 找另一个也匹配此快照的当前牌组
      const siblingCurrSets = currentBoard.filter(
        s => s.id !== currSet.id && [...currentSetTiles.get(s.id)!].some(id => snapIds.has(id)),
      );

      if (siblingCurrSets.length > 0) {
        // 同一快照被拆分为多个当前牌组 → SPLIT_SET
        // 计算拆分点：在快照牌组中的索引
        // findIndex 返回第一个不在 currIds 中的牌 → 即拆分的边界
        const snapshotTiles = snapshotBoard.find(s => s.id === bestSnapshotId)!.tiles;
        let splitIndex = snapshotTiles.findIndex(t => !currIds.has(t.instanceId));
        // 如果 splitIndex <= 0，说明当前牌组是拆分的尾部（tail），
        // 即它不包含快照的第一张牌。此时从尾部视角重新计算：
        // 找到当前牌组中第一张在快照中出现的牌，即尾部起始位置。
        if (splitIndex <= 0) {
          splitIndex = snapshotTiles.findIndex(t => currIds.has(t.instanceId));
        }
        if (splitIndex > 0 && splitIndex < snapshotTiles.length) {
          for (const id of currIds) handledInstanceIds.add(id);
          for (const sib of siblingCurrSets) {
            for (const id of currentSetTiles.get(sib.id)!) handledInstanceIds.add(id);
          }
          const newSetId = siblingCurrSets[0]?.id ?? generateInstanceId();
          moves.push({
            type: 'SPLIT_SET',
            sourceSetId: bestSnapshotId,
            atIndex: splitIndex,
            newSetId,
          });
          continue;
        }
        // splitIndex 无效（0 或超出范围）→ 回退到非标准重叠处理
      }

      // 非标准重叠 → 回退：移除变化部分 + 重新创建
      const removedIds = [...snapIds].filter(id => !currIds.has(id));
      const addedIds = [...currIds].filter(id => !snapIds.has(id));
      if (removedIds.length > 0) {
        moves.push({
          type: 'REMOVE_TILES_FROM_SET',
          setId: bestSnapshotId,
          instanceIds: removedIds,
        });
      }
      if (addedIds.length > 0) {
        const addedTiles = currSet.tiles.filter(t => addedIds.includes(t.instanceId));
        moves.push({
          type: 'ADD_TILES_TO_SET',
          setId: currSet.id,
          tiles: addedTiles,
        });
      }
      for (const id of currIds) handledInstanceIds.add(id);
      continue;
    }

    // 无匹配快照 → 新牌组（检查是否合并了多个快照牌组）
    const overlappingSnapshots = snapshotBoard.filter(s =>
      [...currentSetTiles.get(currSet.id)!].some(id => snapshotSetTiles.get(s.id)!.has(id)),
    );

    if (overlappingSnapshots.length >= 2) {
      // 多个快照牌团合并成一个 → MERGE_SETS
      for (const sn of overlappingSnapshots) matchedSnapshotSets.add(sn.id);
      for (const id of currIds) handledInstanceIds.add(id);
      const [source, target] = overlappingSnapshots;
      moves.push({
        type: 'MERGE_SETS',
        sourceSetId: source.id,
        targetSetId: target.id,
        position: 'end',
      });
      // 可能还有第三个快照的牌 → ADD
      if (overlappingSnapshots.length > 2) {
        const extraTiles: TileInstance[] = [];
        for (let i = 2; i < overlappingSnapshots.length; i++) {
          for (const t of overlappingSnapshots[i].tiles) {
            if (currIds.has(t.instanceId)) extraTiles.push(t);
          }
        }
        if (extraTiles.length > 0) {
          moves.push({
            type: 'ADD_TILES_TO_SET',
            setId: currSet.id,
            tiles: extraTiles,
          });
        }
      }
      continue;
    }

    // 纯新牌组（所有牌都来自手牌）→ CREATE_SET
    for (const id of currIds) handledInstanceIds.add(id);
    moves.push({
      type: 'CREATE_SET',
      setId: currSet.id,
      tiles: currSet.tiles,
    });
  }

  // 处理完全消失的快照牌组
  for (const snapSet of snapshotBoard) {
    if (matchedSnapshotSets.has(snapSet.id)) continue;
    const snapIds = snapshotSetTiles.get(snapSet.id)!;

    // 检查是否有部分牌被移到其他牌组
    const remainingInCurrent = [...snapIds].some(id => currentTileToSet.has(id));

    if (remainingInCurrent) {
      // 部分牌被移走了 → REMOVE_TILES_FROM_SET
      const removedIds = [...snapIds].filter(id => !currentTileToSet.has(id));
      if (removedIds.length > 0) {
        moves.push({
          type: 'REMOVE_TILES_FROM_SET',
          setId: snapSet.id,
          instanceIds: removedIds,
        });
      }
    } else {
      // 全部回手 → DISMISS_SET
      moves.push({
        type: 'DISMISS_SET',
        setId: snapSet.id,
      });
    }
  }

  // 检查是否有来自手牌的全新 instanceId（不在快照桌面的任何牌组中）
  const newFromHandTiles: TileInstance[] = [];
  for (const currSet of currentBoard) {
    for (const t of currSet.tiles) {
      if (!snapshotTileToSet.has(t.instanceId) && !handledInstanceIds.has(t.instanceId)) {
        newFromHandTiles.push(t);
        handledInstanceIds.add(t.instanceId);
      }
    }
  }

  // 将纯新牌按牌组分组 → ADD_TILES_TO_SET 或 CREATE_SET
  // (已在上面循环中处理，这里处理漏掉的)
  if (newFromHandTiles.length > 0) {
    const bySet = new Map<string, TileInstance[]>();
    for (const t of newFromHandTiles) {
      const setId = currentTileToSet.get(t.instanceId);
      if (setId) {
        if (!bySet.has(setId)) bySet.set(setId, []);
        bySet.get(setId)!.push(t);
      }
    }
    for (const [setId, tiles] of bySet) {
      // 检查是否已有该牌组的 ADD/CREATE
      const alreadyAdded = moves.some(
        m => (m.type === 'ADD_TILES_TO_SET' && m.setId === setId) ||
             (m.type === 'CREATE_SET' && m.setId === setId),
      );
      if (!alreadyAdded && tiles.length > 0) {
        moves.push({
          type: 'ADD_TILES_TO_SET',
          setId,
          tiles,
        });
      }
    }
  }

  // 安全网：如果 ADD_TILES_TO_SET 引用的牌组在快照中不存在，
  // 则该牌组是玩家在操纵过程中新建的，引擎执行时会报 SET_NOT_FOUND。
  // 遇到这种情况直接使用回退策略（DISMISS + CREATE），确保正确性。
  const snapshotSetIds = new Set(snapshotBoard.map(s => s.id));
  const hasAddToNonExistentSet = moves.some(
    m => m.type === 'ADD_TILES_TO_SET' && !snapshotSetIds.has((m as AddTilesMove).setId),
  );
  if (hasAddToNonExistentSet) {
    return fallbackResetRecreate(snapshotBoard, currentBoard);
  }

  // 回退策略：如果同一个快照牌组被多个"破坏性"操作引用（MERGE source、
  // SPLIT source、DISMISS），执行时会因为牌组已被删除而失败。
  // 典型场景：多组拆卸重组成多条顺子，每个新顺子都触发 MERGE 同一对祖先。
  // 遇到这种情况直接使用回退策略，确保正确性。
  const destructiveRefs = new Map<string, number>();
  for (const m of moves) {
    let refId: string | undefined;
    if (m.type === 'MERGE_SETS') refId = (m as MergeSetsMove).sourceSetId;
    else if (m.type === 'SPLIT_SET') refId = (m as SplitSetMove).sourceSetId;
    else if (m.type === 'DISMISS_SET') refId = (m as DismissSetMove).setId;
    if (refId) {
      destructiveRefs.set(refId, (destructiveRefs.get(refId) ?? 0) + 1);
    }
  }
  const hasDestructiveConflict = [...destructiveRefs.values()].some(count => count > 1);
  if (hasDestructiveConflict) {
    return fallbackResetRecreate(snapshotBoard, currentBoard);
  }

  // 回退策略：如果 SPLIT 的源牌组也被其他走法引用，会产生冲突
  // （例如：REMOVE + SPLIT 对同一牌组，REMOVE 先减牌再 SPLIT 导致两部分都不足3张）
  const splitSourceIds = new Set(
    moves.filter(m => m.type === 'SPLIT_SET').map(m => (m as SplitSetMove).sourceSetId),
  );
  if (splitSourceIds.size > 0) {
    const hasConflict = moves.some(m => {
      if (m.type === 'SPLIT_SET') return false;
      const setId = (m as any).setId ?? (m as any).sourceSetId ?? (m as any).targetSetId;
      return setId && splitSourceIds.has(setId);
    });
    if (hasConflict) {
      return fallbackResetRecreate(snapshotBoard, currentBoard);
    }
  }

  // 回退策略：如果生成的走法过多（>12），使用 DISMISS + CREATE 简化
  if (moves.length > 12) {
    return fallbackResetRecreate(snapshotBoard, currentBoard);
  }

  // 对走法排序：归还手牌的操作（DISMISS, REMOVE）必须在取走手牌的操作（ADD, CREATE）之前执行。
  // 否则在"桌面牌移动到另一个牌组"的场景中，ADD 先执行时找不到手牌中的牌（牌还在桌面上），
  // REMOVE 后执行却会把牌退回手牌 → 产生幻影手牌。
  // 排序规则：归还操作 → 拆分/合并 → 取走操作
  const MOVE_ORDER: Record<string, number> = {
    DISMISS_SET: 0,
    REMOVE_TILES_FROM_SET: 1,
    SPLIT_SET: 2,
    MERGE_SETS: 3,
    ADD_TILES_TO_SET: 4,
    CREATE_SET: 5,
  };
  moves.sort((a, b) => MOVE_ORDER[a.type] - MOVE_ORDER[b.type]);

  return moves;
}

/**
 * 回退策略：解散所有变更的快照牌组，创建所有当前牌组。
 * 简单、正确，但不够优雅。
 */
function fallbackResetRecreate(
  snapshotBoard: SetOnBoard[],
  currentBoard: SetOnBoard[],
): AtomicMove[] {
  const moves: AtomicMove[] = [];

  // 解散所有快照牌组
  for (const set of snapshotBoard) {
    if (set.tiles.length > 0) {
      moves.push({
        type: 'DISMISS_SET' as const,
        setId: set.id,
      });
    }
  }

  // 创建所有当前牌组
  for (const set of currentBoard) {
    if (set.tiles.length > 0) {
      moves.push({
        type: 'CREATE_SET' as const,
        setId: set.id,
        tiles: set.tiles,
      });
    }
  }

  return moves;
}
