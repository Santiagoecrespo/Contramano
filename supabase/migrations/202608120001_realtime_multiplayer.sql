-- Contramano Hito 3. Ejecutar completo en Supabase SQL Editor como postgres.
create extension if not exists pgcrypto;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$'),
  host_player_id uuid, intensity text not null default 'tranqui' check (intensity in ('tranqui','bardo')),
  phase text not null default 'lobby' check (phase in ('lobby','playing','paused','finished','cancelled')),
  round_count integer not null default 0 check (round_count between 0 and 5),
  last_odd_extra_side text check (last_odd_extra_side in ('A','B')),
  version integer not null default 1, created_at timestamptz not null default now(), expires_at timestamptz not null default now() + interval '24 hours'
);
create table if not exists public.players (
  id uuid primary key default gen_random_uuid(), room_id uuid not null references public.rooms(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade, nickname text not null check (char_length(nickname) between 2 and 16),
  is_host boolean not null default false, score integer not null default 0, jury_rounds integer not null default 0,
  active_from_round integer not null default 1, joined_at timestamptz not null default now(), unique(room_id, auth_user_id)
);
create unique index if not exists players_room_nickname_unique on public.players(room_id, lower(nickname));
alter table public.rooms add constraint rooms_host_player_fk foreign key (host_player_id) references public.players(id) deferrable initially deferred;
create table if not exists public.prompts (
  id text primary key, category text not null, intensity text not null check (intensity in ('tranqui','bardo')),
  status text not null default 'active' check (status in ('active','reserve')), text text not null, side_a text not null, side_b text not null
);
create table if not exists public.rules (id uuid primary key default gen_random_uuid(), text text not null, active boolean not null default true);
create table if not exists public.prompt_decks (
  room_id uuid not null references public.rooms(id) on delete cascade, intensity text not null check (intensity in ('tranqui','bardo')),
  deck text[] not null default '{}', cursor integer not null default 0, history text[] not null default '{}', cycle integer not null default 1,
  primary key(room_id,intensity)
);
create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(), room_id uuid not null references public.rooms(id) on delete cascade, number integer not null,
  prompt_id text not null references public.prompts(id), phase text not null check (phase in ('debating','voting','results','skipped')),
  started_at timestamptz not null default now(), ends_at timestamptz not null, vote_ends_at timestamptz,
  result text check (result in ('A','B')), was_random_tiebreak boolean not null default false, unique(room_id,number)
);
create table if not exists public.round_players (
  round_id uuid not null references public.rounds(id) on delete cascade, player_id uuid not null references public.players(id) on delete cascade,
  role text not null check (role in ('juror','debater')), side text check (side in ('A','B')), point_awarded boolean not null default false,
  primary key(round_id,player_id), check ((role='juror' and side is null) or (role='debater' and side is not null))
);
create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(), round_id uuid not null references public.rounds(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade, side text not null check (side in ('A','B')), created_at timestamptz not null default now(), unique(round_id,player_id)
);
create table if not exists public.prompt_change_requests (id uuid primary key default gen_random_uuid(), round_id uuid not null references public.rounds(id) on delete cascade, player_id uuid not null references public.players(id) on delete cascade, created_at timestamptz not null default now(), unique(round_id,player_id));
create table if not exists public.events (id bigint generated always as identity primary key, room_id uuid references public.rooms(id) on delete cascade, player_id uuid references public.players(id) on delete set null, name text not null, metadata jsonb not null default '{}', created_at timestamptz not null default now());
create index if not exists players_room_idx on public.players(room_id); create index if not exists rounds_room_idx on public.rounds(room_id,number desc); create index if not exists events_room_name_idx on public.events(room_id,name,created_at desc);

create or replace function public.is_room_member(p_room uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from players where room_id=p_room and auth_user_id=auth.uid()) $$;
alter table public.rooms enable row level security; alter table public.players enable row level security; alter table public.prompts enable row level security; alter table public.rules enable row level security; alter table public.prompt_decks enable row level security; alter table public.rounds enable row level security; alter table public.round_players enable row level security; alter table public.votes enable row level security; alter table public.prompt_change_requests enable row level security; alter table public.events enable row level security;
create policy "members read rooms" on public.rooms for select to authenticated using (public.is_room_member(id));
create policy "members read players" on public.players for select to authenticated using (public.is_room_member(room_id));
create policy "members read rounds" on public.rounds for select to authenticated using (public.is_room_member(room_id));
create policy "members read round players" on public.round_players for select to authenticated using (exists(select 1 from rounds r where r.id=round_id and public.is_room_member(r.room_id)));
create policy "members read prompts" on public.prompts for select to authenticated using (true);
create policy "members read requests" on public.prompt_change_requests for select to authenticated using (exists(select 1 from rounds r where r.id=round_id and public.is_room_member(r.room_id)));
create policy "jurors read own vote or closed round" on public.votes for select to authenticated using (player_id in (select id from players where auth_user_id=auth.uid()) or exists(select 1 from rounds where id=round_id and phase='results'));
-- No direct client writes: only security-definer RPCs below have mutation privileges.

-- 30 active cards per mode. Reserve cards remain in the client editorial catalog and are not dealt in MVP cycles.
insert into public.prompts(id,category,intensity,text,side_a,side_b) values
('asado-tarde','Asado','tranqui','Llegar media hora tarde a un asado no cuenta como llegar tarde.','Cuenta','No cuenta'),('panera','Comida','tranqui','El pan de la panera se come antes de que llegue la comida.','Obvio','Se espera'),('audio-largo','Hábitos','tranqui','Mandar un audio de más de dos minutos es un acto de violencia.','Es','Exageran'),('cocina-lava','Convivencia','tranqui','El que cocina no debería lavar.','No lava','Lava igual'),('menu-antes','Salidas','tranqui','Mirar el menú antes de llegar al restaurante es de persona organizada.','Organizada','Ansiosa'),('pelicula-larga','Series','tranqui','Una película larga puede ser buena igual.','Puede','No da'),('mate-excusa','Mate','tranqui','El mate es más excusa para hablar que bebida.','Excusa','Bebida'),('juego-reglas','Juegos','tranqui','El que pierde en un juego no tiene derecho a cambiar las reglas.','No tiene','Puede'),('super-hambre','Comida','tranqui','Ir al supermercado con hambre siempre termina mal.','Siempre','Se puede'),('grupo-nombre','Amistades','tranqui','Un grupo sin nombre raro no es un grupo de verdad.','No es','Da igual'),('celular-cama','Hábitos','tranqui','Dormir con el celular en la mano cuenta como usarlo antes de dormir.','Cuenta','No cuenta'),('siesta','Hábitos','tranqui','Una siesta de veinte minutos siempre termina siendo de dos horas.','Siempre','Se controla'),('pizza-fria','Comida','tranqui','La pizza fría del día siguiente es mejor que recién hecha.','Mejor','Jamás'),('no-se-comer','Comida','tranqui','Decir no sé qué comer y rechazar todo debería tener consecuencias.','Debería','Qué drama'),('maneja-musica','Música','tranqui','El que maneja tiene derecho a elegir la música.','Tiene','No tiene'),('memes','Redes','tranqui','Los memes explican mejor algunas cosas que una conversación seria.','Mejor','Ni ahí'),('previa-boliche','Previa','tranqui','Una buena previa es mejor que ir al boliche.','Sí','No'),('mate-lavado','Mate','tranqui','El mate lavado se toma igual.','Se toma','Se cambia'),('delivery-personalidad','Comida','tranqui','Pedir siempre lo mismo es tener personalidad, no falta de imaginación.','Personalidad','Falta de ideas'),('musica-prioridad','Música','tranqui','Quien pone música tiene prioridad para elegir.','Tiene','No tiene'),('truco-falta','Juegos','tranqui','Cantar falta envido sin cartas es una estrategia válida.','Vale','No vale'),('series-dobladas','Series','tranqui','Ver una serie doblada no la arruina.','No arruina','Arruina'),('previa-hora','Previa','tranqui','La hora de una previa es decorativa.','Decorativa','Se respeta'),('ya-salgo','Hábitos','tranqui','Decir ya estoy saliendo mientras seguís en tu casa no es mentir.','No es','Es chamuyo'),('viaje-improvisar','Viajes','tranqui','En un viaje, improvisar el plan es mejor que organizarlo.','Improvisar','Organizar'),('facultad-leer','Facultad','tranqui','Llegar sin haber leído igual cuenta como ir a clase.','Cuenta','No cuenta'),('playlist-viaje','Viajes','tranqui','Armar playlist para un viaje es parte del viaje.','Es parte','No tanto'),('capitulo-uno','Series','tranqui','Ver un capítulo más nunca significa uno solo.','Nunca','A veces'),('lavar-platos','Convivencia','tranqui','Dejar los platos en remojo es lavarlos a futuro.','Sí','No'),('trabajo-camara','Trabajo','tranqui','Tener la cámara apagada en una reunión mejora la reunión.','Mejora','Empeora'),
('cancelar-multa','Planes','bardo','Cancelar el mismo día debería tener multa.','Sí','No'),('desaparece-pide','Amistades','bardo','El que desaparece del grupo y vuelve solo para pedir algo debería pagar multa.','Debería','Exageran'),('hagan-lo-que','Planes','bardo','Decir hacemos lo que quieran y después criticar el plan es imperdonable.','Lo es','Se puede'),('tres-dias','Amistades','bardo','Si tardás tres días en contestar, perdiste el derecho a preguntar por qué no te avisaron.','Perdiste','No'),('plata-opina','Salidas','bardo','El que no pone plata pero opina del lugar no tiene voto.','No tiene','Sí tiene'),('extra-sin-avisar','Planes','bardo','Llegar sin avisar con alguien extra cambia todo el plan.','Lo cambia','No tanto'),('jajaj-rendirse','Amistades','bardo','Mandar jajaj después de una discusión es una forma de rendirse.','Lo es','No'),('cumple-invitar','Amistades','bardo','El que organiza un cumpleaños tiene derecho a elegir a quién no invitar.','Tiene','No tiene'),('foto-irse','Salidas','bardo','Pedir una foto grupal cuando todos ya se quieren ir debería estar prohibido.','Prohibido','Es tradición'),('no-tomo','Hábitos','bardo','Cuando alguien dice no tomo mucho, generalmente hay que preocuparse.','Hay que','No tanto'),('vetar-comida','Comida','bardo','Si no sabés qué querés comer, no podés vetar opciones ajenas.','No podés','Podés'),('paga-persigue','Dinero','bardo','El que se ofrece a pagar y después persigue la transferencia es peligroso.','Peligroso','Ordenado'),('queda-bien','Salidas','bardo','Un amigo que te dice te queda bien antes de salir no siempre está ayudando.','No siempre','Siempre'),('jaja-mal','Redes','bardo','Responder jaja mal no cuenta como seguir una conversación.','No cuenta','Cuenta'),('cancion-cambiar','Música','bardo','El que no conoce una canción no puede pedir que la cambien.','No puede','Puede'),('salida-sin-fotos','Redes','bardo','Una salida puede estar buena aunque no haya fotos para subir.','Obvio','No tanto'),('tarde-suspension','Puntualidad','bardo','El grupo puede suspender al que siempre llega último.','Puede','No puede'),('fuego-chamuyo','Redes','bardo','Responder una historia solo con fuego es chamuyo.','Es','No es'),('parlante-opinar','Música','bardo','Quien monopoliza el parlante pierde derecho a opinar.','Pierde','No pierde'),('viaje-responsable','Viajes','bardo','En un viaje alguien debe ser responsable aunque nadie lo elija.','Debe','No debe'),('silenciar-grupo','Amistades','bardo','Silenciar el grupo una semana es completamente válido.','Válido','Exagerado'),('calculadora-salida','Salidas','bardo','El que saca la calculadora para dividir una salida le baja el ánimo a cualquiera.','Lo baja','No'),('historias-todo','Redes','bardo','Si subiste todo a historias, medio que ya no estuviste ahí.','Tal cual','Nada que ver'),('apuntes-explicar','Facultad','bardo','Compartir apuntes no obliga a explicar todo después.','No obliga','Obliga'),('mejores-amigos','Celos cotidianos','bardo','Tener mejores amigos en redes es innecesario.','Innecesario','Normal'),('casa-ajena','Convivencia','bardo','En casa ajena, el que abre la heladera sin preguntar ya cruzó una línea.','La cruzó','Exageran'),('previa-enemigo','Previa','bardo','El que quiere una previa tranqui es el más peligroso de la noche.','Siempre','Nunca'),('juego-enojado','Juegos','bardo','Enojarse por perder un juego arruina más que hacer trampa.','Arruina más','No'),('asado-vegetariano','Asado','bardo','Llevar algo vegetariano a un asado no te exime de traer postre.','No exime','Sí exime'),('salida-cerrar','Salidas','bardo','El que propone irse debería encargarse de cerrar la cuenta.','Debería','No') on conflict (id) do update set category=excluded.category,intensity=excluded.intensity,text=excluded.text,side_a=excluded.side_a,side_b=excluded.side_b;

