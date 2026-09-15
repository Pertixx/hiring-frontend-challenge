/**
 * Reloj sincronizado con el servidor.
 *
 * El contador se compara contra `endsAt`, que lo define el servidor de la
 * API. El reloj del dispositivo puede estar desfasado (minutos, incluso), así
 * que en lugar de usar `Date.now()` directo mantenemos un offset
 * `servidor - cliente` y lo aplicamos al reloj local.
 *
 * Fuentes del offset, en orden:
 *  1. El header `Date` de la respuesta de la API cuando la página se renderiza
 *     en el server (Next lo puede leer; el browser no, porque `Date` no es un
 *     header CORS-safelisted).
 *  2. `GET /api/time`: un route handler propio que le pega a la API, lee ese
 *     mismo header y lo devuelve. Se llama al montar y en cada reconexión, y
 *     se corrige por la mitad del round-trip (estilo NTP simplificado).
 *
 * Es un store módulo-nivel con `subscribe` para usarlo con
 * `useSyncExternalStore`.
 */

let offsetMs = 0;
let synced = false;
const listeners = new Set<() => void>();

export interface ClockSnapshot {
  offsetMs: number;
  synced: boolean;
}

// `useSyncExternalStore` compara snapshots por identidad: hay que devolver
// el mismo objeto mientras nada cambie.
let snapshot: ClockSnapshot = { offsetMs, synced };

function notify() {
  snapshot = { offsetMs, synced };
  for (const l of listeners) l();
}

export function serverNow(): number {
  return Date.now() + offsetMs;
}

export function getClockSnapshot(): ClockSnapshot {
  return snapshot;
}

export function subscribeClock(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Setea el offset a partir de una hora de servidor observada "ahora". */
export function seedServerTime(serverTimeMs: number | null | undefined) {
  if (serverTimeMs == null || Number.isNaN(serverTimeMs)) return;
  offsetMs = serverTimeMs - Date.now();
  synced = true;
  notify();
}

/**
 * Sincroniza contra `/api/time`. Devuelve `true` si pudo.
 * Nunca lanza: si falla, se conserva el offset anterior.
 */
export async function syncServerClock(): Promise<boolean> {
  const t0 = Date.now();
  try {
    const res = await fetch("/api/time", {
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { serverTime: number };
    const t1 = Date.now();
    const rtt = t1 - t0;
    // El servidor leyó su hora aproximadamente a mitad del round-trip.
    offsetMs = body.serverTime + rtt / 2 - t1;
    synced = true;
    notify();
    return true;
  } catch {
    return false;
  }
}
