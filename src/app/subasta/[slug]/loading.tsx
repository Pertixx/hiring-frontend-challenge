export default function Loading() {
  return (
    <main
      className="mx-auto w-full max-w-6xl animate-pulse p-4 sm:p-6"
      aria-busy="true"
      aria-label="Cargando subasta"
    >
      <div className="mb-6 h-8 w-2/3 rounded bg-zinc-200" />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div className="aspect-video w-full rounded-lg bg-zinc-200" />
          <div className="h-4 w-full rounded bg-zinc-200" />
          <div className="h-4 w-5/6 rounded bg-zinc-200" />
          <div className="h-4 w-4/6 rounded bg-zinc-200" />
        </div>
        <div className="space-y-4">
          <div className="h-40 rounded-lg bg-zinc-200" />
          <div className="h-64 rounded-lg bg-zinc-200" />
        </div>
      </div>
      <p className="sr-only">Cargando…</p>
    </main>
  );
}