-- Canonical editorial catalog: 60 active and 20 reserve prompts per mode.
update public.prompts set status='reserve' where status='active';
insert into public.prompts(id,category,intensity,status,text,side_a,side_b) values
('asado-tarde','Asado','tranqui','active','Llegar con hielo a un asado te habilita a caer tarde.','Habilita','No habilita'),
('asado-parrilla','Asado','tranqui','active','El que se adueña de la parrilla no debería recibir sugerencias.','Sin consejos','Se escucha'),
('asado-sobras','Asado','tranqui','active','Llevarse un tupper del asado sin preguntar es de confianza.','Está bien','Se pregunta'),
('asado-pan','Asado','tranqui','active','El pan con chimichurri merece protagonismo propio.','Protagonista','Acompaña'),
('mate-excusa','Mate','tranqui','active','El mate es más excusa para charlar que bebida.','Es excusa','Es bebida'),
('mate-lavado','Mate','tranqui','active','El mate lavado se sigue tomando por respeto, no por gusto.','Por respeto','Se cambia'),
('mate-ronda','Mate','tranqui','active','Devolver el mate sin avisar que está lavado es una traición menor.','Es traición','No tanto'),
('cafe-charla','Mate','tranqui','active','Un café frío se termina igual si la charla está buena.','Se termina','Se cambia'),
('previa-boliche','Salidas','tranqui','active','Una previa que se pone buena puede justificar no ir al boliche.','De una','Se sale igual'),
('menu-antes','Salidas','tranqui','active','Mirar el menú antes de llegar evita discusiones inútiles.','Evita bardo','Le quita gracia'),
('salida-postre','Salidas','tranqui','active','Pedir un postre para compartir y comer más de la mitad es traición.','Es traición','Es normal'),
('fila-bar','Salidas','tranqui','active','Hacer fila para entrar forma parte de la salida.','Es parte','Es un bajón'),
('maneja-musica','Música','tranqui','active','Quien maneja puede elegir la música del viaje.','Puede elegir','Se negocia'),
('playlist-viaje','Música','tranqui','active','Armar la playlist del viaje da demasiado poder.','Demasiado','El justo'),
('musica-prioridad','Música','tranqui','active','El que puso el parlante tiene prioridad, no control total.','Prioridad','Control total'),
('cancion-conocida','Música','tranqui','active','Cantar mal un tema conocido mejora la juntada.','La mejora','La arruina'),
('grupo-nombre','Amistades','tranqui','active','Un grupo de WhatsApp sin nombre raro está incompleto.','Está incompleto','Da igual'),
('plan-sorpresa','Amistades','tranqui','active','Un buen plan sorpresa necesita una persona cómplice.','La necesita','No hace falta'),
('apodo-grupo','Amistades','tranqui','active','Los apodos del grupo no necesitan explicación para funcionar.','No necesitan','Se explican'),
('visita-improvisada','Amistades','tranqui','active','Caer sin avisar puede ser un gesto lindo si hay confianza.','Puede ser lindo','Se avisa'),
('memes','Redes','tranqui','active','Un meme bien mandado responde mejor que un párrafo.','Responde mejor','No reemplaza'),
('redes-borrar','Redes','tranqui','active','Borrar una historia enseguida genera más curiosidad que subirla.','Genera más','Da igual'),
('foto-grupal','Redes','tranqui','active','Una foto grupal vale aunque nadie la suba.','Vale igual','Pierde sentido'),
('visto-amigo','Redes','tranqui','active','Clavar visto a un amigo cercano no necesita disculpas.','No necesita','Se explica'),
('facultad-leer','Facultad','tranqui','active','Ir a clase sin leer puede valer la pena igual.','Vale igual','No alcanza'),
('facultad-grupo','Facultad','tranqui','active','El trabajo grupal sirve para elegir mejor a tus amigos.','Sirve','Es exagerado'),
('apuntes-prolijos','Facultad','tranqui','active','Prestar apuntes prolijos da derecho a pedirlos de vuelta.','Da derecho','Se comparten'),
('parcial-descanso','Facultad','tranqui','active','Descansar antes de un parcial puede rendir más que repasar por pánico.','Rinde más','Se repasa'),
('trabajo-camara','Laburo','tranqui','active','Tener la cámara apagada puede mejorar una reunión.','La mejora','La empeora'),
('laburo-almuerzo','Laburo','tranqui','active','Almorzar frente a la compu no cuenta como descanso.','No cuenta','Sí cuenta'),
('laburo-mate','Laburo','tranqui','active','Llevar mate al trabajo mejora cualquier oficina.','La mejora','Distrae'),
('mensaje-horario','Laburo','tranqui','active','Un mensaje de trabajo fuera de horario puede esperar al día siguiente.','Puede esperar','Se responde'),
('viaje-improvisar','Viajes','tranqui','active','En un viaje, dejar una tarde sin plan es obligatorio.','Es obligatorio','Se organiza'),
('viaje-ventana','Viajes','tranqui','active','El asiento de ventana se pide antes de subir.','Se pide','Se negocia'),
('valija-liviana','Viajes','tranqui','active','Viajar liviano gana aunque falte algo.','Gana','Es arriesgado'),
('mapa-viaje','Viajes','tranqui','active','Perderse un poco mejora el recuerdo del viaje.','Lo mejora','Hace perder tiempo'),
('cocina-lava','Convivencia','tranqui','active','El que cocina se gana el derecho a no lavar ni un plato.','No lava','Lava igual'),
('lavar-platos','Convivencia','tranqui','active','Dejar platos en remojo cuenta como una promesa, no como lavado.','Es promesa','Cuenta igual'),
('heladera-ajena','Convivencia','tranqui','active','Abrir la heladera ajena requiere confianza, no permiso.','Confianza basta','Se pregunta'),
('manta-sillon','Convivencia','tranqui','active','La manta del sillón tiene dueño aunque nadie lo admita.','Tiene dueño','Es de todos'),
('vaquita-redonda','Plata','tranqui','active','La vaquita se redondea para arriba y nadie lleva la cuenta.','Se redondea','Se calcula'),
('transferencia-despues','Plata','tranqui','active','Pagar después por transferencia puede ser igual de responsable.','Es responsable','Se paga ahí'),
('propina-grupo','Plata','tranqui','active','La propina se decide entre todos, no por quien paga.','Entre todos','Decide quien paga'),
('oferta-comun','Plata','tranqui','active','Compartir una promo aunque no convenga tanto une al grupo.','Une al grupo','No tiene sentido'),
('juego-reglas','Juegos','tranqui','active','El que pierde no puede proponer reglas nuevas de inmediato.','No puede','Puede proponer'),
('truco-falta','Juegos','tranqui','active','Cantar falta envido sin cartas también es parte del truco.','Es parte','Es demasiado'),
('juego-tutorial','Juegos','tranqui','active','Saltarse el tutorial es una forma válida de aprender.','Es válida','Es un error'),
('juego-equipo','Juegos','tranqui','active','Elegir equipos por sorteo evita más bardo que elegir por amistad.','Evita bardo','Quita gracia'),
('futbol-relato','Fútbol','tranqui','active','Ver un partido con relato en la radio tiene más clima.','Tiene más clima','No hace falta'),
('futbol-silencio','Fútbol','tranqui','active','Durante un penal importante se respeta el silencio.','Se respeta','Se vive hablando'),
('futbol-asado','Fútbol','tranqui','active','Un partido se disfruta más si hay algo picando al lado.','Se disfruta más','Distrae'),
('futbol-repeticion','Fútbol','tranqui','active','Ver la repetición del gol tres veces es necesario.','Es necesario','Una alcanza'),
('previa-hora','Planes','tranqui','active','La hora de una previa es una referencia, no un contrato.','Referencia','Contrato'),
('plan-domingo','Planes','tranqui','active','Un domingo sin plan puede ser un plan perfecto.','Es perfecto','Se desperdicia'),
('cumple-tema','Planes','tranqui','active','Un cumpleaños con temática mejora aunque nadie se disfrace.','Lo mejora','Es de más'),
('reserva-lugar','Planes','tranqui','active','Reservar mesa para mucha gente obliga a llegar a horario.','Obliga','No tanto'),
('audio-largo','Hábitos','tranqui','active','Un audio de más de dos minutos necesita una buena razón.','La necesita','Es normal'),
('siesta','Hábitos','tranqui','active','Una siesta larga puede salvar un día entero.','Lo salva','Lo desordena'),
('celular-cama','Hábitos','tranqui','active','Mirar el celular en la cama cuenta como seguir despierto.','Cuenta','No cuenta'),
('pizza-fria','Hábitos','tranqui','active','La pizza fría del día siguiente tiene su propio mérito.','Lo tiene','Ni cerca'),
('asado-ensalada','Asado','tranqui','reserve','La ensalada en un asado merece más respeto del que recibe.','Merece respeto','Es relleno'),
('mate-azucar','Mate','tranqui','reserve','Ponerle azúcar al mate se avisa antes de cebar.','Se avisa','Da igual'),
('salida-guardarropa','Salidas','tranqui','reserve','Dejar el abrigo en guardarropa compra tranquilidad.','La compra','Es gasto de más'),
('musica-auriculares','Música','tranqui','reserve','Compartir auriculares es un gesto de confianza.','Lo es','Es incómodo'),
('amistad-ubicacion','Amistades','tranqui','reserve','Mandar ubicación en vivo evita más problemas de los que crea.','Evita más','Crea más'),
('redes-comentario','Redes','tranqui','reserve','Comentar una foto de un amigo da más vergüenza que un like.','Da más','Da menos'),
('facultad-cafe','Facultad','tranqui','reserve','Estudiar con café mejora la concentración aunque sea placebo.','La mejora','Es placebo'),
('viaje-fotos','Viajes','tranqui','reserve','Sacar muchas fotos en viaje ayuda a recordar mejor.','Ayuda','Desconecta'),
('convi-ventana','Convivencia','tranqui','reserve','Dormir con la ventana abierta se negocia cada noche.','Se negocia','Decide quien duerme'),
('plata-regalo','Plata','tranqui','reserve','Un regalo grupal tiene más valor que varios regalos chicos.','Tiene más','Pierde gracia'),
('juego-revancha','Juegos','tranqui','reserve','Pedir revancha enseguida es señal de amor propio.','Lo es','Es capricho'),
('futbol-camiseta','Fútbol','tranqui','reserve','Ver un partido con camiseta cambia la experiencia.','La cambia','Es lo mismo'),
('plan-lluvia','Planes','tranqui','reserve','Un plan con lluvia necesita plan B desde el inicio.','Lo necesita','Se improvisa'),
('habito-desayuno','Hábitos','tranqui','reserve','Desayunar salado le gana al desayuno dulce.','Le gana','Pierde'),
('asado-postre','Asado','tranqui','reserve','Llevar postre al asado cuenta como aporte serio.','Cuenta serio','Es extra'),
('mate-termo','Mate','tranqui','reserve','Compartir termo es tan importante como compartir mate.','Es importante','No tanto'),
('salida-reserva','Salidas','tranqui','reserve','Elegir un bar nuevo es mejor que volver al de siempre.','Mejor probar','Mejor volver'),
('musica-volumen','Música','tranqui','reserve','Bajar la música para hablar no arruina el clima.','No arruina','Lo arruina'),
('amistad-favor','Amistades','tranqui','reserve','Hacer un favor sin contarlo después vale el doble.','Vale doble','Da igual'),
('tecnologia-notas','Hábitos','tranqui','reserve','Anotar todo en el celular libera la cabeza.','La libera','La ocupa'),
('asado-carne','Asado','bardo','active','El que llega con hambre al asado no puede preguntar cada diez minutos por la carne.','No puede','Puede'),
('asado-critico','Asado','bardo','active','Opinar de la parrilla sin acercarse al fuego es caretear.','Es caretear','Es ayudar'),
('asado-hielo','Asado','bardo','active','Quien trae hielo tarde no puede reclamar el primer fernet.','No puede','Puede'),
('asado-vegetariano','Asado','bardo','active','Llevar algo vegetariano no te exime de traer postre.','No exime','Sí exime'),
('mate-ultimo','Mate','bardo','active','El que toma el último mate y no vuelve a cebar se hizo el boludo.','Se hizo','No debe'),
('mate-celular','Mate','bardo','active','Mirar el celular mientras cebás arruina la ronda.','La arruina','No tanto'),
('mate-prestado','Mate','bardo','active','Devolver un mate prestado con yerba vieja es falta de respeto.','Lo es','Exageran'),
('cafe-pago','Mate','bardo','active','El que dice “yo invito el café” gana derecho a elegir el lugar.','Gana derecho','No decide'),
('plata-opina','Salidas','bardo','active','El que no pone plata pero opina del lugar pierde un voto.','Lo pierde','Lo conserva'),
('foto-irse','Salidas','bardo','active','Pedir foto grupal cuando todos se quieren ir es abuso de confianza.','Es abuso','Es tradición'),
('queda-bien','Salidas','bardo','active','Decirte “te queda bien” antes de salir no siempre es ayuda.','No siempre','Siempre ayuda'),
('salida-cerrar','Salidas','bardo','active','El que propone irse debería encargarse de cerrar la cuenta.','Debería','No tiene por qué'),
('cancion-cambiar','Música','bardo','active','Pedir cambiar una canción porque no la conocés es abusar de confianza.','Es abuso','Es válido'),
('musica-dj','Música','bardo','active','Decir “yo pongo música” sin que nadie lo pida es una advertencia.','Lo es','No tanto'),
('parlante-opinar','Música','bardo','active','Quien monopoliza el parlante pierde derecho a elegir el próximo tema.','Lo pierde','Lo conserva'),
('tema-cortado','Música','bardo','active','Cambiar un tema antes del estribillo debería requerir consenso.','Requiere','No hace falta'),
('desaparece-pide','Amistades','bardo','active','El que desaparece del grupo y vuelve sólo para pedir algo queda en falta.','Queda en falta','No tanto'),
('tres-dias','Amistades','bardo','active','Quien tarda tres días en responder no puede reclamar que no le avisaron.','No puede','Puede reclamar'),
('jajaj-rendirse','Amistades','bardo','active','Mandar “jajaj” después de discutir es rendirse sin admitirlo.','Es rendirse','Es bajar tensión'),
('silenciar-grupo','Amistades','bardo','active','Silenciar el grupo una semana y volver con preguntas es una provocación.','Lo es','Es válido'),
('fuego-chamuyo','Redes','bardo','active','Responder una historia sólo con fuego es chamuyo aunque lo niegues.','Es chamuyo','Depende'),
('jaja-mal','Redes','bardo','active','Responder “jaja mal” no alcanza para seguir una conversación.','No alcanza','Alcanza'),
('historias-todo','Redes','bardo','active','Subir toda la salida a historias es no vivirla del todo.','Es así','Nada que ver'),
('clavado-visto','Redes','bardo','active','Clavar visto después de proponer un plan es cancelar sin decirlo.','Es cancelar','No cuenta'),
('facultad-fotocopia','Facultad','bardo','active','Pedir apuntes cinco minutos antes del parcial es jugar con suerte.','Es jugar','Hay que ayudar'),
('apuntes-explicar','Facultad','bardo','active','Compartir apuntes no obliga a explicar todo después.','No obliga','Obliga'),
('trabajo-grupo','Facultad','bardo','active','El que no aparece en el trabajo grupal no puede corregir al final.','No puede','Puede opinar'),
('parcial-grupo','Facultad','bardo','active','Salir del parcial y comparar respuestas sólo aumenta el sufrimiento.','Lo aumenta','Ayuda'),
('trabajo-camara-bardo','Laburo','bardo','active','Tener la cámara apagada no autoriza a desaparecer de la reunión.','No autoriza','Puede pasar'),
('laburo-urgente','Laburo','bardo','active','Un mensaje que dice “urgente” después de horario debería tener multa.','Debería','Exageran'),
('laburo-responder','Laburo','bardo','active','Responder “lo veo” es una forma elegante de no hacerlo hoy.','Lo es','No necesariamente'),
('laburo-microfono','Laburo','bardo','active','Dejar el micrófono abierto con ruido de fondo es una falta de respeto.','Lo es','Pasa'),
('viaje-responsable','Viajes','bardo','active','En un viaje siempre aparece alguien que se cree responsable sin votación.','Siempre aparece','Hace falta'),
('viaje-cuentas','Viajes','bardo','active','Anotar cada gasto del viaje puede ordenar, pero también arruinar el clima.','Lo arruina','Lo salva'),
('pre-viaje-maleta','Viajes','bardo','active','Hacer la valija la noche anterior es vivir al límite.','Es vivir al límite','Es normal'),
('viaje-puntual','Viajes','bardo','active','Quien demora al grupo en una excursión debería invitar algo después.','Debería','No hace falta'),
('casa-ajena','Convivencia','bardo','active','Abrir la heladera ajena sin preguntar ya cruza una línea.','La cruza','Exageran'),
('convivencia-lista','Convivencia','bardo','active','La lista de compras compartida sólo sirve si alguien la persigue.','Sólo así','Igual sirve'),
('baño-ocupado','Convivencia','bardo','active','Tardar demasiado en el baño cuando hay gente esperando es egoísmo.','Es egoísmo','Depende'),
('orden-ajeno','Convivencia','bardo','active','Ordenar cosas ajenas sin preguntar genera más lío que ayuda.','Genera lío','Es ayudar'),
('paga-persigue','Plata','bardo','active','El que se ofrece a pagar y después persigue transferencias se contradice.','Se contradice','Es ordenado'),
('calculadora-salida','Plata','bardo','active','Dividir hasta el último peso puede ser ordenado, pero mata la salida.','La mata','Es justo'),
('amistad-prestamo','Plata','bardo','active','Prestar plata entre amigos necesita fecha, aunque dé fiaca.','Necesita fecha','No hace falta'),
('vuelto-chico','Plata','bardo','active','Cobrar un vuelto mínimo varios días después es demasiado.','Es demasiado','Se cobra'),
('juego-enojado','Juegos','bardo','active','Enojarse por perder arruina más que hacer trampa una vez.','Arruina más','No tanto'),
('juego-reglas-bardo','Juegos','bardo','active','Explicar las reglas mientras todos quieren jugar es querer mandar.','Es mandar','Es necesario'),
('truco-senias','Juegos','bardo','active','Negar una seña obvia en el truco es parte del juego.','Es parte','Es trampa'),
('revancha-eterna','Juegos','bardo','active','Pedir revancha hasta ganar convierte el juego en trámite.','Lo convierte','Es competir'),
('futbol-repeticion-bardo','Fútbol','bardo','active','Frenar la charla para ver una repetición es prioridad legítima.','Es prioridad','Es exagerado'),
('futbol-cabala','Fútbol','bardo','active','Cambiarse de lugar en un partido porque “da suerte” merece respeto.','Merece respeto','Es cualquiera'),
('futbol-grito','Fútbol','bardo','active','Gritar un gol antes de que entre es mufar al grupo.','Es mufar','No existe'),
('futbol-resultado','Fútbol','bardo','active','Spoilear el resultado de un partido grabado es imperdonable.','Lo es','No tanto'),
('cancelar-multa','Planes','bardo','active','Cancelar el mismo día debería tener multa social.','Debería','Exageran'),
('hagan-lo-que','Planes','bardo','active','Decir “hagan lo que quieran” te quita derecho a criticar el plan.','Te lo quita','Podés criticar'),
('extra-sin-avisar','Planes','bardo','active','Caer con alguien extra sin avisar cambia el plan para todos.','Lo cambia','No tanto'),
('planes-confirmar','Planes','bardo','active','Decir “después confirmo” hasta último momento ya es una respuesta.','Ya lo es','No cuenta'),
('ya-salgo','Hábitos','bardo','active','Decir “llego en cinco” desde la ducha ya cuenta como mentira.','Cuenta','No cuenta'),
('no-tomo','Hábitos','bardo','active','Decir “yo no tomo mucho” al empezar la noche debería quedar registrado.','Debería','Exageran'),
('habitos-alarma','Hábitos','bardo','active','Poner cinco alarmas no te hace más puntual.','No te hace','Sí ayuda'),
('super-hambre','Hábitos','bardo','active','Ir al súper con hambre te hace comprar cualquier cosa.','Te hace','Se controla'),
('asado-ensalada-bardo','Asado','bardo','reserve','Llegar al asado sin aportar nada y elegir el corte es demasiado.','Es demasiado','Puede elegir'),
('mate-critico','Mate','bardo','reserve','Criticar cómo ceban mate sin ofrecerte a cebar es caretear.','Es caretear','Es sinceridad'),
('salida-llegada','Salidas','bardo','reserve','Llegar tarde pero pedir mesa cerca de la puerta es tener cara.','Es tener cara','Es práctico'),
('musica-pedido','Música','bardo','reserve','Pedir el mismo tema dos veces en la noche debería tener límite.','Tiene límite','Se puede'),
('amistad-cumple','Amistades','bardo','reserve','Olvidarte un cumpleaños y aparecer con excusa empeora todo.','Empeora','Se arregla'),
('redes-etiqueta','Redes','bardo','reserve','Etiquetar a alguien en una foto fea requiere permiso tácito.','Requiere permiso','Da igual'),
('facultad-ausente','Facultad','bardo','reserve','Quien no fue nunca no puede pedir resumen personalizado.','No puede','Hay que pasarle'),
('laburo-llamada','Laburo','bardo','reserve','Llamar sin avisar por algo que entraba en un mensaje es invasivo.','Es invasivo','Es más rápido'),
('viaje-despertar','Viajes','bardo','reserve','Despertar a todos temprano en vacaciones es abuso de confianza.','Es abuso','Hay que aprovechar'),
('convi-luz','Convivencia','bardo','reserve','Dejar luces prendidas en una casa ajena no es un detalle.','No es detalle','Es mínimo'),
('plata-cobro','Plata','bardo','reserve','Recordar una deuda en el grupo expone de más.','Expone de más','Resuelve rápido'),
('juego-ganador','Juegos','bardo','reserve','El ganador que explica por qué ganó arruina la victoria.','La arruina','La celebra'),
('futbol-picada','Fútbol','bardo','reserve','Elegir la picada durante el partido distrae más de la cuenta.','Distrae','Es parte'),
('plan-dresscode','Planes','bardo','reserve','Poner dress code para una juntada casera es de más.','Es de más','Suma onda'),
('habito-respuesta','Hábitos','bardo','reserve','Responder “ahí voy” y no moverte por diez minutos es chamuyo.','Es chamuyo','Es normal'),
('asado-carbon','Asado','bardo','reserve','Llegar con carbón salva más que llegar con postre.','Salva más','Postre gana'),
('mate-galletitas','Mate','bardo','reserve','Poner galletitas en la ronda de mate mejora todo.','Mejora todo','Ensucia'),
('salida-ubicacion','Salidas','bardo','reserve','Mandar “estoy llegando” sin ubicación no informa nada.','No informa','Alcanza'),
('musica-vergüenza','Música','bardo','reserve','Una canción vergonzosa se canta más fuerte si todos la saben.','Más fuerte','Se evita'),
('amistad-planes','Amistades','bardo','reserve','El amigo que organiza todo gana derecho a quejarse un poco.','Gana derecho','No se queja')
on conflict (id) do update set category=excluded.category,intensity=excluded.intensity,status=excluded.status,text=excluded.text,side_a=excluded.side_a,side_b=excluded.side_b;

