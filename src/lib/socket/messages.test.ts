import { describe, expect, it } from "vitest";
import {
  bidFromMessage,
  parseSocketMessage,
  stateFromMessage,
} from "./messages";

const bidPlacedRaw = JSON.stringify({
  type: "bid_placed",
  auction_id: "6712a000000000000000000a",
  bid_amount: 19250.0,
  bid_id: { $oid: "6712b000000000000000000b" },
  placed_at: "2026-08-29T18:04:11.291Z",
  is_auto: false,
  bidder_profile: {
    username: "juanpe",
    _id: { $oid: "6712c000000000000000000c" },
    is_verified: true,
    avatar_url: null,
  },
});

describe("parseSocketMessage", () => {
  it("parsea bid_placed desenvolviendo los $oid", () => {
    const msg = parseSocketMessage(bidPlacedRaw);
    expect(msg?.type).toBe("bid_placed");
    if (msg?.type !== "bid_placed") throw new Error("unreachable");

    expect(msg.bid_id).toBe("6712b000000000000000000b");
    const bid = bidFromMessage(msg);
    expect(bid).toEqual({
      id: "6712b000000000000000000b",
      amount: 19250,
      date: "2026-08-29T18:04:11.291Z",
      isAuto: false,
      profile: {
        id: "6712c000000000000000000c",
        username: "juanpe",
        isVerified: true,
        avatar: null,
      },
    });
  });

  it("parsea los mensajes de control", () => {
    expect(parseSocketMessage('{"type":"pong"}')).toEqual({ type: "pong" });
    expect(
      parseSocketMessage('{"type":"subscribed","auction_id":"abc"}'),
    ).toEqual({ type: "subscribed", auction_id: "abc" });
    expect(
      parseSocketMessage('{"type":"identify","socket_id":"s-1"}'),
    ).toEqual({ type: "identify", socket_id: "s-1" });
  });

  it("descarta tipos desconocidos, JSON inválido y payloads malformados", () => {
    expect(parseSocketMessage('{"type":"viewer_count","count":3}')).toBeNull();
    expect(parseSocketMessage("not json")).toBeNull();
    expect(parseSocketMessage('{"type":"bid_placed"}')).toBeNull();
    expect(parseSocketMessage(null)).toBeNull();
    expect(parseSocketMessage(42)).toBeNull();
  });

  it("mapea el estado de auction_ended a mayúsculas", () => {
    const msg = parseSocketMessage(
      '{"type":"auction_ended","auction_id":"abc","state":"finished_no_sale","extra":1}',
    );
    if (msg?.type !== "auction_ended") throw new Error("unreachable");
    expect(stateFromMessage(msg)).toBe("FINISHED_NO_SALE");
  });
});
