"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import type { Auction } from "@/lib/auction/types";
import { isFinished } from "@/lib/auction/types";
import {
  applyAuctionEnded,
  applyBidPlaced,
  reconcileWithSnapshot,
} from "@/lib/auction/live-state";
import { fetchAuction } from "@/lib/graphql/auction";
import { env } from "@/lib/env";
import { AuctionSocket, type ConnectionStatus } from "@/lib/socket/auction-socket";
import { bidFromMessage, stateFromMessage } from "@/lib/socket/messages";
import { syncServerClock } from "@/lib/time/server-clock";

/**
 * Qué tan confiable es lo que hay en pantalla:
 *  - `fresh`:   suscritos y con snapshot posterior a la última (re)conexión.
 *  - `syncing`: acabamos de (re)conectar y estamos pidiendo el snapshot.
 *  - `stale`:   sin conexión en vivo: el precio puede estar viejo.
 */
export type Freshness = "fresh" | "syncing" | "stale";

export interface LiveAuctionState {
  auction: Auction;
  connection: ConnectionStatus;
  attempt: number;
  freshness: Freshness;
  /** epoch ms (reloj cliente) del último snapshot exitoso de la API. */
  lastSyncedAt: number | null;
  /** Mensaje si el último intento de sincronizar falló. */
  syncError: string | null;
  /** Id de la última puja que entró por socket, para resaltarla. */
  lastLiveBidId: string | null;
  /** Detalle del último `failed_subscribe`, si lo hubo. */
  failureReason: string | null;
}

type Action =
  | { type: "status"; status: ConnectionStatus; attempt: number; reason?: string }
  | { type: "bid_placed"; bid: ReturnType<typeof bidFromMessage> }
  | { type: "auction_ended"; state: Auction["state"]; at: string }
  | { type: "sync_start" }
  | { type: "sync_ok"; snapshot: Auction; at: number }
  | { type: "sync_error"; message: string };

function reducer(state: LiveAuctionState, action: Action): LiveAuctionState {
  switch (action.type) {
    case "status": {
      const live = action.status === "live";
      return {
        ...state,
        connection: action.status,
        attempt: action.attempt,
        // Al conectar pasamos a "syncing" (viene un snapshot); al caernos,
        // todo lo que hay en pantalla deja de ser confiable. `connecting` y
        // `closed` no cambian la frescura.
        freshness: live
          ? "syncing"
          : action.status === "connecting" || action.status === "closed"
            ? state.freshness
            : "stale",
        failureReason: action.status === "failed" ? (action.reason ?? "") : state.failureReason,
      };
    }
    case "bid_placed":
      return {
        ...state,
        auction: applyBidPlaced(state.auction, action.bid),
        lastLiveBidId: action.bid.id,
      };
    case "auction_ended":
      return {
        ...state,
        auction: applyAuctionEnded(state.auction, action.state, action.at),
      };
    case "sync_start":
      return { ...state, syncError: null };
    case "sync_ok":
      return {
        ...state,
        auction: reconcileWithSnapshot(state.auction, action.snapshot),
        lastSyncedAt: action.at,
        syncError: null,
        // Sólo es "fresh" si además seguimos suscritos; si el socket se cayó
        // mientras pedíamos el snapshot, seguimos en "stale".
        freshness: state.connection === "live" ? "fresh" : state.freshness,
      };
    case "sync_error":
      return { ...state, syncError: action.message };
  }
}

function initialState(auction: Auction): LiveAuctionState {
  const finished = isFinished(auction.state);
  return {
    auction,
    connection: finished ? "closed" : "connecting",
    attempt: 0,
    // El snapshot del SSR es fresco al renderizar; hasta que el socket
    // confirme la suscripción estamos "sincronizando", no "desactualizados".
    freshness: finished ? "fresh" : "syncing",
    lastSyncedAt: null,
    syncError: null,
    lastLiveBidId: null,
    failureReason: null,
  };
}

/**
 * Orquesta la subasta en vivo:
 *  1. arranca con el snapshot que vino del server (SSR);
 *  2. abre el socket y aplica `bid_placed` / `auction_ended`;
 *  3. cada vez que la suscripción se confirma (primera vez o reconexión),
 *     pide un snapshot fresco a la API para cubrir lo que se perdió mientras
 *     no estábamos escuchando, y re-sincroniza el reloj;
 *  4. expone el estado de conexión y de frescura para que la UI lo muestre.
 */
export function useLiveAuction(initial: Auction) {
  const [state, dispatch] = useReducer(reducer, initial, initialState);

  const socketRef = useRef<AuctionSocket | null>(null);
  const syncAbortRef = useRef<AbortController | null>(null);
  const slug = initial.slug;

  const resync = useCallback(async () => {
    syncAbortRef.current?.abort();
    const controller = new AbortController();
    syncAbortRef.current = controller;
    dispatch({ type: "sync_start" });
    try {
      const [{ auction }] = await Promise.all([
        fetchAuction(slug, { signal: controller.signal }),
        syncServerClock(),
      ]);
      if (controller.signal.aborted) return;
      if (!auction) {
        dispatch({ type: "sync_error", message: "La subasta ya no existe en la API." });
        return;
      }
      dispatch({ type: "sync_ok", snapshot: auction, at: Date.now() });
    } catch (err) {
      if (controller.signal.aborted) return;
      dispatch({
        type: "sync_error",
        message: err instanceof Error ? err.message : "No se pudo actualizar la subasta.",
      });
    }
  }, [slug]);

  const finished = isFinished(state.auction.state);

  useEffect(() => {
    if (finished) {
      // Nada más que escuchar. Cerramos si había socket y pedimos un último
      // snapshot para tener el resultado oficial (ganador, etc.).
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
        void resync();
      }
      return;
    }

    const socket = new AuctionSocket({
      url: env.socketsUrl,
      auctionId: initial.id,
      handlers: {
        onStatus: (status, { attempt, reason }) => {
          dispatch({ type: "status", status, attempt, reason });
          if (status === "live") void resync();
        },
        onMessage: (msg) => {
          if (msg.type === "bid_placed") {
            if (msg.auction_id !== initial.id) return;
            dispatch({ type: "bid_placed", bid: bidFromMessage(msg) });
          } else if (msg.type === "auction_ended") {
            if (msg.auction_id !== initial.id) return;
            dispatch({
              type: "auction_ended",
              state: stateFromMessage(msg),
              at: new Date().toISOString(),
            });
          }
        },
      },
    });
    socketRef.current = socket;
    socket.connect();

    return () => {
      socket.close();
      if (socketRef.current === socket) socketRef.current = null;
      syncAbortRef.current?.abort();
    };
  }, [finished, initial.id, resync]);

  const reconnect = useCallback(() => {
    if (socketRef.current) socketRef.current.reconnectNow();
    else void resync();
  }, [resync]);

  return { ...state, resync, reconnect };
}