-- Editorial tightening v2: each card must state a concrete, defendable conflict.
update public.prompts as target
set text = source.text, side_a = source.side_a, side_b = source.side_b
from (values
  ('asado-pan', 'En un asado, el pan con chimichurri se sirve antes que la carne.', 'Se sirve antes', 'Espera carne'),
  ('mate-excusa', 'En una charla larga, cebar mate importa más que tomarlo.', 'Importa más', 'No tanto'),
  ('mate-ronda', 'Si el mate está lavado, quien ceba tiene que avisar antes de pasarlo.', 'Tiene que avisar', 'Se nota solo'),
  ('fila-bar', 'Si un bar tiene fila larga, el grupo debería cambiar de lugar.', 'Cambia', 'Espera'),
  ('playlist-viaje', 'Quien arma la playlist del viaje decide qué temas no se saltean.', 'Decide', 'Se vota'),
  ('grupo-nombre', 'El nombre del grupo de WhatsApp se cambia sólo con aprobación de la mayoría.', 'Mayoría decide', 'Cualquiera cambia'),
  ('plan-sorpresa', 'En un plan sorpresa, una persona del grupo tiene que saberlo de antemano.', 'Tiene que saber', 'Nadie sabe'),
  ('apodo-grupo', 'Un apodo del grupo deja de ser gracioso cuando la persona pide que no lo usen.', 'Se deja', 'Se banca'),
  ('facultad-grupo', 'En un trabajo grupal, quien hace la portada también debería hacer menos del resto.', 'Hace menos', 'Hace igual'),
  ('parcial-descanso', 'La noche antes de un parcial conviene dormir antes que seguir repasando por pánico.', 'Dormir', 'Repasar'),
  ('trabajo-camara', 'En una reunión remota, tener cámara apagada debería obligar a responder cuando te nombran.', 'Obliga', 'No cambia'),
  ('laburo-mate', 'En una oficina, el mate compartido justifica cortar cinco minutos el laburo.', 'Justifica', 'Se toma trabajando'),
  ('mapa-viaje', 'En un viaje, perderse una vez vale si aparece un lugar mejor.', 'Vale', 'No vale'),
  ('manta-sillon', 'Quien siempre usa la manta del sillón tiene prioridad cuando hace frío.', 'Tiene prioridad', 'Es de todos'),
  ('vaquita-redonda', 'En una vaquita, redondear para arriba evita más vueltas que calcular exacto.', 'Se redondea', 'Se calcula'),
  ('oferta-comun', 'Si una promo es para dos, el grupo debería reorganizarse para aprovecharla.', 'Se reorganiza', 'Cada uno pide'),
  ('futbol-asado', 'Durante un partido, la picada se repone en el entretiempo, no cuando se termina.', 'Entretiempo', 'Cuando falta'),
  ('futbol-repeticion', 'Después de un golazo, el grupo puede pedir tres repeticiones.', 'Puede pedir', 'Una alcanza'),
  ('plan-domingo', 'Si no hay plan para el domingo, nadie debería proponer uno a último momento.', 'Nadie propone', 'Siempre se propone'),
  ('cumple-tema', 'En un cumpleaños con temática, quien no se disfraza no puede criticar las fotos.', 'No critica', 'Puede criticar'),
  ('siesta', 'Una siesta después de almorzar debería tener alarma obligatoria.', 'Con alarma', 'Sin alarma'),
  ('asado-ensalada', 'En un asado, quien no come carne debería tener una opción pensada desde el inicio.', 'Se contempla', 'Se arregla'),
  ('salida-guardarropa', 'En una salida con abrigo, pagar guardarropa evita que alguien cargue todo.', 'Se paga', 'Se lleva'),
  ('redes-comentario', 'Comentar una foto de un amigo debería valer más que dejar un like.', 'Vale más', 'Con un like alcanza'),
  ('facultad-cafe', 'En época de parciales, el café cuenta como parte del estudio.', 'Cuenta', 'Es sólo excusa'),
  ('plata-regalo', 'Para un regalo grupal, poner el mismo monto importa más que elegir algo personal.', 'Mismo monto', 'Algo personal'),
  ('amistad-favor', 'Después de hacer un favor grande, está bien recordarlo si te piden otro.', 'Está bien', 'No se cobra'),
  ('tecnologia-notas', 'Anotar todo en el celular hace que dependas demasiado de él.', 'Dependés', 'Te libera'),
  ('mate-celular', 'Quien ceba mate no debería mirar el celular hasta terminar la ronda.', 'No debería', 'Puede mirar'),
  ('mate-prestado', 'Un mate prestado se devuelve limpio aunque nadie lo pida.', 'Se devuelve limpio', 'No hace falta'),
  ('queda-bien', 'Si alguien pregunta cómo le queda algo, la respuesta sincera vale más que quedar bien.', 'Sincera', 'Se cuida'),
  ('musica-dj', 'Quien pide el parlante debería aceptar que le salteen temas.', 'Tiene que aceptar', 'Decide todo'),
  ('desaparece-pide', 'El que desaparece del grupo una semana no puede volver sólo para pedir un favor.', 'No puede', 'Puede volver'),
  ('laburo-responder', 'Responder “lo veo” sin fecha habilita a que te lo recuerden.', 'Habilita', 'No habilita'),
  ('viaje-responsable', 'En un viaje, quien arma el itinerario gana derecho a apurar al grupo.', 'Gana derecho', 'No apura'),
  ('pre-viaje-maleta', 'Hacer la valija la noche anterior justifica olvidarse algo.', 'Justifica', 'No justifica'),
  ('convivencia-lista', 'El que compra para todos no tiene por qué perseguir transferencias.', 'No tiene por qué', 'Le toca insistir'),
  ('baño-ocupado', 'Si hay gente esperando, quien entra al baño debería avisar que va a tardar.', 'Tiene que avisar', 'No hace falta'),
  ('paga-persigue', 'El que paga para todos tiene derecho a recordar transferencias sin quedar pesado.', 'Tiene derecho', 'Es pesado'),
  ('juego-reglas-bardo', 'Antes de empezar un juego, explicar las reglas completas debería ser obligatorio.', 'Obligatorio', 'Se aprende jugando'),
  ('futbol-grito', 'Gritar un gol antes de que entre obliga a bancarse la mufa si no entra.', 'Se banca', 'No existe'),
  ('asado-ensalada-bardo', 'Quien no aportó al asado no puede elegir qué corte se compra.', 'No puede', 'Puede elegir'),
  ('amistad-cumple', 'Olvidarte un cumpleaños exige un gesto, no sólo una excusa.', 'Exige un gesto', 'Con excusa alcanza')
) as source(id, text, side_a, side_b)
where target.id = source.id;

