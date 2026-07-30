/**
 * 多人模式大厅 —— 选择创建或加入房间。
 */

interface MultiplayerLobbyProps {
  onHostRoom: () => void;
  onJoinRoom: () => void;
  onBack: () => void;
}

export default function MultiplayerLobby({
  onHostRoom, onJoinRoom, onBack,
}: MultiplayerLobbyProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <button
        onClick={onBack}
        className="absolute top-4 left-4 text-green-300 hover:text-white transition text-sm"
      >
        ← 返回
      </button>

      <h1 className="text-5xl font-bold mb-2 text-blue-300 drop-shadow-lg">
        🌐 多人联机
      </h1>
      <p className="text-green-300 mb-8 text-lg">P2P WebRTC · 零服务器成本</p>

      <div className="flex flex-col gap-4 w-full max-w-sm">
        <button
          onClick={onHostRoom}
          className="w-full py-4 bg-blue-500 hover:bg-blue-400 text-white
                     font-bold text-xl rounded-2xl transition shadow-xl"
        >
          🏠 创建房间
        </button>
        <button
          onClick={onJoinRoom}
          className="w-full py-4 bg-green-600 hover:bg-green-500 text-white
                     font-bold text-xl rounded-2xl transition shadow-xl"
        >
          🚪 加入房间
        </button>
      </div>

      <div className="mt-10 max-w-sm text-center text-green-400 text-sm space-y-1">
        <p>创建房间 → 获取房间码 → 分享给朋友 → 开始对战</p>
        <p className="text-green-600">提示：主机断线会导致游戏中断</p>
      </div>
    </div>
  );
}
