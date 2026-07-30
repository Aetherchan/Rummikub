import type { SetOnBoard, TileOnBoard } from '@rummikub/shared';
import { useDroppable } from '@dnd-kit/core';
import BoardSetView from './BoardSet';
import TileBack from '../tiles/TileBack';

interface BoardAreaProps {
  boardSets: SetOnBoard[];
  poolTileCount: number;
  selectedTileIds: string[];
  invalidSetIds?: string[];
  onTileClick: (tile: TileOnBoard) => void;
}

export default function BoardArea({
  boardSets,
  poolTileCount,
  selectedTileIds,
  invalidSetIds,
  onTileClick,
}: BoardAreaProps) {
  // 空白桌面区域作为拖放目标（拖牌到此创建新牌组）
  const { setNodeRef: emptyDropRef, isOver } = useDroppable({
    id: 'empty-board',
    data: { type: 'empty-board' },
  });

  return (
    <div className="flex-1 p-4">
      {/* 牌池 */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-1">
          <TileBack small />
          <span className="text-green-300 text-sm ml-2">
            牌池: {poolTileCount} 张
          </span>
        </div>
      </div>

      {/* 桌面组合 */}
      <div className="flex flex-wrap gap-3">
        {boardSets.map(set => (
          <BoardSetView
            key={set.id}
            set={set}
            selectedTileIds={selectedTileIds}
            invalidSetIds={invalidSetIds}
            onTileClick={onTileClick}
          />
        ))}
        {/* 空白拖放区域 */}
        <div
          ref={emptyDropRef}
          className={[
            'board-set border-2 border-dashed rounded-lg min-h-[5rem] min-w-[10rem] flex items-center justify-center transition-colors',
            isOver
              ? 'border-green-400 bg-green-700/30'
              : 'border-green-700/30',
          ].join(' ')}
        >
          {isOver ? (
            <span className="text-green-400 text-sm animate-pulse">在此创建新牌组</span>
          ) : (
            <span className="text-green-700/40 text-xs">拖牌到此处创建新牌组</span>
          )}
        </div>
        {boardSets.length === 0 && (
          <p className="text-green-400/60 text-sm italic">桌面暂无牌组</p>
        )}
      </div>
    </div>
  );
}