-- Continuation of the editorial audit for the remaining vague or closed formulations.
update public.prompts as target
set text = source.text, side_a = source.side_a, side_b = source.side_b
from (values
  ('cancion-conocida', 'En una juntada, cantar mal un tema conocido está permitido si todos se suman.', 'Está permitido', 'Se evita'),
  ('memes', 'En el grupo, un meme puede responder una pregunta sin explicaciones extra.', 'Puede responder', 'No alcanza'),
  ('redes-borrar', 'Si alguien borra una historia enseguida, el grupo puede preguntarle qué pasó.', 'Puede preguntar', 'No se pregunta'),
  ('foto-grupal', 'En una salida, sacarse una foto grupal vale aunque quede sólo en el chat.', 'Vale igual', 'Se comparte'),
  ('futbol-relato', 'En un partido importante, el relato de radio debería quedar de fondo aunque haya transmisión.', 'Debería quedar', 'No hace falta'),
  ('pizza-fria', 'La pizza fría del día siguiente se come sin recalentar.', 'Se come fría', 'Se recalienta'),
  ('musica-auriculares', 'Ofrecer un auricular para mostrar un tema debería ser un gesto, no una invasión.', 'Es un gesto', 'Es invasivo'),
  ('amistad-ubicacion', 'En una salida, mandar ubicación en vivo debería ser obligatorio si alguien llega después.', 'Obligatorio', 'No hace falta'),
  ('viaje-fotos', 'En un viaje, sacar fotos de cada parada vale aunque retrase al grupo.', 'Vale la pena', 'Retrasa de más'),
  ('juego-revancha', 'Después de perder, pedir revancha antes de cambiar de juego es válido.', 'Es válido', 'Es capricho'),
  ('futbol-camiseta', 'Para ver un partido importante, ponerse camiseta suma aunque no sea del equipo.', 'Suma', 'Da igual'),
  ('mate-termo', 'Si compartís mate, también deberías poner el termo.', 'Deberías ponerlo', 'No hace falta'),
  ('jajaj-rendirse', 'Después de una discusión, mandar “jajaj” debería cerrar el tema.', 'Debería cerrarlo', 'No alcanza'),
  ('silenciar-grupo', 'Quien silencia el grupo una semana no puede volver pidiendo el resumen.', 'No puede', 'Puede pedirlo'),
  ('jaja-mal', 'Responder “jaja mal” debería obligarte a aportar algo más a la conversación.', 'Debería', 'Alcanza'),
  ('historias-todo', 'En una salida, subir historias todo el tiempo debería hacerte guardar el celular un rato.', 'Debería', 'No cambia nada'),
  ('parcial-grupo', 'Después de un parcial, comparar respuestas debería estar prohibido hasta la nota.', 'Prohibido', 'Hay que comparar'),
  ('viaje-cuentas', 'En un viaje, anotar cada gasto debería ser obligatorio aunque corte el clima.', 'Obligatorio', 'Corta el clima'),
  ('calculadora-salida', 'En una salida, dividir hasta el último peso debería hacerse aunque demore la cuenta.', 'Debería hacerse', 'Se redondea'),
  ('vuelto-chico', 'Cobrar un vuelto mínimo una semana después debería dar vergüenza.', 'Debería darla', 'Se cobra igual'),
  ('futbol-repeticion-bardo', 'Durante una charla, frenar todo para ver una repetición está permitido.', 'Está permitido', 'Es demasiado'),
  ('mate-galletitas', 'En la ronda de mate, poner galletitas debería ser obligatorio.', 'Obligatorio', 'Ensucia'),
  ('futbol-cabala', 'Quien se cambia de lugar por cábala puede pedir que nadie lo mueva.', 'Puede pedirlo', 'No da'),
  ('asado-carbon', 'En un asado, traer carbón debería contar más que traer postre.', 'Carbón cuenta más', 'Postre gana')
) as source(id, text, side_a, side_b)
where target.id = source.id;

