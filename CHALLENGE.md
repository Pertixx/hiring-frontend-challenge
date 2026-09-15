# Ejercicio técnico — Frontend

Hola, y gracias por el tiempo.

Este ejercicio es una pantalla de nuestro producto: **la vista de una subasta en
vivo**. Vas a trabajar contra nuestra API real de staging, así que los datos que
veas son de verdad (de prueba, pero de verdad) y las pujas entran solas mientras
lo tenés abierto.

**Es 100% frontend.** No vas a escribir nada de backend.

---

## Tiempo

**Entre 3 y 4 horas.** Ese es el tiempo de trabajo esperado, no el plazo.

El plazo para entregar te lo pasamos por mail y es holgado a propósito: es para
que lo acomodes a tu semana, no para que le dediques más horas.

**Si a las cuatro horas no llegaste, entregá lo que tengas.** Contá en el README
qué falta y cómo lo hubieras resuelto. No baja la nota — saber qué dejar afuera
es parte de lo que miramos.

---

## Qué construir

Una página en **Next.js**: `/subasta/[slug]`.

Tiene que mostrar el vehículo, el precio actual, el historial de pujas y cuánto
falta para que la subasta cierre. Y tiene que mantenerse al día sola mientras la
gente puja.

### Requisitos

1. **Traer la subasta desde la API de GraphQL.**
   La query `auction(slug:)` te da todo: datos del vehículo, imágenes,
   `currentBid`, `bids`, `countBids`, `endsAt` y `state`.

2. **Conectarte al WebSocket y suscribirte a esa subasta.**
   Cada puja nueva tiene que verse en pantalla sin recargar: el precio actual y
   el historial.

3. **Un contador de cuánto falta para el cierre.**
   Contra `endsAt`. Pensá de dónde sale la hora contra la que comparás.

4. **Que el usuario entienda el estado de la conexión.**
   El socket se cae: se pierde el wifi, el navegador manda la pestaña a
   background, el servidor se reinicia. Cuando eso pasa, lo que hay en pantalla
   dejó de ser confiable. Resolvelo como te parezca — pero que el usuario no se
   quede mirando un precio viejo creyendo que es el actual.

5. **Los estados que no son el camino feliz.**
   Cargando, la subasta no existe, la subasta ya terminó, la API no responde.
   Son parte del ejercicio, no un extra.

### El botón de pujar va, pero no puja

Ponelo en pantalla, con el próximo monto válido calculado, y deshabilitado o con
un `onClick` vacío. Pujar de verdad requiere sesión y no te vamos a dar una: nos
interesa cómo lo mostrás, no la mutación.

El incremento mínimo depende del precio actual:

| Precio actual | Incremento mínimo |
| --- | --- |
| hasta 1.000 | 50 |
| hasta 5.000 | 100 |
| hasta 10.000 | 150 |
| hasta 25.000 | 200 |
| más de 25.000 | 250 |

---

## Lo que explícitamente **no** hace falta

Esta lista es en serio. Existe para que no quemes tiempo en lo que no miramos.

- **No hace falta que sea lindo.** No hay Figma y no evaluamos diseño visual.
  Que se entienda y esté prolijo alcanza. Usá la librería de componentes que
  quieras, o ninguna.
- **No hace falta autenticación**, ni login, ni el flujo de pujar de verdad.
- **No hace falta suite de tests.** Si querés escribir uno o dos donde te
  parezca que aportan, sumá; si no, no resta.
- **No hace falta responsive perfecto.** Que no se rompa en un celular alcanza.
- **No hace falta el listado de subastas**, ni buscador, ni filtros, ni
  comentarios, ni watchlist.
- **No hace falta desplegarlo.** Con que corra en local alcanza.
- **No hace falta terminar todo.**

---

## Los endpoints

Están en `.env.example`. Son de solo lectura y los datos son de prueba: no hay
información de nadie real.

```
NEXT_PUBLIC_GRAPHQL_API_URL=https://api.motordil.dev/graphql
NEXT_PUBLIC_SOCKETS_URL=wss://ah-ws.motordil.dev/ws
```

El slug de una subasta que está en vivo ahora mismo te lo pasamos en el mail.

El schema recortado está en [`schema.graphql`](./schema.graphql) — sólo los
tipos que necesitás. Si preferís hacer introspección contra el endpoint, podés.

---

## El protocolo del socket

Es un **WebSocket plano**: no es `socket.io` ni `graphql-ws`. Mensajes JSON en
los dos sentidos.

### Lo que le mandás

```jsonc
{ "type": "subscribe",   "auction_id": "6712a…" }   // apenas abre
{ "type": "unsubscribe", "auction_id": "6712a…" }
{ "type": "ping" }                                   // keepalive
```

### Lo que te contesta

```jsonc
{ "type": "identify",         "socket_id": "…" }
{ "type": "subscribed",       "auction_id": "…" }
{ "type": "failed_subscribe", "auction_id": "…", "message": "…" }
{ "type": "pong" }
```

### Los eventos de la subasta

```jsonc
{
  "type": "bid_placed",
  "auction_id": "6712a…",
  "bid_amount": 19250.0,
  "bid_id": "6712b…",
  "placed_at": "2026-08-29T18:04:11.291Z",
  "is_auto": false,
  "bidder_profile": {
    "username": "juanpe",
    "_id": { "$oid": "…" },
    "is_verified": true,
    "avatar_url": null
  }
}

{ "type": "auction_ended", "auction_id": "…", "state": "finished_sale", … }
```

### Dos avisos

Los payloads vienen en **`snake_case`** y algunos ids llegan envueltos como
`{ "$oid": "…" }`. Es el formato crudo de la base y no lo vamos a limpiar para
vos.

Y el servidor emite **otros tipos de mensaje** además de estos. Tu código no
debería romperse con uno que no conoce.

---

## Cómo entregar

Un repositorio de Git: podés forkear este, subirlo a tu cuenta, o mandarnos un
zip con el `.git` adentro. Nos interesa ver los commits.

Y un **README** que conteste tres cosas:

1. **Cómo lo corro.** Comandos, variables de entorno, versión de Node.
2. **Qué decidiste no hacer, y por qué.** Esta es la que más leemos.
3. **Qué harías distinto con una semana.** Dos o tres párrafos, no un documento.

---

## Sobre herramientas de IA

Usá las que uses normalmente. Nosotros también las usamos, todos los días.

Lo único que pedimos es que puedas explicar cualquier línea de lo que entregues.

---

## Si algo no funciona

Si la API no responde, si el slug que te pasamos ya cerró, o si algo del
enunciado no se entiende: **escribinos**. No es parte del desafío y lo
resolvemos en el momento.
