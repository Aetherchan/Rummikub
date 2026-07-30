import type { TileInstance } from '@rummikub/shared';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import HandTile from './HandTile';

interface PlayerHandProps {
  tiles: TileInstance[];
  selectedTileIds: string[];
  hintedTileIds: string[];
  isCurrentPlayer: boolean;
  onTileClick: (tile: TileInstance) => void;
}

export default function PlayerHand({
  tiles,
  selectedTileIds,
  hintedTileIds,
  isCurrentPlayer,
  onTileClick,
}: PlayerHandProps) {
  // 手牌区作为拖放目标（桌面牌可以拖回手牌）
  const { setNodeRef: dropRef, isOver } = useDroppable({
    id: 'hand-area',
    data: { type: 'hand-area' },
  });

  if (tiles.length === 0) {
    return (
      <div className="flex items-center justify-center h-20 text-green-400/60 text-sm italic">
        手牌为空
      </div>
    );
  }

  return (
    <SortableContext
      items={tiles.map(t => `hand-${t.instanceId}`)}
      strategy={horizontalListSortingStrategy}
    >
      <div
        ref={dropRef}
        className={[
          'flex flex-wrap gap-1 justify-center px-2 pb-2 min-h-[5rem] rounded-lg transition-colors',
          isOver && 'bg-green-600/30 border-2 border-dashed border-green-400',
        ].filter(Boolean).join(' ')}
      >
        {tiles.map((tile, index) => (
          <HandTile
            key={tile.instanceId}
            tile={tile}
            index={index}
            selected={selectedTileIds.includes(tile.instanceId)}
            hinted={hintedTileIds.includes(tile.instanceId)}
            isCurrentPlayer={isCurrentPlayer}
            onTileClick={onTileClick}
          />
        ))}
      </div>
    </SortableContext>
  );
}
