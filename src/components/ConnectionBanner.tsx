"use client";

import type { ConnectionStatus } from "@/lib/socket/auction-socket";
import type { Freshness } from "@/hooks/useLiveAuction";

interface Props {
  connection: ConnectionStatus;
  freshness: Freshness;
  attempt: number;
  failureReason: string | null;
  syncError: string | null;
  onRetry: () => void;
}

type Tone = "neutral" | "info" | "warning" | "danger";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-zinc-100 text-zinc-700 border-zinc-200",
  info: "bg-sky-50 text-sky-900 border-sky-200",
  warning: "bg-amber-50 text-amber-900 border-amber-300",
  danger: "bg-red-50 text-red-900 border-red-300",
};

/**
 * Le dice al usuario, sin rodeos, si puede confiar en lo que ve.
 * No se muestra cuando todo está bien; para eso está el indicador "En vivo"
 * chiquito en el panel de puja.
 */
export function ConnectionBanner({
  connection,
  freshness,
  attempt,
  failureReason,
  syncError,
  onRetry,
}: Props) {
  let tone: Tone | null = null;
  let title = "";
  let detail = "";
  let retry = false;

  switch (connection) {
    case "connecting":
      tone = "neutral";
      title = "Conectando con el servidor de pujas…";
      detail = "Los datos que ves son del último snapshot de la API.";
      break;
    case "live":
      if (freshness === "syncing") {
        tone = "info";
        title = "Conectado. Sincronizando con la API…";
      } else if (syncError) {
        tone = "warning";
        title = "Estás recibiendo pujas en vivo, pero no pudimos actualizar el snapshot.";
        detail = syncError;
        retry = true;
      }
      break;
    case "reconnecting":
      tone = "warning";
      title = "Se perdió la conexión en vivo. El precio y las pujas pueden estar desactualizados.";
      detail = `Reintentando automáticamente (intento ${attempt})…`;
      retry = true;
      break;
    case "offline":
      tone = "danger";
      title = "Sin conexión a internet. Lo que ves puede haber cambiado.";
      detail = "Vamos a reconectar en cuanto vuelva la red.";
      retry = true;
      break;
    case "failed":
      tone = "danger";
      title = "El servidor rechazó la suscripción a esta subasta.";
      detail = failureReason || "No vas a recibir pujas en vivo.";
      retry = true;
      break;
    case "closed":
      break;
  }

  if (!tone) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-2 text-sm ${TONE_CLASS[tone]}`}
    >
      <div className="flex-1">
        <span className="font-medium">{title}</span>
        {detail && <span className="ml-2 opacity-80">{detail}</span>}
      </div>
      {retry && (
        <button
          onClick={onRetry}
          className="rounded border border-current px-3 py-1 text-xs font-medium hover:bg-white/50"
        >
          Reintentar ahora
        </button>
      )}
    </div>
  );
}
