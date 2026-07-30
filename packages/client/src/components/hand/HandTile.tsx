import type { TileInstance } from '@rummikub/shared';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import TileFace from '../tiles/TileFace';

interface HandTileProps {
  tile: TileInstance;
  index: number;
  selected: boolean;
  hinted: boolean;
  isCurrentPlayer: boolean;
  onTileClick: (tile: TileInstance) => void;
}

export default function HandTile({
  tile,
  index,
  selected,
  hinted,
  isCurrentPlayer,
  onTileClick,
}: HandTileProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `hand-${tile.instanceId}`,
    data: { tile, index, isHandTile: true },
    disabled: !isCurrentPlayer,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      <TileFace
        tile={tile}
        selected={selected}
        hinted={hinted}
        onClick={() => isCurrentPlayer && onTileClick(tile)}
      />
    </div>
  );
}