create or replace function public.assert_live_room(p_room uuid) returns public.rooms language plpgsql security definer set search_path=public as $$ declare r rooms; begin select * into r from rooms where id=p_room for update; if not found then raise exception 'Sala no encontrada'; end if; if r.expires_at<=now() then raise exception 'Sala vencida'; end if; if not exists(select 1 from players where room_id=p_room and auth_user_id=auth.uid()) then raise exception 'No pertenecés a esta sala'; end if; return r; end $$;
create or replace function public.viewer_player(p_room uuid) returns uuid language sql stable security definer set search_path=public as $$ select id from players where room_id=p_room and auth_user_id=auth.uid() $$;
create or replace function public.deal_prompt(p_room uuid,p_intensity text) returns text language plpgsql security definer set search_path=public as $$
declare d prompt_decks; chosen text; chosen_position integer; last_category text; recent text[]; displaced text;
begin
  select * into d from prompt_decks where room_id=p_room and intensity=p_intensity for update;
  if d.cursor>=coalesce(array_length(d.deck,1),0) then
    d.deck:=array(select id from prompts where intensity=p_intensity and status='active' order by random()); d.cursor:=0; d.cycle:=d.cycle+1;
  end if;
  recent:=case when coalesce(array_length(d.history,1),0)>0 then d.history[greatest(array_length(d.history,1)-9,1):array_length(d.history,1)] else array[]::text[] end;
  select category into last_category from prompts where id=d.history[array_length(d.history,1)];
  select d.deck[i],i into chosen,chosen_position from generate_subscripts(d.deck,1) i join prompts p on p.id=d.deck[i]
    where i>d.cursor and not(d.deck[i]=any(recent)) and p.category is distinct from last_category order by i limit 1;
  if chosen is null then
    select d.deck[i],i into chosen,chosen_position from generate_subscripts(d.deck,1) i where i>d.cursor and not(d.deck[i]=any(recent)) order by i limit 1;
  end if;
  if chosen is null then chosen:=d.deck[d.cursor+1]; chosen_position:=d.cursor+1; end if;
  displaced:=d.deck[d.cursor+1]; d.deck[d.cursor+1]:=chosen; d.deck[chosen_position]:=case when chosen_position=d.cursor+1 then chosen else displaced end;
  d.cursor:=d.cursor+1; d.history:=array_append(d.history,chosen);
  update prompt_decks set deck=d.deck,cursor=d.cursor,history=d.history,cycle=d.cycle where room_id=p_room and intensity=p_intensity;
  return chosen;
end $$;

create or replace function public.resolve_room(p_ref text) returns uuid language plpgsql stable security definer set search_path=public as $$
declare target uuid; begin select id into target from rooms where code=upper(trim(p_ref)) or id::text=p_ref; if target is null then raise exception 'Sala no encontrada'; end if; return target; end $$;

create or replace function public.notify_room(p_room uuid) returns void language plpgsql security definer set search_path=public as $$
declare r rooms; begin update rooms set version=version+1 where id=p_room returning * into r; perform realtime.send(jsonb_build_object('version',r.version),'room_changed','room:'||r.code,true); end $$;

create or replace function public.get_room_snapshot(p_code text) returns jsonb language plpgsql security definer set search_path=public as $$
declare rid uuid:=public.resolve_room(p_code); r rooms; latest rounds; viewer uuid; phase_value text;
begin
  select * into r from public.assert_live_room(rid); select public.viewer_player(rid) into viewer;
  select * into latest from rounds where room_id=rid order by number desc limit 1;
  phase_value:=case when r.phase='playing' and latest.id is not null then latest.phase when r.phase='finished' then 'finished' else 'lobby' end;
  return jsonb_build_object(
    'code',r.code,'hostId',r.host_player_id,'intensity',r.intensity,'phase',phase_value,
    'players',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'nickname',p.nickname,'isHost',p.is_host,'score',p.score,'activeFromRound',p.active_from_round,'juryRounds',p.jury_rounds) order by p.joined_at) from players p where p.room_id=rid),'[]'::jsonb),
    'rounds',coalesce((select jsonb_agg(jsonb_build_object('number',q.number,'promptId',q.prompt_id,'prompt',jsonb_build_object('id',pr.id,'category',pr.category,'intensity',pr.intensity,'status',pr.status,'text',pr.text,'sideA',pr.side_a,'sideB',pr.side_b),'jurorIds',coalesce((select jsonb_agg(rp.player_id) from round_players rp where rp.round_id=q.id and rp.role='juror'),'[]'::jsonb),'assignments',coalesce((select jsonb_object_agg(rp.player_id,rp.side) from round_players rp where rp.round_id=q.id and rp.role='debater'),'{}'::jsonb),'debateEndsAt',q.ends_at,'voteEndsAt',q.vote_ends_at,'votes',case when q.phase='results' then coalesce((select jsonb_agg(jsonb_build_object('playerId',v.player_id,'side',v.side)) from votes v where v.round_id=q.id),'[]'::jsonb) else coalesce((select jsonb_agg(jsonb_build_object('playerId',v.player_id,'side',v.side)) from votes v where v.round_id=q.id and v.player_id=viewer),'[]'::jsonb) end,'changeRequests',coalesce((select jsonb_agg(c.player_id) from prompt_change_requests c where c.round_id=q.id),'[]'::jsonb),'result',q.result,'wasRandomTiebreak',q.was_random_tiebreak) order by q.number) from rounds q join prompts pr on pr.id=q.prompt_id where q.room_id=rid),'[]'::jsonb),
    'decks',jsonb_build_object('tranqui',jsonb_build_object('order','[]'::jsonb,'cursor',0,'history','[]'::jsonb,'cycle',1),'bardo',jsonb_build_object('order','[]'::jsonb,'cursor',0,'history','[]'::jsonb,'cycle',1)),
    'lastOddExtraSide',r.last_odd_extra_side,'createdAt',r.created_at,'expiresAt',r.expires_at,'serverNow',now(),'viewerPlayerId',viewer
  );
end $$;

