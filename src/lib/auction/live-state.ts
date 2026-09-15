import type { Auction, AuctionState, Bid } from "@/lib/auction/types";
import { isFinished, sortBidsDesc } from "@/lib/auction/types";

/**
 * Funciones puras que aplican eventos en vivo sobre la subasta.
 * Todas devuelven un objeto nuevo (o el mismo si no hubo cambios, para que
 * React no re-renderice de más).
 */

/** Inserta una puja recibida por socket. Idempotente por `bid.id`. */
export function applyBidPlaced(auction: Auction, bid: Bid): Auction {
  if (auction.bids.some((b) => b.id === bid.id)) return auction;

  const bids = sortBidsDesc([bid, ...auction.bids]);
  const currentBid =
    !auction.currentBid || bid.amount >= auction.currentBid.amount
      ? bid
      : auction.currentBid;

  return {
    ...auction,
    bids,
    currentBid,
    countBids: Math.max(auction.countBids + 1, bids.length),
  };
}

/** Marca la subasta como terminada según el evento `auction_ended`. */
export function applyAuctionEnded(
  auction: Auction,
  state: AuctionState,
  finishedAt: string,
): Auction {
  if (auction.state === state) return auction;
  return {
    ...auction,
    state,
    result: auction.result ?? {
      finishedAt,
      winningBid:
        state === "FINISHED_SALE" && auction.currentBid
          ? { amount: auction.currentBid.amount }
          : null,
    },
  };
}

/**
 * Combina el estado local (que puede tener pujas llegadas por socket) con un
 * snapshot fresco de la API. El snapshot es la fuente de verdad, pero no se
 * pierden pujas locales que la API todavía no listaba (carrera entre el
 * evento y la respuesta HTTP).
 */
export function reconcileWithSnapshot(
  local: Auction,
  snapshot: Auction,
): Auction {
  const byId = new Map<string, Bid>();
  for (const b of local.bids) byId.set(b.id, b);
  for (const b of snapshot.bids) byId.set(b.id, b);
  const bids = sortBidsDesc([...byId.values()]);

  const candidates = [snapshot.currentBid, local.currentBid, bids[0]].filter(
    (b): b is Bid => b != null,
  );
  const currentBid =
    candidates.length === 0
      ? null
      : candidates.reduce((max, b) => (b.amount > max.amount ? b : max));

  // Si localmente ya sabemos que terminó (por socket) y el snapshot todavía
  // dice LIVE, nos quedamos con "terminó": nunca mostrar como pujable algo
  // que ya cerró.
  const state =
    isFinished(local.state) && !isFinished(snapshot.state)
      ? local.state
      : snapshot.state;

  return {
    ...snapshot,
    state,
    bids,
    currentBid,
    countBids: Math.max(snapshot.countBids, bids.length),
    result: snapshot.result ?? local.result,
  };
}
