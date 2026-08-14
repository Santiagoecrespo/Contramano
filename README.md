+# Contramano

Juego web para juntadas: alguien crea una mesa, comparte un link o QR, la gente entra con apodo y juegan cinco rondas de debate con jurado rotativo. No es una app instalable: funciona desde el navegador del celular.

## Qué hace hoy

- Salas de 3 a 8 personas, con código de 8 caracteres no ambiguos.
- Cinco rondas por partida, mazos separados para **Tranqui** y **Modo Bardo**.
- Jurado rotativo: una persona con 3–5 jugadores y dos con 6–8.
- Equipos A/B equilibrados entre quienes debaten; el jurado vota en privado.
- Resultado, desempate aleatorio informado, puntajes y ranking final.
- Link, QR y compartir por WhatsApp.
- Salas sincronizadas por Supabase Realtime, con RLS y sesiones anónimas.
- Pausa bajo tres personas conectadas, recuperación tras recarga y transferencia de host si falta 45 segundos.
- Revancha en una sala nueva con código nuevo, puntajes en cero e historial de la anterior conservado.
- Sin Supabase configurado, queda disponible una demo local guardada en `localStorage`.

## Ejecutar localmente

```powershell
npm install
npm run dev
```

Abrí la URL que muestra Vite. Para una demo rápida, creá una sala y elegí **Completar mesa de demo**. Podés recorrer las cinco rondas con **Completar votos de demo**.

> En `localhost`, el QR y WhatsApp contienen una URL local. Sirven para probar la interfaz en esa computadora, pero no para abrir la mesa desde otro celular. Para una prueba móvil real usá la URL pública de Vercel.

## Validar

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
npm audit --omit=dev
```

## Configuración de Supabase

La app usa autenticación anónima, RLS, RPCs autoritativas, Broadcast privado y Presence solamente como indicador visual. Los temporizadores se muestran con referencia a la hora del servidor.

1. Creá un proyecto de Supabase.
2. En **Authentication → Providers**, activá **Anonymous sign-ins**.
3. Ejecutá las migraciones en **SQL Editor**.

Para una instalación nueva, ejecutá una sola vez el archivo completo [202608120001_realtime_multiplayer.sql](supabase/migrations/202608120001_realtime_multiplayer.sql).

Si ya habías ejecutado una versión anterior del archivo base, corré en orden:

1. [202608120002_fix_start_new_round_jurors.sql](supabase/migrations/202608120002_fix_start_new_round_jurors.sql)
2. [202608130001_allow_host_early_voting.sql](supabase/migrations/202608130001_allow_host_early_voting.sql)
3. [202608130002_expand_editorial_prompt_catalog.sql](supabase/migrations/202608130002_expand_editorial_prompt_catalog.sql)
4. [202608130003_tighten_prompt_conflicts.sql](supabase/migrations/202608130003_tighten_prompt_conflicts.sql)
5. [202608130004_add_resilience.sql](supabase/migrations/202608130004_add_resilience.sql)
6. [202608130005_fix_join_room_grant.sql](supabase/migrations/202608130005_fix_join_room_grant.sql) — sólo es necesaria si tu versión de Hito 4 mostró el error de firma de `join_room`.
7. [202608130006_add_launch_events.sql](supabase/migrations/202608130006_add_launch_events.sql)

La migración de Hito 5 sólo agrega eventos de lanzamiento y metadatos del salto de consigna. No elimina tablas, datos ni debilita RLS.

4. Copiá `.env.example` a `.env.local`:

```dotenv
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=tu_publishable_key
```

5. Reiniciá `npm run dev`. Dentro de una sala aparece **EN VIVO** cuando se usa Supabase.

### Seguridad antes de publicar

- Mantené **Anonymous sign-ins** habilitado.
- Mantené RLS habilitado: no elimines políticas ni uses la service role en el cliente.
- El frontend usa exclusivamente `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Nunca cargues `service_role`, una secret key, contraseña de PostgreSQL, token administrativo ni ninguna otra credencial privada en Vercel, en `.env.local` del frontend o en el repositorio.
- En **Authentication → URL Configuration**, configurá el **Site URL** con tu URL de producción de Vercel, por ejemplo `https://contramano.vercel.app`. Agregá esa misma URL en **Redirect URLs**. Si necesitás probar previews de Vercel, agregá sólo los dominios concretos que uses.
- Como mejora futura, evaluá habilitar CAPTCHA para Auth anónimo. No bloquea este MVP.

Checklist rápido de RLS:

1. Creá una sala en una sesión.
2. Abrí el link en incógnito: debe aparecer el formulario de apodo, nunca datos internos o el snapshot de la sala.
3. Uní esa segunda sesión y verificá que recién entonces ve el lobby.
4. Abrí otra sala en una tercera sesión: no debe poder leer ni modificar la primera.
5. Confirmá que un no-host no ve controles de host y un no-jurado no puede votar.

## Publicar manualmente en Vercel

Vercel reconoce Vite sin dependencias adicionales. El repositorio incluye `vercel.json` para que abrir directamente una URL como `/sala/ABCDEFGH` entregue la aplicación en lugar de un 404.

