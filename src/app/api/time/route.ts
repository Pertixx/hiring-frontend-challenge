import { NextResponse } from "next/server";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Devuelve la hora del servidor de la API de Motordil (header `Date` de una
 * respuesta GraphQL trivial). Si la API no responde, cae a la hora del server
 * de Next, que sigue siendo mejor que confiar en el reloj del dispositivo.
 */
export async function GET() {
  try {
    const res = await fetch(env.graphqlUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "{ __typename }" }),
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    const date = res.headers.get("date");
    const serverTime = date ? Date.parse(date) : NaN;
    if (!Number.isNaN(serverTime)) {
      return NextResponse.json(
        { serverTime, source: "api" },
        { headers: { "cache-control": "no-store" } },
      );
    }
  } catch {
    // cae al fallback
  }
  return NextResponse.json(
    { serverTime: Date.now(), source: "next" },
    { headers: { "cache-control": "no-store" } },
  );
}
