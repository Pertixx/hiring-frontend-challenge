"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  getClockSnapshot,
  seedServerTime,
  subscribeClock,
  syncServerClock,
} from "@/lib/time/server-clock";

const serverSnapshot = { offsetMs: 0, synced: false };

/**
 * Expone el offset servidor–cliente y lo sincroniza al montar.
 * `initialServerTime` viene del render en server (header `Date` de la API).
 */
export function useServerClock(initialServerTime: number | null) {
  const snapshot = useSyncExternalStore(
    subscribeClock,
    getClockSnapshot,
    () => serverSnapshot,
  );

  useEffect(() => {
    if (!getClockSnapshot().synced) seedServerTime(initialServerTime);
    void syncServerClock();
  }, [initialServerTime]);

  return snapshot;
}
