import Link from "next/link";

export default function AuctionNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">Esta subasta no existe</h1>
      <p className="text-zinc-600">
        No encontramos ninguna subasta con ese slug. Puede que el link esté mal
        o que la subasta haya sido eliminada.
      </p>
      <Link href="/" className="text-sm underline">
        Volver al inicio
      </Link>
    </main>
  );
}
