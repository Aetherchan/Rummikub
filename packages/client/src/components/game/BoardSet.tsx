import type { SetOnBoard, TileOnBoard } from '@rummikub/shared';
import { useDroppable } from '@dnd-kit/core';
import JokerTile from '../tiles/JokerTile';

interface BoardSetProps {
  set: SetOnBoard;
  selectedTileIds: string[];
  onTileClick: (tile: TileOnBoard) => void;
}

export default function BoardSetView({ set, selectedTileIds, onTileClick }: BoardSetProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `board-set-${set.id}`,
    data: { setId: set.id, isBoardSet: true },
  });

  const typeLabel = set.type === 'group' ? '群组' : '顺子';

  // 顺子按数值从小到大排列；群组也排一下便于阅读
  const sortedTiles = [...set.tiles].sort((a, b) => {
    const va = a.jokerSubstitution?.substitutedValue ?? a.value ?? 0;
    const vb = b.jokerSubstitution?.substitutedValue ?? b.value ?? 0;
    return va - vb;
  });

  return (
    <div
      ref={setNodeRef}
      className={['board-set', isOver && 'board-set-droppable'].filter(Boolean).join(' ')}
    >
      <span className="text-green-400 text-xs mr-1 font-mono">{typeLabel}</span>
      {sortedTiles.map(tile => (
        <JokerTile
          key={tile.instanceId}
          tile={tile}
          small={sortedTiles.length > 6}
          selected={selectedTileIds.includes(tile.instanceId)}
          onClick={() => onTileClick(tile)}
        />
      ))}
    </div>
  );
}
