/**
 * P2P 模块 —— 统一入口。
 */

export { PeerManager, generateRoomCode } from './peer-manager';
export type { PeerCallbacks } from './peer-manager';

export { HostRoom } from './host-room';
export type { HostRoomCallbacks } from './host-room';

export { ClientRoom } from './client-room';
export type { ClientRoomCallbacks } from './client-room';

export type {
  HostMessage,
  ClientMessage,
  P2PConnectionState,
  PeerConnectionInfo,
} from './types';
export { RECONNECT_WINDOW_MS } from './types';
