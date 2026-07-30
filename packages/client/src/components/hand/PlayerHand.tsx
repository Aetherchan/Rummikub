import type { TileInstance } from '@rummikub/shared';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import HandTile from './HandTile';

interface PlayerHandProps {
  tiles: TileInstance[];
  selectedTileIds: string[];
  hintedTileIds: string[];
  isCurrentPlayer: boolean;
  onTileClick: (tile: TileInstance) => void;
  onDragStart: (event: DragStartEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onReorder: (activeId: string, overId: string) => void;
}

export default function PlayerHand({
  tiles,
  selectedTileIds,
  hintedTileIds,
  isCurrentPlayer,
  onTileClick,
  onDragStart,
  onDragEnd,
  onReorder,
}: PlayerHandProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    onDragEnd(event);

    const { active, over } = event;
    if (over && active.id !== over.id) {
      onReorder(String(active.id), String(over.id));
    }
  };

  if (tiles.length === 0) {
    return (
      <div className="flex items-center justify-center h-20 text-green-400/60 text-sm italic">
        手牌为空
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={tiles.map(t => `hand-${t.instanceId}`)}
        strategy={horizontalListSortingStrategy}
      >
        <div className="flex flex-wrap gap-1 justify-center px-2 pb-2">
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
    </DndContext>
  );
}
