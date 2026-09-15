import { describe, expect, it } from "vitest";
import type { Auction, Bid } from "./types";
import {
  applyAuctionEnded,
  applyBidPlaced,
  reconcileWithSnapshot,
} from "./live-state";

function bid(id: string, amount: number, date: string): Bid {
  return { id, amount, date, isAuto: false, profile: null };
}

const b1 = bid("b1", 1000, "2026-09-15T10:00:00Z");
const b2 = bid("b2", 1050, "2026-09-15T10:01:00Z");
const b3 = bid("b3", 1100, "2026-09-15T10:02:00Z");

const base: Auction = {
  id: "a1",
  slug: "test",
  title: "Test",
  auctionType: "CAR",
  make: "Honda",
  model: "S2000",
  version: null,
  year: 2000,
  location: "Tokio",
  country: "ARGENTINA",
  odometer: 1,
  fuelType: "FUEL",
  transmissionType: "MANUAL",
  origin: "Japon",
  color: "Gris",
  state: "LIVE",
  startsAt: null,
  endsAt: "2026-09-16T10:00:00Z",
  viewCount: 0,
  isNoReserve: true,
  hasMetReserve: true,
  isNearingReserve: false,
  countBids: 1,
  countWatchers: 0,
  currency: { name: "Dólares", symbol: "USD" },
  currentBid: b1,
  bids: [b1],
  result: null,
  mainImage: null,
  gallery: [],
  description: [],
};

describe("applyBidPlaced", () => {
  it("agrega la puja al principio y actualiza precio y contador", () => {
    const next = applyBidPlaced(base, b2);
    expect(next.bids.map((b) => b.id)).toEqual(["b2", "b1"]);
    expect(next.currentBid).toBe(b2);
    expect(next.countBids).toBe(2);
  });

  it("es idempotente si la misma puja llega dos veces", () => {
    const once = applyBidPlaced(base, b2);
    expect(applyBidPlaced(once, b2)).toBe(once);
  });

  it("no pisa el precio actual con una puja menor que llega tarde", () => {
    const withB3 = applyBidPlaced(base, b3);
    const late = applyBidPlaced(withB3, b2);
    expect(late.currentBid).toBe(b3);
    expect(late.bids.map((b) => b.id)).toEqual(["b3", "b2", "b1"]);
  });
});

describe("applyAuctionEnded", () => {
  it("cambia el estado y arma un resultado provisorio", () => {
    const ended = applyAuctionEnded(base, "FINISHED_SALE", "2026-09-16T10:00:00Z");
    expect(ended.state).toBe("FINISHED_SALE");
    expect(ended.result).toEqual({
      finishedAt: "2026-09-16T10:00:00Z",
      winningBid: { amount: 1000 },
    });
  });

  it("sin venta no hay puja ganadora", () => {
    const ended = applyAuctionEnded(base, "FINISHED_NO_SALE", "x");
    expect(ended.result?.winningBid).toBeNull();
  });
});

describe("reconcileWithSnapshot", () => {
  it("une pujas locales y del snapshot sin duplicar", () => {
    const local = applyBidPlaced(base, b3); // b3 llegó por socket
    const snapshot: Auction = { ...base, bids: [b2, b1], currentBid: b2, countBids: 2 };
    const merged = reconcileWithSnapshot(local, snapshot);
    expect(merged.bids.map((b) => b.id)).toEqual(["b3", "b2", "b1"]);
    expect(merged.currentBid).toBe(b3);
    expect(merged.countBids).toBe(3);
  });

  it("el snapshot manda en el resto de los campos", () => {
    const snapshot: Auction = { ...base, endsAt: "2026-09-17T10:00:00Z", countWatchers: 9 };
    const merged = reconcileWithSnapshot(base, snapshot);
    expect(merged.endsAt).toBe("2026-09-17T10:00:00Z");
    expect(merged.countWatchers).toBe(9);
  });

  it("no vuelve a LIVE una subasta que localmente ya terminó", () => {
    const local = applyAuctionEnded(base, "FINISHED_SALE", "x");
    const merged = reconcileWithSnapshot(local, base);
    expect(merged.state).toBe("FINISHED_SALE");
  });
});
