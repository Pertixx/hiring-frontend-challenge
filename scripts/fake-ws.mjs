// Servidor WebSocket falso que imita el protocolo de Motordil.
//
// Sirve para probar lo que no se puede provocar contra staging: pujas cada
// pocos segundos, caída del servidor (matá el proceso), reconexión (volvelo a
// levantar), conexiones "zombie" (NO_PONG=1) y el cierre de la subasta
// (mandale SIGUSR2: `kill -USR2 <pid>`).
//
// Uso:
//   node scripts/fake-ws.mjs [port=3222] [auction_id] [intervalMs=3000] [startAmount=1000]
//   NEXT_PUBLIC_SOCKETS_URL=ws://localhost:3222/ws pnpm dev
//
// Variables: NO_PONG=1 (no contesta pings), PREFIX=xyz (prefijo de bid_id,
// para que un reinicio no repita ids y las pujas no se dedupliquen).
import { createServer } from "node:http";
import { WebSocketServer } from "ws";

const port = Number(process.argv[2] ?? 3222);
const auctionId = process.argv[3] ?? "69fb85b1450fb57c69822837";
const intervalMs = Number(process.argv[4] ?? 3000);
let amount = Number(process.argv[5] ?? 1000);
const prefix = process.env.PREFIX ?? String(Date.now());
let n = 0;

const server = createServer();
const wss = new WebSocketServer({ server, path: "/ws" });
const subscribers = new Set();

wss.on("connection", (ws) => {
  ws.send(JSON.stringify({ type: "identify", socket_id: `fake-${Date.now()}` }));
  // Ruido: un tipo de mensaje que el cliente no conoce.
  ws.send(JSON.stringify({ type: "viewer_count", auction_id: auctionId, count: 12 }));

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (msg.type === "subscribe") {
      subscribers.add(ws);
      ws.send(JSON.stringify({ type: "subscribed", auction_id: msg.auction_id }));
    } else if (msg.type === "unsubscribe") {
      subscribers.delete(ws);
    } else if (msg.type === "ping" && !process.env.NO_PONG) {
      ws.send(JSON.stringify({ type: "pong" }));
    }
  });
  ws.on("close", () => subscribers.delete(ws));
});

function increment(current) {
  if (current <= 1000) return 50;
  if (current <= 5000) return 100;
  if (current <= 10000) return 150;
  if (current <= 25000) return 200;
  return 250;
}

setInterval(() => {
  if (subscribers.size === 0) return;
  n += 1;
  amount += increment(amount);
  const payload = JSON.stringify({
    type: "bid_placed",
    auction_id: auctionId,
    bid_amount: amount,
    bid_id: { $oid: `${prefix}-${String(n).padStart(6, "0")}` },
    placed_at: new Date().toISOString(),
    is_auto: n % 3 === 0,
    bidder_profile: {
      username: n % 2 ? "juanpe" : "lean",
      _id: { $oid: `user-${n % 2}` },
      is_verified: n % 2 === 1,
      avatar_url: null,
    },
  });
  for (const ws of subscribers) ws.send(payload);
  console.log("bid_placed", amount);
}, intervalMs);

process.on("SIGUSR2", () => {
  const payload = JSON.stringify({
    type: "auction_ended",
    auction_id: auctionId,
    state: "finished_sale",
  });
  for (const ws of subscribers) ws.send(payload);
  console.log("auction_ended enviado");
});

server.listen(port, () => {
  console.log(`fake ws en ws://localhost:${port}/ws — subasta ${auctionId} — pid ${process.pid}`);
});
