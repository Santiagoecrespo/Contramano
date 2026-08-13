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
2. Para un proyecto nuevo, ejecutá una única vez en SQL Editor el contenido completo de [`supabase/migrations/202608120001_realtime_multiplayer.sql`](supabase/migrations/202608120001_realtime_multiplayer.sql), que ya incluye jurados, votación anticipada y el catálogo editorial completo.
   Si tu proyecto ya ejecutó una versión anterior de la primera migración, ejecutá en orden [`202608120002_fix_start_new_round_jurors.sql`](supabase/migrations/202608120002_fix_start_new_round_jurors.sql), [`202608130001_allow_host_early_voting.sql`](supabase/migrations/202608130001_allow_host_early_voting.sql), [`202608130002_expand_editorial_prompt_catalog.sql`](supabase/migrations/202608130002_expand_editorial_prompt_catalog.sql), [`202608130003_tighten_prompt_conflicts.sql`](supabase/migrations/202608130003_tighten_prompt_conflicts.sql) y [`202608130004_add_resilience.sql`](supabase/migrations/202608130004_add_resilience.sql). Todas reemplazan o actualizan datos de forma segura y no borran salas, partidas ni tablas.
3. Copiá `.env.example` como `.env.local` y completá los valores públicos del proyecto:

```dotenv
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=tu_publishable_key
```

4. Reiniciá `npm run dev`. Dentro de una sala aparecerá `EN VIVO` cuando esté usando Supabase.

La migración crea tablas, índices, políticas RLS, mazos persistentes, 60 consignas activas, eventos, RPCs autoritativas y las políticas de Realtime privado. No contiene credenciales ni tareas de expiración: cada RPC valida `expires_at` al ejecutarse.

### Hito 4 — Resiliencia

La migración `202608130004_add_resilience.sql` añade un heartbeat persistido por jugador, reconciliación idempotente y metadatos de pausa. Presence sigue siendo visual: las decisiones de pausa, reanudación y transferencia se hacen con `last_seen_at` en servidor. Con menos de tres personas conectadas la ronda se pausa y congela el tiempo; al volver a tres, sólo el host puede reanudar. Si el host no aparece durante 45 segundos y hay tres personas conectadas, se asigna el host al jugador conectado más antiguo y se registra `host_transferred`.

El debate y la votación se concilian desde cualquier miembro al vencer sus timestamps del servidor. El host conserva el único permiso para adelantar la apertura de votación. Los votos usan una restricción única y una inserción idempotente, por lo que un doble clic o dos pestañas no otorgan puntos dos veces.

La revancha ahora genera una sala nueva con código y link nuevos, puntajes en cero y sólo quienes sigan conectados. La sala anterior conserva sus rondas como historial y muestra el acceso a la nueva mesa.

### Catálogo editorial

Cada modo incluye **60 cartas activas y 20 de reserva**: cuatro activas para cada una de estas 15 situaciones: Asado, Mate, Salidas, Música, Amistades, Redes, Facultad, Laburo, Viajes, Convivencia, Plata, Juegos, Fútbol, Planes y Hábitos. Cada consigna propone una decisión, un límite o una responsabilidad concreta con dos posturas defendibles; no se usan observaciones vagas, conclusiones cerradas ni frases incompletas. El mazo mantiene sus reglas actuales de no repetición, categorías consecutivas y revancha. Las migraciones editoriales sólo actualizan textos y marcan cartas previas fuera de la selección como `reserve`; no eliminan consignas que puedan estar en una ronda histórica ni modifican mazos ya persistidos.

Para probarlo, abrí la sala en perfiles o navegadores separados. El host inicia con tres personas; al terminar el debate su cliente intenta abrir la votación y la RPC comprueba el reloj del servidor. Los botones del host quedan como respaldo, sin permitir adelantar esos tiempos. Sólo votan jurados; se cierra automáticamente si votan todos o el host puede cerrarla al vencer los 30 segundos. Si el host se desconecta, la sala queda esperando su regreso, sin transferencia automática.

### Prueba manual recomendada

Después de ejecutar las migraciones correctivas, abrí una ventana normal y dos incógnitas (o tres navegadores): creá una sala con el host y abrí el link desde las otras dos sesiones. Cada invitado debe ver primero el formulario **Unirme a la mesa**, sin errores de snapshot; ingresá apodos distintos y verificá que el lobby pase a tres personas. Iniciá la partida, comprobá que hay un jurado y usá **Abrir votación ahora** antes de que llegue a cero: sólo el host debe verlo y todos deben pasar a votar. También esperá el fin natural del contador en otra ronda. Si algo falla, revisá la consola: en desarrollo cada RPC registra su nombre y el error de Supabase una sola vez, mientras la interfaz muestra un mensaje entendible.

Para validar Hito 4 con esas mismas tres sesiones:

1. Recargá cada sesión durante lobby, debate, voto, resultado y final: el apodo, rol, puntaje y ronda deben volver desde el snapshot.
2. Durante el debate, cerrá dos sesiones. En menos de 20 segundos la tercera debe ver **“La partida está en pausa: faltan jugadores.”** y el contador debe congelarse. Reabrí una sesión: sólo el host puede pulsar **Reanudar partida**.
3. Cerrá la sesión del host y mantené tres personas conectadas. Después de 45 segundos, un jugador conectado pasa a ser anfitrión y puede reanudar o continuar.
4. Dejá vencer un debate y una votación sin tocar los controles: cualquier sesión abierta reconcilia cada transición una sola vez. Hacé doble clic en el voto del jurado: debe quedar un solo voto.
5. Terminá las cinco rondas y pedí revancha: se abre una URL con otro código, puntajes en cero y la mesa original mantiene el ranking anterior.

## Decisión acordada para `start_round()`

Cuando la cantidad de jugadores activos sea impar, una postura tendrá un integrante extra. La primera vez que ocurra esta situación se elige aleatoriamente qué postura recibe ese integrante; en la siguiente ronda que también tenga una cantidad impar de jugadores activos, se asigna la postura contraria. Las rondas con cantidad par de jugadores no modifican `last_odd_extra_side`.

En el mock local del Hito 2 ya se aplica esta misma regla, después de separar al jurado: `start_round()` rota jurados para evitar repeticiones y equilibrar turnos, asigna posturas aleatoriamente entre quienes debaten, mantiene equipos iguales cuando la cantidad es par, limita la diferencia a una persona cuando es impar, minimiza repeticiones consecutivas y activa recién en la siguiente ronda a quienes entran durante una partida.
