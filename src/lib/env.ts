/**
 * Variables de entorno públicas (NEXT_PUBLIC_*) usadas tanto en el server
 * como en el browser. Se leen con acceso directo a `process.env.NEXT_PUBLIC_X`
 * para que Next las inline-e en el bundle del cliente.
 */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Falta la variable de entorno ${name}. Copiá .env.example a .env.local.`,
    );
  }
  return value;
}

export const env = {
  graphqlUrl: required(
    "NEXT_PUBLIC_GRAPHQL_API_URL",
    process.env.NEXT_PUBLIC_GRAPHQL_API_URL,
  ),
  socketsUrl: required(
    "NEXT_PUBLIC_SOCKETS_URL",
    process.env.NEXT_PUBLIC_SOCKETS_URL,
  ),
  demoAuctionSlug: process.env.NEXT_PUBLIC_DEMO_AUCTION_SLUG ?? "",
};