1. Entrá a [Vercel](https://vercel.com/) con tu cuenta.
2. Elegí **Add New → Project** e importá `Santiagoecrespo/Contramano`.
3. Verificá estos valores en la pantalla de configuración:
   - Framework Preset: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install` (o `npm ci`)
4. En **Environment Variables**, agregá para Production y Preview:

```dotenv
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=tu_publishable_key
```

5. Revisá que no haya ninguna variable privada: no agregues `service_role`, secret key ni claves de PostgreSQL.
6. Hacé clic en **Deploy**.
7. Copiá la URL pública resultante y cargala en Supabase como Site URL y Redirect URL, según la sección anterior.
8. Creá una sala desde la URL de Vercel y verificá que el QR y WhatsApp contengan exactamente esa URL pública con `/sala/CODIGO`.

El QR y WhatsApp se construyen desde `window.location.origin`, así que en producción conservan automáticamente el dominio de Vercel y el código de sala.

## Métricas mínimas

Las métricas viven en `public.events`; no se agrega una plataforma externa ni se guarda información personal para este fin. Hito 5 registra `game_started`, `game_finished` y `whatsapp_share_clicked`. También quedan disponibles `room_created`, `player_joined`, `round_started`, `round_finished`, `rematch_started`, `prompt_skipped`, `host_transferred` y `game_paused`.

### Eventos por día

```sql
select
  created_at::date as fecha,
  name as evento,
  count(*) as cantidad
from public.events
where name in (
  'room_created',
  'player_joined',
  'game_started',
  'round_started',
  'round_finished',
  'game_finished',
  'rematch_started',
  'whatsapp_share_clicked',
  'prompt_skipped',
  'host_transferred',
  'game_paused'
)
group by 1, 2
order by 1 desc, 2;
```

### Embudo: primera ronda, cinco rondas y revancha

```sql
with salas_creadas as (
  select room_id, min(created_at) as creada_en
  from public.events
  where name = 'room_created'
  group by room_id
),
estado as (
  select
    sc.room_id,
    exists (
      select 1 from public.events e
      where e.room_id = sc.room_id and e.name = 'round_started'
    ) as llego_a_primera_ronda,
    exists (
      select 1 from public.events e
      where e.room_id = sc.room_id and e.name = 'game_finished'
    ) as completo_cinco_rondas,
    exists (
      select 1 from public.events e
      where e.room_id = sc.room_id and e.name = 'rematch_started'
    ) as inicio_revancha
  from salas_creadas sc
)
select
  count(*) as salas_creadas,
  round(100.0 * count(*) filter (where llego_a_primera_ronda) / nullif(count(*), 0), 1) as pct_primera_ronda,
  round(100.0 * count(*) filter (where completo_cinco_rondas) / nullif(count(*), 0), 1) as pct_completa_cinco,
  round(100.0 * count(*) filter (where inicio_revancha) / nullif(count(*), 0), 1) as pct_revancha
from estado;
```

### Promedio de jugadores por sala y modo elegido

```sql
select
  r.intensity as modo,
  count(*) as salas,
  round(avg(jugadores.cantidad), 2) as promedio_jugadores
from public.rooms r
join lateral (
  select count(*)::numeric as cantidad
  from public.players p
  where p.room_id = r.id
) jugadores on true
group by r.intensity
order by r.intensity;
```

### Consignas más saltadas

> Esta consulta incluye los saltos registrados luego de aplicar Hito 5; los anteriores no tenían `prompt_id` en el evento.

```sql
select
  p.category,
  p.text as consigna,
  count(*) as veces_saltada
from public.events e
join public.prompts p on p.id = e.metadata ->> 'prompt_id'
where e.name = 'prompt_skipped'
group by p.category, p.text
order by veces_saltada desc, p.category
limit 20;
```

### Compartidos por WhatsApp

```sql
select
  created_at::date as fecha,
  count(*) as clics_whatsapp
from public.events
where name = 'whatsapp_share_clicked'
group by 1
order by 1 desc;
```

## Guía de prueba pública

Probalo con dos o tres grupos reales, idealmente desde celulares.

1. El host abre la URL pública de Vercel desde su celular y crea una sala.
2. Comparte el QR o **Compartir por WhatsApp**.
3. Dos o más personas se unen desde sus propios celulares.
4. Juegan las cinco rondas.
5. Anotá:
   - si entienden qué hacer sin explicación;
   - si completan las cinco rondas;
   - si piden revancha;
   - qué consignas generan discusión, risas, confusión o cambios;
   - problemas de conexión, pausa o reconexión.
6. Después de cada grupo, ejecutá las consultas de métricas.

### Checklist de lanzamiento

- [ ] Variables públicas de Supabase cargadas en Vercel.
- [ ] URL de producción configurada en Supabase Auth.
- [ ] Auth anónimo y RLS habilitados.
- [ ] QR probado en Android y iPhone desde la URL pública.
- [ ] WhatsApp conserva la URL pública y el código de la sala.
- [ ] Tres sesiones comparten lobby, debate y votación.
- [ ] Recarga y reconexión recuperan la partida.
- [ ] No hay errores críticos en la consola del navegador.
- [ ] RLS entre dos salas fue verificado.
- [ ] Interfaz revisada a 375 px, 768 px y desktop.
- [ ] Métricas de prueba revisadas en `events`.

## Qué falta para declararlo públicamente lanzado

A nivel código, el MVP queda listo al completar el checklist anterior y hacer una prueba real de cinco rondas. Antes de compartirlo ampliamente, falta que vos ejecutes el deploy manual, configures la URL de Vercel en Supabase y confirmes una prueba en celulares reales. CAPTCHA para Auth anónimo, monitoreo de errores y analítica más avanzada son mejoras posteriores, no requisitos de este primer lanzamiento.
