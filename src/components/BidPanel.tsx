"use client";

import type { Auction } from "@/lib/auction/types";
import { isFinished } from "@/lib/auction/types";
import { nextMinBid, minIncrement } from "@/lib/auction/bidding";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import type { Countdown as CountdownValue } from "@/hooks/useCountdown";
import type { Freshness } from "@/hooks/useLiveAuction";
import type { ConnectionStatus } from "@/lib/socket/auction-socket";
import { Countdown } from "@/components/Countdown";
import { useMounted } from "@/hooks/useMounted";

interface Props {
  auction: Auction;
  countdown: CountdownValue;
  clockSynced: boolean;
  connection: ConnectionStatus;
  freshness: Freshness;
  lastSyncedAt: number | null;
}

export function BidPanel({
  auction,
  countdown,
  clockSynced,
  connection,
  freshness,
  lastSyncedAt,
}: Props) {
  const mounted = useMounted();
  const finished = isFinished(auction.state);
  const symbol = auction.currency.symbol;
  const current = auction.currentBid?.amount ?? null;
  const next = nextMinBid(current);
  const stale = !finished && freshness === "stale";

  // Pujar requiere sesión, que no tenemos: el botón muestra el próximo monto
  // válido pero está siempre deshabilitado. El texto de ayuda distingue
  // "falta sesión" de "no hay conexión en vivo / la subasta ya cerró".
  const liveAndFresh = connection === "live" && freshness === "fresh" && !countdown.isOver;

  return (
    <section
      aria-label="Puja"
      className={`rounded-lg border bg-white p-4 shadow-sm ${stale ? "border-amber-300" : "border-zinc-200"}`}
    >
      <div className="mb-3 flex items-center justify-between text-xs">
        <span className="uppercase tracking-wide text-zinc-500">
          {finished ? "Precio final" : stale ? "Último precio conocido" : "Precio actual"}
        </span>
        {!finished && <LiveDot connection={connection} freshness={freshness} />}
      </div>

      <div className={`text-4xl font-semibold tabular-nums ${stale ? "text-zinc-500" : ""}`}>
        {current !== null ? formatMoney(current, symbol) : "Sin pujas"}
      </div>
      {auction.currentBid?.profile && (
        <p className="mt-1 text-sm text-zinc-600">
          por <span className="font-medium">{auction.currentBid.profile.username}</span>
          {auction.currentBid.isAuto && " (automática)"}
        </p>
      )}

      {stale && (
        <p className="mt-2 text-xs text-amber-700">
          Sin conexión en vivo: este precio puede haber cambiado.
          {mounted && lastSyncedAt && ` Última sincronización: ${formatDateTime(new Date(lastSyncedAt).toISOString())}.`}
        </p>
      )}

      <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-zinc-500">Pujas</dt>
          <dd className="font-medium">{formatNumber(auction.countBids)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Siguiendo</dt>
          <dd className="font-medium">{formatNumber(auction.countWatchers)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Vistas</dt>
          <dd className="font-medium">{formatNumber(auction.viewCount)}</dd>
        </div>
      </dl>

      <div className="mt-5 border-t border-zinc-100 pt-4">
        {finished ? (
          <FinishedSummary auction={auction} />
        ) : (
          <>
            <div className="text-xs uppercase tracking-wide text-zinc-500">Cierra en</div>
            <Countdown countdown={countdown} clockSynced={clockSynced} />
            {auction.endsAt && mounted && (
              <p className="mt-1 text-xs text-zinc-500">{formatDateTime(auction.endsAt)}</p>
            )}
          </>
        )}
      </div>

      {!finished && (
        <div className="mt-5">
          <button
            type="button"
            disabled
            aria-disabled="true"
            title="Pujar requiere iniciar sesión"
            className={`w-full cursor-not-allowed rounded px-4 py-3 text-base font-semibold ${
              liveAndFresh ? "bg-emerald-600/60 text-white" : "bg-zinc-300 text-zinc-500"
            }`}
          >
            Pujar {formatMoney(next, symbol)}
          </button>
          <p className="mt-2 text-center text-xs text-zinc-500">
            Incremento mínimo: {formatMoney(minIncrement(current ?? 0), symbol)}.{" "}
            {liveAndFresh
              ? "Pujar requiere iniciar sesión."
              : countdown.isOver
                ? "La subasta está cerrando."
                : "Sin conexión en vivo no se puede pujar."}
          </p>
        </div>
      )}
    </section>
  );
}

function LiveDot({ connection, freshness }: { connection: ConnectionStatus; freshness: Freshness }) {
  const live = connection === "live" && freshness === "fresh";
  const syncing = connection === "live" && freshness === "syncing";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          live ? "bg-emerald-500" : syncing ? "bg-sky-500 animate-pulse" : "bg-amber-500 animate-pulse"
        }`}
      />
      <span className={live ? "text-emerald-700" : syncing ? "text-sky-700" : "text-amber-700"}>
        {live ? "En vivo" : syncing ? "Sincronizando" : "Desactualizado"}
      </span>
    </span>
  );
}

function FinishedSummary({ auction }: { auction: Auction }) {
  const mounted = useMounted();
  const sold = auction.state === "FINISHED_SALE";
  const cancelled = auction.state === "CANCELLED";
  return (
    <div>
      <div
        className={`rounded px-3 py-2 text-sm font-medium ${
          sold ? "bg-emerald-50 text-emerald-800" : "bg-zinc-100 text-zinc-700"
        }`}
      >
        {cancelled
          ? "Subasta cancelada"
          : sold
            ? `Vendido${auction.result?.winningBid ? ` por ${formatMoney(auction.result.winningBid.amount, auction.currency.symbol)}` : ""}`
            : "Subasta finalizada sin venta"}
      </div>
      {mounted && (auction.result?.finishedAt || auction.endsAt) && (
        <p className="mt-2 text-xs text-zinc-500">
          Cerró el {formatDateTime(auction.result?.finishedAt ?? auction.endsAt!)}
        </p>
      )}
    </div>
  );
}
