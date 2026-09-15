import { z } from "zod";
import type { AuctionState, Bid } from "@/lib/auction/types";

/**
 * Parseo de los mensajes del WebSocket.
 *
 * Los payloads vienen en snake_case, con ids a veces envueltos como
 * `{ "$oid": "…" }`, y el servidor emite tipos que no conocemos. Por eso:
 *  - se valida con zod en runtime (no confiamos en el tipo del wire),
 *  - los ids aceptan string u objeto `$oid`,
 *  - cualquier mensaje que no matchee un tipo conocido se descarta sin romper.
 */

const mongoId = z
  .union([z.string(), z.object({ $oid: z.string() })])
  .transform((v) => (typeof v === "string" ? v : v.$oid));

const bidderProfile = z
  .object({
    _id: mongoId.optional(),
    id: mongoId.optional(),
    username: z.string(),
    is_verified: z.boolean().optional(),
    avatar_url: z.string().nullable().optional(),
  })
  .passthrough();

const identify = z.object({
  type: z.literal("identify"),
  socket_id: z.string(),
});

const subscribed = z.object({
  type: z.literal("subscribed"),
  auction_id: mongoId,
});

const failedSubscribe = z.object({
  type: z.literal("failed_subscribe"),
  auction_id: mongoId.optional(),
  message: z.string().optional(),
});

const pong = z.object({ type: z.literal("pong") });

const bidPlaced = z
  .object({
    type: z.literal("bid_placed"),
    auction_id: mongoId,
    bid_id: mongoId,
    bid_amount: z.number(),
    placed_at: z.string(),
    is_auto: z.boolean().optional(),
    bidder_profile: bidderProfile.nullable().optional(),
  })
  .passthrough();

const auctionEnded = z
  .object({
    type: z.literal("auction_ended"),
    auction_id: mongoId,
    state: z.string().optional(),
  })
  .passthrough();

const knownMessage = z.discriminatedUnion("type", [
  identify,
  subscribed,
  failedSubscribe,
  pong,
  bidPlaced,
  auctionEnded,
]);

export type SocketMessage = z.infer<typeof knownMessage>;
export type BidPlacedMessage = z.infer<typeof bidPlaced>;
export type AuctionEndedMessage = z.infer<typeof auctionEnded>;

/**
 * Devuelve el mensaje tipado, o `null` si no es JSON, no tiene la forma
 * esperada o es de un tipo que no manejamos.
 */
export function parseSocketMessage(raw: unknown): SocketMessage | null {
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  const result = knownMessage.safeParse(value);
  return result.success ? result.data : null;
}

/** Convierte el evento `bid_placed` al modelo de dominio. */
export function bidFromMessage(msg: BidPlacedMessage): Bid {
  const p = msg.bidder_profile;
  return {
    id: msg.bid_id,
    amount: msg.bid_amount,
    date: msg.placed_at,
    isAuto: msg.is_auto ?? false,
    profile: p
      ? {
          id: p._id ?? p.id ?? "",
          username: p.username,
          isVerified: p.is_verified ?? false,
          avatar: p.avatar_url ?? null,
        }
      : null,
  };
}

const KNOWN_STATES: ReadonlySet<AuctionState> = new Set([
  "LIVE",
  "PENDING",
  "DRAFT",
  "CANCELLED",
  "FINISHED_SALE",
  "FINISHED_NO_SALE",
]);

/**
 * `auction_ended` trae el estado en minúsculas (`finished_sale`). Si viene
 * algo que no reconocemos, asumimos que terminó con venta: lo importante
 * para la UI es que ya no se puede pujar.
 */
export function stateFromMessage(msg: AuctionEndedMessage): AuctionState {
  const upper = (msg.state ?? "").toUpperCase() as AuctionState;
  return KNOWN_STATES.has(upper) ? upper : "FINISHED_SALE";
}
