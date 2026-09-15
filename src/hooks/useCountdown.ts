"use client";

import { useSyncExternalStore } from "react";
import { getTick, subscribeTick } from "@/lib/time/ticker";

export interface Countdown {
  /** ms restantes según el reloj del servidor; nunca negativo. */
  remainingMs: number;
  /** `true` una vez que el reloj del servidor pasó `endsAt`. */
  isOver: boolean;
  /** `false` en el render de server: todavía no hay reloj confiable. */
  ready: boolean;
}

const getServerSnapshot = () => null;

/**
 * Cuenta regresiva contra `endsAt` usando el reloj corregido con el offset
 * del servidor. Se recalcula desde la fecha en cada tick, no se decrementa
 * un contador: así no se desfasa si el browser frena los timers en
 * background.
 */
export function useCountdown(endsAt: string | null): Countdown {
  const target = endsAt ? Date.parse(endsAt) : NaN;
  const now = useSyncExternalStore(subscribeTick, getTick, getServerSnapshot);

  if (Number.isNaN(target) || now === null) {
    return { remainingMs: 0, isOver: false, ready: false };
  }
  const remainingMs = Math.max(0, target - now);
  return { remainingMs, isOver: remainingMs <= 0, ready: true };
}
