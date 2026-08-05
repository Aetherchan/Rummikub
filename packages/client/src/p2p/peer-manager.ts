/**
 * PeerJS 连接管理器 — 核心 Peer 生命周期、连接建立与消息收发。
 *
 * 两种使用场景：
 * 1. 主机（Host）：创建 Peer，生成房间码，接受 incoming 连接
 * 2. 客户端（Guest）：创建 Peer，通过房间码连接主机
 *
 * PeerJS 免费云信令服务器：仅用于建立 WebRTC 连接（STUN/TURN），不传输游戏数据。
 * 游戏数据走 WebRTC DataChannel（端到端加密，零服务器传输）。
 */

import Peer, { DataConnection } from 'peerjs';
import type { PeerJSOption } from 'peerjs';
import type { HostMessage, ClientMessage, P2PConnectionState } from './types';

// ---- 常量 ----

/** PeerJS 配置 */
const PEER_CONFIG: PeerJSOption = {
  // 使用 PeerJS 官方免费信令服务器（可根据需要切换）
  // host: '0.peerjs.com', port: 443, secure: true, // 默认
  debug: 0, // 0=off, 1=errors, 2=warnings, 3=all
  config: {
    iceServers: [
      {
        urls: 'turn:39.102.208.49:3478',
        username: 'rummikub',
        credential: 'syt2006Flying',
      },
      // Google STUN 作为备选
      { urls: 'stun:stun.l.google.com:19302' },
    ],
  },
};

/** 生成 6 位房间码（从 peer id 派生） */
export function generateRoomCode(peerId: string): string {
  // 取 peerId 前 6 位（alphanumeric）
  const code = peerId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();
  // 不足 6 位时补齐
  return code.padEnd(6, 'X');
}

// ---- 回调类型 ----

export interface PeerCallbacks {
  /** 主机：收到新客户端连接 */
  onConnection?: (conn: DataConnection, clientId: string) => void;
  /** 主机：客户端断开 */
  onDisconnection?: (clientId: string) => void;
  /** 通用：收到数据通道消息 */
  onData?: (data: HostMessage | ClientMessage, fromId: string) => void;
  /** 通用：Peer 就绪 */
  onReady?: (peerId: string) => void;
  /** 通用：错误 */
  onError?: (error: Error) => void;
  /** 通用：连接状态变更 */
  onStateChange?: (state: P2PConnectionState) => void;
}

// ---- 管理器 ----

export class PeerManager {
  private peer: Peer | null = null;
  private connections = new Map<string, DataConnection>();
  private callbacks: PeerCallbacks;
  private _state: P2PConnectionState = 'disconnected';

  constructor(callbacks: PeerCallbacks = {}) {
    this.callbacks = callbacks;
  }

  get state(): P2PConnectionState {
    return this._state;
  }

  get peerId(): string | null {
    return this.peer?.id ?? null;
  }

  get peerInstance(): Peer | null {
    return this.peer;
  }

  /** 创建 Peer（主机模式：直接初始化） */
  createPeer(peerId?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.setState('connecting');

      if (peerId) {
        this.peer = new Peer(peerId, PEER_CONFIG);
      } else {
        this.peer = new Peer(PEER_CONFIG);
      }

      this.peer.on('open', (id) => {
        this.setState('connected');
        this.callbacks.onReady?.(id);
        resolve(id);
      });

      this.peer.on('error', (err) => {
        this.setState('disconnected');
        this.callbacks.onError?.(err instanceof Error ? err : new Error(String(err)));
        reject(err);
      });

      this.peer.on('disconnected', () => {
        // PeerJS 可能断开信令连接，尝试重连
        this.setState('reconnecting');
        this.peer?.reconnect();
      });

      this.peer.on('close', () => {
        this.setState('disconnected');
      });
    });
  }

  /** 主机：监听 incoming 连接 */
  listenForConnections(): void {
    if (!this.peer) {
      throw new Error('Peer not initialized. Call createPeer() first.');
    }

    this.peer.on('connection', (conn: DataConnection) => {
      this.setupConnection(conn, conn.peer);
      this.connections.set(conn.peer, conn);
      this.callbacks.onConnection?.(conn, conn.peer);
    });
  }

  /** 客户端：连接到主机 */
  connectToHost(hostPeerId: string, metadata?: Record<string, unknown>): Promise<DataConnection> {
    if (!this.peer) {
      return Promise.reject(new Error('Peer not initialized. Call createPeer() first.'));
    }

    return new Promise((resolve, reject) => {
      this.setState('connecting');

      const conn = this.peer!.connect(hostPeerId, {
        reliable: true,
        metadata,
      });

      conn.on('open', () => {
        this.setupConnection(conn, hostPeerId);
        this.connections.set(hostPeerId, conn);
        this.setState('connected');
        resolve(conn);
      });

      conn.on('error', (err) => {
        this.setState('disconnected');
        reject(err instanceof Error ? err : new Error(String(err)));
      });
    });
  }

  /** 发送消息到指定对等端 */
  send(peerId: string, message: HostMessage | ClientMessage): void {
    const conn = this.connections.get(peerId);
    if (!conn || !conn.open) {
      console.warn(`[PeerManager] Cannot send to ${peerId}: connection not open`);
      return;
    }
    conn.send(message);
  }

  /** 广播消息到所有连接的对等端 */
  broadcast(message: HostMessage): void {
    for (const [peerId, conn] of this.connections) {
      if (conn.open) {
        conn.send(message);
      } else {
        console.warn(`[PeerManager] Skip broadcast to ${peerId}: connection closed`);
      }
    }
  }

  /** 断开指定对等端 */
  disconnect(peerId: string): void {
    const conn = this.connections.get(peerId);
    if (conn) {
      conn.close();
      this.connections.delete(peerId);
    }
  }

  /** 销毁 Peer（断开所有连接，释放资源） */
  destroy(): void {
    for (const conn of this.connections.values()) {
      conn.close();
    }
    this.connections.clear();
    this.peer?.destroy();
    this.peer = null;
    this.setState('disconnected');
  }

  /** 获取连接数 */
  get connectionCount(): number {
    return this.connections.size;
  }

  /** 获取所有已连接的 peer IDs */
  get connectedPeerIds(): string[] {
    return Array.from(this.connections.entries())
      .filter(([, conn]) => conn.open)
      .map(([id]) => id);
  }

  // ---- 内部 ----

  private setupConnection(conn: DataConnection, peerId: string): void {
    conn.on('data', (data: unknown) => {
      this.callbacks.onData?.(data as HostMessage | ClientMessage, peerId);
    });

    conn.on('close', () => {
      this.connections.delete(peerId);
      this.callbacks.onDisconnection?.(peerId);
    });

    conn.on('error', (err) => {
      console.error(`[PeerManager] Connection error (${peerId}):`, err);
      this.callbacks.onDisconnection?.(peerId);
    });
  }

  private setState(state: P2PConnectionState): void {
    this._state = state;
    this.callbacks.onStateChange?.(state);
  }
}
