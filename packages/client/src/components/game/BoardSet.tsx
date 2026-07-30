import type { SetOnBoard, TileOnBoard } from '@rummikub/shared';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import JokerTile from '../tiles/JokerTile';

interface BoardSetProps {
  set: SetOnBoard;
  selectedTileIds: string[];
  invalidSetIds?: string[];
  onTileClick: (tile: TileOnBoard) => void;
  onJokerEdit?: (tile: TileOnBoard) => void;
}

/** 可拖拽的桌面牌 */
function DraggableBoardTile({
  tile,
  setId,
  isSmall,
  selected,
  onClick,
  onChangeSubstitution,
}: {
  tile: TileOnBoard;
  setId: string;
  isSmall: boolean;
  selected: boolean;
  onClick: () => void;
  onChangeSubstitution?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `board-${tile.instanceId}`,
    data: { tile, instanceId: tile.instanceId, setId, isHandTile: false },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <JokerTile
        tile={tile}
        small={isSmall}
        selected={selected}
        onClick={onClick}
        onChangeSubstitution={onChangeSubstitution}
      />
    </div>
  );
}

export default function BoardSetView({
  set,
  selectedTileIds,
  invalidSetIds,
  onTileClick,
  onJokerEdit,
}: BoardSetProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `board-set-${set.id}`,
    data: { type: 'board-set', setId: set.id, isBoardSet: true },
  });

  const typeLabel = set.type === 'group' ? '群组' : '顺子';
  const isInvalid = invalidSetIds?.includes(set.id);
  const isTemp = set.tiles.length < 3;

  // 顺子按数值从小到大排列；群组也排一下便于阅读
  const sortedTiles = [...set.tiles].sort((a, b) => {
    const va = a.jokerSubstitution?.substitutedValue ?? a.value ?? 0;
    const vb = b.jokerSubstitution?.substitutedValue ?? b.value ?? 0;
    return va - vb;
  });

  return (
    <div
      ref={setNodeRef}
      className={[
        'board-set',
        isOver && 'board-set-droppable',
        isInvalid && 'board-set-invalid animate-shake',
        isTemp && !isInvalid && 'board-set-temp',
      ].filter(Boolean).join(' ')}
    >
      <div className="flex items-center gap-1">
        <span className={[
          'text-xs mr-1 font-mono',
          isInvalid ? 'text-red-400' : isTemp ? 'text-orange-400' : 'text-green-400',
        ].join(' ')}>
          {typeLabel}
          {isTemp && ` (${set.tiles.length}张)`}
        </span>
        {sortedTiles.map(tile => (
          <DraggableBoardTile
            key={tile.instanceId}
            tile={tile}
            setId={set.id}
            isSmall={sortedTiles.length > 6}
            selected={selectedTileIds.includes(tile.instanceId)}
            onClick={() => onTileClick(tile)}
            onChangeSubstitution={onJokerEdit ? () => onJokerEdit(tile) : undefined}
          />
        ))}
      </div>
    </div>
  );
}
