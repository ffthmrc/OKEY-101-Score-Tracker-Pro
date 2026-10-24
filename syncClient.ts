// WebSocket sarmalayıcısı: koparsa 1→2→4→…→10 sn aralıkla yeniden bağlanır,
// sekme görünür olunca / ağ geri gelince hemen dener, sessiz kopmaları ping ile yakalar.
import type { ClientMsg, ServerMsg } from './shared/protocol';

export type ConnStatus = 'connecting' | 'online' | 'offline';

interface Handlers {
  onOpen: () => void;
  onMessage: (msg: ServerMsg) => void;
  onStatus: (status: ConnStatus) => void;
}

const PING_EVERY_MS = 20_000;
const PONG_TIMEOUT_MS = 8_000;
const MAX_RETRY_MS = 10_000;

export const wsUrl = () =>
  `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;

export class SyncClient {
  private url: string;
  private handlers: Handlers;
  private ws: WebSocket | null = null;
  private retry = 0;
  private stopped = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private pingTimer: ReturnType<typeof setInterval> | undefined;
  private pongTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(url: string, handlers: Handlers) {
    this.url = url;
    this.handlers = handlers;
  }

  start() {
    this.stopped = false;
    window.addEventListener('online', this.kick);
    document.addEventListener('visibilitychange', this.onVisible);
    this.connect();
  }

  stop() {
    this.stopped = true;
    window.removeEventListener('online', this.kick);
    document.removeEventListener('visibilitychange', this.onVisible);
    clearTimeout(this.reconnectTimer);
    this.stopPing();
    this.ws?.close();
    this.ws = null;
  }

  send(msg: ClientMsg): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(msg));
    return true;
  }

  private connect() {
    clearTimeout(this.reconnectTimer);
    this.handlers.onStatus('connecting');
    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.onopen = () => {
      this.retry = 0;
      this.handlers.onStatus('online');
      this.handlers.onOpen();
      this.startPing();
    };
    ws.onmessage = ev => {
      let msg: ServerMsg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.type === 'pong') {
        clearTimeout(this.pongTimer);
        return;
      }
      this.handlers.onMessage(msg);
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.stopPing();
      this.ws = null;
      if (this.stopped) return;
      this.handlers.onStatus('offline');
      const delay = Math.min(MAX_RETRY_MS, 1000 * 2 ** this.retry++);
      this.reconnectTimer = setTimeout(() => this.connect(), delay);
    };
  }

  private kick = () => {
    if (this.stopped) return;
    if (!this.ws) this.connect();
    else if (this.ws.readyState === WebSocket.OPEN) this.ping();
  };

  private onVisible = () => {
    if (document.visibilityState === 'visible') this.kick();
  };

  private ping() {
    if (!this.send({ type: 'ping' })) return;
    clearTimeout(this.pongTimer);
    this.pongTimer = setTimeout(() => this.ws?.close(), PONG_TIMEOUT_MS);
  }

  private startPing() {
    this.stopPing();
    this.pingTimer = setInterval(() => this.ping(), PING_EVERY_MS);
  }

  private stopPing() {
    clearInterval(this.pingTimer);
    clearTimeout(this.pongTimer);
  }
}
