import type { TileInstance, SetId } from '@rummikub/shared';
/** 向已有组合添加牌 */
export interface AddTilesMove {
    type: 'ADD_TILES_TO_SET';
    setId: SetId;
    tiles: TileInstance[];
}
/** 从组合中移除牌 */
export interface RemoveTilesMove {
    type: 'REMOVE_TILES_FROM_SET';
    setId: SetId;
    instanceIds: string[];
}
/** 拆分组合 */
export interface SplitSetMove {
    type: 'SPLIT_SET';
    sourceSetId: SetId;
    /** 拆分点索引：前 atIndex 张牌留在原组，其余移到新组 */
    atIndex: number;
    /** 新组合 ID */
    newSetId: SetId;
}
/** 合并两个组合 */
export interface MergeSetsMove {
    type: 'MERGE_SETS';
    sourceSetId: SetId;
    targetSetId: SetId;
    /** 源组插入到目标组的位置 */
    position: 'start' | 'end';
}
/** 创建新组合 */
export interface CreateSetMove {
    type: 'CREATE_SET';
    /** 新组合 ID */
    setId: SetId;
    tiles: TileInstance[];
}
/** 解散组合（将牌退回手牌） */
export interface DismissSetMove {
    type: 'DISMISS_SET';
    setId: SetId;
}
/** 原子走法联合类型 */
export type AtomicMove = AddTilesMove | RemoveTilesMove | SplitSetMove | MergeSetsMove | CreateSetMove | DismissSetMove;
/** 走法批次：玩家一次提交的所有原子操作 */
export interface MoveBatch {
    /** 批次 ID（用于确认） */
    moveId: string;
    /** 执行走法的玩家 */
    playerId: string;
    /** 原子操作列表 */
    moves: AtomicMove[];
}
//# sourceMappingURL=MoveTypes.d.ts.map