"use client";

import { useEffect } from "react";
import type { Auction } from "@/lib/auction/types";
import { isFinished } from "@/lib/auction/types";
import { labelFor } from "@/lib/format";
import { useLiveAuction } from "@/hooks/useLiveAuction";
import { useServerClock } from "@/hooks/useServerClock";
import { useCountdown } from "@/hooks/useCountdown";
import { ConnectionBanner } from "@/components/ConnectionBanner";
import { BidPanel } from "@/components/BidPanel";
import { BidHistory } from "@/components/BidHistory";
import { VehicleDetails } from "@/components/VehicleDetails";
import { Gallery } from "@/components/Gallery";

interface Props {
  initialAuction: Auction;
  initialServerTime: number | null;
}

/** Reintentos del snapshot cuando el contador llegó a cero y aún no llegó `auction_ended`. */
const CLOSE_RECHECK_DELAYS_MS = [2_000, 8_000, 20_000];

export function AuctionView({ initialAuction, initialServerTime }: Props) {
  const live = useLiveAuction(initialAuction);
  const clock = useServerClock(initialServerTime);
  const { auction } = live;
  const finished = isFinished(auction.state);
  const countdown = useCountdown(finished ? null : auction.endsAt);

  // El contador llegó a cero pero el servidor todavía no mandó
  // `auction_ended` (latencia, o el cierre real difiere unos segundos).
  // Pedimos el snapshot un par de veces para no depender sólo del socket.
  const { isOver } = countdown;
  const { resync } = live;
  useEffect(() => {
    if (!isOver || finished) return;
    const timers = CLOSE_RECHECK_DELAYS_MS.map((ms) => setTimeout(() => void resync(), ms));
    return () => timers.forEach(clearTimeout);
  }, [isOver, finished, resync]);

  const images = [auction.mainImage, ...auction.gallery].filter((s): s is string => !!s);

  return (
    <>
      <ConnectionBanner
        connection={live.connection}
        freshness={live.freshness}
        attempt={live.attempt}
        failureReason={live.failureReason}
        syncError={live.syncError}
        onRetry={live.reconnect}
      />

      <main className="mx-auto w-full max-w-6xl p-4 sm:p-6">
        <header className="mb-6">
          <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
            <StateBadge state={auction.state} />
            {auction.isNoReserve && (
              <span className="rounded bg-zinc-200 px-2 py-0.5 font-medium text-zinc-700">Sin reserva</span>
            )}
            <span className="text-zinc-500">{labelFor(auction.auctionType)}</span>
          </div>
          <h1 className="text-2xl font-semibold sm:text-3xl">{auction.title}</h1>
          <p className="text-zinc-600">
            {auction.year} · {auction.make} {auction.model}
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <Gallery images={images} alt={auction.title} />
            <VehicleDetails auction={auction} />
          </div>

          <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <BidPanel
              auction={auction}
              countdown={countdown}
              clockSynced={clock.synced}
              connection={live.connection}
              freshness={live.freshness}
              lastSyncedAt={live.lastSyncedAt}
            />
            <BidHistory
              bids={auction.bids}
              symbol={auction.currency.symbol}
              highlightId={live.lastLiveBidId}
            />
          </aside>
        </div>
      </main>
    </>
  );
}

function StateBadge({ state }: { state: Auction["state"] }) {
  const map: Record<Auction["state"], [string, string]> = {
    LIVE: ["En subasta", "bg-emerald-100 text-emerald-800"],
    PENDING: ["Próximamente", "bg-sky-100 text-sky-800"],
    DRAFT: ["Borrador", "bg-zinc-200 text-zinc-700"],
    CANCELLED: ["Cancelada", "bg-red-100 text-red-800"],
    FINISHED_SALE: ["Vendido", "bg-zinc-800 text-white"],
    FINISHED_NO_SALE: ["Finalizada sin venta", "bg-zinc-200 text-zinc-700"],
  };
  const [label, cls] = map[state] ?? [state, "bg-zinc-200 text-zinc-700"];
  return <span className={`rounded px-2 py-0.5 font-medium ${cls}`}>{label}</span>;
}
