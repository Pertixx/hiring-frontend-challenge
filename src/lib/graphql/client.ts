import { env } from "@/lib/env";

export class GraphQLRequestError extends Error {
  constructor(
    message: string,
    public readonly kind: "network" | "http" | "graphql",
    public readonly status?: number,
  ) {
    super(message);
    this.name = "GraphQLRequestError";
  }
}

export interface GraphQLResult<T> {
  data: T;
  /**
   * Hora del servidor de la API según el header `Date` de la respuesta
   * (epoch ms). Es la referencia contra la que se compara `endsAt`.
   * `null` si el header no está disponible (por ejemplo, desde el browser:
   * `Date` no es un header CORS-safelisted y la API no lo expone).
   */
  serverTime: number | null;
}

/**
 * Cliente GraphQL mínimo sobre `fetch`. No hay cache ni normalización porque
 * la vista tiene una sola query y el estado en vivo lo maneja el socket.
 */
export async function gqlRequest<T>(
  query: string,
  variables: Record<string, unknown> = {},
  init: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<GraphQLResult<T>> {
  const timeoutMs = init.timeoutMs ?? 10_000;
  const signal = init.signal
    ? AbortSignal.any([init.signal, AbortSignal.timeout(timeoutMs)])
    : AbortSignal.timeout(timeoutMs);

  let res: Response;
  try {
    res = await fetch(env.graphqlUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
      signal,
    });
  } catch (err) {
    const message =
      err instanceof Error && err.name === "TimeoutError"
        ? "La API no respondió a tiempo."
        : "No se pudo conectar con la API.";
    throw new GraphQLRequestError(message, "network");
  }

  if (!res.ok) {
    throw new GraphQLRequestError(
      `La API respondió con HTTP ${res.status}.`,
      "http",
      res.status,
    );
  }

  const body = (await res.json()) as {
    data?: T;
    errors?: { message: string }[];
  };

  if (body.errors?.length || body.data === undefined) {
    const detail = body.errors?.map((e) => e.message).join("; ");
    throw new GraphQLRequestError(
      `La API devolvió un error: ${detail ?? "respuesta sin datos"}.`,
      "graphql",
      res.status,
    );
  }

  const dateHeader = res.headers.get("date");
  const parsed = dateHeader ? Date.parse(dateHeader) : NaN;

  return {
    data: body.data,
    serverTime: Number.isNaN(parsed) ? null : parsed,
  };
}
