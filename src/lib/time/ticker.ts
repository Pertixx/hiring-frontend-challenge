import { serverNow } from "@/lib/time/server-clock";

/**
 * Reloj compartido que "tickea" cada 500 ms mientras haya alguien suscripto.
 * Pensado para `useSyncExternalStore`: `getTick()` devuelve el último valor
 * calculado (estable entre llamadas), no `Date.now()` en crudo.
 */
const TICK_MS = 500;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let lastTick = 0;

function tick() {
  lastTick = serverNow();
  for (const l of listeners) l();
}

export function subscribeTick(listener: () => void): () => void {
  listeners.add(listener);
  if (!timer) {
    lastTick = serverNow();
    timer = setInterval(tick, TICK_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

export function getTick(): number {
  if (lastTick === 0) lastTick = serverNow();
  return lastTick;
}
