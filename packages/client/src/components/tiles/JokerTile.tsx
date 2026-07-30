import type { TileOnBoard } from '@rummikub/shared';
import { isJoker } from '@rummikub/engine';
import TileFace from './TileFace';

interface JokerTileProps {
  tile: TileOnBoard;
  small?: boolean;
  onClick?: () => void;
}

/**
 * 桌面牌（含 Joker 替换信息）。
 * 如果 Joker 被替换为特定颜色/数值，显示替换后的外观。
 */
export default function JokerTile({ tile, small, onClick }: JokerTileProps) {
  // Joker 已被替换 → 以替换后的颜色和数值显示，但保持 Joker 标记
  if (isJoker(tile) && tile.jokerSubstitution) {
    const sub = tile.jokerSubstitution;
    const colorClass = `tile-${sub.substitutedColor}`;
    const colorSymbol: Record<string, string> = { red: '♥', blue: '♦', yellow: '☀', black: '♠' };
    const symbol = colorSymbol[sub.substitutedColor] ?? '?';

    return (
      <div
        onClick={onClick}
        className={[
          'tile',
          colorClass,
          small && 'w-9 h-12 text-sm min-w-[2.25rem]',
          'relative',
        ].filter(Boolean).join(' ')}
      >
        <span className="text-lg font-bold leading-tight">{sub.substitutedValue}</span>
        {!small && <span className="text-sm leading-tight">{symbol}</span>}
        {/* Joker 角标 */}
        <span className="absolute -top-1 -right-1 text-[10px]">🃏</span>
      </div>
    );
  }

  return <TileFace tile={tile} small={small} onClick={onClick} />;
}
