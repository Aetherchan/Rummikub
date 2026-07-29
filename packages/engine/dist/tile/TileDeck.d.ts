import type { TileInstance } from '@rummikub/shared';
/** 创建完整的 106 张标准牌组 */
export declare function createDeck(): TileInstance[];
/** Fisher-Yates 洗牌算法 */
export declare function shuffleDeck(tiles: TileInstance[]): TileInstance[];
/** 从牌池中摸牌 */
export declare function drawTiles(deck: TileInstance[], count: number): {
    drawn: TileInstance[];
    remaining: TileInstance[];
};
/** 从牌池中摸一张牌 */
export declare function drawOneTile(deck: TileInstance[]): {
    tile: TileInstance | null;
    remaining: TileInstance[];
};
//# sourceMappingURL=TileDeck.d.ts.map