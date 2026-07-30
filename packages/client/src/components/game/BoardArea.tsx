import type { SetOnBoard, TileOnBoard } from '@rummikub/shared';
import BoardSetView from './BoardSet';
import TileBack from '../tiles/TileBack';

interface BoardAreaProps {
  boardSets: SetOnBoard[];
  poolTileCount: number;
  selectedTileIds: string[];
  onTileClick: (tile: TileOnBoard) => void;
}

export default function BoardArea({
  boardSets,
  poolTileCount,
  selectedTileIds,
  onTileClick,
}: BoardAreaProps) {
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
            onTileClick={onTileClick}
          />
        ))}
        {boardSets.length === 0 && (
          <p className="text-green-400/60 text-sm italic">桌面暂无牌组</p>
        )}
      </div>
    </div>
  );
}
