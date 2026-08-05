/**
 * 主机房间管理器 —— 创建房间、管理客户端连接、广播游戏状态。
 *
 * 职责：
 * 1. 创建 Peer + 生成房间码
 * 2. 接受客户端连接，分配 playerId
 * 3. 运行游戏引擎（主机是 authoritative）
 * 4. 广播状态更新给所有客户端
 * 5. 处理客户端断线/重连
 */

import { PeerManager, generateRoomCode } from './peer-manager';
import type { HostMessage, ClientMessage, PeerConnectionInfo, P2PConnectionState } from './types';
import type { DataConnection } from 'peerjs';
import { generateInstanceId, createPlayerState } from '@rummikub/engine';
import type { GameState, PlayerInfo } from '@rummikub/shared';

// ---- 回调 ----

export interface HostRoomCallbacks {
  /** 房间码已生成 */
  onRoomReady?: (roomCode: string, peerId: string) => void;
  /** 有新玩家加入 */
  onPlayerJoined?: (player: PlayerInfo) => void;
  /** 玩家离开 */
  onPlayerLeft?: (playerId: string) => void;
  /** 连接状态变更 */
  onStateChange?: (state: { connections: PeerConnectionInfo[] }) => void;
  /** 收到客户端走法 */
  onClientMove?: (playerId: string, moves: ClientMessage & { type: 'commit_move' }) => void;
  /** 收到客户端摸牌请求 */
  onClientDraw?: (playerId: string) => void;
  /** 收到客户端跳过请求 */
  onClientPass?: (playerId: string) => void;
  /** 房间被解散（有玩家离开） */
  onRoomClosed?: (reason: string) => void;
  /** 错误 */
  onError?: (error: Error) => void;
}

// ---- 管理器 ----

export class HostRoom {
  private manager: PeerManager;
  private roomCode: string = '';
  private _players: Map<string, PlayerInfo> = new Map(); // peerId → PlayerInfo
  private _connections: Map<string, PeerConnectionInfo> = new Map();
  private callbacks: HostRoomCallbacks;
  /** 主机自己的 playerId */
  private _hostPlayerId: string = '';
  /** 最近一次广播的游戏状态（用于重连时发送给客户端） */
  private _lastGameState: GameState | null = null;
  /** 被机器人接管的玩家 peerId → 机器人 playerId */
  private _botTakeovers: Map<string, string> = new Map();
  /** 玩家编号计数器（用于自动命名） */
  private _playerNumberCounter: number = 1;
  /** 房间是否已解散（防止重复触发 onRoomClosed） */
  private _isClosed: boolean = false;

  constructor(callbacks: HostRoomCallbacks = {}) {
    this.callbacks = callbacks;

    this.manager = new PeerManager({
      onConnection: (conn, clientId) => this.handleConnection(conn, clientId),
      onDisconnection: (clientId) => this.handleDisconnection(clientId),
      onData: (data, fromId) => this.handleData(data, fromId),
      onReady: (peerId) => this.handleReady(peerId),
      onError: (err) => this.callbacks.onError?.(err),
      onStateChange: (state) => this.emitConnectionState(state),
    });
  }

  // ---- 公共 API ----

  /** 创建房间 */
  async createRoom(): Promise<{ roomCode: string; peerId: string }> {
    const peerId = await this.manager.createPeer();
    this.manager.listenForConnections();
    return { roomCode: this.roomCode, peerId };
  }

  /** 获取房间码 */
  getRoomCode(): string {
    return this.roomCode;
  }

  /** 获取主机 peerId */
  getHostPeerId(): string {
    return this.manager.peerId ?? '';
  }

  /** 获取所有玩家信息 */
  getPlayers(): PlayerInfo[] {
    return Array.from(this._players.values());
  }

  /** 添加主机玩家。name 为空则使用 "玩家1" */
  addHostPlayer(player: PlayerInfo, displayName?: string): void {
    const key = this.manager.peerId ?? 'host';
    // 如果已存在则只更新名字（避免重复递增计数器）
    const existing = this._players.get(key);
    const name = displayName?.trim() || (existing?.name) || `玩家${this._playerNumberCounter++}`;
    this._hostPlayerId = player.id;
    const namedPlayer: PlayerInfo = { ...player, name };
    this._players.set(key, namedPlayer);
    this._connections.set(key, {
      peerId: key,
      playerId: player.id,
      playerName: name,
      connection: null,
      state: 'connected',
    });
  }

