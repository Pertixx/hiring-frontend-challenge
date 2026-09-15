import { parseSocketMessage, type SocketMessage } from "@/lib/socket/messages";

/**
 * Estado de la conexión, tal como lo entiende el usuario:
 *
 * - `connecting`:   primer intento, todavía no hay datos en vivo.
 * - `live`:         socket abierto y suscripción confirmada por el servidor.
 * - `reconnecting`: se cayó y estamos reintentando (con backoff).
 * - `offline`:      el navegador reporta que no hay red; reintentamos al volver.
 * - `failed`:       el servidor rechazó la suscripción; no tiene sentido reintentar.
 * - `closed`:       cerrado a propósito (unmount / subasta terminada).
 */
export type ConnectionStatus =
  | "connecting"
  | "live"
  | "reconnecting"
  | "offline"
  | "failed"
  | "closed";

export interface AuctionSocketHandlers {
  onStatus: (status: ConnectionStatus, detail: { attempt: number; reason?: string }) => void;
  onMessage: (message: SocketMessage) => void;
}

export interface AuctionSocketOptions {
  url: string;
  auctionId: string;
  handlers: AuctionSocketHandlers;
  /** Intervalo del ping de keepalive. */
  heartbeatMs?: number;
  /** Cuánto esperar el pong antes de dar la conexión por muerta. */
  pongTimeoutMs?: number;
  /** Cuánto esperar el `subscribed` después de abrir. */
  subscribeTimeoutMs?: number;
  maxBackoffMs?: number;
}

/**
 * Wrapper del WebSocket plano de Motordil para una sola subasta.
 *
 * Responsabilidades:
 *  - abrir, mandar `subscribe` y considerar la conexión viva recién cuando
 *    llega `subscribed` (abrir el socket no garantiza que estemos suscritos);
 *  - keepalive con ping/pong y detección de conexiones "zombie" (abiertas
 *    pero mudas: pasa al volver de background o al cambiar de red);
 *  - reconexión con backoff exponencial + jitter;
 *  - reaccionar a `online`/`offline` y a `visibilitychange`.
 *
 * No sabe nada de React ni del modelo de subasta: sólo emite status y
 * mensajes ya parseados. Los mensajes desconocidos se descartan en el parser.
 */
export class AuctionSocket {
  private ws: WebSocket | null = null;
  private attempt = 0;
  private status: ConnectionStatus = "connecting";
  private closedByUser = false;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;
  private subscribeTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly heartbeatMs: number;
  private readonly pongTimeoutMs: number;
  private readonly subscribeTimeoutMs: number;
  private readonly maxBackoffMs: number;

  constructor(private readonly opts: AuctionSocketOptions) {
    this.heartbeatMs = opts.heartbeatMs ?? 20_000;
    this.pongTimeoutMs = opts.pongTimeoutMs ?? 8_000;
    this.subscribeTimeoutMs = opts.subscribeTimeoutMs ?? 8_000;
    this.maxBackoffMs = opts.maxBackoffMs ?? 30_000;
  }

