import { useState } from 'react';
import type { TileInstance, TileColor, TileValue, JokerSubstitution } from '@rummikub/shared';

interface JokerPickerProps {
  tile: TileInstance;
  onConfirm: (substitution: JokerSubstitution) => void;
  onCancel: () => void;
}

const COLORS: { value: TileColor; label: string; symbol: string; cssClass: string }[] = [
  { value: 'red', label: '红色', symbol: '♥', cssClass: 'tile-red' },
  { value: 'blue', label: '蓝色', symbol: '♦', cssClass: 'tile-blue' },
  { value: 'yellow', label: '黄色', symbol: '☀', cssClass: 'tile-yellow' },
  { value: 'black', label: '黑色', symbol: '♠', cssClass: 'tile-black' },
];

const VALUES: TileValue[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

export default function JokerPicker({ tile, onConfirm, onCancel }: JokerPickerProps) {
  const [selectedColor, setSelectedColor] = useState<TileColor | null>(null);
  const [selectedValue, setSelectedValue] = useState<TileValue | null>(null);

  const canConfirm = selectedColor !== null && selectedValue !== null;

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm({
      substitutedValue: selectedValue!,
      substitutedColor: selectedColor!,
    });
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content animate-scale-up" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-yellow-300 mb-4 text-center">
          🃏 设置百搭牌替代
        </h2>

        {/* 预览 */}
        <div className="flex justify-center mb-4">
          {canConfirm ? (
            <div className={`tile ${COLORS.find(c => c.value === selectedColor)?.cssClass ?? ''} w-16 h-20 text-lg`}>
              <span className="text-2xl font-bold">{selectedValue}</span>
              <span>{COLORS.find(c => c.value === selectedColor)?.symbol}</span>
              <span className="absolute -top-1 -right-1 text-[10px]">🃏</span>
            </div>
          ) : (
            <div className="tile tile-joker w-16 h-20 text-lg animate-hint-pulse">
              <span className="text-2xl">?</span>
              <span className="text-xs">Joker</span>
            </div>
          )}
        </div>

        {/* 颜色选择 */}
        <div className="mb-4">
          <p className="text-green-300 text-sm mb-2">选择颜色：</p>
          <div className="flex gap-2 justify-center">
            {COLORS.map(c => (
              <button
                key={c.value}
                onClick={() => setSelectedColor(c.value)}
                className={[
                  'w-14 h-14 rounded-xl border-2 flex flex-col items-center justify-center transition-all',
                  c.cssClass,
                  selectedColor === c.value
                    ? 'ring-4 ring-white scale-110'
                    : 'opacity-70 hover:opacity-100 hover:scale-105',
                ].join(' ')}
              >
                <span className="text-lg">{c.symbol}</span>
                <span className="text-[10px]">{c.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 数值选择 */}
        <div className="mb-6">
          <p className="text-green-300 text-sm mb-2">选择数值：</p>
          <div className="grid grid-cols-7 gap-1">
            {VALUES.map(v => (
              <button
                key={v}
                onClick={() => setSelectedValue(v)}
                className={[
                  'w-10 h-10 rounded-lg border text-sm font-bold transition-all',
                  selectedValue === v
                    ? 'bg-yellow-400 border-yellow-200 text-yellow-900 scale-110 ring-2 ring-yellow-200'
                    : 'bg-green-700 border-green-600 text-green-200 hover:bg-green-600',
                ].join(' ')}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* 按钮 */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-lg border border-green-600 text-green-300 hover:bg-green-700 transition"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={[
              'flex-1 py-2 rounded-lg font-bold transition',
              canConfirm
                ? 'bg-yellow-500 text-yellow-900 hover:bg-yellow-400'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed',
            ].join(' ')}
          >
            确认
          </button>
        </div>
      </div>
    </div>
  );
}
