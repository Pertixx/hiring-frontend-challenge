"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * `false` durante SSR e hidratación, `true` después. Sirve para no renderizar
 * en el server cosas que dependen del reloj o de la zona horaria del usuario
 * (evita mismatches de hidratación).
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
