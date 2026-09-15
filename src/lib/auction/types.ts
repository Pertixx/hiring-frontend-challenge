/**
 * Modelo de dominio de la vista. Es un subconjunto normalizado de lo que
 * devuelve la API: tanto la query GraphQL como los eventos del socket se
 * mapean a estos tipos, así los componentes no conocen ninguno de los dos
 * formatos crudos.
 */

export type AuctionState =
  | "LIVE"
  | "PENDING"
  | "DRAFT"
  | "CANCELLED"
  | "FINISHED_SALE"
  | "FINISHED_NO_SALE";

export interface BidderProfile {
  id: string;
  username: string;
  isVerified: boolean;
  avatar: string | null;
}

export interface Bid {
  id: string;
  amount: number;
  /** ISO 8601 */
  date: string;
  isAuto: boolean;
  profile: BidderProfile | null;
}

export interface AuctionResult {
  finishedAt: string;
  winningBid: { amount: number } | null;
}

export interface Auction {
  id: string;
  slug: string;
  title: string;
  auctionType: string;
  make: string;
  model: string;
  version: string | null;
  year: number;
  location: string;
  country: string;
  odometer: number;
  fuelType: string;
  transmissionType: string;
  origin: string;
  color: string;
  state: AuctionState;
  startsAt: string | null;
  endsAt: string | null;
  viewCount: number;
  isNoReserve: boolean;
  hasMetReserve: boolean;
  isNearingReserve: boolean;
  countBids: number;
  countWatchers: number;
  currency: { name: string; symbol: string };
  currentBid: Bid | null;
  /** Ordenadas de más reciente a más antigua. */
  bids: Bid[];
  result: AuctionResult | null;
  mainImage: string | null;
  gallery: string[];
  description: string[];
}

export function isFinished(state: AuctionState): boolean {
  return (
    state === "FINISHED_SALE" ||
    state === "FINISHED_NO_SALE" ||
    state === "CANCELLED"
  );
}

/** Ordena pujas de más reciente a más antigua. Devuelve un array nuevo. */
export function sortBidsDesc(bids: Bid[]): Bid[] {
  return [...bids].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}
