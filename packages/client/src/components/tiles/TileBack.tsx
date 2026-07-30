interface TileBackProps {
  small?: boolean;
}

/** 牌背——显示牌池中剩余的牌 */
export default function TileBack({ small }: TileBackProps) {
  return (
    <div
      className={[
        'rounded-lg border-2 border-green-500 bg-green-700 shadow-md',
        'flex items-center justify-center',
        small ? 'w-9 h-12 min-w-[2.25rem]' : 'w-12 h-16 min-w-[3rem]',
      ].join(' ')}
    >
      <span className={small ? 'text-xs' : 'text-sm'}>🎴</span>
    </div>
  );
}
