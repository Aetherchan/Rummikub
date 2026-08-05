/**
 * P2P WebRTC 数据通道消息协议。
 *
 * 方向：
 * - Host → Guest: HostMessage（主机广播给所有客户端）
 * - Guest → Host: ClientMessage（客户端发送给主机）
 */

import type {
  GameState, GameStateDiff, TileInstance,
  PlayerInfo, ScoreEntry, TurnPhase,
} from '@rummikub/shared';
import type { AtomicMove } from '@rummikub/engine';
import type { DataConnection } from 'peerjs';

// ---- Host → Guest ----

export type HostMessage =
  | { type: 'full_state'; gameState: GameState; yourPlayerIndex: number }
  | { type: 'state_update'; diff: GameStateDiff }
  | { type: 'your_hand'; tiles: TileInstance[] }
  | { type: 'turn_changed'; playerIndex: number; phase: TurnPhase }
  | { type: 'game_over'; winnerId: string; scores: ScoreEntry[] }
  | { type: 'room_info'; players: PlayerInfo[]; hostId: string }
  | { type: 'player_left'; playerName: string; reason: string }
  | { type: 'room_closed'; reason: string }
  | { type: 'error'; message: string };

// ---- Guest → Host ----

export type ClientMessage =
  | { type: 'commit_move'; moves: AtomicMove[] }
  | { type: 'draw_tile' }
  | { type: 'pass_turn' };

// ---- Connection state ----

export type P2PConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting';

export interface PeerConnectionInfo {
  peerId: string;
  playerId: string;
  playerName: string;
  connection: DataConnection | null;
  state: P2PConnectionState;
  /** 断线时间戳（用于超时处理） */
  disconnectedAt?: number;
}

/** 重连窗口：2 分钟 */
export const RECONNECT_WINDOW_MS = 2 * 60 * 1000;