  connect() {
    this.closedByUser = false;
    window.addEventListener("online", this.handleOnline);
    window.addEventListener("offline", this.handleOffline);
    document.addEventListener("visibilitychange", this.handleVisibility);

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      this.setStatus("offline");
      return;
    }
    this.open();
  }

  /** Cierra definitivamente. Después de esto no se reintenta. */
  close() {
    this.closedByUser = true;
    window.removeEventListener("online", this.handleOnline);
    window.removeEventListener("offline", this.handleOffline);
    document.removeEventListener("visibilitychange", this.handleVisibility);
    this.clearTimers();
    this.teardownSocket(1000, "client closed");
    this.setStatus("closed");
  }

  /** Reintento inmediato, por ejemplo desde un botón "Reintentar". */
  reconnectNow() {
    if (this.closedByUser) return;
    this.clearTimers();
    this.teardownSocket(4000, "manual reconnect");
    this.attempt = 0;
    this.open();
  }

  getStatus() {
    return this.status;
  }

  /* ------------------------------------------------------------------ */

  private open() {
    if (this.closedByUser) return;
    this.clearTimers();
    this.teardownSocket(4000, "reopening");
    this.setStatus(this.attempt === 0 && this.status === "connecting" ? "connecting" : "reconnecting");

    let ws: WebSocket;
    try {
      ws = new WebSocket(this.opts.url);
    } catch (err) {
      this.scheduleReconnect(err instanceof Error ? err.message : "constructor failed");
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      if (ws !== this.ws) return;
      this.send({ type: "subscribe", auction_id: this.opts.auctionId });
      // Si el server no confirma la suscripción, algo está mal: reabrimos.
      this.subscribeTimer = setTimeout(() => {
        if (ws === this.ws && this.status !== "live") {
          this.teardownSocket(4000, "subscribe timeout");
          this.scheduleReconnect("subscribe timeout");
        }
      }, this.subscribeTimeoutMs);
    };

    ws.onmessage = (event) => {
      if (ws !== this.ws) return;
      const msg = parseSocketMessage(event.data);
      if (!msg) return; // tipo desconocido o payload inválido: se ignora

      switch (msg.type) {
        case "subscribed":
          if (msg.auction_id !== this.opts.auctionId) return;
          if (this.subscribeTimer) clearTimeout(this.subscribeTimer);
          this.attempt = 0;
          this.setStatus("live");
          this.startHeartbeat();
          break;
        case "failed_subscribe":
          if (msg.auction_id && msg.auction_id !== this.opts.auctionId) return;
          this.clearTimers();
          this.teardownSocket(1000, "failed_subscribe");
          this.setStatus("failed", msg.message);
          break;
        case "pong":
          if (this.pongTimer) clearTimeout(this.pongTimer);
          this.pongTimer = null;
          break;
        case "identify":
          break;
        default:
          this.opts.handlers.onMessage(msg);
      }
    };

    ws.onclose = (event) => {
      if (ws !== this.ws) return;
      this.ws = null;
      this.clearTimers();
      if (this.closedByUser || this.status === "failed") return;
      this.scheduleReconnect(`close ${event.code}`);
    };

    ws.onerror = () => {
      // `onclose` llega siempre después de `onerror`; ahí se reintenta.
    };
  }

  private send(payload: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  private startHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => this.ping(), this.heartbeatMs);
  }

  /** Manda un ping y, si no hay pong a tiempo, fuerza la reconexión. */
  private ping() {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    if (this.pongTimer) return; // ya hay un ping en vuelo
    this.send({ type: "ping" });
    this.pongTimer = setTimeout(() => {
      this.pongTimer = null;
      this.teardownSocket(4000, "pong timeout");
      this.scheduleReconnect("pong timeout");
    }, this.pongTimeoutMs);
  }

  private scheduleReconnect(reason: string) {
    if (this.closedByUser) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      this.setStatus("offline", reason);
      return;
    }
    this.attempt += 1;
    this.setStatus("reconnecting", reason);
    const base = Math.min(1_000 * 2 ** (this.attempt - 1), this.maxBackoffMs);
    const jitter = base * 0.25 * Math.random();
    this.reconnectTimer = setTimeout(() => this.open(), base + jitter);
  }

  private handleOnline = () => {
    if (this.closedByUser) return;
    this.reconnectNow();
  };

  private handleOffline = () => {
    if (this.closedByUser) return;
    this.clearTimers();
    this.teardownSocket(4000, "offline");
    this.setStatus("offline");
  };

  /**
   * Al volver a primer plano, el socket puede seguir "abierto" según el
   * browser pero estar muerto del lado del servidor. Si no está abierto,
   * reconectamos ya; si lo está, mandamos un ping para verificarlo.
   */
  private handleVisibility = () => {
    if (document.visibilityState !== "visible" || this.closedByUser) return;
    if (this.ws?.readyState === WebSocket.OPEN && this.status === "live") {
      this.ping();
    } else if (this.status !== "failed") {
      this.reconnectNow();
    }
  };

  private setStatus(status: ConnectionStatus, reason?: string) {
    if (status === this.status && status !== "reconnecting") return;
    this.status = status;
    this.opts.handlers.onStatus(status, { attempt: this.attempt, reason });
  }

  private clearTimers() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.pongTimer) clearTimeout(this.pongTimer);
    if (this.subscribeTimer) clearTimeout(this.subscribeTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.heartbeatTimer = null;
    this.pongTimer = null;
    this.subscribeTimer = null;
    this.reconnectTimer = null;
  }

  private teardownSocket(code: number, reason: string) {
    const ws = this.ws;
    if (!ws) return;
    this.ws = null;
    ws.onopen = null;
    ws.onmessage = null;
    ws.onclose = null;
    ws.onerror = null;
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: "unsubscribe", auction_id: this.opts.auctionId }));
      } catch {
        // el socket puede estar cerrándose; no importa
      }
    }
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.close(code, reason);
      } catch {
        // idem
      }
    } else if (ws.readyState === WebSocket.CONNECTING) {
      // Cerrar un socket que todavía está conectando hace que el browser
      // loguee un warning; lo cerramos apenas abra.
      ws.onopen = () => ws.close(code, reason);
    }
  }
}
