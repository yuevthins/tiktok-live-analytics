import type { WsMessage } from '../types';

const WS_URL = 'ws://localhost:3456';
const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY = 1000; // 1s, 2s, 4s, 8s, 16s 指数退避
const MAX_RECONNECT_DELAY = 30000; // 最大延迟 30 秒

export type MessageHandler = (message: WsMessage) => void;
export type StatusHandler = (connected: boolean) => void;

class WebSocketManager {
  private ws: WebSocket | null = null;
  private messageHandlers: Set<MessageHandler> = new Set();
  private statusHandlers: Set<StatusHandler> = new Set();
  private reconnectTimer: number | null = null;
  private reconnectAttempts = 0;
  private shouldReconnect = false; // 是否应该自动重连

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.shouldReconnect = true; // 允许自动重连
    this.reconnectAttempts = 0;

    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        console.log('[WS] 已连接到服务');
        this.reconnectAttempts = 0; // 重置重连计数
        this.notifyStatus(true);
      };

      this.ws.onclose = () => {
        console.log('[WS] 连接已关闭');
        this.notifyStatus(false);
        // 只有当 shouldReconnect 为 true 时才尝试重连
        if (this.shouldReconnect) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('[WS] 连接错误:', error);
        this.notifyStatus(false);
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WsMessage;
          this.notifyMessage(message);
        } catch (e) {
          console.error('[WS] 消息解析错误:', e);
        }
      };
    } catch (e) {
      console.error('[WS] 创建连接失败:', e);
      this.notifyStatus(false);
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    }
  }

  disconnect(): void {
    this.shouldReconnect = false; // 主动断开时禁止自动重连
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.reconnectAttempts = 0;
  }

  send(data: { action: string; username?: string }): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.error('[WS] 无法发送消息，连接未打开');
    }
  }

  connectToLive(username: string): void {
    this.send({ action: 'connect', username });
  }

  disconnectFromLive(): void {
    this.send({ action: 'disconnect' });
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private notifyMessage(message: WsMessage): void {
    this.messageHandlers.forEach(handler => handler(message));
  }

  private notifyStatus(connected: boolean): void {
    this.statusHandlers.forEach(handler => handler(connected));
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    // 检查是否超过最大重连次数
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.warn('[WS] 达到最大重连次数，停止重连');
      this.shouldReconnect = false;
      return;
    }

    this.reconnectAttempts++;

    // 指数退避，带最大延迟限制
    const delay = Math.min(
      BASE_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts - 1),
      MAX_RECONNECT_DELAY
    );

    console.log(`[WS] 第 ${this.reconnectAttempts} 次重连，${delay}ms 后尝试...`);

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (this.shouldReconnect) {
        this.connect();
      }
    }, delay);
  }
}

export const wsManager = new WebSocketManager();
