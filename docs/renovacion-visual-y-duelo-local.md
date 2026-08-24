# Renovación visual y modo Cara a cara

## Objetivo

Hacer que Contramano se perciba como un juego social antes que como un formulario, sin alterar el juego online ni su infraestructura. El nuevo modo se llamará **Cara a cara** y se explicará como “2 personas, un dispositivo”.

## Alcance técnico

- Incorporar una ruta local e independiente (`/cara-a-cara`) con estado exclusivo de React.
- Reutilizar cinco consignas activas existentes sin modificarlas, crear salas, usar enlaces, QR, Supabase, Realtime ni persistencia.
- Mantener sin cambios `gameService`, `mockRoom`, las rutas de sala, autenticación, migraciones y el catálogo editorial.
- Incorporar funciones puras y tests para elegir cinco consignas sin repetición y calcular el resumen de coincidencias.

## Flujo de Cara a cara

1. Las dos personas eligen sus apodos.
2. En cada una de cinco rondas, Jugador 1 vota en privado y entrega el dispositivo.
3. Jugador 2 vota sin ver la elección previa.
4. La revelación muestra las dos posturas en pantalla dividida: “Misma vereda” o “Contramano”.
5. El cierre muestra coincidencias, desacuerdos, porcentaje y una consigna que los dividió, con revancha o vuelta al inicio.

## Sistema visual

- Mantener la identidad tipográfica existente, con una base azul-violeta profunda y acentos coral, fucsia, celeste, amarillo y lima.
- Aplicar superficies claras de alto contraste para consignas, botones grandes, foco visible y tarjetas con sombras y leves rotaciones.
- Dar a cada jugador un color estable: coral para Jugador 1 y celeste para Jugador 2.
- Usar transiciones CSS breves para turnos, revelación y resultados; todas respetarán `prefers-reduced-motion`.
- Renovar landing, formularios y pantallas online sólo a nivel de presentación compartida: no se cambian sus acciones ni reglas.

## Validación

- Ejecutar lint, chequeo de tipos, tests y build.
- Revisar el flujo Cara a cara y las rutas principales en formato móvil y desktop.
