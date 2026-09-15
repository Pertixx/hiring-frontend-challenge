# Subasta en vivo — ejercicio técnico frontend

Vista de una subasta en vivo de Motordil: `/subasta/[slug]`. Trae la subasta
por GraphQL, se suscribe al WebSocket para recibir pujas, muestra un contador
contra `endsAt` con hora del servidor, y le dice al usuario cuándo lo que ve
puede estar desactualizado.

El enunciado original está en [`CHALLENGE.md`](./CHALLENGE.md).

## 1. Cómo lo corro

Requisitos: **Node 20 o superior** (desarrollado con Node 24.11) y **pnpm**
(desarrollado con pnpm 11; `corepack enable` lo instala solo).

```bash
cp .env.example .env.local
# completar NEXT_PUBLIC_DEMO_AUCTION_SLUG con el slug que llegó por mail
pnpm install
pnpm dev
```

Abrir `http://localhost:3000/subasta/<slug>`. La home (`/`) tiene un input
para escribir un slug y un link al slug de demo.

Variables de entorno (todas `NEXT_PUBLIC_*`, se usan en server y en cliente):

| Variable                        | Qué es                                                   |
| ------------------------------- | -------------------------------------------------------- |
| `NEXT_PUBLIC_GRAPHQL_API_URL`   | Endpoint GraphQL de staging.                             |
| `NEXT_PUBLIC_SOCKETS_URL`       | WebSocket plano de pujas.                                |
| `NEXT_PUBLIC_DEMO_AUCTION_SLUG` | Opcional. Slug que se ofrece como link en la home.       |

Otros comandos:

```bash
pnpm test        # tests unitarios (vitest) de la lógica pura
pnpm lint        # eslint (config de Next + reglas de hooks de React 19)
pnpm typecheck   # tsc --noEmit
pnpm build       # build de producción
```

### Reproducir caídas y pujas sin depender de staging

Contra staging no se puede provocar una puja, una caída del servidor ni el
cierre de la subasta. Para eso hay un servidor WebSocket falso que habla el
mismo protocolo:

```bash
pnpm fake-ws                       # escucha en ws://localhost:3222/ws
NEXT_PUBLIC_SOCKETS_URL=ws://localhost:3222/ws pnpm dev
```

- Emite un `bid_placed` cada 3 segundos (y un mensaje de tipo desconocido al
  conectar, para verificar que se ignora).
- Matá el proceso para ver el estado "se perdió la conexión"; volvé a
  levantarlo para ver la reconexión y la resincronización.
- `NO_PONG=1 pnpm fake-ws` simula una conexión "zombie": abierta pero muda.
  El cliente la detecta por falta de `pong` y reconecta (~28 s).
- `kill -USR2 <pid>` manda `auction_ended`.

El GraphQL sigue siendo el real, así que al reconectar el cliente pide el
snapshot verdadero y lo combina con las pujas falsas sin duplicar.

## Cómo está armado

```
src/
  app/
    subasta/[slug]/page.tsx     server component: trae el snapshot inicial
    subasta/[slug]/loading.tsx  skeleton
    subasta/[slug]/not-found.tsx
    subasta/[slug]/error.tsx    la API no respondió / devolvió error
    api/time/route.ts           hora del servidor de la API (header Date)
  components/                   vista y piezas de UI (cliente)
  hooks/
    useLiveAuction.ts           orquesta socket + snapshot + estado de frescura
    useServerClock.ts           offset servidor–cliente
    useCountdown.ts             cuenta regresiva sobre el reloj corregido
  lib/
    graphql/                    cliente fetch mínimo + query y mapeo a dominio
    socket/auction-socket.ts    wrapper del WebSocket (reconexión, keepalive)
    socket/messages.ts          parseo con zod de los mensajes del socket
    auction/bidding.ts          incremento mínimo / próxima puja
    auction/live-state.ts       funciones puras que aplican eventos al estado
    time/                       reloj de servidor y ticker compartido
```

**Flujo.** El server component hace la query y renderiza la página con datos
reales (funciona sin JS y es lo que ve el usuario mientras carga el bundle).
El cliente arranca con ese snapshot, abre el socket y manda `subscribe`. La
conexión se considera "en vivo" recién cuando llega `subscribed`, no cuando
abre el socket. En ese momento, y en cada reconexión, el cliente vuelve a pedir
la subasta a la API para cubrir cualquier puja que haya pasado mientras no
escuchaba, y re-sincroniza el reloj. Después, cada `bid_placed` se aplica
localmente (deduplicado por `bid_id`) y `auction_ended` cierra la vista.

**Estado de conexión.** Hay dos cosas separadas que la UI muestra: el estado
del socket (`connecting`, `live`, `reconnecting`, `offline`, `failed`) y la
*frescura* de los datos (`fresh`, `syncing`, `stale`). Cuando la conexión se
pierde por cualquier motivo, el panel de precio pasa a "Último precio
conocido", se atenúa, dice cuándo fue la última sincronización, el botón de
pujar cambia su texto de ayuda, y aparece un banner con el número de reintento
y un botón para reintentar ya. El socket manda `ping` cada 20 s y si no hay
`pong` en 8 s da la conexión por muerta y reconecta (es el caso típico al
volver de background o cambiar de red: el browser cree que el socket sigue
abierto). También escucha `online`/`offline` y `visibilitychange`.