create or replace function public.create_room(p_nickname text,p_intensity text default 'tranqui') returns jsonb language plpgsql security definer set search_path=public as $$
declare rid uuid; pid uuid; generated text; attempts integer:=0;
begin
  if auth.uid() is null then raise exception 'Iniciá una sesión anónima antes de crear una sala'; end if;
  if char_length(trim(p_nickname)) not between 2 and 16 then raise exception 'El apodo debe tener entre 2 y 16 caracteres'; end if;
  loop
    generated:=array_to_string(array(select substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',floor(random()*32)::integer+1,1) from generate_series(1,8)),'');
    begin
      insert into rooms(code,intensity) values(generated,p_intensity) returning id into rid; exit;
    exception when unique_violation then attempts:=attempts+1; if attempts>=5 then raise exception 'No se pudo generar un código único'; end if;
    end;
  end loop;
  insert into players(room_id,auth_user_id,nickname,is_host) values(rid,auth.uid(),trim(p_nickname),true) returning id into pid;
  update rooms set host_player_id=pid where id=rid;
  insert into prompt_decks(room_id,intensity,deck) select rid,x,array(select id from prompts where intensity=x and status='active' order by random()) from unnest(array['tranqui','bardo']) x;
  insert into events(room_id,player_id,name) values(rid,pid,'room_created');
  return public.get_room_snapshot(generated);
end $$;

create or replace function public.join_room(p_code text,p_nickname text) returns jsonb language plpgsql security definer set search_path=public as $$
declare rid uuid:=public.resolve_room(p_code); r rooms; pid uuid;
begin
  if auth.uid() is null then raise exception 'Iniciá una sesión anónima antes de entrar'; end if;
  select * into r from rooms where id=rid for update; if r.expires_at<=now() then raise exception 'Sala vencida'; end if;
  select id into pid from players where room_id=rid and auth_user_id=auth.uid();
  if pid is null then
    if r.phase not in ('lobby','playing','paused') then raise exception 'La partida terminó'; end if;
    if (select count(*) from players where room_id=rid)>=8 then raise exception 'La sala está completa'; end if;
    if char_length(trim(p_nickname)) not between 2 and 16 then raise exception 'El apodo debe tener entre 2 y 16 caracteres'; end if;
    insert into players(room_id,auth_user_id,nickname,active_from_round) values(rid,auth.uid(),trim(p_nickname),case when r.phase='lobby' then 1 else r.round_count+1 end) returning id into pid;
    insert into events(room_id,player_id,name) values(rid,pid,'player_joined'); perform public.notify_room(rid);
  end if;
  return public.get_room_snapshot(p_code);
end $$;

create or replace function public.start_new_round(p_room uuid) returns void language plpgsql security definer set search_path=public as $$
declare r rooms; n integer; prompt text; previous_round uuid; new_round uuid; jurors uuid[]; extra text; target_a integer; candidate record; pos integer:=0;
begin
  select * into r from rooms where id=p_room for update;
  n:=r.round_count+1; if n>5 then update rooms set phase='finished' where id=p_room; return; end if;
  select id into previous_round from rounds where room_id=p_room order by number desc limit 1;
  select array_agg(id) into jurors from (
    select p.id from players p where p.room_id=p_room and p.active_from_round<=n
    order by p.jury_rounds,case when exists(select 1 from round_players rp where rp.round_id=previous_round and rp.player_id=p.id and rp.role='juror') then 1 else 0 end,random()
    limit case when (select count(*) from players where room_id=p_room and active_from_round<=n)>=6 then 2 else 1 end
  ) jury;
  update players set jury_rounds=jury_rounds+1 where id=any(jurors);
  if ((select count(*) from players where room_id=p_room and active_from_round<=n and not(id=any(jurors)))%2)=1 then extra:=case when r.last_odd_extra_side is null then case when random()<.5 then 'A' else 'B' end when r.last_odd_extra_side='A' then 'B' else 'A' end; else extra:=null; end if;
  target_a:=floor((select count(*) from players where room_id=p_room and active_from_round<=n and not(id=any(jurors)))/2.0)::int+case when extra='A' then 1 else 0 end;
  prompt:=public.deal_prompt(p_room,r.intensity);
  insert into rounds(room_id,number,prompt_id,phase,ends_at) values(p_room,n,prompt,'debating',now()+interval '60 seconds') returning id into new_round;
  for candidate in
    select p.id,coalesce(old.side,'') as previous_side from players p left join lateral (select side from round_players where round_id=previous_round and player_id=p.id) old on true
    where p.room_id=p_room and p.active_from_round<=n and not(p.id=any(jurors))
    order by case when old.side='B' then 0 when old.side='A' then 1 else 2 end,random()
  loop
    pos:=pos+1; insert into round_players(round_id,player_id,role,side) values(new_round,candidate.id,'debater',case when pos<=target_a then 'A' else 'B' end);
  end loop;
  insert into round_players(round_id,player_id,role) select new_round,unnest(jurors),'juror';
  update rooms set round_count=n,phase='playing',last_odd_extra_side=coalesce(extra,last_odd_extra_side) where id=p_room;
  insert into events(room_id,name,metadata) values(p_room,'round_started',jsonb_build_object('round',n));
end $$;

create or replace function public.start_game(p_room_id text) returns jsonb language plpgsql security definer set search_path=public as $$
declare rid uuid:=public.resolve_room(p_room_id); r rooms;
begin select * into r from public.assert_live_room(rid); if r.host_player_id<>public.viewer_player(rid) then raise exception 'Sólo el host puede empezar'; end if; if r.phase<>'lobby' then raise exception 'La partida ya empezó'; end if; if (select count(*) from players where room_id=rid) not between 3 and 8 then raise exception 'Se necesitan entre tres y ocho jugadores'; end if; perform public.start_new_round(rid); perform public.notify_room(rid); return public.get_room_snapshot(p_room_id); end $$;

create or replace function public.advance_to_voting(p_room_id text) returns jsonb language plpgsql security definer set search_path=public as $$
declare rid uuid:=public.resolve_room(p_room_id); r rooms; current rounds;
begin select * into r from public.assert_live_room(rid); if r.host_player_id<>public.viewer_player(rid) then raise exception 'Sólo el host abre la votación'; end if; select * into current from rounds where room_id=rid order by number desc limit 1 for update; if current.phase in ('voting','results') then return public.get_room_snapshot(p_room_id); end if; if current.phase<>'debating' then raise exception 'La ronda no está debatiendo'; end if; update rounds set phase='voting',vote_ends_at=now()+interval '30 seconds' where id=current.id; insert into events(room_id,name) values(rid,'voting_opened'); perform public.notify_room(rid); return public.get_room_snapshot(p_room_id); end $$;

create or replace function public.finalize_round(p_round uuid) returns void language plpgsql security definer set search_path=public as $$
declare a integer; b integer; winner text; random_tie boolean; room_ref uuid;
begin
  select room_id into room_ref from rounds where id=p_round for update;
  if (select phase from rounds where id=p_round)='results' then return; end if;
  select count(*) filter(where side='A'),count(*) filter(where side='B') into a,b from votes where round_id=p_round;
  random_tie:=a=b; winner:=case when a>b then 'A' when b>a then 'B' when random()<.5 then 'A' else 'B' end;
  update rounds set phase='results',result=winner,was_random_tiebreak=random_tie where id=p_round;
  update players p set score=score+1 from round_players rp where rp.round_id=p_round and rp.player_id=p.id and rp.role='debater' and rp.side=winner;
  insert into events(room_id,name,metadata) values(room_ref,'round_finished',jsonb_build_object('winner',winner,'random_tiebreak',random_tie));
end $$;

create or replace function public.cast_vote(p_room_id text,p_side text) returns jsonb language plpgsql security definer set search_path=public as $$
declare rid uuid:=public.resolve_room(p_room_id); current rounds; pid uuid;
begin
  perform public.assert_live_room(rid); if p_side not in ('A','B') then raise exception 'Postura inválida'; end if; pid:=public.viewer_player(rid); select * into current from rounds where room_id=rid order by number desc limit 1 for update; if current.phase<>'voting' then raise exception 'La votación no está abierta'; end if; if now()>=current.vote_ends_at then raise exception 'La votación venció'; end if; if not exists(select 1 from round_players where round_id=current.id and player_id=pid and role='juror') then raise exception 'Sólo el jurado puede votar'; end if;
  insert into votes(round_id,player_id,side) values(current.id,pid,p_side);
  if (select count(*) from votes where round_id=current.id)=(select count(*) from round_players where round_id=current.id and role='juror') then perform public.finalize_round(current.id); end if;
  perform public.notify_room(rid); return public.get_room_snapshot(p_room_id);
exception when unique_violation then raise exception 'Ya emitiste tu voto'; end $$;

create or replace function public.close_voting(p_room_id text) returns jsonb language plpgsql security definer set search_path=public as $$
declare rid uuid:=public.resolve_room(p_room_id); r rooms; current rounds;
begin select * into r from public.assert_live_room(rid); if r.host_player_id<>public.viewer_player(rid) then raise exception 'Sólo el host puede cerrar'; end if; select * into current from rounds where room_id=rid order by number desc limit 1 for update; if current.phase='results' then return public.get_room_snapshot(p_room_id); end if; if current.phase<>'voting' then raise exception 'La votación no está abierta'; end if; if now()<current.vote_ends_at then raise exception 'Todavía queda tiempo de votación'; end if; perform public.finalize_round(current.id); perform public.notify_room(rid); return public.get_room_snapshot(p_room_id); end $$;

create or replace function public.request_prompt_change(p_room_id text) returns jsonb language plpgsql security definer set search_path=public as $$
declare rid uuid:=public.resolve_room(p_room_id); current rounds; pid uuid;
begin perform public.assert_live_room(rid); pid:=public.viewer_player(rid); select * into current from rounds where room_id=rid order by number desc limit 1 for update; if current.phase<>'debating' then raise exception 'Sólo se puede pedir durante el debate'; end if; if not exists(select 1 from round_players where round_id=current.id and player_id=pid) then raise exception 'No participás de esta ronda'; end if; insert into prompt_change_requests(round_id,player_id) values(current.id,pid) on conflict do nothing; insert into events(room_id,player_id,name) values(rid,pid,'prompt_change_requested'); perform public.notify_room(rid); return public.get_room_snapshot(p_room_id); end $$;

create or replace function public.confirm_prompt_change(p_room_id text) returns jsonb language plpgsql security definer set search_path=public as $$
declare rid uuid:=public.resolve_room(p_room_id); r rooms; current rounds; prompt text;
begin select * into r from public.assert_live_room(rid); if r.host_player_id<>public.viewer_player(rid) then raise exception 'Sólo el host confirma el cambio'; end if; select * into current from rounds where room_id=rid order by number desc limit 1 for update; if current.phase<>'debating' then raise exception 'No hay un debate activo'; end if; if not exists(select 1 from prompt_change_requests where round_id=current.id) then raise exception 'No hay solicitud pendiente'; end if; prompt:=public.deal_prompt(rid,r.intensity); update rounds set prompt_id=prompt,ends_at=now()+interval '60 seconds' where id=current.id; delete from prompt_change_requests where round_id=current.id; insert into events(room_id,name) values(rid,'prompt_skipped'); perform public.notify_room(rid); return public.get_room_snapshot(p_room_id); end $$;

create or replace function public.start_round(p_room_id text) returns jsonb language plpgsql security definer set search_path=public as $$
declare rid uuid:=public.resolve_room(p_room_id); r rooms; current_phase text;
begin select * into r from public.assert_live_room(rid); if r.host_player_id<>public.viewer_player(rid) then raise exception 'Sólo el host puede continuar'; end if; if r.phase<>'playing' then raise exception 'La partida no está activa'; end if; select phase into current_phase from rounds where room_id=rid order by number desc limit 1; if current_phase is distinct from 'results' then raise exception 'Primero terminá la ronda actual'; end if; perform public.start_new_round(rid); perform public.notify_room(rid); return public.get_room_snapshot(p_room_id); end $$;

create or replace function public.set_intensity(p_room_id text,p_intensity text) returns jsonb language plpgsql security definer set search_path=public as $$
declare rid uuid:=public.resolve_room(p_room_id); r rooms; current_phase text;
begin select * into r from public.assert_live_room(rid); if r.host_player_id<>public.viewer_player(rid) then raise exception 'Sólo el host puede cambiar el modo'; end if; if p_intensity not in ('tranqui','bardo') then raise exception 'Modo inválido'; end if; select phase into current_phase from rounds where room_id=rid order by number desc limit 1; if r.phase<>'lobby' and current_phase is distinct from 'results' then raise exception 'Cambiá el modo entre rondas'; end if; update rooms set intensity=p_intensity where id=rid; perform public.notify_room(rid); return public.get_room_snapshot(p_room_id); end $$;

create or replace function public.rematch(p_room_id text) returns jsonb language plpgsql security definer set search_path=public as $$
declare rid uuid:=public.resolve_room(p_room_id); r rooms;
begin select * into r from public.assert_live_room(rid); if r.host_player_id<>public.viewer_player(rid) then raise exception 'Sólo el host puede pedir revancha'; end if; if r.phase<>'finished' then raise exception 'La revancha se habilita al terminar'; end if; delete from rounds where room_id=rid; update players set score=0,jury_rounds=0,active_from_round=1 where room_id=rid; update rooms set phase='lobby',round_count=0,last_odd_extra_side=null where id=rid; insert into events(room_id,name) values(rid,'rematch_started'); perform public.notify_room(rid); return public.get_room_snapshot(p_room_id); end $$;

create or replace function public.pause_game(p_room_id text) returns jsonb language plpgsql security definer set search_path=public as $$
declare rid uuid:=public.resolve_room(p_room_id); r rooms; begin select * into r from public.assert_live_room(rid); if r.host_player_id<>public.viewer_player(rid) then raise exception 'Sólo el host puede pausar'; end if; if r.phase<>'playing' then raise exception 'La partida no está activa'; end if; update rooms set phase='paused' where id=rid; perform public.notify_room(rid); return public.get_room_snapshot(p_room_id); end $$;
create or replace function public.resume_game(p_room_id text) returns jsonb language plpgsql security definer set search_path=public as $$
declare rid uuid:=public.resolve_room(p_room_id); r rooms; begin select * into r from public.assert_live_room(rid); if r.host_player_id<>public.viewer_player(rid) then raise exception 'Sólo el host puede reanudar'; end if; if r.phase<>'paused' then raise exception 'La partida no está pausada'; end if; update rooms set phase='playing' where id=rid; perform public.notify_room(rid); return public.get_room_snapshot(p_room_id); end $$;
create or replace function public.cancel_game(p_room_id text) returns jsonb language plpgsql security definer set search_path=public as $$
declare rid uuid:=public.resolve_room(p_room_id); r rooms; begin select * into r from public.assert_live_room(rid); if r.host_player_id<>public.viewer_player(rid) then raise exception 'Sólo el host puede cancelar'; end if; update rooms set phase='cancelled' where id=rid; insert into events(room_id,name) values(rid,'game_cancelled'); perform public.notify_room(rid); return public.get_room_snapshot(p_room_id); end $$;

-- Private Realtime: members can receive Broadcast and Presence only for their own room topic.
create policy "room members receive realtime" on realtime.messages for select to authenticated using (realtime.topic() like 'room:%' and exists(select 1 from public.rooms r where r.code=split_part(realtime.topic(),':',2) and public.is_room_member(r.id)));
create policy "room members send presence" on realtime.messages for insert to authenticated with check (realtime.topic() like 'room:%' and exists(select 1 from public.rooms r where r.code=split_part(realtime.topic(),':',2) and public.is_room_member(r.id)));

grant execute on function public.create_room(text,text),public.join_room(text,text),public.get_room_snapshot(text),public.start_game(text),public.start_round(text),public.advance_to_voting(text),public.cast_vote(text,text),public.close_voting(text),public.request_prompt_change(text),public.confirm_prompt_change(text),public.set_intensity(text,text),public.rematch(text),public.pause_game(text),public.resume_game(text),public.cancel_game(text) to authenticated;

-- Hito 4 base installation: keep this in sync with 202608130004_add_resilience.sql.
-- Hito 4: server-authoritative resilience for existing Contramano projects.
-- Safe to run after 202608130003_tighten_prompt_conflicts.sql. It preserves rooms,
-- rounds, votes and RLS; it only adds recovery metadata and replaces RPCs.

alter table public.rooms add column if not exists paused_at timestamptz;
alter table public.rooms add column if not exists paused_phase text check (paused_phase in ('debating','voting'));
alter table public.rooms add column if not exists pause_reason text check (pause_reason in ('low_players','host'));
alter table public.rooms add column if not exists successor_room_id uuid references public.rooms(id);
alter table public.players add column if not exists last_seen_at timestamptz not null default now();
update public.players set last_seen_at=coalesce(last_seen_at, joined_at, now()) where last_seen_at is null;
create index if not exists players_room_last_seen_idx on public.players(room_id,last_seen_at desc);

create or replace function public.assert_live_room(p_room uuid) returns public.rooms language plpgsql security definer set search_path=public as $$
declare r public.rooms;
begin
  select * into r from public.rooms where id=p_room for update;
  if not found then raise exception 'Sala no encontrada'; end if;
  if r.expires_at<=now() then raise exception 'Sala vencida'; end if;
  if r.phase='cancelled' then raise exception 'Sala cancelada'; end if;
  if not exists(select 1 from public.players where room_id=p_room and auth_user_id=auth.uid()) then raise exception 'No pertenecÃ©s a esta sala'; end if;
  return r;
end $$;

create or replace function public.connected_player_count(p_room uuid) returns integer language sql stable security definer set search_path=public as $$
  select count(*)::integer from public.players where room_id=p_room and last_seen_at>=now()-interval '20 seconds'
$$;

create or replace function public.pause_active_room(p_room uuid,p_reason text) returns boolean language plpgsql security definer set search_path=public as $$
declare r public.rooms; current public.rounds;
begin
  select * into r from public.rooms where id=p_room for update;
  if r.phase<>'playing' then return false; end if;
  select * into current from public.rounds where room_id=p_room order by number desc limit 1 for update;
  if current.phase not in ('debating','voting') then return false; end if;
  update public.rooms set phase='paused',paused_at=now(),paused_phase=current.phase,pause_reason=p_reason where id=p_room;
  insert into public.events(room_id,name,metadata) values(p_room,'game_paused',jsonb_build_object('reason',p_reason));
  return true;
end $$;

create or replace function public.transfer_absent_host(p_room uuid) returns boolean language plpgsql security definer set search_path=public as $$
declare r public.rooms; next_host uuid; host_seen timestamptz;
begin
  select * into r from public.rooms where id=p_room for update;
  select last_seen_at into host_seen from public.players where id=r.host_player_id;
  if host_seen is not null and host_seen>=now()-interval '45 seconds' then return false; end if;
  if public.connected_player_count(p_room)<3 then return false; end if;
  select id into next_host from public.players
    where room_id=p_room and id<>r.host_player_id and last_seen_at>=now()-interval '20 seconds'
    order by joined_at,id limit 1;
  if next_host is null then return false; end if;
  update public.players set is_host=(id=next_host) where room_id=p_room;
  update public.rooms set host_player_id=next_host where id=p_room;
  insert into public.events(room_id,player_id,name,metadata) values(p_room,next_host,'host_transferred',jsonb_build_object('previous_host',r.host_player_id,'new_host',next_host));
  return true;
end $$;

create or replace function public.reconcile_room(p_room_id text) returns jsonb language plpgsql security definer set search_path=public as $$
declare rid uuid:=public.resolve_room(p_room_id); r public.rooms; current public.rounds; changed boolean:=false;
begin
  select * into r from public.assert_live_room(rid);
  if r.phase in ('playing','paused') and public.connected_player_count(rid)<3 then
    changed:=public.pause_active_room(rid,'low_players') or changed;
  end if;
  changed:=public.transfer_absent_host(rid) or changed;
  select * into r from public.rooms where id=rid for update;
  if r.phase='playing' then
    select * into current from public.rounds where room_id=rid order by number desc limit 1 for update;
    if current.phase='debating' and now()>=current.ends_at then
      update public.rounds set phase='voting',vote_ends_at=now()+interval '30 seconds' where id=current.id;
      insert into public.events(room_id,name) values(rid,'voting_opened'); changed:=true;
    elsif current.phase='voting' and now()>=current.vote_ends_at then
      perform public.finalize_round(current.id); changed:=true;
    end if;
  end if;
  if changed then perform public.notify_room(rid); end if;
  return public.get_room_snapshot(p_room_id);
end $$;

create or replace function public.heartbeat(p_room_id text) returns jsonb language plpgsql security definer set search_path=public as $$
declare rid uuid:=public.resolve_room(p_room_id); pid uuid;
begin
  perform public.assert_live_room(rid);
  select public.viewer_player(rid) into pid;
  update public.players set last_seen_at=now() where id=pid;
  return public.reconcile_room(p_room_id);
end $$;

create or replace function public.resume_room_member(p_room_id text) returns jsonb language plpgsql security definer set search_path=public as $$
declare rid uuid:=public.resolve_room(p_room_id);
begin
  perform public.assert_live_room(rid);
  return public.get_room_snapshot(p_room_id);
end $$;

create or replace function public.get_room_snapshot(p_code text) returns jsonb language plpgsql security definer set search_path=public as $$
declare rid uuid:=public.resolve_room(p_code); r public.rooms; latest public.rounds; viewer uuid; phase_value text; paused_seconds integer;
begin
  select * into r from public.assert_live_room(rid);
  select public.viewer_player(rid) into viewer;
  select * into latest from public.rounds where room_id=rid order by number desc limit 1;
  phase_value:=case
    when r.phase='playing' and latest.id is not null then latest.phase
    when r.phase='paused' then 'paused'
    when r.phase='finished' then 'finished'
    else 'lobby'
  end;
  paused_seconds:=case when r.phase='paused' and latest.id is not null and r.paused_at is not null then greatest(0,ceil(extract(epoch from ((case when r.paused_phase='voting' then latest.vote_ends_at else latest.ends_at end)-r.paused_at)))::integer) else null end;
  return jsonb_build_object(
    'code',r.code,'hostId',r.host_player_id,'intensity',r.intensity,'phase',phase_value,
    'players',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'nickname',p.nickname,'isHost',p.is_host,'score',p.score,'activeFromRound',p.active_from_round,'juryRounds',p.jury_rounds) order by p.joined_at) from public.players p where p.room_id=rid),'[]'::jsonb),
    'connectedPlayerIds',coalesce((select jsonb_agg(p.id order by p.joined_at) from public.players p where p.room_id=rid and p.last_seen_at>=now()-interval '20 seconds'),'[]'::jsonb),
    'rounds',coalesce((select jsonb_agg(jsonb_build_object('number',q.number,'promptId',q.prompt_id,'prompt',jsonb_build_object('id',pr.id,'category',pr.category,'intensity',pr.intensity,'status',pr.status,'text',pr.text,'sideA',pr.side_a,'sideB',pr.side_b),'jurorIds',coalesce((select jsonb_agg(rp.player_id) from public.round_players rp where rp.round_id=q.id and rp.role='juror'),'[]'::jsonb),'assignments',coalesce((select jsonb_object_agg(rp.player_id,rp.side) from public.round_players rp where rp.round_id=q.id and rp.role='debater'),'{}'::jsonb),'debateEndsAt',q.ends_at,'voteEndsAt',q.vote_ends_at,'votes',case when q.phase='results' then coalesce((select jsonb_agg(jsonb_build_object('playerId',v.player_id,'side',v.side)) from public.votes v where v.round_id=q.id),'[]'::jsonb) else coalesce((select jsonb_agg(jsonb_build_object('playerId',v.player_id,'side',v.side)) from public.votes v where v.round_id=q.id and v.player_id=viewer),'[]'::jsonb) end,'changeRequests',coalesce((select jsonb_agg(c.player_id) from public.prompt_change_requests c where c.round_id=q.id),'[]'::jsonb),'result',q.result,'wasRandomTiebreak',q.was_random_tiebreak) order by q.number) from public.rounds q join public.prompts pr on pr.id=q.prompt_id where q.room_id=rid),'[]'::jsonb),
    'decks',jsonb_build_object('tranqui',jsonb_build_object('order','[]'::jsonb,'cursor',0,'history','[]'::jsonb,'cycle',1),'bardo',jsonb_build_object('order','[]'::jsonb,'cursor',0,'history','[]'::jsonb,'cycle',1)),
    'lastOddExtraSide',r.last_odd_extra_side,'createdAt',r.created_at,'expiresAt',r.expires_at,'serverNow',now(),'viewerPlayerId',viewer,
    'pausedPhase',r.paused_phase,'pausedRemainingSeconds',paused_seconds,'pauseReason',r.pause_reason,
    'successorCode',(select code from public.rooms where id=r.successor_room_id)
  );
