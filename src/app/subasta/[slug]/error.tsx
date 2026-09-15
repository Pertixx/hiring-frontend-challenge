"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Error boundary del segmento: acá cae cualquier error del render en server,
 * en la práctica "la API no respondió" o devolvió algo inválido.
 */
export default function AuctionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[subasta] error al cargar", error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">No pudimos cargar la subasta</h1>
      <p className="text-zinc-600">
        La API no respondió o devolvió un error. Puede ser un problema
        momentáneo.
      </p>
      {error.message && (
        <p className="rounded bg-zinc-100 p-2 font-mono text-xs text-zinc-600">
          {error.message}
        </p>
      )}
      <div className="flex justify-center gap-3">
        <button
          onClick={reset}
          className="rounded bg-zinc-900 px-4 py-2 font-medium text-white"
        >
          Reintentar
        </button>
        <Link href="/" className="rounded border border-zinc-300 px-4 py-2">
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
