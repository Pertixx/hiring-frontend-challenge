import Link from "next/link";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";

async function go(formData: FormData) {
  "use server";
  const slug = String(formData.get("slug") ?? "").trim();
  if (slug) redirect(`/subasta/${encodeURIComponent(slug)}`);
}

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">Motordil — subasta en vivo</h1>
      <p className="text-zinc-600">
        Ingresá el slug de una subasta para abrir su vista en vivo.
      </p>
      <form action={go} className="flex gap-2">
        <input
          name="slug"
          defaultValue={env.demoAuctionSlug}
          placeholder="2000-honda-s2000-cneg"
          className="flex-1 rounded border border-zinc-300 bg-white px-3 py-2"
        />
        <button
          type="submit"
          className="rounded bg-zinc-900 px-4 py-2 font-medium text-white"
        >
          Abrir
        </button>
      </form>
      {env.demoAuctionSlug && (
        <p className="text-sm text-zinc-500">
          Demo:{" "}
          <Link
            className="underline"
            href={`/subasta/${encodeURIComponent(env.demoAuctionSlug)}`}
          >
            /subasta/{env.demoAuctionSlug}
          </Link>
        </p>
      )}
    </main>
  );
}
