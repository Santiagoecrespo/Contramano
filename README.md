# Contramano

Juego web para juntadas: entrás por QR o link, te toca una postura, debatís, votás y sumás puntos. No es una app instalable.

## Hitos 1, 2 y 3

Incluye landing mobile-first, creación y unión simuladas, lobby, QR, enlace de WhatsApp, diseño responsive y almacenamiento mock en `localStorage`.

El juego permite cinco rondas con **jurado rotativo**: la sala admite de 3 a 8 personas; con 3–5 juega un jurado y con 6–8, dos. El jurado no debate ni recibe postura, vota en privado y el resto se divide en equipos A/B balanceados. Si los dos jurados empatan, aparece “Desempate del caos” y se informa que la postura ganadora fue elegida aleatoriamente. Con Supabase configurado, las salas se sincronizan en tiempo real.

Cada sala crea dos mazos persistentes, uno `tranqui` y otro `bardo`. Las consignas se mezclan una vez, se consumen sin repetirse y el historial queda en el adaptador activo: `localStorage` en modo mock o PostgreSQL en modo realtime. La revancha reinicia sólo la partida: continúa con la siguiente consigna del mazo. Al cambiar intensidad entre rondas, se retoma el mazo independiente de ese modo. Al agotarse, el mazo se remezcla y retrasa las últimas cinco consignas del ciclo anterior.

## Ejecutar

```powershell
npm install
npm run dev
```

Abrí la URL que muestre Vite. Para probar el flujo completo: creá una sala, usá **Completar mesa de demo**, empezá la partida, solicitá un cambio de consigna, abrí la votación y usá **Completar votos de demo**. Repetí hasta el ranking final y elegí **Revancha**. Para ver el rol de jurado en otro navegador, abrí el link de sala, ingresá otro apodo antes de iniciar y recargá luego de cada cambio local.

## Validar

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
```

## Variables de entorno

Copiá `.env.example` a `.env.local` sólo al configurar Supabase en el Hito 3. Nunca subas `.env` ni `.env.local`.

## Hito 3: Supabase realtime

La app suma modo multijugador realtime con Supabase: autenticación anónima, RLS, RPCs para todas las mutaciones, Broadcast privado para refrescar snapshots y Presence usado sólo como indicador visual. Cada snapshot devuelve `server_now`; el cliente conserva su diferencia con el reloj local para mostrar los temporizadores contra el reloj del servidor.

Sin variables de Supabase, el adaptador local de Hito 2 sigue siendo el respaldo y la demo funciona sin red.

### Configuración manual

1. Creá un proyecto en Supabase y activá **Anonymous sign-ins** en Authentication > Providers.
2. Ejecutá una única vez en SQL Editor el contenido completo de [`supabase/migrations/202608120001_realtime_multiplayer.sql`](supabase/migrations/202608120001_realtime_multiplayer.sql).
3. Copiá `.env.example` como `.env.local` y completá los valores públicos del proyecto:

```dotenv
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=tu_publishable_key
```

4. Reiniciá `npm run dev`. Dentro de una sala aparecerá `EN VIVO` cuando esté usando Supabase.

La migración crea tablas, índices, políticas RLS, mazos persistentes, 60 consignas activas, eventos, RPCs autoritativas y las políticas de Realtime privado. No contiene credenciales ni tareas de expiración: cada RPC valida `expires_at` al ejecutarse.

Para probarlo, abrí la sala en perfiles o navegadores separados. El host inicia con tres personas; al terminar el debate su cliente intenta abrir la votación y la RPC comprueba el reloj del servidor. Los botones del host quedan como respaldo, sin permitir adelantar esos tiempos. Sólo votan jurados; se cierra automáticamente si votan todos o el host puede cerrarla al vencer los 30 segundos. Si el host se desconecta, la sala queda esperando su regreso, sin transferencia automática.

## Decisión acordada para `start_round()`

Cuando la cantidad de jugadores activos sea impar, una postura tendrá un integrante extra. La primera vez que ocurra esta situación se elige aleatoriamente qué postura recibe ese integrante; en la siguiente ronda que también tenga una cantidad impar de jugadores activos, se asigna la postura contraria. Las rondas con cantidad par de jugadores no modifican `last_odd_extra_side`.

En el mock local del Hito 2 ya se aplica esta misma regla, después de separar al jurado: `start_round()` rota jurados para evitar repeticiones y equilibrar turnos, asigna posturas aleatoriamente entre quienes debaten, mantiene equipos iguales cuando la cantidad es par, limita la diferencia a una persona cuando es impar, minimiza repeticiones consecutivas y activa recién en la siguiente ronda a quienes entran durante una partida.
