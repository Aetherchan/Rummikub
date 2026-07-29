import type { TileInstance } from '@rummikub/shared';
import { DECK_CONFIG } from '@rummikub/shared';
import { tileId, createTileInstance } from './Tile.js';

// ============================================================
// 牌组 —— 创建、洗牌、摸牌
// ============================================================

/** 创建完整的 106 张标准牌组 */
export function createDeck(): TileInstance[] {
  const tiles: TileInstance[] = [];

  for (const color of DECK_CONFIG.colors) {
    for (let value = DECK_CONFIG.minValue; value <= DECK_CONFIG.maxValue; value++) {
      // 每种颜色-数值组合有 2 份
      for (let copy = 0; copy < DECK_CONFIG.copiesPerTile; copy++) {
        tiles.push(createTileInstance({
          id: tileId(color, value),
          color,
          value: value as (1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13),
        }));
      }
    }
  }

  // 添加 2 张百搭牌
  for (let i = 0; i < DECK_CONFIG.jokerCount; i++) {
    tiles.push(createTileInstance({
      id: `joker-${i + 1}`,
      color: null,
      value: null,
    }));
  }

  return tiles;
}

/** Fisher-Yates 洗牌算法 */
export function shuffleDeck(tiles: TileInstance[]): TileInstance[] {
  const shuffled = [...tiles];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/** 从牌池中摸牌 */
export function drawTiles(deck: TileInstance[], count: number): { drawn: TileInstance[]; remaining: TileInstance[] } {
  const drawn = deck.slice(0, count);
  const remaining = deck.slice(count);
  return { drawn, remaining };
}

/** 从牌池中摸一张牌 */
export function drawOneTile(deck: TileInstance[]): { tile: TileInstance | null; remaining: TileInstance[] } {
  if (deck.length === 0) return { tile: null, remaining: deck };
  return { tile: deck[0], remaining: deck.slice(1) };
}
