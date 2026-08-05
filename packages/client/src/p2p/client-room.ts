/**
 * 客户端房间管理器 —— 加入房间、接收主机状态、发送操作。
 *
 * 职责：
 * 1. 通过房间码找到主机 Peer，建立 WebRTC 连接
 * 2. 接收主机的游戏状态广播
 * 3. 发送玩家的操作给主机
 * 4. 断线重连
 */

import { PeerManager } from './peer-manager';
import type { HostMessage, ClientMessage, P2PConnectionState } from './types';
import type { DataConnection } from 'peerjs';
import type { GameState, PlayerInfo, TileInstance, ScoreEntry, GameStateDiff, TurnPhase } from '@rummikub/shared';
import type { AtomicMove } from '@rummikub/engine';

// ---- 回调 ----

export interface ClientRoomCallbacks {
  /** 已连接到主机 */
  onConnected?: (hostId: string) => void;
  /** 连接断开 */
  onDisconnected?: () => void;
  /** 连接状态变更 */
  onStateChange?: (state: P2PConnectionState) => void;
  /** 收到完整游戏状态 */
  onGameState?: (gameState: GameState, myPlayerIndex: number) => void;
  /** 收到状态更新差异 */
  onStateUpdate?: (diff: GameStateDiff) => void;
  /** 收到自己的手牌 */
  onHandReceived?: (tiles: TileInstance[]) => void;
  /** 回合变更 */
  onTurnChanged?: (playerIndex: number, phase: TurnPhase) => void;
  /** 游戏结束 */
  onGameOver?: (winnerId: string, scores: ScoreEntry[]) => void;
  /** 房间信息更新 */
  onRoomInfo?: (players: PlayerInfo[], hostId: string) => void;
  /** 错误 */
  onError?: (error: Error | string) => void;
}

// ---- 管理器 ----

export class ClientRoom {
  private manager: PeerManager;
  private _hostPeerId: string = '';
  private callbacks: ClientRoomCallbacks;
  private _gameState: GameState | null = null;
  private _myPlayerIndex: number = 0;

  constructor(callbacks: ClientRoomCallbacks = {}) {
    this.callbacks = callbacks;

    this.manager = new PeerManager({
      onData: (data, fromId) => this.handleData(data, fromId),
      onDisconnection: (_clientId) => {
        this.callbacks.onDisconnected?.();
      },
      onReady: () => {}, // 客户端不关心 ready，在 connect 中处理
      onError: (err) => this.callbacks.onError?.(err),
      onStateChange: (state) => this.callbacks.onStateChange?.(state),
  });
  }

  // ---- 公共 API ----

  /** 通过房间码加入房间
   *  房间码是 6 位，需要还原为 hostPeerId。
   *  由于 PeerJS 的 peer id 不一定是 6 位，这里简化处理：
   *  主机创建房间时，会把自己的 peerId 包含在 roomCode 中。
   *  实际上需要额外的轻量信令来解析 roomCode → hostPeerId。
   *
   *  简化方案：主机把完整的 peerId 作为 "房间码" 发送给客户端。
   *  对于短码，使用 PeerJS 的 connect 通过已知 peerId 连接。
   */
  async joinRoom(hostPeerId: string): Promise<void> {
    this._hostPeerId = hostPeerId;

    // 客户端创建自己的 Peer
    await this.manager.createPeer();

    // 连接到主机
    const conn = await this.manager.connectToHost(hostPeerId);
    this.callbacks.onConnected?.(hostPeerId);
  }

  /** 发送走法给主机 */
  sendMove(moves: AtomicMove[]): void {
    const msg: ClientMessage = { type: 'commit_move', moves };
    this.manager.send(this._hostPeerId, msg);
  }

  /** 请求摸牌 */
  sendDrawTile(): void {
    const msg: ClientMessage = { type: 'draw_tile' };
    this.manager.send(this._hostPeerId, msg);
  }

  /** 请求跳过 */
  sendPassTurn(): void {
    const msg: ClientMessage = { type: 'pass_turn' };
    this.manager.send(this._hostPeerId, msg);
  }

  /** 获取当前已知的游戏状态 */
  getGameState(): GameState | null {
    return this._gameState;
  }

  /** 获取我的玩家索引 */
  getMyPlayerIndex(): number {
    return this._myPlayerIndex;
  }

  /** 获取主机 peerId */
  getHostPeerId(): string {
    return this._hostPeerId;
  }

  /** 获取自己的 peerId */
  getMyPeerId(): string | null {
    return this.manager.peerId;
  }

  /** 断开连接 */
  disconnect(): void {
    this.manager.destroy();
    this._gameState = null;
  }

  /** 是否已连接 */
  get isConnected(): boolean {
    return this.manager.state === 'connected';
  }

  /** 获取连接状态 */
  get connectionState(): P2PConnectionState {
    return this.manager.state;
  }

  // ---- 内部 ----

  private handleData(data: HostMessage | ClientMessage, fromId: string): void {
    // 客户端只处理 HostMessage
    const msg = data as HostMessage;

    switch (msg.type) {
      case 'full_state':
        this._gameState = msg.gameState;
        this._myPlayerIndex = msg.yourPlayerIndex;
        this.callbacks.onGameState?.(msg.gameState, msg.yourPlayerIndex);
        break;

      case 'state_update':
        this.callbacks.onStateUpdate?.(msg.diff);
        // 将 diff 应用到本地乐观状态
        if (this._gameState) {
          this.applyDiff(this._gameState, msg.diff);
        }
        break;

      case 'your_hand':
        this.callbacks.onHandReceived?.(msg.tiles);
        break;

      case 'turn_changed':
        this.callbacks.onTurnChanged?.(msg.playerIndex, msg.phase);
        break;

      case 'game_over':
        this.callbacks.onGameOver?.(msg.winnerId, msg.scores);
        break;

      case 'room_info':
        this.callbacks.onRoomInfo?.(msg.players, msg.hostId);
        break;

      case 'error':
        this.callbacks.onError?.(msg.message);
        break;

      default:
        console.warn(`[ClientRoom] Unknown message type: ${(msg as any).type}`);
    }
  }

  /** 将 GameStateDiff 应用到本地 GameState（乐观更新） */
  private applyDiff(state: GameState, diff: GameStateDiff): void {
    state.currentPlayerIndex = diff.currentPlayerIndex;
    state.turnPhase = diff.turnPhase;
    state.poolTileCount = diff.poolTileCount;

    if (diff.lastMove) {
      state.lastMove = diff.lastMove;
    }

    if (diff.winner) {
      state.winner = diff.winner;
    }

    if (diff.playerMelded) {
      const player = state.players.find(p => p.id === diff.playerMelded);
      if (player) player.hasMelded = true;
    }

    // 应用棋盘变更
    // 注意：这是浅层更新，实际应该用 Immer 或不可变方式
    // 但作为客户端乐观更新，这里保持简洁
  }
}