end $$;

create or replace function public.advance_to_voting(p_room_id text) returns jsonb language plpgsql security definer set search_path=public as $$
declare rid uuid:=public.resolve_room(p_room_id); r public.rooms; current public.rounds; pid uuid;
begin
  select * into r from public.assert_live_room(rid); select public.viewer_player(rid) into pid;
  select * into current from public.rounds where room_id=rid order by number desc limit 1 for update;
  if current.phase in ('voting','results') then return public.get_room_snapshot(p_room_id); end if;
  if r.phase<>'playing' then raise exception 'La partida estÃ¡ en pausa'; end if;
  if current.phase<>'debating' then raise exception 'La ronda no estÃ¡ debatiendo'; end if;
  if now()<current.ends_at and r.host_player_id<>pid then raise exception 'SÃ³lo el host abre la votaciÃ³n antes de tiempo'; end if;
  update public.rounds set phase='voting',vote_ends_at=now()+interval '30 seconds' where id=current.id;
  insert into public.events(room_id,name) values(rid,'voting_opened'); perform public.notify_room(rid);
  return public.get_room_snapshot(p_room_id);
end $$;

create or replace function public.cast_vote(p_room_id text,p_side text) returns jsonb language plpgsql security definer set search_path=public as $$
declare rid uuid:=public.resolve_room(p_room_id); r public.rooms; current public.rounds; pid uuid; inserted integer:=0; changed boolean:=false;
begin
  select * into r from public.assert_live_room(rid); if p_side not in ('A','B') then raise exception 'Postura invÃ¡lida'; end if;
  if r.phase<>'playing' then raise exception 'La partida estÃ¡ en pausa'; end if;
  select public.viewer_player(rid) into pid; select * into current from public.rounds where room_id=rid order by number desc limit 1 for update;
  if current.phase='results' then return public.get_room_snapshot(p_room_id); end if;
  if current.phase<>'voting' then raise exception 'La votaciÃ³n no estÃ¡ abierta'; end if;
  if now()>=current.vote_ends_at then perform public.finalize_round(current.id); perform public.notify_room(rid); return public.get_room_snapshot(p_room_id); end if;
  if not exists(select 1 from public.round_players where round_id=current.id and player_id=pid and role='juror') then raise exception 'SÃ³lo el jurado puede votar'; end if;
  insert into public.votes(round_id,player_id,side) values(current.id,pid,p_side) on conflict(round_id,player_id) do nothing;
  get diagnostics inserted=row_count;
  if inserted=1 and (select count(*) from public.votes where round_id=current.id)=(select count(*) from public.round_players where round_id=current.id and role='juror') then perform public.finalize_round(current.id); changed:=true; end if;
  if inserted=1 or changed then perform public.notify_room(rid); end if;
  return public.get_room_snapshot(p_room_id);
