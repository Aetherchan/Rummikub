import type { TileColor, TileValue, TileDefinition, TileInstance, InstanceId } from '@rummikub/shared';
/** 创建牌的模板 ID（如 "red-7"、"joker-1"） */
export declare function tileId(color: TileColor | null, value: TileValue | null): string;
/** 判断两张牌是否为同一模板（同色同值） */
export declare function isSameDefinition(a: TileDefinition, b: TileDefinition): boolean;
/** 获取牌的分数值（joker 在手中记 30 分） */
export declare function tileScore(tile: TileDefinition | TileInstance): number;
/** 生成唯一实例 ID（UUID v4 格式） */
export declare function generateInstanceId(): InstanceId;
/** 从模板创建牌实例 */
export declare function createTileInstance(definition: TileDefinition, instanceId?: InstanceId): TileInstance;
/** 按颜色排序 */
export declare function compareByColor(a: TileDefinition, b: TileDefinition): number;
/** 按数值排序 */
export declare function compareByValue(a: TileDefinition, b: TileDefinition): number;
/** 按颜色优先然后数值排序 */
export declare function sortTiles(tiles: TileInstance[]): TileInstance[];
//# sourceMappingURL=Tile.d.ts.map