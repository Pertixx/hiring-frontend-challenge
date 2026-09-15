"use client";

import { splitDuration } from "@/lib/format";
import type { Countdown as CountdownValue } from "@/hooks/useCountdown";

interface Props {
  countdown: CountdownValue;
  clockSynced: boolean;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function Countdown({ countdown, clockSynced }: Props) {
  if (!countdown.ready) {
    return (
      <div className="font-mono text-2xl tabular-nums text-zinc-400" aria-label="Calculando">
        --:--:--
      </div>
    );
  }

  if (countdown.isOver) {
    return (
      <div className="text-lg font-semibold text-amber-700">
        Cerrando… esperando confirmación del servidor
      </div>
    );
  }

  const { days, hours, minutes, seconds, totalMs } = splitDuration(countdown.remainingMs);
  const urgent = totalMs < 5 * 60_000;

  return (
    <div>
      <div
        className={`font-mono text-3xl tabular-nums ${urgent ? "text-red-600" : "text-zinc-900"}`}
        aria-live="off"
      >
        {days > 0 && <span>{days}d </span>}
        {pad(hours)}:{pad(minutes)}:{pad(seconds)}
      </div>
      {!clockSynced && (
        <p className="mt-1 text-xs text-zinc-500">
          Usando el reloj del dispositivo hasta sincronizar con el servidor.
        </p>
      )}
    </div>
  );
}