  /** 广播完整游戏状态（每个 Guest 只看到自己的手牌，对手手牌被遮罩） */
  broadcastGameState(gameState: GameState, playerHands?: Map<string, { playerId: string; handTiles: import('@rummikub/shared').TileInstance[] }>): void {
    // 缓存原始状态用于重连
    this._lastGameState = gameState;

    // 对每个连接的客户端发送遮罩后的状态
    for (const [peerId, info] of this._connections) {
      if (peerId === this.manager.peerId) continue; // 跳过主机自己

      const playerInfo = this._players.get(peerId);
      if (!playerInfo) continue;

      const indexInGame = gameState.players.findIndex(p => p.id === playerInfo.id);

      // 为每个 Guest 构建隐私安全的 GameState：
      // 1. 剥离引擎内部 _deck 字段
      // 2. 只保留该 Guest 自己的手牌，其他玩家的 handTiles 置空
      const { _deck, ...cleanState } = gameState as any;
      const maskedState: GameState = {
        ...cleanState,
        players: gameState.players.map(p =>
          p.id === playerInfo.id ? p : { ...p, handTiles: [] },
        ),
      } as GameState;

      const msg: HostMessage = {
        type: 'full_state',
        gameState: maskedState,
        yourPlayerIndex: indexInGame >= 0 ? indexInGame : 0,
      };
      this.manager.send(peerId, msg);
    }
  }

  /** 广播游戏状态差异 */
  broadcastStateUpdate(diff: import('@rummikub/shared').GameStateDiff): void {
    const msg: HostMessage = { type: 'state_update', diff };
    this.manager.broadcast(msg);
  }

  /** 发送手牌给指定玩家 */
  sendHandToPlayer(peerId: string, tiles: import('@rummikub/shared').TileInstance[]): void {
    const msg: HostMessage = { type: 'your_hand', tiles };
    this.manager.send(peerId, msg);
  }

  /** 广播回合变更 */
  broadcastTurnChange(playerIndex: number, phase: import('@rummikub/shared').TurnPhase): void {
    const msg: HostMessage = { type: 'turn_changed', playerIndex, phase };
    this.manager.broadcast(msg);
  }

  /** 广播游戏结束 */
  broadcastGameOver(winnerId: string, scores: import('@rummikub/shared').ScoreEntry[]): void {
    const msg: HostMessage = { type: 'game_over', winnerId, scores };
    this.manager.broadcast(msg);
  }

  /** 广播房间信息 */
  broadcastRoomInfo(): void {
    const msg: HostMessage = {
      type: 'room_info',
      players: this.getPlayers(),
      hostId: this._hostPlayerId,
    };
    this.manager.broadcast(msg);
  }

  /** 发送错误消息给指定对等端 */
  sendError(peerId: string, message: string): void {
    const msg: HostMessage = { type: 'error', message };
    this.manager.send(peerId, msg);
  }

  /** 标记玩家被机器人接管（断线超时后），返回机器人 playerId */
  markBotTakeover(peerId: string, botPlayerId: string): void {
    this._botTakeovers.set(peerId, botPlayerId);
    const conn = this._connections.get(peerId);
    if (conn) {
      conn.state = 'disconnected';
      conn.disconnectedAt = Date.now();
    }
  }

  /** 关闭房间 */
  closeRoom(): void {
    this.manager.destroy();
    this._players.clear();
    this._connections.clear();
    this.roomCode = '';
  }

  /** 获取连接状态 */
  getConnectionStates(): PeerConnectionInfo[] {
    return Array.from(this._connections.values());
  }

  // ---- 内部 ----

