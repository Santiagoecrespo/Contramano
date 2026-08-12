# Contramano

Juego web para juntadas: entrás por QR o link, te toca una postura, debatís, votás y sumás puntos. No es una app instalable.

## Hito 1

Incluye landing mobile-first, creación y unión simuladas, lobby, QR, enlace de WhatsApp, diseño responsive y almacenamiento mock en `localStorage`. Todavía no incluye rondas reales ni Supabase.

## Ejecutar

```powershell
npm install
npm run dev
```

Abrí la URL que muestre Vite. Para probar el flujo: creá una sala, abrí el QR o compartí el link; el botón de demo suma jugadores locales para visualizar el lobby completo.

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

En ese hito, `start_round()` también asignará posturas aleatoriamente entre jugadores activos, mantendrá equipos iguales cuando la cantidad sea par, limitará la diferencia a una persona cuando sea impar, minimizará repeticiones consecutivas y activará recién en la siguiente ronda a quienes entren durante una partida.
