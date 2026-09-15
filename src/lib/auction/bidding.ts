/**
 * Reglas de incremento mínimo según el enunciado:
 *
 * | Precio actual  | Incremento |
 * | hasta 1.000    | 50         |
 * | hasta 5.000    | 100        |
 * | hasta 10.000   | 150        |
 * | hasta 25.000   | 200        |
 * | más de 25.000  | 250        |
 *
 * "hasta" se interpreta como inclusivo: con precio 1.000 el incremento es 50.
 */
const INCREMENT_TIERS: ReadonlyArray<readonly [upTo: number, increment: number]> =
  [
    [1_000, 50],
    [5_000, 100],
    [10_000, 150],
    [25_000, 200],
  ];
const TOP_INCREMENT = 250;

export function minIncrement(currentAmount: number): number {
  for (const [upTo, increment] of INCREMENT_TIERS) {
    if (currentAmount <= upTo) return increment;
  }
  return TOP_INCREMENT;
}

/**
 * Próximo monto válido para pujar. Si todavía no hay pujas, se asume base 0
 * (la API no expone precio de salida en el schema recortado), así que la
 * primera puja válida es el incremento mínimo del primer tramo.
 */
export function nextMinBid(currentAmount: number | null | undefined): number {
  const base = currentAmount ?? 0;
  return base + minIncrement(base);
}
