"use client";

import type { Bid } from "@/lib/auction/types";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useMounted } from "@/hooks/useMounted";

interface Props {
  bids: Bid[];
  symbol: string;
  highlightId: string | null;
}

export function BidHistory({ bids, symbol, highlightId }: Props) {
  const mounted = useMounted();

  return (
    <section aria-label="Historial de pujas" className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      <h2 className="border-b border-zinc-100 px-4 py-3 text-sm font-semibold">
        Historial de pujas ({bids.length})
      </h2>
      {bids.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-zinc-500">Todavía no hay pujas.</p>
      ) : (
        <ol className="max-h-[28rem] divide-y divide-zinc-100 overflow-y-auto">
          {bids.map((bid, i) => (
            <li
              key={bid.id}
              className={`flex items-center gap-3 px-4 py-2.5 text-sm ${bid.id === highlightId ? "bid-flash" : ""}`}
            >
              <Avatar bid={bid} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">
                  {bid.profile?.username ?? "Anónimo"}
                  {bid.profile?.isVerified && (
                    <span className="ml-1 text-xs text-sky-600" title="Verificado">✓</span>
                  )}
                  {bid.isAuto && <span className="ml-1 text-xs text-zinc-500">(auto)</span>}
                </div>
                <div className="text-xs text-zinc-500" suppressHydrationWarning>
                  {mounted ? formatDateTime(bid.date) : " "}
                </div>
              </div>
              <div className={`tabular-nums ${i === 0 ? "font-semibold" : ""}`}>
                {formatMoney(bid.amount, symbol)}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Avatar({ bid }: { bid: Bid }) {
  const name = bid.profile?.username ?? "?";
  if (bid.profile?.avatar) {
    // eslint-disable-next-line @next/next/no-img-element -- avatares externos, sin optimización
    return <img src={bid.profile.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />;
  }
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold uppercase text-zinc-600">
      {name.slice(0, 2)}
    </span>
  );
}