**Hora del contador.** No se confía en el reloj del dispositivo. La respuesta
de la API trae el header `Date`; el server component lo lee y lo pasa al
cliente para sembrar un offset servidor–cliente. Como el browser no puede leer
ese header (no es CORS-safelisted), hay un route handler `/api/time` que le
pega a la API, lee el `Date` y lo devuelve; el cliente lo llama al montar y
en cada reconexión, corrigiendo por la mitad del round-trip. El contador se
recalcula desde `endsAt` en cada tick, no decrementa un contador, así que no
se desfasa si el browser frena los timers en background. Si el contador llega
a cero y todavía no llegó `auction_ended`, muestra "cerrando, esperando
confirmación" y re-pide el snapshot a los 2, 8 y 20 segundos.

**Mensajes desconocidos.** Todo lo que entra por el socket pasa por un
`discriminatedUnion` de zod; si no matchea, se descarta. Los ids aceptan
`string` o `{ $oid }`.

## 2. Qué decidí no hacer, y por qué

- **Sin cliente GraphQL (Apollo, urql) ni codegen.** Hay una sola query y el
  estado en vivo lo maneja el socket, no una cache normalizada. Un `fetch`
  de 60 líneas con timeout y errores tipados alcanza y es más fácil de leer.
  Los tipos están escritos a mano a partir de `schema.graphql`; con codegen
  se validarían contra el schema, pero para una query no lo vale.
- **Sin store global.** El estado vive en un `useReducer` dentro de
  `useLiveAuction`, y las transiciones son funciones puras testeadas
  (`live-state.ts`). No hay nada que compartir entre rutas.
- **El botón de pujar está siempre deshabilitado.** Muestra el próximo monto
  válido y el incremento, y el texto de ayuda distingue "requiere sesión" de
  "no hay conexión en vivo". No tiene sentido un botón habilitado que no hace
  nada. Con precio `null` (sin pujas) se asume base 0 porque el schema
  recortado no expone precio de salida; la primera puja válida sería 50.
- **Sin `next/image`.** Las URLs de los assets vienen con espacios sin
  encodear y no vale la pena configurar `remotePatterns` y un loader para
  tres imágenes. Es un `<img>` plano con el lint deshabilitado en esa línea.
- **No se renderizan `Attributes` ni `EmbedGallery`** (partes del `parts`
  union). No aportan a la vista de puja; sólo se usan `MainImage`,
  `ImageGallery` y `Description`.
- **Subastas `PENDING`** se muestran con badge "Próximamente" y sin contador
  hacia `startsAt`. El enunciado pide el contador de cierre, y no encontré
  ninguna subasta pendiente en staging para verificarlo.
- **Tests sólo de la lógica pura**: tramos de incremento, parseo de mensajes
  del socket (incluyendo `$oid`, tipos desconocidos y JSON inválido) y el
  reducer de estado en vivo (dedupe, puja tardía menor, merge con snapshot,
  no volver a LIVE lo que ya terminó). Los hooks y componentes los verifiqué
  a mano con el servidor falso y con Playwright, pero no dejé esos tests en
  el repo: montar jsdom, mocks de WebSocket y timers falsos para 3 hooks era
  más tiempo que el que pide el ejercicio, y aportan menos que las
  funciones puras.
- **No se manejan extensiones de `endsAt`** (anti-sniping) por socket, porque
  el protocolo documentado no tiene un evento para eso. Si existiera, entra
  por el `passthrough` de zod sin romper nada, y el snapshot que se pide al
  reconectar o cuando el contador llega a cero trae el `endsAt` nuevo.
- **El código HTTP de "no existe" es 200, no 404**, cuando se entra por URL
  directa. Es una consecuencia de tener `loading.tsx`: Next manda el shell en
  streaming antes de que el server component resuelva y ya no puede cambiar
  el status. Preferí el skeleton de carga (es un requisito explícito) al
  status code. Se arregla sacando `loading.tsx` o resolviendo la query en un
  layout/middleware antes de streamear.
- **Sin diseño, sin librería de componentes, responsive básico.** Tailwind
  para no escribir CSS y una columna en celular. Comprobé que no hay scroll
  horizontal a 390 px.
- **Sin deploy.**

## 3. Qué haría distinto con una semana

Primero sacaría el manejo del socket de la página y lo convertiría en un
gestor de conexión compartido: una sola conexión por pestaña, suscripciones a
varias subastas (listado + detalle), y un contexto que exponga estado y
eventos. Le pediría al backend un número de secuencia por evento (o un
`since` en la query de pujas) para que al reconectar se pidan sólo las pujas
que faltan en vez del snapshot completo, y un endpoint de hora explícito en
lugar de leer el header `Date` de una respuesta cualquiera, que tiene
precisión de segundos.

Después, tests de integración con Playwright y el servidor falso corriendo en
CI: los escenarios que hoy probé a mano (pujas entrando, caída y reconexión,
conexión zombie, cierre por `auction_ended`, offline/online) quedan
automatizados y son justamente los que más se rompen con refactors. Sumaría
codegen de GraphQL para que los tipos no se desactualicen del schema, y
`next/image` con los dominios de assets configurados.

Por último, observabilidad y pulido: loguear reconexiones y latencia de
eventos (cuánto tarda una puja desde `placed_at` hasta pintarse), medir
cuántos usuarios ven el banner de desconexión y por cuánto tiempo, un pase de
accesibilidad sobre el contador y las regiones `aria-live`, y un diseño real
sobre estas mismas piezas.
