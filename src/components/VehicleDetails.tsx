import type { Auction } from "@/lib/auction/types";
import { formatNumber, labelFor } from "@/lib/format";

export function VehicleDetails({ auction }: { auction: Auction }) {
  const specs: [string, string][] = [
    ["Marca", auction.make],
    ["Modelo", auction.model],
    ["Versión", auction.version && auction.version !== "-" ? auction.version : "—"],
    ["Año", String(auction.year)],
    ["Kilometraje", `${formatNumber(auction.odometer)} km`],
    ["Combustible", labelFor(auction.fuelType)],
    ["Transmisión", labelFor(auction.transmissionType)],
    ["Color", auction.color],
    ["Origen", auction.origin],
    ["Ubicación", `${auction.location}, ${labelFor(auction.country)}`],
  ];

  return (
    <div className="space-y-6">
      <section aria-label="Ficha técnica" className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold">Ficha técnica</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
          {specs.map(([k, v]) => (
            <div key={k}>
              <dt className="text-zinc-500">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {auction.description.length > 0 && (
        <section aria-label="Descripción" className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">Descripción</h2>
          <div className="space-y-3 text-sm leading-relaxed text-zinc-700">
            {auction.description.map((text, i) => (
              <p key={i} className="whitespace-pre-line">
                {text}
              </p>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
