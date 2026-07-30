import type { TileInstance } from '@rummikub/shared';
import { isJoker } from '@rummikub/engine';

interface TileFaceProps {
  tile: TileInstance;
  selected?: boolean;
  hinted?: boolean;
  small?: boolean;
  onClick?: () => void;
}

export default function TileFace({ tile, selected, hinted, small, onClick }: TileFaceProps) {
  if (isJoker(tile)) {
    return (
      <div
        onClick={onClick}
        className={[
          'tile tile-joker',
          small && 'w-9 h-12 text-sm min-w-[2.25rem]',
          selected && 'tile-selected',
          hinted && 'tile-hint',
        ].filter(Boolean).join(' ')}
      >
        <span className="text-xl">{small ? '😜' : '🃏'}</span>
        {!small && <span className="text-[10px]">Joker</span>}
      </div>
    );
  }

  const color = tile.color!;
  const colorClass = `tile-${color}`;
  const symbols: Record<string, string> = { red: '♥', blue: '♦', yellow: '☀', black: '♠' };
  const colorSymbol = symbols[color] ?? '?';

  return (
    <div
      onClick={onClick}
      className={[
        'tile',
        colorClass,
        small && 'w-9 h-12 text-sm min-w-[2.25rem]',
        selected && 'tile-selected',
        hinted && 'tile-hint',
      ].filter(Boolean).join(' ')}
    >
      <span className="text-lg font-bold leading-tight">{tile.value}</span>
      {!small && <span className="text-sm leading-tight">{colorSymbol}</span>}
    </div>
  );
}