end $$;

create or replace function public.close_voting(p_room_id text) returns jsonb language plpgsql security definer set search_path=public as $$
declare rid uuid:=public.resolve_room(p_room_id); r public.rooms; current public.rounds;
begin
  select * into r from public.assert_live_room(rid); select * into current from public.rounds where room_id=rid order by number desc limit 1 for update;
  if current.phase='results' then return public.get_room_snapshot(p_room_id); end if;
  if r.phase<>'playing' then raise exception 'La partida estÃ¡ en pausa'; end if;
  if current.phase<>'voting' then raise exception 'La votaciÃ³n no estÃ¡ abierta'; end if;
  if now()<current.vote_ends_at then raise exception 'TodavÃ­a queda tiempo de votaciÃ³n'; end if;
  perform public.finalize_round(current.id); perform public.notify_room(rid); return public.get_room_snapshot(p_room_id);
end $$;

create or replace function public.pause_game(p_room_id text) returns jsonb language plpgsql security definer set search_path=public as $$
declare rid uuid:=public.resolve_room(p_room_id); r public.rooms;
begin
  select * into r from public.assert_live_room(rid);
  if r.host_player_id<>public.viewer_player(rid) then raise exception 'SÃ³lo el host puede pausar'; end if;
  perform public.pause_active_room(rid,'host'); perform public.notify_room(rid); return public.get_room_snapshot(p_room_id);
end $$;

create or replace function public.resume_game(p_room_id text) returns jsonb language plpgsql security definer set search_path=public as $$
declare rid uuid:=public.resolve_room(p_room_id); r public.rooms; current public.rounds; paused_for interval;
begin
  select * into r from public.assert_live_room(rid);
  if r.host_player_id<>public.viewer_player(rid) then raise exception 'SÃ³lo el host puede reanudar'; end if;
  if r.phase<>'paused' then return public.get_room_snapshot(p_room_id); end if;
  if public.connected_player_count(rid)<3 then raise exception 'TodavÃ­a faltan jugadores para reanudar'; end if;
  select * into current from public.rounds where room_id=rid order by number desc limit 1 for update;
  paused_for:=now()-coalesce(r.paused_at,now());
  if r.paused_phase='voting' then update public.rounds set vote_ends_at=vote_ends_at+paused_for where id=current.id;
  else update public.rounds set ends_at=ends_at+paused_for where id=current.id; end if;
  update public.rooms set phase='playing',paused_at=null,paused_phase=null,pause_reason=null where id=rid;
  insert into public.events(room_id,name) values(rid,'game_resumed'); perform public.notify_room(rid); return public.get_room_snapshot(p_room_id);
end $$;

create or replace function public.rematch(p_room_id text) returns jsonb language plpgsql security definer set search_path=public as $$
declare rid uuid:=public.resolve_room(p_room_id); r public.rooms; pid uuid; new_room uuid; generated text; attempts integer:=0;
begin
  select * into r from public.assert_live_room(rid); select public.viewer_player(rid) into pid;
  if r.host_player_id<>pid then raise exception 'SÃ³lo el host puede pedir revancha'; end if;
  if r.phase<>'finished' then raise exception 'La revancha se habilita al terminar'; end if;
  update public.players set last_seen_at=now() where id=pid;
  loop
    generated:=array_to_string(array(select substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',floor(random()*32)::integer+1,1) from generate_series(1,8)), '');
    begin insert into public.rooms(code,intensity) values(generated,r.intensity) returning id into new_room; exit;
    exception when unique_violation then attempts:=attempts+1; if attempts>=5 then raise exception 'No se pudo generar un cÃ³digo Ãºnico'; end if;
    end;
  end loop;
  insert into public.players(room_id,auth_user_id,nickname,is_host,score,jury_rounds,active_from_round,last_seen_at)
    select new_room,p.auth_user_id,p.nickname,p.id=pid,0,0,1,now() from public.players p
    where p.room_id=rid and p.last_seen_at>=now()-interval '20 seconds';
  update public.rooms set host_player_id=(select id from public.players where room_id=new_room and auth_user_id=auth.uid()) where id=new_room;
  insert into public.prompt_decks(room_id,intensity,deck)
    select new_room,x,array(select id from public.prompts where intensity=x and status='active' order by random()) from unnest(array['tranqui','bardo']) x;
  update public.rooms set successor_room_id=new_room where id=rid;
  insert into public.events(room_id,player_id,name,metadata) values(rid,pid,'rematch_started',jsonb_build_object('new_room_code',generated));
  perform public.notify_room(rid); return public.get_room_snapshot(generated);
end $$;

create or replace function public.join_room(p_code text,p_nickname text) returns jsonb language plpgsql security definer set search_path=public as $$
declare rid uuid:=public.resolve_room(p_code); r public.rooms; pid uuid;
begin
  if auth.uid() is null then raise exception 'IniciÃ¡ una sesiÃ³n anÃ³nima antes de entrar'; end if;
  select * into r from public.rooms where id=rid for update;
  if r.expires_at<=now() then raise exception 'Sala vencida'; end if;
  if r.phase='cancelled' then raise exception 'Sala cancelada'; end if;
  select id into pid from public.players where room_id=rid and auth_user_id=auth.uid();
  if pid is null then
    if r.phase not in ('lobby','playing','paused') then raise exception 'La partida terminÃ³'; end if;
    if (select count(*) from public.players where room_id=rid)>=8 then raise exception 'La sala estÃ¡ completa'; end if;
    if char_length(trim(p_nickname)) not between 2 and 16 then raise exception 'El apodo debe tener entre 2 y 16 caracteres'; end if;
    insert into public.players(room_id,auth_user_id,nickname,active_from_round,last_seen_at) values(rid,auth.uid(),trim(p_nickname),case when r.phase='lobby' then 1 else r.round_count+1 end,now()) returning id into pid;
    insert into public.events(room_id,player_id,name) values(rid,pid,'player_joined'); perform public.notify_room(rid);
  else
    update public.players set last_seen_at=now() where id=pid;
  end if;
  return public.reconcile_room(p_code);
end $$;

grant execute on function public.heartbeat(text),public.reconcile_room(text),public.resume_room_member(text) to authenticated;
grant execute on function public.advance_to_voting(text),public.cast_vote(text,text),public.close_voting(text),public.pause_game(text),public.resume_game(text),public.rematch(text),public.join_room(text,text),public.get_room_snapshot(text) to authenticated;

-- Hito 5 base installation: keep this in sync with 202608130006_add_launch_events.sql.
-- Hito 5: minimal launch metrics for existing Contramano projects.
-- Safe after 202608130005_fix_join_room_grant.sql. It preserves all data,
-- keeps RLS intact and only replaces RPCs to record aggregate game events.

create or replace function public.start_game(p_room_id text) returns jsonb language plpgsql security definer set search_path=public as $$
declare rid uuid:=public.resolve_room(p_room_id); r public.rooms; pid uuid;
begin
  select * into r from public.assert_live_room(rid);
  select public.viewer_player(rid) into pid;
  if r.host_player_id<>pid then raise exception 'Sólo el host puede empezar'; end if;
  if r.phase<>'lobby' then raise exception 'La partida ya empezó'; end if;
  if (select count(*) from public.players where room_id=rid) not between 3 and 8 then raise exception 'Se necesitan entre tres y ocho jugadores'; end if;
  perform public.start_new_round(rid);
  insert into public.events(room_id,player_id,name,metadata)
    values(rid,pid,'game_started',jsonb_build_object('player_count',(select count(*) from public.players where room_id=rid),'intensity',r.intensity));
  perform public.notify_room(rid);
  return public.get_room_snapshot(p_room_id);
end $$;

create or replace function public.start_round(p_room_id text) returns jsonb language plpgsql security definer set search_path=public as $$
declare rid uuid:=public.resolve_room(p_room_id); r public.rooms; current_phase text; pid uuid;
begin
  select * into r from public.assert_live_room(rid);
  select public.viewer_player(rid) into pid;
  if r.host_player_id<>pid then raise exception 'Sólo el host puede continuar'; end if;
  if r.phase<>'playing' then raise exception 'La partida no está activa'; end if;
  select phase into current_phase from public.rounds where room_id=rid order by number desc limit 1;
  if current_phase is distinct from 'results' then raise exception 'Primero terminá la ronda actual'; end if;
  if r.round_count>=5 then
    update public.rooms set phase='finished' where id=rid;
    insert into public.events(room_id,player_id,name) values(rid,pid,'game_finished');
    perform public.notify_room(rid);
    return public.get_room_snapshot(p_room_id);
  end if;
  perform public.start_new_round(rid);
  perform public.notify_room(rid);
  return public.get_room_snapshot(p_room_id);
end $$;

create or replace function public.track_event(p_room_id text,p_name text) returns void language plpgsql security definer set search_path=public as $$
declare rid uuid:=public.resolve_room(p_room_id); pid uuid;
begin
  perform public.assert_live_room(rid);
  if p_name<>'whatsapp_share_clicked' then raise exception 'Evento no permitido'; end if;
  select public.viewer_player(rid) into pid;
  insert into public.events(room_id,player_id,name) values(rid,pid,p_name);
end $$;

grant execute on function public.start_game(text),public.start_round(text),public.track_event(text,text) to authenticated;

create or replace function public.confirm_prompt_change(p_room_id text) returns jsonb language plpgsql security definer set search_path=public as $$
declare rid uuid:=public.resolve_room(p_room_id); r public.rooms; current_round public.rounds; next_prompt text; skipped_prompt text;
begin
  select * into r from public.assert_live_room(rid);
  if r.host_player_id<>public.viewer_player(rid) then raise exception 'Sólo el host confirma el cambio'; end if;
  select * into current_round from public.rounds where room_id=rid order by number desc limit 1 for update;
  if current_round.phase<>'debating' then raise exception 'No hay un debate activo'; end if;
  if not exists(select 1 from public.prompt_change_requests where round_id=current_round.id) then raise exception 'No hay solicitud pendiente'; end if;
  skipped_prompt:=current_round.prompt_id;
  next_prompt:=public.deal_prompt(rid,r.intensity);
  update public.rounds set prompt_id=next_prompt,ends_at=now()+interval '60 seconds' where id=current_round.id;
  delete from public.prompt_change_requests where round_id=current_round.id;
  insert into public.events(room_id,name,metadata) values(rid,'prompt_skipped',jsonb_build_object('prompt_id',skipped_prompt));
  perform public.notify_room(rid);
  return public.get_room_snapshot(p_room_id);
end $$;