  private handleConnection(conn: DataConnection, clientId: string): void {
    // 检查是否是重连（该 peerId 之前已存在）
    const existingConn = this._connections.get(clientId);
    const existingPlayer = this._players.get(clientId);

    if (existingConn && existingPlayer && existingConn.state === 'disconnected') {
      // 重连！恢复连接状态
      existingConn.connection = conn;
      existingConn.state = 'connected';
      existingConn.disconnectedAt = undefined;
      this._connections.set(clientId, existingConn);

      // 如果之前被机器人接管，这里可以通知接管结束
      this._botTakeovers.delete(clientId);

      // 发送房间信息
      this.manager.send(clientId, {
        type: 'room_info',
        players: this.getPlayers(),
        hostId: this._hostPlayerId,
      });

      // 如果游戏已经开始，发送完整状态（遮罩后）
      if (this._lastGameState) {
        const indexInGame = this._lastGameState.players.findIndex(
          p => p.id === existingPlayer.id,
        );
        const { _deck: d, ...cleanState } = this._lastGameState as any;
        const maskedState: GameState = {
          ...cleanState,
          players: this._lastGameState.players.map(p =>
            p.id === existingPlayer.id ? p : { ...p, handTiles: [] },
          ),
        } as GameState;
        this.manager.send(clientId, {
          type: 'full_state',
          gameState: maskedState,
          yourPlayerIndex: indexInGame >= 0 ? indexInGame : 0,
        });
      }

      // 通知 UI 连接状态恢复
      this.emitConnectionState(this.manager.state);
      console.log(`[HostRoom] Client ${clientId} reconnected`);
      return;
    }

    // 全新连接 — 从 metadata 读取玩家自定义名称
    const metadata = (conn as any).metadata as { playerName?: string } | undefined;
    const customName = metadata?.playerName?.trim();
    const playerId = generateInstanceId();
    // 自动命名：自定义名称 > "玩家N"
    const name = customName || `玩家${this._playerNumberCounter++}`;
    const playerInfo: PlayerInfo = {
      id: playerId,
      name,
      isBot: false,
      seat: this._players.size,
    };

    this._players.set(clientId, playerInfo);
    this._connections.set(clientId, {
      peerId: clientId,
      playerId,
      playerName: name,
      connection: conn,
      state: 'connected',
    });

    // 发送欢迎消息（包含房间信息）
    this.manager.send(clientId, {
      type: 'room_info',
      players: this.getPlayers(),
      hostId: this._hostPlayerId,
    });

    this.callbacks.onPlayerJoined?.(playerInfo);
    // 广播更新后的房间信息给所有玩家
    this.broadcastRoomInfo();
    this.emitConnectionState(this.manager.state);
  }

  private handleDisconnection(clientId: string): void {
    // 防止重复触发（关闭多个连接时会多次进入）
    if (this._isClosed) return;
    this._isClosed = true;

    const player = this._players.get(clientId);
    const playerName = player?.name || '未知玩家';

    // 通知所有剩余玩家房间已解散
    const msg: HostMessage = { type: 'room_closed', reason: `${playerName} 离开了房间` };
    this.manager.broadcast(msg);

    // 通知主机 UI
    this.callbacks.onRoomClosed?.(`${playerName} 离开了房间，房间已解散`);

    this.emitConnectionState(this.manager.state);
  }

  private handleData(data: HostMessage | ClientMessage, fromId: string): void {
    const player = this._players.get(fromId);
    if (!player) return;

    switch (data.type) {
      case 'commit_move':
        this.callbacks.onClientMove?.(player.id, data);
        break;
      case 'draw_tile':
        this.callbacks.onClientDraw?.(player.id);
        break;
      case 'pass_turn':
        this.callbacks.onClientPass?.(player.id);
        break;
      default:
        // HostMessage 类型不应该从客户端收到，忽略
        console.warn(`[HostRoom] Unexpected message type from client: ${(data as any).type}`);
    }
  }

  private handleReady(peerId: string): void {
    this.roomCode = generateRoomCode(peerId);
    this.callbacks.onRoomReady?.(this.roomCode, peerId);
  }

  private emitConnectionState(state: P2PConnectionState): void {
    this.callbacks.onStateChange?.({
      connections: this.getConnectionStates(),
    });
  }
}
