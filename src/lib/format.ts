const numberFormat = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** "USD 19.250" — el símbolo viene de la API (`currency.symbol`). */
export function formatMoney(amount: number, symbol: string): string {
  return `${symbol} ${numberFormat.format(amount)}`;
}

export function formatNumber(n: number): string {
  return numberFormat.format(n);
}

const dateTimeFormat = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/** Fecha y hora en la zona horaria del usuario. Usar sólo en cliente. */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : dateTimeFormat.format(d);
}

export interface DurationParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
}

export function splitDuration(ms: number): DurationParts {
  const totalMs = Math.max(0, ms);
  const totalSeconds = Math.floor(totalMs / 1000);
  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3_600),
    minutes: Math.floor((totalSeconds % 3_600) / 60),
    seconds: totalSeconds % 60,
    totalMs,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "3d 04:12:09" o "04:12:09" si falta menos de un día. */
export function formatDuration(ms: number): string {
  const { days, hours, minutes, seconds } = splitDuration(ms);
  const hms = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return days > 0 ? `${days}d ${hms}` : hms;
}

const LABELS: Record<string, string> = {
  FUEL: "Nafta",
  DIESEL: "Diésel",
  GAS: "GNC",
  HYBRID: "Híbrido",
  ELECTRIC: "Eléctrico",
  MANUAL: "Manual",
  AUTOMATIC: "Automática",
  SEMI_AUTOMATIC: "Semiautomática",
  ARGENTINA: "Argentina",
  URUGUAY: "Uruguay",
  CAR: "Auto",
  MOTORCYCLE: "Moto",
  AUTOMOBILIA: "Automobilia",
  BOAT: "Embarcación",
};

export function labelFor(enumValue: string): string {
  return LABELS[enumValue] ?? enumValue;
}
