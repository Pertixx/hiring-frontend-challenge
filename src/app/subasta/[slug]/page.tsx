import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchAuction } from "@/lib/graphql/auction";
import { AuctionView } from "@/components/AuctionView";

// La subasta cambia todo el tiempo: nunca cachear este render.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return { title: `${slug} — Motordil` };
}

/**
 * Server component: trae el snapshot inicial de la subasta.
 *
 * - `auction === null` → `notFound()` → `not-found.tsx`.
 * - Si la API falla, `fetchAuction` lanza y lo agarra `error.tsx`.
 * - El `serverTime` (header `Date` de la API) se pasa al cliente para
 *   sembrar el reloj del contador antes de la primera sincronización.
 */
export default async function AuctionPage({ params }: PageProps) {
  const { slug } = await params;
  const { auction, serverTime } = await fetchAuction(slug);
  if (!auction) notFound();

  return <AuctionView initialAuction={auction} initialServerTime={serverTime} />;
}
