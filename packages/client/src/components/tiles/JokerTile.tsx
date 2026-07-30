import type { TileOnBoard } from '@rummikub/shared';
import { isJoker } from '@rummikub/engine';
import TileFace from './TileFace';

interface JokerTileProps {
  tile: TileOnBoard;
  small?: boolean;
  selected?: boolean;
  hinted?: boolean;
  onClick?: () => void;
  /** 点击 Joker 修改替代值时触发 */
  onChangeSubstitution?: () => void;
}

/**
 * 桌面牌（含 Joker 替换信息）。
 * 如果 Joker 已设置替代值，显示替代后的外观。
 * 如果 Joker 未设置替代值，显示脉动 "?" 提示。
 */
export default function JokerTile({
  tile,
  small,
  selected,
  hinted,
  onClick,
  onChangeSubstitution,
}: JokerTileProps) {
  // Joker 已被替换 → 以替换后的颜色和数值显示，但保持 Joker 角标
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
          selected && 'tile-selected',
          hinted && 'tile-hint',
          'relative',
        ].filter(Boolean).join(' ')}
      >
        <span className="text-lg font-bold leading-tight">{sub.substitutedValue}</span>
        {!small && <span className="text-sm leading-tight">{symbol}</span>}
        {/* Joker 角标 + 修改按钮 */}
        <span
          className="absolute -top-1 -right-1 text-[10px] cursor-pointer"
          title="点击修改替代值"
          onClick={e => {
            e.stopPropagation();
            onChangeSubstitution?.();
          }}
        >
          🃏
        </span>
      </div>
    );
  }

  // Joker 未设置替代值 → 脉动 "?"
  if (isJoker(tile)) {
    return (
      <div
        onClick={onClick}
        className={[
          'tile joker-unset',
          small && 'w-9 h-12 text-sm min-w-[2.25rem]',
          selected && 'tile-selected',
          hinted && 'tile-hint',
          'relative',
        ].filter(Boolean).join(' ')}
      >
        <span className="text-2xl font-bold text-amber-700">?</span>
        {!small && <span className="text-[10px] text-amber-800">Joker</span>}
        <span
          className="absolute -top-1 -right-1 text-[10px] cursor-pointer"
          title="设置替代值"
          onClick={e => {
            e.stopPropagation();
            onChangeSubstitution?.();
          }}
        >
          ✏️
        </span>
      </div>
    );
  }

  return <TileFace tile={tile} small={small} selected={selected} hinted={hinted} onClick={onClick} />;
}
