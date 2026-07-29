import type { TileColor, TileValue, TileDefinition, TileInstance, InstanceId } from '@rummikub/shared';
import { DECK_CONFIG } from '@rummikub/shared';

// ============================================================
// 牌的工具函数
// ============================================================

/** 创建牌的模板 ID（如 "red-7"、"joker-1"） */
export function tileId(color: TileColor | null, value: TileValue | null): string {
  if (color === null || value === null) return 'joker';
  return `${color}-${value}`;
}

/** 判断两张牌是否为同一模板（同色同值） */
export function isSameDefinition(a: TileDefinition, b: TileDefinition): boolean {
  return a.id === b.id;
}

/** 获取牌的分数值（joker 在手中记 30 分） */
export function tileScore(tile: TileDefinition | TileInstance): number {
  if (tile.value === null) return 30; // joker
  return tile.value;
}

/** 生成唯一实例 ID（UUID v4 格式） */
export function generateInstanceId(): InstanceId {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** 从模板创建牌实例 */
export function createTileInstance(definition: TileDefinition, instanceId?: InstanceId): TileInstance {
  return {
    ...definition,
    instanceId: instanceId ?? generateInstanceId(),
  };
}

/** 按颜色排序 */
export function compareByColor(a: TileDefinition, b: TileDefinition): number {
  if (a.color === null && b.color === null) return 0;
  if (a.color === null) return 1;
  if (b.color === null) return -1;
  const order = DECK_CONFIG.colors.indexOf(a.color as typeof DECK_CONFIG.colors[number])
    - DECK_CONFIG.colors.indexOf(b.color as typeof DECK_CONFIG.colors[number]);
  if (order !== 0) return order;
  return (a.value ?? 0) - (b.value ?? 0);
}

/** 按数值排序 */
export function compareByValue(a: TileDefinition, b: TileDefinition): number {
  return (a.value ?? 0) - (b.value ?? 0);
}

/** 按颜色优先然后数值排序 */
export function sortTiles(tiles: TileInstance[]): TileInstance[] {
  return [...tiles].sort((a, b) => {
    const colorCmp = compareByColor(a, b);
    if (colorCmp !== 0) return colorCmp;
    return compareByValue(a, b);
  });
}
