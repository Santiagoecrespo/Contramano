# Contramano

Juego web para juntadas: entrás por QR o link, te toca una postura, debatís, votás y sumás puntos. No es una app instalable.

## Hitos 1 y 2

Incluye landing mobile-first, creación y unión simuladas, lobby, QR, enlace de WhatsApp, diseño responsive y almacenamiento mock en `localStorage`.

El juego local ya permite cinco rondas: equipos A/B balanceados, posturas que intentan alternar, temporizadores visuales, solicitud de cambio de consigna, votación, puntajes, empate, ranking final y revancha. Supabase todavía no está integrado.

## Ejecutar

```powershell
npm install
npm run dev
```

Abrí la URL que muestre Vite. Para probar el flujo completo: creá una sala, usá **Sumar jugadores de demo**, empezá la partida, solicitá un cambio de consigna, abrí la votación y usá **Completar votos de demo**. Repetí hasta el ranking final y elegí **Revancha**.

## Validar

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
```

## Variables de entorno

Copiá `.env.example` a `.env.local` sólo al configurar Supabase en el Hito 3. Nunca subas `.env` ni `.env.local`.

## Decisión acordada para `start_round()`

Cuando la cantidad de jugadores activos sea impar, una postura tendrá un integrante extra. La primera vez que ocurra esta situación se elige aleatoriamente qué postura recibe ese integrante; en la siguiente ronda que también tenga una cantidad impar de jugadores activos, se asigna la postura contraria. Las rondas con cantidad par de jugadores no modifican `last_odd_extra_side`.

En el mock local del Hito 2 ya se aplica esta misma regla: `start_round()` asigna posturas aleatoriamente entre jugadores activos, mantiene equipos iguales cuando la cantidad es par, limita la diferencia a una persona cuando es impar, minimiza repeticiones consecutivas y activa recién en la siguiente ronda a quienes entran durante una partida.
